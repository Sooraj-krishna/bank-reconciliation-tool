"""
Token Store Service (SQLite-based)

Provides persistent storage for Xero OAuth2 tokens using SQLite via SQLAlchemy.
Handles CRUD operations, token-expiry checking, and automatic token refresh.
"""

import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.token import Token


def store_tokens(session_id: str, token_data: dict, db: Session = None) -> str:
    """
    Persist a Xero token payload in the database.
    
    If session_id is empty or None, generates a new UUID.
    Enriches token data with server-side timestamps for expiry tracking.
    
    Returns the session ID (new or existing).
    """
    if not session_id:
        session_id = str(uuid.uuid4())
    
    expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 1800))
    
    # Use provided db session or create new one
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True
    
    try:
        # Check if session already exists
        existing = db.query(Token).filter(Token.session_id == session_id).first()
        
        if existing:
            # Update existing token
            existing.access_token = token_data.get("access_token")
            existing.refresh_token = token_data.get("refresh_token")
            existing.expires_in = token_data.get("expires_in")
            existing.scope = token_data.get("scope")
            existing.token_type = token_data.get("token_type")
            existing.id_token = token_data.get("id_token")
            existing.expires_at = expires_at
        else:
            # Create new token entry
            new_token = Token(
                session_id=session_id,
                access_token=token_data.get("access_token"),
                refresh_token=token_data.get("refresh_token"),
                expires_in=token_data.get("expires_in"),
                scope=token_data.get("scope"),
                token_type=token_data.get("token_type"),
                id_token=token_data.get("id_token"),
                expires_at=expires_at
            )
            db.add(new_token)
        
        db.commit()
        return session_id
    finally:
        if close_db:
            db.close()


def get_tokens(session_id: str) -> dict | None:
    """
    Retrieve the token entry for a specific session ID.
    Returns None if the session does not exist.
    """
    db = SessionLocal()
    try:
        token = db.query(Token).filter(Token.session_id == session_id).first()
        if not token:
            return None
        
        return {
            "session_id": token.session_id,
            "access_token": token.access_token,
            "refresh_token": token.refresh_token,
            "expires_in": token.expires_in,
            "scope": token.scope,
            "token_type": token.token_type,
            "id_token": token.id_token,
            "created_at": token.created_at.isoformat() if token.created_at else None,
            "expires_at": token.expires_at.isoformat() if token.expires_at else None
        }
    finally:
        db.close()


def get_all_sessions() -> dict:
    """
    Return all token sessions from the database.
    Useful for admin dashboards or session management endpoints.
    """
    db = SessionLocal()
    try:
        tokens = db.query(Token).all()
        return {t.session_id: {
            "session_id": t.session_id,
            "access_token": t.access_token,
            "refresh_token": t.refresh_token,
            "expires_in": t.expires_in,
            "scope": t.scope,
            "token_type": t.token_type,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "expires_at": t.expires_at.isoformat() if t.expires_at else None
        } for t in tokens}
    finally:
        db.close()


def delete_session(session_id: str) -> bool:
    """
    Remove a session from the database.
    Returns True if the session was found and deleted, False otherwise.
    """
    db = SessionLocal()
    try:
        token = db.query(Token).filter(Token.session_id == session_id).first()
        if token:
            db.delete(token)
            db.commit()
            return True
        return False
    finally:
        db.close()


def is_token_expired(token_entry: dict) -> bool:
    """
    Check whether a token entry has passed its expiration time.
    
    Compares the stored `expires_at` timestamp against the current UTC time.
    Returns True if the token is missing, has no entry, or is past expiry.
    """
    if not token_entry:
        return True
    
    expires_at_str = token_entry.get("expires_at")
    if not expires_at_str:
        return True
    
    expires_at = datetime.fromisoformat(expires_at_str)
    return datetime.utcnow() >= expires_at
