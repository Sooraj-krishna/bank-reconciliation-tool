# Plan: Reconciliation Engine (Days 5-6)

## Overview
This module implements the intelligent matching logic that connects uploaded bank CSV data to live Xero invoices. It uses a weighted scoring algorithm to categorize results into four specific "Buckets" for the user to review.

---

### 1. Backend Architecture

#### 1a. Core Engine — `backend/app/services/reconciliation_service.py`
This is a "Pure Logic" service. It does not interact with the database or API directly, making it highly testable.

**Key Functions:**

| Function | Responsibility | Logic |
|----------|----------------|-------|
| `calculate_score()` | Assigns a 0-100 score to a potential pair. | Compares Amount, Date, and Reference strings. |
| `run_reconciliation()` | Orchestrates the matching for the entire set. | Iterates Bank rows, finds best matches, enforces 1-to-1 rule. |

**Priority Level Scoring:**
- **Level 1 (100):** `Amount` is identical AND `Date` is identical AND `Reference` (Xero) is found in the `Description` (Bank).
- **Level 2 (85):** `Amount` is identical AND `Date` is within a ±3 day window.
- **Level 3 (60):** `Amount` is within ±1% (rounding/fee tolerance) AND `Date` is within a ±5 day window.
- **Level 4 (Boost):** If the `Contact Name` (Xero) is found in the `Description` (Bank), the score is boosted by +10.

#### 1b. API Router — `backend/app/api/reconciliation.py`
The gateway for the frontend to trigger the engine.

- **Endpoint:** `GET /api/reconcile/{upload_id}`
- **Data Gathering:**
  1. Fetches bank transactions from SQLite using the `upload_id`.
  2. Fetches live invoices from Xero using the `xero_service.fetch_invoices()`.
- **Security:** Verifies that the `upload_id` belongs to the `xero_session_id` stored in the cookie.
- **Returns:** A structured JSON object containing a `summary` and the 4 `buckets`.

---

### 2. The 4 Output Buckets (The Goal)

| Bucket | Logic for Entry | UI Representation |
|--------|----------------|-------------------|
| **Matched** | Score >= 85 | Green theme, side-by-side view. |
| **Possible** | 60 <= Score < 85 | Amber theme, requires user toggle. |
| **Unmatched (Bank)** | No candidates found with Score >= 60 | Bank transaction only, "Find Match" link. |
| **Unmatched (Xero)** | Invoices not claimed by any Bank row | Xero invoice only, "Unpaid" badge. |

---

### 3. Frontend Architecture

#### 3a. Reconciliation Page — `frontend/src/pages/Reconcile.jsx`
A dedicated dashboard for reviewing the engine's findings.

- **State Management:**
  - `data`: Stores the full reconciliation report.
  - `activeTab`: Controls which bucket is currently visible (default: "matched").
- **UI Components:**
  - **Summary Cards:** 4 stat blocks at the top showing counts for each bucket.
  - **Match Cards:** A split-screen component showing Bank (Left) vs Xero (Right) with a "Confidence Meter" in the middle.
  - **Action Header:** Fixed top bar with "Confirm All Matches" primary action.

#### 3b. Integration Points:
- **`Upload.jsx`**: Added a "Start Intelligent Matching" button that appears after a successful CSV upload.
- **`App.jsx`**: Registered the dynamic route `/reconcile/:uploadId`.

---

### 4. Technical Design Decisions

| Decision | Rationale |
|----------|-----------|
| **One-to-One Locking** | Prevents a single payment from being matched to two different invoices. Essential for accounting integrity. |
| **Deterministic Sorting** | Bank rows are sorted by date before matching. This ensures that if you run the engine twice, the results are identical. |
| **Fuzzy Date Windows** | Accommodates for bank delays (weekend processing) by allowing a ±3 to ±5 day variance. |
| **In-Memory Matching** | By matching in-memory and not writing to the DB immediately, the user can "Preview" the reconciliation before committing. |

---

