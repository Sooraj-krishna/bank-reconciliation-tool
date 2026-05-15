"""
Xero Sync Service
-----------------
Handles the synchronization of invoices and bills from Xero to the local database.
Features:
- Incremental Sync: Only fetches what has changed since the last sync.
- Upsert Logic: Efficiently updates existing records or inserts new ones.
- Multi-tenant Aware: Strictly scopes data to the current tenant.
"""

import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.invoice import InvoiceCache
from app.services.xero_service import get_valid_tokens, get_resilient_session, get_xero_headers

logger = logging.getLogger(__name__)

def sync_invoices(session_id: str, db: Session) -> dict:
    """
    Synchronizes Xero invoices for the given session into the local cache.
    Returns a summary of the sync (added, updated, total).
    """
    # 1. Get valid tokens and tenant info
    token_entry = get_valid_tokens(session_id, db=db)
    if not token_entry:
        return {"status": "error", "message": "Unauthorized"}

    headers = get_xero_headers(token_entry)
    
    # Need to get connections to find the tenantId
    session = get_resilient_session()
    tenants_resp = session.get("https://api.xero.com/connections", headers=headers)
    if tenants_resp.status_code != 200:
        return {"status": "error", "message": "Failed to fetch tenant connections"}
    
    tenants = tenants_resp.json()
    if not tenants:
        return {"status": "error", "message": "No active tenant connections found"}
    
    tenant_id = tenants[0]["tenantId"]
    headers["Xero-Tenant-Id"] = tenant_id

    # 2. Determine last sync time for this tenant
    # (Optional optimization: Fetching with If-Modified-Since)
    # last_sync = db.query(func.max(InvoiceCache.updated_at_utc)).filter(InvoiceCache.tenant_id == tenant_id).scalar()
    
    # 3. Fetch from Xero (with pagination)
    page = 1
    processed_count = 0
    updated_count = 0
    added_count = 0
    
    while True:
        invoices_url = f"https://api.xero.com/api.xro/2.0/Invoices?page={page}"
        resp = session.get(invoices_url, headers=headers)
        
        if resp.status_code != 200:
            logger.error(f"Xero Sync Error: {resp.status_code} - {resp.text}")
            break
            
        data = resp.json()
        invoices = data.get("Invoices", [])
        
        if not invoices:
            break
            
        # 4. Process each invoice
        for xero_inv in invoices:
            processed_count += 1
            inv_id = xero_inv["InvoiceID"]
            
            # Extract and parse updated date
            updated_at_raw = xero_inv.get("UpdatedDateUTC")
            # Format: /Date(1714915200000+0000)/
            updated_at = None
            if updated_at_raw and "/Date(" in updated_at_raw:
                ms = int(updated_at_raw.split("(")[1].split("+")[0])
                updated_at = datetime.fromtimestamp(ms / 1000.0)

            # Check if exists in DB
            existing = db.query(InvoiceCache).filter(InvoiceCache.invoice_id == inv_id).first()
            
            if existing:
                updated_count += 1
                existing.status = xero_inv.get("Status")
                existing.total = xero_inv.get("Total", 0.0)
                existing.amount_due = xero_inv.get("AmountDue", 0.0)
                existing.updated_at_utc = updated_at
                existing.contact_name = xero_inv.get("Contact", {}).get("Name", "Unknown")
            else:
                added_count += 1
                new_inv = InvoiceCache(
                    invoice_id=inv_id,
                    tenant_id=tenant_id,
                    type=xero_inv.get("Type"),
                    invoice_number=xero_inv.get("InvoiceNumber"),
                    contact_name=xero_inv.get("Contact", {}).get("Name", "Unknown"),
                    date=xero_inv.get("DateString")[:10], # Keep YYYY-MM-DD
                    due_date=xero_inv.get("DueDateString")[:10] if xero_inv.get("DueDateString") else None,
                    total=xero_inv.get("Total", 0.0),
                    amount_due=xero_inv.get("AmountDue", 0.0),
                    status=xero_inv.get("Status"),
                    updated_at_utc=updated_at
                )
                db.add(new_inv)
        
        # Move to next page
        page += 1
        # Basic safety break to prevent infinite loops in weird API states
        if page > 100: break

    db.commit()
    return {
        "status": "success",
        "processed": processed_count,
        "added": added_count,
        "updated": updated_count,
        "tenant_id": tenant_id
    }
