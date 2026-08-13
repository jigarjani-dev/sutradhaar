# Workshop Agent Gateway: Technical Implementation Plan

**Status:** Ready for implementation
**Date:** 2026-08-06
**Related:** `docs/brainstorms/workshop-agent-gateway-requirements.md`

---

## 1. Technology Stack (Verified)

### Backend

| Component | Choice | Rationale |
|---|---|---|
| **Framework** | FastAPI (>=0.138) | Native async, WebSocket, static file serving, `app.frontend()` for SPA |
| **ASGI server** | Uvicorn | Default for FastAPI, uvloop on Linux |
| **A2A protocol** | `a2a-sdk >= 1.1.0` | Official Python SDK, `AgentExecutor` + `DefaultRequestHandler` + route factories |
| **LLM client** | `openai >= 1.0` (async) | OpenAI-compatible API, streaming, function/tool calling. Works with DeepSeek, Ollama, any OpenAI-compatible endpoint |
| **Database** | `aiosqlite` for async + `sqlite3` | Zero-setup, file-based, single-writer safe for workshop scale |
| **Google Workspace** | `gws` CLI (Google official) | 30K stars, Rust binary, structured JSON output. Replaces the third-party `gogcli` from older docs |
| **OCR** | PaddleOCR >= 2.9 | Best balance for invoices/receipts (91-92% accuracy, 1-1.5s/page) |
| **Telegram** | `python-telegram-bot` (async) or raw HTTP + webhook | Bot API, polling or webhook |
| **Task scheduling** | `asyncio.create_task` | No external scheduler needed at workshop scale |

### Frontend

| Component | Choice | Rationale |
|---|---|---|
| **Framework** | Alpine.js + HTMX or vanilla JS | No build step, tiny payload, works in Docker. No Node toolchain for attendees |
| **Pipeline viz** | Cytoscape.js | Purpose-built for node-edge graphs. Lighter than D3 for network visualization. Animated edges, neon-style nodes |
| **Markdown editor** | EasyMDE or CodeMirror 6 (lite) | SOUL.md editing with live preview |
| **Styling** | Tailwind CSS (standalone CLI) or plain CSS | Dark theme, minimal. Tailwind standalone binary can precompile without Node |
| **WebSocket** | Native `WebSocket` API | Browser built-in, no library needed |

### Docker

| Layer | Content |
|---|---|
| **Base** | `python:3.12-slim` |
| **System deps** | `gws` binary (downloaded from GitHub Releases), `ffmpeg` (for PaddleOCR/audio) |
| **Python deps** | fastapi, uvicorn, a2a-sdk, openai, aiosqlite, paddleocr, python-telegram-bot, pydantic, pyyaml |
| **Frontend** | Static HTML/CSS/JS served by FastAPI `app.frontend()` |

---

## 2. Architecture

