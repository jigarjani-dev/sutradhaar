import yaml
from gateway.registry import get_agent


async def load_agent_config(name: str) -> dict | None:
    """Load a running agent's config from the registry."""
    agent = await get_agent(name)
    if not agent:
        return None
    config = yaml.safe_load(agent["config_yaml"])
    config["_soul_md"] = agent["soul_md"]
    config["_card_json"] = agent["card_json"]
    return config


async def build_system_prompt(config: dict) -> str:
    """Build system prompt from SOUL.md and agent config."""
    soul = config.get("_soul_md", "")

    # add tool context
    tools = config.get("tools", [])
    handoff = config.get("handoff", {})
    orchestrator = config.get("orchestrator", {})

    extra = []
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
