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

---

## Day 4:

---

## Day 5: Reconciliation Engine & Intelligent Matching

### ✅ Accomplishments

- **4-Tier Deterministic Matching Engine**: Engineered a priority-based matching system that categorizes transactions into Matched (85%+), Possible (60-84%), and Unmatched buckets based on a strict 0-100 confidence scale.
- **Ambiguity & "Clash" Detection**: Implemented a sophisticated conflict-resolution layer that identifies when a bank transaction matches multiple invoices equally. These are automatically flagged as **Ambiguous** and moved to the **Possible** bucket for human review.
- **Advanced Search & Ranking**: Developed a real-time filtering system with **Relevance Ranking**, prioritizing results that _start with_ the search term to improve user efficiency.
- **Premium UI Overhaul**: Designed and implemented a responsive, "Apple-esque" Controls Bar featuring glassmorphism tabs, custom-styled sort controls, and mobile-optimized layouts.
- **Robust Persistence Layer**: Migrated all statement and reconciliation data to **Tenant-ID scoped storage**, ensuring that matching results are tied to the Xero Organisation and persist across user sessions.
- **Dashboard Synchronization**: Integrated invoice dates and a new **Cyan-themed** status indicator into the main Dashboard for a cohesive and modern user experience.

### 🚩 Challenges & Solutions

- **The Xero Date Nightmare**: Xero's internal `/Date(ms)/` format made it impossible to perform standard date arithmetic or display readable dates in the UI.
  - _Solution_: Built a dual-ended regex normalization engine in both Python and React to convert raw API dates into ISO standards before they reach the logic or the user.
- **The "Match Clashing" Problem**: Initial logic was matching bank transactions to the first invoice found, leading to "silent errors" when multiple similar invoices existed.
  - _Solution_: Implemented a "Match Clashing" pass that detects multiple candidates of equal score and flags the transaction as Ambiguous rather than auto-matching.
- **Search Logic Complexity**: Filtering across three different data shapes (Matched Pairs, Unmatched Bank, and Unmatched Xero) was causing search failures.
  - _Solution_: Implemented a **Normalize-Extract Pattern** (`getNormData`) that flattens any data type into a standard interface for the search and sort logic.

### 🔒 Security & Best Practices

- **Strict Tenant Isolation**: Enforced hard-scoping of all database transactions by the `tenant_id`, ensuring zero data leakage between different Xero organizations.
- **One-to-One Matching Registry**: Built a stateful used-invoice registry to ensure that no single Xero invoice is ever matched against more than one bank transaction in a single run.
- **Deterministic Processing Order**: Enforced strict pre-matching sorting (Date -> Amount -> ID) to guarantee that the reconciliation engine produces identical results every time it runs on the same data.

### 🏗️ Architectural Highlights

- **Multi-Pass Scoring Strategy**: The engine runs in three distinct passes—Deterministic (Exact), Heuristic (Fuzzy), and Contextual (Contact Match)—to build a high-precision confidence score.
- **Universal Normalization Layer**: The frontend uses a unified normalization layer, allowing the same search, sort, and display logic to work seamlessly across all four buckets.
- **Stateful SQL Persistence**: Switched from transient session storage to a persistent SQLite backend linked to the user's Xero identity, allowing for "resume-anywhere" reconciliation.

---

## Day 6-7: Finalizing the Matching Engine (Part 3) — ✅ DONE

### ✅ Accomplishments

- **Multi-Pass Confidence Scoring Matrix**: Engineered a high-precision scoring engine that evaluates potential matches across three logical passes:
  - **Deterministic Pass (100%)**: Utilizes exact amount matching, exact date alignment, and alphanumeric reference stripping for near-perfect certainty.
  - **Heuristic Pass (85%)**: Accounts for "date slippage" (transaction clearing delays) by allowing a 3-day window while maintaining exact amount constraints.
  - **Fuzzy/Contextual Pass (60-84%)**: Employs an amount tolerance (±1% for hidden fees) and a 5-day window, boosted by partial-string contact name matching.
- **Stateful Invoice Registry ("Match Locking")**: Built a transient registry during the matching run that tracks every Xero Invoice ID used. Once an invoice is paired, it is "locked," preventing the engine from creating invalid one-to-many or many-to-one reconciliation errors.
- **Ambiguity Resolver**: Developed a "Clash Detection" layer. If a bank transaction has multiple candidates with identical confidence scores, the engine refuses to auto-match and instead routes the cluster to the "Possible" bucket with a "Review Required" flag.
- **Deep-Logic Unit Testing**: Implemented a PyTest suite in `matching_engine.py` simulating complex financial edge cases:
  - **The "Fee Gap"**: Bank charges causing small amount mismatches.
  - **The "Weekend Slide"**: Transactions occurring on Friday but clearing on Monday.
  - **The "Duplicate Amount"**: Multiple different invoices for the same amount ($100.00) but different references.

### 🚩 Challenges & Solutions

- **Reference Noise**: Bank references often contain auxiliary info (e.g., "PAYMENT 1234 REF: ABCD").
  - _Solution_: Built a **Normalization Pipeline** that strips non-critical noise and isolates the core reference ID for comparison against Xero invoice numbers.
- **Xero organisation-ID Scoping**: Matching data could leak if tokens from multiple companies were used.
  - _Solution_: Enforced a strict `organisation_id` FK constraint on all reconciliation results, ensuring data is cryptographically isolated at the database level.

### 🏗️ Architectural Highlights