```
                          ┌───────────────────────────────────────────┐
                          │  Docker Container (localhost:8192)        │
                          │                                           │
   Browser  ─── HTTP/WS ──┤  ┌─────────────────────────────────────┐ │
                          │  │  Uvicorn (ASGI)                      │ │
                          │  │  ┌─────────────────────────────────┐ │ │
                          │  │  │  FastAPI App                     │ │ │
                          │  │  │                                  │ │ │
                          │  │  │  GET /              → Dashboard  │ │ │
                          │  │  │  /ws                 → WS events │ │ │
                          │  │  │  /api/agents/*       → CRUD      │ │ │
                          │  │  │  /api/agents/{n}/chat→ Chat      │ │ │
                          │  │  │  /api/integrations/* → OAuth     │ │ │
                          │  │  │  /api/debug/logs     → Debug     │ │ │
                          │  │  │  /api/gateway/*      → Health    │ │ │
                          │  │  │                                  │ │ │
                          │  │  │  ┌────────────────────────────┐ │ │ │
                          │  │  │  │  A2A Routes (per agent)     │ │ │ │
                          │  │  │  │  /a2a/{name}/.well-known/   │ │ │ │
                          │  │  │  │  /a2a/{name} (JSON-RPC)    │ │ │ │
                          │  │  │  └─────────────┬──────────────┘ │ │ │
                          │  │  │                │                 │ │ │
                          │  │  │  ┌─────────────▼──────────────┐ │ │ │
                          │  │  │  │  Agent Runtime              │ │ │ │
                          │  │  │  │  - AgentLoader (yaml+md)   │ │ │ │
                          │  │  │  │  - LLMEngine (openai async) │ │ │ │
                          │  │  │  │  - ToolExecutor (gws, ocr, │ │ │ │
                          │  │  │  │    telegram, mcp)          │ │ │ │
                          │  │  │  │  - HandoffRouter (A2A cli) │ │ │ │
                          │  │  │  │  - CardGenerator           │ │ │ │
                          │  │  │  └─────────────┬──────────────┘ │ │ │
                          │  │  │                │                 │ │ │
                          │  │  │  ┌─────────────▼──────────────┐ │ │ │
                          │  │  │  │  SQLite DB (aiosqlite)      │ │ │ │
                          │  │  │  │  - agents table             │ │ │ │
                          │  │  │  │  - messages table           │ │ │ │
                          │  │  │  │  - integrations table       │ │ │ │
                          │  │  │  │  - debug_log table          │ │ │ │
                          │  │  │  └────────────────────────────┘ │ │ │
                          │  │  └─────────────────────────────────┘ │ │
                          │  └─────────────────────────────────────┘ │
                          │                                           │
                          │  /data/ (mounted volume)                  │
                          │  ├── gateway.db          (SQLite)        │
                          │  ├── agents/             (YAML + MD)     │
                          │  │   ├── lakshmi/agent.yaml, SOUL.md    │
                          │  │   └── dev-agent/agent.yaml, SOUL.md  │
                          │  └── credentials/        (OAuth tokens)  │
                          └──────────────────────────────────────────┘
```

### 2.1 Component map

| Component | File(s) | Responsibility |
|---|---|---|
| `App` | `app.py` | FastAPI app factory, route registration, lifespan |
| `AgentRegistry` | `gateway/registry.py` | CRUD for agents, YAML read/write, Agent Card auto-gen |
| `AgentLoader` | `gateway/loader.py` | Load agent from `agent.yaml` + `SOUL.md`, resolve tools |
| `LLMEngine` | `gateway/llm.py` | OpenAI-compatible async client, tool calling loop, streaming |
| `ToolExecutor` | `gateway/tools.py` | Tool registry, `gws` subprocess wrapper, Telegram HTTP, PaddleOCR, MCP clients |
| `A2AAdapter` | `gateway/a2a.py` | Per-agent `AgentExecutor` + `DefaultRequestHandler`, route registration |
| `HandoffRouter` | `gateway/handoff.py` | A2A client for cross-agent task dispatch |
| `CardGenerator` | `gateway/cardgen.py` | Derive A2A Agent Card from `agent.yaml` |
| `WebSocketManager` | `gateway/ws.py` | Broadcast agent status, message events, debug logs |
| `DB` | `gateway/db.py` | SQLite schema, `aiosqlite` queries |
| `Dashboard` | `static/` | HTML, CSS, JS, Cytoscape.js |

---

## 3. Directory Structure

