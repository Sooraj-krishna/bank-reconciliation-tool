"""
CSV Parser Service

Handles parsing and cleaning of messy bank statement CSVs.
All functions are pure (no DB, no HTTP) — testable in isolation.

Supported cleaning:
- Dates: 15/03/2025, 16-03-2025, 17/3/25, 2025-03-18 → "YYYY-MM-DD"
- Amounts: $250.50, ₹1500, €100, 1,500.00, (200.00) → float
- Descriptions: strip whitespace, collapse multiple spaces
- Duplicates: flagged by hashing (date, amount, description)
"""

import csv
import io
import re
from datetime import datetime
from typing import Optional
from app.core.config import (
    CSV_DATE_ALIASES,
    CSV_DESC_ALIASES,
    CSV_REF_ALIASES,
    CSV_DEBIT_ALIASES,
    CSV_CREDIT_ALIASES,
    CSV_BALANCE_ALIASES,
    CSV_AMOUNT_PRIORITY_ALIASES
)


# Date format attempts in order of priority
DATE_FORMATS = [
    "%d/%m/%Y",    # 15/03/2025
    "%d-%m-%Y",     # 16-03-2025
    "%d/%m/%y",     # 17/3/25 (note: %y handles 2-digit year)
    "%Y-%m-%d",     # 2025-03-18
]


def parse_date(raw: str) -> Optional[str]:
    """
    Parse a messy date string into a clean "YYYY-MM-DD" string.

    Tries multiple formats in order. Returns None if no format matches.
    Strips whitespace before parsing.

    Args:
        raw: Raw date string from CSV (e.g., "15/03/2025", "16-03-2025")

    Returns:
        "YYYY-MM-DD" string or None
    """
    if not raw or not raw.strip():
        return None

    date_str = raw.strip()

    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_amount(raw: str) -> Optional[float]:
    """
    Parse a messy amount string into a clean float with sign awareness.

    Handles:
    - Currency symbols: $250.50, ₹1500
    - Thousand separators: "1,500.00" → 1500.00
    - Parentheses: "(200.00)" → -200.00
    - Trailing negatives: "200.00-" → -200.00
    - Explicit signs: "-200.00", "+200.00"

    This version is robust against 'double negative' flips.
    """
    if not raw or not raw.strip():
        return None

    amt_str = raw.strip()

    # 1. Detect if it SHOULD be negative based on markers
    is_negative = False
    if amt_str.startswith("(") and amt_str.endswith(")"):
        is_negative = True
    elif amt_str.endswith("-"):
        is_negative = True
    elif amt_str.startswith("-"):
        is_negative = True

    # 2. Strip ALL non-numeric characters except the decimal point
    # This prevents '--75.00' issues
    clean_str = re.sub(r'[^\d.]', '', amt_str)

    if not clean_str:
        return None

    try:
        value = float(clean_str)
        return -value if is_negative else value
    except ValueError:
        return None


def clean_description(raw: str) -> str:
    """
    Clean a description string.

    Strips leading/trailing whitespace and collapses multiple
    spaces into a single space.

    Args:
        raw: Raw description from CSV

    Returns:
        Cleaned description string
    """
    if not raw:
        return ""
    # Strip and collapse multiple whitespace chars
    return re.sub(r'\s+', ' ', raw.strip())


def detect_duplicates(rows: list[dict]) -> list[dict]:
    """
    Flag duplicate rows based on (transaction_date, amount, description) hash.

    Duplicates are NOT removed — they are flagged with is_duplicate=True
    so the user can review them.

    Args:
        rows: List of cleaned row dicts (must have transaction_date, amount, description)

    Returns:
        Same list with is_duplicate=True added to duplicate rows
    """
    seen = set()

    for row in rows:
        # Create a hashable key from the three identifying fields
        key = (row.get("transaction_date"), row.get("amount"), row.get("description"))
        if key in seen:
            row["is_duplicate"] = True
        else:
            seen.add(key)
            row["is_duplicate"] = False

    return rows


