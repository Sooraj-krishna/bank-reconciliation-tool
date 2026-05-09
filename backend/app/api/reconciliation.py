"""
Reconciliation API Router
-------------------------
Exposes endpoints for running the matching engine, approving/rejecting matches,
and generating the final Excel report.
"""

from fastapi import APIRouter, HTTPException, Cookie, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel

# Internal imports for database access, models, and business logic
from app.core.database import get_db
from app.models.bank_statement import BankStatement
from app.services.xero_service import fetch_invoices
from app.services.reconciliation_service import run_reconciliation
from app.services.report_service import generate_reconciliation_excel
from app.api.upload import get_current_tenant_id

# Initialize the router instance for the reconciliation namespace
router = APIRouter()

# Schema for incoming reconciliation actions (Match/Reject)
class ReconciliationAction(BaseModel):
    bank_id: int        # The database ID of the bank transaction
    invoice_id: str     # The Xero InvoiceID being linked or rejected

@router.get("/reconcile/{upload_id}")
def reconcile_upload(
    upload_id: str,
    xero_session_id: str = Cookie(None),              # Extract Xero session from browser cookies
    tenant_id: str = Depends(get_current_tenant_id),    # Dependency to fetch the active Xero Org ID
    db: Session = Depends(get_db)                     # Dependency to get a DB connection
):
    """
    Main Reconciliation Report generator.
    Combines DB bank rows with Live Xero data and runs the matching engine.
    """
    # 1. Validation: Ensure the user has an active Xero session
    if not xero_session_id:
        raise HTTPException(status_code=401, detail="Xero session required.")

    # 2. Database Fetch: Get all bank rows linked to this specific upload and organisation
    bank_rows = db.query(BankStatement).filter(
        BankStatement.upload_id == upload_id,
        BankStatement.tenant_id == tenant_id
    ).all()

    # 3. Validation: If no rows found, the upload ID might be invalid or belong to someone else
    if not bank_rows:
        raise HTTPException(status_code=404, detail="Bank statement not found.")

    # 4. Data Preparation: Map SQLAlchemy models into a clean dictionary list for the engine
    bank_data = [
        {
            "id": r.id,
            "transaction_date": r.transaction_date,
            "description": r.description,
            "amount": r.amount,
            "reconciliation_status": r.reconciliation_status,
            "reconciled_invoice_id": r.reconciled_invoice_id,
            "ignored_invoice_ids": r.ignored_invoice_ids,
            # Format timestamp for JSON serialization if it exists
            "reconciled_at": r.reconciled_at.strftime("%Y-%m-%d %H:%M:%S") if r.reconciled_at else None
        }
        for r in bank_rows
    ]

    # 5. Xero Fetch: Pull fresh invoice data from the Xero API
    try:
        xero_data = fetch_invoices(xero_session_id)
    except Exception as e:
        # 6. Error Handling: Wrap Xero-specific failures in a 500 error for the frontend
        raise HTTPException(status_code=500, detail=f"Xero API Error: {str(e)}")

    # 7. Engine Execution: Run the heuristic matching logic to determine buckets
    report = run_reconciliation(bank_data, xero_data)
    
    # 8. Response: Return the full report object (buckets + summary)
    return report

