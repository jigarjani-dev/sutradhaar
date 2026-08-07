import yaml
from gateway.registry import get_agent
from gateway.skills import list_skills, get_skill


async def load_agent_config(name: str) -> dict | None:
    """Load a running agent's config from the registry."""
    agent = await get_agent(name)
    if not agent:
        return None
    config = yaml.safe_load(agent["config_yaml"])
    config["_soul_md"] = agent["soul_md"]
    config["_card_json"] = agent["card_json"]
    return config


def _build_skills_catalog(config: dict) -> str:
    """Render the <available_skills> block for the system prompt."""
    refs = config.get("skills", [])
    if not refs:
        return ""
    blocks = []
    for ref in refs:
        skill = get_skill(ref)
        if not skill:
            continue
        blocks.append(
            f"  <skill>\n"
            f"    <name>{skill['name']}</name>\n"
            f"    <description>{skill.get('description', '')}</description>\n"
            f"    <location>{skill['path']}/SKILL.md</location>\n"
            f"  </skill>"
        )
    if not blocks:
        return ""
    return (
        "The following skills provide specialized instructions for specific tasks. "
        "Use their script tools (skill__<name>__<script>) when the task matches a skill's description.\n"
        "<available_skills>\n" + "\n".join(blocks) + "\n</available_skills>"
    )


async def build_system_prompt(config: dict) -> str:
    """Build system prompt from SOUL.md and agent config."""
    soul = config.get("_soul_md", "")

    # skill + mcp context
    handoff = config.get("handoff", {})
    orchestrator = config.get("orchestrator", {})

    extra = []

    skills_catalog = _build_skills_catalog(config)
    if skills_catalog:
        extra.append(skills_catalog)

    mcp_servers = config.get("mcp_servers", [])
    if mcp_servers:
        names = ", ".join(s if isinstance(s, str) else s.get("name", "?") for s in mcp_servers)
        extra.append(
            f"MCP servers available: {names}. Their tools are exposed as "
            f"mcp__<server>__<tool> function tools. Use them when the task requires "
            f"those external capabilities."
        )

    if handoff.get("enabled") and handoff.get("targets"):
        targets = ", ".join(handoff["targets"])
        extra.append(
            f"You can hand off work to these agents by including "
            f"---HANDOFF: <agent-name>--- at the end of your response. "
            f"Available targets: {targets}"
        )

    if orchestrator.get("enabled") and orchestrator.get("rules"):
        rules_text = "\n".join(
            f"  - If message matches [{', '.join(r.get('match', []))}] -> route to '{r.get('target', '')}'"
            for r in orchestrator["rules"]
        )
        extra.append(f"You are an orchestrator. Route messages to agents based on these rules:\n{rules_text}")
        extra.append(
            "To route to an agent, end your response with ---HANDOFF: <agent-name>---"
        )

    parts = [soul]
    if extra:
        parts.append("\n## Instructions\n" + "\n".join(extra))

    return "\n\n".join(parts)
