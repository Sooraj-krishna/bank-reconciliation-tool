Plan: CSV Upload and Cleaning (Days 3-4)

Overview
Add CSV upload + data cleaning to the existing FastAPI + React stack. Files upload via multipart form, get parsed/cleaned server-side, stored in SQLite, and displayed in a sortable table.

### 1. Backend Changes

1a. Add dependency — backend/requirements.txt

Add python-multipart (required by FastAPI for UploadFile).

1b. Create DB Model — backend/app/models/bank_statement.py

BankStatement(Base):
**tablename** = "bank_statements"
id → Integer, primary_key
upload_id → String (UUID, groups rows from same file)
filename → String (original filename)
uploaded_at → DateTime (server default now)
session_id → String (links to Xero session, for auth)
transaction_date → String (stored as "YYYY-MM-DD")
description → Text
raw_description → Text (original before cleaning, for audit)
amount → Float (negatives stay negative)
is_duplicate → Boolean (default False, flagged not deleted)

1c. Create CSV Parser Service — backend/app/services/csv_parser.py

Responsible for cleaning messy bank CSV data.
Function
parse_date(raw)
parse_amount(raw)
clean_description(raw)
detect_duplicates(rows)
parse_csv(file_bytes, filename, upload_id, session_id)
Column guessing: Look for common aliases:

- Date: Date, Transaction Date, Txn Date, Posted
- Amount: Amount, Debit/Credit (combine), Withdrawal, Deposit
- Description: Description, Particulars, Narrative, Details

1d. Create Upload API Router — backend/app/api/upload.py

POST /api/upload

- Accept: multipart/form-data with file field
- Validate: file exists, content-type is CSV or text/, reject PDF/other
- Read file bytes, call csv_parser.parse_csv()
- Bulk insert into bank_statements table
- Return: { upload_id, filename, row_count, duplicate_count, rows[] }

GET /api/uploads

- List all past uploads for the session (filename, uploaded_at, row_count)
- Query bank_statements grouped by upload_id

GET /api/upload/{upload_id}

- Return all rows for a specific upload, sorted by transaction_date
- Include is_duplicate flag

DELETE /api/upload/{upload_id}

- Delete all rows for an upload

Auth: Use xero_session_id cookie to associate uploads with a session (same pattern as invoices.py).

1e. Register Router — backend/app/main.py

Add: app.include_router(upload.router, prefix="/api", tags=["Upload"])

### 2. Frontend Changes

2a. Create Upload Page — frontend/src/pages/Upload.jsx

State:

- file, uploading (bool), error, uploads (past list), selectedUpload (view detail)
  Components:
- Drag-and-drop zone (styled area, click to browse)
- Accept: .csv only
- On drop/select: POST /api/upload with FormData
- Show progress (simple spinner)
- On success: show table of cleaned rows, highlight duplicates
- Error display: clear messages for bad files

Past uploads section:

- Fetch /api/uploads on mount
- Click to re-open (view rows in table)
- Delete button per upload

2b. Create Upload Table Component — frontend/src/components/UploadTable.jsx

