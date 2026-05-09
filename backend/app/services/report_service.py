import pandas as pd
import io
from datetime import datetime
from typing import List, Dict, Any

def generate_reconciliation_excel(report_data: Dict[str, Any]) -> io.BytesIO:
    """
    Generates a professional multi-sheet Excel report from the reconciliation results.
    
    Sheets:
    1. Summary - High-level metrics (Counts + Total Amounts)
    2. Matched - Detailed list of matched transactions
    3. Unmatched Bank - Outstanding bank transactions
    4. Unmatched Xero - Outstanding Xero invoices
    5. Audit Trail - History of manual actions
    """
    # Initialize an in-memory buffer to hold the Excel file bytes
    output = io.BytesIO()
    
    # --- Data Extraction ---
    # Retrieve summary metrics from the input report object
    summary = report_data.get("summary", {})
    # Retrieve the four primary reconciliation buckets
    buckets = report_data.get("buckets", {})
    matched_items = buckets.get("matched", [])
    unmatched_bank = buckets.get("unmatched_bank", [])
    unmatched_xero = buckets.get("unmatched_xero", [])
    possible_items = buckets.get("possible", [])

    # Helper function to safely parse and absolute-value numeric amounts from dictionaries
    def safe_float(val):
        """Safely converts input to an absolute float, defaulting to 0.0 on failure."""
        try:
            # We use abs() because for reporting purposes, we usually care about the magnitude
            return abs(float(val or 0))
        except (ValueError, TypeError):
            return 0.0

    # --- Calculation of Total Amounts ---
    # Sum up the value of all outstanding (unmatched) bank transactions
    total_bank_val = sum(safe_float(row.get("amount")) for row in unmatched_bank)
    # Add the value of already matched bank transactions
    total_bank_val += sum(safe_float(item.get("bank_transaction", {}).get("amount")) for item in matched_items)
    # Add the value of 'possible' matches that are still pending review
    total_bank_val += sum(safe_float(item.get("bank_transaction", {}).get("amount")) for item in possible_items)

    # Calculate the dollar value of successful matches
    matched_val = sum(safe_float(item.get("bank_transaction", {}).get("amount")) for item in matched_items)
    # Calculate the dollar value of unmatched bank rows
    unmatched_bank_val = sum(safe_float(row.get("amount")) for row in unmatched_bank)
    # Calculate the dollar value of unmatched Xero invoices (using 'Total' field from Xero)
    unmatched_xero_val = sum(safe_float(row.get("Total")) for row in unmatched_xero)

    # --- 1. Summary Sheet ---
    # Construct a structured list for the high-level KPI dashboard
    summary_data = [
        {"Category": "TOTAL DATA OVERVIEW", "Count": "", "Total Value ($)": ""},
        {"Category": "Total Bank Transactions (All)", "Count": summary.get("total_bank_rows", 0), "Total Value ($)": round(total_bank_val, 2)},
        {"Category": "Total Xero Invoices (All)", "Count": summary.get("total_xero_invoices", 0), "Total Value ($)": ""},
        {"Category": "", "Count": "", "Total Value ($)": ""}, # Visual divider row
        {"Category": "RECONCILIATION STATUS", "Count": "", "Total Value ($)": ""},
        {"Category": "Successfully Matched", "Count": summary.get("matched_count", 0), "Total Value ($)": round(matched_val, 2)},
        {"Category": "Outstanding Bank (Unmatched)", "Count": summary.get("unmatched_bank_count", 0), "Total Value ($)": round(unmatched_bank_val, 2)},
        {"Category": "Outstanding Xero (Unmatched)", "Count": summary.get("unmatched_xero_count", 0), "Total Value ($)": round(unmatched_xero_val, 2)},
        # Summary of items needing manual human review
        {"Category": "Possible Matches (Pending Review)", "Count": summary.get("possible_count", 0), "Total Value ($)": round(sum(safe_float(i.get("bank_transaction", {}).get("amount")) for i in possible_items), 2)},
    ]
    # Convert the summary list into a Pandas DataFrame for easy Excel conversion
    df_summary = pd.DataFrame(summary_data)

    # --- 2. Matched Sheet ---
    # Build a detailed list of every successful link between Bank and Xero
    matched_rows = []
    for item in matched_items:
        bt = item.get("bank_transaction", {})
        xi = item.get("xero_invoice", {})
        matched_rows.append({
            "Date": bt.get("transaction_date"),
            "Bank Description": bt.get("description"),
            "Bank Amount": bt.get("amount"),
            "Xero Invoice #": xi.get("InvoiceNumber"),
            "Xero Contact": xi.get("Contact", {}).get("Name"),
            "Xero Amount": xi.get("Total"),
            "Confidence %": item.get("confidence"),
            # Distinguish between system-suggested and user-confirmed matches
            "Method": "Manual" if item.get("is_manual") else "Auto"
        })
    # Handle empty case to prevent DataFrame errors
    df_matched = pd.DataFrame(matched_rows) if matched_rows else pd.DataFrame(columns=["Date", "Bank Description", "Bank Amount", "Xero Invoice #", "Xero Contact", "Xero Amount", "Confidence %", "Method"])

    # --- 3. Unmatched Bank Sheet ---
    # Extract only the relevant columns for bank transactions that didn't find a match
    if unmatched_bank:
        df_unmatched_bank = pd.DataFrame(unmatched_bank)[[
            "transaction_date", "description", "amount"
        ]].rename(columns={
            "transaction_date": "Date",
            "description": "Description",
            "amount": "Amount"
        })
    else:
        # Default empty DataFrame with correct headers
        df_unmatched_bank = pd.DataFrame(columns=["Date", "Description", "Amount"])

    # --- 4. Unmatched Xero Sheet ---
    # Detailed list of Xero invoices still awaiting payment/reconciliation
    xero_rows = []
    for xi in unmatched_xero:
        xero_rows.append({
            "Invoice #": xi.get("InvoiceNumber"),
            "Contact": xi.get("Contact", {}).get("Name"),
            "Date": xi.get("DateString") or xi.get("Date"),
            "Amount": xi.get("Total"),
            "Status": xi.get("Status")
        })
    df_unmatched_xero = pd.DataFrame(xero_rows) if xero_rows else pd.DataFrame(columns=["Invoice #", "Contact", "Date", "Amount", "Status"])

    # --- 5. Audit Trail ---
    # Log of every manual reconciliation action taken by the user
    audit_rows = []
    for item in matched_items:
        # We only care about rows flagged as manual for the audit trail
        if item.get("is_manual"):
            bt = item.get("bank_transaction", {})
            xi = item.get("xero_invoice", {})
            audit_rows.append({
                "Action Timestamp": bt.get("reconciled_at") or "Prior Session",
                "Bank Transaction": bt.get("description"),
                "Linked Invoice": f"{xi.get('InvoiceNumber')} ({xi.get('Contact', {}).get('Name')})",
                "Amount": bt.get("amount"),
                "User Action": "Manual Approval"
            })
    df_audit = pd.DataFrame(audit_rows) if audit_rows else pd.DataFrame(columns=["Action Timestamp", "Bank Transaction", "Linked Invoice", "Amount", "User Action"])

    # --- Write to Excel ---
    # Use the ExcelWriter context manager with the 'openpyxl' engine
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Write each DataFrame to its respective sheet
        df_summary.to_excel(writer, sheet_name="Summary", index=False)
        df_matched.to_excel(writer, sheet_name="Matched Details", index=False)
        df_unmatched_bank.to_excel(writer, sheet_name="Unmatched Bank", index=False)
        df_unmatched_xero.to_excel(writer, sheet_name="Unmatched Xero", index=False)
        df_audit.to_excel(writer, sheet_name="Audit Trail", index=False)

        # Basic Styling: Iterate through each sheet to autofit column widths
        for sheetname in writer.sheets:
            worksheet = writer.sheets[sheetname]
            for col in worksheet.columns:
                max_length = 0
                column = col[0].column_letter # Get the column letter (A, B, C...)
                for cell in col:
                    try:
                        # Measure the string representation of the cell value
                        if cell.value and len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                # Set width with a small buffer (+2)
                adjusted_width = (max_length + 2)
                worksheet.column_dimensions[column].width = adjusted_width

    # Reset buffer pointer to the beginning before returning
    output.seek(0)
    return output
