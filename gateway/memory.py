"""
Conversation memory: persists chat history per agent and rebuilds LLM context
from it on each turn, so agents remember what was said before.

Approach (minimal, OpenClaw-flavored):
- One ongoing thread per agent (no sessions/titles).
- System prompt pinned first, then most-recent messages filled against a
  token budget (never the system prompt).
- When raw history exceeds the budget, older turns are summarized by the LLM
  into a single "conversation summary" system message; recent turns stay
  verbatim. If summarization fails, falls back to truncation.
"""

import json

import aiosqlite

from gateway.db import get_db_path

HISTORY_BUDGET = 32_000      # token budget for conversation history
SUMMARY_TRIGGER = 24_000     # summarize once raw history exceeds this
KEEP_RECENT_TURNS = 10       # recent turns kept verbatim after a summary


def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    if not text:
        return 0
    return max(1, len(text) // 4)


async def add_message(agent_name: str, role: str, content: str, sender: str | None = None):
    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            "INSERT INTO messages (agent_name, role, content, sender) VALUES (?, ?, ?, ?)",
            (agent_name, role, content, sender),
        )
        await db.commit()


async def get_history(agent_name: str) -> list[dict]:
    """Return all messages for an agent, oldest first, with ids."""
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, agent_name, role, content, sender FROM messages WHERE agent_name = ? ORDER BY id",
            (agent_name,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_latest_summary(agent_name: str) -> dict | None:
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT replaces_up_to, summary FROM summaries WHERE agent_name = ?",
            (agent_name,),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def save_summary(agent_name: str, replaces_up_to: int, summary: str):
    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            """INSERT OR REPLACE INTO summaries (agent_name, replaces_up_to, summary, created_at)
               VALUES (?, ?, ?, datetime('now'))""",
            (agent_name, replaces_up_to, summary),
        )
        await db.commit()


async def clear_history(agent_name: str):
    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute("DELETE FROM messages WHERE agent_name = ?", (agent_name,))
        await db.execute("DELETE FROM summaries WHERE agent_name = ?", (agent_name,))
        await db.commit()


def _history_tokens(messages: list[dict]) -> int:
    return sum(estimate_tokens(m["content"] or "") for m in messages)


def build_context(messages: list[dict], system_prompt: str,
                  summary: dict | None = None,
                  max_tokens: int = HISTORY_BUDGET) -> list[dict]:
    """
    Build the LLM message array for an agent.

    Order: [system] -> [summary] -> recent messages (newest-first fill) -> ...
    The system prompt is pinned and never slid out.
    """
    out: list[dict] = [{"role": "system", "content": system_prompt}]

    budget = max_tokens - estimate_tokens(system_prompt)

    if summary and summary.get("summary"):
        summary_msg = {
            "role": "system",
            "content": (
                "[CONVERSATION SUMMARY - replaces earlier turns up to "
                f"message {summary['replaces_up_to']}]\n{summary['summary']}"
            ),
        }
        out.append(summary_msg)
        budget -= estimate_tokens(summary_msg["content"])

    # fill from most recent backward against budget
    kept: list[dict] = []
    for m in reversed(messages):
        if m.get("role") == "thinking":
            continue  # thinking is display-only, never sent back to the model
        cost = estimate_tokens(m.get("content") or "")
        if cost > budget:
            break
        role = m["role"]
        if role == "handoff_in":
            role = "user"
        kept.append({"role": role, "content": m["content"]})
        budget -= cost
    kept.reverse()

    return out + kept


async def summarize_old_turns(agent_name: str, llm_engine, model: str,
                              provider: str | None, provider_override: dict | None,
                              keep_recent: int = KEEP_RECENT_TURNS) -> bool:
    """
    If raw history exceeds the trigger budget, summarize the oldest turns
    into a stored summary. Returns True if a summary was created.
    """
    history = await get_history(agent_name)
    if not history or _history_tokens(history) <= SUMMARY_TRIGGER:
        return False

    existing = await get_latest_summary(agent_name)
    cutoff = existing["replaces_up_to"] if existing else 0

    # split: older (to summarize) vs recent (keep verbatim)
    old = [m for m in history if m["id"] <= cutoff]
    recent = [m for m in history if m["id"] > cutoff]

    # recent already covers the whole thread -> nothing new to summarize
    if not recent:
        return False

    # only summarize turns before the last N recent turns
    to_summarize = recent[:-keep_recent] if len(recent) > keep_recent else []
    if not to_summarize:
        return False

    conversation = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in to_summarize
    )

    prompt = (
        "Summarize the following conversation into a concise recap for a "
        "continuing AI assistant session. Keep: key facts, decisions, numbers, "
        "errors and fixes, and the current task state. Drop: small talk and "
        "transitional messages. Output only the summary text.\n\n"
        f"<conversation>\n{conversation[:8000]}\n</conversation>"
    )

    try:
        text = await llm_engine.chat(
            [{"role": "user", "content": prompt}],
            model=model,
            provider=provider,
            provider_override=provider_override,
        )
    except Exception:
        return False

    if not text or len(text.strip()) < 20:
        return False

    replaces_up_to = to_summarize[-1]["id"]
    await save_summary(agent_name, replaces_up_to, text.strip())

    # prune summarized rows to keep the table small (id <= replaces_up_to)
    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            "DELETE FROM messages WHERE agent_name = ? AND id <= ?",
            (agent_name, replaces_up_to),
        )
        await db.commit()

    return True


def format_history_for_api(messages: list[dict]) -> list[dict]:
    """Expose stored messages to the frontend (id, role, content, sender)."""
    out = []
    for m in messages:
        row = {"id": m["id"], "role": m["role"], "content": m["content"]}
        if m.get("sender"):
            row["sender"] = m["sender"]
        out.append(row)
    return out
