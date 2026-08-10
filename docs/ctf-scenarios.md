# Sutradhaar workshop CTF — scenarios to keep

Living checklist of hands-on scenarios we want in the room. Add new sections as we design more flags.

---

## Baseline (app + agents)

1. **Make sure the app starts**
   - Local: `DATA_DIR=./data MOCK_TOOLS=true uvicorn app:app --host 127.0.0.1 --port 8080`
   - Dashboard: http://127.0.0.1:8080/
   - Health: `GET /api/gateway/health` → `status: ok`

2. **Creating a chat with the default agent**
   - Use built-in agent (e.g. `demo`) from the Agents sidebar or pipeline
   - Send a message in Agent Chat; confirm reply and status in UI

3. **Creating a custom agent with SOUL.md**
   - New Agent (or API `POST /api/agents`)
   - Edit persona/rules in the SOUL.md editor; save
   - Chat once to confirm tone follows SOUL

4. **Creating a financial agent with finance SOUL and instructions**
   - Agent name e.g. `lakshmi` (or workshop template `finance-agent`)
   - SOUL: finance coach persona, expense logging rules, boundaries
   - Optional later: skills/MCP (Sheets, Telegram); not required for memory-only track

---

## Scenario: Memory-only Lakshmi (SOUL + chat history, no tools)

**Keep this scenario.** Proves multi-turn recall without Gmail, Sheets, OCR, or Telegram.

- Agent: **`lakshmi`** (separate from **`ctf-lakshmi`** — chat history is per agent name)
- Config: no skills, no MCP, no legacy tools; LLM e.g. OpenCode Go + `deepseek-v4-flash`
- SOUL: memory-only finance coach (INR/₹, categories, no external access)
- Clear chat: Agent Chat → **Clear** (or `DELETE /api/agents/lakshmi/messages`)
- UI: select **`lakshmi`** in sidebar; pill must say `lakshmi` or you see the wrong thread after refresh

**Suggested chat script (subpoints / flag checks):**

- Log coffee: `I bought coffee for ₹42 this morning.` → acknowledges in chat, not “wrote to sheet”
- Log lunch: `Lunch was ₹350 at the office cafeteria.` → running total **₹392**
- Recall total: `What did I spend today in total? List each item and the sum.` → both items + **₹392**
- Single recall: `How much was the coffee again?` → **₹42**
- Missing amount: `I also got groceries.` → asks for amount, does not invent
- No tools: `Please read my Google Sheet for last month's expenses.` → denies access; chat memory only

**Notes from first run:** History persists in SQLite and loads on refresh when the correct agent is selected; `localStorage` remembers last selected agent.

---

## Scenario: A2A Agent Card discovery (Tier A — works today)

- Flip a pipeline node → **A2A** back face; open **View A2A card JSON**
- `GET /a2a/{name}/.well-known/agent.json` and match skills to SOUL / skill checkboxes
- Flag: quote one `supportedInterfaces` URL or a skill `id` from the card

## Scenario: Handoff graph wiring (Tier A — config + UI)

- Create BA / Dev / QA (templates under `templates/`)
- Enable handoff targets (e.g. BA → `dev-agent`) in agent editor
- Confirm pipeline **A2A →** edge appears
- Flag: list handoff targets for one agent

## Scenario: Gateway handoff directive (Tier A — in-process, not JSON-RPC yet)

- SOUL tells agent to emit `---HANDOFF: dev-agent---` when ready to delegate
- Chat with source agent; response includes `[dev-agent]: ...` block
- Note: `gateway/handoff.py` runs target LLM in-process; does **not** call `/a2a` yet (see `docs/a2a-workshop-research.md`)

## Scenario: Orchestrator routing (Tier A)

- Agent `orchestrator` with keyword rules (finance → `lakshmi`, build → `ba-agent`)
- Send expense vs feature message; verify routed persona/reply
- Flag: which rule fired (keyword match)

## Scenario: True A2A JSON-RPC task (Tier B — after wiring handler)

- `POST /a2a/{name}` with `message/send` returns assistant output + task lifecycle (not echo stub)
- Optional: external `a2a-sdk` client from a second terminal
- Flag: task id or final artifact text from JSON-RPC response

## Scenario: A2A-native handoff (Tier B)

- Handoff engine POSTs to target agent’s A2A endpoint (opaque remote agent)
- Flag: target reply only via A2A path (network tab / debug log)

---

## Research notes

Full A2A vs codebase vs OpenClaw analysis: **`docs/a2a-workshop-research.md`**

## To add later

_(More CTF flags — MCP tools, Sheets/Telegram, BA→Dev→QA full chain, two-host A2A.)_
