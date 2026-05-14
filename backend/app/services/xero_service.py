"""
Xero Service

Handles all Xero API interactions including:
- Token refresh when expired
- Fetching invoices from Xero API
- Error handling with friendly messages
"""
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.core.config import XERO_CLIENT_ID, XERO_CLIENT_SECRET
from app.services.token_store import get_tokens, store_tokens, is_token_expired

import threading

# Global lock to prevent parallel token refreshes for the same session
_refresh_lock = threading.Lock()

def get_resilient_session():
    """
    Creates a requests session with automatic retry logic for production stability.
    
    RESILIENCE STRATEGY:
    - Retries: 3 attempts if the server is busy or failing.
    - Backoff: Waits 1s, 2s, 4s between attempts (exponential).
    - Triggers: Handles 429 (Rate Limit), 500, 502, 503, 504.
    """
    session = requests.Session()
    retry_strategy = Retry(
        total=3, # Max 3 retries
        backoff_factor=1, # Wait 1s, 2s, 4s between retries
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS", "POST"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

def get_valid_tokens(session_id: str, db: Session = None) -> dict | None:
    """
    Retrieve tokens and automatically refresh if expired.
    Thread-safe to prevent multi-refresh race conditions.
    """
    with _refresh_lock:
        token_entry = get_tokens(session_id, db=db)
        if not token_entry:
            return None
        
        # Automatically refresh if the token is within its 1-minute expiry window
        if is_token_expired(token_entry):
            return refresh_access_token(session_id, token_entry, db=db)
        
        return token_entry

def refresh_access_token(session_id: str, token_entry: dict, db: Session = None) -> dict | None:
    """
    Use the refresh_token to get a new access_token from Xero's Identity service.
    """
    refresh_token = token_entry.get("refresh_token")
    if not refresh_token:
        return None
    
    token_url = "https://identity.xero.com/connect/token"
    session = get_resilient_session()
    
    try:
        resp = session.post(
            token_url,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            auth=(XERO_CLIENT_ID, XERO_CLIENT_SECRET),
        )
        
        if resp.status_code != 200:
            return None
        
        new_token_data = resp.json()
        # Preserve old refresh_token if Xero doesn't rotate it
        if "refresh_token" not in new_token_data:
            new_token_data["refresh_token"] = refresh_token
        
        store_tokens(session_id, new_token_data, db=db)
        return get_tokens(session_id, db=db)
    except Exception:
        return None

def get_xero_headers(token_entry: dict) -> dict:
    """Build authorization headers for Xero API requests."""
    return {
        "Authorization": f"Bearer {token_entry['access_token']}",
        "Accept": "application/json",
    }

def fetch_invoices(session_id: str, limit: int = 100, db: Session = None) -> list:
    """
    Fetch invoices from Xero API with retry resilience.
    Uses exponential backoff to handle 429 Rate Limits and 5xx Server Errors.
    """
    # 1. Retrieve the persistent Xero token associated with this user session
    token_entry = get_valid_tokens(session_id, db=db)
    if not token_entry:
        raise Exception("No valid Xero session. Please reconnect.")
    
    # 2. Initialize a resilient HTTP session (built-in retries)
    session = get_resilient_session()
    headers = get_xero_headers(token_entry)
    
    # 3. Retrieve the Tenant ID (Xero requires this for all organisation-scoped data)
    tenants_url = "https://api.xero.com/connections"
    tenants_resp = session.get(tenants_url, headers=headers)
    
    if tenants_resp.status_code != 200:
        raise Exception("Failed to get Xero tenant connection.")
    
    tenants = tenants_resp.json()
    if not tenants:
        raise Exception("No Xero organisations found.")
    
    # Use the first organisation connected to this session
    tenant_id = tenants[0]["tenantId"]
    headers["Xero-Tenant-Id"] = tenant_id
    
    # 4. Fetch invoices (paginated to ensure high performance)
    invoices_url = f"https://api.xero.com/api.xro/2.0/Invoices?page=1&pageSize={limit}"
    invoices_resp = session.get(invoices_url, headers=headers)
    
    if invoices_resp.status_code != 200:
        raise Exception(f"Xero API Error: {invoices_resp.status_code}")
    
    # Return the raw list of Xero Invoice objects
    data = invoices_resp.json()
    return data.get("Invoices", [])
