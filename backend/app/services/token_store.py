"""
Token Store Service (SQLite-based)
---------------------------------
Provides persistent storage for Xero OAuth2 tokens using SQLite via SQLAlchemy.
Handles CRUD operations, token-expiry checking, and session management.
"""

import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.token import Token


def store_tokens(session_id: str, token_data: dict, tenant_id: str = None, db: Session = None) -> str:
    """
    Persist a Xero token payload in the database.
    
    This function handles both the creation of new sessions and updating
    existing ones when a token refresh occurs.
    """
    # 1. Generate a new session ID if none exists (initial login)
    if not session_id:
        session_id = str(uuid.uuid4())
    
    # 2. Calculate the UTC expiration timestamp based on the 'expires_in' seconds
    # Default to 1800s (30 mins) if for some reason Xero doesn't provide it
    expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 1800))
    
    # 3. Connection Management: Use the provided DB session or create a local one
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True
    
    try:
        # 4. Upsert Logic: Check if this session already exists in the table
        existing = db.query(Token).filter(Token.session_id == session_id).first()
        
        if existing:
            # 5. Update: Refresh all token fields for the existing record
            existing.access_token = token_data.get("access_token")
            existing.refresh_token = token_data.get("refresh_token")
            existing.expires_in = token_data.get("expires_in")
            existing.scope = token_data.get("scope")
            existing.token_type = token_data.get("token_type")
            existing.id_token = token_data.get("id_token")
            # Only update tenant_id if explicitly provided (usually during initial connection)
            if tenant_id:
                existing.tenant_id = tenant_id
            existing.expires_at = expires_at
        else:
            # 6. Create: Initialize a new record for this session
            new_token = Token(
                session_id=session_id,
                access_token=token_data.get("access_token"),
                refresh_token=token_data.get("refresh_token"),
                expires_in=token_data.get("expires_in"),
                scope=token_data.get("scope"),
                token_type=token_data.get("token_type"),
                id_token=token_data.get("id_token"),
                tenant_id=tenant_id,
                expires_at=expires_at
            )
            db.add(new_token)
        
        # 7. Commit: Save changes to the SQLite file
        db.commit()
        return session_id
    finally:
        # 8. Cleanup: Close the session if we created it locally
        if close_db:
            db.close()


def get_tokens(session_id: str) -> dict | None:
    """
    Retrieve the token entry for a specific session ID from the DB.
    Returns a dictionary of token fields or None if not found.
    """
    # 1. Open a new database session
    db = SessionLocal()
    try:
        # 2. Query for the session by ID
        token = db.query(Token).filter(Token.session_id == session_id).first()
        if not token:
            return None
        
        # 3. Serialization: Map the SQLAlchemy model to a standard dictionary
        return {
            "session_id": token.session_id,
            "access_token": token.access_token,
            "refresh_token": token.refresh_token,
            "expires_in": token.expires_in,
            "scope": token.scope,
            "token_type": token.token_type,
            "id_token": token.id_token,
            "tenant_id": token.tenant_id,
            # Format timestamps to ISO strings for easier handling in JSON or comparisons
            "created_at": token.created_at.isoformat() if token.created_at else None,
            "expires_at": token.expires_at.isoformat() if token.expires_at else None
        }
    finally:
        # 4. Always close the connection
        db.close()


def get_all_sessions() -> dict:
    """
    Utility: Return all token sessions from the database.
    Useful for system monitoring and debugging session bloat.
    """
    db = SessionLocal()
    try:
        tokens = db.query(Token).all()
        # Return a dictionary indexed by session_id
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
    Remove a session from the database (logout/revoke).
    """
    db = SessionLocal()
    try:
        token = db.query(Token).filter(Token.session_id == session_id).first()
        if token:
            # Delete the record and commit
            db.delete(token)
            db.commit()
            return True
        return False
    finally:
        db.close()


def is_token_expired(token_entry: dict) -> bool:
    """
    Check whether a token entry has passed its expiration time.
    
    This includes a small safety buffer to ensure we refresh *before* 
    the token actually dies during a network request.
    """
    # 1. Validation: No entry means it's effectively expired
    if not token_entry:
        return True
    
    # 2. Extract the ISO timestamp
    expires_at_str = token_entry.get("expires_at")
    if not expires_at_str:
        return True
    
    # 3. Normalization: Ensure the timestamp uses 'T' as the ISO separator
    if " " in expires_at_str and "T" not in expires_at_str:
        expires_at_str = expires_at_str.replace(" ", "T")
        
    try:
        # 4. Parse the string back into a datetime object
        expires_at = datetime.fromisoformat(expires_at_str)
        # 5. Buffer: Consider the token expired if it dies within the next 60 seconds
        # This handles minor clock drift and slow network responses.
        return datetime.utcnow() + timedelta(seconds=60) >= expires_at
    except Exception:
        # If parsing fails for any reason, treat as expired to be safe
        return True
