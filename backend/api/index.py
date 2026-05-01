from app.main import app
from mangum import Mangum

# Vercel serverless entry point — wraps the ASGI FastAPI app
handler = Mangum(app)
