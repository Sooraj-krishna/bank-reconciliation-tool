"""
Reconciliation API Router
-------------------------
Exposes endpoints for running the matching engine.
"""

from fastapi import APIRouter, HTTPException, Cookie, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.bank_statement import BankStatement
from app.services.xero_service import fetch_invoices
from app.services.reconciliation_service import run_reconciliation

from app.api.upload import get_current_tenant_id

router = APIRouter()

from pydantic import BaseModel

class ReconciliationAction(BaseModel):
    bank_id: int
    invoice_id: str

@router.get("/reconcile/{upload_id}")
def reconcile_upload(
    upload_id: str,
    xero_session_id: str = Cookie(None),
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    """
    Main Reconciliation Report generator.
    Combines DB bank rows with Live Xero data and runs the matching engine.
    """
    if not xero_session_id:
        raise HTTPException(status_code=401, detail="Xero session required.")

    # Fetch bank rows for the specific upload and tenant
    bank_rows = db.query(BankStatement).filter(
        BankStatement.upload_id == upload_id,
        BankStatement.tenant_id == tenant_id
    ).all()

    if not bank_rows:
        raise HTTPException(status_code=404, detail="Bank statement not found.")

    # IMPORTANT: We map the DB fields (status, manual_id, ignored_ids) into the 
    # bank_data dict so the run_reconciliation service can respect user overrides.
    bank_data = [
        {
            "id": r.id,
            "transaction_date": r.transaction_date,
            "description": r.description,
            "amount": r.amount,
            "reconciliation_status": r.reconciliation_status,
            "reconciled_invoice_id": r.reconciled_invoice_id,
            "ignored_invoice_ids": r.ignored_invoice_ids
        }
        for r in bank_rows
    ]

    # Fetch fresh invoices from Xero API
    try:
        xero_data = fetch_invoices(xero_session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Xero API Error: {str(e)}")

    # Execute matching logic
    report = run_reconciliation(bank_data, xero_data)
    return report

@router.post("/reconcile/approve")
def approve_match(
    action: ReconciliationAction,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    """
    Finalizes a suggested match or a manual link.
    Persists the InvoiceID to the database so it's prioritized in future runs.
    """
    bank_row = db.query(BankStatement).filter(
        BankStatement.id == action.bank_id,
        BankStatement.tenant_id == tenant_id
    ).first()

    if not bank_row:
        raise HTTPException(status_code=404, detail="Bank transaction not found.")

    from datetime import datetime
    bank_row.reconciled_invoice_id = action.invoice_id
    bank_row.reconciliation_status = "matched"
    bank_row.reconciled_at = datetime.utcnow() # Audit trail
    db.commit()

    return {"status": "success", "message": "Match approved."}

@router.post("/reconcile/reject")
def reject_match(
    action: ReconciliationAction,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    """
    Rejects a suggested match.
    Adds the InvoiceID to the row's 'ignored' list so the engine skips it next time.
    """
    bank_row = db.query(BankStatement).filter(
        BankStatement.id == action.bank_id,
        BankStatement.tenant_id == tenant_id
    ).first()

    if not bank_row:
        raise HTTPException(status_code=404, detail="Bank transaction not found.")

    # Update the pipe-separated 'ignored' list
    current_ignored = (bank_row.ignored_invoice_ids or "").split("|")
    if action.invoice_id not in current_ignored:
        current_ignored.append(action.invoice_id)
        # Filter(None) removes empty strings from leading/trailing pipes
        bank_row.ignored_invoice_ids = "|".join(filter(None, current_ignored))
    
    db.commit()
    return {"status": "success", "message": "Match rejected."}

@router.post("/reconcile/unreconcile/{bank_id}")
def unreconcile(
    bank_id: int,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    """
    Resets a matched transaction back to 'pending'.
    Used when a user mistakenly linked the wrong invoice.
    """
    bank_row = db.query(BankStatement).filter(
        BankStatement.id == bank_id,
        BankStatement.tenant_id == tenant_id
    ).first()

    if not bank_row:
        raise HTTPException(status_code=404, detail="Bank transaction not found.")

    # Reset state fields
    bank_row.reconciled_invoice_id = None
    bank_row.reconciliation_status = "pending"
    bank_row.reconciled_at = None
    db.commit()

    return {"status": "success", "message": "Transaction reset to pending."}