@router.post("/reconcile/approve")
def approve_match(
    action: ReconciliationAction,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    """
    Finalizes a suggested match or a manual link by updating the DB.
    """
    # 1. Fetch the specific bank transaction from the database
    bank_row = db.query(BankStatement).filter(
        BankStatement.id == action.bank_id,
        BankStatement.tenant_id == tenant_id
    ).first()

    # 2. Validation: Ensure the transaction exists
    if not bank_row:
        raise HTTPException(status_code=404, detail="Bank transaction not found.")

    # 3. Update State: Link the invoice and mark as matched
    bank_row.reconciled_invoice_id = action.invoice_id
    bank_row.reconciliation_status = "matched"
    
    # 4. Audit Trail: Set the current timestamp as the reconciliation time
    bank_row.reconciled_at = datetime.utcnow()
    
    # 5. Persist: Commit the changes to the SQLite database
    db.commit()

    return {"status": "success", "message": "Match approved."}

@router.post("/reconcile/reject")
def reject_match(
    action: ReconciliationAction,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    """
    Rejects a suggested match and adds the invoice to the ignore list for this row.
    """
    # 1. Fetch the bank transaction
    bank_row = db.query(BankStatement).filter(
        BankStatement.id == action.bank_id,
        BankStatement.tenant_id == tenant_id
    ).first()

    # 2. Validation
    if not bank_row:
        raise HTTPException(status_code=404, detail="Bank transaction not found.")

    # 3. Logic: Add the invoice ID to the pipe-separated ignore list
    current_ignored = (bank_row.ignored_invoice_ids or "").split("|")
    if action.invoice_id not in current_ignored:
        current_ignored.append(action.invoice_id)
        # Filter out empty strings and rejoin
        bank_row.ignored_invoice_ids = "|".join(filter(None, current_ignored))
    
    # 4. Persist
    db.commit()
    return {"status": "success", "message": "Match rejected."}

@router.post("/reconcile/unreconcile/{bank_id}")
def unreconcile(
    bank_id: int,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    """
    Resets a matched transaction back to 'pending' status.
    """
    # 1. Fetch the bank transaction
    bank_row = db.query(BankStatement).filter(
        BankStatement.id == bank_id,
        BankStatement.tenant_id == tenant_id
    ).first()

    # 2. Validation
    if not bank_row:
        raise HTTPException(status_code=404, detail="Bank transaction not found.")

    # 3. Reset State: Remove the link and audit timestamp
    bank_row.reconciled_invoice_id = None
    bank_row.reconciliation_status = "pending"
    bank_row.reconciled_at = None
    
    # 4. Persist
    db.commit()

    return {"status": "success", "message": "Transaction reset to pending."}

@router.get("/reconcile/report/{upload_id}/download")
def download_reconciliation_report(
    upload_id: str,
    xero_session_id: str = Cookie(None),
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db)
):
    """
    Generates and streams the Excel reconciliation report as a binary file.
    """
    # 1. Validation: Session required to fetch Xero data
    if not xero_session_id:
        raise HTTPException(status_code=401, detail="Xero session required.")

    # 2. Database Fetch
    bank_rows = db.query(BankStatement).filter(
        BankStatement.upload_id == upload_id,
        BankStatement.tenant_id == tenant_id
    ).all()

    # 3. Validation
    if not bank_rows:
        raise HTTPException(status_code=404, detail="Bank statement not found.")

    # 4. Data Preparation: Map models to dictionaries for the engine
    bank_data = [
        {
            "id": r.id,
            "transaction_date": r.transaction_date,
            "description": r.description,
            "amount": r.amount,
            "reconciliation_status": r.reconciliation_status,
            "reconciled_invoice_id": r.reconciled_invoice_id,
            "ignored_invoice_ids": r.ignored_invoice_ids,
            "reconciled_at": r.reconciled_at.strftime("%Y-%m-%d %H:%M:%S") if r.reconciled_at else None
        }
        for r in bank_rows
    ]

    # 5. Xero Fetch
    try:
        xero_data = fetch_invoices(xero_session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Xero API Error: {str(e)}")

    # 6. Engine Execution: Get the current reconciliation state
    report_obj = run_reconciliation(bank_data, xero_data)
    
    # 7. Excel Generation: Convert report object to a multi-sheet Excel BytesIO stream
    excel_file = generate_reconciliation_excel(report_obj)

    # 8. Filename Construction: Include partial upload ID and today's date
    timestamp = datetime.now().strftime('%Y%m%d')
    filename = f"reconciliation_report_{upload_id[:8]}_{timestamp}.xlsx"
    
    # 9. Streaming Response: Return the file to the browser
    return StreamingResponse(
        excel_file,
        # Set the MIME type for Excel files
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        # Force download with a specific filename
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
