# Scenario: Software Engineering Agents (BA + Dev)

Two agents, `ba-agent` and `dev-agent`, collaborating via handoff to turn
one coarse feature request into a small working app.

## What it demonstrates

- Handoff between two agents (`handoff.enabled` + `handoff.targets`).
- Multi-round autonomous collaboration within a single user message
  (`execute_handoff_loop`, up to `max_rounds`), not just one delegate-and-return.
- Tool-scoped roles: BA has read/verify-only tools (`read_file`,
  `list_files`, `test_page`), dev-agent has `write_file`/`delete_file` too --
  BA can inspect and test what dev builds, but cannot implement anything
  itself. Enforced by capability list, not just instructed in the prompt.
- Real execution-based verification, not just reading source: `browser`
  MCP server (Playwright/headless Chromium) actually loads the built page,
  clicks through it, and reads back computed values.
- Analysis-and-slicing: BA breaks one coarse ask into an ordered backlog of
  small stories/slices, delegates one at a time, verifies each before
  moving to the next.

## Prerequisites (already built into this repo)

- `gateway/mcp_servers/filesystem_mcp.py` -- sandboxed file read/write,
  registered as `filesystem` in `data/mcp.json`.
- `gateway/mcp_servers/browser_mcp.py` -- headless-browser test tool,
  registered as `browser`. Needs Playwright + Chromium in the image
  (`playwright install --with-deps chromium` in the Dockerfile).
- `gateway/handoff.py` -- `execute_handoff_loop` (bounded multi-round
  handoff) and a lenient `HANDOFF_RE` (models don't always emit the
  `---HANDOFF: name---` marker with both dashes intact).

## Example prompt (to ba-agent)

> Build me a tiny expense tracker. I should be able to add expenses with a
> person, description and amount, see all expenses, the overall total, and
> totals by person. Keep it minimal and easy to use. Work with the
> development agent until you're satisfied that it meets the requirements.

## Known caveats

- **Model choice matters more than usual.** Tool-calling reliability is the
  dominant failure mode -- a model that sometimes emits malformed/fake tool
  calls will break this whole pattern regardless of prompting. `gpt-4o-mini`
  tested reliable; `deepseek/deepseek-chat` (via OpenRouter) did not.
- BA sometimes stops early (reports partial progress) despite round budget
  remaining, instead of auto-continuing to the next backlog item -- LLM
  instruction-following variance, not a mechanical bug. "continue" resumes it.
- Editing an agent's tool list in the dashboard UI can silently re-merge
  removed capabilities (e.g. bare `filesystem`/`browser` server names
  reappearing alongside the scoped `mcp__filesystem__read_file` etc.),
  reopening `write_file` access to BA. Worth fixing in `AgentEditor.tsx`
  before this scenario is attendee-facing.
- The dashboard doesn't live-refresh an agent's shown config/SOUL.md after
  an external update -- reload the page to see current state.

## Files

- `ba-agent/SOUL.md`, `ba-agent/agent.yaml`
- `dev-agent/SOUL.md`, `dev-agent/agent.yaml`

Snapshotted from the live, working DB state -- not hand-written from
scratch. Copy these into the dashboard (or POST to `/api/agents`) to
recreate the scenario.
