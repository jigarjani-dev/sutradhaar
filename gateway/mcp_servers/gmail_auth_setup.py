"""
One-time interactive Gmail OAuth consent -- no CLI binary, just this script.

Prerequisite: download the OAuth client JSON (type: Desktop app) from Google
Cloud Console and save it to ./data/credentials/google_client_secret.json
(mounted into the container at /app/data/credentials/). Shared with Sheets
-- same Cloud project/client, different scopes and token file.

Run with port 8765 published so your host browser can reach the local OAuth
callback running inside the container:

    docker compose run --rm -p 8765:8765 gateway \\
        python -m gateway.mcp_servers.gmail_auth_setup

Writes the refresh token to ./data/credentials/gmail_token.json. The MCP
server reads it from there on every call and refreshes it silently -- no
browser needed again unless you revoke access.
"""
from gateway.mcp_servers.gmail_credentials import SCOPES, TOKEN_PATH
from gateway.mcp_servers.google_oauth import run_interactive_consent

if __name__ == "__main__":
    run_interactive_consent(SCOPES, TOKEN_PATH, "Gmail")
