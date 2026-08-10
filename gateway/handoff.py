"""
Internal gateway handoff (OpenClaw-style return-to-requester).

When an agent includes ---HANDOFF: <target>--- in its response,
the worker agent runs, then the requester agent synthesizes the answer for the user.
"""

import logging
import yaml

from gateway.llm import LLMEngine
from gateway.loader import build_system_prompt
from gateway.memory import add_message
from gateway.registry import get_agent, set_agent_status
from gateway.ws import ws_manager

logger = logging.getLogger(__name__)
llm_engine = LLMEngine()


def _capability_refs(config: dict) -> list[str]:
    refs: list[str] = list(config.get("skills", []))
    for m in config.get("mcp_servers", []):
        if isinstance(m, str):
            refs.append(m)
        elif isinstance(m, dict) and m.get("name"):
            refs.append(m["name"])
    refs.extend(config.get("tools", []))
    return refs


def _agent_llm_kwargs(config: dict) -> dict:
    return {
        "model": config.get("model"),
        "provider": config.get("provider"),
        "provider_override": config.get("provider_override"),
        "tools": _capability_refs(config),
    }


async def _run_worker(from_agent: str, to_agent: str, user_message: str) -> str:
    target = await get_agent(to_agent)
    if not target:
        error = f"Handoff failed: agent '{to_agent}' not found"
        await ws_manager.emit_debug(from_agent, "handoff_error", {"error": error})
        return error

    config = yaml.safe_load(target["config_yaml"])
    config["_soul_md"] = target["soul_md"]
    kwargs = _agent_llm_kwargs(config)

    handoff_body = f"[Handoff from {from_agent}]\n\n{user_message}"
    await add_message(to_agent, "handoff_in", handoff_body, sender=from_agent)
    await ws_manager.emit_message(to_agent, "handoff_in", handoff_body, sender=from_agent)

    await set_agent_status(to_agent, "thinking")
    await ws_manager.emit_agent_status(to_agent, "thinking")

    system_prompt = await build_system_prompt(config)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": handoff_body},
    ]

    try:
        reply = await llm_engine.chat(
            messages,
            tools=kwargs["tools"],
            model=kwargs["model"],
            provider=kwargs["provider"],
            provider_override=kwargs["provider_override"],
            agent_name=to_agent,
        )
    except Exception as e:
        logger.exception("Handoff worker %s failed", to_agent)
        await set_agent_status(to_agent, "error", error=str(e))
        await ws_manager.emit_agent_status(to_agent, "error", error=str(e))
        raise

    await add_message(to_agent, "assistant", reply)
    await ws_manager.emit_message(to_agent, "assistant", reply)
    await set_agent_status(to_agent, "idle")
    await ws_manager.emit_agent_status(to_agent, "idle")
    await ws_manager.emit_debug(to_agent, "handoff_received", {
        "from": from_agent,
        "response": reply[:200],
    })
    return reply


async def _synthesize_requester(
    from_agent: str,
    to_agent: str,
    user_message: str,
    worker_reply: str,
    delegation_note: str = "",
) -> str:
    source = await get_agent(from_agent)
    if not source:
        return worker_reply

    config = yaml.safe_load(source["config_yaml"])
    config["_soul_md"] = source["soul_md"]
    kwargs = _agent_llm_kwargs(config)

    await set_agent_status(from_agent, "thinking")
    await ws_manager.emit_agent_status(from_agent, "thinking")

    system_prompt = await build_system_prompt(config)
    system_prompt += (
        f"\n\nYou delegated work to `{to_agent}`. Their reply is below. "
        "Answer the user in your voice: say what they returned, then your conclusion. "
        "Do not emit ---HANDOFF--- unless the user asks you to delegate again."
    )

    integrate = (
        f"User message:\n{user_message}\n\n"
        f"Agent `{to_agent}` replied:\n{worker_reply}\n\n"
        "Write your final reply to the user."
    )
    if delegation_note.strip():
        integrate = f"Your delegation note: {delegation_note.strip()}\n\n" + integrate

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": integrate},
    ]

    try:
        final = await llm_engine.chat(
            messages,
            tools=kwargs["tools"],
            model=kwargs["model"],
            provider=kwargs["provider"],
            provider_override=kwargs["provider_override"],
            agent_name=from_agent,
        )
    finally:
        await set_agent_status(from_agent, "idle")
        await ws_manager.emit_agent_status(from_agent, "idle")

    return final.strip() or worker_reply


async def execute_handoff(
    from_agent: str,
    to_agent: str,
    user_message: str,
    delegation_note: str = "",
) -> str:
    """
    Worker run + return-to-requester synthesis (user-facing text from from_agent).
    """
    await ws_manager.emit_handoff(from_agent, to_agent, user_message, phase="start")
    await set_agent_status(from_agent, "working")
    await ws_manager.emit_agent_status(from_agent, "working")

    worker_reply = await _run_worker(from_agent, to_agent, user_message)

    await ws_manager.emit_handoff(from_agent, to_agent, user_message, phase="worker_done")

    final = await _synthesize_requester(
        from_agent, to_agent, user_message, worker_reply, delegation_note
    )

    await ws_manager.emit_handoff(from_agent, to_agent, user_message, phase="complete")
    await set_agent_status(from_agent, "idle")
    await ws_manager.emit_agent_status(from_agent, "idle")

    return final


async def route_handoff(from_agent: str, to_agent: str, context: str) -> str:
    """Backward-compatible entry: full handoff with return-to-requester."""
    return await execute_handoff(from_agent, to_agent, context)


async def run_orchestrator(orchestrator_name: str, user_message: str):
    """
    Run the orchestrator agent to classify the user message and
    route it to the appropriate agent.
    """
    orch = await get_agent(orchestrator_name)
    if not orch:
        return f"Orchestrator '{orchestrator_name}' not found"

    config = yaml.safe_load(orch["config_yaml"])
    orchestrator_config = config.get("orchestrator", {})

    if not orchestrator_config.get("enabled"):
        return "Orchestrator is not enabled for this agent"

    rules = orchestrator_config.get("rules", [])
    lower_msg = user_message.lower()
    for rule in rules:
        keywords = rule.get("match", [])
        target = rule.get("target", "")
        if any(kw.lower() in lower_msg for kw in keywords):
            await ws_manager.emit_debug(orchestrator_name, "orchestrator_route", {
                "rule_matched": keywords,
                "target": target,
                "confidence": "keyword_match",
            })
            return await execute_handoff(orchestrator_name, target, user_message)

    from gateway.registry import list_agents
    agents = await list_agents()
    agent_names = [a["name"] for a in agents if a["name"] != orchestrator_name]

    system = (
        f"You are an orchestrator. Given a user message, determine which agent "
        f"should handle it. Available agents: {', '.join(agent_names)}. "
        f"Respond with ONLY the agent name, nothing else."
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Route this: {user_message}"},
    ]

    llm = LLMEngine()
    target = (await llm.chat(messages)).strip().lower()

    if target in agent_names:
        await ws_manager.emit_debug(orchestrator_name, "orchestrator_route", {
            "rule_matched": "llm_classification",
            "target": target,
            "confidence": "llm",
        })
        return await execute_handoff(orchestrator_name, target, user_message)

    return f"Could not determine target agent. Available: {', '.join(agent_names)}"
