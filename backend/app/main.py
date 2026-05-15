"""
Bank Reconciliation Tool - FastAPI Backend Entry Point

This module initializes the FastAPI application, configures CORS middleware
to allow the React frontend to communicate with the API, registers the
authentication router (Xero OAuth2 flow), and exposes basic health-check
endpoints.
"""

import os
import time
from collections import defaultdict
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import ALLOWED_ORIGINS
from app.core.database import engine, Base
from app.models.token import Token
from app.models.bank_statement import BankStatement
from app.models.invoice import InvoiceCache
from app.api import auth, invoices, upload, reconciliation

# --- SaaS Rate Limiting Middleware ---
class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-memory rate limiter to protect the SaaS from abuse.
    Identifies visitors by IP and limits their request frequency.
    """
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        # Dictionary to store request timestamps per IP address
        self.visitor_records = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        """
        Intercepts every request to verify the rate limit hasn't been exceeded.
        """
        # Exclude health checks from rate limiting to allow load balancer monitoring
        if request.url.path in ["/health", "/"]:
            return await call_next(request)

        # Identify client IP - handles proxies (Render, Cloudflare, etc.) by checking X-Forwarded-For
        ip = request.headers.get("X-Forwarded-For", request.client.host).split(",")[0]
        now = time.time()
        
        # Prune request history older than 60 seconds to keep memory usage low
        self.visitor_records[ip] = [t for t in self.visitor_records[ip] if now - t < 60]
        
        # If the number of requests in the last minute exceeds the limit, block the user
        if len(self.visitor_records[ip]) >= self.requests_per_minute:
            return Response(
                content="Too many requests. Please wait a minute.",
                status_code=429
            )
            
        # Record the current request timestamp
        self.visitor_records[ip].append(now)
        return await call_next(request)

# Initialize FastAPI with a descriptive title for the SaaS API documentation
app = FastAPI(title="BankSync SaaS API")

# Register global middlewares in order of execution
# 1. Rate Limiting (Digital Bouncer)
app.add_middleware(RateLimitMiddleware, requests_per_minute=60)
# 2. CORS (Allows React frontend to talk to this API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app$" if os.getenv("ALLOW_VERCEL_PREVIEWS") else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables on startup
Base.metadata.create_all(bind=engine)

# Register Routers
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(invoices.router, prefix="/api", tags=["Invoices"])
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(reconciliation.router, prefix="/api", tags=["Reconciliation"])

@app.get("/")
def root():
    return {"message": "BankSync API is running 🚀"}

@app.get("/health")
def health():
    return {"status": "ok"}
