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
    
    Logic Levels:
    - Level 1: Same amount + Same date + Same reference/inv number (100)
    - Level 2: Same amount + Date within 3 days (85)
    - Level 3: Amount within 1% + Date within 5 days (60)
    - Level 4: Description contains Contact Name (Boosts existing score by 10)
    """
    score = 0
    
    # Extract data
    b_amt = abs(float(bank_row.get("amount", 0)))
    i_amt = abs(float(invoice.get("Total", 0)))
    
    b_date = datetime.strptime(bank_row["transaction_date"], "%Y-%m-%d")
    # Xero dates usually come as "YYYY-MM-DD..."
    i_date_str = invoice.get("DateString", invoice.get("Date", ""))[:10]
    i_date = datetime.strptime(i_date_str, "%Y-%m-%d")
    
    b_desc = bank_row.get("description", "").lower()
    i_ref = str(invoice.get("Reference", "")).lower()
    i_num = str(invoice.get("InvoiceNumber", "")).lower()
    i_contact = str(invoice.get("Contact", {}).get("Name", "")).lower()

    date_diff = abs((b_date - i_date).days)
    amt_diff_pct = abs(b_amt - i_amt) / i_amt if i_amt != 0 else 1.0

    # Level 1: Perfect Match (Same Day)
    if b_amt == i_amt and date_diff == 0 and (i_ref in b_desc or i_num in b_desc):
        return 100

    # Level 1.5: Reference Match (Date Mismatch)
    # If the reference is perfect, we can trust it even if the date is off (late payments)
    if b_amt == i_amt and (i_ref in b_desc or i_num in b_desc):
        return 90

    # Level 2: High Confidence
    if b_amt == i_amt and date_diff <= 3:
        score = 85
    # Level 3: Medium Confidence
    elif amt_diff_pct <= 0.01 and date_diff <= 5:
        score = 60
    
    # Level 4: Context Boost
    if score > 0 and i_contact and i_contact in b_desc:
        score = min(score + 10, 95) # Boost but don't reach 100 without Level 1

    return score

def run_reconciliation(bank_rows: List[Dict[str, Any]], xero_invoices: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Main entry point for the matching engine.
    
    Implements the "One-to-One" rule and sorts data into 4 specific buckets.
    
    Args:
        bank_rows: List of cleaned bank transaction dicts
        xero_invoices: List of Xero invoice dicts
        
    Returns:
        Dict containing the 4 buckets and summary stats.
    """
    matched = []
    possible = []
    unmatched_bank = []
    used_invoice_ids = set()
    
    # Sort bank rows by date to make matching deterministic
    sorted_bank = sorted(bank_rows, key=lambda x: x["transaction_date"])
    
    for b_row in sorted_bank:
        best_match = None
        best_score = 0
        
        # Look for the best available invoice for this bank row
        for inv in xero_invoices:
            inv_id = inv.get("InvoiceID")
            if inv_id in used_invoice_ids:
                continue
                
            score = calculate_score(b_row, inv)
            
            if score > best_score:
                best_score = score
                best_match = inv
        
        # Categorize based on the best score found
        if best_score >= 85:
            used_invoice_ids.add(best_match["InvoiceID"])
            matched.append({
                "bank_transaction": b_row,
                "xero_invoice": best_match,
                "confidence": best_score
            })
        elif best_score >= 60:
            # We don't "lock" invoices for possible matches yet, 
            # allowing Level 1/2 matches to claim them later if needed.
            # However, for this simple implementation, we'll suggest it.
            possible.append({
                "bank_transaction": b_row,
                "xero_invoice": best_match,
                "confidence": best_score
            })
        else:
            unmatched_bank.append(b_row)

    # Bucket 4: Unmatched Xero (Invoices that weren't paired)
    unmatched_xero = [inv for inv in xero_invoices if inv.get("InvoiceID") not in used_invoice_ids]

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
