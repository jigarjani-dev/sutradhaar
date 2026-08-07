"""
Agent-to-agent handoff via A2A protocol.

When an agent includes ---HANDOFF: <target>--- in its response,
the handoff engine dispatches the message to the target agent
via its A2A endpoint.
"""

import logging
from gateway.llm import LLMEngine
from gateway.loader import build_system_prompt
from gateway.registry import get_agent
from gateway.ws import ws_manager

logger = logging.getLogger(__name__)
llm_engine = LLMEngine()


async def route_handoff(from_agent: str, to_agent: str, context: str) -> str:
    """
    Handle an agent-to-agent handoff.
    Sends the context to the target agent and returns its response.
    """
    target = await get_agent(to_agent)
    if not target:
        error = f"Handoff failed: agent '{to_agent}' not found"
        await ws_manager.emit_debug(from_agent, "handoff_error", {"error": error})
        return error

    import yaml
    config = yaml.safe_load(target["config_yaml"])
    config["_soul_md"] = target["soul_md"]

    await ws_manager.emit_handoff(from_agent, to_agent, context)

    system_prompt = await build_system_prompt(config)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"[Handoff from {from_agent}]\n\n{context}"},
    ]
    tools = config.get("tools", [])

    reply = await llm_engine.chat(messages, tools=tools, model=config.get("model"))
    await ws_manager.emit_message(to_agent, "assistant", reply)
    await ws_manager.emit_debug(to_agent, "handoff_received", {
        "from": from_agent,
        "response": reply[:200],
    })

    return reply


async def run_orchestrator(orchestrator_name: str, user_message: str):
    """
    Run the orchestrator agent to classify the user message and
    route it to the appropriate agent.
    """
    orch = await get_agent(orchestrator_name)
    if not orch:
        return f"Orchestrator '{orchestrator_name}' not found"

    import yaml
    config = yaml.safe_load(orch["config_yaml"])
    orchestrator_config = config.get("orchestrator", {})

    if not orchestrator_config.get("enabled"):
        return "Orchestrator is not enabled for this agent"

    # try keyword matching first
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
            return await route_handoff(orchestrator_name, target, user_message)

    # fallback: use LLM to classify intent
    # provide a list of available agents for the orchestrator to pick from
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

    # find the closest matching agent name
    if target in agent_names:
        await ws_manager.emit_debug(orchestrator_name, "orchestrator_route", {
            "rule_matched": "llm_classification",
            "target": target,
            "confidence": "llm",
        })
        return await route_handoff(orchestrator_name, target, user_message)

    return f"Could not determine target agent. Available: {', '.join(agent_names)}"
