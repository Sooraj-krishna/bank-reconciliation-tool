"""
Invoices API Router

Provides endpoints to fetch Xero invoices for the connected organisation.
Requires a valid session cookie to authenticate the user.
"""

from fastapi import APIRouter, HTTPException, Cookie
from fastapi.responses import JSONResponse
from app.services.xero_service import fetch_invoices as fetch_xero_invoices

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
    if not xero_session_id:
        raise HTTPException(
            status_code=401,
            detail="Not connected to Xero. Please connect first."
        )
    
    try:
        invoices = fetch_xero_invoices(xero_session_id, limit=limit)
        return {"invoices": invoices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
