"""
Sheets OAuth scopes + token file. Shared client-secret/refresh plumbing
lives in google_oauth.py; shares the same Cloud project/OAuth client as
Gmail, but keeps its own scopes and its own token file.
"""
from pathlib import Path

from gateway.config import settings

# `spreadsheets` alone covers read, write, and creating new spreadsheets via
# the Sheets API. `drive.readonly` is only for find_spreadsheet (search by
# name) -- narrower than full `drive` since we never need to modify Drive
# metadata directly.
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

TOKEN_PATH = Path(settings.sheets_token_file)
