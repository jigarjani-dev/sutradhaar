"""
Auto-generate A2A Agent Cards from agent.yaml + SOUL.md.

Uses the a2a SDK types to build cards compatible with the
Agent-to-Agent protocol standard.
"""


def build_agent_card(config: dict, soul_md: str) -> dict:
    name = config["name"]
    description = config.get("description", name)
    tools = config.get("tools", [])

    skills = []
    for tool_name in tools:
        skill = _tool_to_skill(tool_name)
        if skill:
            skills.append(skill)

    # build a card dict compatible with a2a.types.AgentCard
    card = {
        "name": name,
        "description": description,
        "version": "1.0.0",
        "defaultInputModes": ["text/plain"],
        "defaultOutputModes": ["text/plain"],
        "capabilities": {
            "streaming": True,
        },
        "skills": skills,
        "url": f"http://localhost:8080",
        "supportedInterfaces": [
            {
                "protocolBinding": "JSONRPC",
                "url": f"http://localhost:8080/a2a/{name}",
                "protocolVersion": "1.0",
            }
        ],
    }

    return card


def _tool_to_skill(tool_name: str) -> dict | None:
    tool_map = {
        "gmail_reader": {
            "id": "gmail_reader",
            "name": "Gmail Reader",
            "description": "Search and read emails from Gmail inbox",
            "inputModes": ["text/plain"],
            "outputModes": ["text/plain"],
            "tags": ["gmail", "email", "google-workspace"],
        },
        "sheets_writer": {
            "id": "sheets_writer",
            "name": "Google Sheets Writer",
            "description": "Append rows and read ranges from Google Sheets spreadsheets",
            "inputModes": ["text/plain"],
            "outputModes": ["text/plain"],
            "tags": ["sheets", "spreadsheet", "google-workspace"],
        },
        "sheets_reader": {
            "id": "sheets_reader",
            "name": "Google Sheets Reader",
            "description": "Read values from Google Sheets spreadsheets",
            "inputModes": ["text/plain"],
            "outputModes": ["text/plain"],
            "tags": ["sheets", "spreadsheet", "google-workspace"],
        },
        "ocr_reader": {
            "id": "ocr_reader",
            "name": "OCR Reader",
            "description": "Extract text from images and PDFs using OCR",
            "inputModes": ["image/png", "image/jpeg", "application/pdf"],
            "outputModes": ["text/plain"],
            "tags": ["ocr", "document", "image"],
        },
        "telegram_sender": {
            "id": "telegram_sender",
            "name": "Telegram Sender",
            "description": "Send messages via Telegram bot",
            "inputModes": ["text/plain"],
            "outputModes": ["text/plain"],
            "tags": ["telegram", "messaging"],
        },
    }
    return tool_map.get(tool_name)
