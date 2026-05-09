# 🤖 AI Usage Report: BankSync

This document details how AI (Antigravity) was utilized during the development of BankSync, including what was accepted, what was modified, and the reasoning behind architectural decisions.

---

## 🛠️ Feature 1: Multi-Tier Matching Engine
*   **What I asked AI:** "Build a 4-tier matching engine in Python that scores bank rows against Xero invoices (0-100)."
*   **What I used:** The core logic of the 3-pass system (Deterministic, Heuristic, Fuzzy).
*   **What I modified/rejected:**
    *   *Rejected*: A naive "first-match-wins" approach.
    *   *Modified*: Added an **Ambiguity/Clash Detection** layer. If two invoices match perfectly, they are moved to "Possible" instead of being auto-matched.
*   **Reasoning:** To prevent "silent errors" where similar invoices (e.g., recurring $100 payments) are linked to the wrong month without user review.

---

## 🛠️ Feature 2: Xero OAuth & Session Stability
*   **What I asked AI:** "Implement a secure OAuth2 flow for Xero with token refreshing in FastAPI."
*   **What I used:** The `requests` based handshake and token rotation logic.
*   **What I modified/rejected:**
    *   *Modified*: Integrated a **Thread Lock (Mutex)** in the backend token refresh service.
*   **Reasoning:** React Strict Mode and parallel frontend requests were causing multiple token refresh calls simultaneously, leading to "invalid_grant" errors. The mutex ensures only one refresh happens at a time.

---

## 🛠️ Feature 3: Modern UI & CardStack
*   **What I asked AI:** "Create a premium landing page with interactive 3D elements."
*   **What I used:** Framer Motion for the `CardStack` and orbital SVG animations.
*   **What I modified/rejected:**
    *   *Modified*: Redesigned the `CardStack` to be "Photo-less." 
*   **Reasoning:** Generic stock photos felt unprofessional for a financial tool. Replaced them with typography-focused emerald gradients and Lucide icons to maintain a premium business feel.

---

## 🛠️ Feature 4: Reporting & Premium Export
*   **What I asked AI**: "Generate a reconciliation report in Excel using Pandas with emerald branding."
*   **What I used**: The multi-sheet structure and basic `openpyxl` border styling.
*   **What I modified/rejected**:
    *   *Modified*: Implemented a **Strict Audit Tab** that specifically isolated manual actions from auto-matches.
    *   *Modified*: Added **Financial Section Headers** and conditional styling for empty states.
*   **Reasoning**: A generic list of matches isn't an audit trail. I forced the inclusion of `reconciled_at` timestamps and a "No items found" safety layer to ensure the export feels like a finished product, not a debug log.

---

## 🛠️ Feature 5: Real-Time Financial Aggregation
*   **What I asked AI**: "Show total amounts for each bucket on the dashboard."
*   **What I used**: The `useMemo` based filtering logic to keep calculations fast.
*   **What I modified/rejected**:
    *   *Modified*: Enforced **Absolute Value Aggregation** for bank transactions.
*   **Reasoning**: Bank statements often use negative numbers for debits. Showing a negative "Total Matched" value is confusing for users. I standardized the summary stats to show absolute magnitude while preserving the original polarity in the detail lists.

---

## 🛠️ Feature 5: CSV Cleansing Engine
*   **What I asked AI:** "Write a robust CSV parser for messy bank data."
*   **What I used:** The regex-based date normalization and amount sanitization.
*   **What I modified/rejected:**
    *   *Modified*: Added a **Header Fuzzy Matcher**.
*   **Reasoning:** Different banks use different column names (e.g., "Date" vs "TransactionDate"). The fuzzy matcher ensures the tool works out-of-the-box for most statement formats.

---

## 🧠 Reflection on AI Pair Programming
AI was instrumental in scaffolding complex boilerplate (OAuth, SQL schemas) and generating high-fidelity UI components. However, human intervention was critical for **business logic integrity** (clash detection, audit trails) and **UX calibration** (responsiveness, theme consistency).
