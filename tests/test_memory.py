"""Tests for gateway/memory.py: history persistence + context building."""

import pytest

from gateway.memory import (
    add_message,
    get_history,
    clear_history,
    build_context,
    estimate_tokens,
    format_history_for_api,
)
from gateway.db import init, get_db_path


@pytest.fixture(autouse=True)
async def setup_db(isolate_data_dir):
    await init(isolate_data_dir)


async def test_add_and_get_history(isolate_data_dir):
    await add_message("a1", "user", "hello")
    await add_message("a1", "assistant", "hi there")
    history = await get_history("a1")
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["content"] == "hi there"


async def test_history_scoped_per_agent(isolate_data_dir):
    await add_message("a1", "user", "one")
    await add_message("a2", "user", "two")
    assert len(await get_history("a1")) == 1
    assert len(await get_history("a2")) == 1


async def test_clear_history(isolate_data_dir):
    await add_message("a1", "user", "hello")
    await clear_history("a1")
    assert await get_history("a1") == []


def test_build_context_pins_system_prompt():
    msgs = [
        {"id": 1, "role": "user", "content": "a" * 2000},
        {"id": 2, "role": "assistant", "content": "b" * 2000},
    ]
    ctx = build_context(msgs, "SYSTEM", max_tokens=500)
    assert ctx[0] == {"role": "system", "content": "SYSTEM"}
    assert len(ctx) == 1  # history dropped because it exceeds budget


def test_build_context_keeps_recent_within_budget():
    msgs = [
        {"id": 1, "role": "user", "content": "small"},
        {"id": 2, "role": "assistant", "content": "reply"},
    ]
    ctx = build_context(msgs, "SYSTEM", max_tokens=10000)
    assert ctx[1]["role"] == "user"
    assert ctx[2]["content"] == "reply"


def test_build_context_excludes_thinking():
    msgs = [
        {"id": 1, "role": "user", "content": "q"},
        {"id": 2, "role": "thinking", "content": "secret reasoning"},
        {"id": 3, "role": "assistant", "content": "answer"},
    ]
    ctx = build_context(msgs, "SYSTEM", max_tokens=10000)
    contents = [m["content"] for m in ctx]
    assert "secret reasoning" not in contents
    assert "answer" in contents


def test_build_context_includes_summary():
    msgs = [
        {"id": 1, "role": "user", "content": "old"},
    ]
    summary = {"replaces_up_to": 1, "summary": "Recap of earlier turns."}
    ctx = build_context(msgs, "SYSTEM", summary, max_tokens=10000)
    assert any("Recap of earlier turns" in m["content"] for m in ctx if m["role"] == "system")


def test_estimate_tokens():
    assert estimate_tokens("") == 0
    assert estimate_tokens("abcd") == 1
    assert estimate_tokens("abcdefgh") == 2


def test_format_history():
    msgs = [{"id": 5, "role": "user", "content": "x"}]
    out = format_history_for_api(msgs)
    assert out == [{"id": 5, "role": "user", "content": "x"}]
