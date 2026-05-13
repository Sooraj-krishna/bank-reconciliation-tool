import pytest
from app.services.reconciliation_service import calculate_score
from app.services.csv_parser import _guess_columns, parse_csv

def test_direction_aware_matching():
    """
    Test that inflows match receivables and outflows match payables.
    """
    # 1. Bank Withdrawal (-500) vs Sales Invoice (+500) -> Should NOT match
    bank_withdrawal = {"amount": -500, "description": "Payment for service", "transaction_date": "2024-05-01"}
    sales_invoice = {"Total": 500, "Type": "ACCREC", "InvoiceNumber": "INV-001", "DateString": "2024-05-01"}
    
    score = calculate_score(bank_withdrawal, sales_invoice)
    assert score == 0, f"Expected 0 score for opposite polarity, got {score}"

    # 2. Bank Withdrawal (-500) vs Purchase Bill (+500) -> Should match
    purchase_bill = {"Total": 500, "Type": "ACCPAY", "InvoiceNumber": "BILL-001", "DateString": "2024-05-01"}
    score = calculate_score(bank_withdrawal, purchase_bill)
    assert score >= 85, f"Expected high score for matching withdrawal and bill, got {score}"

    # 3. Bank Deposit (+1000) vs Sales Invoice (+1000) -> Should match
    bank_deposit = {"amount": 1000, "description": "Client payment", "transaction_date": "2024-05-01"}
    sales_invoice_2 = {"Total": 1000, "Type": "ACCREC", "InvoiceNumber": "INV-002", "DateString": "2024-05-01"}
    score = calculate_score(bank_deposit, sales_invoice_2)
    assert score >= 85, f"Expected high score for matching deposit and invoice, got {score}"

def test_csv_parser_balance_threat():
    """
    Test that balance columns are ignored even if they contain 'Amount' in the header.
    """
    headers = ["Date", "Description", "Amount", "Balance Amount"]
    col_map = _guess_columns(headers)
    
    assert col_map["amount"] == "Amount", f"Should have picked 'Amount', but picked {col_map['amount']}"

def test_csv_parser_invoice_false_positive():
    """
    REGRESSION TEST: Test that 'Invoice Ref' doesn't match 'in' (credit).
    """
    headers = ["Invoice Ref", "Contact", "Credit", "debit", "balance", "Date", "Description"]
    col_map = _guess_columns(headers)
    
    assert isinstance(col_map["amount"], tuple)
    assert col_map["amount"][0] == "debit"
    assert col_map["amount"][1] == "Credit"
    # If it fails, col_map["amount"][1] would be "Invoice Ref"

def test_csv_parser_debit_credit_aggregation():
    """
    Test that Debit and Credit columns are correctly identified and aggregated.
    """
    headers = ["Date", "Description", "Debit Amount", "Credit Amount"]
    col_map = _guess_columns(headers)
    
    assert isinstance(col_map["amount"], tuple), "Should have identified a Debit/Credit pair"
    assert col_map["amount"][0] == "Debit Amount"
    assert col_map["amount"][1] == "Credit Amount"

    # Test actual parsing
    csv_content = "Date,Description,Debit Amount,Credit Amount\n2024-05-01,Office Rent,1200.00,\n2024-05-02,Refund,,50.00\n2024-05-03,Negative Debit,-75.00,"
    file_bytes = csv_content.encode('utf-8')
    result = parse_csv(file_bytes, "test.csv", "upload_1", "session_1")
    
    rows = result["rows"]
    assert rows[0]["amount"] == -1200.00, f"Expected -1200.0 for debit, got {rows[0]['amount']}"
    assert rows[1]["amount"] == 50.00, f"Expected 50.0 for credit, got {rows[1]['amount']}"
    assert rows[2]["amount"] == -75.00, f"Expected -75.0 for negative debit, got {rows[2]['amount']}"

if __name__ == "__main__":
    # If run directly, run the tests
    test_direction_aware_matching()
    test_csv_parser_balance_threat()
    test_csv_parser_debit_credit_aggregation()
    print("✅ All polarity and parsing tests passed!")
