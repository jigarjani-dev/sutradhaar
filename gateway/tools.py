"""
Tool registry and execution.

Pre-baked tools: gmail_reader, sheets_writer, sheets_reader,
ocr_reader, telegram_sender.

Tools use subprocess calls to 'gws' CLI (Google Workspace) or
HTTP requests for Telegram. In mock mode, they return sample data.
"""

import json
import asyncio
import httpx
from gateway.config import settings


TOOL_DEFINITIONS = {
    "gmail_reader": {
        "type": "function",
        "function": {
            "name": "gmail_reader",
            "description": "Search and read emails from Gmail inbox",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Gmail search query, e.g. 'subject:invoice' or 'from:boss@example.com'",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of emails to return (default 5)",
                    },
                },
                "required": ["query"],
            },
        },
    },
    "sheets_writer": {
        "type": "function",
        "function": {
            "name": "sheets_writer",
            "description": "Append rows to a Google Sheets spreadsheet",
            "parameters": {
                "type": "object",
                "properties": {
                    "spreadsheet_id": {
                        "type": "string",
                        "description": "The Google Sheets spreadsheet ID (from the URL)",
                    },
                    "range": {
                        "type": "string",
                        "description": "Sheet range to append to, e.g. 'Sheet1!A1'",
                    },
                    "values": {
                        "type": "array",
                        "description": "Rows of values to append, e.g. [['Date', 'Item', 'Amount']]",
                        "items": {"type": "array", "items": {"type": "string"}},
                    },
                },
                "required": ["spreadsheet_id", "values"],
            },
        },
    },
    "sheets_reader": {
        "type": "function",
        "function": {
            "name": "sheets_reader",
            "description": "Read values from a Google Sheets spreadsheet",
            "parameters": {
                "type": "object",
                "properties": {
                    "spreadsheet_id": {
                        "type": "string",
                        "description": "The Google Sheets spreadsheet ID",
                    },
                    "range": {
                        "type": "string",
                        "description": "Sheet range to read, e.g. 'Sheet1!A1:D100'",
                    },
                },
                "required": ["spreadsheet_id", "range"],
            },
        },
    },
    "ocr_reader": {
        "type": "function",
        "function": {
            "name": "ocr_reader",
            "description": "Extract text from an uploaded image or PDF using OCR. Use when the user uploads a receipt, invoice, or salary slip.",
            "parameters": {
                "type": "object",
                "properties": {
                    "image_description": {
                        "type": "string",
                        "description": "Description of what the user said about the image (the actual OCR happens server-side when an image is uploaded)",
                    },
                },
                "required": ["image_description"],
            },
        },
    },
    "telegram_sender": {
        "type": "function",
        "function": {
            "name": "telegram_sender",
            "description": "Send a message via Telegram bot to a chat",
            "parameters": {
                "type": "object",
                "properties": {
                    "chat_id": {
                        "type": "string",
                        "description": "Telegram chat ID to send the message to",
                    },
                    "text": {
                        "type": "string",
                        "description": "Message text to send",
                    },
                },
                "required": ["chat_id", "text"],
            },
        },
    },
}

# tool names that use real external services
REAL_TOOLS = {"gmail_reader", "sheets_writer", "sheets_reader"}


def get_tool_definitions(tool_names: list[str]) -> list[dict]:
    """Return OpenAI-format tool definitions for the requested tools."""
    result = []
    for name in tool_names:
        if name in TOOL_DEFINITIONS:
            result.append(TOOL_DEFINITIONS[name])
    return result


async def execute_tool(name: str, args: dict) -> str:
    """Execute a tool by name with given arguments."""
    if settings.mock_tools and name in REAL_TOOLS:
        return _mock_tool_result(name, args)

    if name == "gmail_reader":
        gmail_params = {"q": args.get("query", ""), "maxResults": args.get("max_results", 5)}
        return await _run_gws("gmail", "users.messages", "list", gmail_params)
    elif name == "sheets_writer":
        sheet_params = {
            "spreadsheetId": args.get("spreadsheet_id", ""),
            "range": args.get("range", "Sheet1!A1"),
            "valueInputOption": "USER_ENTERED",
        }
        return await _run_gws(
            "sheets", "spreadsheets.values", "append", sheet_params,
            body={"values": args.get("values", [])},
        )
    elif name == "sheets_reader":
        sheet_params = {
            "spreadsheetId": args.get("spreadsheet_id", ""),
            "range": args.get("range", "Sheet1!A1:Z100"),
        }
        return await _run_gws("sheets", "spreadsheets.values", "get", sheet_params)
    elif name == "ocr_reader":
        return (
            "OCR processing: The uploaded image/PDF has been received. "
            "A real OCR engine would extract text here. "
            f"User described the image as: {args.get('image_description', 'unknown')}"
        )
    elif name == "telegram_sender":
        return await _send_telegram(
            args.get("chat_id", ""),
            args.get("text", ""),
        )
    else:
        return f"Unknown tool: {name}"


async def _run_gws(service: str, resource: str, action: str, params: dict, body: dict | None = None) -> str:
    """Run a gws CLI command and return the JSON output.
    
    Example: _run_gws("gmail", "users.messages", "list", {"q": "subject:invoice"})
    -> gws gmail users messages list --params '{"q":"subject:invoice"}'
    """
    resource_parts = resource.split(".")
    cmd = ["gws", service] + resource_parts + [action, "--params", json.dumps(params)]
    if body:
        cmd.extend(["--json", json.dumps(body)])

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        if proc.returncode != 0:
            return f"gws error: {stderr.decode()}"
        return stdout.decode()
    except asyncio.TimeoutError:
        return "gws timed out"
    except FileNotFoundError:
        return "gws CLI not found; install it or enable MOCK_TOOLS=true"
    except Exception as e:
        return f"gws execution error: {str(e)}"


async def _send_telegram(chat_id: str, text: str) -> str:
    """Send a Telegram message via HTTP API."""
    token = settings.telegram_bot_token
    if not token:
        return "Telegram bot token not configured. Set TELEGRAM_BOT_TOKEN in .env"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={"chat_id": chat_id, "text": text})
            return resp.text
    except Exception as e:
        return f"Telegram send error: {str(e)}"


def _mock_tool_result(name: str, args: dict) -> str:
    """Return mock data for offline/demo mode."""
    mocks = {
        "gmail_reader": json.dumps({
            "messages": [
                {"id": "mock-1", "threadId": "mock-thread-1"},
            ],
            "resultSizeEstimate": 1,
        }),
        "sheets_writer": json.dumps({
            "spreadsheetId": args.get("spreadsheet_id", "mock-sheet"),
            "updates": {"updatedRows": len(args.get("values", []))},
        }),
        "sheets_reader": json.dumps({
            "values": [
                ["Date", "Item", "Amount", "Category"],
                ["2026-01-15", "Coffee", "Rs. 120", "Food"],
                ["2026-01-16", "Uber", "Rs. 450", "Transport"],
            ],
        }),
    }
    return mocks.get(name, f"Mock result for {name}")
