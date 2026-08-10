"""Handoff worker uses the target agent's persisted memory like normal chat."""

import pytest

from gateway.db import init
from gateway.handoff import _run_worker
from gateway.memory import add_message
from gateway.registry import create_agent
from gateway.ws import ws_manager


@pytest.fixture(autouse=True)
async def setup_db(isolate_data_dir):
    await init(isolate_data_dir)


async def test_run_worker_builds_context_from_history(monkeypatch):
    await create_agent(
        name="lakshmi",
        soul_md="# Lakshmi\n\nFinance memory agent.",
        tools=[],
        model="test-model",
    )
    await add_message("lakshmi", "user", "Coffee this morning was 42 rupees.")
    await add_message("lakshmi", "assistant", "Logged coffee at 42.")

    captured: dict = {}

    async def fake_chat(messages, **kwargs):
        captured["messages"] = messages
        return "From memory: 42 rupees on coffee."

    async def noop(*_args, **_kwargs):
        return None

    async def fake_prompt(_config):
        return "SYSTEM"

    monkeypatch.setattr("gateway.handoff.llm_engine.chat", fake_chat)
    monkeypatch.setattr("gateway.handoff.build_system_prompt", fake_prompt)
    monkeypatch.setattr(ws_manager, "emit_message", noop)
    monkeypatch.setattr(ws_manager, "emit_agent_status", noop)
    monkeypatch.setattr(ws_manager, "emit_debug", noop)

    reply = await _run_worker("orchestrator", "lakshmi", "What did I spend on coffee?")

    assert reply == "From memory: 42 rupees on coffee."
    user_text = " ".join(
        m["content"] for m in captured["messages"] if m["role"] == "user"
    )
    assert "42 rupees" in user_text
    assert "Handoff from orchestrator" in user_text
    assert "What did I spend on coffee?" in user_text
