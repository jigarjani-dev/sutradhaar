"""Orchestrator routing: keyword rules and handoff target allowlist."""

import pytest

from gateway.handoff import (
    _orchestrator_allowed_targets,
    _resolve_routing_target,
    _format_orchestrator_routing_prompt,
    run_orchestrator,
)
from gateway.db import init
from gateway.registry import create_agent


@pytest.fixture(autouse=True)
async def setup_db(isolate_data_dir):
    await init(isolate_data_dir)


def test_allowed_targets_from_handoff_list():
    config = {
        "handoff": {"enabled": True, "targets": ["lakshmi", "ba-agent"]},
        "orchestrator": {
            "enabled": True,
            "rules": [
                {"match": ["expense"], "target": "lakshmi"},
                {"match": ["build"], "target": "ba-agent"},
            ],
        },
    }
    assert _orchestrator_allowed_targets(config) == ["lakshmi", "ba-agent"]


def test_resolve_routing_target():
    allowed = ["lakshmi", "ba-agent"]
    assert _resolve_routing_target("lakshmi", allowed) == "lakshmi"
    assert _resolve_routing_target("Route to lakshmi.", allowed) == "lakshmi"
    assert _resolve_routing_target("dummy1", allowed) is None


def test_routing_prompt_includes_agent_descriptions():
    prompt = _format_orchestrator_routing_prompt(
        [
            {"name": "lakshmi", "description": "Personal finance and expenses", "persona": "Track spending"},
            {"name": "ba-agent", "description": "Business analyst", "persona": "Write user stories"},
        ],
        [{"match": ["expense"], "target": "lakshmi"}],
    )
    assert "Personal finance" in prompt
    assert "Business analyst" in prompt
    assert "lakshmi" in prompt


async def test_llm_fallback_cannot_route_outside_handoff_targets(monkeypatch):
    await create_agent(
        name="orchestrator",
        soul_md="# o",
        tools=[],
        model="m",
        handoff_enabled=True,
        handoff_targets=["lakshmi", "ba-agent"],
        orchestrator_enabled=True,
        orchestrator_rules=[
            {"match": ["expense"], "target": "lakshmi"},
        ],
    )
    await create_agent(name="dummy1", soul_md="# d", tools=[], model="m")
    await create_agent(
        name="lakshmi",
        soul_md="# Lakshmi\n\nTracks expenses and budgets.",
        tools=[],
        model="m",
        description="Personal finance, expenses, and spending memory",
    )
    await create_agent(
        name="ba-agent",
        soul_md="# BA",
        tools=[],
        model="m",
        description="Software requirements and user stories",
    )

    handoffs: list[tuple[str, str]] = []
    captured: dict = {}

    async def fake_execute(from_agent, to_agent, user_message, delegation_note=""):
        handoffs.append((from_agent, to_agent))
        return f"ok:{to_agent}"

    async def fake_llm_chat(messages, **kwargs):
        captured["messages"] = messages
        return "dummy1"

    async def noop(*_a, **_k):
        return None

    monkeypatch.setattr("gateway.handoff.execute_handoff", fake_execute)
    monkeypatch.setattr("gateway.handoff.llm_engine.chat", fake_llm_chat)
    monkeypatch.setattr("gateway.handoff.ws_manager.emit_debug", noop)

    result = await run_orchestrator("orchestrator", "31 on tea")

    assert handoffs == []
    system = captured["messages"][0]["content"]
    assert "Personal finance" in system
    assert "Could not route" in result or "Allowed handoff targets" in result


async def test_description_routing_hands_off_to_finance_agent(monkeypatch):
    await create_agent(
        name="orchestrator",
        soul_md="# o",
        tools=[],
        model="m",
        handoff_enabled=True,
        handoff_targets=["lakshmi", "ba-agent"],
        orchestrator_enabled=True,
        orchestrator_rules=[],
    )
    await create_agent(
        name="lakshmi",
        soul_md="# Lakshmi\n\nFinance.",
        tools=[],
        model="m",
        description="Personal finance and expense tracking",
    )
    await create_agent(name="ba-agent", soul_md="# BA", tools=[], model="m", description="Requirements")

    handoffs: list[tuple[str, str]] = []

    async def fake_execute(from_agent, to_agent, user_message, delegation_note=""):
        handoffs.append((from_agent, to_agent))
        return "logged"

    async def fake_llm_chat(messages, **kwargs):
        return "lakshmi"

    async def noop(*_a, **_k):
        return None

    monkeypatch.setattr("gateway.handoff.execute_handoff", fake_execute)
    monkeypatch.setattr("gateway.handoff.llm_engine.chat", fake_llm_chat)
    monkeypatch.setattr("gateway.handoff.ws_manager.emit_debug", noop)

    await run_orchestrator("orchestrator", "31 on tea")
    assert handoffs == [("orchestrator", "lakshmi")]
