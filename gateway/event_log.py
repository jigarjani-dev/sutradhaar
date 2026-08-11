"""Persist dashboard events for the debug log panel."""

import json
import logging

import aiosqlite

from gateway.db import get_db_path

logger = logging.getLogger(__name__)


async def record_event(agent_name: str | None, event_type: str, payload: dict) -> None:
    try:
        async with aiosqlite.connect(get_db_path()) as db:
            await db.execute(
                "INSERT INTO debug_logs (agent_name, event_type, payload_json) VALUES (?, ?, ?)",
                (agent_name, event_type, json.dumps(payload, default=str)),
            )
            await db.commit()
    except Exception as e:
        logger.warning("debug log persist failed: %s", e)
