"""
Shared Gmail OAuth config: scopes, credential file paths, token refresh.

Used by both the one-time interactive setup (gmail_auth_setup.py) and the
Gmail MCP server (gmail_mcp.py). No external CLI -- just the official
Google API Python client libraries (see requirements.txt).
"""
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

from gateway.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]


def client_secret_path() -> Path:
    return Path(settings.gmail_client_secret_file)


def token_path() -> Path:
    return Path(settings.gmail_token_file)


def load_credentials() -> Credentials:
    """Load the saved token, silently refreshing it if expired.

    Raises RuntimeError if the one-time interactive setup hasn't run yet.
    """
    path = token_path()
    if not path.exists():
        raise RuntimeError(
            f"No Gmail token at {path}. Run the one-time setup: "
            "docker compose run --rm -p 8765:8765 gateway "
            "python -m gateway.mcp_servers.gmail_auth_setup"
        )
    creds = Credentials.from_authorized_user_file(str(path), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        path.write_text(creds.to_json(), encoding="utf-8")
    return creds
