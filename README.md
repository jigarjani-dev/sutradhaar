# Workshop Agent Gateway

A lightweight, visual agent gateway for learning multi-agent patterns (OpenClaw concepts, A2A protocol, MCP tools). Build agents with SOUL.md personas, wire them together with A2A handoffs, and watch them communicate in real time on a live dashboard.

**One command to start:**
```bash
docker compose up
```

Then open `http://localhost:8080` in your browser.

## What You Get

- **Dashboard** -- Create agents, edit SOUL.md personas, chat with agents, and watch agent-to-agent communication live
- **A2A Protocol** -- Agents communicate using the Linux Foundation Agent-to-Agent standard. Agent Cards auto-generated from config
- **Pipeline Visualization** -- Animated node graph showing agent status and handoff traffic in real time
- **Debug Log** -- Real-time event stream of messages, tool calls, handoffs, and errors
- **Pre-baked Tools** -- Gmail reader, Google Sheets writer/reader, OCR, Telegram sender (mock mode available)
- **OpenClaw-compatible** -- SOUL.md and agent.yaml follow OpenClaw's file format. Take your agents home

## Quick Start

### 1. Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- An LLM API key (DeepSeek, OpenAI, or any OpenAI-compatible endpoint)

### 2. Configure

Copy the environment template and add your API key:

```bash
cp .env.template .env
```

Edit `.env` and set your API key:

```env
OPENAI_API_KEY=sk-your-key-here
```

The default model is DeepSeek (`deepseek-chat`). To use another provider:

```env
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-your-openai-key
LLM_MODEL=gpt-4o
```

### 3. Start

```bash
docker compose up
```

Wait for the container to build and start. You will see:

```
INFO:     Started server process
INFO:     Gateway ready on port 8080
```

### 4. Open Dashboard

Navigate to **http://localhost:8080** in your browser.

## Workshop Exercises

### Layer 1: Create Your First Agent

1. Click **+ New** in the Agents panel
2. Name it `lakshmi`, add a persona in the SOUL.md editor
3. Select tools (e.g. Sheets Writer, OCR Reader)
4. Click **Save Agent**
5. Click the agent in the list, type a message in the chat panel

### Layer 2: Build an Agent Team with Handoff

1. Create `ba-agent`, `dev-agent`, and `qa-agent` with distinct personas
2. Configure handoff targets: BA -> Dev -> QA -> Dev (for rework)
3. Send a task to the BA agent and watch the handoff chain in the Pipeline visualization

### Layer 3: Add an Orchestrator

1. Create an `orchestrator` agent
2. Enable Orchestrator mode and define routing rules
3. Send messages to the orchestrator and watch it route to the correct specialist

## Agent Configuration

Agents are stored in `data/agents/<name>/` as two files:

### `agent.yaml`

```yaml
name: "lakshmi"
model: "deepseek-chat"
description: "Personal finance advisor"
tools:
  - sheets_writer
  - sheets_reader
  - ocr_reader
handoff:
  enabled: true
  targets: ["qa-agent"]
orchestrator:
  enabled: false
  rules: []
mcp_servers: []
```

### `SOUL.md`

```markdown
# Lakshmi

You are a personal finance advisor. You help users track expenses
and maintain a budget in Google Sheets.

## Rules
- Always confirm before writing to a spreadsheet
- Extract: date, item, amount, category from user messages
- Respond in 2-3 sentences
```

## A2A Endpoints

Every agent exposes A2A protocol endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /a2a/{name}/.well-known/agent.json` | Agent Card (auto-generated) |
| `POST /a2a/{name}` | JSON-RPC task endpoint |

Example:
```bash
curl http://localhost:8080/a2a/lakshmi/.well-known/agent.json
```

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/agents` | GET | List all agents |
| `/api/agents` | POST | Create agent |
| `/api/agents/{name}` | GET | Get agent details |
| `/api/agents/{name}` | DELETE | Delete agent |
| `/api/agents/{name}/chat` | POST | Send message to agent |
| `/api/integrations/telegram` | PUT | Set Telegram bot token |
| `/api/gateway/health` | GET | Gateway health check |
| `/ws` | WebSocket | Live event stream |

## Mock Mode

If you don't have Google Workspace or Telegram set up, enable mock mode in `.env`:

```env
MOCK_TOOLS=true
```

This returns sample data for Gmail, Sheets, and OCR tools instead of calling real APIs.

## Connecting Real Services

### Google Workspace (Gmail, Sheets)

The `gws` CLI is included in the Docker image. To authenticate:

```bash
docker compose exec gateway gws auth setup
docker compose exec gateway gws auth login
```

Or mount your existing credentials:

```yaml
# docker-compose.yml
volumes:
  - ~/.config/gws:/root/.config/gws
```

### Telegram

1. Create a bot with [@BotFather](https://t.me/BotFather) on Telegram
2. Set the token in `.env`: `TELEGRAM_BOT_TOKEN=your-token`
3. Or enter it in the dashboard Integrations panel

### Custom MCP Servers

Add MCP server endpoints in `agent.yaml`:

```yaml
mcp_servers:
  - name: "my-custom-tool"
    url: "http://localhost:9000/mcp"
```

## Architecture

```
browser → localhost:8080 (Docker)
  ├── /              → Dashboard SPA
  ├── /api/*         → REST API (FastAPI)
  ├── /a2a/{name}/*  → A2A protocol (a2a-sdk)
  ├── /ws            → WebSocket (real-time events)
  └── /static/*      → CSS, JS assets
```

The gateway runs as a single Python asyncio process. All agents share the runtime. State persists to SQLite in `./data/gateway.db`.

## Portability

SOUL.md and agent.yaml files are OpenClaw-compatible. After the workshop, copy `data/agents/<name>/` to your OpenClaw workspace and your agent persona and handoff rules will work (tool implementations differ).

## Directory Structure

```
├── app.py                  # FastAPI entry point
├── gateway/                # Backend modules
│   ├── config.py           # Settings from .env
│   ├── db.py               # SQLite schema
│   ├── registry.py         # Agent CRUD
│   ├── loader.py           # Agent config loader
│   ├── llm.py              # OpenAI-compatible client
│   ├── tools.py            # Tool registry (gws, OCR, Telegram)
│   ├── a2a.py              # A2A protocol adapter
│   ├── handoff.py          # Agent-to-agent handoff
│   ├── cardgen.py          # Agent Card generator
│   └── ws.py               # WebSocket manager
├── static/                 # Dashboard frontend
│   ├── index.html
│   ├── css/dashboard.css
│   └── js/app.js
├── templates/              # Pre-baked agent templates
├── data/                   # SQLite + agent files (gitignored)
└── docker-compose.yml
```