def _guess_columns(headers: list[str]) -> dict:
    """
    Guess the CSV column mapping with robust 'Balance' threat detection.
    
    Logic:
    1. Scan for Date, Description, and Reference using aliases.
    2. Identify and BLACKLIST columns that look like 'Balance' or 'Running Total'.
    3. SEARCH for a Debit/Credit pair first (highest priority for split formats).
    4. FALLBACK to a single 'Amount' column only if no pair is found.
    """
    headers_lower = [header.lower().strip() for header in headers]
    
    # 1. Basic Metadata Columns
    date_aliases = CSV_DATE_ALIASES
    desc_aliases = CSV_DESC_ALIASES
    ref_aliases = CSV_REF_ALIASES

    def find_best(aliases, blacklist=None):
        for alias in aliases:
            for index, header in enumerate(headers_lower):
                if blacklist and index in blacklist: 
                    continue
                if alias == header or alias in header:
                    return headers[index], index
        return None, None

    date_col, _ = find_best(date_aliases)
    desc_col, _ = find_best(desc_aliases)
    ref_col, _ = find_best(ref_aliases)

    # 2. IDENTIFY THREATS: Columns that look like 'Balance' but contain 'Amount' or 'Total'
    # We must NEVER pick these for transaction amounts.
    balance_indices = []
    balance_aliases = CSV_BALANCE_ALIASES
    for index, header in enumerate(headers_lower):
        if any(balance_alias in header for balance_alias in balance_aliases):
            balance_indices.append(index)

    # 3. AMOUNT DETECTION (Pair-First Strategy)
    amount_col = None
    debit_col = None
    credit_col = None

    # Search for Debit/Credit Pair
    debit_aliases = CSV_DEBIT_ALIASES
    credit_aliases = CSV_CREDIT_ALIASES

    def is_match(header, aliases):
        """Helper for strict word-based alias matching."""
        header_words = re.findall(r'\w+', header.lower())
        for alias in aliases:
            # Exact match is always safe
            if alias == header.lower(): return True
            # Word-based match (e.g., 'in' matches 'paid in' but not 'invoice')
            if alias in header_words: return True
        return False

    for index, header in enumerate(headers_lower):
        if index in balance_indices: 
            continue
        if is_match(header, debit_aliases):
            debit_col = headers[index]
        if is_match(header, credit_aliases):
            credit_col = headers[index]

    # If we found at least a Debit column, assume it's a split format
    if debit_col:
        amount_col = (debit_col, credit_col) # credit_col might be None, which is fine
    else:
        # 4. FALLBACK: Single Amount Search
        # We rank them to find the most likely 'Net' amount
        priority_amount_aliases = CSV_AMOUNT_PRIORITY_ALIASES
        amount_col_name, _ = find_best(priority_amount_aliases, blacklist=balance_indices)
        amount_col = amount_col_name

    return {
        "date": date_col, 
        "amount": amount_col, 
        "description": desc_col, 
        "reference": ref_col
    }


def parse_csv(file_bytes: bytes, filename: str, upload_id: str, session_id: str) -> dict:
    """
    Main entry point: parse raw CSV bytes into cleaned rows.

    Reads CSV, guesses columns, cleans each row, detects duplicates,
    and returns structured data ready for DB insertion.

    Args:
        file_bytes: Raw bytes of the uploaded CSV file
        filename: Original filename (for storing in DB) - sanitized before storage
        upload_id: UUID to group all rows from this upload
        session_id: Xero session ID (for auth scoping)

    Returns:
        Dict with: upload_id, filename, row_count, duplicate_count, rows[]
    """
    # Sanitize filename - defense in depth (also done in API layer)
    import re
    filename = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]  # Strip path
    filename = re.sub(r'[^a-zA-Z0-9._\-]', '', filename)  # Only safe chars
    filename = filename[:255] if filename else "unnamed_file.csv"

    # Decode bytes - try utf-8 first, fall back to latin-1 for weird encodings
    try:
        content = file_bytes.decode("utf-8-sig")  # utf-8-sig handles BOM
    except UnicodeDecodeError:
        content = file_bytes.decode("latin-1")

    reader = csv.DictReader(io.StringIO(content))

    if not reader.fieldnames:
        return {"upload_id": upload_id, "filename": filename, "row_count": 0, "duplicate_count": 0, "rows": []}

    # Guess which CSV columns map to our fields
    col_map = _guess_columns(reader.fieldnames)

    cleaned_rows = []

    for row in reader:
        # Skip completely empty rows
        if not any(row.values()):
            continue

        raw_date = row.get(col_map["date"], "")
        raw_amount = row.get(col_map["amount"], "") if isinstance(col_map["amount"], str) else None
        raw_desc = row.get(col_map["description"], "")
        raw_ref = row.get(col_map["reference"], "") if col_map.get("reference") else ""
        
        # Combine description and reference for better matching
        full_desc = f"{raw_desc} {raw_ref}".strip() if raw_ref else raw_desc

        # Clean fields
        date_val = parse_date(raw_date)
        desc_val = clean_description(full_desc)

        # Handle combined Debit/Credit columns
        if isinstance(col_map["amount"], tuple):
            raw_debit = row.get(col_map["amount"][0], "")
            raw_credit = row.get(col_map["amount"][1], "")
            
            debit_val = parse_amount(raw_debit)
            credit_val = parse_amount(raw_credit)
            
            if debit_val is None and credit_val is None:
                amount_val = None
            else:
                # Standard accounting: Inflow (Credit) - Outflow (Debit)
                # We take abs(debit) to ensure it's always treated as a withdrawal
                # even if the CSV already has a minus sign.
                amount_val = (credit_val or 0.0) - abs(debit_val or 0.0)
        else:
            amount_val = parse_amount(raw_amount) if raw_amount else None

        # Skip rows where date or amount parsing failed
        if not date_val or amount_val is None:
            continue

        cleaned_rows.append({
            "upload_id": upload_id,
            "filename": filename,
            "session_id": session_id,
            "transaction_date": date_val,
            "raw_description": full_desc,  # Store the combined version for audit
            "description": desc_val,
            "amount": amount_val,
            "is_duplicate": False  # Will be set by detect_duplicates
        })

    # Flag duplicates (NOT remove them)
    cleaned_rows = detect_duplicates(cleaned_rows)

    duplicate_count = sum(1 for r in cleaned_rows if r["is_duplicate"])

    return {
        "upload_id": upload_id,
        "filename": filename,
        "row_count": len(cleaned_rows),
        "duplicate_count": duplicate_count,
        "rows": cleaned_rows
    }
