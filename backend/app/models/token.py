"""
Token Model

SQLAlchemy ORM model for storing Xero OAuth tokens in SQLite.
Replaces the previous JSON file-based storage.
"""
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class Token(Base):
    """Represents a Xero OAuth token session stored in the database."""
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)
    expires_in = Column(Integer, nullable=False)
    scope = Column(Text)
    token_type = Column(String)
    id_token = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)
