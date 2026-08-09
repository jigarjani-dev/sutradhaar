"""
One-time interactive Gmail OAuth consent -- no CLI binary, just this script.

Prerequisite: download the OAuth client JSON (type: Desktop app) from Google
Cloud Console and save it to ./data/credentials/gmail_client_secret.json
(mounted into the container at /app/data/credentials/).

Run with port 8765 published so your host browser can reach the local OAuth
callback running inside the container:

    docker compose run --rm -p 8765:8765 gateway \\
        python -m gateway.mcp_servers.gmail_auth_setup

Writes the refresh token to ./data/credentials/gmail_token.json. The MCP
server reads it from there on every call and refreshes it silently -- no
browser needed again unless you revoke access.

Note: this hand-rolls the local callback server instead of using
google-auth-oauthlib's InstalledAppFlow.run_local_server(), which serves
exactly one request and gives up. Docker Desktop's port-forwarding proxy
(macOS/Windows) can deliver a benign probe connection the first time a
freshly published port is hit, which that single handle_request() call
consumes -- stranding the real OAuth callback and timing out. Looping
handle_request() until we actually see `code=` tolerates that probe.
"""
import sys
import wsgiref.simple_server
import wsgiref.util

from google_auth_oauthlib.flow import InstalledAppFlow

from gateway.mcp_servers.gmail_credentials import SCOPES, client_secret_path, token_path

PORT = 8765
MAX_ATTEMPTS = 30


class _RedirectApp:
    """Minimal WSGI app: captures the callback URL, ignores anything else."""

    def __init__(self):
        self.request_uri = None

    def __call__(self, environ, start_response):
        start_response("200 OK", [("Content-type", "text/plain; charset=utf-8")])
        uri = wsgiref.util.request_uri(environ)
        if "code=" in uri:
            self.request_uri = uri
        return [b"Authentication complete. You may close this window."]


def main():
    secret_path = client_secret_path()
    if not secret_path.exists():
        print(
            f"Missing {secret_path}.\n"
            "Download the OAuth client JSON (Desktop app type) from Google "
            "Cloud Console (APIs & Services > Credentials) and save it there."
        )
        sys.exit(1)

    flow = InstalledAppFlow.from_client_secrets_file(str(secret_path), SCOPES)
    flow.redirect_uri = f"http://localhost:{PORT}/"

    auth_url, _ = flow.authorization_url()
    print("Open this URL on your host machine and approve access:")
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

    out_path = token_path()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(flow.credentials.to_json(), encoding="utf-8")
    print(f"Saved Gmail token to {out_path}. Restart the gateway to pick it up.")


if __name__ == "__main__":
    main()
