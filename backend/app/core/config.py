# This file is responsible for loading environment variables

import os
from dotenv import load_dotenv

# Load variables from .env file into system environment
load_dotenv()

# Read values using os.getenv()
DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS")