"""
A2A (Agent-to-Agent) protocol adapter.

Registers per-agent A2A routes using the official a2a-sdk.
Each agent gets:
- Agent Card at /a2a/{name}/.well-known/agent.json
- JSON-RPC endpoint at /a2a/{name} for task send/receive
"""

import logging
from a2a.server.agent_execution import AgentExecutor
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import (
    AgentCard,
    AgentSkill,
    AgentCapabilities,
    AgentInterface,
)

from gateway.registry import get_agent, set_agent_status
from gateway.llm import LLMEngine
from gateway.loader import build_system_prompt
from gateway.ws import ws_manager

logger = logging.getLogger(__name__)
llm_engine = LLMEngine()


class GatewayAgentExecutor(AgentExecutor):
    """Bridges A2A tasks to our agent runtime."""

    def __init__(self, agent_name: str):
        self.agent_name = agent_name

    async def execute(self, context, event_queue):
        agent = await get_agent(self.agent_name)
        if not agent:
            return

        import yaml
        config = yaml.safe_load(agent["config_yaml"])
        config["_soul_md"] = agent["soul_md"]

        # get the user message from context
        user_text = ""
        if hasattr(context, 'get_user_input'):
            user_text = context.get_user_input()
        elif hasattr(context, 'message'):
            user_text = str(context.message)
        if not user_text:
            user_text = "Hello"

        await set_agent_status(self.agent_name, "thinking")
        await ws_manager.emit_debug(self.agent_name, "a2a_task_started", {
            "user_input": user_text[:200],
        })

        try:
            system_prompt = await build_system_prompt(config)
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ]
            tools = config.get("tools", [])
            reply = await llm_engine.chat(messages, tools=tools, model=config.get("model"))
            await set_agent_status(self.agent_name, "idle")
            await ws_manager.emit_message(self.agent_name, "assistant", reply)

        except Exception as e:
            logger.exception(f"Agent {self.agent_name} execution error")
            await set_agent_status(self.agent_name, "error")
            await ws_manager.emit_debug(self.agent_name, "error", {"error": str(e)})

    async def cancel(self, context, event_queue):
        await set_agent_status(self.agent_name, "idle")


def build_agent_card_obj(name: str, config: dict, tools: list[str]) -> dict:
    """Build a card dict that a2a SDK can consume."""
    skills = []
    for tool_name in tools:
        from gateway.cardgen import _tool_to_skill
        skill = _tool_to_skill(tool_name)
        if skill:
            skills.append(skill)

    return {
        "name": name,
        "description": config.get("description", name),
        "version": "1.0.0",
        "defaultInputModes": ["text/plain"],
        "defaultOutputModes": ["text/plain"],
        "capabilities": {"streaming": True},
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


def register_agent_a2a_routes(app, agent_name: str, config: dict, tools: list[str]):
    # Build the agent card and handler for this agent
    _a2a_registry[agent_name] = _build_handler(agent_name, config, tools)
    logger.info(f"Registered A2A handler for agent '{agent_name}'")


_a2a_registry: dict = {}


def _build_handler(agent_name: str, config: dict, tools: list[str]):
    card_dict = build_agent_card_obj(agent_name, config, tools)

    agent_card = AgentCard(
        name=card_dict["name"],
        description=card_dict["description"],
        version=card_dict["version"],
        default_input_modes=card_dict["defaultInputModes"],
        default_output_modes=card_dict["defaultOutputModes"],
        capabilities=AgentCapabilities(streaming=True),
        skills=[
            AgentSkill(
                id=s["id"],
                name=s["name"],
                description=s["description"],
                input_modes=s.get("inputModes", ["text/plain"]),
                output_modes=s.get("outputModes", ["text/plain"]),
                tags=s.get("tags", []),
            )
            for s in card_dict["skills"]
        ],
        supported_interfaces=[
            AgentInterface(
                protocol_binding="JSONRPC",
                url=f"http://localhost:8080/a2a/{agent_name}",
                protocol_version="1.0",
            )
        ],
    )

    executor = GatewayAgentExecutor(agent_name)
    task_store = InMemoryTaskStore()
    handler = DefaultRequestHandler(
        agent_executor=executor,
        task_store=task_store,
        agent_card=agent_card,
    )
    return {"card": agent_card, "card_dict": card_dict, "handler": handler}


def get_a2a_handler(agent_name: str) -> dict | None:
    return _a2a_registry.get(agent_name)


def remove_a2a_handler(agent_name: str):
    _a2a_registry.pop(agent_name, None)
