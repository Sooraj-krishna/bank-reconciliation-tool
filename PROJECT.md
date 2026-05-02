# Bank-to-Books Reconciliation Tool

## Overview
A web application that helps small business owners reconcile bank statements with Xero accounting records. The app automates matching bank transactions to Xero invoices, reducing manual work.

**Duration:** 2 weeks  
**Stack:** React (Vite) + FastAPI + Xero API  
**Submission:** GitHub repo + walkthrough call

---

## User Journey
1. User clicks "Connect to Xero" → OAuth login → grants permission
2. User uploads a bank statement CSV file
3. App reads CSV, fetches Xero invoices, and auto-matches them
4. User sees 4 buckets: **Matched**, **Possible matches**, **Unmatched (Bank)**, **Unmatched (Xero)**
5. User reviews and approves/rejects possible matches, or manually links unmatched items
6. User clicks "Generate Report" and downloads a summary

---

## Tech Stack
- **Frontend:** React (Vite), Tailwind CSS
- **Backend:** FastAPI (Python), SQLite
- **Integration:** Xero API (OAuth 2.0)
- **Deployment:** Vercel (frontend), Render (backend)

---

## 2-Week Plan

### Part 1: Project Setup + Xero Connection (Days 1-2)
**Backend:**
- FastAPI app with OAuth flow (`/auth/login`, `/auth/callback`)
- Store tokens in SQLite (safe storage, no hardcoded secrets)
- Auto-refresh tokens before expiry
- Endpoint to fetch Xero invoices

**Frontend:**
- Home page with "Connect to Xero" button
- Post-connection page showing fetched invoices in a table

**Done when:**
- Clicking "Connect to Xero" completes OAuth and returns to app
- Real Xero Demo Company invoices are displayed
- Tokens auto-refresh; no "unauthorized" errors
- Friendly error messages on failure

---

### Part 2: CSV Upload and Cleaning (Days 3-4)
**Features:**
- Upload bank statement CSV via React UI
- Send file to FastAPI backend for processing
- Clean messy data:
  - Dates in multiple formats (15/03/2025, 16-03-2025, 17/3/25, 2025-03-18)
  - Currency symbols mixed with numbers ($250.50, ₹1500, €100)
  - Thousand separators ("1,500.00")
  - Extra whitespace, empty rows, duplicates
- Store cleaned data in DB
- Display in a table (sorted by date)
- Reject bad files (PDFs, corrupt, empty) with clear error messages
- Allow re-opening past uploads

**Done when:**
- 3 sample CSV files upload successfully
- Bad files are rejected with useful messages
- Dates stored consistently as YYYY-MM-DD
- Amounts stored as numbers (negatives stay negative)
- Duplicates flagged (not silently deleted)

---

### Part 3: Matching Engine (Days 5-7)
**Core logic — 4 buckets:**
1. **Matched** — High confidence (exact amount, close date, matching reference)
2. **Possible matches** — Some doubt (amount ±1%, date within 5 days, supplier name match)
3. **Unmatched (Bank)** — No Xero record found
4. **Unmatched (Xero)** — No bank transaction found

**Matching rules (in order):**
1. Same amount + same date + same reference → Matched (100% confidence)
2. Same amount + date within 3 days → Matched (85% confidence)
3. Amount within ±1% + date within 5 days → Possible (60% confidence)
4. Description contains Xero contact name → Possible (boost confidence)

**Done when:**
- Matching engine in its own Python module
- Each match has a confidence score (0-100)
- 4 buckets populated correctly
- Deterministic results (same data = same output)
- At least 3 unit tests
- One Xero invoice can't match multiple bank transactions (and vice versa)

**Mid-project review (Day 7):** 30-min call demoing end-to-end flow + code walkthrough

---

### Part 4: Review UI (Days 8-10)
**Features:**
- 4 tables/tabs for the 4 buckets
- Summary: "12 matched, 3 to review, 5 unmatched"
- Approve/reject items in "Possible matches"
- Manually link unmatched bank → unmatched Xero
- Filter by date range and amount range
- Moves rows between buckets without page reload

**Done when:**
- Clean, usable UI with clear messages (no blank screens)
- Manual matching updates buckets correctly

---

### Part 5: Reports + Documentation (Days 11-12)
**Reports:**
"Generate Report" button → downloadable PDF/Excel with:
- Total bank transactions in upload
- Total matched (count + amount)
- Total unmatched (count + amount)
- List of all unmatched items
- List of manual approvals with timestamps

**Documentation (README.md):**
- Step-by-step setup instructions
- Assumptions made
- Known limitations (be honest)
- Simple data flow diagram
- What you'd do differently with more time

---

### Buffer Days (Days 13-14)
- Fix bugs, add tests, polish README
- Practice final demo

---

## Environment Variables

### Vercel (Frontend)
| Name | Value |
|------|-------|
| `VITE_API_BASE_URL` | `https://your-app.onrender.com` |

### Render (Backend)
| Name | Value |
|------|-------|
| `DATABASE_URL` | SQLite or PostgreSQL connection string |
| `SECRET_KEY` | Secret key for sessions |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `XERO_CLIENT_ID` | From Xero Developer Portal |
| `XERO_CLIENT_SECRET` | From Xero Developer Portal |
| `XERO_REDIRECT_URI` | `https://your-app.onrender.com/auth/callback` |
| `ALLOW_VERCEL_PREVIEWS` | `true` (optional, for preview URLs) |

---

## Documentation Requirements
- **README.md** — Setup instructions, assumptions, limitations, data flow diagram
- **STANDUP.md** — Daily updates (3 lines: yesterday/today/blockers) for all 14 days
- **AI_USAGE.md** — For each significant feature: what you asked AI, what you used, what you rejected and why

---

## Evaluation Criteria

| Area | Weight |
|------|--------|
| Logic & problem-solving | 20% |
| Code quality | 15% |
| Xero API integration | 15% |
| Reliability & planning (standups, commits) | 15% |
| Communication | 15% |
| Frontend (React) | 10% |
| Documentation | 5% |
| Bonus features | 5% |

---

## Automatic Disqualifiers
- Hardcoded API keys/secrets in code
- Empty `try/except: pass` blocks
- AI-generated code you can't explain
- Only 1-2 commits at the end (need daily progress)
- Missing daily standup updates
- Copying another candidate's code

---

## Final Walkthrough Call (45 min)
1. **Demo (10 min)** — End-to-end walkthrough
2. **Code walkthrough (15 min)** — Explain 2-3 code sections
3. **"What if" questions (10 min)** — e.g., 100k CSV rows, Xero down
4. **Live extension (10 min)** — Add a small feature in real-time
