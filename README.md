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

### Google Workspace (Sheets, via `gws`)

The `gws` CLI is included in the Docker image, used by the `sheets-reader` / `sheets-writer` skills. To authenticate:

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

### Gmail (MCP, no CLI)

Gmail is a from-scratch MCP server (`gateway/mcp_servers/gmail_mcp.py`) that talks to the Gmail API directly via Google's official Python client -- no `gws`, no Node, no extra binaries to install.

**A Google Cloud project + OAuth client is still required -- this can't be skipped.** Gmail is a private mailbox; Google only issues a token to an app it recognizes. That recognized "app" is an OAuth client registered in a Cloud project, and `gmail_client_secret.json` *is* that app's identity (client_id + client_secret) -- it is not a per-user secret. The one-time consent link each attendee opens afterward just proves *that human* is authorizing *that already-registered app*. No Cloud project → no client_id → no consent URL can even be built.

**Two ways to run this for a workshop:**

| Setup | Attendee does | Trade-off |
|---|---|---|
| **Each attendee makes their own Cloud project** (recommended) | ~5 min: create project → enable Gmail API → OAuth consent screen (External, Testing) → Desktop OAuth client → download JSON → add self as test user | Zero coordination, no shared secrets, no test-user list to maintain |
| **One shared organizer project** | Organizer creates the project once and adds every attendee's Gmail address as a **Test user** on the consent screen (cap: 100) before the workshop, then distributes the one `gmail_client_secret.json` | Less per-attendee setup, but organizer must collect emails in advance and hand out a shared client file |

Either way the OAuth app stays in **Testing** mode -- fine for a workshop, and it's exactly why only listed test users (or the project owner) can complete consent. Publishing/verifying the app to lift that restriction is a multi-week Google review, not worth it here.

**Setup, once the Cloud project + `gmail_client_secret.json` exist:**

```bash
docker compose up -d --build
# save the downloaded OAuth client JSON to ./data/credentials/gmail_client_secret.json
docker compose run --rm -p 8765:8765 gateway python -m gateway.mcp_servers.gmail_auth_setup
# open the printed URL, sign in, approve -> writes ./data/credentials/gmail_token.json
docker compose restart gateway
```

Then attach the `gmail` MCP server to an agent (Skills & MCP panel, or `mcp_servers: ["gmail"]` in `agent.yaml`).

**Credentials -- what lives where:**

| File | What it is | Sensitivity |
|---|---|---|
| `data/credentials/gmail_client_secret.json` | The registered app's identity (client_id/secret) | Not tied to one user, but still don't publish it outside the workshop |
| `data/credentials/gmail_token.json` | The refresh token for whichever account last ran the consent script | Full read/send access to that mailbox -- treat like a password |

Both paths live under `data/`, already gitignored (`.gitignore` excludes `data/*` except the skills/mcp.json allowlist) -- neither file gets committed by accident.

Re-running the consent script for a different Google account **overwrites** `gmail_token.json` -- one mailbox at a time per gateway instance; there's no per-agent/per-user token namespacing.

Tools exposed once attached: `search_messages`, `read_message`, `list_labels`, `triage`, `send_message`, `reply_message` (the last two send real email immediately unless called with `draft=true`).

### Google Sheets (MCP, no CLI)

Same pattern as Gmail, same shared OAuth client -- `gateway/mcp_servers/sheets_mcp.py` talks to the Sheets API (and Drive, read-only, only for searching by name) directly.

**If Gmail is already set up, there's no new Cloud project step.** It's the same `data/credentials/gmail_client_secret.json` (same app, same client_id) -- just confirm the **Sheets API** and **Drive API** are both enabled on that project (APIs & Services > Library). Sheets gets its own scopes and its own token file, so it needs its own one-time consent:

```bash
docker compose up -d --build
docker compose run --rm -p 8765:8765 gateway python -m gateway.mcp_servers.sheets_auth_setup
# open the printed URL, sign in, approve -> writes ./data/credentials/sheets_token.json
docker compose restart gateway
```

Then attach the `sheets` MCP server to an agent, same as `gmail`.

Tools exposed: `read_values`, `append_values`, `update_values`, `list_sheets`, `create_spreadsheet`, `find_spreadsheet` (Drive name search). `append_values`/`update_values` take `values` as a list of rows (each a list of cell values) and an A1-notation `range`, e.g. `"Sheet1!A1"`.

### Telegram

1. Create a bot with [@BotFather](https://t.me/BotFather), get its token.
2. Add `TELEGRAM_BOT_TOKEN=your-token` to `.env`, then `docker compose up -d --build` (compose forwards `.env` via `env_file`).
3. Message your bot anything, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `message.chat.id` -- that's your chat_id.
4. Attach the `telegram-sender` skill to an agent, and mention the chat_id in its `SOUL.md` (e.g. "send Telegram updates to chat_id 123456789") so it doesn't need to be resupplied each time.

> The dashboard's Integrations panel Telegram field does **not** work -- it saves to a DB row the skill never reads. Use `.env` only.

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