Props: rows[], sort by transaction_date descending
Columns: Date (YYYY-MM-DD), Description, Amount (formatted with £), Duplicate? (amber badge)
Style: match Dashboard.jsx (white card, hover rows, #64748B text, #1A1A1A headers)

2c. Update Router — frontend/src/App.jsx

Add route: <Route path="/upload" element={<Upload />} />

2d. Update Dashboard — frontend/src/pages/Dashboard.jsx

Add a "Upload Bank Statement" button next to the disconnect button, linking to /upload.

3. Sample CSV Test Files

Create 3 test files in test_data/:

1. clean_dates.csv — standard format
2. messy_dates_currencies.csv — mixed formats: 15/03/2025, 16-03-2025, 17/3/25, 2025-03-18, amounts like $250.50, ₹1500, €100, 1,500.00
3. with_duplicates.csv — includes 2-3 duplicate rows
4. Key Design Decisions
   Decision
   Date storage
   Duplicate handling
   Amount storage
   Auth for uploads
   Past uploads

### 5. Files to Create/Modify

**New files:**

- `backend/app/models/bank_statement.py`
- `backend/app/services/csv_parser.py`
- `backend/app/api/upload.py`
- `frontend/src/pages/Upload.jsx`
- `frontend/src/components/UploadTable.jsx`
- `test_data/clean_dates.csv`
- `test_data/messy_dates_currencies.csv`
- `test_data/with_duplicates.csv`
  **Modify:**
- `backend/requirements.txt` — add `python-multipart`
- `backend/app/main.py` — register upload router
- `frontend/src/App.jsx` — add `/upload` route
- `frontend/src/pages/Dashboard.jsx` — add upload button

---

---

## File-by-File Explanation

NEW FILE: backend/requirements.txt (modify)
What changes: Add python-multipart to the list.
Why: FastAPI requires python-multipart to parse multipart/form-data requests — which is the HTTP format used when uploading files. Without it, UploadFile in FastAPI will fail at runtime with an import error.
fastapi
mangum
python-dotenv
requests
uvicorn
sqlalchemy
python-multipart <-- ADD THIS

---

NEW FILE: backend/app/models/bank_statement.py
Purpose: SQLAlchemy ORM model defining the bank_statements database table.
Why a new model (not reusing token.py): The token model stores Xero OAuth sessions — completely unrelated data. Bank statement rows have their own structure (date, amount, description, duplicate flag). Mixing them would violate separation of concerns.
Fields explained:
| Field | Type | Purpose |
|-------|------|---------|
| id | Integer, PK | Unique row ID (auto-increment) |
| upload_id | String | UUID that groups all rows from one CSV upload. Every row from the same file shares this ID. Lets us "re-open" past uploads by querying all rows with the same upload_id. |
| filename | String | Original filename (e.g. march_2025.csv) — displayed in the "Past Uploads" list |
| uploaded_at | DateTime | When the upload happened (server default func.now()) |
| session_id | String | Links the upload to a Xero session. Used for auth — only the user who uploaded can see their uploads. Same pattern as tokens table using session_id. |
| transaction_date | String | The cleaned date stored as "YYYY-MM-DD" string. Stored as string (not SQLite DATE) because SQLite has no native date type, and "2025-03-18" sorts correctly lexicographically. |
| description | Text | Cleaned transaction description (whitespace stripped, collapsed). |
| raw_description | Text | Original description before cleaning. Kept for audit trail — if user questions a cleaning decision, we can show what the bank provided. |
| amount | Float | Numeric amount. Negatives stay negative (e.g. withdrawals are -250.00). |
| is_duplicate | Boolean, default False | True if this row looks like a duplicate of another row in the same upload. We flag it rather than delete it — requirement says "duplicates flagged (not silently deleted)". |
Table name: **tablename** = "bank_statements" (SQLite table name).

---

NEW FILE: backend/app/services/csv_parser.py
Purpose: Pure logic module — no HTTP, no DB. Takes raw CSV bytes, returns cleaned rows. This separation means it's testable without spinning up FastAPI.
Functions explained:
parse_date(raw: str) -> str | None

- Strips whitespace from the raw date string.
- Tries these formats in order using datetime.strptime:
  1. "%d/%m/%Y" → 15/03/2025
  2. "%d-%m-%Y" → 16-03-2025
  3. "%d/%m/%y" → 17/3/25 (note: single-digit day/month handled by strptime naturally)
  4. "%Y-%m-%d" → 2025-03-18
- Returns "YYYY-MM-DD" string on success, None on failure.
- Called for every row's date field.
  parse_amount(raw: str) -> float | None
- Strips whitespace.
- Removes known currency symbols: ₹, $, €, £.
- Removes thousand separators: commas , that appear before a . or at every 3rd digit.
- Detects parentheses (1200.00) as negative numbers (common in bank exports).
- Converts to float.
- Returns float or None.
- Called for every row's amount field.
  clean_description(raw: str) -> str
- Strips leading/trailing whitespace.
- Collapses multiple spaces into one with a regex re.sub(r'\s+', ' ', raw).
- Returns cleaned string.
  detect_duplicates(rows: list[dict]) -> list[dict]
- Takes a list of row dicts (each with transaction_date, amount, description).
- Creates a set of seen hashes: hash (date, amount, description) using hashlib.md5 or a tuple key.
- Iterates rows; if a row's key is already in the set, set row["is_duplicate"] = True.
- Returns the modified rows list.
- Does not remove duplicates — just flags them.
  parse_csv(file_bytes: bytes, filename: str, upload_id: str, session_id: str) -> dict
- Main entry point, called by the API router.
- Decodes file_bytes to string (tries utf-8, falls back to latin-1).
- Uses csv.DictReader to read rows.
- Column guessing: Looks at the CSV headers and tries to map them:
  - For Date: check if any header contains (case-insensitive): "date", "posted", "txn", "transaction"
  - For Amount: check for "amount", "debit", "credit", "withdrawal", "deposit"
  - For Description: check for "desc", "particular", "narrative", "details", "memo"
  - If Debit/Credit columns found: amount = credit - debit
- For each CSV row:
  - Skip if all values are empty (empty row).
  - Call parse_date() on date field → skip row if None.
  - Call parse_amount() on amount field → skip row if None.
  - Call clean_description() on description field.
  - Build a row dict with cleaned fields + raw_description (original).
- Call detect_duplicates() on the collected rows.
- Returns: { "upload_id": upload_id, "filename": filename, "rows": [...], "row_count": N, "duplicate_count": M }

---

NEW FILE: backend/app/api/upload.py
Purpose: FastAPI router handling all upload-related HTTP endpoints. Follows the exact same patterns as invoices.py (cookie auth, error handling).
Endpoints explained:
POST /api/upload
@router.post("/upload")
def upload_csv(
file: UploadFile,
xero_session_id: str = Cookie(None),
db: Session = Depends(get_db)
):

- Auth check: Rejects with 401 if no xero_session_id cookie (same as invoices.py).
- File validation:
  - Check file.content_type — must contain "csv" or "text/". Reject PDF/other with 400: "File must be a CSV. Got: application/pdf".
  - Check file size in memory (optional: reject >10MB).
  - Check if file is empty after reading.
- Read file: file.file.read() → bytes.
- Parse: Call csv_parser.parse_csv(bytes, filename, upload_id, session_id) → gets cleaned rows.
- Store in DB: Loop rows, create BankStatement ORM objects, db.add_all(), db.commit().
- Return: { "upload_id": "...", "filename": "...", "row_count": N, "duplicate_count": M, "rows": [...] } — rows included so frontend can display immediately without a second API call.
  GET /api/uploads
  @router.get("/uploads")
  def list_uploads(xero_session_id: str = Cookie(None), db: Session = Depends(get_db)):
- Auth check via cookie.
- Query DB: SELECT DISTINCT upload_id, filename, uploaded_at, COUNT(\*), SUM(is_duplicate) FROM bank_statements WHERE session_id = ? GROUP BY upload_id ORDER BY uploaded_at DESC.
- Returns: [ { "upload_id": "...", "filename": "...", "uploaded_at": "...", "row_count": N, "duplicate_count": M }, ... ]
- Used by the frontend "Past Uploads" list.
  GET /api/upload/{upload_id}
  @router.get("/upload/{upload_id}")
  def get_upload(upload_id: str, xero_session_id: str = Cookie(None), db: Session = Depends(get_db)):
- Auth check.
- Query: SELECT \* FROM bank_statements WHERE upload_id = ? AND session_id = ? ORDER BY transaction_date DESC.
- Returns all rows for that upload, including is_duplicate flag.
- Used when user clicks a past upload to "re-open" it.
  DELETE /api/upload/{upload_id}
  @router.delete("/upload/{upload_id}")
  def delete_upload(upload_id: str, xero_session_id: str = Cookie(None), db: Session = Depends(get_db)):
- Auth check.
- Delete: DELETE FROM bank_statements WHERE upload_id = ? AND session_id = ?.
- Returns { "message": "Upload deleted" }.
- Used by the "Delete" button per upload.

---

MODIFY: backend/app/main.py
What changes: Add one line to register the new upload router.
from app.api import auth, invoices, upload # <-- add upload

# ... existing code ...

app.include_router(upload.router, prefix="/api", tags=["Upload"]) # <-- ADD THIS
Why: FastAPI won't expose the /api/upload endpoints unless the router is registered. This follows the same pattern as lines 26-29 for auth and invoices.

---

NEW FILE: frontend/src/pages/Upload.jsx
Purpose: Full page component for uploading CSV files and viewing results. Accessed via /upload route.
State explained:
const [file, setFile] = useState(null) // Currently selected file object
const [uploading, setUploading] = useState(false) // Spinner while POST is in flight
const [error, setError] = useState("") // Error message to display
const [result, setResult] = useState(null) // API response after successful upload
const [uploads, setUploads] = useState([]) // Past uploads list from GET /api/uploads
const [selectedUpload, setSelectedUpload] = useState(null) // Currently viewed past upload rows
const [loadingUploads, setLoadingUploads] = useState(true) // Loading state for past uploads list
Functions:
fetchUploads()

- Called on mount with useEffect.
- GET /api/uploads → sets uploads state.
- Shows the "Past Uploads" section.
  handleUpload()
- Validates: file must be selected, file must end in .csv (client-side guard).
- Creates FormData, appends file as form-data field.
- POST /api/upload with FormData (axios auto-sets Content-Type: multipart/form-data).
- On success: sets result state → shows the UploadTable component.
- On error: parses error response → sets error state with clear message (e.g. "File must be a CSV", "Empty file").
  handleSelectUpload(upload)
- Called when user clicks a past upload from the list.
- GET /api/upload/{upload_id} → sets selectedUpload state with rows.
- Reuses the same UploadTable component to display.
  handleDeleteUpload(uploadId)
- DELETE /api/upload/{uploadId}.
- On success: refetches uploads list, clears selection if deleted upload was selected.
  UI Structure:
  Page Header ("Upload Bank Statement" + breadcrumb back to Dashboard)
  |
  +-- Upload Zone (drag-and-drop area)
  | - Styled div with dashed border
  | - Click → hidden <input type="file" accept=".csv" onChange={...} />
  | - On dragover: highlight border
  | - On drop: setFile(files[0])
  | - Show selected filename + "Upload" button
  |
  +-- Error Alert (if error state set)
  |
  +-- Upload Result Table (if result or selectedUpload)
  | - Shows UploadTable component with rows
  |
  +-- Past Uploads Section - List of previous uploads with filename, date, row count - Click to re-open → handleSelectUpload() - Delete button → handleDeleteUpload()

---

NEW FILE: frontend/src/components/UploadTable.jsx
Purpose: Reusable table component to display cleaned CSV rows. Used in two places:

1. Immediately after uploading a new file.
2. When viewing a past upload.
   Props:
   UploadTable({ rows, onClose }) // rows: array of row objects, onClose: optional callback
   Display columns:
   | Column | Value | Notes |
   |--------|-------|-------|
   | Date | row.transaction_date | Already YYYY-MM-DD, display as-is |
   | Description | row.description | Cleaned; show row.raw_description as tooltip/subtitle |
   | Amount | £{row.amount.toFixed(2)} | Negative amounts show in red |
   | Duplicate? | Badge | If row.is_duplicate: amber "Duplicate" badge. Else: green "Unique" badge |
   Styling: Matches Dashboard.jsx exactly:

- White card with rounded-xl border border-gray-100 shadow-sm
- Header row: bg-gray-50/50 text-xs text-[#64748B] uppercase
- Data rows: hover:bg-[#FDFBF7] transition
- Amount negatives: text-red-600 (like the Dashboard uses for status colors)

---

MODIFY: frontend/src/App.jsx
What changes: Add one route for the Upload page.
import Upload from "./pages/Upload"; // <-- ADD
function App() {
return (
<ErrorBoundary>
<AppProvider>
<Router>
<Routes>
<Route path="/" element={<Home />} />
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/upload" element={<Upload />} /> {/_ ADD THIS _/}
</Routes>
</Router>
</AppProvider>
</ErrorBoundary>
);
}

---

MODIFY: frontend/src/pages/Dashboard.jsx
What changes: Add a "Upload Bank Statement" button next to the existing "Disconnect" button in the header.
{/_ In the header flex container, add this button: _/}
<button
onClick={() => navigate("/upload")}
className="bg-[#059669] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-emerald-700 transition flex items-center gap-2"

>   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">

    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />

  </svg>
  Upload Statement
</button>
This creates a natural flow: Dashboard → Upload → View Results → back to Dashboard.
---
NEW FILES: Test CSV Files in test_data/
test_data/clean_dates.csv
Date,Description,Amount
2025-03-01,Monthly Subscription,99.99
2025-03-05,Office Supplies,45.50
2025-03-10,Client Payment,-250.00
Standard format. Should upload with 0 errors, 0 duplicates.
test_data/messy_dates_currencies.csv
Date,Description,Amount
15/03/2025,Monthly Subscription,$99.99
16-03-2025,Office Supplies,₹45.50
17/3/25,Client Payment,1,500.00
2025-03-18,Rent,€1200.00
Mixed formats. Will test:
- parse_date: all 4 formats
- parse_amount: $, ₹, €, thousand separators 1,500.00
- All should parse successfully.
test_data/with_duplicates.csv
Date,Description,Amount
2025-03-01,Subscription,99.99
2025-03-01,Subscription,99.99
2025-03-02,Coffee,4.50
2025-03-02,Coffee,4.50
2025-03-03,Lunch,12.00
5 rows, 2 pairs of duplicates. detect_duplicates should flag 2 rows as is_duplicate=True. The uploaded result should show duplicate_count: 2.
---
Summary: Data Flow
User drops CSV
     ↓
Frontend: Upload.jsx → FormData → POST /api/upload
     ↓
Backend: upload.py → reads file bytes
     ↓
Backend: csv_parser.py → parse_date() / parse_amount() / clean_description()
     ↓
Backend: detect_duplicates() → flag is_duplicate=True
     ↓
Backend: upload.py → Bulk INSERT into bank_statements table
     ↓
Backend: returns { upload_id, rows[], row_count, duplicate_count }
     ↓
Frontend: UploadTable.jsx displays rows with duplicate badges
For past uploads:
User clicks "March 2025" from Past Uploads
     ↓
Frontend: GET /api/upload/{upload_id}
     ↓
Backend: SELECT * FROM bank_statements WHERE upload_id = ?
     ↓
Frontend: UploadTable.jsx displays the rows
---
