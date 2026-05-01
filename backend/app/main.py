from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import ALLOWED_ORIGINS

# 1. Start the engine
app = FastAPI()

# 2. Open the gate for React (Security)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,           # Explicit allowed origins (empty list blocks CORS)
    allow_methods=["*"],                     # Allow all actions (GET, POST)
    allow_headers=["*"],                     # Allow all extra data
)

# 3. Main greeting page
@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}

# 4. Check if the server is healthy
@app.get("/health")
def health():
    return {"status": "ok"}