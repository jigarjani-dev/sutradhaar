"""Shared agent chat pipeline for HTTP and Telegram."""

import logging
import re

import yaml

from gateway.handoff import execute_handoff_loop, run_orchestrator
from gateway.loader import build_system_prompt
from gateway.memory import (
    add_message,
    build_context,
    get_history,
    get_latest_summary,
    summarize_old_turns,
)
from gateway.registry import get_agent, set_agent_status
from gateway.ws import ws_manager

logger = logging.getLogger(__name__)


def capability_refs(config: dict) -> list[str]:
    refs: list[str] = list(config.get("skills", []))
    for m in config.get("mcp_servers", []):
        if isinstance(m, str):
            refs.append(m)
        elif isinstance(m, dict) and m.get("name"):
            refs.append(m["name"])
    refs.extend(config.get("tools", []))
    return refs


async def process_agent_chat(
    llm_engine,
    agent_name: str,
    user_message: str,
    *,
    message_source: str | None = None,
    sender: str | None = None,
) -> str:
    """
    Run one user turn: persist, route orchestrator if configured, handoff, reply.
    message_source: e.g. 'telegram' for UI labeling.
    """
    agent = await get_agent(agent_name)
    if not agent:
        raise ValueError(f"Agent '{agent_name}' not found")

    config = yaml.safe_load(agent["config_yaml"])
    config["_soul_md"] = agent["soul_md"]
    user_message = (user_message or "").strip()
    if not user_message:
        raise ValueError("Message is required")

    await set_agent_status(agent_name, "thinking")
    await ws_manager.emit_agent_status(agent_name, "thinking")
    await ws_manager.emit_message(
        agent_name,
        "user",
        user_message,
        sender=sender,
        source=message_source,
    )

    system_prompt = await build_system_prompt(config)
    await add_message(agent_name, "user", user_message, sender=sender or message_source)

    history = await get_history(agent_name)
    summary = await get_latest_summary(agent_name)
    messages = build_context(history, system_prompt, summary)
    tools = capability_refs(config)
    thinking_parts: list[str] = []

    async def on_thinking(text: str):
        thinking_parts.append(text)
        await ws_manager.emit_thinking(agent_name, text)

    orchestrator_config = config.get("orchestrator") or {}
    if orchestrator_config.get("enabled") and orchestrator_config.get("rules"):
        response = await run_orchestrator(agent_name, user_message)
    else:
        response = await llm_engine.chat(
            messages,
            tools=tools,
            model=config.get("model"),
            provider=config.get("provider"),
            provider_override=config.get("provider_override"),
            agent_name=agent_name,
            on_thinking=on_thinking,
        )

    if thinking_parts:
        await add_message(agent_name, "thinking", "\n".join(thinking_parts))

    handoff_match = re.search(r"---HANDOFF:\s*([\w-]+)\s*---", response or "")
    if handoff_match:
        target = handoff_match.group(1)
        clean_response = re.sub(r"---HANDOFF:\s*[\w-]+\s*---", "", response or "").strip()
        max_rounds = (config.get("handoff") or {}).get("max_rounds") or 4
        full_response = await execute_handoff_loop(
            agent_name, target, user_message, delegation_note=clean_response, max_rounds=max_rounds,
        )
    else:
        full_response = response or ""

    await add_message(agent_name, "assistant", full_response)
    await summarize_old_turns(
        agent_name,
        llm_engine,
        model=config.get("model"),
        provider=config.get("provider"),
        provider_override=config.get("provider_override"),
    )

    await set_agent_status(agent_name, "idle")
    await ws_manager.emit_agent_status(agent_name, "idle")
    await ws_manager.emit_message(agent_name, "assistant", full_response)

    return full_response