```
workshop-agent-gateway/
├── docker-compose.yml
├── Dockerfile
├── .env.template
├── requirements.txt
├── app.py                          # FastAPI entry point, route mounting, lifespan
├── gateway/
│   ├── __init__.py
│   ├── config.py                   # Pydantic settings from .env
│   ├── db.py                       # SQLite schema, aiosqlite queries
│   ├── registry.py                 # Agent CRUD, YAML/md read/write
│   ├── loader.py                   # AgentLoader: yaml -> runtime agent object
│   ├── llm.py                      # OpenAI async client, tool-call loop, streaming
│   ├── tools.py                    # Tool registry, gws wrapper, PaddleOCR, Telegram
│   ├── a2a.py                      # Per-agent A2A executor + routes
│   ├── handoff.py                  # A2A client for cross-agent calls
│   ├── cardgen.py                  # Agent Card auto-generation
│   ├── mcp.py                      # External MCP server client
│   └── ws.py                       # WebSocket broadcast manager
├── static/
│   ├── index.html                  # Dashboard SPA
│   ├── css/
│   │   └── dashboard.css           # Dark theme, neon accents, animations
│   ├── js/
│   │   ├── app.js                  # Alpine.js or vanilla app bootstrap
│   │   ├── ws-client.js            # WebSocket connection + event handlers
│   │   ├── agent-panel.js          # Agent list/monitoring
│   │   ├── soul-editor.js          # SOUL.md editor + preview
│   │   ├── chat-panel.js           # Per-agent chat interface
│   │   ├── pipeline-viz.js         # Cytoscape.js node graph
│   │   ├── debug-log.js            # Debug log panel
│   │   └── integrations.js         # OAuth, Telegram, MCP config UI
│   └── lib/
│       └── cytoscape.min.js        # Cytoscape.js (bundled, no CDN)
├── data/                           # Mounted Docker volume
│   ├── gateway.db                  # SQLite (auto-created)
│   ├── agents/                     # Agent config dir
│   └── credentials/                # OAuth tokens for gws
├── templates/                      # Pre-baked agent templates
│   ├── blank/
│   │   ├── agent.yaml              # Minimal agent config
│   │   └── SOUL.md                 # Blank persona template
│   ├── finance-agent/
│   │   ├── agent.yaml              # Pre-configured finance agent
│   │   └── SOUL.md                 # Finance advisor persona
│   ├── ba-agent/
│   │   ├── agent.yaml
│   │   └── SOUL.md
│   ├── dev-agent/
│   │   ├── agent.yaml
│   │   └── SOUL.md
│   ├── qa-agent/
│   │   ├── agent.yaml
│   │   └── SOUL.md
│   └── orchestrator/
│       ├── agent.yaml
│       └── SOUL.md
├── samples/                        # Sample files for exercises
│   ├── receipt.jpg
│   ├── salary-slip.pdf
│   └── invoice.pdf
└── tests/
    ├── conftest.py
    ├── test_registry.py
    ├── test_loader.py
    ├── test_llm.py
    ├── test_tools.py
    ├── test_a2a.py
    ├── test_cardgen.py
    └── test_handoff.py
```

---

## 4. Backend Implementation Detail

### 4.1 FastAPI App (`app.py`)

```python
# Pseudocode structure
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB, load existing agents, register A2A routes
    await db.init()
    await registry.load_all()
    yield
    # Shutdown: cleanup

app = FastAPI(lifespan=lifespan)

# API routes
app.include_router(registry.router, prefix="/api/agents")
app.include_router(chat.router, prefix="/api/agents/{name}/chat")
app.include_router(integrations.router, prefix="/api/integrations")
app.include_router(debug.router, prefix="/api/debug")
app.include_router(gateway.router, prefix="/api/gateway")

# WebSocket
app.add_websocket_route("/ws", ws.handle)

# A2A routes registered dynamically per agent at startup + on agent create

# SPA static files (FastAPI 0.138+)
app.frontend("static/")  # Serves / as index.html
```

### 4.2 Agent Registry (`gateway/registry.py`)

```
POST /api/agents
  → Parse name, SOUL.md, tools[], model
  → Write data/agents/{name}/agent.yaml + SOUL.md
  → Auto-generate Agent Card via cardgen
  → Register A2A routes via a2a adapter
  → Broadcast agent-created via WebSocket
  → Return agent object + A2A card URL
```

**`agent.yaml` format (OpenClaw-compatible):**

```yaml
name: "Lakshmi"
model: "deepseek-v4-flash"
tools:
  - sheets_writer
  - telegram_sender
  - ocr_reader
handoff:
  enabled: true
  targets: ["dev-agent", "qa-agent"]  # agents this one can handoff to
orchestrator:
  enabled: false
  rules: []
```

### 4.3 A2A Integration (`gateway/a2a.py`)

Uses the official A2A Python SDK pattern from a2a-protocol.org:

```python
from a2a.server.agent_execution import AgentExecutor
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.server.routes import create_agent_card_routes, create_jsonrpc_routes
from a2a.types import AgentCard, AgentSkill, AgentCapabilities, AgentInterface

class GatewayAgentExecutor(AgentExecutor):
    """Bridges A2A tasks to our agent runtime."""
    def __init__(self, agent_config):
        self.agent = agent_config

    async def execute(self, context, event_queue):
        # 1. Extract user message from context
        # 2. Route to LLMEngine.run() with the agent's SOUL.md + tools
        # 3. Stream response back via event_queue
        # 4. Update task status: WORKING -> add_artifact -> COMPLETED
        pass

    async def cancel(self, context, event_queue):
        pass
```

**Route registration per agent (inside FastAPI):**

