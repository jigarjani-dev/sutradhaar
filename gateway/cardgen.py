"""
Auto-generate A2A Agent Cards from agent.yaml + SOUL.md.

Uses the a2a SDK types to build cards compatible with the
Agent-to-Agent protocol standard.
"""


def build_agent_card(config: dict, soul_md: str) -> dict:
    name = config["name"]
    description = config.get("description", name)
    tools = config.get("tools", [])
    skills = config.get("skills", [])

    skill_objs = _skills_to_skills(skills, tools)

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
        "skills": skill_objs,
        "url": f"http://localhost:8080",
        "supportedInterfaces": [
            {
                "protocolBinding": "JSONRPC",
                "url": f"http://localhost:8080/a2a/{name}",
                "protocolVersion": "1.0",
            }
        ],
    }

    if tools:
        card["tools"] = tools

    return card


def _skills_to_skills(skill_names: list[str], legacy_tools: list[str]) -> list[dict]:
    """Emit A2A skills. Each skill is a capability; if it bundles scripts they
    are listed under 'tools'. Legacy flat tools map to their skill equivalents."""
    result = []

    for sname in skill_names:
        try:
            from gateway.skills import get_skill
            skill = get_skill(sname)
        except Exception:
            skill = None
        if not skill:
            result.append({
                "id": sname,
                "name": sname,
                "description": "Skill package",
                "tags": ["skill"],
                "tools": [],
            })
            continue
        result.append({
            "id": skill["name"],
            "name": skill["name"],
            "description": skill.get("description", ""),
            "tags": ["skill"],
            "tools": skill.get("scripts", []),
        })

    # legacy flat tools -> skills
    for tool in legacy_tools or []:
        mapped = _tool_to_skill(tool)
        if mapped:
            result.append(mapped)

    return result


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