### 5. Files Created/Modified
**New Files:**
- `backend/app/services/reconciliation_service.py`
- `backend/app/api/reconciliation.py`
- `backend/tests/test_reconciliation.py`
- `frontend/src/pages/Reconcile.jsx`
- `test_data/matching_test.csv`

**Modified Files:**
- `backend/app/main.py` (Router registration)
- `frontend/src/App.jsx` (Routing)
- `frontend/src/pages/Upload.jsx` (Navigation trigger)

---

### 6. Security & Integrity Measures
1. **Session Isolation:** The `reconciliation.py` router uses `xero_session_id` as a hard filter in every SQL query. You cannot reconcile a file you didn't upload.
2. **Type Safety:** All amounts are cast to `float` and dates to `datetime` objects before comparison to avoid "String vs Number" logic errors.
3. **Audit Trail:** The `raw_description` from the bank is preserved in the UI so the user can verify the engine's "cleaned" interpretation.

---

## File-by-File Explanation

### 1. `backend/app/services/reconciliation_service.py`
**Purpose:** The mathematical core of the application. It processes lists of dicts and returns the "buckets."

**Logic Breakdown:**
- **`calculate_score(bank_row, invoice)`**: 
  - It handles amount normalization (absolute values) so that both positive deposits and negative withdrawals can be matched against positive invoice totals.
  - It implements a **String-in-String** check: if `INV-001` appears anywhere in "Payment for INV-001", it scores 100.
  - It uses `timedelta` to create a date "window." A payment on Monday matching an invoice from Friday is valid (Score 85).
- **`run_reconciliation(bank_rows, xero_invoices)`**:
  - **Deterministic Sort**: It sorts bank data by date first. This is crucial—if two bank rows are identical, the first one will always claim the first available invoice.
  - **The Winner-Takes-All Loop**: It uses a nested loop. For every bank row, it scans *all* invoices. It identifies the "Best Match" (highest score).
  - **The Lock**: If the best match is >= 85, it adds the `InvoiceID` to `used_invoice_ids`. The next bank row will skip that invoice entirely.

### 2. `backend/app/api/reconciliation.py`
**Purpose:** The HTTP controller. It transforms IDs into actual data.

**Logic Breakdown:**
- It acts as a **Data Aggregator**. The frontend only sends an `upload_id`. This router then does the heavy lifting:
  - Hits **SQLite** for the bank data.
  - Hits **Xero API** (via `fetch_invoices`) for the live accounting data.
- **Session Protection**: It uses the `xero_session_id` cookie as a security boundary. This ensures that even if someone guesses an `upload_id`, they can't see the data unless they own the session.

### 3. `backend/tests/test_reconciliation.py`
**Purpose:** The automated validation suite.

**Tests Explained:**
- `test_level_1_exact_match`: Verifies that a perfect scenario (Price/Date/Ref) results in a 100 score.
- `test_one_to_one_rule`: Specifically tests the "Locking" logic. It provides two identical bank rows and one invoice. It proves that only one gets matched and the other is marked "Unmatched."

### 4. `frontend/src/pages/Reconcile.jsx`
**Purpose:** The user-facing "Truth" screen.

**Key Features:**
- **The Tab System**: Uses local state (`activeTab`) to filter the `data.buckets`. This keeps the UI clean even if there are hundreds of transactions.
- **Visual Confidence**: Displays the score as a percentage. This builds trust with the user—they can see *why* the system thinks something is a "Possible Match" (e.g., 60%).
- **Responsive Split-View**: On mobile, it stacks the cards; on desktop, it shows them side-by-side.

---

## Data Flow Summary
1. **User** clicks "Reconcile" on a file.
2. **Frontend** calls `GET /api/reconcile/{upload_id}`.
3. **Backend** fetches Bank Rows (Local DB) + Invoices (Xero API).
4. **Service** runs the matching algorithm + sorts into buckets.
5. **Frontend** receives the buckets and renders the tabbed report.