```python
from a2a.server.routes import create_agent_card_routes, create_jsonrpc_routes

def register_a2a_routes(app, agent_config):
    executor = GatewayAgentExecutor(agent_config)
    handler = DefaultRequestHandler(
        agent_executor=executor,
        task_store=InMemoryTaskStore(),
        agent_card=cardgen.build(agent_config),
    )
    prefix = f"/a2a/{agent_config.name}"
    app.mount(prefix, routes=[
        *create_agent_card_routes(handler.agent_card),
        *create_jsonrpc_routes(handler, base_url=prefix),
    ])
```

### 4.4 LLM Engine (`gateway/llm.py`)

OpenAI-compatible async client with tool calling loop:

```python
from openai import AsyncOpenAI

class LLMEngine:
    def __init__(self, base_url: str, api_key: str):
        self.client = AsyncOpenAI(base_url=base_url, api_key=api_key)

    async def run(self, agent_config, messages, tools_defs):
        """Agent loop: call LLM, handle tool calls, repeat until final response."""
        system_prompt = self._build_system(agent_config)
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        while True:
            response = await self.client.chat.completions.create(
                model=agent_config.model,
                messages=full_messages,
                tools=tools_defs,
                stream=False,  # or stream=True for sentence-level TTS-like delivery
            )
            msg = response.choices[0].message

            if msg.tool_calls:
                # Execute each tool call, add results to messages
                for tc in msg.tool_calls:
                    result = await tool_executor.run(tc.function.name, tc.function.arguments)
                    full_messages.append({"role": "tool", "content": result, "tool_call_id": tc.id})
                full_messages.append(msg)  # assistant message with tool_calls
                continue  # loop back for next LLM call

            return msg.content  # final text response
```

### 4.5 Tool System (`gateway/tools.py`)

Tool definitions as Python functions with JSON Schema:

```python
TOOLS = {
    "gmail_reader": {
        "function": {
            "name": "gmail_reader",
            "description": "Search and read emails from Gmail inbox",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Gmail search query"},
                    "max_results": {"type": "integer", "default": 10}
                },
                "required": ["query"]
            }
        },
        "handler": gmail_search_handler
    },
    "sheets_writer": {
        "function": { ... },
        "handler": sheets_append_handler
    },
    "ocr_reader": {
        "function": { ... },
        "handler": ocr_handler
    },
    "telegram_sender": {
        "function": { ... },
        "handler": telegram_send_handler
    },
    # MCP tools loaded dynamically from configured MCP servers
}
```

**Subprocess-based tools (gws, PaddleOCR):**

```python
import asyncio

async def gmail_search_handler(query: str, max_results: int = 10):
    proc = await asyncio.create_subprocess_exec(
        "gws", "gmail", "users", "messages", "list",
        "--params", json.dumps({"q": query, "maxResults": max_results}),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return stdout.decode()
```

### 4.6 WebSocket (`gateway/ws.py`)

Broadcast pattern with `asyncio.Queue` per client:

```python
from fastapi import WebSocket

class WebSocketManager:
    def __init__(self):
        self.clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.append(ws)

    def disconnect(self, ws: WebSocket):
        self.clients.remove(ws)

    async def broadcast(self, event_type: str, data: dict):
        message = json.dumps({"type": event_type, "data": data})
        dead = []
        for ws in self.clients:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

# Event types broadcast:
# - agent-created: {name, status, card_url}
# - agent-updated: {name, status}
# - agent-deleted: {name}
# - message-sent: {agent, role, content}
# - tool-called: {agent, tool, args, result, duration}
# - a2a-task-update: {from_agent, to_agent, task_id, state}
# - debug-log: {level, agent, message, timestamp}
```

### 4.7 Database Schema (`gateway/db.py`)

```sql
CREATE TABLE agents (
    name TEXT PRIMARY KEY,
    config_yaml TEXT NOT NULL,       -- raw agent.yaml content
    soul_md TEXT NOT NULL,           -- raw SOUL.md content
    card_json TEXT,                  -- auto-generated A2A card JSON
    status TEXT DEFAULT 'idle',      -- idle, thinking, error
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    role TEXT NOT NULL,              -- user, assistant, system
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (agent_name) REFERENCES agents(name)
);

CREATE TABLE integrations (
    id TEXT PRIMARY KEY,             -- telegram, google, mcp:server-name
    type TEXT NOT NULL,              -- telegram, google_oauth, mcp
    config_json TEXT NOT NULL,       -- token, credentials path, endpoint URL
    status TEXT DEFAULT 'disconnected',
    created_at TEXT NOT NULL
);

CREATE TABLE debug_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT,
    event_type TEXT NOT NULL,        -- message, tool_call, handoff, a2a_task, error
    payload_json TEXT NOT NULL,
    timestamp TEXT NOT NULL
);
```

