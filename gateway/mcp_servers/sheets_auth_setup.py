"""
One-time interactive Sheets OAuth consent -- no CLI binary, just this script.

Reuses the same OAuth client as Gmail (./data/credentials/gmail_client_secret.json)
-- same Cloud project, different requested scopes -- so if Gmail is already
set up, no new Cloud Console work is needed here beyond confirming the
Sheets and Drive APIs are enabled on that project.

Run with port 8765 published so your host browser can reach the local OAuth
callback running inside the container:

    docker compose run --rm -p 8765:8765 gateway \\
        python -m gateway.mcp_servers.sheets_auth_setup

Writes the refresh token to ./data/credentials/sheets_token.json.
"""
from gateway.mcp_servers.google_oauth import run_interactive_consent
from gateway.mcp_servers.sheets_credentials import SCOPES, TOKEN_PATH

if __name__ == "__main__":
    run_interactive_consent(SCOPES, TOKEN_PATH, "Sheets")
