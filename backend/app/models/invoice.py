"""
Invoice Cache Model
-------------------
SQLAlchemy ORM model for storing cached Xero invoices/bills.
This provides a 'Local Source of Truth' for the reconciliation engine,
dramatically improving performance and reducing Xero API load.
"""

from sqlalchemy import Column, String, DateTime, Float, Text
from sqlalchemy.sql import func
from app.core.database import Base


class InvoiceCache(Base):
    """
    Represents a cached Xero Invoice or Bill.
    
    Fields:
        invoice_id     → Xero's unique UUID (Primary Key)
        tenant_id      → The Xero Organisation ID (for multi-tenant isolation)
        type           → 'ACCREC' (Invoice) or 'ACCPAY' (Bill)
        invoice_number → User-facing reference (e.g. INV-001)
        contact_name   → Name of the Customer or Supplier
        date           → Transaction date (YYYY-MM-DD)
        due_date       → Payment due date (YYYY-MM-DD)
        total          → Total amount including tax
        amount_due     → Remaining balance to be paid
        status         → AUTHORISED, PAID, VOIDED, DELETED, etc.
        updated_at_utc → Xero's internal timestamp (used for incremental sync)
        last_cached_at → Timestamp when this record was last synced to our DB
    """
    __tablename__ = "invoice_cache"

    invoice_id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    type = Column(String, index=True, nullable=False)
    invoice_number = Column(String, index=True)
    contact_name = Column(String, index=True)
    date = Column(String, nullable=False)
    due_date = Column(String)
    total = Column(Float, nullable=False)
    amount_due = Column(Float, nullable=False)
    status = Column(String, index=True)
    updated_at_utc = Column(DateTime, nullable=True)
    last_cached_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
