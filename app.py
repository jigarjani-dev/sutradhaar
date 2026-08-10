"""
Workshop Agent Gateway -- main FastAPI application.

Single entry point that serves:
- Dashboard SPA at /
- REST API at /api/*
- A2A protocol endpoints at /a2a/{agent}/*
- WebSocket at /ws

Usage:
    uvicorn app:app --host 0.0.0.0 --port 8080
"""

import json
import logging
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from gateway.config import settings
from gateway.db import init as db_init
from gateway.registry import (
    list_agents, get_agent, create_agent, update_agent, delete_agent, set_agent_status,
)
from gateway.llm import LLMEngine
from gateway.loader import build_system_prompt
from gateway.a2a import register_agent_a2a_routes, get_a2a_handler, remove_a2a_handler
from gateway.ws import ws_manager
from gateway.handoff import execute_handoff, run_orchestrator
from gateway.providers import (
    seed_presets, list_providers, get_provider, create_provider, update_provider,
    delete_provider, test_connection, fetch_models,
)
from gateway.memory import (
    add_message, get_history, get_latest_summary, clear_history,
    build_context, summarize_old_turns, format_history_for_api,
)
from gateway.mcp import mcp_bridge, get_server_config, save_server_config, reload_servers
from gateway.skills import list_skills, get_skill

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

llm_engine = LLMEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Sutradhaar...")
    await db_init(settings.data_dir)
    await seed_presets()
    await mcp_bridge.start()
    # re-register A2A routes for existing agents
    agents = await list_agents()
    for agent in agents:
        import yaml
        config = yaml.safe_load(agent["config_yaml"])
        tools = config.get("tools", [])
        register_agent_a2a_routes(app, agent["name"], config, tools)
    logger.info(f"Gateway ready on port {settings.port}. {len(agents)} agent(s) loaded.")
    yield
    await mcp_bridge.stop()
    logger.info("Shutting down.")


app = FastAPI(
    title="Sutradhaar",
    version="1.0.0",
    lifespan=lifespan,
)


# ── WebSocket ──────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)


# ── Agent CRUD ─────────────────────────────────────────────────

@app.get("/api/agents")
async def api_list_agents():
    agents = await list_agents()
    for a in agents:
        a["card_url"] = f"/a2a/{a['name']}/.well-known/agent.json"
        a["tools"], a["orchestrator"], a["handoff_targets"], a["orchestrator_rules"], a["skills"], a["mcp_servers"] = _extract_agent_meta(a)
    return agents


@app.get("/api/agents/{name}")
async def api_get_agent(name: str):
    agent = await get_agent(name)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent["card_url"] = f"/a2a/{name}/.well-known/agent.json"
    agent["tools"], agent["orchestrator"], agent["handoff_targets"], agent["orchestrator_rules"], agent["skills"], agent["mcp_servers"] = _extract_agent_meta(agent)
    return agent


def _extract_agent_meta(agent: dict) -> tuple[list[str], bool, list[str], list[dict], list[str], list[dict]]:
    """Pull tools + orchestrator flag + handoff targets + rules + skills + mcp."""
    try:
        import yaml
        config = yaml.safe_load(agent.get("config_yaml") or "{}") or {}
        tools = config.get("tools", [])
        orch_cfg = config.get("orchestrator") or {}
        orch = bool(orch_cfg.get("enabled"))
        handoff = (config.get("handoff") or {}).get("targets", [])
        rules = orch_cfg.get("rules", [])
        skills = config.get("skills", [])
        mcp_servers = config.get("mcp_servers", [])
        return tools, orch, handoff, rules, skills, mcp_servers
    except Exception:
        return [], False, [], [], [], []


def _agent_capability_refs(config: dict) -> list[str]:
    """Full list of capability references for an agent: skills + mcp servers + legacy tools."""
    refs: list[str] = list(config.get("skills", []))
    for m in config.get("mcp_servers", []):
        if isinstance(m, str):
            refs.append(m)
        elif isinstance(m, dict) and m.get("name"):
            refs.append(m["name"])
    refs.extend(config.get("tools", []))
    return refs


