"""
Reconciliation Service
----------------------
The core matching engine for the Bank Reconciliation Tool.

This module provides the logic to compare bank transactions (from CSV) 
against Xero invoices and categorize them into four buckets based on 
heuristic scoring and confidence levels.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

def calculate_score(bank_row: Dict[str, Any], invoice: Dict[str, Any]) -> int:
    """
    Calculates a confidence score (0-100) between a bank transaction and a Xero invoice.
    
    The engine uses a tiered scoring system to evaluate matches based on:
    1. Amount accuracy
    2. Date proximity
    3. Reference/Description similarity
    4. Contact name matching
    """
    # 1. Extraction: Get absolute amounts to compare magnitude
    b_amt = abs(float(bank_row.get("amount", 0)))
    i_amt = abs(float(invoice.get("Total", 0)))
    
    # 2. Date Parsing: Convert strings to datetime objects for mathematical comparison
    try:
        # Bank dates are normalized to YYYY-MM-DD in the parser
        b_date = datetime.strptime(bank_row["transaction_date"], "%Y-%m-%d")
        
        # Xero dates can be in multiple formats (DateString vs MS-Date Epoch)
        i_date_raw = invoice.get("DateString") or invoice.get("Date", "")
        
        # Handle Xero's JSON date format "/Date(1714915200000+0000)/"
        if "/Date(" in str(i_date_raw):
            import re
            # Regex to extract the millisecond digits
            ms = re.search(r'\d+', str(i_date_raw))
            if ms:
                # Convert milliseconds to seconds and create UTC datetime
                i_date = datetime.utcfromtimestamp(int(ms.group()) / 1000.0)
            else:
                return 0 # Fail if date format is corrupted
        else:
            # Handle standard YYYY-MM-DD format from Xero
            i_date = datetime.strptime(str(i_date_raw)[:10], "%Y-%m-%d")
            
    except (ValueError, TypeError, KeyError):
        # Return 0 if dates cannot be compared safely
        return 0

    # 3. String Normalization: Lowercase everything for case-insensitive matching
    b_desc = str(bank_row.get("description", "")).lower()
    i_ref = str(invoice.get("Reference", "")).lower()
    i_num = str(invoice.get("InvoiceNumber", "")).lower()
    i_contact = str(invoice.get("Contact", {}).get("Name", "")).lower()

    # 4. Feature Extraction: Calculate deltas
    date_diff = abs((b_date - i_date).days) # Absolute difference in days
    amt_diff_pct = abs(b_amt - i_amt) / i_amt if i_amt != 0 else 1.0 # Percentage diff
    
    # --- Scoring Levels ---

    # Level 1: Perfect Match (100)
    # Same amount, same date, and explicit reference to Invoice Number in bank description
    if b_amt == i_amt and date_diff == 0 and (i_ref in b_desc or i_num in b_desc):
        return 100

    # Level 2: High Confidence (85)
    # Exact amount and date within a 3-day window (handles bank processing delays)
    if b_amt == i_amt and date_diff <= 3:
        score = 85
    # Level 3: Medium Confidence (60)
    # Amount within 1% margin AND date within 5 days
    elif amt_diff_pct <= 0.01 and date_diff <= 5:
        score = 60
    else:
        # Default to 0 if none of the base thresholds are met
        score = 0

    # Level 4: Context Boost (+10)
    # If the contact's name appears in the bank description, boost confidence
    if b_amt == i_amt and i_contact and i_contact in b_desc:
        if score > 0:
            # Add 10 points but cap at 95 (100 is reserved for perfect Level 1 matches)
            score = min(score + 10, 95)
        else:
            # Start at 65 if only amount and contact match (no date proximity)
            score = 65

    # Special Case: Perfect Reference Match (75)
    # If amount and invoice number match exactly, but date is far off, it's still a strong possible
    if score < 75 and b_amt == i_amt:
        if (i_ref and i_ref in b_desc) or (i_num and i_num in b_desc):
            score = 75

    return score

def run_reconciliation(bank_rows: List[Dict[str, Any]], xero_invoices: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Main entry point for the matching engine.
    
    This function implements the multi-pass reconciliation logic, respecting 
    previous manual decisions and preventing double-counting of invoices.
    """
    # Initialize buckets and tracking sets
    matched = []
    possible = []
    unmatched_bank = []
    used_invoice_ids = set() # Ensure an invoice isn't matched twice

    # 1. Pre-mapping: Create a dictionary for O(1) lookup of Xero invoices by ID
    invoice_map = {inv.get("InvoiceID"): inv for inv in xero_invoices if inv.get("InvoiceID")}
    
    # 2. Pre-sorting: Process bank rows from oldest to newest for deterministic results
    sorted_bank = sorted(bank_rows, key=lambda x: x["transaction_date"])
    
    # 3. Main Loop: Iterate through each bank transaction
    for b_row in sorted_bank:
        
        # --- PHASE A: Manual Decision Check ---
        # Respect decisions already stored in the database from previous user interactions
        status = b_row.get("reconciliation_status", "pending")
        manual_id = b_row.get("reconciled_invoice_id")
        
        # Retrieve the set of invoice IDs that the user has explicitly rejected for this row
        ignored_ids = set((b_row.get("ignored_invoice_ids") or "").split("|"))

        # If already matched in DB, move to 'matched' bucket immediately
        if status == "matched" and manual_id in invoice_map:
            best_match = invoice_map[manual_id]
            used_invoice_ids.add(manual_id)
            matched.append({
                "bank_transaction": b_row,
                "xero_invoice": best_match,
                "confidence": 100,
                "is_manual": True # Flag as user-confirmed
            })
            continue

        # --- PHASE B: Candidate Scoring ---
        candidates = []
        for inv in xero_invoices:
            inv_id = inv.get("InvoiceID")
            
            # Skip invoices already matched to another row or ignored for this specific row
            if inv_id in used_invoice_ids or inv_id in ignored_ids:
                continue
                
            # Calculate the confidence score using heuristics
            score = calculate_score(b_row, inv)
            
            # 60 is the minimum threshold to be considered for the 'Possible' bucket
            if score >= 60:
                candidates.append((score, inv))
        
        # --- PHASE C: Bucket Assignment ---
        if not candidates:
            # No candidates found meeting the minimum threshold
            unmatched_bank.append(b_row)
            continue
            
        # Sort candidates so the highest score is at index 0
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, best_match = candidates[0]
        
        # --- PHASE D: Ambiguity Detection ---
        # If multiple invoices share the exact same top score, the match is ambiguous
        is_ambiguous = len(candidates) > 1 and candidates[1][0] == best_score
        
        # 85 is the threshold for 'Auto-Matched' (High Confidence)
        if best_score >= 85 and not is_ambiguous:
            # Mark invoice as used and move to 'matched'
            used_invoice_ids.add(best_match["InvoiceID"])
            matched.append({
                "bank_transaction": b_row,
                "xero_invoice": best_match,
                "confidence": best_score
            })
        else:
            # Move to 'possible' for manual review
            possible.append({
                "bank_transaction": b_row,
                "xero_invoice": best_match,
                "confidence": best_score,
                "is_ambiguous": is_ambiguous
            })

    # --- PHASE E: Cleanup ---
    # Find all Xero invoices that were never matched to a bank transaction
    unmatched_xero = [inv for inv in xero_invoices if inv.get("InvoiceID") not in used_invoice_ids]

    # Return the final report structure
    return {
        "summary": {
            "total_bank_rows": len(bank_rows),
            "total_xero_invoices": len(xero_invoices),
            "matched_count": len(matched),
            "possible_count": len(possible),
            "unmatched_bank_count": len(unmatched_bank),
            "unmatched_xero_count": len(unmatched_xero)
        },
        "buckets": {
            "matched": matched,
            "possible": possible,
            "unmatched_bank": unmatched_bank,
            "unmatched_xero": unmatched_xero
        }
    }
