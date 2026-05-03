"""
Upload API Router

Handles CSV file uploads for bank statements.
- POST /api/upload → upload and parse CSV (no auth required)
- GET  /api/uploads → list past uploads for session
- GET  /api/upload/{upload_id} → get rows from a specific upload
- DELETE /api/upload/{upload_id} → delete an upload

POST /upload does not require authentication - anyone can upload a bank statement.
GET/DELETE endpoints use session_id to scope uploads to a session.
"""

import uuid
import re
from fastapi import APIRouter, UploadFile, File, HTTPException, Cookie, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.services.csv_parser import parse_csv
from app.models.bank_statement import BankStatement


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent SQL injection and path traversal attacks.

    - Removes path components (../, /etc.)
    - Removes NULL bytes
    - Limits length to 255 chars
    - Allows only safe characters (alphanumeric, dots, hyphens, underscores)
    """
    # Remove path components - get just the filename
    filename = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    # Remove NULL bytes
    filename = filename.replace("\x00", "")
    # Keep only safe characters: alphanumeric, dots, hyphens, underscores
    filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
    # Limit length
    if len(filename) > 255:
        name, ext = filename.rsplit(".", 1) if "." in filename else (filename, "")
        filename = name[:250] + ("." + ext if ext else "")
    return filename or "unnamed_file.csv"

router = APIRouter()


def get_session_id(xero_session_id: str = Cookie(None)) -> str:
    """
    Dependency: extract session cookie for GET/DELETE endpoints.

    Raises 401 if no session cookie is present.
    """
    if not xero_session_id:
        raise HTTPException(status_code=401, detail="No session cookie found. Please connect to Xero first.")
    return xero_session_id


@router.post("/upload")
def upload_csv(
    file: UploadFile = File(...),
    xero_session_id: str = Cookie(None),  # Optional - not required for upload
):
    """
    Upload and parse a bank statement CSV file.
    
    Validates file type, parses/cleans the CSV, stores rows in DB,
    and returns the cleaned data with duplicate flags.
    
    Args:
        file: Uploaded CSV file (multipart form field)
        xero_session_id: Session cookie for auth
    
    Returns:
        Dict with upload_id, filename, row_count, duplicate_count, rows[]
    
    Raises:
        HTTP 400: Bad file type (PDF, etc.) or empty file
        HTTP 401: Not authenticated
        HTTP 500: Parsing or DB error
    """
    # Validate file type - reject non-CSV files
    content_type = file.content_type or ""
    raw_filename = file.filename or ""
    filename = sanitize_filename(raw_filename)
    
    if not filename.lower().endswith(".csv") and "csv" not in content_type.lower() and "text/" not in content_type.lower():
        raise HTTPException(
            status_code=400,
            detail=f"File must be a CSV. Got: {content_type or 'unknown type'}. Please upload a .csv file."
        )
    
    # Read file bytes
    try:
        file_bytes = file.file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File is empty. Please upload a valid CSV file.")
    
    # Generate upload ID and parse CSV
    upload_id = str(uuid.uuid4())  # UUID is safe - no injection risk
    session_id = xero_session_id if xero_session_id else None
    result = None
    
    try:
        result = parse_csv(file_bytes, filename, upload_id, session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse CSV: {str(e)}")
    
    if result["row_count"] == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid rows found in CSV. Check that the file has Date, Amount, and Description columns."
        )

        # Bulk insert into database - use parameterized queries via SQLAlchemy ORM (injection-safe)
        db = SessionLocal()
        try:
            rows_to_insert = []
            for row in result["rows"]:
                # Validate/sanitize each field before DB insert
                clean_filename = sanitize_filename(row["filename"])
                clean_date = row["transaction_date"][:10]  # YYYY-MM-DD is max 10 chars
                clean_desc = (row["description"] or "")[:500]  # Limit description length
                clean_raw = (row["raw_description"] or "")[:500]
                clean_amount = float(row["amount"]) if row["amount"] is not None else 0.0
                clean_duplicate = bool(row["is_duplicate"])
                
                rows_to_insert.append(BankStatement(
                    upload_id=row["upload_id"],  # UUID - safe
                    filename=clean_filename,
                    session_id=row["session_id"],  # Could be None (nullable)
                    transaction_date=clean_date,
                    description=clean_desc,
                    raw_description=clean_raw,
                    amount=clean_amount,
                    is_duplicate=clean_duplicate,
                ))
            db.bulk_save_objects(rows_to_insert)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to save to database. Please try again.")
        finally:
            db.close()

    return {
        "upload_id": upload_id,
        "filename": filename,
        "row_count": result["row_count"],
        "duplicate_count": result["duplicate_count"],
        "rows": result["rows"],
    }


@router.get("/uploads")
def list_uploads(xero_session_id: str = Depends(get_session_id)):
    """
    List all past uploads for the current session.

    Groups rows by upload_id and returns summary info for each upload.

    Args:
        xero_session_id: Session cookie for auth

    Returns:
        List of uploads with upload_id, filename, uploaded_at, row_count, duplicate_count
    """
    db = SessionLocal()
    try:
        # Get all rows for this session, then aggregate in Python
        # to avoid SQLAlchemy func.cast issues
        rows = (
            db.query(BankStatement)
            .filter(BankStatement.session_id == xero_session_id)
            .order_by(BankStatement.uploaded_at.desc())
            .all()
        )

        # Group by upload_id in Python
        upload_map = {}
        for r in rows:
            uid = r.upload_id
            if uid not in upload_map:
                upload_map[uid] = {
                    "upload_id": uid,
                    "filename": r.filename,
                    "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None,
                    "row_count": 0,
                    "duplicate_count": 0,
                }
            upload_map[uid]["row_count"] += 1
            if r.is_duplicate:
                upload_map[uid]["duplicate_count"] += 1

        return list(upload_map.values())
    finally:
        db.close()


@router.get("/upload/{upload_id}")
def get_upload(
    upload_id: str,
    xero_session_id: str = Depends(get_session_id),
):
    """
    Get all rows for a specific upload.

    Used to "re-open" past uploads. Returns rows sorted by transaction_date DESC.

    Args:
        upload_id: The UUID of the upload to retrieve
        xero_session_id: Session cookie for auth

    Returns:
        Dict with upload_id, filename, rows[]

    Raises:
        HTTP 404: Upload not found or doesn't belong to session
    """
    db = SessionLocal()
    try:
        # Verify ownership and get filename
        first_row = (
            db.query(BankStatement)
            .filter(
                BankStatement.upload_id == upload_id,
                BankStatement.session_id == xero_session_id,
            )
            .first()
        )

        if not first_row:
            raise HTTPException(status_code=404, detail="Upload not found.")

        # Get all rows sorted by date descending
        rows = (
            db.query(BankStatement)
            .filter(
                BankStatement.upload_id == upload_id,
                BankStatement.session_id == xero_session_id,
            )
            .order_by(BankStatement.transaction_date.desc())
            .all()
        )

        return {
            "upload_id": upload_id,
            "filename": first_row.filename,
            "rows": [
                {
                    "id": r.id,
                    "transaction_date": r.transaction_date,
                    "description": r.description,
                    "raw_description": r.raw_description,
                    "amount": r.amount,
                    "is_duplicate": r.is_duplicate,
                }
                for r in rows
            ],
        }
    finally:
        db.close()


@router.delete("/upload/{upload_id}")
def delete_upload(
    upload_id: str,
    xero_session_id: str = Depends(get_session_id),
):
    """
    Delete all rows for a specific upload.

    Args:
        upload_id: The UUID of the upload to delete
        xero_session_id: Session cookie for auth

    Returns:
        Success message

    Raises:
        HTTP 404: Upload not found or doesn't belong to session
    """
    db = SessionLocal()
    try:
        # Verify ownership
        count = (
            db.query(BankStatement)
            .filter(
                BankStatement.upload_id == upload_id,
                BankStatement.session_id == xero_session_id,
            )
            .count()
        )

        if count == 0:
            raise HTTPException(status_code=404, detail="Upload not found.")

        # Delete all rows for this upload
        db.query(BankStatement).filter(
            BankStatement.upload_id == upload_id,
            BankStatement.session_id == xero_session_id,
        ).delete()

        db.commit()
        return {"message": "Upload deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
