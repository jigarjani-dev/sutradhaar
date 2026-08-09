"""
Google Sheets MCP server -- talks to the Sheets (and, for search, Drive) API
directly via the official Google API Python client. No external CLI binary
(no gws, no npx) -- just the pip packages in requirements.txt.

One-time setup required before these tools work: see sheets_auth_setup.py.

Registered in data/mcp.json as a stdio server:
  "sheets": {"command": "python3", "args": ["-m", "gateway.mcp_servers.sheets_mcp"]}
"""

import json

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from mcp.server.fastmcp import FastMCP

from gateway.mcp_servers.google_oauth import load_credentials
from gateway.mcp_servers.sheets_credentials import SCOPES, TOKEN_PATH

mcp = FastMCP("sheets")


def _creds():
    return load_credentials(SCOPES, TOKEN_PATH, "gateway.mcp_servers.sheets_auth_setup")


def _sheets():
    return build("sheets", "v4", credentials=_creds(), cache_discovery=False)


def _drive():
    return build("drive", "v3", credentials=_creds(), cache_discovery=False)


def _http_error(e: HttpError) -> str:
    return json.dumps({"error": str(e)})


@mcp.tool()
def read_values(spreadsheet_id: str, range: str) -> str:
    """Read cell values from a spreadsheet. `range` is A1 notation, e.g. "Sheet1!A1:C10"."""
    try:
        result = _sheets().spreadsheets().values().get(
            spreadsheetId=spreadsheet_id, range=range,
        ).execute()
        return json.dumps({"values": result.get("values", [])})
    except HttpError as e:
        return _http_error(e)


@mcp.tool()
def append_values(spreadsheet_id: str, range: str, values: list[list[str]]) -> str:
    """Append rows after the last row of data in `range`, e.g. "Sheet1!A1". `values` is a list of rows, each a list of cell values."""
    try:
        result = _sheets().spreadsheets().values().append(
            spreadsheetId=spreadsheet_id, range=range,
            valueInputOption="USER_ENTERED", insertDataOption="INSERT_ROWS",
            body={"values": values},
        ).execute()
        return json.dumps(result.get("updates", result))
    except HttpError as e:
        return _http_error(e)


@mcp.tool()
def update_values(spreadsheet_id: str, range: str, values: list[list[str]]) -> str:
    """Overwrite cell values in `range`, e.g. "Sheet1!A1:B2". `values` is a list of rows, each a list of cell values."""
    try:
        result = _sheets().spreadsheets().values().update(
            spreadsheetId=spreadsheet_id, range=range,
            valueInputOption="USER_ENTERED", body={"values": values},
        ).execute()
        return json.dumps(result)
    except HttpError as e:
        return _http_error(e)


@mcp.tool()
def list_sheets(spreadsheet_id: str) -> str:
    """List the tabs (sheets) inside a spreadsheet -- name, id, row/col count."""
    try:
        result = _sheets().spreadsheets().get(
            spreadsheetId=spreadsheet_id, fields="sheets.properties",
        ).execute()
        tabs = [p["properties"] for p in result.get("sheets", [])]
        return json.dumps(tabs)
    except HttpError as e:
        return _http_error(e)


@mcp.tool()
def create_spreadsheet(title: str) -> str:
    """Create a new spreadsheet. Returns its id and URL."""
    try:
        result = _sheets().spreadsheets().create(
            body={"properties": {"title": title}}, fields="spreadsheetId,spreadsheetUrl",
        ).execute()
        return json.dumps(result)
    except HttpError as e:
        return _http_error(e)


@mcp.tool()
def find_spreadsheet(query: str, max_results: int = 10) -> str:
    """Search the account's Drive for spreadsheets whose name contains `query`."""
    try:
        safe_query = query.replace("'", "\\'")
        result = _drive().files().list(
            q=f"name contains '{safe_query}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
            pageSize=max_results, fields="files(id,name,modifiedTime)",
        ).execute()
        return json.dumps(result.get("files", []))
    except HttpError as e:
        return _http_error(e)


if __name__ == "__main__":
    mcp.run(transport="stdio")
