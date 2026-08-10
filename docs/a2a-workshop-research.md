# A2A research — spec vs Sutradhaar vs OpenClaw (workshop)

Deep dive for the XConf CTF track: what the **Linux Foundation Agent2Agent (A2A)** protocol actually is, how our gateway compares, what we can demo today, and what to build next.

**Primary sources:** [A2A spec](https://a2a-protocol.org/latest/specification/), [a2aproject/A2A](https://github.com/a2aproject/A2A), [Google A2A announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/), [Linux Foundation launch](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents).

---

## 1. What A2A is (in one paragraph)

A2A is an **open interoperability layer** so agents built on different frameworks, vendors, or hosts can **discover** each other, **delegate work**, and **collaborate without exposing internal memory, tools, or prompts**. Core primitives:

| Primitive | Role |
|-----------|------|
| **Agent Card** | JSON manifest (often at `/.well-known/agent.json`) — identity, skills, endpoints, auth schemes |
| **Client / remote agent** | Client formulates tasks; remote agent executes opaque |
| **Task** | Unit of work with lifecycle (running, input-required, completed, failed, canceled) |
| **Message + Part** | Turns with text, files, or structured data |
| **Artifact** | Durable output of a task |
| **Transport** | Typically **JSON-RPC 2.0 over HTTP(S)**; also streaming (SSE), push notifications, gRPC/REST bindings in spec |

Design principle: **opaque execution** — collaboration via declared capabilities and exchanged context, not shared toolchains.

---

## 2. OpenClaw / “other claws” vs LF A2A

OpenClaw (and community kits) solve **multi-agent inside one gateway**:

- Per-agent **SOUL.md**, workspace, SQLite **session** store
- **Bindings** route inbound channel traffic to the right agent
- Cross-agent work uses **internal** mechanisms (e.g. `sessions_send`, structured `HANDOFF` blocks, `agentTurn` / `sessionTarget`), not the LF JSON-RPC Agent Card model

That is **orchestration inside a product**, not **cross-vendor agent interoperability**.

**Workshop positioning for Sutradhaar:**

| Topic | OpenClaw-style workshop | Sutradhaar extra |
|--------|-------------------------|------------------|
| Persona / SOUL | Yes | Yes (same files under `data/agents/`) |
| Multi-agent routing | Bindings, sessions | **Visual pipeline**, orchestrator rules, handoff targets |
| “Agent speaks to agent” | `sessions_send` | **Concept** + pipeline edges labeled **A2A →** |
| **LF A2A standard** | Not the main story | **Agent Card**, `.well-known`, JSON-RPC story (even if partially stubbed) |
| External client (LangGraph, ADK, another host) | Unusual | **Teaching goal** once JSON-RPC is wired |

Honest pitch: *“Same SOUL/agent ideas as OpenClaw; we add a **visual gateway** and teach the **industry A2A card + task** vocabulary OpenClaw doesn’t standardize on.”*

---

## 3. Codebase validation (what we actually have)

### 3.1 Aligned with the spirit of A2A

| Area | Location | Assessment |
|------|----------|------------|
| Agent Card generation | `gateway/cardgen.py`, `gateway/a2a.py` | Name, description, skills, `supportedInterfaces` with JSONRPC URL — **reasonable subset** of spec |
| Well-known URL | `GET /a2a/{name}/.well-known/agent.json` | Matches discovery pattern; returns card JSON |
| UI discovery | `PipelineCanvas.tsx` | Flip card → skills/interfaces; “View A2A card JSON” modal |
| SDK types | `a2a-sdk`, `AgentCard`, `AgentSkill`, `DefaultRequestHandler` | Correct direction for a real server |
| Registry stores card | `agents.card_json` on create | Card persisted with agent |

### 3.2 Misaligned or stubbed (gaps)

| Gap | Evidence | Impact |
|-----|----------|--------|
| **JSON-RPC not executed** | `app.py` `a2a_catchall` / `a2a_root`: `POST` returns `{"agent", "received": body}` only | External A2A clients cannot run tasks; `message/send` does nothing useful |
| **Handler never mounted** | `DefaultRequestHandler` built in `_build_handler()` but **never invoked** from FastAPI routes | All `a2a-sdk` task lifecycle code is dead |
| **Handoff is not A2A** | `gateway/handoff.py` `route_handoff()` calls target agent’s LLM **in-process**; comment says “via A2A endpoint” but **no HTTP client** | Workshop can demo *delegation* but not *protocol* handoff |
| **A2A path ignores chat memory** | `GatewayAgentExecutor.execute()` — system + single user turn, no `memory.py` | Dashboard chat and A2A task would diverge if RPC worked |
| **Streaming advertised, not delivered** | Card `capabilities.streaming: true`; no SSE on `/a2a` | Spec clients expecting `message/stream` will fail |
| **No task artifacts / lifecycle** | No `tasks/get`, cancel, or artifact payloads in app routes | Cannot demo long-running task or “artifact” flag |
| **Hardcoded base URL** | Cards use `http://localhost:8080` | Broken behind another host/port unless regenerated |
| **No auth on card** | Spec: OAuth, API keys, signed cards | OK for local CTF; not enterprise story |
| **Debug log panel** | Dashboard “No events yet”; WS debug not wired to UI | Handoff / A2A events invisible in UI |
| **Tests** | `test_cardgen.py` only; no `test_a2a.py` / `test_handoff.py` (planned in implementation-plan) | Regressions easy |

**Live check (local):**

```bash
curl -s http://127.0.0.1:8080/a2a/lakshmi/.well-known/agent.json   # valid card
curl -s -X POST http://127.0.0.1:8080/a2a/lakshmi \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send",...}'
# → {"agent":"lakshmi","received":{...}}  (echo only)
```

### 3.3 What *does* work for “agent to agent” today

| Mechanism | How it works | A2A? |
|-----------|--------------|------|
| `---HANDOFF: target---` in LLM reply | `app.py` → `route_handoff()` | **No** (in-process LLM) |
| Orchestrator keyword rules | `run_orchestrator()` → `route_handoff()` | **No** |
| Pipeline edges | Drawn when `handoff_targets` includes target | **Visual only** |
| WS `handoff` event | `ws_manager.emit_handoff` | UI hook exists; debug panel unused |

---

## 4. Does our implementation “make sense”?

**As a workshop teaching ladder: yes, with caveats.**

- **Agent Cards + pipeline UI** are the right mental model for LF A2A discovery and delegation.
- **In-process handoff** is a valid **Day-1** pattern (fast, no network) but should be labeled **“gateway handoff (A2A-inspired)”** until `route_handoff` calls `POST /a2a/{target}` with real JSON-RPC.
- **Claiming full A2A compliance** would be wrong today; **claiming “A2A Agent Cards + roadmap to JSON-RPC tasks”** is accurate.

**Minimum fix for a credible “A2A flag”:** wire FastAPI routes to `handler_info["handler"]` (or `create_jsonrpc_routes` from SDK) and make handoff use an HTTP A2A client to the target’s endpoint (same process is fine).

---

## 5. Workshop scenarios (CTF ideas)

Grouped by what works **now** vs **after wiring JSON-RPC**.

### Tier A — works today (keep in CTF doc)

1. **Agent Card discovery**
   - Flip pipeline node → compare skills to agent’s SOUL/skills checkboxes
   - `curl` `.well-known/agent.json`; paste into “View A2A card JSON”
   - Flag: name a skill id from the card

2. **Wire handoff graph (config, not wire protocol)**
   - Set handoff targets BA → Dev → QA in editor
   - See **A2A →** edges on pipeline
   - Flag: screenshot or name target list

3. **Gateway handoff directive**
   - SOUL instructs: end with `---HANDOFF: dev-agent---`
   - User message to BA; chat shows `[dev-agent]: ...` appended
   - Flag: substring in combined reply

4. **Orchestrator routing**
   - Use `templates/orchestrator` rules (finance → `lakshmi`, build → `ba-agent`)
   - Flag: expense message routed to Lakshmi persona

5. **Opaque agents story (discussion)**
   - Compare OpenClaw `sessions_send` HANDOFF block vs our `---HANDOFF---`
   - Compare LF A2A “remote agent doesn’t see your tools” vs Lakshmi memory-only SOUL

6. **Memory-only Lakshmi** (already in `ctf-scenarios.md`)
   - Complements A2A: “context stays in agent boundary until delegated”

### Tier B — needs JSON-RPC + handoff client (high impact demo)

7. **External A2A ping**
   - `message/send` to `/a2a/demo` from curl or `a2a-sdk` client; get real assistant text + task id

8. **True A2A handoff**
   - Agent A’s handoff POSTs task to Agent B’s `/a2a/b` endpoint; B’s memory optional separate thread

9. **Two hosts (opaque)**
   - Two uvicorn ports, two cards with each other’s URLs; one message crosses hosts

10. **Task lifecycle**
    - Long-running task → `tasks/get` → completed + artifact text

### Tier C — stretch / “cool from the internet”

11. **Multi-agent healthcare / travel samples** (from A2A repo samples) — reimplement mini version with 3 cards on dashboard

12. **MCP + A2A** — agent card lists skills; tools stay behind MCP (spec explicitly allows opaque tools)

13. **Signed Agent Card** (spec 1.x) — discuss enterprise; optional mock “verified” badge in UI

14. **Client capability negotiation** — card says streaming false until implemented; teach honest cards

---

## 6. Recommended narrative for the room (2–5 min slide)

1. **Problem:** dozens of agent frameworks; need a **common wire format**.
2. **A2A answer:** Agent Card + tasks + JSON-RPC; agents as peers, not shared prompts.
3. **OpenClaw:** great for **your** agents on **your** channels; handoffs via **internal** session tools.
4. **Sutradhaar:** SOUL-compatible files + **live graph** + **Agent Cards**; handoffs today are **gateway-native**, JSON-RPC is the **next unlock** for real interoperability.
5. **Your CTF path:** Card → wire graph → handoff → orchestrator → (stretch) curl `message/send`.

---

## 7. Suggested engineering priority (if we invest before workshop)

1. Mount `DefaultRequestHandler` on `/a2a/{name}` POST (JSON-RPC).
2. `route_handoff` → A2A client `message/send` to target URL from target’s card.
3. Share memory policy: handoff context as user message on target (already roughly true).
4. Wire debug log to WS (`emit_debug` / `handoff` already emitted).
5. Configurable public base URL for cards (`PUBLIC_URL` env).
6. Tests: card shape + one JSON-RPC round-trip + handoff integration.

---

## 8. References

- Spec: https://a2a-protocol.org/latest/specification/
- Repo: https://github.com/a2aproject/A2A
- OpenClaw multi-agent: https://docs.openclaw.ai/concepts/multi-agent
- Our code: `gateway/a2a.py`, `gateway/handoff.py`, `gateway/cardgen.py`, `app.py` (A2A routes), `frontend/src/components/PipelineCanvas.tsx`
