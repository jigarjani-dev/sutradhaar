"""Per-agent Telegram bot credentials and allowed chat IDs."""

import json
from datetime import datetime, timezone

import aiosqlite

from gateway.db import get_db_path


async def get_by_agent(agent_name: str) -> dict | None:
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM agent_telegram WHERE agent_name = ?", (agent_name,))
        row = await cur.fetchone()
        return dict(row) if row else None


async def find_agent_for_token(bot_token: str, exclude_agent: str | None = None) -> str | None:
    async with aiosqlite.connect(get_db_path()) as db:
        if exclude_agent:
            cur = await db.execute(
                "SELECT agent_name FROM agent_telegram WHERE bot_token = ? AND agent_name != ?",
                (bot_token, exclude_agent),
            )
        else:
            cur = await db.execute(
                "SELECT agent_name FROM agent_telegram WHERE bot_token = ?",
                (bot_token,),
            )
        row = await cur.fetchone()
        return row[0] if row else None


async def list_all() -> list[dict]:
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT * FROM agent_telegram")
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


async def upsert(
    agent_name: str,
    bot_token: str,
    bot_username: str,
    *,
    status: str = "pending_chat",
    allowed_chat_ids: list[int] | None = None,
    poll_offset: int = 0,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    chats = json.dumps(allowed_chat_ids or [])
    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            """
            INSERT INTO agent_telegram (
                agent_name, bot_token, bot_username, allowed_chat_ids, poll_offset, status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(agent_name) DO UPDATE SET
                bot_token = excluded.bot_token,
                bot_username = excluded.bot_username,
                allowed_chat_ids = excluded.allowed_chat_ids,
                poll_offset = excluded.poll_offset,
                status = excluded.status,
                updated_at = excluded.updated_at
            """,
            (agent_name, bot_token, bot_username, chats, poll_offset, status, now),
        )
        await db.commit()
    row = await get_by_agent(agent_name)
    assert row is not None
    return row


async def delete(agent_name: str) -> bool:
    async with aiosqlite.connect(get_db_path()) as db:
        cur = await db.execute("DELETE FROM agent_telegram WHERE agent_name = ?", (agent_name,))
        await db.commit()
        return cur.rowcount > 0


async def set_poll_offset(agent_name: str, offset: int) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            "UPDATE agent_telegram SET poll_offset = ?, updated_at = ? WHERE agent_name = ?",
            (offset, now, agent_name),
        )
        await db.commit()


async def add_chat_id(agent_name: str, chat_id: int) -> list[int]:
    row = await get_by_agent(agent_name)
    if not row:
        return []
    ids = _parse_chat_ids(row.get("allowed_chat_ids"))
    if chat_id not in ids:
        ids.append(chat_id)
    now = datetime.now(timezone.utc).isoformat()
    status = "connected"
    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            """
            UPDATE agent_telegram
            SET allowed_chat_ids = ?, status = ?, updated_at = ?
            WHERE agent_name = ?
            """,
            (json.dumps(ids), status, now, agent_name),
        )
        await db.commit()
    return ids


def _parse_chat_ids(raw: str | None) -> list[int]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return [int(x) for x in data]
    except (json.JSONDecodeError, TypeError, ValueError):
        return []


def public_status(row: dict | None) -> dict:
    if not row:
        return {
            "connected": False,
            "status": "disconnected",
            "bot_username": None,
            "allowed_chat_ids": [],
        }
    ids = _parse_chat_ids(row.get("allowed_chat_ids"))
    st = row.get("status") or "pending_chat"
    return {
        "connected": st == "connected" and bool(ids),
        "status": st,
        "bot_username": row.get("bot_username"),
        "allowed_chat_ids": ids,
        "has_token": bool(row.get("bot_token")),
    }
