import aiosqlite
from pathlib import Path

DB_PATH = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS agents (
    name TEXT PRIMARY KEY,
    config_yaml TEXT NOT NULL,
    soul_md TEXT NOT NULL,
    card_json TEXT,
    status TEXT DEFAULT 'idle',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'disconnected',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debug_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    protocol TEXT NOT NULL DEFAULT 'openai-completions',
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL DEFAULT '',
    models_json TEXT NOT NULL DEFAULT '[]',
    auto_fetch INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


async def init(data_dir: str):
    global DB_PATH
    Path(data_dir).mkdir(parents=True, exist_ok=True)
    DB_PATH = str(Path(data_dir) / "gateway.db")
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()


def get_db_path() -> str:
    assert DB_PATH is not None, "DB not initialized, call init() first"
    return DB_PATH
