import os
import sys

from mangum import Mangum

# Make `backend/` importable so we can reuse the existing FastAPI app.
_REPO_ROOT = os.path.dirname(os.path.dirname(__file__))
_BACKEND_DIR = os.path.join(_REPO_ROOT, "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.main import app  # noqa: E402

# Vercel serverless entry point — wraps the ASGI FastAPI app.
handler = Mangum(app)

