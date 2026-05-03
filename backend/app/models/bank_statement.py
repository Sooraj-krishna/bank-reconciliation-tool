"""
Bank Statement Model

SQLAlchemy ORM model for storing uploaded bank statement rows.
Each row represents one transaction from an uploaded CSV file.
Rows from the same CSV share the same upload_id for grouping.
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class BankStatement(Base):
    """
    Represents a single bank transaction row from an uploaded CSV.

    Fields:
        id               → Auto-increment primary key
        upload_id        → UUID string grouping rows from the same CSV file
        filename         → Original filename of the uploaded CSV
        uploaded_at      → Timestamp when the upload happened (server default now)
        session_id       → Links to Xero session (for auth scoping)
        transaction_date → Cleaned date stored as "YYYY-MM-DD" string (sorts correctly in SQLite)
        description      → Cleaned description (whitespace stripped/collapsed)
        raw_description  → Original description before cleaning (audit trail)
        amount           → Numeric amount as float (negatives stay negative for withdrawals)
        is_duplicate     → Flagged True if duplicate detected (NOT deleted, per requirements)
    """
    __tablename__ = "bank_statements"

    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(String, index=True, nullable=False)
    filename = Column(String, nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
    session_id = Column(String, index=True, nullable=True)  # Nullable for uploads without Xero session
    transaction_date = Column(String, nullable=False)  # "YYYY-MM-DD" format
    description = Column(Text)
    raw_description = Column(Text)
    amount = Column(Float, nullable=False)
    is_duplicate = Column(Boolean, default=False)
