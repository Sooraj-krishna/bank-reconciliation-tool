"""
Xero OAuth2 Authentication Router

Handles the two-step OAuth2 authorization code flow with Xero:
1. /auth/login  — redirects the user to Xero's consent screen
2. /auth/callback — receives the authorization code, exchanges it for
   access/refresh tokens, stores the tokens server-side, and sets an
   httponly session cookie so subsequent API calls can be authenticated.
"""

from fastapi import APIRouter, HTTPException, Request, Response, Cookie
from fastapi.responses import RedirectResponse, JSONResponse
import requests
from urllib.parse import urlencode
from app.core.config import (
    XERO_CLIENT_ID,
    XERO_CLIENT_SECRET,
    XERO_REDIRECT_URI,
    FRONTEND_URL
)
from app.services.token_store import store_tokens, get_tokens
from app.services.xero_service import get_valid_tokens

router = APIRouter()


@router.get("/login")
def login(request: Request):
    """
    Initiate the Xero OAuth2 authorization flow.

    Builds the Xero authorization URL with the required scopes
    (OpenID, profile, email, accounting transactions, and offline access
    for refresh tokens) and redirects the user's browser to Xero's
    consent screen.
    """
    if not XERO_CLIENT_ID or not XERO_REDIRECT_URI:
        raise HTTPException(
            status_code=500,
            detail="Missing Xero config: set XERO_CLIENT_ID and XERO_REDIRECT_URI in environment.",
        )

    # OAuth2 parameters required by Xero's identity provider
    params = {
        "response_type": "code",           # Request an authorization code
        "client_id": XERO_CLIENT_ID,       # Application identifier registered in Xero
        "redirect_uri": XERO_REDIRECT_URI, # Where Xero sends the user after consent
        "scope": "openid profile email accounting.invoices accounting.payments accounting.banktransactions accounting.settings offline_access",
    }

    # Construct the full Xero authorization URL
    url = "https://login.xero.com/identity/connect/authorize?" + urlencode(params)

    return RedirectResponse(url)


@router.get("/callback")
def callback(
    response: Response,
    code: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    """
    Handle the redirect back from Xero after user consent.

    If the user denied access or an error occurred, raise an HTTPException
    with the error details. Otherwise, exchange the authorization code for
    tokens via Xero's token endpoint, persist the tokens in the local token
    store, and set an httponly session cookie so the frontend can identify
    the session on future requests.
    """
    # Xero redirects here with an `error` query param if the user denied access
    if error:
        raise HTTPException(
            status_code=400,
            detail={
                "error": error,
                "error_description": error_description,
            },
        )

    # The authorization code is required to proceed with the token exchange
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code from Xero callback.")

    token_url = "https://identity.xero.com/connect/token"

    try:
        # POST to Xero's token endpoint to exchange the authorization code for access/refresh tokens
        resp = requests.post(
            token_url,
            data={
                "grant_type": "authorization_code",  # OAuth2 grant type for the code flow
                "code": code,                        # Authorization code received from Xero
                "redirect_uri": XERO_REDIRECT_URI,   # Must match the URI used in the /login step
            },
            auth=(XERO_CLIENT_ID, XERO_CLIENT_SECRET),  # HTTP Basic Auth with client credentials
        )

        # If Xero returns a non-200 status, surface the raw error text
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=resp.text)

        token_data = resp.json()

        # Persist the token payload in the server-side token store; returns a session identifier
        import uuid
        session_id = str(uuid.uuid4())
        store_tokens(session_id, token_data)

        # Redirect to the frontend after successful authentication
        redir = RedirectResponse(url=f"{FRONTEND_URL}/dashboard", status_code=302)
        
        # Set an httponly, secure cookie so the session ID travels on every subsequent request
        # and cannot be accessed by client-side JavaScript (mitigates XSS token theft)
        redir.set_cookie(
            key="xero_session_id",
            value=session_id,
            httponly=True,     # Prevent JavaScript access
            secure=FRONTEND_URL.startswith("https"),  # Only secure in production (HTTPS)
            samesite="lax",    # Protects against CSRF while allowing top-level GET navigation
            max_age=token_data.get("expires_in", 1800),  # Cookie expires with the token
        )

        return redir

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session")
def check_session(xero_session_id: str = Cookie(None)):
    """
    Check if the current session is valid and not expired.
    Returns session status without exposing token details.
    """
    if not xero_session_id:
        return {"connected": False}

    # Retrieve tokens and automatically refresh if expired
    tokens = get_valid_tokens(xero_session_id)
    if not tokens:
        return {"connected": False}

    return {"connected": True}


@router.get("/logout")
def logout(response: Response, xero_session_id: str = Cookie(None)):
    """
    Clear the Xero session.
    Deletes the session from the database and removes the session cookie.
    """
    if xero_session_id:
        from app.services.token_store import delete_session
        delete_session(xero_session_id)
        
    response.delete_cookie(
        key="xero_session_id",
        httponly=True,
        samesite="lax",
    )
    return {"message": "Logged out successfully"}
