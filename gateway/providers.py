"""
Provider registry: LLM providers (OpenAI, Anthropic, DeepSeek, OpenCode Go/Zen, custom).

Each provider stores base_url + api_key + a fetched model list.
Protocol defaults to openai-completions (Anthropic's official OpenAI-compat layer
speaks the same format, so a single AsyncOpenAI client serves all providers).
"""

import json
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import aiosqlite
import httpx

from gateway.config import settings
from gateway.db import get_db_path

MODEL_FETCH_TIMEOUT = 15
MODEL_CACHE_TTL = 60

PRESETS: dict[str, dict[str, Any]] = {
    "openai": {
        "name": "OpenAI",
        "protocol": "openai-completions",
        "base_url": "https://api.openai.com/v1",
        "api_key": "",
        "models": [],
    },
    "anthropic": {
        "name": "Anthropic Claude",
        "protocol": "openai-completions",
        "base_url": "https://api.anthropic.com/v1/",
        "api_key": "",
        "models": ["claude-sonnet-4-6", "claude-haiku-4-5"],
    },
    "deepseek": {
        "name": "DeepSeek",
        "protocol": "openai-completions",
        "base_url": "https://api.deepseek.com/v1",
        "api_key": "",
        "models": [],
    },
    "opencode-zen": {
        "name": "OpenCode Zen",
        "protocol": "openai-completions",
        "base_url": "https://opencode.ai/zen/v1",
        "api_key": "",
        "models": [],
    },
    "opencode-go": {
        "name": "OpenCode Go",
        "protocol": "openai-completions",
        "base_url": "https://opencode.ai/zen/go/v1",
        "api_key": "",
        "models": [],
    },
    "custom": {
        "name": "Custom (OpenAI-compatible)",
        "protocol": "openai-completions",
        "base_url": "",
        "api_key": "",
        "models": [],
    },
}

_model_cache: dict[str, dict] = {}


# ── helpers ───────────────────────────────────────────────────

def mask_key(key: str) -> str:
    """Return a masked form of an API key (never the plaintext)."""
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}****{key[-4:]}"


def _public_provider(row: aiosqlite.Row) -> dict:
    d = dict(row)
    d["has_key"] = bool(d.get("api_key", ""))
    d["api_key"] = mask_key(d.get("api_key", ""))
    try:
        d["models"] = json.loads(d.get("models_json", "[]"))
    except (json.JSONDecodeError, TypeError):
        d["models"] = []
    d.pop("models_json", None)
    return d


@asynccontextmanager
async def _connect() -> AsyncIterator[aiosqlite.Connection]:
    db = await aiosqlite.connect(get_db_path())
    db.row_factory = aiosqlite.Row
    try:
        yield db
        await db.commit()
    finally:
        await db.close()


# ── seed presets ───────────────────────────────────────────────

