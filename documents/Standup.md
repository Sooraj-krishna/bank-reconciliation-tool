## Day 1

### ✅ What I did

- Set up project structure with separate **frontend (React + Vite)** and **backend (FastAPI)**.

- Initialized FastAPI server with basic endpoints (`/` and `/health`).

- Configured environment variables using `.env` and `python-dotenv`.

- Established frontend-backend communication using **Axios**.

- Resolved **CORS issue** by adding middleware in FastAPI.

- Set up **Tailwind CSS (v3)** and configured it correctly after resolving version-related issues.

- Built initial UI using Tailwind:
  - Centered layout with card design
  - Styled “Connect to Xero” button
  - Loading state and success indicator

- Implemented reusable **Error Alert component** with dynamic messaging and auto-dismiss functionality.

- Verified API communication by successfully fetching `/health` endpoint from frontend.

---

## Day 2: Xero Connection & Session Stability

### ✅ Accomplishments

- **Stabilized Xero OAuth2 Flow**: Successfully implemented the full handshake, including token storage and automatic background refreshing.

- **Fixed Production Session Issues**: Resolved critical `401 Unauthorized` errors occurring in the Vercel + Render production environment.

- **Implemented Vercel Proxying**: Configured `vercel.json` rewrites to proxy API and Auth calls, converting third-party cookies into first-party cookies to bypass browser privacy blocks.

- **Concurrency Control**: Added a thread-level lock in the backend to prevent race conditions during simultaneous token refreshes (e.g., when the dashboard and session check run in parallel).

- **Graceful Disconnect**: Implemented a proper `/auth/logout` endpoint that clears both the database session and the browser's HttpOnly cookie.

### 🚩 Challenges & Solutions

- **The Cookie Block**: Faced issues where browsers blocked the session cookie because the frontend (Vercel) and backend (Render) were on different domains.
  - _Solution_: Implemented reverse-proxying via Vercel configuration so the browser treats the backend as "Same-Site."

- **Race Conditions**: Parallel requests from the React frontend were causing invalid refresh token errors.
  - _Solution_: Implemented a mutex lock in the backend service layer to serialize token refresh attempts.

### 🔒 Security & Best Practices

- **Secure Cookie Management**: Used `HttpOnly` flags to prevent XSS-based session theft and `Secure` flags to ensure tokens are only transmitted over encrypted HTTPS connections.

- **Token Rotation & Persistence**: Implemented Xero's latest token rotation standard, ensuring that even if a refresh token is leaked, it becomes invalid after a single use.

- **Cross-Site Protection**: Configured `SameSite=None` and reverse-proxying to maintain strict security while allowing seamless cross-domain communication between Vercel and Render.

- **Backend Concurrency Safety**: Implemented thread-safe token refreshing to handle high-frequency parallel API calls without losing session state.

- **Environment Isolation**: Zero hardcoded credentials; all sensitive Xero Client IDs and Secrets are managed via secure environment variables on the server side.

### 🏗️ Architectural Highlights

- **Layered Service Pattern**: Separated Xero API logic into a dedicated service layer, making the codebase easier to test and scale.

- **Transparent Auto-Refresh**: The backend automatically detects and fixes expired tokens _before_ the API call is made, providing a "it just works" experience for the user.

- **Graceful Error Propagation**: Implemented a unified error handling system that translates complex Xero API errors into user-friendly notifications in the React frontend.

---

## Day 3: CSV Upload & Data Cleaning

### ✅ Accomplishments

- **Advanced CSV Parsing Engine**: Built a robust service capable of handling messy bank data, including automatic date format detection (UK/US/ISO) and currency/thousand separator sanitization.
- **Multipart Upload Integration**: Implemented high-performance file uploads with server-side validation for file types and sizes.
- **Intelligent Column Mapping**: Created a "fuzzy matcher" to automatically detect Date, Amount, and Description columns regardless of their header names.
- **Duplicate Detection**: Implemented a hashing algorithm to flag potential duplicate bank entries while preserving data for audit purposes.
- **Drag-and-Drop UI**: Built a premium React-based upload zone with real-time progress indicators and instant result previews.
- **Persistence Layer**: Successfully mapped cleaned CSV rows to a relational SQLite schema for long-term storage and session-based retrieval.

### 🔒 Security & Best Practices

- **Filename Sanitization**: Implemented strict path-traversal protection and character filtering for all uploaded files.
- **Content-Type Validation**: Added deep file inspection to prevent malicious file uploads (e.g., rejecting renamed executables).
- **Injection Protection**: Used SQLAlchemy's parameterized bulk-insert methods to ensure zero risk of SQL injection from messy CSV data.
- **Data Scoping**: Every upload is cryptographically linked to a Xero session, ensuring users can only see and manage their own bank data.

### 🏗️ Architectural Highlights

- **Decoupled Logic**: The parsing engine is a pure Python service, allowing for easy unit testing without database or web server dependencies.
- **Micro-Animations**: Integrated scroll-reveal hooks and hover-state transitions to create a "live" feel during the data cleaning process.
- **Self-Healing UI**: Implemented automatic error recovery for failed uploads with human-readable guidance.

### 📅 Next Steps

- **Part 3: Reconciliation Engine**: Start the logic for matching bank statements against Xero invoices.
- **The "Great Match" UI**: Build the split-screen interface for confirming suggested matches.
