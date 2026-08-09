"""
Gmail OAuth scopes + token file. Shared client-secret/refresh plumbing lives
in google_oauth.py.
"""
from pathlib import Path

from gateway.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]

TOKEN_PATH = Path(settings.gmail_token_file)
