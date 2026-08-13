---
date: 2026-08-06
topic: workshop-agent-gateway
---

# Workshop Agent Gateway

## Summary

A Python agent gateway with a live web dashboard that teaches OpenClaw patterns (SOUL.md, agent teams, handoff, tool calling, MCP, orchestration) through three progressive hands-on exercises. Uses the A2A protocol (Linux Foundation standard, Python SDK) for all agent-to-agent communication -- Agent Cards are auto-generated from agent config on save. Ships as a single `docker-compose up` with pre-baked tools (Gmail, Sheets, OCR, Telegram). Attendees build all agents from scratch via the dashboard and wire them together.

---

## Problem Frame

The XConf 2026 workshop ("Build Your AI Agent Orchestra") is marketed as an OpenClaw workshop with 100 attendees (mix of coders and non-coders) over 2 hours. Real OpenClaw carries too much risk for a workshop setting: 500K LOC of TypeScript, Docker-based install, Node toolchain, 53 config files, and a security model that raises flags in corporate environments. Attendees cannot install it reliably in 30 minutes.

The workshop needs a gateway that teaches the same concepts attendees would learn with OpenClaw -- agent personas, tool calling, handoff, teams, orchestration -- but with zero setup friction, a live visual dashboard, and zero security concerns. The dashboard is the primary differentiator: attendees see their agents come alive in real time, watch messages flow between agents, and visually debug handoff paths.

After the workshop, attendees take home portable SOUL.md files and an understanding of agent patterns they can apply to real OpenClaw or any agent framework.

---

## Actors

- A1. **Workshop attendee (coder):** Edits SOUL.md, YAML configs, tool wiring, handoff rules, and orchestrator routing via the dashboard. May also write custom Python tools after the workshop.
- A2. **Workshop attendee (non-coder):** Edits SOUL.md personas and agent names via a form UI in the dashboard. Does not write code or YAML.
- A3. **Workshop presenter (Jigar):** Runs the gateway on the stage laptop, triggers demo scenarios, monitors agent traffic on the dashboard projected to the audience.

---

## Key Flows

- F1. **One-click start**
  - **Trigger:** Attendee runs `docker-compose up` from the cloned workshop repo.
  - **Actors:** A1, A2
  - **Steps:** Docker pulls the image, starts gateway + dashboard server. Browser opens to `http://localhost:8192`. No CLI setup, no API keys required to start.
  - **Outcome:** Dashboard is live, showing zero agents. Ready for first agent creation.
  - **Covered by:** R1, R2, R22

- F2. **Build a simple agent (Layer 1)**
  - **Trigger:** Attendee clicks "New Agent" in the dashboard.
  - **Actors:** A1, A2
  - **Steps:** Attendee fills in agent name (e.g., "Lakshmi"), writes a SOUL.md persona in the built-in editor, selects tools from the pre-baked list (Telegram, Sheets), saves. Agent appears as an active node on the dashboard. Attendee sends a test message via the chat panel or Telegram. Agent responds.
  - **Outcome:** Agent replies with persona-consistent response. Dashboard shows the message round-trip and any tool calls.
  - **Covered by:** R3, R4, R5, R6, R7

- F3. **Wire external integrations (Telegram, Google Workspace)**
  - **Trigger:** Attendee opens the integrations panel in the dashboard.
  - **Actors:** A1, A2
  - **Steps:** Attendee clicks "Connect Telegram" -- dashboard shows BotFather instructions + token input field. Paste token, save. Attendee clicks "Connect Google" -- dashboard initiates OAuth flow, opens browser to Google consent screen. On callback, credentials stored. Assign integrations to specific agents.
  - **Outcome:** Agents can send/receive Telegram messages and read/write Google Sheets and Gmail.
  - **Covered by:** R10, R11, R13, R20

- F4. **Agent team handoff (Layer 2)**
  - **Trigger:** Attendee creates BA, Dev, and QA agents, wires a handoff chain.
  - **Actors:** A1
  - **Steps:** Create three agents with distinct SOUL.md personas (BA requirements-writer, Dev coder, QA tester). Configure handoff rules: BA -> Dev -> QA. Send a task to the BA. BA responds with requirements, hands off to Dev. Dev writes code, hands off to QA. QA reviews. All transitions visible as animated arrows on the dashboard pipeline view.
  - **Outcome:** Task completes across three agents with full traceability. Dashboard shows handoff path, each agent output, and timing.
  - **Covered by:** R3, R8, R18, R19

