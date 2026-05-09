import pandas as pd
import io
from datetime import datetime
from typing import List, Dict, Any
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

def generate_reconciliation_excel(report_data: Dict[str, Any]) -> io.BytesIO:
    """
    Generates a high-fidelity, comprehensive Excel reconciliation report.
    Includes Overview, Matched, Possible, Unmatched Bank, Unmatched Xero, and Audit Trail.
    """
    output = io.BytesIO()
    
    # --- Data Extraction ---
    summary = report_data.get("summary", {})
    buckets = report_data.get("buckets", {})
    
    matched_items = buckets.get("matched", [])
    possible_items = buckets.get("possible", [])
    unmatched_bank = buckets.get("unmatched_bank", [])
    unmatched_xero = buckets.get("unmatched_xero", [])

    # --- 1. Summary Sheet (KPIs) ---
    summary_data = [
        {"METRIC": "UPLOAD OVERVIEW", "VALUE": "", "DETAILS": ""},
        {"METRIC": "Total Bank Transactions", "VALUE": summary.get("total_bank_rows", 0), "DETAILS": f"${summary.get('matched_amount', 0) + summary.get('unmatched_bank_amount', 0) + summary.get('possible_amount', 0):,.2f}"},
        {"METRIC": "Total Xero Invoices", "VALUE": summary.get("total_xero_invoices", 0), "DETAILS": ""},
        {"METRIC": "", "VALUE": "", "DETAILS": ""},
        {"METRIC": "RECONCILIATION BREAKDOWN", "VALUE": "COUNT", "DETAILS": "TOTAL AMOUNT ($)"},
        {"METRIC": "Successfully Matched", "VALUE": summary.get("matched_count", 0), "DETAILS": f"${summary.get('matched_amount', 0):,.2f}"},
        {"METRIC": "Possible Matches (Pending)", "VALUE": summary.get("possible_count", 0), "DETAILS": f"${summary.get('possible_amount', 0):,.2f}"},
        {"METRIC": "Outstanding Bank (Unmatched)", "VALUE": summary.get("unmatched_bank_count", 0), "DETAILS": f"${summary.get('unmatched_bank_amount', 0):,.2f}"},
        {"METRIC": "Outstanding Xero (Unmatched)", "VALUE": summary.get("unmatched_xero_count", 0), "DETAILS": f"${summary.get('unmatched_xero_amount', 0):,.2f}"},
    ]
    df_summary = pd.DataFrame(summary_data)

    # --- 2. Matched Details Sheet ---
    matched_list = []
    for m in matched_items:
        bt = m.get("bank_transaction", {})
        xi = m.get("xero_invoice", {})
        matched_list.append({
            "DATE": bt.get("transaction_date"),
            "BANK DESCRIPTION": bt.get("description"),
            "BANK AMOUNT": bt.get("amount"),
            "LINKED INVOICE": xi.get("InvoiceNumber"),
            "CONTACT": xi.get("Contact", {}).get("Name"),
            "CONFIDENCE": f"{m.get('confidence')}%",
            "TYPE": "Manual" if m.get("is_manual") else "Auto"
        })
    df_matched = pd.DataFrame(matched_list) if matched_list else pd.DataFrame([{"INFO": "No matched items recorded."}])

    # --- 3. Possible Matches Sheet ---
    possible_list = []
    for p in possible_items:
        bt = p.get("bank_transaction", {})
        xi = p.get("xero_invoice", {})
        possible_list.append({
            "DATE": bt.get("transaction_date"),
            "BANK DESCRIPTION": bt.get("description"),
            "BANK AMOUNT": bt.get("amount"),
            "SUGGESTED INVOICE": xi.get("InvoiceNumber"),
            "SUGGESTED CONTACT": xi.get("Contact", {}).get("Name"),
            "MATCH SCORE": f"{p.get('confidence')}%",
            "REASON": "Ambiguous" if p.get("is_ambiguous") else "Low Confidence"
        })
    df_possible = pd.DataFrame(possible_list) if possible_list else pd.DataFrame([{"INFO": "No possible matches found."}])

    # --- 4. Unmatched Bank Sheet ---
    bank_list = []
    for b in unmatched_bank:
        bank_list.append({
            "DATE": b.get("transaction_date"),
            "DESCRIPTION": b.get("description"),
            "AMOUNT": b.get("amount")
        })
    df_bank = pd.DataFrame(bank_list) if bank_list else pd.DataFrame([{"INFO": "No unmatched bank items found."}])

    # --- 5. Unmatched Xero Sheet ---
    xero_list = []
    for x in unmatched_xero:
        xero_list.append({
            "INVOICE #": x.get("InvoiceNumber"),
            "CONTACT": x.get("Contact", {}).get("Name"),
            "DATE": x.get("DateString") or x.get("Date"),
            "AMOUNT": x.get("Total"),
            "STATUS": x.get("Status")
        })
    df_xero = pd.DataFrame(xero_list) if xero_list else pd.DataFrame([{"INFO": "No unmatched Xero invoices found."}])

    # --- 6. Audit Trail Sheet ---
    audit_list = []
    for m in matched_items:
        if m.get("is_manual"):
            bt = m.get("bank_transaction", {})
            xi = m.get("xero_invoice", {})
            audit_list.append({
                "USER CONFIRMATION TIMESTAMP": bt.get("reconciled_at") or "Existing Record",
                "BANK TRANSACTION": bt.get("description"),
                "LINKED XERO INVOICE": f"{xi.get('InvoiceNumber')} ({xi.get('Contact', {}).get('Name')})",
                "AMOUNT": bt.get("amount"),
                "RESULT": "Manual Link Approved"
            })
    df_audit = pd.DataFrame(audit_list) if audit_list else pd.DataFrame([{"INFO": "No manual approvals recorded."}])

    # --- Write and Style ---
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_summary.to_excel(writer, sheet_name="Overview", index=False)
        df_matched.to_excel(writer, sheet_name="Matched Items", index=False)
        df_possible.to_excel(writer, sheet_name="Possible Matches", index=False)
        df_bank.to_excel(writer, sheet_name="Unmatched Bank", index=False)
        df_xero.to_excel(writer, sheet_name="Unmatched Xero", index=False)
        df_audit.to_excel(writer, sheet_name="Audit Trail", index=False)

        # Styling
        header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        border = Border(left=Side(style='thin', color="D1D5DB"), 
                        right=Side(style='thin', color="D1D5DB"), 
                        top=Side(style='thin', color="D1D5DB"), 
                        bottom=Side(style='thin', color="D1D5DB"))

        for sheetname in writer.sheets:
            ws = writer.sheets[sheetname]
            for row in ws.iter_rows(min_row=1, max_row=1):
                for cell in row:
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = Alignment(horizontal="center")

            for col in ws.columns:
                max_length = 0
                column = col[0].column_letter
                for cell in col:
                    cell.border = border
                    if cell.row > 1 and cell.row % 2 == 0:
                        cell.fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except: pass
                ws.column_dimensions[column].width = min(max_length + 3, 60)

    output.seek(0)
    return output
