import json
import yaml
import aiosqlite
from pathlib import Path
from datetime import datetime, timezone
from gateway.db import get_db_path
from gateway.config import settings
from gateway.cardgen import build_agent_card


async def list_agents() -> list[dict]:
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT name, config_yaml, soul_md, card_json, status, created_at, updated_at FROM agents ORDER BY created_at"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_agent(name: str) -> dict | None:
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM agents WHERE name = ?", (name,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def create_agent(name: str, soul_md: str, tools: list[str], model: str,
                        handoff_enabled: bool = False, handoff_targets: list[str] | None = None,
                        orchestrator_enabled: bool = False, orchestrator_rules: list[dict] | None = None,
                        description: str = "", mcp_servers: list[dict] | None = None) -> dict:
    config = {
        "name": name,
        "model": model,
        "description": description or name,
        "tools": tools,
        "handoff": {
            "enabled": handoff_enabled,
            "targets": handoff_targets or [],
        },
        "orchestrator": {
            "enabled": orchestrator_enabled,
            "rules": orchestrator_rules or [],
        },
        "mcp_servers": mcp_servers or [],
    }

    config_yaml = yaml.dump(config, default_flow_style=False, sort_keys=False)
    card = build_agent_card(config, soul_md)
    card_json = json.dumps(card)

    now = datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            """INSERT OR REPLACE INTO agents (name, config_yaml, soul_md, card_json, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'idle', ?, ?)""",
            (name, config_yaml, soul_md, card_json, now, now),
        )
        await db.commit()

    # write files for take-home portability
    agent_dir = Path(settings.data_dir) / "agents" / name
    agent_dir.mkdir(parents=True, exist_ok=True)
    (agent_dir / "agent.yaml").write_text(config_yaml)
    (agent_dir / "SOUL.md").write_text(soul_md)

    return {
        "name": name,
        "config": config,
        "soul_md": soul_md,
        "card_json": card,
        "status": "idle",
        "created_at": now,
    }


async def update_agent(name: str, soul_md: str | None = None, tools: list[str] | None = None,
                        model: str | None = None, handoff_enabled: bool | None = None,
                        handoff_targets: list[str] | None = None, description: str | None = None) -> dict | None:
    existing = await get_agent(name)
    if not existing:
        return None

    config = yaml.safe_load(existing["config_yaml"])
    if soul_md is not None:
        existing["soul_md"] = soul_md
    if tools is not None:
        config["tools"] = tools
    if model is not None:
        config["model"] = model
    if handoff_enabled is not None:
        config["handoff"]["enabled"] = handoff_enabled
    if handoff_targets is not None:
        config["handoff"]["targets"] = handoff_targets
    if description is not None:
        config["description"] = description

    config_yaml = yaml.dump(config, default_flow_style=False, sort_keys=False)
    card = build_agent_card(config, existing["soul_md"])
    card_json = json.dumps(card)
    now = datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            "UPDATE agents SET config_yaml = ?, soul_md = ?, card_json = ?, updated_at = ? WHERE name = ?",
            (config_yaml, existing["soul_md"], card_json, now, name),
        )
        await db.commit()

    agent_dir = Path(settings.data_dir) / "agents" / name
    agent_dir.mkdir(parents=True, exist_ok=True)
    (agent_dir / "agent.yaml").write_text(config_yaml)
    (agent_dir / "SOUL.md").write_text(existing["soul_md"])

    existing["config_yaml"] = config_yaml
    existing["card_json"] = card_json
    existing["updated_at"] = now
    return existing


async def delete_agent(name: str) -> bool:
    async with aiosqlite.connect(get_db_path()) as db:
        cursor = await db.execute("DELETE FROM agents WHERE name = ?", (name,))
        await db.commit()
        deleted = cursor.rowcount > 0

    if deleted:
        # clean up files
        agent_dir = Path(settings.data_dir) / "agents" / name
        import shutil
        if agent_dir.exists():
            shutil.rmtree(agent_dir)

    return deleted


async def set_agent_status(name: str, status: str):
    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute("UPDATE agents SET status = ? WHERE name = ?", (status, name))
        await db.commit()
