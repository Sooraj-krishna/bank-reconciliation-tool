"""
Xero Service
------------
Handles all direct communication with the Xero API, including:
- Token refresh logic (Access Token renewal)
- Fetching tenant/organisation details
- Retrieving invoice data
"""

import requests
import threading
from app.core.config import XERO_CLIENT_ID, XERO_CLIENT_SECRET
from app.services.token_store import get_tokens, store_tokens, is_token_expired

# Global lock to prevent race conditions during token refresh
# If multiple requests try to refresh the same token simultaneously,
# one will succeed and the others will fail (as the refresh_token is rotated).
refresh_lock = threading.Lock()

def refresh_access_token(session_id: str) -> dict | None:
    """
    Exchanges a refresh_token for a new access_token/refresh_token pair.
    
    Xero uses rotating refresh tokens; once a new pair is issued, the 
    old refresh_token becomes invalid. This is why we use a thread lock.
    """
    # 1. Thread Safety: Acquire the lock before checking/refreshing
    with refresh_lock:
        # 2. Fetch the latest entry from the DB (another thread might have just updated it)
        token_entry = get_tokens(session_id)
        if not token_entry:
            return None

        # 3. Double-Check: If it's no longer expired, someone else fixed it while we waited
        if not is_token_expired(token_entry):
            return token_entry

        print(f"TRACE: Token expired for session {session_id}, attempting refresh...", flush=True)
        
        # 4. API Request: Call Xero's token endpoint with the refresh_token grant type
        token_url = "https://identity.xero.com/connect/token"
        try:
            resp = requests.post(
                token_url,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": token_entry["refresh_token"],
                },
                # Auth with our application credentials
                auth=(XERO_CLIENT_ID, XERO_CLIENT_SECRET),
            )

            # 5. Handle Failure: If 400/401, the refresh_token might be revoked or already used
            if resp.status_code != 200:
                print(f"ERROR: Token refresh failed for {session_id}: {resp.text}", flush=True)
                return None

            # 6. Success: Parse the new payload and persist it back to the database
            new_token_data = resp.json()
            store_tokens(session_id, new_token_data)
            
            # 7. Return the updated entry
            return get_tokens(session_id)
            
        except Exception as e:
            print(f"ERROR: Exception during token refresh: {str(e)}", flush=True)
            return None

def get_valid_tokens(session_id: str) -> dict | None:
    """
    High-level helper to get a working token entry.
    Checks for expiry and triggers an automatic refresh if needed.
    """
    # 1. Fetch current entry
    token_entry = get_tokens(session_id)
    if not token_entry:
        return None

    # 2. Logic: If expired, trigger the refresh flow (lock-protected)
    if is_token_expired(token_entry):
        return refresh_access_token(session_id)
    
    # 3. Otherwise return as-is
    return token_entry

def fetch_invoices(session_id: str, limit: int = 100) -> list:
    """
    Fetches the list of invoices from the connected Xero organisation.
    
    Only retrieves 'AUTHORISED' and 'SUBMITTED' invoices (Accounts Receivable)
    to match against incoming bank payments.
    """
    # 1. Authentication: Get a valid access token (refreshed if necessary)
    token_entry = get_valid_tokens(session_id)
    if not token_entry:
        raise Exception("No valid Xero session. Please reconnect to Xero.")

    # 2. Header Construction: Bearer token + the specific Xero-Tenant-Id
    headers = {
        "Authorization": f"Bearer {token_entry['access_token']}",
        "Xero-Tenant-Id": token_entry["tenant_id"],
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # 3. API Request: Fetch Invoices endpoint
    # We filter for AR (Accounts Receivable) invoices that are not yet paid/voided
    # Note: Xero uses OData-like filters in the 'where' parameter
    invoices_url = "https://api.xero.com/api.xro/2.0/Invoices"
    params = {
        "where": 'Type=="ACCRECV" AND (Status=="AUTHORISED" OR Status=="SUBMITTED")',
        "order": "Date DESC"
    }

    try:
        resp = requests.get(invoices_url, headers=headers, params=params)
        
        # 4. Handle Unauthorized: If we hit a 401 even with a 'valid' token, 
        # force one more refresh and retry (Edge case: token revoked manually)
        if resp.status_code == 401:
            token_entry = refresh_access_token(session_id)
            if token_entry:
                headers["Authorization"] = f"Bearer {token_entry['access_token']}"
                resp = requests.get(invoices_url, headers=headers, params=params)

        # 5. Final Check: If still failing, raise error
        if resp.status_code != 200:
            raise Exception(f"Xero API Error: {resp.status_code} - {resp.text}")

        # 6. Parse: Extract the list of invoices from the root 'Invoices' key
        return resp.json().get("Invoices", [])
        
    except Exception as e:
        raise Exception(f"Failed to fetch invoices: {str(e)}")
