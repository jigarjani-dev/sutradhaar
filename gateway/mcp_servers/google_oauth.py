"""
Shared Google OAuth plumbing: client-secret path, token load/refresh, and
the one-time interactive consent flow.

One Cloud project / OAuth client backs every Google MCP server here (Gmail,
Sheets, ...). Each service requests its own scopes and keeps its own token
file -- see gmail_credentials.py / sheets_credentials.py -- but they all
point at the same registered app, so there's only one client_secret.json.
"""
import sys
import wsgiref.simple_server
import wsgiref.util
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

from gateway.config import settings

PORT = 8765
MAX_ATTEMPTS = 30


def client_secret_path() -> Path:
    return Path(settings.google_client_secret_file)


def load_credentials(scopes: list[str], token_path: Path, setup_module: str) -> Credentials:
    """Load a saved token, silently refreshing it if expired.

    Raises RuntimeError if the one-time interactive setup hasn't run yet.
    """
    if not token_path.exists():
        raise RuntimeError(
            f"No token at {token_path}. Run the one-time setup: "
            f"docker compose run --rm -p 8765:8765 gateway python -m {setup_module}"
        )
    creds = Credentials.from_authorized_user_file(str(token_path), scopes)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token_path.write_text(creds.to_json(), encoding="utf-8")
    return creds


class _RedirectApp:
    """Minimal WSGI app: captures the OAuth callback URL, ignores anything else."""

    def __init__(self):
        self.request_uri = None

    def __call__(self, environ, start_response):
        start_response("200 OK", [("Content-type", "text/plain; charset=utf-8")])
        uri = wsgiref.util.request_uri(environ)
        if "code=" in uri:
            self.request_uri = uri
        return [b"Authentication complete. You may close this window."]


def run_interactive_consent(scopes: list[str], token_path: Path, label: str) -> None:
    """One-time interactive OAuth consent. Run inside the gateway container
    with port 8765 published so the host browser can reach the local
    callback -- see README "Connecting Real Services".

    Hand-rolls the callback server instead of using InstalledAppFlow's
    run_local_server(), which serves exactly one request and gives up.
    Docker Desktop's port-forwarding proxy (macOS/Windows) can deliver a
    benign probe connection the first time a freshly published port is hit,
    which that single handle_request() call consumes -- stranding the real
    OAuth callback and timing out. Looping handle_request() until we
    actually see `code=` tolerates that probe.
    """
    secret_path = client_secret_path()
    if not secret_path.exists():
        print(
            f"Missing {secret_path}.\n"
            "Download the OAuth client JSON (Desktop app type) from Google "
            "Cloud Console (APIs & Services > Credentials) and save it there."
        )
        sys.exit(1)

    flow = InstalledAppFlow.from_client_secrets_file(str(secret_path), scopes)
    flow.redirect_uri = f"http://localhost:{PORT}/"

    auth_url, _ = flow.authorization_url()
    print(f"Open this URL on your host machine and approve {label} access:")
    print(auth_url)

    app = _RedirectApp()
    server = wsgiref.simple_server.make_server("0.0.0.0", PORT, app)
    attempts = 0
    while app.request_uri is None and attempts < MAX_ATTEMPTS:
        server.handle_request()
        attempts += 1
    server.server_close()

    if app.request_uri is None:
        print(f"Never received the OAuth callback after {MAX_ATTEMPTS} connections -- "
              "open the URL above and try again.")
        sys.exit(1)

    # oauthlib insists the callback look like it came over https.
    flow.fetch_token(authorization_response=app.request_uri.replace("http://", "https://"))

    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(flow.credentials.to_json(), encoding="utf-8")
    print(f"Saved {label} token to {token_path}. Restart the gateway to pick it up.")