---

## 5. Frontend Implementation Detail

### 5.1 Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [Nav: Agents | Pipeline | Integrations | Logs]    [Health ●]   │
├──────────────┬──────────────────────────────────────┬────────────┤
│  Agent List  │                                      │  Debug Log │
│              │        Pipeline Visualization        │            │
│  ○ Lakshmi   │        (Cytoscape.js graph)          │  12:01:03  │
│    idle      │                                      │  Lakshmi   │
│              │    [Lakshmi]──────A2A────→[Dev]      │  tool_call │
│  ○ BA        │         │                   │        │  sheets..  │
│    thinking  │         │                   │        │            │
│              │         ▼                   ▼        │  12:01:05  │
│  ○ Dev       │      [QA]              [Orch]       │  BA → Dev  │
│    idle      │                                      │  HANDOFF   │
│              │                                      │            │
│  ○ QA        │                                      │  12:01:08  │
│    idle      │                                      │  Dev       │
│              │                                      │  response  │
├──────────────┴──────────────────────────────────────┴────────────┤
│  Agent Chat Panel (selected agent)                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  You: What's my coffee expense this month?                  │  │
│  │  Lakshmi: Let me check... [tool: sheets_reader]            │  │
│  │  Lakshmi: You spent Rs. 1,240 on coffee this month.        │  │
│  │  ─────────────────────────────────────────────────────────  │  │
│  │  [Type message...]                              [Send]     │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  SOUL.md Editor (collapsible sidebar)                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  # Lakshmi                                                  │  │
│  │  You are a personal finance advisor...                      │  │
│  │                                              [Preview]      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Cytoscape.js Pipeline Visualization

```javascript
// pipeline-viz.js
const cy = cytoscape({
  container: document.getElementById('pipeline'),
  style: [
    {
      selector: 'node',
      style: {
        'background-color': '#1a1a2e',
        'label': 'data(name)',
        'color': '#e0e0e0',
        'font-size': '12px',
        'border-width': 2,
        'border-color': '#00d4ff',
        'width': 60,
        'height': 60,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 8,
      }
    },
    {
      selector: 'node[status="thinking"]',
      style: { 'border-color': '#ff6b35', 'border-width': 3 }
    },
    {
      selector: 'node[status="error"]',
      style: { 'border-color': '#ff3860' }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#00d4ff',
        'target-arrow-color': '#00d4ff',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
      }
    },
    {
      selector: 'edge[active="true"]',
      style: {
        'line-color': '#ff6b35',
        'width': 3,
        'line-style': 'dashed',
      }
    }
  ],
  layout: { name: 'breadthfirst', directed: true, spacingFactor: 1.5 }
});

// WebSocket handler: add/remove nodes on agent create/delete
ws.on('agent-created', (data) => {
  cy.add({ group: 'nodes', data: { id: data.name, name: data.name, status: 'idle' } });
});
ws.on('agent-deleted', (data) => {
  cy.remove(`#${data.name}`);
});

// Animate edge when A2A handoff occurs
ws.on('a2a-task-update', (data) => {
  const edgeId = `${data.from_agent}-${data.to_agent}`;
  let edge = cy.getElementById(edgeId);
  if (!edge.length) {
    edge = cy.add({ group: 'edges', data: { id: edgeId, source: data.from_agent, target: data.to_agent } });
  }
  edge.data('active', true);
  cy.animate({ fit: { eles: edge }, duration: 300 });
  setTimeout(() => edge.data('active', false), 2000);
});
```

### 5.3 No-Build Frontend Strategy

All frontend code is vanilla JS + CSS served as static files. No Webpack, Vite, or Node toolchain required for attendees. Cytoscape.js is the only bundled dependency (~400KB minified), included as a static file.

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Workshop Agent Gateway</title>
  <link rel="stylesheet" href="/css/dashboard.css">
  <script src="/lib/cytoscape.min.js"></script>
</head>
<body>
  <div id="app">
    <!-- Rendered by vanilla JS -->
  </div>
  <script src="/js/ws-client.js"></script>
  <script src="/js/app.js"></script>
</body>
</html>
```