- F5. **Orchestrator routing (Layer 3)**
  - **Trigger:** Attendee creates an orchestrator agent with routing rules.
  - **Actors:** A1
  - **Steps:** Create orchestrator, define routing rules (e.g., "expense-related -> finance agent", "build/software -> dev team"). Send a message to the orchestrator. Dashboard shows orchestrator analyzing the message, selecting the target agent, and forwarding.
  - **Outcome:** Context-aware routing visible in real time. Orchestrator node shows which rule matched and why.
  - **Covered by:** R3, R15, R16, R18, R19

---

## Requirements

**Startup and platform**

- R1. Starts with a single command: `docker-compose up`. No prior install of Node, Python, or any toolchain required on the host.
- R2. The dashboard is served on `http://localhost:8192` and works in any modern browser. No desktop app or additional CLI steps required beyond the initial docker-compose command. Port 8192 serves the dashboard, the API, and A2A Agent Card discovery endpoints -- single port, single container.
- R22. The gateway runs as a single Python asyncio process inside the container. Agents share the runtime for simplicity and full dashboard visibility.

**Agent creation and configuration**

- R3. Attendees create agents entirely through the dashboard UI. File-system editing is also supported but not required.
- R4. Each agent is defined by a `SOUL.md` (persona in markdown) and an `agent.yaml` (name, tools, model, handoff rules). File format is OpenClaw-compatible at the YAML/markdown level.
- R5. The dashboard provides a built-in SOUL.md editor with live markdown preview.
- R6. The dashboard provides a tool picker (checkboxes for pre-baked tools) to wire tools to agents without editing YAML.
- R7. Each agent has a chat panel in the dashboard where attendees can send test messages and see responses in real time.

**Agent runtime**

- R8. Supports agent-to-agent handoff using the A2A protocol (JSON-RPC 2.0 over HTTP + SSE). Agents communicate as A2A peers: each agent exposes an auto-generated Agent Card at `/a2a/{name}/.well-known/agent.json` and can invoke other agents via A2A task submission. The dashboard visualizes the A2A task lifecycle (submitted -> working -> completed) as animated edges on the pipeline view.
- R9. Supports tool calling: agents can invoke pre-baked tools (Python functions) during conversation. Tool calls and results appear in the dashboard debug log.
- R10. Supports MCP tool servers: attendees can configure external MCP server endpoints in `agent.yaml` and agents can invoke tools from those servers.
- R26. On agent save, the framework auto-generates an A2A Agent Card from the agent.yaml and SOUL.md. Agent Cards list the agent's skills (derived from tool wiring), modalities, and endpoint URL. Cards are immediately discoverable by other agents and visible in the dashboard.

**Pre-baked tools**

- R11. **Gmail reader:** Read and search Gmail inbox. Supports OAuth via GOG CLI or native Python OAuth flow, configurable from the dashboard.
- R12. **Google Sheets writer/reader:** Append rows, read ranges from Google Sheets. Same OAuth flow as Gmail.
- R13. **Telegram sender/receiver:** Send and receive Telegram messages via bot token. Token input field in the dashboard integrations panel.
- R14. **OCR (PaddleOCR):** Extract text from uploaded images/PDFs. Used by the finance agent to parse receipts and salary slips.

**Orchestrator**

- R15. Attendees can create a special "orchestrator" agent that routes incoming messages to other agents using A2A task delegation. Routing rules are configurable: keyword match, intent classification via LLM, or explicit routing table. The orchestrator discovers available agents via their A2A Agent Cards.
- R16. Orchestrator routing decisions are visible in the dashboard: which rule matched, which Agent Card was consulted, confidence score, and target agent selected.

**Dashboard**

