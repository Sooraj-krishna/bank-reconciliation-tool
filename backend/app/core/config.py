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
_origins_env = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [origin.strip() for origin in _origins_env.split(",") if origin.strip()]

# Frontend base URL — used to redirect users back after OAuth completes
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Xero OAuth2 application credentials — registered at https://developer.xero.com
XERO_CLIENT_ID = os.getenv("XERO_CLIENT_ID")
XERO_CLIENT_SECRET = os.getenv("XERO_CLIENT_SECRET")
XERO_REDIRECT_URI = os.getenv("XERO_REDIRECT_URI")
