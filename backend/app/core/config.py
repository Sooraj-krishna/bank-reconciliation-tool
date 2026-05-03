"""
Application Configuration

Central place for loading and exposing environment variables used
throughout the application. Reads from a `.env` file (via python-dotenv)
and falls back to the system environment. All configuration values are
exported as module-level constants so they can be imported directly
wherever needed.
"""

import os
from dotenv import load_dotenv

# Load key-value pairs from the `.env` file (if present) into os.environ
load_dotenv()

# Database connection string (e.g. postgresql://user:pass@host:5432/db)
DATABASE_URL = os.getenv("DATABASE_URL")

# Secret key used for signing session cookies, JWTs, or other cryptographic operations
SECRET_KEY = os.getenv("SECRET_KEY")

# Parse the comma-separated ALLOWED_ORIGINS string into a Python list.
# Example: "http://localhost:3000,https://example.com" → ["http://localhost:3000", "https://example.com"]
# Also includes common localhost ports for development (5173 for Vite, 3000 for CRA, etc.)
_origins_env = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [origin.strip() for origin in _origins_env.split(",") if origin.strip()]

# Add localhost origins for development if not already present
_localhost_origins = [
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",
    "http://localhost:3000",  # Alternative React port
    "http://localhost:8000",  # Backend itself (for testing)
]
for origin in _localhost_origins:
    if origin not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(origin)

# Support Vercel preview deployments (e.g., project-git-branch.vercel.app)
# This is handled by allow_origin_regex in main.py, but we can also add common patterns here
# The actual regex is: r"https://.*\.vercel\.app$"

# Xero OAuth2 application credentials — registered at https://developer.xero.com
XERO_CLIENT_ID = os.getenv("XERO_CLIENT_ID")
XERO_CLIENT_SECRET = os.getenv("XERO_CLIENT_SECRET")
XERO_REDIRECT_URI = os.getenv("XERO_REDIRECT_URI")

# Frontend base URL — used for post-OAuth redirect
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
