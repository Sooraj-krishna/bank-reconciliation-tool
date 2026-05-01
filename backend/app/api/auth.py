from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
import requests
from app.core.config import (
    XERO_CLIENT_ID,
    XERO_CLIENT_SECRET,
    XERO_REDIRECT_URI
)

router = APIRouter()


# 🔹 STEP 1: Redirect user to Xero
@router.get("/login")
def login():
    url = (
        "https://login.xero.com/identity/connect/authorize?"
        f"response_type=code"
        f"&client_id={XERO_CLIENT_ID}"
        f"&redirect_uri={XERO_REDIRECT_URI}"
        f"&scope=openid profile email accounting.transactions offline_access"
    )

    return RedirectResponse(url)


# 🔹 STEP 2: Handle callback
@router.get("/callback")
def callback(code: str):

    token_url = "https://identity.xero.com/connect/token"

    try:
        response = requests.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": XERO_REDIRECT_URI,
            },
            auth=(XERO_CLIENT_ID, XERO_CLIENT_SECRET),
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=response.text
            )

        data = response.json()

        # 🔥 TEMP: return tokens (later we store securely)
        return data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))