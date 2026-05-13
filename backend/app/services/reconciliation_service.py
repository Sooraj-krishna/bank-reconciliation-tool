"""
Reconciliation Service
----------------------
The core matching engine for the Bank Reconciliation Tool.

This module provides the logic to compare bank transactions (from CSV) 
against Xero invoices and categorize them into four buckets:
1. Matched (High confidence)
2. Possible Matches (Medium confidence)
3. Unmatched Bank (No match found)
4. Unmatched Xero (Remaining invoices)

The engine follows a priority-based scoring system (0-100).
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from app.core.config import (
    RECON_AUTO_MATCH_THRESHOLD,
    RECON_POSSIBLE_MATCH_THRESHOLD,
    RECON_DATE_DIFF_HIGH_CONFIDENCE,
    RECON_DATE_DIFF_MEDIUM_CONFIDENCE,
    RECON_AMOUNT_DIFF_PERCENTAGE,
    RECON_SCORE_LEVEL_2,
    RECON_SCORE_LEVEL_3,
    RECON_SCORE_STRONG_POSSIBLE,
    RECON_SCORE_CONTACT_ONLY,
    RECON_SCORE_CONTEXT_BOOST
)

def calculate_score(bank_row: Dict[str, Any], invoice: Dict[str, Any]) -> int:
    """
    Calculates a confidence score (0-100) between a bank transaction and a Xero invoice.
    
    Levels:
    - Level 1: Same amount + Same date + Same reference (100)
    - Level 2: Same amount + Date within 3 days (85)
    - Level 3: Amount within 1% + Date within 5 days (60)
    - Level 4: Description contains Contact Name (Boost +10)
    """
    # Determine money flow direction to prevent matching inflows with outflows
    # Bank side: > 0 is Inflow (Deposit), < 0 is Outflow (Withdrawal)
    bank_raw_amount = float(bank_row.get("amount", 0))
    bank_dir = "IN" if bank_raw_amount >= 0 else "OUT"
    
    # Xero side: ACCREC is Inflow, ACCPAY is Outflow
    # Credit notes flip the expected direction (ACCRECCREDIT = Outflow/Refund, ACCPAYCREDIT = Inflow/Refund)
    inv_type = invoice.get("Type", "")
    if inv_type == "ACCREC" or inv_type == "ACCPAYCREDIT":
        inv_dir = "IN"
    elif inv_type == "ACCPAY" or inv_type == "ACCRECCREDIT":
        inv_dir = "OUT"
    else:
        inv_dir = "UNKNOWN"

    # Strict check: If directions are known and don't match, it's not a match regardless of magnitude
    if inv_dir != "UNKNOWN" and bank_dir != inv_dir:
        return 0

    # Extract financial data for magnitude comparison
    bank_amount = abs(bank_raw_amount)
    invoice_amount = abs(float(invoice.get("Total", 0)))
    
    # Parse dates safely
    try:
        bank_date = datetime.strptime(bank_row["transaction_date"], "%Y-%m-%d")
        
        # Xero dates can be "2024-05-05" (DateString) or "/Date(1714...)/" (Date)
        invoice_date_raw = invoice.get("DateString") or invoice.get("Date", "")
        
        if "/Date(" in str(invoice_date_raw):
            # Extract milliseconds from "/Date(1714915200000+0000)/"
            import re
            milliseconds_match = re.search(r'\d+', str(invoice_date_raw))
            if milliseconds_match:
                invoice_date = datetime.utcfromtimestamp(int(milliseconds_match.group()) / 1000.0)
            else:
                return 0
        else:
            invoice_date = datetime.strptime(str(invoice_date_raw)[:10], "%Y-%m-%d")
            
    except (ValueError, TypeError, KeyError):
        return 0

    # Normalize string metadata for comparison
    bank_description = str(bank_row.get("description", "")).lower()
    invoice_reference = str(invoice.get("Reference", "")).lower()
    invoice_number = str(invoice.get("InvoiceNumber", "")).lower()
    invoice_contact_name = str(invoice.get("Contact", {}).get("Name", "")).lower()

    date_difference = abs((bank_date - invoice_date).days)
    amount_difference_percentage = abs(bank_amount - invoice_amount) / invoice_amount if invoice_amount != 0 else 1.0
    
    # Level 1: Perfect Match (Amount + Date + Exact Reference)
    if bank_amount == invoice_amount and date_difference == 0 and (invoice_reference in bank_description or invoice_number in bank_description):
        return 100

    # Level 2: High Confidence (Date proximity)
    if bank_amount == invoice_amount and date_difference <= RECON_DATE_DIFF_HIGH_CONFIDENCE:
        score = RECON_SCORE_LEVEL_2
    # Level 3: Medium Confidence (Fuzzy amount/date)
    elif amount_difference_percentage <= RECON_AMOUNT_DIFF_PERCENTAGE and date_difference <= RECON_DATE_DIFF_MEDIUM_CONFIDENCE:
        score = RECON_SCORE_LEVEL_3
    else:
        score = 0

    # Level 4: Context Boost (Contact Name match)
    if bank_amount == invoice_amount and invoice_contact_name and invoice_contact_name in bank_description:
        if score > 0:
            score = min(score + RECON_SCORE_CONTEXT_BOOST, 95) # Boost existing score
        else:
            score = RECON_SCORE_CONTACT_ONLY # Start with 65 if only contact matches

    # Special Case: Perfect Reference Match even if date is far off
    if score < RECON_SCORE_STRONG_POSSIBLE and bank_amount == invoice_amount:
        if (invoice_reference and invoice_reference in bank_description) or (invoice_number and invoice_number in bank_description):
            score = RECON_SCORE_STRONG_POSSIBLE # "Strong Possible"

    return score

def run_reconciliation(bank_rows: List[Dict[str, Any]], xero_invoices: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Main entry point for the matching engine.
    
    Processing Flow:
    1. Pre-maps Xero invoices for O(1) lookup.
    2. Sorts bank rows by date for deterministic results.
    3. Handles Manual Overrides (Matches confirmed by the user).
    4. Filters out Rejected/Ignored invoices.
    5. Calculates scores and sorts into Matched, Possible, and Unmatched buckets.
    """
    matched_bucket = []
    possible_bucket = []
    unmatched_bank_bucket = []
    used_invoice_ids = set() # Track invoices already matched to prevent double-counting

    # Pre-map invoices for fast lookup by ID
    invoice_map = {invoice.get("InvoiceID"): invoice for invoice in xero_invoices if invoice.get("InvoiceID")}
    
    # Sort bank rows by date for deterministic processing (oldest first)
    sorted_bank_rows = sorted(bank_rows, key=lambda x: x["transaction_date"])
    
    for bank_row in sorted_bank_rows:
        # STEP 1: Handle Manual Decisions from DB
        status = bank_row.get("reconciliation_status", "pending")
        manual_invoice_id = bank_row.get("reconciled_invoice_id")
        
        # Parse ignored IDs from the pipe-separated string
        ignored_invoice_ids = set((bank_row.get("ignored_invoice_ids") or "").split("|"))

        if status == "matched" and manual_invoice_id in invoice_map:
            best_match_invoice = invoice_map[manual_invoice_id]
            used_invoice_ids.add(manual_invoice_id)
            matched_bucket.append({
                "bank_transaction": bank_row,
                "xero_invoice": best_match_invoice,
                "confidence": 100, 
                "is_manual": True
            })
            continue

        # STEP 2: Candidate Search
        candidates = []
        for invoice in xero_invoices:
            invoice_id = invoice.get("InvoiceID")
            
            # Skip if invoice is already taken OR specifically ignored for this row
            if invoice_id in used_invoice_ids or invoice_id in ignored_invoice_ids:
                continue
                
            match_score = calculate_score(bank_row, invoice)
            if match_score >= RECON_POSSIBLE_MATCH_THRESHOLD: # Threshold for 'Possible' bucket
                candidates.append((match_score, invoice))
        
        # STEP 3: Bucket Assignment
        if not candidates:
            unmatched_bank_bucket.append(bank_row)
            continue
            
        # Sort by score descending to get the best match at index 0
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, best_match_invoice = candidates[0]
        
        # Ambiguity Detection:
        is_ambiguous = len(candidates) > 1 and candidates[1][0] == best_score
        
        # Check against auto-match threshold
        if best_score >= RECON_AUTO_MATCH_THRESHOLD and not is_ambiguous:
            used_invoice_ids.add(best_match_invoice["InvoiceID"])
            matched_bucket.append({
                "bank_transaction": bank_row,
                "xero_invoice": best_match_invoice,
                "confidence": best_score
            })
        else:
            # Suggestions that are low score OR high score but conflicted (Ambiguous)
            possible_bucket.append({
                "bank_transaction": bank_row,
                "xero_invoice": best_match_invoice,
                "confidence": best_score,
                "is_ambiguous": is_ambiguous
            })

    # Find Xero invoices that weren't picked by any bank row
    unmatched_xero_bucket = [invoice for invoice in xero_invoices if invoice.get("InvoiceID") not in used_invoice_ids]

    return {
        "summary": {
            "total_bank_rows": len(bank_rows),
            "total_xero_invoices": len(xero_invoices),
            "matched_count": len(matched_bucket),
            "matched_amount": sum(abs(float(m["bank_transaction"]["amount"])) for m in matched_bucket),
            "possible_count": len(possible_bucket),
            "possible_amount": sum(abs(float(p["bank_transaction"]["amount"])) for p in possible_bucket),
            "unmatched_bank_count": len(unmatched_bank_bucket),
            "unmatched_bank_amount": sum(abs(float(b["amount"])) for b in unmatched_bank_bucket),
            "unmatched_xero_count": len(unmatched_xero_bucket),
            "unmatched_xero_amount": sum(abs(float(x["Total"])) for x in unmatched_xero_bucket)
        },
        "buckets": {
            "matched": matched_bucket,
            "possible": possible_bucket,
            "unmatched_bank": unmatched_bank_bucket,
            "unmatched_xero": unmatched_xero_bucket
        }
    }
