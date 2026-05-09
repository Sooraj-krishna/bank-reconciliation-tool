"""
Upload API Router
-----------------
Handles the ingestion of bank statement CSV files.
- Validates file types and contents
- Integrates with the CSV parser service
- Manages DB persistence for bank rows
- Provides CRUD operations for managing past uploads
"""

import uuid
import re
from fastapi import APIRouter, UploadFile, File, HTTPException, Cookie, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.services.csv_parser import parse_csv
from app.models.bank_statement import BankStatement
from app.services.token_store import get_tokens

# Initialize the router for the upload namespace
router = APIRouter()

def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent security risks like path traversal.
    """
    # 1. Strip path components: Convert "path/to/file.csv" -> "file.csv"
    filename = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    # 2. Remove NULL bytes: Prevent low-level string termination attacks
    filename = filename.replace("\x00", "")
    # 3. Whitelist: Keep only alphanumeric, dots, hyphens, and underscores
    filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
    # 4. Truncate: Ensure the filename fits in the DB's 255 char limit while preserving extension
    if len(filename) > 255:
        name, ext = filename.rsplit(".", 1) if "." in filename else (filename, "")
        filename = name[:250] + ("." + ext if ext else "")
    # 5. Default: Fallback if sanitization leaves the string empty
    return filename or "unnamed_file.csv"

def get_current_tenant_id(xero_session_id: str = Cookie(None)) -> str:
    """
    Dependency: Fetches the persistent Xero Tenant ID associated with the session.
    Ensures data remains linked to the specific Xero organisation.
    """
    # 1. Validation: Fail if no session cookie exists
    if not xero_session_id:
        raise HTTPException(status_code=401, detail="No session found. Please connect to Xero.")
    
    # 2. Lookup: Get session tokens from the DB
    tokens = get_tokens(xero_session_id)
    # 3. Validation: Fail if session expired or tenant_id is missing
    if not tokens or not tokens.get("tenant_id"):
        raise HTTPException(status_code=401, detail="Organisation ID not found. Please reconnect to Xero.")
    
    return tokens["tenant_id"]

@router.post("/upload")
def upload_csv(
    file: UploadFile = File(...),                    # The uploaded multipart file
    tenant_id: str = Depends(get_current_tenant_id),  # The current Xero Org ID
):
    """
    Main upload endpoint. Receives, parses, and persists a CSV bank statement.
    """
    # 1. Extract Metadata: Get content type and sanitized name
    content_type = file.content_type or ""
    raw_filename = file.filename or ""
    filename = sanitize_filename(raw_filename)
    
    # 2. Type Check: Reject files that don't look like CSVs
    if not filename.lower().endswith(".csv") and "csv" not in content_type.lower() and "text/" not in content_type.lower():
        raise HTTPException(
            status_code=400,
            detail=f"File must be a CSV. Got: {content_type or 'unknown type'}. Please upload a .csv file."
        )
    
    # 3. Read Stream: Load the file bytes into memory
    try:
        file_bytes = file.file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    # 4. Content Check: Reject empty files
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File is empty. Please upload a valid CSV file.")
    
    # 5. UUID Generation: Create a unique identifier for this batch of rows
    upload_id = str(uuid.uuid4())
    
    # 6. Parsing: Use the logic-heavy parser service to clean and normalize the data
    try:
        result = parse_csv(file_bytes, filename, upload_id, tenant_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse CSV: {str(e)}")
    
    # 7. Quality Check: Fail if the parser couldn't find any valid rows
    if result["row_count"] == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid rows found in CSV. Check that the file has Date, Amount, and Description columns."
        )

    # 8. Database Persistence: Batch insert the results
    db = SessionLocal()
    try:
        rows_to_insert = []
        for row in result["rows"]:
            # Final sanitization pass before DB insertion
            clean_filename = sanitize_filename(row["filename"])
            clean_date = row["transaction_date"][:10]  # YYYY-MM-DD
            clean_desc = (row["description"] or "")[:500]
            clean_raw = (row["raw_description"] or "")[:500]
            clean_amount = float(row["amount"]) if row["amount"] is not None else 0.0
            clean_duplicate = bool(row["is_duplicate"])
            
            # Create the ORM object
            rows_to_insert.append(BankStatement(
                upload_id=row["upload_id"],
                filename=clean_filename,
                tenant_id=tenant_id,
                transaction_date=clean_date,
                description=clean_desc,
                raw_description=clean_raw,
                amount=clean_amount,
                is_duplicate=clean_duplicate,
            ))
        
        # 9. Bulk Save: More efficient than individual inserts for large CSVs
        db.bulk_save_objects(rows_to_insert)
        db.commit()
    except Exception as e:
        # Rollback on failure to prevent partial uploads
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save to database.")
    finally:
        db.close()

    # 10. Return: Return the cleaned data immediately for the frontend to preview
    return {
        "upload_id": upload_id,
        "filename": filename,
        "row_count": result["row_count"],
        "duplicate_count": result["duplicate_count"],
        "rows": result["rows"],
    }

@router.get("/uploads")
def list_uploads(tenant_id: str = Depends(get_current_tenant_id)):
    """
    Returns a summarized list of all past uploads for this organisation.
    """
    db = SessionLocal()
    try:
        # Fetch all bank rows for this tenant
        rows = (
            db.query(BankStatement)
            .filter(BankStatement.tenant_id == tenant_id)
            .order_by(BankStatement.uploaded_at.desc())
            .all()
        )

        # Python-side aggregation to group rows by their upload_id
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

        # Return as a list
        return list(upload_map.values())
    finally:
        db.close()

@router.get("/upload/{upload_id}")
def get_upload(
    upload_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Retrieves all rows for a specific upload UUID.
    """
    db = SessionLocal()
    try:
        # Verify that the upload belongs to the current organisation
        first_row = (
            db.query(BankStatement)
            .filter(
                BankStatement.upload_id == upload_id,
                BankStatement.tenant_id == tenant_id,
            )
            .first()
        )

        if not first_row:
            raise HTTPException(status_code=404, detail="Upload not found.")

        # Fetch all rows for the batch
        rows = (
            db.query(BankStatement)
            .filter(
                BankStatement.upload_id == upload_id,
                BankStatement.tenant_id == tenant_id,
            )
            .order_by(BankStatement.transaction_date.desc())
            .all()
        )

        # Return the payload
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
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Permanently deletes an entire upload batch from the database.
    """
    db = SessionLocal()
    try:
        # Ownership check
        count = (
            db.query(BankStatement)
            .filter(
                BankStatement.upload_id == upload_id,
                BankStatement.tenant_id == tenant_id,
            )
            .count()
        )

        if count == 0:
            raise HTTPException(status_code=404, detail="Upload not found.")

        # Batch delete
        db.query(BankStatement).filter(
            BankStatement.upload_id == upload_id,
            BankStatement.tenant_id == tenant_id,
        ).delete()

        db.commit()
        return {"message": "Upload deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Deletion failed.")
    finally:
        db.close()
