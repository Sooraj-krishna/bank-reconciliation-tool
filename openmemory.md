## Overview
- **Frontend**: Vite + React + Tailwind CSS.
- **Backend**: FastAPI (served via `uvicorn` locally).

## Components
- **`frontend/src/pages/Home.jsx`**: Health-checks backend on mount, shows connection status UI, and displays `ErrorAlert` overlay on failures.
- **`frontend/src/components/ErrorAlert.jsx`**: Full-screen overlay error popup with auto-close timer.
- **`backend/app/main.py`**: FastAPI app with `/` and `/health` endpoints and CORS middleware.
- **`backend/app/core/config.py`**: Loads env vars (including parsed `ALLOWED_ORIGINS`).
- **`api/index.py`**: Vercel serverless entrypoint wrapping the backend FastAPI app via Mangum.

## Patterns
- **Backend health check**: `api.get("/health")` in `Home.jsx` to determine backend connectivity.
- **Error overlay**: `ErrorAlert` renders when an `error` state string exists.
- **CORS config**: `ALLOWED_ORIGINS` is parsed from env into a list with whitespace trimmed and empty entries removed; unset/empty means an empty list (no CORS origins allowed).
- **Vercel single-project deploy**: Repo-root `vercel.json` builds `frontend` and exposes FastAPI under `/api/*` via `api/index.py` (Mangum wrapper importing `backend/app`).

