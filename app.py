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
from gateway.handoff import route_handoff, run_orchestrator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

llm_engine = LLMEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Workshop Agent Gateway...")
    await db_init(settings.data_dir)
    # re-register A2A routes for existing agents
    agents = await list_agents()
    for agent in agents:
        import yaml
        config = yaml.safe_load(agent["config_yaml"])
        tools = config.get("tools", [])
        register_agent_a2a_routes(app, agent["name"], config, tools)
    logger.info(f"Gateway ready on port {settings.port}. {len(agents)} agent(s) loaded.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Workshop Agent Gateway",
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
    return agents


@app.get("/api/agents/{name}")
async def api_get_agent(name: str):
    agent = await get_agent(name)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent["card_url"] = f"/a2a/{name}/.well-known/agent.json"
    return agent


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
    mcp_servers = data.get("mcp_servers", [])

    agent = await create_agent(
        name=name, soul_md=soul_md, tools=tools, model=model,
        handoff_enabled=handoff_enabled, handoff_targets=handoff_targets,
        orchestrator_enabled=orchestrator_enabled,
        orchestrator_rules=orchestrator_rules,
        description=description, mcp_servers=mcp_servers,
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
    await ws_manager.emit_message(name, "user", user_message)

    try:
        system_prompt = await build_system_prompt(config)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
        tools = config.get("tools", [])

        # check if this is an orchestrator
        orchestrator_config = config.get("orchestrator", {})
        if orchestrator_config.get("enabled") and orchestrator_config.get("rules"):
            response = await run_orchestrator(name, user_message)
        else:
            response = await llm_engine.chat(messages, tools=tools, model=config.get("model"))

        # check for handoff directive and process it
        handoff_match = re.search(r'---HANDOFF:\s*([\w-]+)\s*---', response)
        if handoff_match:
            target = handoff_match.group(1)
            clean_response = re.sub(r'---HANDOFF:\s*[\w-]+\s*---', '', response).strip()
            await ws_manager.emit_message(name, "assistant", clean_response)

            # execute the handoff
            handoff_result = await route_handoff(name, target, user_message)
            full_response = f"{clean_response}\n\n[{target}]: {handoff_result}"
        else:
            full_response = response

        await set_agent_status(name, "idle")
        await ws_manager.emit_message(name, "assistant", full_response)

        return {"agent": name, "response": full_response}

    except Exception as e:
        logger.exception(f"Chat error for agent {name}")
        await set_agent_status(name, "error")
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
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    tools = config.get("tools", [])

    async def generate():
        await set_agent_status(name, "thinking")
        await ws_manager.emit_message(name, "user", user_message)
        try:
            async for chunk in llm_engine.chat_stream(messages, tools=tools, model=config.get("model")):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            await set_agent_status(name, "idle")

    return StreamingResponse(generate(), media_type="text/event-stream")


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
    return FileResponse("static/index.html")


# mount static assets
app.mount("/static", StaticFiles(directory="static"), name="static")
