"""
Invoices API Router

Provides endpoints to fetch Xero invoices for the connected organisation.
Requires a valid session cookie to authenticate the user.
"""

from fastapi import APIRouter, HTTPException, Cookie
from app.services.xero_service import fetch_invoices as fetch_xero_invoices
from app.services.token_store import get_tokens, is_token_expired

router = APIRouter()


@router.get("/invoices")
def get_invoices(
    xero_session_id: str = Cookie(None),
    limit: int = 100,
):
    """
    Fetch invoices from Xero for the authenticated session.

    Args:
        xero_session_id: Session cookie identifying the user's Xero connection
        limit: Maximum number of invoices to fetch (default 100)

    Returns:
        List of invoice objects from Xero

    Raises:
        HTTPException 401 if not connected to Xero
        HTTPException 500 if fetch fails
    """
    # Production Trace: Log headers to diagnose cookie issues
    print(f"TRACE: get_invoices - xero_session_id present: {bool(xero_session_id)}", flush=True)
    
    if not xero_session_id:
        raise HTTPException(
            status_code=401,
            detail="No session cookie found. If you are in production, ensure CORS allow_credentials is True and SameSite is None."
        )

    # Fetch invoices (this service handles auto-refresh internally)
    try:
        invoices = fetch_xero_invoices(xero_session_id, limit=limit)
        return {"invoices": invoices}
    except Exception as e:
        # If fetch_invoices fails (e.g. refresh token also expired), 
        # we check the message to return a 401 if it's a session issue.
        error_msg = str(e).lower()
        if "session" in error_msg or "reconnect" in error_msg or "organisation" in error_msg:
            raise HTTPException(status_code=401, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
