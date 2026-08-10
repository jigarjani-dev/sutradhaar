"""
Internal gateway handoff (OpenClaw-style return-to-requester).

When an agent includes ---HANDOFF: <target>--- in its response,
the worker agent runs, then the requester agent synthesizes the answer for the user.
"""

import logging
import re

import yaml

from gateway.llm import LLMEngine
from gateway.loader import build_system_prompt
from gateway.memory import add_message, build_context, get_history, get_latest_summary
from gateway.registry import get_agent, set_agent_status
from gateway.ws import ws_manager

logger = logging.getLogger(__name__)
llm_engine = LLMEngine()

# Leading/closing "---" are both optional and independent: models drop one
# side or the other unpredictably (seen both "HANDOFF: x---" and
# "---HANDOFF: x"). A strict match on both sides silently fails to trigger
# the handoff at all, leaking the raw marker straight into user-facing text.
HANDOFF_RE = re.compile(r"-{0,3}\s*HANDOFF:\s*([\w]+(?:-[\w]+)*)\s*-{0,3}")
DEFAULT_MAX_HANDOFF_ROUNDS = 20


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
    history = await get_history(to_agent)
    summary = await get_latest_summary(to_agent)
    messages = build_context(history, system_prompt, summary)

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


async def _synthesize_requester_loop(
    from_agent: str,
    to_agent: str,
    user_message: str,
    worker_reply: str,
    round_num: int,
    rounds_left: int,
) -> tuple[str, bool, str]:
    """
    Like _synthesize_requester, but from_agent may itself emit another
    ---HANDOFF: <to_agent>--- to keep iterating, up to rounds_left.

    Returns (reply_text_with_marker_stripped, should_continue, next_delegation_note).
    """
    source = await get_agent(from_agent)
    if not source:
        return worker_reply, False, ""

    config = yaml.safe_load(source["config_yaml"])
    config["_soul_md"] = source["soul_md"]
    kwargs = _agent_llm_kwargs(config)

    await set_agent_status(from_agent, "thinking")
    await ws_manager.emit_agent_status(from_agent, "thinking")

    system_prompt = await build_system_prompt(config)
    if rounds_left > 0:
        system_prompt += (
            f"\n\nYou delegated work to `{to_agent}`; this was round {round_num}. Their reply "
            f"is below.\n"
            f"Check two things, in order:\n"
            f"1. Did THIS delegation's ask get done correctly (verify it yourself if you have "
            f"the tools to, don't just take their word)?\n"
            f"2. Does YOUR OWN plan/backlog for this request still have an item you haven't "
            f"delegated yet? If yes, you are NOT done, no matter how good this round's result "
            f"looks -- immediately end your reply with ---HANDOFF: {to_agent}--- plus one "
            f"short, concrete instruction for the NEXT item in your plan. Moving to the next "
            f"planned item is never optional and never a nitpick -- it's the job. Only omit "
            f"the marker once your entire plan is built and verified with nothing left in it.\n"
            f"You have {rounds_left} round(s) left after this one."
        )
    else:
        system_prompt += (
            f"\n\nYou delegated work to `{to_agent}` for {round_num} round(s) -- that's the "
            f"limit for this turn. Their latest reply is below. Write your FINAL reply to the "
            f"user now: what was built, what (if anything) still doesn't fully meet the spec, "
            f"and what the user could ask next. Do not emit ---HANDOFF---."
        )

    integrate = (
        f"User message:\n{user_message}\n\n"
        f"Agent `{to_agent}` replied:\n{worker_reply}\n\n"
        "Write your reply."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": integrate},
    ]

    try:
        raw = await llm_engine.chat(
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

    raw = (raw or "").strip() or worker_reply
    match = HANDOFF_RE.search(raw)
    clean = HANDOFF_RE.sub("", raw).strip() or raw

    if match and rounds_left > 0:
        return clean, True, clean
    return clean, False, ""


async def execute_handoff_loop(
    from_agent: str,
    to_agent: str,
    user_message: str,
    delegation_note: str = "",
    max_rounds: int = DEFAULT_MAX_HANDOFF_ROUNDS,
) -> str:
    """
    Autonomous multi-round handoff: from_agent keeps delegating to to_agent
    and re-evaluating until satisfied, capped at max_rounds so it can't loop
    forever (analysis paralysis).
    """
    await ws_manager.emit_handoff(from_agent, to_agent, user_message, phase="start")
    await set_agent_status(from_agent, "working")
    await ws_manager.emit_agent_status(from_agent, "working")

    note = delegation_note
    final = ""
    round_num = 0

    while round_num < max_rounds:
        round_num += 1
        body = note.strip() or user_message
        worker_reply = await _run_worker(from_agent, to_agent, body)
        await ws_manager.emit_handoff(from_agent, to_agent, body, phase="worker_done")

        rounds_left = max_rounds - round_num
        final, again, note = await _synthesize_requester_loop(
            from_agent, to_agent, user_message, worker_reply, round_num, rounds_left
        )
        if not again:
            break

    await ws_manager.emit_handoff(from_agent, to_agent, user_message, phase="complete")
    await set_agent_status(from_agent, "idle")
    await ws_manager.emit_agent_status(from_agent, "idle")

    return final


def _orchestrator_allowed_targets(config: dict) -> list[str]:
    """Agents the orchestrator may hand off to (from handoff.targets, else rule targets)."""
    handoff = config.get("handoff") or {}
    from_targets = [t.strip() for t in (handoff.get("targets") or []) if isinstance(t, str) and t.strip()]
    if from_targets:
        return list(dict.fromkeys(from_targets))
    orch = config.get("orchestrator") or {}
    rule_targets = []
    for rule in orch.get("rules") or []:
        t = (rule.get("target") or "").strip()
        if t:
            rule_targets.append(t)
    return list(dict.fromkeys(rule_targets))


async def _handoff_target_catalog(allowed: list[str]) -> list[dict]:
    """Load name, description, and SOUL snippet for each allowed handoff target."""
    catalog: list[dict] = []
    for name in allowed:
        agent = await get_agent(name)
        if not agent:
            continue
        cfg = yaml.safe_load(agent["config_yaml"]) or {}
        desc = str(cfg.get("description") or name).strip()
        soul = (agent.get("soul_md") or "").strip()
        catalog.append({
            "name": name,
            "description": desc,
            "persona": soul[:500] if soul else "",
        })
    return catalog


def _format_orchestrator_routing_prompt(catalog: list[dict], rules: list[dict]) -> str:
    lines = [
        "You are an orchestrator. Read the user message and pick the single best specialist "
        "to handle it based on each agent's description and persona.",
        "Reply with ONLY that agent's exact name, nothing else.",
        "",
        "Registered agents you may route to:",
    ]
    for entry in catalog:
        lines.append(f"- {entry['name']}: {entry['description']}")
        if entry.get("persona"):
            lines.append(f"  {entry['persona'][:350].replace(chr(10), ' ')}")
    if rules:
        lines.append("")
        lines.append("Optional keyword hints (not exhaustive):")
        for rule in rules:
            target = (rule.get("target") or "").strip()
            if not target:
                continue
            kw = ", ".join(rule.get("match") or [])
            lines.append(f"- [{kw}] -> {target}")
    return "\n".join(lines)


def _resolve_routing_target(raw: str, allowed: list[str]) -> str | None:
    """Map LLM output to an allowed agent name."""
    if not raw:
        return None
    text = raw.strip().lower().strip('"\'`.')
    if text in allowed:
        return text
    for name in allowed:
        if name == text or name in text.split():
            return name
    for name in allowed:
        if name in text:
            return name
    return None


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
    allowed = _orchestrator_allowed_targets(config)
    if not allowed:
        return "Orchestrator has no handoff targets configured."

    lower_msg = user_message.lower()
    for rule in rules:
        keywords = rule.get("match", [])
        target = (rule.get("target") or "").strip()
        if not target or target not in allowed:
            continue
        if any(kw.lower() in lower_msg for kw in keywords):
            await ws_manager.emit_debug(orchestrator_name, "orchestrator_route", {
                "rule_matched": keywords,
                "target": target,
                "confidence": "keyword_match",
            })
            return await execute_handoff(orchestrator_name, target, user_message)

    catalog = await _handoff_target_catalog(allowed)
    if not catalog:
        return f"No registered agents found for handoff targets: {', '.join(allowed)}"

    orch_kwargs = _agent_llm_kwargs(config)
    system = _format_orchestrator_routing_prompt(catalog, rules)
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_message},
    ]

    target_raw = await llm_engine.chat(
        messages,
        model=orch_kwargs["model"],
        provider=orch_kwargs["provider"],
        provider_override=orch_kwargs["provider_override"],
        agent_name=orchestrator_name,
    )
    target = _resolve_routing_target(target_raw, allowed)

    if target:
        await ws_manager.emit_debug(orchestrator_name, "orchestrator_route", {
            "rule_matched": "description_routing",
            "target": target,
            "confidence": "llm",
            "llm_raw": (target_raw or "")[:80],
        })
        return await execute_handoff(orchestrator_name, target, user_message)

    return (
        f"Could not route to a configured target. Allowed handoff targets: {', '.join(allowed)}. "
        f"Add keywords to orchestrator rules or rephrase your message."
    )