---

## 6. Docker Configuration

### 6.1 `Dockerfile`

```dockerfile
FROM python:3.12-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates ffmpeg libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install gws CLI
RUN curl -fsSL https://github.com/googleworkspace/cli/releases/latest/download/gws-linux-x86_64.tar.gz \
    | tar xz -C /usr/local/bin gws

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/local/bin/gws /usr/local/bin/gws
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
WORKDIR /app
COPY app.py gateway/ static/ templates/ samples/ ./
RUN mkdir -p /app/data/agents /app/data/credentials
VOLUME ["/app/data"]
EXPOSE 8192
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8192"]
```

### 6.2 `docker-compose.yml`

```yaml
version: "3.9"
services:
  gateway:
    build: .
    ports:
      - "8192:8192"
    volumes:
      - ./data:/app/data           # persist agents + db
      - ./credentials:/app/credentials  # OAuth tokens for gws
    environment:
      - OPENAI_BASE_URL=${OPENAI_BASE_URL:-https://api.deepseek.com/v1}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/app/credentials/google.json
    restart: unless-stopped
```

---

## 7. `agent.yaml` Specification (OpenClaw-Compatible)

```yaml
# Required
name: "lakshmi"                          # lowercase, no spaces, unique
model: "deepseek-v4-flash"               # model ID passed to LLM provider

# Optional
description: "Personal finance advisor"  # used in A2A Agent Card
emoji: "💰"                              # dashboard display
tools:                                   # pre-baked tools to wire
  - gmail_reader
  - sheets_writer
  - ocr_reader
  - telegram_sender

handoff:                                 # agent-to-agent delegation
  enabled: false
  targets: []                            # agents this one can handoff to

orchestrator:                            # routing agent
  enabled: false
  rules:                                 # keyword or LLM-classified rules
    - match: ["expense", "spent", "bought"]
      target: "lakshmi"
    - match: ["build", "code", "develop"]
      target: "dev-agent"

mcp_servers:                             # external MCP endpoints
  - name: "custom-search"
    url: "http://localhost:9000/mcp"
```

**`SOUL.md` format (OpenClaw-compatible):**

```markdown
# Lakshmi

You are Lakshmi, a personal finance advisor. You help users track expenses,
categorize spending, and maintain a Google Sheet budget.

## Tone
- Professional but warm
- Never judgmental about spending habits
- Conservative with financial advice

## Rules
- Always confirm before writing to a spreadsheet
- If you don't know a category, ask the user
- Respond in 2-3 sentences unless asked for details
```

---

## 8. Implementation Order

### Phase 1: Scaffold + Static Serve (Day 1)

1. Create repo, `docker-compose.yml`, `Dockerfile`, `requirements.txt`
2. `app.py` with FastAPI, health endpoint, static file serving
3. `static/index.html` with basic dashboard shell (empty layout)
4. `docker-compose up` -> `http://localhost:8192` shows dashboard

**Verify:** `curl localhost:8192/api/gateway/health` returns `{"status": "ok"}`

### Phase 2: Agent CRUD + SQLite (Day 1-2)

1. `gateway/db.py`: SQLite schema, `aiosqlite` init, migration
2. `gateway/registry.py`: create/read/update/delete agents, YAML + MD file I/O
3. API routes: `POST/GET/PUT/DELETE /api/agents`
4. Dashboard UI: agent list, create form, SOUL.md editor (EasyMDE)

**Verify:** Create agent via dashboard, `curl GET /api/agents` returns it, file written to `data/agents/`

### Phase 3: LLM + Tool Calling (Day 2-3)

1. `gateway/llm.py`: OpenAI async client, system prompt assembly from SOUL.md, tool-call loop
2. `gateway/tools.py`: Tool registry, `gws` subprocess wrappers (gmail_reader, sheets_writer), PaddleOCR handler, Telegram HTTP handler
3. `POST /api/agents/{name}/chat`: full message + tool-call roundtrip
4. Dashboard chat panel: send message, see response

**Verify:** Chat with Lakshmi, ask "add 20 rupees for coca cola", verify Sheets append + response

### Phase 4: A2A Integration (Day 3-4)

