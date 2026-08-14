import type { LevelId } from './workshopUnlock'

export type StageSectionTone = 'theory' | 'do' | 'check' | 'play' | 'tip'

export type WorkshopTask = {
  /** Bold task title, e.g. "Gateway is alive" */
  title: string
  /** Up to ~2 lines of how to do / what proves it */
  detail: string
  /** Explicit label override, e.g. "2.1" (defaults to array index + 1) */
  label?: string
  /** Points this task is worth, shown as a badge */
  xp?: number
}

export type WorkshopStage = {
  id: LevelId
  index: number
  title: string
  shortTitle: string
  blurb: string
  xp: number
  theory: string[]
  do: string[]
  tasks: WorkshopTask[]
  tip?: string
  needsCode: boolean
  showPlaygroundCta?: boolean
}

export const WORKSHOP_STAGES: WorkshopStage[] = [
  {
    id: 'boot',
    index: 1,
    title: 'Boot the lab',
    shortTitle: 'Boot',
    blurb: 'Get the gateway online and wire a provider.',
    xp: 100,
    theory: [
      'Sutradhaar is a local agent gateway + dashboard.',
      'A provider is the LLM endpoint your agents call.',
      'Nothing works until the app is up and a provider is set.',
    ],
    do: [
      'Star the repo (optional, facilitator may ask).',
      'Start with Docker Compose and open the dashboard.',
      'Add / select a provider in Playground → Providers.',
    ],
    tasks: [
      {
        title: 'Gateway is alive',
        detail:
          'Bring the stack up with Docker Compose and open http://localhost:8192. Confirm the dashboard loads (not a blank or connection error).',
      },
      {
        title: 'Provider wired',
        detail:
          'In Playground → Providers, add or select an LLM provider with a working key/model. You need this before any agent can reply.',
      },
      {
        title: 'Health check passes',
        detail:
          'Hit GET /api/gateway/health (browser or curl). You’re done when the JSON shows status ok.',
      },
    ],
    tip: 'If the UI is old, hard-refresh. Room default: docker compose up --build.',
    needsCode: false,
    showPlaygroundCta: true,
  },
  {
    id: 'shape',
    index: 2,
    title: 'Shape an agent',
    shortTitle: 'Shape',
    blurb: 'See the difference between a blank agent and one with a SOUL.',
    xp: 150,
    theory: [
      'An agent is a named chat + config.',
      'SOUL.md is the persona / rules contract.',
      'Without a soul, replies feel generic.',
    ],
    do: [
      'Create a new agent with no SOUL. Chat once.',
      'Paste a sample SOUL, save, chat again.',
      'Notice tone / boundaries change.',
    ],
    tasks: [
      {
        title: 'Spawn a blank agent',
        detail:
          'Create a new agent from the sidebar. Leave SOUL empty for now so you can feel the default, generic behavior.',
      },
      {
        title: 'Chat before SOUL',
        detail:
          'Send one short message. Note the tone — usually helpful but not “in character” or constrained by room rules.',
      },
      {
        title: 'Install a SOUL',
        detail:
          'Paste a sample SOUL (from facilitator / samples), save, then ask something that should trigger the persona or a boundary.',
      },
      {
        title: 'Persona sticks',
        detail:
          'Confirm the reply clearly follows the SOUL (voice, rules, or refusal). Mark this when the before/after difference is obvious.',
      },
    ],
    tip: 'You’ll reuse this create → SOUL → chat loop for Lakshmi next.',
    needsCode: false,
    showPlaygroundCta: true,
  },
  {
    id: 'lakshmi',
    index: 3,
    title: 'Memory vault',
    shortTitle: 'Memory',
    blurb: 'Chat history as memory — no sheets, no tools.',
    xp: 250,
    theory: [
      'Multi-turn memory lives in chat history.',
      'SOUL can teach categories + “ask if amount missing”.',
      'Clearing chat wipes that memory.',
    ],
    do: [
      'Create / select agent lakshmi with a finance SOUL (no MCP).',
      'Log coffee ₹42, lunch ₹350, ask for total.',
      'Ask for coffee again; try “I got groceries” with no amount.',
      'Ask it to read a Google Sheet — it should refuse.',
    ],
    tasks: [
      {
        title: 'Lakshmi is ready',
        detail:
          'Use agent lakshmi with a finance SOUL and no Sheets/Gmail MCP. Select it in the sidebar so history sticks to the right name.',
      },
      {
        title: 'Log two expenses',
        detail:
          'Tell it coffee was ₹42 and lunch was ₹350. It should acknowledge both in chat (not claim it wrote to a sheet).',
      },
      {
        title: 'Running total ₹392',
        detail:
          'Ask for today’s total with a per-item list. Flag this when you see both lines and sum ₹392.',
      },
      {
        title: 'No invented amounts',
        detail:
          'Say you got groceries with no price. It should ask for the amount instead of inventing one.',
      },
      {
        title: 'Refuse the sheet',
        detail:
          'Ask it to read your Google Sheet. With no tools, it must refuse / say it only has chat memory.',
      },
    ],
    tip: 'Wrong agent selected = wrong (or empty) history after refresh.',
    needsCode: true,
    showPlaygroundCta: true,
  },
  {
    id: 'sheets',
    index: 4,
    title: 'Sticky tools',
    shortTitle: 'Sheets',
    blurb: 'When chat memory dies, MCP + Sheets keep the record.',
    xp: 600,
    theory: [
      'Clear chat = amnesia for history-only agents.',
      'MCP tools let the agent act outside the chat.',
      'Sheets = durable store for expenses.',
    ],
    do: [
      'Clear Lakshmi chat — prove it forgot.',
      'Connect Google Sheets MCP to the agent.',
      'Log an expense that lands in the sheet.',
      'Clear chat again; ask for data from the sheet.',
    ],
    tasks: [
      {
        title: 'Prove amnesia',
        detail:
          'Clear Lakshmi’s chat, then ask what you spent earlier. It should not recall the ₹392 story from memory alone.',
      },
      {
        title: 'Sheets MCP online',
        detail:
          'Attach the Google Sheets MCP (room credentials from facilitator) so the agent can call sheet tools.',
      },
      {
        label: '2.1',
        xp: 30,
        title: 'Browser logged in',
        detail: 'Open the browser where your GMail user is already logged in.',
      },
      {
        label: '2.2',
        xp: 30,
        title: 'Create GCP project',
        detail: 'Go to https://console.cloud.google.com/. Create Google Cloud Project "Sutradhaar" for your GMail. Do not select "Organization"',
      },
      {
        label: '2.3',
        xp: 30,
        title: 'Configure consent screen',
        detail: 'Select the newly created project. Configure the OAuth consent screen for the project. Search for "Credentials" and then click "Configure Consent screen". Click "Get Started". ',
      },
      {
        label: '2.4',
        xp: 30,
        title: 'Enable APIs',
        detail: 'Enable Sheets API and Drive API. https://console.developers.google.com/apis/api/drive.googleapis.com and https://console.developers.google.com/apis/api/sheets.googleapis.com/',
      },
      {
        label: '2.5',
        xp: 30,
        title: 'Add test user',
        detail: 'Add a test user — the same GMail you are using. Go to "Audience" and add your GMail id as a test user',
      },
      {
        label: '2.6',
        xp: 30,
        title: 'Create OAuth client',
        detail: 'Create OAuth Client and download the credentials json. Application type should be "Desktop"',
      },
      {
        label: '2.7',
        xp: 30,
        title: 'Place credentials',
        detail:
          'Copy the credentials json into data/credentials/ as "google_client_token.json".',
      },
      {
        label: '2.8',
        xp: 30,
        title: 'Run auth setup',
        detail:
          'Run `docker compose run --rm -p 8765:8765 gateway python -m gateway.mcp_servers.sheets_auth_setup` and note the url.',
      },
      {
        label: '2.9',
        xp: 30,
        title: 'Grant permissions',
        detail: 'Access the url in the same browser where your GMail user is logged in. Grant all the permissions.',
      },
      {
        label: '2.10',
        xp: 30,
        title: 'Restart gateway',
        detail: 'Restart gateway with `docker compose restart gateway`.',
      },
      {
        title: 'Write sticks',
        detail:
          'Log a new expense and confirm a row appears in the shared sheet (UI or sheet itself).',
      },
      {
        title: 'Survive a clear',
        detail:
          'Clear chat again, then ask for expenses from the sheet. You’re done when the answer comes from the sheet, not chat history.',
      },
    ],
    tip: 'Facilitator owns OAuth / sheet link for the room.',
    needsCode: true,
    showPlaygroundCta: true,
  },
  {
    id: 'gmail',
    index: 5,
    title: 'Inbox',
    shortTitle: 'Gmail',
    blurb: 'Agents can read the world — start with Gmail.',
    xp: 300,
    theory: [
      'Tools aren’t only for writing — they can read.',
      'Ground answers in the mail, don’t invent.',
      'Periodic sniffing is homework, not room-required.',
    ],
    do: [
      'Attach Gmail MCP to an agent.',
      'Read a test / labeled message.',
      'Ask a question that only the mail can answer.',
    ],
    tasks: [
      {
        title: 'Gmail MCP online',
        detail:
          'Connect Gmail MCP to your agent with the room setup. Confirm tools show up for that agent.',
      },
      {
        title: 'Open a real message',
        detail:
          'List or open a test / labeled mail the facilitator prepared. You should see a real subject or snippet, not a guess.',
      },
      {
        title: 'Grounded answer',
        detail:
          'Ask a question only that mail can answer. Mark this when the reply clearly uses the mail content.',
      },
    ],
    tip: 'Homework stretch: poll Gmail on a timer outside room time.',
    needsCode: true,
    showPlaygroundCta: true,
  },
  {
    id: 'handoff',
    index: 6,
    title: 'Wire the network',
    shortTitle: 'Handoff',
    blurb: 'BA + Dev — one agent delegates to another.',
    xp: 400,
    theory: [
      'Multi-agent = specialize, then hand off.',
      'Handoff targets are configured on the agent.',
      'Watch the pipeline edge and debug log.',
    ],
    do: [
      'Create BA + Dev from templates (or samples).',
      'Enable BA → Dev handoff.',
      'Ask BA for something that needs Dev.',
      'Confirm Dev reply / handoff in chat or debug.',
    ],
    tasks: [
      {
        title: 'BA and Dev exist',
        detail:
          'Create (or load) BA and Dev agents from templates/samples so both names show in the sidebar.',
      },
      {
        title: 'Handoff target set',
        detail:
          'On BA, enable Dev as a handoff target and save. Config should list Dev as a destination.',
      },
      {
        title: 'Pipeline edge visible',
        detail:
          'In the pipeline view, confirm an A2A / handoff edge from BA toward Dev (flip the card if needed).',
      },
      {
        title: 'Handoff fires',
        detail:
          'Ask BA for work that needs Dev. Mark this when chat or debug shows a handoff / Dev reply block.',
      },
    ],
    tip: 'SOUL can teach when to emit a handoff directive.',
    needsCode: true,
    showPlaygroundCta: true,
  },
  {
    id: 'door',
    index: 7,
    title: 'One door',
    shortTitle: 'Door',
    blurb: 'Orchestrator routes; Telegram is how humans walk in.',
    xp: 500,
    theory: [
      'Orchestrator = front desk with routing rules.',
      'Finance → Lakshmi, build → BA (example rules).',
      'Telegram attaches a human channel to one agent.',
    ],
    do: [
      'Configure orchestrator rules (keywords / targets).',
      'Send a finance message and a build message — check routes.',
      'Connect Telegram to an agent; message from your phone.',
    ],
    tasks: [
      {
        title: 'Routing rules live',
        detail:
          'Enable orchestrator rules so finance-like messages go to Lakshmi and build-like messages go to BA (or your room’s targets).',
      },
      {
        title: 'Finance route',
        detail:
          'Send an expense-style message through the orchestrator. Confirm it lands on Lakshmi (reply persona or debug route).',
      },
      {
        title: 'Build route',
        detail:
          'Send a feature/build request. Confirm it routes to BA (or your configured build agent).',
      },
      {
        title: 'Telegram linked',
        detail:
          'Attach a bot token to one agent and send a first message from your phone so the link completes.',
      },
      {
        title: 'Bot talks back',
        detail:
          'Get a real reply from the Telegram bot for that agent. Mark this when phone ↔ agent chat works end to end.',
      },
    ],
    tip: 'One bot token per agent. First phone message finishes linking.',
    needsCode: true,
    showPlaygroundCta: true,
  },
  {
    id: 'search',
    index: 8,
    title: 'Web search MCP',
    shortTitle: 'Search',
    blurb: 'Paste an MCP URL to get live web search — no custom code.',
    xp: 200,
    theory: [
      'MCP servers can be remote Streamable HTTP endpoints.',
      'You register them by name + URL in Skills — the gateway loads their tools.',
      'Bind a server to an agent so only that agent can call those tools.',
    ],
    do: [
      'Compose already runs SearXNG + mcp-searxng (HTTP on :3000).',
      'In Playground → Skills → Add server → Streamable HTTP.',
      'Name it searxng, paste http://localhost:3000/mcp, save.',
      'Create agent web-search, bind searxng, ask a search question.',
    ],
    tasks: [
      {
        title: 'MCP endpoint reachable',
        detail:
          'Confirm the search MCP is up: open http://localhost:3000/health (or ask the facilitator). You’re registering this URL next — not writing code.',
      },
      {
        title: 'Register by URL',
        detail:
          'Skills → Add server → Streamable HTTP. Name: searxng. URL: http://localhost:3000/mcp. Save and confirm tools appear for that server.',
      },
      {
        title: 'Web-search agent',
        detail:
          'Create agent web-search (short SOUL: use web search tools, cite URLs). Bind the searxng MCP to that agent only.',
      },
      {
        title: 'Live search reply',
        detail:
          'Ask web-search something current (e.g. a news headline). Flag this when the answer clearly used search tools / cited links — not a pure guess.',
      },
    ],
    tip: 'Paste URL only — do not install packages inside the gateway image.',
    needsCode: true,
    showPlaygroundCta: true,
  },
]

export const STAGE_BY_ID = Object.fromEntries(
  WORKSHOP_STAGES.map(s => [s.id, s]),
) as Record<LevelId, WorkshopStage>

export const STEP_COUNTS = Object.fromEntries(
  WORKSHOP_STAGES.map(s => [s.id, s.tasks.length]),
) as Record<LevelId, number>

export const SECTION_TONES: Record<
  StageSectionTone,
  { bg: string; border: string; label: string }
> = {
  theory: { bg: '#eef2ff', border: '#c7d2fe', label: 'Theory' },
  do: { bg: '#fff7ed', border: '#fed7aa', label: 'What we’ll do' },
  check: { bg: '#ecfdf5', border: '#a7f3d0', label: 'Flags' },
  play: { bg: '#f5f3ff', border: '#ddd6fe', label: 'Playground' },
  tip: { bg: '#f0f9ff', border: '#bae6fd', label: 'Tip' },
}
