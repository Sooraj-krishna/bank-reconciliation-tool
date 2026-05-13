import pytest
import io
import pandas as pd
from app.services.report_service import generate_reconciliation_excel

def test_excel_generation_basic():
    """
    Test that the Excel report generates without crashing and contains all sheets.
    """
    report_data = {
        "summary": {
            "total_bank_rows": 2,
            "total_xero_invoices": 2,
            "matched_count": 1,
            "matched_amount": 100.00,
            "unmatched_bank_count": 1,
            "unmatched_bank_amount": 50.00,
            "unmatched_xero_count": 1,
            "unmatched_xero_amount": 200.00,
            "possible_count": 0,
            "possible_amount": 0.00
        },
        "buckets": {
            "matched": [
                {
                    "bank_transaction": {"transaction_date": "2025-01-01", "description": "Match", "amount": 100.00, "reconciled_at": "2025-05-11 12:00:00"},
                    "xero_invoice": {"InvoiceNumber": "INV-001", "Contact": {"Name": "Client A"}},
                    "confidence": 100,
                    "is_manual": True
                }
            ],
            "possible": [],
            "unmatched_bank": [
                {"transaction_date": "2025-01-02", "description": "Unmatched Bank", "amount": 50.00}
            ],
            "unmatched_xero": [
                {"InvoiceNumber": "INV-002", "Contact": {"Name": "Client B"}, "Date": "2025-01-01", "Total": 200.00, "Status": "AUTHORISED"}
            ]
        }
    }
    
    excel_io = generate_reconciliation_excel(report_data)
    assert isinstance(excel_io, io.BytesIO)
    
    # Verify sheets using pandas
    excel_io.seek(0)
    with pd.ExcelFile(excel_io) as xls:
        sheet_names = xls.sheet_names
        assert "Overview" in sheet_names
        assert "Matched Items" in sheet_names
        assert "Possible Matches" in sheet_names
        assert "Unmatched Bank" in sheet_names
        assert "Unmatched Xero" in sheet_names
        assert "Audit Trail" in sheet_names
        
        # Check if matched data is present
        df_matched = pd.read_excel(xls, "Matched Items")
        assert len(df_matched) == 1
        assert df_matched.iloc[0]["BANK DESCRIPTION"] == "Match"
        
        # Check Audit Trail for manual match
        df_audit = pd.read_excel(xls, "Audit Trail")
        assert len(df_audit) == 1
        assert "Manual Link Approved" in df_audit.iloc[0]["RESULT"]

def test_excel_generation_empty():
    """
    Test that the report handles empty data gracefully.
    """
    report_data = {
        "summary": {},
        "buckets": {
            "matched": [],
            "possible": [],
            "unmatched_bank": [],
            "unmatched_xero": []
        }
    }
    
    excel_io = generate_reconciliation_excel(report_data)
    assert isinstance(excel_io, io.BytesIO)
    
    excel_io.seek(0)
    with pd.ExcelFile(excel_io) as xls:
        df_audit = pd.read_excel(xls, "Audit Trail")
        # Should have the placeholder row we added
        assert "No manual approvals recorded" in df_audit.iloc[0]["INFO"]