- **Configurable Weighting Matrix**: Moved scoring weights (Amount: 0.7, Date: 0.2, Metadata: 0.1) into a central config, allowing the engine to be tuned for different industries without code changes.
- **Pure Function Matching**: The engine is designed as a side-effect-free service. It receives data, computes matches, and returns a result set, making it highly predictable and easy to debug.

---

## Day 8-10: Review UI & Modernization (Part 4) — ✅ DONE

### ✅ Accomplishments

- **Interactive Quad-Bucket State Registry**: Successfully engineered a robust React-managed workspace featuring four distinct transaction buckets. Leveraged the **Normalize-Extract Pattern** to flatten disparate data shapes into a unified interface for the 4-tab system.
- **Dynamic Reconciliation Pipeline**:
  - **Instant Row Transfers**: Implemented high-performance state management that moves items between buckets (e.g., Approve Possible -> Matched) without full-page reloads or layout shifts.
  - **Manual Link Engine**: Designed a side-by-side reconciliation modal that allows users to manually pair "Unmatched Bank" items with searchable "Unmatched Xero" records.
- **High-Fidelity Feature Visualization**:
  - **SVG Orbital Timeline**: Built a custom SVG-based radial features timeline with CSS-variable-driven animations and synchronized hover-state orchestration.
  - **3D CardStack Framework**: Integrated a `framer-motion` 3D stack for testimonials, featuring opaque emerald gradients, high-contrast typography, and gold 5-star ratings.
- **Dashboard Full-Screen Migration**: Refactored the core reconciliation view from a side-constrained layout to a full-screen, high-density dashboard, significantly reducing scrolling and improving information visibility.

### 🚩 Challenges & Solutions

- **3D Content Overflow**: The addition of stars, tags, and profile icons exceeded the `260px` height of the testimonial cards.
  - _Solution_: Recalibrated the `cardHeight` to `320px` and the stage height to `cardHeight + 60` to accommodate the rich metadata without clipping.
- **Accessibility in 3D Space**: 3D transforms can often break tab indexing and keyboard navigation.
  - _Solution_: Manually implemented `onKeyDown` handlers for the CardStack (`ArrowLeft`, `ArrowRight`) and ensured all interactive orbital nodes are keyboard-focusable.
- **Theme Contrast Audit**: The shift to a light-themed landing page revealed readability issues in the feature cards.
  - _Solution_: Refactored the `RadialOrbitalTimeline` to use `font-black` weights and Slate-800 text on pure white backgrounds, ensuring high legibility for financial data.

### 🔒 Security & Best Practices

- **Optimistic UI Updates with Rollback**: Implemented optimistic state updates for matching actions. The UI updates instantly, but if the backend call fails, the state is gracefully rolled back to its previous bucket.
- **Component Atomic Design**: Standardized all UI elements into a library of atomic components (`Card`, `Badge`, `Button`), ensuring that theme updates propagate instantly across the entire application.

### 🏗️ Architectural Highlights

- **Universal Filter Interface**: Developed a shared filtering hook that applies Date and Amount range logic across all four buckets simultaneously, ensuring consistent results as users switch tabs.
- **Framer Motion Orchestration**: Used a centralized `motion` configuration to sync the entry animations of the feature orbital nodes, creating a polished, premium sequence on page load.

---

## Day 11-12: Reporting Engine & Final Polish (Part 5) — ✅ DONE

### ✅ Accomplishments

- **Premium Reporting Engine (Excel)**: Developed a professional, multi-sheet export service using `Pandas` and `OpenPyXL`.
  - **Dynamic Metrics**: Summary sheet calculates aggregate dollar values for Matched, Possible, and Unmatched items.
  - **Verified Audit Trail**: Explicitly captures manual approval timestamps and linked invoice metadata.
  - **Thematic Styling**: Integrated emerald-branded headers, zebra-striping, and auto-adjusted layouts.
- **Financial Dashboard Expansion**:
  - **Real-Time Aggregate Metrics**: Injected live "Total Amount" calculations into the 4-bucket summary cards and navigation tabs.
  - **Dynamic Summary Footer**: Implemented a "Bucket Total" component at the bottom of the transaction list that updates instantly based on active filters.
- **UI/UX Optimization**:
  - **Compact Header Design**: Slimmed down the Search Bar and Sort Filter to improve screen real estate.
  - **Density Calibration**: Adjusted card vertical padding and rounding for a more professional, "finance-first" aesthetic.
- **Comprehensive Documentation Suite**:
  - **README.md Rewrite**: Added detailed setup guides, architectural assumptions, and a Mermaid data flow diagram.
  - **AI_USAGE.md**: Drafted a technical reflection on AI-pair-programming trade-offs and custom logic overrides.

### 🚩 Challenges & Solutions

- **Aggregation Latency**: Summing thousands of rows in the frontend for real-time totals can cause UI jitter.
  - _Solution_: Leveraged `useMemo` for the calculation logic, ensuring totals are only recomputed when the underlying transaction data or filters change.
- **Excel Styling Complexity**: Formatting cell-level borders and colors in `openpyxl` is verbose.
  - _Solution_: Abstracted styling into a reusable utility loop within `report_service.py` to maintain visual consistency across all sheets.

### 🏗️ Architectural Highlights

- **Service-Side Computation**: Moved complex summary math into `reconciliation_service.py` to ensure the same logic is shared between the UI and the Excel export.
- **Binary Stream Pipeline**: Implemented a robust `StreamingResponse` flow from FastAPI to React, handling large binary blobs with native browser download triggers.

---