- R17. **Agent monitoring panel:** Real-time list of all agents with status (idle/thinking/error), last message timestamp, and active tool calls. Updates via WebSocket.
- R18. **Pipeline visualization:** A node graph showing agents as nodes and handoff paths as animated edges. Live traffic animates along edges when messages flow between agents. Dark theme with neon-style agent nodes.
- R19. **Debug log panel:** Chronological feed of all agent messages, handoff events, tool calls, and errors. Filterable by agent. Shows raw request/response payloads.
- R20. **Integration panel:** OAuth flow initiation for Google Workspace, token input for Telegram, MCP server endpoint configuration. All done in-browser without touching files.
- R21. Dashboard design is modern, minimal, and animated. Dark theme by default. Uses animated traffic indicators on agent nodes and handoff edges. Cross-platform browser-based (no OS-specific dependencies).

**Framework internals**

- R23. Agent state, configuration, and message history persist across restarts via a local SQLite database.
- R24. All LLM calls route through a configurable LiteLLM-compatible endpoint (`OPENAI_BASE_URL` + `OPENAI_API_KEY` env vars). Defaults to DeepSeek V4 Flash for the workshop.

**Portability**

- R25. SOUL.md and agent.yaml files created in this gateway are portable to real OpenClaw. The framework reads the same file format OpenClaw uses for agent definitions. After the workshop, attendees can copy their agent files into an OpenClaw install and they will work (conceptually -- the tool implementations differ, but agent persona, handoff rules, and routing config carry over).

---

## Acceptance Examples

- AE1. **Covers R1, R2.** Given a machine with Docker installed, when an attendee runs `docker-compose up` and opens `http://localhost:8192`, the dashboard appears within 30 seconds with an empty agent list and functional UI.

- AE2. **Covers R3, R4, R5, R7.** Given the dashboard, when an attendee creates a new agent named "Lakshmi" with a SOUL.md persona "You are a helpful finance advisor" and clicks Save, the agent appears in the agent list. When the attendee sends "hello" in the agent's chat panel, the agent responds within 5 seconds with a persona-consistent reply.

- AE3. **Covers R8, R18, R26.** Given three agents (BA, Dev, QA) with BA configured to handoff to Dev, and Dev to QA, when a message is sent to BA, the dashboard pipeline view shows an animated edge from BA to Dev and then Dev to QA. The debug log records A2A task lifecycle transitions (submitted -> working -> completed) with full message payloads. Each agent's Agent Card at `/a2a/{name}/.well-known/agent.json` returns a valid card with skills derived from tool wiring.

- AE4. **Covers R15, R16.** Given an orchestrator with a rule "if message contains 'expense' or 'spent', route to finance-agent", when the message "what did I spend on coffee this month?" is sent to the orchestrator, the dashboard shows the orchestrator matched the expense rule and routed to the finance agent. The debug log shows the matched keyword and confidence score.

- AE5. **Covers R11, R12, R13, R20.** Given a Google OAuth flow completed via the integrations panel and a Telegram bot token entered, when the finance agent is asked to "add 20 rupees for coca cola", the agent categorizes the expense, writes to the connected Google Sheet, and confirms via Telegram.

- AE6. **Covers R9, R19.** Given an agent with the OCR tool wired, when an attendee uploads a receipt image via the chat panel, the dashboard debug log shows the tool call (OCR invocation), the extracted text result, and the agent's subsequent response incorporating that text.

---

## Success Criteria

- 100 attendees start the gateway from `docker-compose up` within the first 5 minutes of the workshop. Docker pull time is pre-warmed via venue WiFi or USB drives per the workshop fallback plan.
- Attendees create their first agent (SOUL.md + tool wiring) through the dashboard in under 10 minutes without a TA's help.
- The BA-Dev-QA handoff chain completes end-to-end with all three transitions visible on the dashboard pipeline view.
- The orchestrator correctly routes "what was my expense on coffee?" to the finance agent and "build me a login page" to the dev team, with routing decisions visible in the debug log.
- After the workshop, an attendee can copy their SOUL.md and agent.yaml into a real OpenClaw install and the agent persona and handoff configuration work (modulo tool implementations).

---

## Scope Boundaries

