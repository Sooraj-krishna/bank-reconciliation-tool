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

# Database connection string
# Default to local SQLite for development. 
# In production, Render provides a DATABASE_URL starting with 'postgres://', 
# which we convert to 'postgresql://' for SQLAlchemy compatibility.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

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

# Xero OAuth2 Scopes — defining the permissions requested by the application.
# These are kept here as application configuration rather than environment variables,
# as they represent the fixed capabilities required by the app.
XERO_SCOPES = [
    "openid",
    "profile",
    "email",
    "accounting.invoices",
    "accounting.payments",
    "accounting.banktransactions",
    "accounting.settings",
    "offline_access",
]

# Reconciliation Engine Thresholds
# These constants control the matching logic between bank transactions and Xero invoices.
RECON_AUTO_MATCH_THRESHOLD = 85       # Score required to automatically categorize as a match
RECON_POSSIBLE_MATCH_THRESHOLD = 60   # Minimum score to be considered a possible match
RECON_DATE_DIFF_HIGH_CONFIDENCE = 3    # Max days difference for Level 2 (High confidence)
RECON_DATE_DIFF_MEDIUM_CONFIDENCE = 5  # Max days difference for Level 3 (Medium confidence)
RECON_AMOUNT_DIFF_PERCENTAGE = 0.01    # Max amount difference (1%) for fuzzy matching
RECON_SCORE_LEVEL_2 = 85               # Score for exact amount + date within high proximity
RECON_SCORE_LEVEL_3 = 60               # Score for fuzzy amount + date within medium proximity
RECON_SCORE_STRONG_POSSIBLE = 75       # Score for exact amount + exact reference match
RECON_SCORE_CONTACT_ONLY = 65          # Score when only the contact name matches
RECON_SCORE_CONTEXT_BOOST = 10         # Points added when contact name matches in description

# CSV Parsing Aliases
# These help the engine automatically identify columns in messy bank CSVs.
CSV_DATE_ALIASES = ["date", "posted", "txn date", "transaction date", "posted date"]
CSV_DESC_ALIASES = ["description", "particulars", "narrative", "details", "memo", "narration"]
CSV_REF_ALIASES = ["reference", "ref", "ref number", "invoice", "inv #", "cheque"]
CSV_DEBIT_ALIASES = ["debit", "withdrawal", "dr", "paid out", "out"]
CSV_CREDIT_ALIASES = ["credit", "deposit", "cr", "paid in", "in"]
CSV_BALANCE_ALIASES = ["balance", "bal", "running", "closing", "opening", "carry forward"]
CSV_AMOUNT_PRIORITY_ALIASES = ["net amount", "total", "amount", "amt", "value"]

# Session & Security Settings
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days in seconds
