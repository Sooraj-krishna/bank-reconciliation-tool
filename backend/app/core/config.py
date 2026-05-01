# This file is responsible for loading environment variables

import os
from dotenv import load_dotenv

# Load variables from .env file into system environment
load_dotenv()

# Read values using os.getenv()
DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")
# Parse comma-separated origins string into a list (e.g. "http://localhost:3000,https://example.com")
_origins_env = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [origin.strip() for origin in _origins_env.split(",") if origin.strip()]