- No real OpenClaw runtime or API compatibility. The file format is compatible; tool implementations and the runtime are purpose-built.
- No per-agent process isolation or Docker containers within the gateway. All agents share one Python process.
- No multi-user auth, user accounts, or role-based access control. The dashboard is single-user on localhost.
- No production-grade persistence, scaling, or load handling. SQLite is sufficient for workshop use.
- No custom tool authoring during the workshop. Attendees wire pre-baked tools; writing new Python tools is a post-workshop path.
- No cloud deployment or hosting. The gateway runs 100% locally via Docker.

---

## Key Decisions

- **File-level OpenClaw compatibility, not runtime compatibility:** SOUL.md and agent.yaml formats match OpenClaw's. ClawHub skills cannot be drop-in executed (they are JS/TS), but the concepts and config patterns are portable. This keeps the framework Python-native and os-independent.
- **Single Docker image with dashboard as the configuration surface:** No CLI config, no file editing required. All agent creation, tool wiring, OAuth, and token setup happens in the browser-based dashboard. This serves both coders and non-coders.
- **Single-process asyncio runtime:** All agents share one Python process. This simplifies the codebase, makes the dashboard see everything, and lets attendees debug handoff visually. The trade-off (no isolation) is acceptable for a workshop.
- **Pre-baked tools only during the workshop:** Attendees do not write Python during the 2-hour session. The hands-on is agent creation, persona writing, tool wiring, handoff configuration, and orchestrator rule definition.
- **Dark, animated dashboard with live traffic visualization:** The dashboard is the main differentiator from real OpenClaw. It shows what OpenClaw does internally but never exposes visually.
- **A2A protocol for all agent-to-agent communication:** Handoff and orchestrator routing use the Linux Foundation A2A standard (Python SDK, JSON-RPC over HTTP + SSE). Agent Cards are auto-generated from agent.yaml on save -- attendees never touch A2A config. This teaches a real industry standard (150+ orgs in production) and makes agent discovery automatic.
- **Three-layer architecture: SOUL.md for persona, MCP for tools, A2A for handoff:** This is the actual 2026 enterprise pattern. Attendees walk out understanding all three standards and how they compose.

---

## Dependencies / Assumptions

- **Docker on every attendee machine.** The workshop docs already require this. The Docker image includes Python, all pre-baked tool dependencies, and the dashboard static files.
- **Attendees bring their own LLM API key.** DeepSeek V4 Flash is the default model. A `.env.template` in the repo guides key setup. LiteLLM proxy is optional (workshop docs mention it for budget control).
- **Telegram bot creation is hands-on.** Attendees use BotFather themselves. The dashboard provides inline instructions and the token input field.
- **Google OAuth flow works in a browser.** Attendees need a Google Cloud project with Gmail and Sheets APIs enabled. This is the riskiest setup step; the integrations panel should provide a guided walkthrough with screenshots.
- **Venue WiFi can handle 100 concurrent users pulling a Docker image.** Pre-warmed USB drives as fallback per the workshop docs.
- **A2A Python SDK (`a2a-sdk`) is bundled in the Docker image.** The framework depends on `a2a-sdk>=1.1.0` for Agent Card generation, task lifecycle management, and JSON-RPC transport. No external A2A infrastructure needed -- all agents communicate within the same localhost process.

---

## Outstanding Questions

### Resolve Before Planning

- [Affects R18][Product decision] Pipeline visualization library: should this use a lightweight canvas/SVG approach (D3.js, Cytoscape.js) for the node graph, or a simpler CSS-animated list with arrows? The "animated edges with live traffic" requirement pushes toward a graph library, but that adds frontend complexity.

### Deferred to Planning

- [Affects R8][Technical] How the A2A task handler invokes the agent's LLM loop: should each agent run a tight polling loop (`while task active: poll for messages, call LLM, stream back`), or should the gateway use an event-driven model where new A2A messages directly trigger agent processing?
- [Affects R10][Technical] MCP transport support: stdio only, or HTTP/SSE as well? OpenClaw supports both; starting with HTTP/SSE is simpler for a Python gateway.
- [Affects R24][Technical] LLM provider abstraction: wrap the OpenAI-compatible endpoint directly, or route through a LiteLLM proxy for multi-model support?
- [Affects R17][Technical] Frontend framework choice for the dashboard: vanilla HTML/CSS/JS with WebSocket, or a lightweight framework like Alpine.js/HTMX to keep the Docker image small?