async def seed_presets():
    """Insert preset providers that don't exist yet, inheriting .env keys where relevant."""
    async with _connect() as db:
        for pid, preset in PRESETS.items():
            key = preset["api_key"]
            if pid == "deepseek":
                key = settings.openai_api_key
            cursor = await db.execute("SELECT id FROM providers WHERE id = ?", (pid,))
            if await cursor.fetchone():
                continue
            models = preset["models"]
            await db.execute(
                """INSERT OR REPLACE INTO providers
                   (id, name, protocol, base_url, api_key, models_json, auto_fetch)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (pid, preset["name"], preset["protocol"], preset["base_url"], key,
                 json.dumps(models), 1),
            )
        await db.commit()


# ── CRUD ──────────────────────────────────────────────────────

async def list_providers() -> list[dict]:
    async with _connect() as db:
        cursor = await db.execute(
            "SELECT id, name, protocol, base_url, api_key, models_json, auto_fetch, created_at, updated_at FROM providers ORDER BY name"
        )
        rows = await cursor.fetchall()
        return [_public_provider(r) for r in rows]


async def get_provider(pid: str) -> dict | None:
    async with _connect() as db:
        cursor = await db.execute("SELECT * FROM providers WHERE id = ?", (pid,))
        row = await cursor.fetchone()
        return _public_provider(row) if row else None


async def get_provider_with_key(pid: str) -> dict | None:
    """Internal: returns the provider with the plaintext api_key."""
    async with _connect() as db:
        cursor = await db.execute("SELECT * FROM providers WHERE id = ?", (pid,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def create_provider(pid: str, name: str, base_url: str, api_key: str,
                          protocol: str = "openai-completions",
                          models: list[str] | None = None,
                          auto_fetch: bool = True) -> dict:
    if not pid or not base_url:
        raise ValueError("id and base_url are required")
    async with _connect() as db:
        await db.execute(
            """INSERT OR REPLACE INTO providers
               (id, name, protocol, base_url, api_key, models_json, auto_fetch, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (pid, name, protocol, base_url, api_key,
             json.dumps(models or []), 1 if auto_fetch else 0),
        )
        await db.commit()
    return await get_provider(pid)  # type: ignore[return-value]


async def update_provider(pid: str, name: str | None = None, base_url: str | None = None,
                          api_key: str | None = None, protocol: str | None = None,
                          models: list[str] | None = None,
                          auto_fetch: bool | None = None) -> dict | None:
    existing = await get_provider_with_key(pid)
    if not existing:
        return None

    def g(field: str, fallback: Any) -> Any:
        return fallback if locals_val.get(field) is None else locals_val[field]

    locals_val = {"name": name, "base_url": base_url, "api_key": api_key,
                  "protocol": protocol, "auto_fetch": auto_fetch}
    new_name = g("name", existing["name"])
    new_base = g("base_url", existing["base_url"])
    new_key = g("api_key", existing["api_key"])
    new_protocol = g("protocol", existing["protocol"])
    new_auto = 1 if (existing["auto_fetch"] if auto_fetch is None else auto_fetch) else 0
    new_models = models if models is not None else json.loads(existing.get("models_json") or "[]")

    async with _connect() as db:
        await db.execute(
            """UPDATE providers SET name = ?, protocol = ?, base_url = ?, api_key = ?,
               models_json = ?, auto_fetch = ?, updated_at = datetime('now')
               WHERE id = ?""",
            (new_name, new_protocol, new_base, new_key,
             json.dumps(new_models), new_auto, pid),
        )
        await db.commit()
    return await get_provider(pid)


async def delete_provider(pid: str) -> bool:
    async with _connect() as db:
        cursor = await db.execute("DELETE FROM providers WHERE id = ?", (pid,))
        await db.commit()
        return cursor.rowcount > 0


# ── model discovery ────────────────────────────────────────────

async def fetch_models(base_url: str, api_key: str = "", protocol: str = "openai-completions") -> list[str]:
    """
    Fetch the available model list for a provider.

    Tries standard /models, falls back to provider-specific paths.
    Returns a list of model ids (empty list on failure, never raises).
    """
    base = base_url.rstrip("/")
    candidates: list[str] = []
    if protocol == "openai-completions":
        candidates = [f"{base}/models", f"{base}/v1/models", f"{base}/openai/v1/models"]
    else:
        candidates = [f"{base}/v1/models", f"{base}/models"]

    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=MODEL_FETCH_TIMEOUT, follow_redirects=True) as client:
        for url in candidates:
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code >= 400:
                    continue
                return _parse_model_list(resp.json())
            except Exception as e:  # noqa: BLE001
                last_error = e
    return []


def _parse_model_list(payload: dict) -> list[str]:
    """Lenient parser: read data[] (or models[]), require id. Ignores wrapper fields."""
    raw = payload.get("data") or payload.get("models") or []
    ids: list[str] = []
    for item in raw:
        if isinstance(item, dict) and item.get("id"):
            ids.append(item["id"])
    # OpenRouter-style nested, just in case
    if not ids and isinstance(payload.get("data"), dict):
        data = payload["data"]
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get("id"):
                    ids.append(item["id"])
    return ids


async def test_connection(pid: str) -> dict:
    """Probe a provider by fetching its model list. Passes upstream errors through."""
    provider = await get_provider_with_key(pid)
    if not provider:
        return {"ok": False, "error": "Provider not found"}

    base = provider["base_url"].rstrip("/")
    if not base:
        return {"ok": False, "error": "base_url is not set"}

    api_key = provider.get("api_key", "")
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    urls = [f"{base}/models", f"{base}/v1/models"]
    if "api.deepseek.com" in base and not base.endswith("/v1"):
        urls = [f"{base}/models", f"{base}/v1/models"]

    last_error: str = "Connection failed"
    async with httpx.AsyncClient(timeout=MODEL_FETCH_TIMEOUT, follow_redirects=True) as client:
        for url in urls:
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code < 400:
                    models = _parse_model_list(resp.json())
                    return {"ok": True, "models": models, "url": url}
                last_error = f"{resp.status_code} {resp.text[:300]}"
            except Exception as e:  # noqa: BLE001
                last_error = str(e)
    return {"ok": False, "error": last_error}


async def get_cached_models(pid: str) -> list[str]:
    """Return models with a short TTL cache."""
    now = time.time()
    cached = _model_cache.get(pid)
    if cached and now - cached["ts"] < MODEL_CACHE_TTL:
        return cached["models"]

    provider = await get_provider_with_key(pid)
    if not provider:
        return []
    models = json.loads(provider.get("models_json") or "[]")
    if not models and provider.get("auto_fetch"):
        models = await fetch_models(provider["base_url"], provider.get("api_key", ""), provider.get("protocol", "openai-completions"))
        if models:
            await update_provider(pid, models=models)
    _model_cache[pid] = {"ts": now, "models": models}
    return models
