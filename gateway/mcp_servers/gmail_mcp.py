"""
Gmail MCP server -- talks to the Gmail API directly via the official Google
API Python client. No external CLI binary (no gws, no npx) -- just the pip
packages in requirements.txt.

One-time setup required before these tools work: see gmail_auth_setup.py.

Registered in data/mcp.json as a stdio server:
  "gmail": {"command": "python3", "args": ["-m", "gateway.mcp_servers.gmail_mcp"]}
"""

import base64
import json
from email.mime.text import MIMEText

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from mcp.server.fastmcp import FastMCP

from gateway.mcp_servers.gmail_credentials import SCOPES, TOKEN_PATH
from gateway.mcp_servers.google_oauth import load_credentials

mcp = FastMCP("gmail")


def _service():
    creds = load_credentials(SCOPES, TOKEN_PATH, "gateway.mcp_servers.gmail_auth_setup")
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _http_error(e: HttpError) -> str:
    return json.dumps({"error": str(e)})


def _headers_dict(payload: dict) -> dict:
    return {h["name"]: h["value"] for h in payload.get("headers", [])}


def _extract_body(payload: dict, want_html: bool) -> str:
    """Walk the (possibly multipart) payload for the best-matching body part."""
    wanted = "text/html" if want_html else "text/plain"
    fallback = None
    stack = [payload]
    while stack:
        part = stack.pop()
        data = part.get("body", {}).get("data")
        mime_type = part.get("mimeType")
        if data and mime_type == wanted:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        if data and mime_type == "text/plain" and fallback is None:
            fallback = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        stack.extend(part.get("parts") or [])
    return fallback or ""


def _search(query: str, max_results: int) -> dict:
    service = _service()
    listing = service.users().messages().list(userId="me", q=query, maxResults=max_results).execute()
    messages = []
    for m in listing.get("messages", []):
        meta = service.users().messages().get(
            userId="me", id=m["id"], format="metadata",
            metadataHeaders=["From", "Subject", "Date"],
        ).execute()
        h = _headers_dict(meta.get("payload", {}))
        messages.append({
            "id": m["id"],
            "threadId": meta.get("threadId"),
            "from": h.get("From"),
            "subject": h.get("Subject"),
            "date": h.get("Date"),
            "snippet": meta.get("snippet"),
        })
    return {"messages": messages}


@mcp.tool()
def search_messages(query: str, max_results: int = 10) -> str:
    """Search Gmail messages. `query` is a Gmail search string (e.g. "from:boss subject:invoice")."""
    try:
        return json.dumps(_search(query, max_results))
    except HttpError as e:
        return _http_error(e)


@mcp.tool()
def read_message(message_id: str, include_headers: bool = False, html: bool = False) -> str:
    """Read one Gmail message's body (and optionally headers) by id."""
    try:
        service = _service()
        msg = service.users().messages().get(userId="me", id=message_id, format="full").execute()
        payload = msg.get("payload", {})
        result = {
            "id": message_id,
            "threadId": msg.get("threadId"),
            "body": _extract_body(payload, html),
        }
        if include_headers:
            result["headers"] = _headers_dict(payload)
        return json.dumps(result)
    except HttpError as e:
        return _http_error(e)


@mcp.tool()
def list_labels() -> str:
    """List Gmail labels on the account."""
    try:
        result = _service().users().labels().list(userId="me").execute()
        return json.dumps(result.get("labels", []))
    except HttpError as e:
        return _http_error(e)


@mcp.tool()
def triage(max_results: int = 20, query: str = "is:unread") -> str:
    """Unread inbox summary: sender, subject, date. Read-only."""
    try:
        return json.dumps(_search(query, max_results))
    except HttpError as e:
        return _http_error(e)


def _send_or_draft(mime: MIMEText, draft: bool, thread_id: str | None = None) -> dict:
    service = _service()
    raw = base64.urlsafe_b64encode(mime.as_bytes()).decode("ascii")
    body = {"raw": raw}
    if thread_id:
        body["threadId"] = thread_id
    if draft:
        return service.users().drafts().create(userId="me", body={"message": body}).execute()
    return service.users().messages().send(userId="me", body=body).execute()


@mcp.tool()
def send_message(to: str, subject: str, body: str, cc: str = "", bcc: str = "",
                  html: bool = False, draft: bool = False) -> str:
    """Send (or draft) an email. IRREVERSIBLE once sent -- confirm with the user first unless draft=True."""
    try:
        mime = MIMEText(body, "html" if html else "plain")
        mime["to"] = to
        mime["subject"] = subject
        if cc:
            mime["cc"] = cc
        if bcc:
            mime["bcc"] = bcc
        return json.dumps(_send_or_draft(mime, draft))
    except HttpError as e:
        return _http_error(e)


@mcp.tool()
def reply_message(message_id: str, body: str, to: str = "", cc: str = "", bcc: str = "",
                   html: bool = False, draft: bool = False) -> str:
    """Reply to a Gmail message (threading handled automatically). IRREVERSIBLE once sent unless draft=True."""
    try:
        service = _service()
        orig = service.users().messages().get(
            userId="me", id=message_id, format="metadata",
            metadataHeaders=["Message-Id", "Subject", "From", "References"],
        ).execute()
        h = _headers_dict(orig.get("payload", {}))
        thread_id = orig.get("threadId")

        subject = h.get("Subject", "")
        if not subject.lower().startswith("re:"):
            subject = f"Re: {subject}"
        references = " ".join(filter(None, [h.get("References", ""), h.get("Message-Id", "")])).strip()

        mime = MIMEText(body, "html" if html else "plain")
        mime["to"] = to or h.get("From", "")
        mime["subject"] = subject
        if h.get("Message-Id"):
            mime["In-Reply-To"] = h["Message-Id"]
        if references:
            mime["References"] = references
        if cc:
            mime["cc"] = cc
        if bcc:
            mime["bcc"] = bcc

        return json.dumps(_send_or_draft(mime, draft, thread_id=thread_id))
    except HttpError as e:
        return _http_error(e)


if __name__ == "__main__":
    mcp.run(transport="stdio")
