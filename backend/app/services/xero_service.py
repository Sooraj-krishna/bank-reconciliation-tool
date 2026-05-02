"""
Xero Service

Handles all Xero API interactions including:
- Token refresh when expired
- Fetching invoices from Xero API
- Error handling with friendly messages
"""
import requests
from datetime import datetime, timedelta
from app.core.config import XERO_CLIENT_ID, XERO_CLIENT_SECRET
from app.services.token_store import get_tokens, store_tokens, is_token_expired


def get_valid_tokens(session_id: str) -> dict | None:
    """
    Retrieve tokens and automatically refresh if expired.
    
    Returns token dict with valid access_token, or None if refresh fails.
    """
    token_entry = get_tokens(session_id)
    
    if not token_entry:
        return None
    
    # Check if token is expired (with 5-minute buffer)
    if is_token_expired(token_entry):
        return refresh_access_token(session_id, token_entry)
    
    return token_entry


def refresh_access_token(session_id: str, token_entry: dict) -> dict | None:
    """
    Use the refresh_token to get a new access_token from Xero.
    
    Updates the database with new tokens and returns the updated token entry.
    Returns None if refresh fails.
    """
    refresh_token = token_entry.get("refresh_token")
    
    if not refresh_token:
        return None
    
    token_url = "https://identity.xero.com/connect/token"
    
    try:
        resp = requests.post(
            token_url,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            auth=(XERO_CLIENT_ID, XERO_CLIENT_SECRET),
        )
        
        if resp.status_code != 200:
            # Refresh failed - token might be revoked
            return None
        
        new_token_data = resp.json()
        
        # Preserve old refresh_token if new one not provided
        if "refresh_token" not in new_token_data:
            new_token_data["refresh_token"] = refresh_token
        
        # Update database
        store_tokens(session_id, new_token_data)
        
        # Return updated tokens
        return get_tokens(session_id)
        
    except Exception:
        return None


def get_xero_headers(token_entry: dict) -> dict:
    """Build authorization headers for Xero API requests."""
    return {
        "Authorization": f"Bearer {token_entry['access_token']}",
        "Accept": "application/json",
    }


def fetch_invoices(session_id: str, limit: int = 100) -> list:
    """
    Fetch invoices from Xero API for the connected tenant.
    
    Automatically refreshes token if expired.
    Returns list of invoice dicts or empty list on error.
    """
    token_entry = get_valid_tokens(session_id)
    
    if not token_entry:
        raise Exception("No valid Xero session. Please reconnect to Xero.")
    
    headers = get_xero_headers(token_entry)
    
    # Fetch tenant ID from Xero (required for API calls)
    tenants_url = "https://api.xero.com/connections"
    tenants_resp = requests.get(tenants_url, headers=headers)
    
    if tenants_resp.status_code != 200:
        raise Exception("Failed to get Xero tenant. Please reconnect to Xero.")
    
    tenants = tenants_resp.json()
    if not tenants:
        raise Exception("No Xero organisations found. Please check your Xero connection.")
    
    tenant_id = tenants[0]["tenantId"]
    headers["Xero-Tenant-Id"] = tenant_id
    
    # Fetch invoices
    invoices_url = f"https://api.xero.com/api.xro/2.0/Invoices?page=1&pageSize={limit}"
    invoices_resp = requests.get(invoices_url, headers=headers)
    
    if invoices_resp.status_code != 200:
        raise Exception(f"Failed to fetch invoices from Xero: {invoices_resp.text}")
    
    data = invoices_resp.json()
    return data.get("Invoices", [])