1. `gateway/cardgen.py`: build `AgentCard` from agent.yaml
2. `gateway/a2a.py`: `GatewayAgentExecutor`, route registration per agent
3. `gateway/handoff.py`: A2A client for cross-agent delegation
4. Dashboard: A2A card link visible per agent, pipeline viz stub

**Verify:** `curl /a2a/lakshmi/.well-known/agent.json` returns valid A2A card. Send message via JSON-RPC to `/a2a/lakshmi`, agent responds.

### Phase 5: WebSocket + Pipeline Visualization (Day 4-5)

1. `gateway/ws.py`: WebSocket manager, broadcast events
2. Dashboard `ws-client.js`: connect, handle event types
3. Dashboard `pipeline-viz.js`: Cytoscape.js graph, animated edges
4. Dashboard `debug-log.js`: scrolling log panel
5. Wire all events: agent created/deleted, messages, tool calls, A2A tasks

**Verify:** Create 3 agents in dashboard -> nodes appear. Wire handoff -> edges appear. Send message -> traffic animates.

### Phase 6: Integrations Panel (Day 5)

1. `gateway/tools.py`: OAuth flow initiation for Google (`gws auth login` guidance in dashboard)
2. Dashboard `integrations.js`: Telegram token input, Google OAuth button, MCP server registration
3. OAuth callback handler at `/api/integrations/google/oauth/callback`
4. API routes for integration CRUD

**Verify:** Enter Telegram token -> status shows connected. Initiate Google OAuth -> token stored in `credentials/`.

### Phase 7: Orchestrator + Handoff Wiring (Day 5-6)

1. `gateway/handoff.py`: complete A2A client, orchestrator rule matching
2. Dashboard: orchestrator rule editor, handoff target picker
3. Full BA -> Dev -> QA handoff chain
4. Orchestrator routing: keyword match + LLM-based intent classification

**Verify:** Orchestrator routes "what's my coffee expense?" to Lakshmi, "build me a login page" to Dev team.

### Phase 8: Hardening + Docker Polish (Day 6-7)

1. Multi-stage Dockerfile with pre-built gws binary
2. `.env.template` with clear comments for all required vars
3. Error handling: LLM timeout, gws auth failure, invalid agent config
4. Dashboard polish: dark theme, responsive layout, loading states, error states
5. Full workshop dry-run: exercise all three layers end-to-end

**Verify:** `docker-compose up` on fresh machine, no prior Python/Node/gws install. Full exercise flow completes.

---

## 9. Key Dependencies (`requirements.txt`)

```
fastapi>=0.138.0
uvicorn[standard]>=0.34
a2a-sdk>=1.1.0
openai>=1.70
aiosqlite>=0.20
pydantic>=2.10
pydantic-settings>=2.7
pyyaml>=6.0
paddleocr>=2.9
python-telegram-bot>=21.0
httpx>=0.28
```

---

## 10. Fallback Paths

| Risk | Fallback |
|---|---|
| `gws` CLI not installed or auth fails | Mock Gmail/Sheets backend: Python functions that return sample data. Switched via env var `MOCK_GOOGLE=true` |
| PaddleOCR too heavy for Docker image | Switch to EasyOCR or Tesseract via env var. Or use a pre-OCR'd sample file for the workshop exercise |
| Cytoscape.js adds too much frontend weight | Fall back to CSS-animated `<div>` list with arrow indicators for the pipeline view |
| A2A Python SDK has breaking changes | Pin to `a2a-sdk==1.1.0`. The tutorial pattern (`AgentExecutor` + `DefaultRequestHandler` + route factories) is stable in v1.x |
| Attendee LLM API key not working | Pre-load demo API key in `.env.template` pointing to DeepSeek free tier. Warn that this is rate-limited; attendees should bring their own for the full workshop |

---

## 11. Testing Strategy

- **Unit tests:** `pytest` with `pytest-asyncio`. Mock LLM calls, `gws` subprocess, WebSocket. Test tool handlers, A2A card generation, agent loading.
- **Integration tests:** `httpx.AsyncClient` against FastAPI `TestClient`. Full agent create -> chat -> tool-call -> handoff chain.
- **No fixture files from external sources.** Tests generate their own small test data. Self-contained per user preference.
- **Test data:** Small WAV/PDF fixtures generated in `conftest.py` or inline.
