"""
Token Store Service

Provides a simple file-based persistence layer for Xero OAuth2 tokens.
Tokens are stored as JSON in `data/tokens.json`, keyed by a session ID.
This module handles CRUD operations (store, retrieve, list, delete) and
token-expiry checking so the rest of the application can work with
authenticated Xero sessions without managing the raw file I/O.
"""

import os
import json
import uuid
from datetime import datetime, timedelta

# Resolve the path to the token storage file relative to this module's location.
# The file lives at <project_root>/data/tokens.json
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "tokens.json")

# Ensure the `data/` directory exists so that writes do not fail on first run
os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)


def _load_tokens():
    """
    Read the token store from disk and return it as a dictionary.

    Returns an empty dict if the file does not yet exist (first run).
    """
    if not os.path.exists(TOKEN_FILE):
        return {}
    with open(TOKEN_FILE, "r") as f:
        return json.load(f)


def _save_tokens(store):
    """
    Write the given token dictionary to disk as formatted JSON.

    `indent=2` makes the file human-readable for debugging.
    """
    with open(TOKEN_FILE, "w") as f:
        json.dump(store, f, indent=2)


def store_tokens(session_id, token_data):
    """
    Persist a Xero token payload under the given session ID.

    Enriches the raw token data with server-side timestamps:
      - `created_at` — when the token was received (ISO 8601)
      - `expires_at` — calculated from `expires_in`; the point after which
        the access token is no longer valid and a refresh is required.

    Returns the session ID so the caller can set it as a cookie.
    """
    store = _load_tokens()
    store[session_id] = {
        "access_token": token_data.get("access_token"),
        "refresh_token": token_data.get("refresh_token"),
        "expires_in": token_data.get("expires_in"),
        "scope": token_data.get("scope"),
        "token_type": token_data.get("token_type"),
        "id_token": token_data.get("id_token"),
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 1800))).isoformat(),
    }
    _save_tokens(store)
    return session_id


def get_tokens(session_id):
    """
    Retrieve the token entry for a specific session ID.

    Returns None if the session does not exist.
    """
    store = _load_tokens()
    return store.get(session_id)


def get_all_sessions():
    """
    Return the entire token store (all sessions).

    Useful for admin dashboards or session management endpoints.
    """
    return _load_tokens()


def delete_session(session_id):
    """
    Remove a session from the token store.

    Returns True if the session was found and deleted, False otherwise.
    """
    store = _load_tokens()
    if session_id in store:
        del store[session_id]
        _save_tokens(store)
        return True
    return False


def is_token_expired(token_entry):
    """
    Check whether a token entry has passed its expiration time.

    Compares the stored `expires_at` timestamp against the current UTC time.
    Returns True if the token is missing, has no entry, or is past expiry.
    """
    if not token_entry:
        return True
    expires_at = datetime.fromisoformat(token_entry["expires_at"])
    return datetime.utcnow() >= expires_at
