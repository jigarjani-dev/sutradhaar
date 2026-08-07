"""
Tool execution dispatcher.

The agent no longer has a flat tools list. Capabilities come from:
  - skills (SKILL.md packages; their scripts become skill__<skill>__<script> tools)
  - MCP servers (mcp__<server>__<tool> tools)

get_tool_definitions(names) expands agent capability references into OpenAI
function tool defs. execute_tool(name, args) dispatches to the right executor.
"""

import json

from gateway.config import settings
from gateway.mcp import mcp_bridge
from gateway.skills import (
    get_skill,
    get_script_tool_defs,
    execute_script,
    script_tool_name,
    skill_view_tool_def,
    view_skill,
    list_skills,
)


# legacy flat tools kept only for backwards-compat with old agent.yaml
LEGACY_TOOLS = {"gmail_reader", "sheets_writer", "sheets_reader", "ocr_reader", "telegram_sender"}


def get_tool_definitions(capability_refs: list[str]) -> list[dict]:
    """
    Expand agent capability references into OpenAI tool defs.

    Input can contain:
      - skill names (e.g. "gmail-reader") -> their script tools (skill__x__y)
      - mcp server names (e.g. "filesystem") -> all tools from that server
      - explicit tool names (skill__x__y or mcp__srv__tool)
    """
    result: list[dict] = []
    seen: set[str] = set()

    def add(defs: list[dict]):
        for d in defs:
            name = d["function"]["name"]
            if name not in seen:
                seen.add(name)
                result.append(d)

    # skill_view is always available for progressive disclosure
    add([skill_view_tool_def()])

    for ref in capability_refs or []:
        ref = ref.strip()
        if not ref:
            continue
        if ref.startswith("mcp__"):
            # explicit MCP tool: mcp__<server>__<tool> -> find in bridge
            match = [d for d in mcp_bridge.tool_defs if d["function"]["name"] == ref]
            add(match)
            continue
        if ref.startswith("skill__"):
            # explicit skill script tool
            parts = ref.split("__")
            if len(parts) >= 3:
                skill_name = parts[1]
                script_name = "__".join(parts[2:])
                skill = get_skill(skill_name)
                if skill:
                    for d in get_script_tool_defs(skill):
                        if d["function"]["name"] == script_tool_name(skill_name, script_name) or \
                           d["function"]["name"] == ref:
                            add([d])
            continue
        # skill name
        skill = get_skill(ref)
        if skill:
            add(get_script_tool_defs(skill))
            continue
        # mcp server name
        server_defs = [d for d in mcp_bridge.tool_defs if d["function"]["name"].startswith(f"mcp__{ref}__")]
        if server_defs:
            add(server_defs)
            continue
        # legacy flat tool name -> ignore (deprecated) or map nothing

    return result


async def execute_tool(name: str, args: dict) -> str:
    """Execute a tool by name (skill_view, skill script, or MCP tool)."""
    if name == "skill_view":
        return await view_skill((args or {}).get("name", ""))

    if name.startswith("mcp__"):
        return await mcp_bridge.call(name, args or {})

    if name.startswith("skill__"):
        parts = name.split("__")
        if len(parts) >= 3:
            skill_name = parts[1]
            script_name = "__".join(parts[2:])
            # tool schema nests args under "args"; unwrap for the script
            call_args = (args or {}).get("args") if isinstance(args, dict) else None
            return await execute_script(skill_name, script_name, call_args or {})

    return f"Unknown tool: {name}"

def available_skill_names() -> list[str]:
    return [s["name"] for s in list_skills()]
