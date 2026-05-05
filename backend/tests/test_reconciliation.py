"""
Unit Tests for Reconciliation Logic
-----------------------------------
Tests the scoring algorithm and bucket sorting.
"""

import pytest
from app.services.reconciliation_service import calculate_score, run_reconciliation

def test_level_1_exact_match():
    """Test: Same amount, same date, same reference."""
    bank_row = {"amount": 100.00, "transaction_date": "2025-01-01", "description": "INV-001 Payment"}
    invoice = {"Total": 100.00, "DateString": "2025-01-01", "InvoiceNumber": "INV-001"}
    
    score = calculate_score(bank_row, invoice)
    assert score == 100

def test_level_2_close_date():
    """Test: Same amount, date within 3 days."""
    bank_row = {"amount": 250.00, "transaction_date": "2025-01-04", "description": "Supplier Payment"}
    invoice = {"Total": 250.00, "DateString": "2025-01-01", "InvoiceNumber": "INV-999"}
    
    score = calculate_score(bank_row, invoice)
    assert score == 85

def test_level_3_close_amount_and_date():
    """Test: Amount within 1%, date within 5 days."""
    bank_row = {"amount": 99.50, "transaction_date": "2025-01-06", "description": "General Vendor"}
    invoice = {"Total": 100.00, "DateString": "2025-01-01", "InvoiceNumber": "INV-888"}
    
    score = calculate_score(bank_row, invoice)
    assert score == 60

def test_one_to_one_rule():
    """
    Test: One invoice cannot be matched to two different bank rows.
    """
    bank_rows = [
        {"amount": 100.00, "transaction_date": "2025-01-01", "description": "INV-001 First"},
        {"amount": 100.00, "transaction_date": "2025-01-01", "description": "INV-001 Second"}
    ]
    xero_invoices = [
        {"InvoiceID": "123", "Total": 100.00, "DateString": "2025-01-01", "InvoiceNumber": "INV-001"}
    ]
    
    report = run_reconciliation(bank_rows, xero_invoices)
    
    # Only one should be in the 'matched' bucket
    assert report["summary"]["matched_count"] == 1
    # The other should be in 'unmatched_bank'
    assert report["summary"]["unmatched_bank_count"] == 1
    # The invoice should be marked as used
    assert len(report["buckets"]["matched"]) == 1

def test_bucket_sorting():
    """
    Test that the 4 buckets are populated correctly.
    """
    bank_rows = [
        {"amount": 100.00, "transaction_date": "2025-01-01", "description": "Match"},
        {"amount": 50.00, "transaction_date": "2025-01-01", "description": "No Match"}
    ]
    xero_invoices = [
        {"InvoiceID": "1", "Total": 100.00, "DateString": "2025-01-01", "InvoiceNumber": "Match"},
        {"InvoiceID": "2", "Total": 200.00, "DateString": "2025-01-01", "InvoiceNumber": "Leftover"}
    ]
    
    report = run_reconciliation(bank_rows, xero_invoices)
    
    assert report["summary"]["matched_count"] == 1
    assert report["summary"]["unmatched_bank_count"] == 1
    assert report["summary"]["unmatched_xero_count"] == 1

def test_ambiguity_handling():
    """
    Test: Two identical matches for one bank row should move to 'Possible'.
    """
    bank_rows = [
        {"amount": 31.39, "transaction_date": "2025-01-01", "description": "Xero Payment"}
    ]
    xero_invoices = [
        {"InvoiceID": "A", "Total": 31.39, "DateString": "2025-01-01", "InvoiceNumber": "INV-A"},
        {"InvoiceID": "B", "Total": 31.39, "DateString": "2025-01-01", "InvoiceNumber": "INV-B"}
    ]
    
    report = run_reconciliation(bank_rows, xero_invoices)
    
    # Should NOT be in matched (because it's ambiguous)
    assert report["summary"]["matched_count"] == 0
    # Should be in possible
    assert report["summary"]["possible_count"] == 1
    assert report["buckets"]["possible"][0]["is_ambiguous"] == True
