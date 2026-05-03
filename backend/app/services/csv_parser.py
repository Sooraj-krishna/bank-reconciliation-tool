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
    Parse a messy amount string into a clean float.

    Handles:
    - Currency symbols: $250.50, ₹1500, €100
    - Thousand separators: "1,500.00" → 1500.00
    - Parentheses for negatives: "(200.00)" → -200.00
    - Trailing negatives: "200.00-" → -200.00

    Args:
        raw: Raw amount string from CSV

    Returns:
        Float value (negatives preserved) or None
    """
    if not raw or not raw.strip():
        return None

    amt_str = raw.strip()

    # Check for parentheses indicating negative (common in bank statements)
    is_negative = False
    if amt_str.startswith("(") and amt_str.endswith(")"):
        is_negative = True
        amt_str = amt_str[1:-1]

    # Check for trailing minus sign
    if amt_str.endswith("-"):
        is_negative = True
        amt_str = amt_str[:-1]

    # Check for starting minus sign
    if amt_str.startswith("-"):
        is_negative = True
        amt_str = amt_str[1:]

    # Remove currency symbols and thousand separators
    amt_str = re.sub(r'[₹$€£,]', '', amt_str)

    # Remove any remaining non-numeric chars except . and -
    amt_str = re.sub(r'[^\d.-]', '', amt_str)

    if not amt_str:
        return None

    try:
        value = float(amt_str)
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
    Guess the CSV column mapping by inspecting header names.

    Looks for common aliases case-insensitively:
    - Date: Date, Posted, Txn Date, Transaction Date, Posted Date
    - Amount: Amount, Debit/Credit (combined), Withdrawal, Deposit
    - Description: Description, Particulars, Narrative, Details, Memo

    Args:
        headers: List of CSV column header strings

    Returns:
        Dict with keys: 'date', 'amount', 'description' → header name or None
    """
    headers_lower = [h.lower().strip() for h in headers]

    # Date column aliases
    date_aliases = ["date", "posted", "txn date", "transaction date", "posted date"]
    date_col = None
    for alias in date_aliases:
        for i, h in enumerate(headers_lower):
            if alias == h or alias in h:
                date_col = headers[i]
                break
        if date_col:
            break

    # Amount column aliases (check for combined Debit/Credit too)
    amount_col = None
    debit_col = None
    credit_col = None

    for i, h in enumerate(headers_lower):
        if h in ["amount", "amt"]:
            amount_col = headers[i]
            break
        if h in ["debit", "withdrawal", "dr"]:
            debit_col = headers[i]
        if h in ["credit", "deposit", "cr"]:
            credit_col = headers[i]

    # If no single amount col but have debit/credit, use both
    if not amount_col and debit_col:
        amount_col = (debit_col, credit_col)  # Tuple signals combined mode

    # Description column aliases
    desc_aliases = ["description", "particulars", "narrative", "details", "memo", "narration"]
    desc_col = None
    for alias in desc_aliases:
        for i, h in enumerate(headers_lower):
            if alias == h or alias in h:
                desc_col = headers[i]
                break
        if desc_col:
            break

    return {"date": date_col, "amount": amount_col, "description": desc_col}


def parse_csv(file_bytes: bytes, filename: str, upload_id: str, session_id: str) -> dict:
    """
    Main entry point: parse raw CSV bytes into cleaned rows.

    Reads CSV, guesses columns, cleans each row, detects duplicates,
    and returns structured data ready for DB insertion.

    Args:
        file_bytes: Raw bytes of the uploaded CSV file
        filename: Original filename (for storing in DB)
        upload_id: UUID to group all rows from this upload
        session_id: Xero session ID (for auth scoping)

    Returns:
        Dict with: upload_id, filename, row_count, duplicate_count, rows[]
    """
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

        # Handle combined Debit/Credit columns
        if isinstance(col_map["amount"], tuple):
            debit = row.get(col_map["amount"][0], "")
            credit = row.get(col_map["amount"][1], "")
            # Debit is negative, Credit is positive
            if debit and debit.strip():
                raw_amount = f"-{debit}"  # Mark as negative
            else:
                raw_amount = credit

        # Clean fields
        date_val = parse_date(raw_date)
        desc_val = clean_description(raw_desc)
        amount_val = parse_amount(raw_amount) if raw_amount else None

        # Skip rows where date or amount parsing failed
        if not date_val or amount_val is None:
            continue

        cleaned_rows.append({
            "upload_id": upload_id,
            "filename": filename,
            "session_id": session_id,
            "transaction_date": date_val,
            "raw_description": raw_desc,
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
