"""
Bank Reconciliation Tool - FastAPI Backend Entry Point

This module initializes the FastAPI application, configures CORS middleware
to allow the React frontend to communicate with the API, registers the
authentication router (Xero OAuth2 flow), and exposes basic health-check
endpoints.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import ALLOWED_ORIGINS
from app.core.database import engine, Base
from app.models import token
from app.api import auth, invoices

# Create the FastAPI application instance — this is the ASGI entry point
app = FastAPI()

# Create database tables on startup
Base.metadata.create_all(bind=engine)

# Mount the auth router under the /auth prefix so endpoints like
# /auth/login and /auth/callback are automatically registered
app.include_router(auth.router, prefix="/auth", tags=["Auth"])

# Mount the invoices router under /api prefix
app.include_router(invoices.router, prefix="/api", tags=["Invoices"])

# Attach CORS middleware so the React frontend (running on a different
# origin/port) can make cross-origin requests to this API.
# allow_origin_regex allows all vercel.app preview deployments dynamically.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,           # Explicit list of allowed frontend origins; an empty list blocks all CORS requests
    allow_origin_regex=r"https://.*\.vercel\.app$" if os.getenv("ALLOW_VERCEL_PREVIEWS") else None,
    allow_credentials=True,                   # Allow cookies to be sent cross-origin
    allow_methods=["*"],                     # Permit every HTTP method (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],                     # Accept any custom headers the client may send
)

@app.get("/")
def root():
    """Root endpoint — confirms the backend server is reachable."""
    return {"message": "Backend is running 🚀"}

@app.get("/health")
def health():
    """Health-check endpoint — used by load balancers or monitoring tools to verify the service is alive."""
    return {"status": "ok"}
