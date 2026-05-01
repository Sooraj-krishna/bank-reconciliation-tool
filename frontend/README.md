# 💳 Bank-to-Books Reconciliation Tool

A full-stack application that automates the reconciliation of bank transactions with accounting records using **React**, **FastAPI**, and integration with **Xero**.

---

## 🚀 Overview

Manual reconciliation is time-consuming and error-prone. This tool streamlines the process by:

* Importing bank transactions (CSV)
* Fetching accounting data from Xero
* Automatically matching transactions
* Highlighting unmatched and partially matched records
* Providing a clear and interactive UI for review

---

## 🧠 Key Features

* 🔗 **Xero OAuth Integration** (secure authentication)
* 📄 **CSV Upload & Parsing**
* 🤖 **Automated Matching Engine**
* 📊 **Match Classification**

  * Matched
  * Possible Matches
  * Unmatched
* ⚠️ **Error Handling System**
* 🎨 **Modern UI with Tailwind CSS**
* 🔄 **Real-time frontend ↔ backend communication**

---

## 🏗️ Tech Stack

### Frontend

* React (Vite)
* Tailwind CSS
* Axios

### Backend

* FastAPI
* Python
* Requests (for API calls)
* python-dotenv

### External Integration

* Xero API (OAuth 2.0)

---

## 📂 Project Structure

```
bank-reconciliation-tool/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── core/
│   │   ├── services/
│   │   ├── models/
│   │   └── utils/
│   ├── .env
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.jsx
│
├── STANDUP.md
└── README.md
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repository

```bash
git clone <your-repo-url>
cd bank-reconciliation-tool
```

---

### 2️⃣ Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Linux/Mac
venv\Scripts\activate      # Windows

pip install -r requirements.txt
```

#### Create `.env`

```
DATABASE_URL=sqlite:///./app.db
SECRET_KEY=your_secret_key

XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=http://localhost:8000/auth/callback
```

#### Run Backend

```bash
uvicorn app.main:app --reload
```

---

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 OAuth Flow (Xero)

1. User clicks **Connect to Xero**
2. Redirected to Xero login
3. User grants permission
4. Xero redirects back with authorization code
5. Backend exchanges code for access token

---

## 🧪 Current Progress

### ✅ Day 1

* Project setup (Frontend + Backend)
* API communication established
* CORS configured
* Tailwind UI implemented
* Reusable error handling component

### 🔄 Day 2 (In Progress)

* Xero OAuth integration

---

## 📌 Future Enhancements

* CSV upload & parsing
* Matching engine (confidence-based logic)
* Transaction dashboard
* Persistent storage (PostgreSQL)
* Token management & refresh handling
* Improved UI (filters, tables, charts)

---

## ⚠️ Challenges Faced

* CORS issues during frontend-backend communication
* Tailwind CSS version conflicts (v4 vs v3)
* React Strict Mode causing duplicate API calls

---

## 🧠 Learnings

* Real-world API integration (OAuth 2.0)
* Debugging environment and dependency issues
* Structuring scalable full-stack applications
* Building reusable UI components

---

## 📬 Submission

* GitHub repository will be shared after completion
* Daily updates maintained in `STANDUP.md`

---

## 👨‍💻 Author

Sooraj
(Full Stack Developer | React | FastAPI | Python)

---
