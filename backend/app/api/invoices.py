"""
Invoices API Router

Provides endpoints to fetch Xero invoices for the connected organisation.
Requires a valid session cookie to authenticate the user.
"""

from fastapi import APIRouter, HTTPException, Cookie, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.invoice import InvoiceCache
from app.services.sync_service import sync_invoices
from app.api.upload import get_current_tenant_id

router = APIRouter()


@router.get("/invoices")
def get_invoices(
    xero_session_id: str = Cookie(None),
    limit: int = 100,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Fetch invoices from the local cache for high performance.
    Triggers a background sync to keep data fresh.
    """
    if not xero_session_id:
        raise HTTPException(status_code=401, detail="Xero session required.")

    # 1. Trigger Sync (Foreground for now to ensure data exists, 
    # can be moved to background tasks for even more speed)
    try:
        sync_result = sync_invoices(xero_session_id, db)
        if sync_result.get("status") == "error":
            # If sync fails but we have old data, we can still show it
            pass
    except Exception as e:
        print(f"Sync Warning: {str(e)}")

    # 2. Fetch from local DB (Instant)
    invoices = db.query(InvoiceCache).filter(
        InvoiceCache.tenant_id == tenant_id,
        InvoiceCache.status != "DELETED",
        InvoiceCache.status != "VOIDED"
    ).limit(limit).all()

    # Convert to the format expected by the frontend
    formatted_invoices = []
    for inv in invoices:
        formatted_invoices.append({
            "InvoiceID": inv.invoice_id,
            "InvoiceNumber": inv.invoice_number,
            "Contact": {"Name": inv.contact_name},
            "DateString": inv.date,
            "DueDateString": inv.due_date,
            "Total": inv.total,
            "AmountDue": inv.amount_due,
            "Status": inv.status,
            "Type": inv.type
        })

    return {"invoices": formatted_invoices}
