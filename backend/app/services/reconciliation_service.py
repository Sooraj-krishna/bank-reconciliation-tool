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

def calculate_score(bank_row: Dict[str, Any], invoice: Dict[str, Any]) -> int:
    """
    Calculates a confidence score (0-100) between a bank transaction and a Xero invoice.
    
    Levels:
    - Level 1: Same amount + Same date + Same reference (100)
    - Level 2: Same amount + Date within 3 days (85)
    - Level 3: Amount within 1% + Date within 5 days (60)
    - Level 4: Description contains Contact Name (Boost +10)
    """
    # Extract data
    b_amt = abs(float(bank_row.get("amount", 0)))
    i_amt = abs(float(invoice.get("Total", 0)))
    
    # Parse dates safely
    try:
        b_date = datetime.strptime(bank_row["transaction_date"], "%Y-%m-%d")
        
        # Xero dates can be "2024-05-05" (DateString) or "/Date(1714...)/" (Date)
        i_date_raw = invoice.get("DateString") or invoice.get("Date", "")
        
        if "/Date(" in str(i_date_raw):
            # Extract milliseconds from "/Date(1714915200000+0000)/"
            import re
            ms = re.search(r'\d+', str(i_date_raw))
            if ms:
                i_date = datetime.utcfromtimestamp(int(ms.group()) / 1000.0)
            else:
                return 0
        else:
            i_date = datetime.strptime(str(i_date_raw)[:10], "%Y-%m-%d")
            
    except (ValueError, TypeError, KeyError):
        return 0

    b_desc = str(bank_row.get("description", "")).lower()
    i_ref = str(invoice.get("Reference", "")).lower()
    i_num = str(invoice.get("InvoiceNumber", "")).lower()
    i_contact = str(invoice.get("Contact", {}).get("Name", "")).lower()

    date_diff = abs((b_date - i_date).days)
    amt_diff_pct = abs(b_amt - i_amt) / i_amt if i_amt != 0 else 1.0
    
    # Level 1: Perfect Match
    if b_amt == i_amt and date_diff == 0 and (i_ref in b_desc or i_num in b_desc):
        return 100

    # Level 2: High Confidence (Date proximity)
    if b_amt == i_amt and date_diff <= 3:
        score = 85
    # Level 3: Medium Confidence (Fuzzy amount/date)
    elif amt_diff_pct <= 0.01 and date_diff <= 5:
        score = 60
    else:
        score = 0

    # Level 4: Context Boost (Contact Name match)
    if b_amt == i_amt and i_contact and i_contact in b_desc:
        if score > 0:
            score = min(score + 10, 95) # Boost existing score
        else:
            score = 65 # Start with 65 if only contact matches

    # Special Case: Perfect Reference Match even if date is far off
    # If the amount and invoice number/reference match exactly, but the date is far,
    # it is a 'Strong Possible' (75%), not a 'Matched' (85%+).
    if score < 75 and b_amt == i_amt:
        if (i_ref and i_ref in b_desc) or (i_num and i_num in b_desc):
            score = 75 # "Strong Possible"

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
    matched = []
    possible = []
    unmatched_bank = []
    used_invoice_ids = set() # Track invoices already matched to prevent double-counting

    # Pre-map invoices for fast lookup by ID
    invoice_map = {inv.get("InvoiceID"): inv for inv in xero_invoices if inv.get("InvoiceID")}
    
    # Sort bank rows by date for deterministic processing (oldest first)
    sorted_bank = sorted(bank_rows, key=lambda x: x["transaction_date"])
    
    for b_row in sorted_bank:
        # STEP 1: Handle Manual Decisions from DB
        # If the user already confirmed a match, we respect it immediately
        status = b_row.get("reconciliation_status", "pending")
        manual_id = b_row.get("reconciled_invoice_id")
        
        # Parse ignored IDs from the pipe-separated string
        ignored_ids = set((b_row.get("ignored_invoice_ids") or "").split("|"))

        if status == "matched" and manual_id in invoice_map:
            best_match = invoice_map[manual_id]
            used_invoice_ids.add(manual_id)
            matched.append({
                "bank_transaction": b_row,
                "xero_invoice": best_match,
                "confidence": 100, # Manual match is always 100% confidence
                "is_manual": True
            })
            continue

        # STEP 2: Candidate Search
        candidates = []
        for inv in xero_invoices:
            inv_id = inv.get("InvoiceID")
            
            # Skip if invoice is already taken OR specifically ignored for this row
            if inv_id in used_invoice_ids or inv_id in ignored_ids:
                continue
                
            score = calculate_score(b_row, inv)
            if score >= 60: # Threshold for 'Possible' bucket
                candidates.append((score, inv))
        
        # STEP 3: Bucket Assignment
        if not candidates:
            unmatched_bank.append(b_row)
            continue
            
        # Best candidate is at index 0
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, best_match = candidates[0]
        
        # Ambiguity Detection:
        # If two invoices have the exact same best score, we cannot auto-match.
        # We flag it as 'Ambiguous' and send it to the 'Possible' bucket.
        is_ambiguous = len(candidates) > 1 and candidates[1][0] == best_score
        
        # 85 is the threshold for 'Auto-Matched'
        if best_score >= 85 and not is_ambiguous:
            used_invoice_ids.add(best_match["InvoiceID"])
            matched.append({
                "bank_transaction": b_row,
                "xero_invoice": best_match,
                "confidence": best_score
            })
        else:
            # Suggestions that are low score OR high score but conflicted (Ambiguous)
            possible.append({
                "bank_transaction": b_row,
                "xero_invoice": best_match,
                "confidence": best_score,
                "is_ambiguous": is_ambiguous
            })

    # Find Xero invoices that weren't picked by any bank row
    unmatched_xero = [inv for inv in xero_invoices if inv.get("InvoiceID") not in used_invoice_ids]

    return {
        "summary": {
            "total_bank_rows": len(bank_rows),
            "total_xero_invoices": len(xero_invoices),
            "matched_count": len(matched),
            "matched_amount": sum(abs(float(m["bank_transaction"]["amount"])) for m in matched),
            "possible_count": len(possible),
            "possible_amount": sum(abs(float(p["bank_transaction"]["amount"])) for p in possible),
            "unmatched_bank_count": len(unmatched_bank),
            "unmatched_bank_amount": sum(abs(float(b["amount"])) for b in unmatched_bank),
            "unmatched_xero_count": len(unmatched_xero),
            "unmatched_xero_amount": sum(abs(float(x["Total"])) for x in unmatched_xero)
        },
        "buckets": {
            "matched": matched,
            "possible": possible,
            "unmatched_bank": unmatched_bank,
            "unmatched_xero": unmatched_xero
        }
    }