@app.post("/api/agents")
async def api_create_agent(data: dict):
    name = data.get("name", "").strip().lower()
    if not name or not re.match(r'^[a-z0-9_-]+$', name):
        raise HTTPException(status_code=400, detail="Invalid agent name. Use lowercase letters, numbers, hyphens, underscores.")

    existing = await get_agent(name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Agent '{name}' already exists")

    soul_md = data.get("soul_md", f"# {name}\n\nYou are a helpful assistant named {name}.")
    tools = data.get("tools", [])
    model = data.get("model", settings.llm_model)
    handoff_enabled = data.get("handoff_enabled", False)
    handoff_targets = data.get("handoff_targets", [])
    orchestrator_enabled = data.get("orchestrator_enabled", False)
    orchestrator_rules = data.get("orchestrator_rules", [])
    description = data.get("description", name)
    provider = data.get("provider")
    provider_override = data.get("provider_override")
    skills = data.get("skills", [])
    mcp_servers = data.get("mcp_servers", [])

    agent = await create_agent(
        name=name, soul_md=soul_md, tools=tools, model=model,
        handoff_enabled=handoff_enabled, handoff_targets=handoff_targets,
        orchestrator_enabled=orchestrator_enabled,
        orchestrator_rules=orchestrator_rules,
        description=description, mcp_servers=mcp_servers,
        provider=provider, provider_override=provider_override,
        skills=skills,
    )

    # register A2A routes
    config = agent.get("config", {})
    if not config and agent.get("config_yaml"):
        import yaml
        config = yaml.safe_load(agent["config_yaml"])
    register_agent_a2a_routes(app, name, config, tools)

    await ws_manager.emit_agent_created({"name": name, "status": "idle"})
    await ws_manager.emit_debug("system", "agent_created", {"name": name})

    agent["card_url"] = f"/a2a/{name}/.well-known/agent.json"
    return agent


@app.put("/api/agents/{name}")
async def api_update_agent(name: str, data: dict):
    agent = await update_agent(
        name=name,
        soul_md=data.get("soul_md"),
        tools=data.get("tools"),
        model=data.get("model"),
        handoff_enabled=data.get("handoff_enabled"),
        handoff_targets=data.get("handoff_targets"),
        description=data.get("description"),
        provider=data.get("provider"),
        provider_override=data.get("provider_override"),
        skills=data.get("skills"),
        mcp_servers=data.get("mcp_servers"),
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await ws_manager.emit_debug("system", "agent_updated", {"name": name})
    return agent


@app.delete("/api/agents/{name}")
async def api_delete_agent(name: str):
    deleted = await delete_agent(name)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")
    remove_a2a_handler(name)
    await ws_manager.emit_agent_deleted(name)
    await ws_manager.emit_debug("system", "agent_deleted", {"name": name})
    return {"deleted": name}


# ── Chat ───────────────────────────────────────────────────────

@app.post("/api/agents/{name}/chat")
async def api_chat(name: str, data: dict):
    agent = await get_agent(name)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    import yaml
    config = yaml.safe_load(agent["config_yaml"])
    config["_soul_md"] = agent["soul_md"]

    user_message = data.get("message", "")
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")

    await set_agent_status(name, "thinking")
    await ws_manager.emit_agent_status(name, "thinking")
    await ws_manager.emit_message(name, "user", user_message)

    try:
        system_prompt = await build_system_prompt(config)
        await add_message(name, "user", user_message)

        # rebuild context from persisted history
        history = await get_history(name)
        summary = await get_latest_summary(name)
        messages = build_context(history, system_prompt, summary)

        tools = _agent_capability_refs(config)

        thinking_parts: list[str] = []

        async def on_thinking(text: str):
            thinking_parts.append(text)
            await ws_manager.emit_thinking(name, text)

        # check if this is an orchestrator
        orchestrator_config = config.get("orchestrator", {})
        if orchestrator_config.get("enabled") and orchestrator_config.get("rules"):
            response = await run_orchestrator(name, user_message)
        else:
            response = await llm_engine.chat(
                messages, tools=tools, model=config.get("model"),
                provider=config.get("provider"),
                provider_override=config.get("provider_override"),
                agent_name=name,
                on_thinking=on_thinking,
            )

        if thinking_parts:
            await add_message(name, "thinking", "\n".join(thinking_parts))

        # check for handoff directive and process it
        handoff_match = re.search(r'---HANDOFF:\s*([\w-]+)\s*---', response)
        if handoff_match:
            target = handoff_match.group(1)
            clean_response = re.sub(r'---HANDOFF:\s*[\w-]+\s*---', '', response).strip()
            full_response = await execute_handoff(
                name, target, user_message, delegation_note=clean_response
            )
        else:
            full_response = response

        await add_message(name, "assistant", full_response)

        # summarize old turns if history outgrew the budget (best-effort)
        await summarize_old_turns(
            name, llm_engine, model=config.get("model") or settings.llm_model,
            provider=config.get("provider"),
            provider_override=config.get("provider_override"),
        )

        await set_agent_status(name, "idle")
        await ws_manager.emit_agent_status(name, "idle")
        await ws_manager.emit_message(name, "assistant", full_response)

        return {"agent": name, "response": full_response, "thinking": "\n".join(thinking_parts) or None}

    except Exception as e:
        logger.exception(f"Chat error for agent {name}")
        await set_agent_status(name, "error", error=str(e))
        await ws_manager.emit_agent_status(name, "error", error=str(e))
        await ws_manager.emit_debug(name, "error", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/{name}/chat/stream")
async def api_chat_stream(name: str, data: dict):
    """Streaming chat endpoint using Server-Sent Events."""
    from fastapi.responses import StreamingResponse

    agent = await get_agent(name)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    import yaml
    config = yaml.safe_load(agent["config_yaml"])
    config["_soul_md"] = agent["soul_md"]

    user_message = data.get("message", "")
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")

    system_prompt = await build_system_prompt(config)
    await add_message(name, "user", user_message)
    history = await get_history(name)
    summary = await get_latest_summary(name)
    messages = build_context(history, system_prompt, summary)
    tools = _agent_capability_refs(config)

    async def generate():
        await set_agent_status(name, "thinking")
        await ws_manager.emit_agent_status(name, "thinking")
        await ws_manager.emit_message(name, "user", user_message)
        thinking_parts: list[str] = []

        async def on_thinking(text: str):
            thinking_parts.append(text)
            await ws_manager.emit_thinking(name, text)

        try:
            async for chunk in llm_engine.chat_stream(
                messages, tools=tools, model=config.get("model"),
                provider=config.get("provider"),
                provider_override=config.get("provider_override"),
                agent_name=name,
                on_thinking=on_thinking,
            ):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            if thinking_parts:
                await add_message(name, "thinking", "\n".join(thinking_parts))
            yield "data: [DONE]\n\n"
        except Exception as e:
            await set_agent_status(name, "error", error=str(e))
            await ws_manager.emit_agent_status(name, "error", error=str(e))
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            await set_agent_status(name, "idle")
            await ws_manager.emit_agent_status(name, "idle")

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Chat history ───────────────────────────────────────────────

@app.get("/api/agents/{name}/messages")
async def api_agent_messages(name: str):
    agent = await get_agent(name)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    history = await get_history(name)
    summary = await get_latest_summary(name)
    return {
        "messages": format_history_for_api(history),
        "summary": summary["summary"] if summary else None,
    }


@app.delete("/api/agents/{name}/messages")
async def api_clear_messages(name: str):
    agent = await get_agent(name)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await clear_history(name)
    await ws_manager.emit_debug("system", "history_cleared", {"name": name})
    return {"cleared": name}


# ── Integrations ───────────────────────────────────────────────

@app.get("/api/integrations")
async def api_list_integrations():
    import aiosqlite
    from gateway.db import get_db_path
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM integrations")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


@app.put("/api/integrations/telegram")
async def api_set_telegram(data: dict):
    import aiosqlite
    from gateway.db import get_db_path
    token = data.get("token", "")
    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            "INSERT OR REPLACE INTO integrations (id, type, config_json, status) VALUES (?, ?, ?, ?)",
            ("telegram", "telegram", json.dumps({"token": token}), "connected"),
        )
        await db.commit()
    return {"status": "connected", "type": "telegram"}


@app.get("/api/integrations/google/status")
async def api_google_status():
    import aiosqlite
    from gateway.db import get_db_path
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM integrations WHERE id = 'google'")
        row = await cursor.fetchone()
        return dict(row) if row else {"status": "not_configured"}


# ── Providers ──────────────────────────────────────────────────

@app.get("/api/providers")
async def api_list_providers():
    return await list_providers()


@app.get("/api/providers/{pid}")
async def api_get_provider(pid: str):
    provider = await get_provider(pid)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@app.post("/api/providers")
async def api_create_provider(data: dict):
    pid = data.get("id", "").strip().lower().replace(" ", "-")
    try:
        provider = await create_provider(
            pid=pid,
            name=data.get("name", pid),
            base_url=data.get("base_url", ""),
            api_key=data.get("api_key", ""),
            protocol=data.get("protocol", "openai-completions"),
            models=data.get("models"),
            auto_fetch=data.get("auto_fetch", True),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return provider


@app.put("/api/providers/{pid}")
async def api_update_provider(pid: str, data: dict):
    provider = await update_provider(
        pid=pid,
        name=data.get("name"),
        base_url=data.get("base_url"),
        api_key=data.get("api_key"),
        protocol=data.get("protocol"),
        models=data.get("models"),
        auto_fetch=data.get("auto_fetch"),
    )
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@app.delete("/api/providers/{pid}")
async def api_delete_provider(pid: str):
    deleted = await delete_provider(pid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {"deleted": pid}


@app.post("/api/providers/{pid}/test")
async def api_test_provider(pid: str):
    result = await test_connection(pid)
    if not result["ok"]:
        raise HTTPException(status_code=502, detail=result["error"])
    return result


@app.post("/api/providers/{pid}/fetch-models")
async def api_fetch_models(pid: str):
    from gateway.providers import get_provider_with_key
    full = await get_provider_with_key(pid)
    if not full:
        raise HTTPException(status_code=404, detail="Provider not found")
    models = await fetch_models(full["base_url"], full.get("api_key", ""), full.get("protocol", "openai-completions"))
    if models:
        await update_provider(pid, models=models)
    return {"models": models}


# ── Skills ─────────────────────────────────────────────────────

@app.get("/api/skills")
async def api_list_skills():
    return list_skills()


@app.get("/api/skills/{name}")
async def api_get_skill(name: str):
    skill = get_skill(name)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


# ── MCP ────────────────────────────────────────────────────────

@app.get("/api/mcp/servers")
async def api_list_mcp_servers():
    return {
        "servers": list(mcp_bridge.servers.keys()),
        "tools": mcp_bridge.tool_defs,
    }


@app.get("/api/mcp/config")
async def api_get_mcp_config():
    return get_server_config()


@app.put("/api/mcp/config")
async def api_save_mcp_config(data: dict):
    servers = data.get("servers", {})
    save_server_config(servers)
    await reload_servers()
    return get_server_config()


@app.post("/api/mcp/{server}/tools/{tool}")
async def api_call_mcp_tool(server: str, tool: str, data: dict):
    exposed = f"mcp__{server}__{tool}"
    return {"result": await mcp_bridge.call(exposed, data.get("arguments", {}))}


# ── Debug ──────────────────────────────────────────────────────

@app.get("/api/debug/logs")
async def api_debug_logs(agent: str | None = None, limit: int = 50):
    import aiosqlite
    from gateway.db import get_db_path
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        if agent:
            cursor = await db.execute(
                "SELECT * FROM debug_logs WHERE agent_name = ? ORDER BY timestamp DESC LIMIT ?",
                (agent, limit),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM debug_logs ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


# ── Gateway info ───────────────────────────────────────────────

@app.get("/api/gateway/health")
async def api_health():
    agents = await list_agents()
    return {
        "status": "ok",
        "agents_count": len(agents),
        "model": settings.llm_model,
        "mock_mode": settings.mock_tools,
    }


@app.get("/api/gateway/models")
async def api_models():
    return {
        "default": settings.llm_model,
        "provider_url": settings.openai_base_url,
    }


# ── Static files (dashboard SPA) ──────────────────────────────

# A2A catch-all route
@app.api_route("/a2a/{agent_name}/{path:path}", methods=["GET", "POST"])
async def a2a_catchall(agent_name: str, path: str, req: Request):
    handler_info = get_a2a_handler(agent_name)
    if not handler_info:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")
    if req.method == "GET" and (path == ".well-known/agent.json" or path == ".well-known/agent-card.json"):
        return handler_info["card_dict"]
    if req.method == "POST" and path in ("", "/"):
        body = await req.json()
        return {"agent": agent_name, "received": body}
    raise HTTPException(status_code=404, detail="Not found")


@app.api_route("/a2a/{agent_name}", methods=["GET", "POST"])
async def a2a_root(agent_name: str, req: Request):
    handler_info = get_a2a_handler(agent_name)
    if not handler_info:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")
    if req.method == "GET":
        return handler_info["card_dict"]
    if req.method == "POST":
        body = await req.json()
        return {"agent": agent_name, "received": body}
    raise HTTPException(status_code=404, detail="Not found")


@app.get("/")
async def serve_dashboard():
    return FileResponse(
        "static/index.html",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


# mount static assets
app.mount("/static", StaticFiles(directory="static"), name="static")
