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

router = APIRouter()

@router.get("/reconcile/{upload_id}")
def reconcile_upload(
    upload_id: str,
    xero_session_id: str = Cookie(None),
    db: Session = Depends(get_db)
):
    """
    Trigger the reconciliation process for a specific bank statement upload.
    
    1. Fetches stored bank transactions from SQLite.
    2. Fetches live invoices from Xero API.
    3. Runs the matching algorithm.
    """
    if not xero_session_id:
        raise HTTPException(status_code=401, detail="Xero session required.")

    # 1. Fetch bank statements from DB
    bank_rows = db.query(BankStatement).filter(
        BankStatement.upload_id == upload_id,
        BankStatement.session_id == xero_session_id
    ).all()

    if not bank_rows:
        raise HTTPException(status_code=404, detail="Bank statement not found.")

    # Convert SQLAlchemy objects to dicts for the service
    bank_data = [
        {
            "id": r.id,
            "transaction_date": r.transaction_date,
            "description": r.description,
            "amount": r.amount
        }
        for r in bank_rows
    ]

    # 2. Fetch invoices from Xero
    try:
        xero_data = fetch_invoices(xero_session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Xero API Error: {str(e)}")

    # 3. Run the logic
    report = run_reconciliation(bank_data, xero_data)

    return report
