import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import { 
  Plus, X, Cpu, TerminalWindow, 
  Robot, User, PencilSimple, CheckCircle, Lightbulb, Flask,
  GraduationCap, PaperPlaneTilt,
} from '@phosphor-icons/react'
import AgentEditor from './AgentEditor'
import ProvidersPanel from './Providers'
import PipelineCanvas from './PipelineCanvas'
import SkillsPanel from './SkillsPanel'
import WorkshopPanel from './WorkshopPanel'
import TelegramMessengerModal, { type TelegramPublicStatus } from './TelegramMessengerModal'

// ── Color System ───────────────────────────────────────────────
const colors = {
  bg: '#f8f9fa',
  surface: '#ffffff',
  border: '#e5e7eb',
  text: '#1f2937',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  primary: '#6366f1',
  primaryLight: '#eef2ff',
  rose: '#f43f5e',
  emerald: '#10b981',
  amber: '#f59e0b',
  sky: '#0ea5e9',
  agents: ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
}

const API = '/api'
const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`
const MAX_DEBUG = 120

type DebugRow = {
  id: string
  time: string
  agent: string
  kind: string
  text: string
}

function debugTime(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function debugRowFromApi(row: { id?: number; agent_name?: string; event_type?: string; payload_json?: string; timestamp?: string }): DebugRow {
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(row.payload_json || '{}')
  } catch {
    payload = {}
  }
  return {
    id: `db-${row.id ?? Math.random()}`,
    time: debugTime(row.timestamp),
    agent: row.agent_name || 'system',
    kind: row.event_type || 'event',
    text: formatDebugText(row.event_type || 'event', payload),
  }
}

function formatDebugText(kind: string, data: Record<string, unknown>): string {
  if (kind === 'handoff') {
    return `${data.from} → ${data.to} (${data.phase})`
  }
  if (kind === 'tool_call') {
    const st = data.status === 'running' ? 'start' : 'done'
    return `${data.tool} [${st}]`
  }
  if (kind === 'agent_status') {
    if (data.error) return `status ${data.status}: ${data.error}`
    return `status → ${data.status}`
  }
  if (kind === 'orchestrator_route') {
    return `route → ${data.target} (${data.confidence || 'rule'})`
  }
  if (kind === 'chat_start') {
    return `chat [${data.source}]: ${data.preview}`
  }
  if (kind === 'handoff_received') {
    return `handoff reply from ${data.from}`
  }
  if (kind === 'handoff_error') {
    return String(data.error || 'handoff error')
  }
  if (Object.keys(data).length === 0) return kind
  try {
    const s = JSON.stringify(data)
    return s.length > 160 ? `${s.slice(0, 157)}…` : s
  } catch {
    return kind
  }
}

function debugRowFromWs(type: string, data: Record<string, unknown>): DebugRow | null {
  const agent = String(data.agent || data.from || 'system')
  if (type === 'debug_log') {
    const kind = String(data.event_type || 'debug')
    return {
      id: `ws-${Date.now()}-${Math.random()}`,
      time: debugTime(),
      agent: String(data.agent || 'system'),
      kind,
      text: formatDebugText(kind, (data.payload as Record<string, unknown>) || {}),
    }
  }
  if (type === 'handoff') {
    return {
      id: `ws-${Date.now()}-${Math.random()}`,
      time: debugTime(),
      agent: String(data.from || 'system'),
      kind: 'handoff',
      text: formatDebugText('handoff', data),
    }
  }
  if (type === 'tool_call') {
    return {
      id: `ws-${Date.now()}-${Math.random()}`,
      time: debugTime(),
      agent,
      kind: 'tool_call',
      text: formatDebugText('tool_call', data),
    }
  }
  if (type === 'agent_status') {
    return {
      id: `ws-${Date.now()}-${Math.random()}`,
      time: debugTime(),
      agent,
      kind: 'agent_status',
      text: formatDebugText('agent_status', data),
    }
  }
  if (type === 'telegram_status') {
    return {
      id: `ws-${Date.now()}-${Math.random()}`,
      time: debugTime(),
      agent,
      kind: 'telegram',
      text: data.connected ? 'Telegram connected' : `Telegram ${data.status || 'update'}`,
    }
  }
  return null
}

function debugKindColor(kind: string): string {
  if (kind === 'handoff' || kind === 'handoff_received') return colors.amber
  if (kind === 'tool_call') return colors.sky
  if (kind === 'error' || kind === 'handoff_error') return colors.rose
  if (kind === 'orchestrator_route') return colors.primary
  if (kind === 'telegram') return colors.sky
  return colors.textSecondary
}

// ─── Components ─────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color = status === 'idle' ? colors.emerald : status === 'thinking' ? colors.amber : colors.rose
  return (
    <div className="relative flex items-center justify-center">
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}20` }}
      />
      {status === 'thinking' && (
        <motion.div
          className="absolute w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color }}
          animate={{ scale: [1, 2], opacity: [1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
    </div>
  )
}

function AgentCard({
  agent,
  isSelected,
  onClick,
  onEdit,
  onTelegram,
  telegram,
}: {
  agent: any
  isSelected: boolean
  onClick: () => void
  onEdit: () => void
  onTelegram: () => void
  telegram?: TelegramPublicStatus
}) {
  const color = colors.agents[agent.name.charCodeAt(0) % colors.agents.length]
  const tgOn = telegram?.connected
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer group"
      style={{
        backgroundColor: isSelected ? `${color}10` : colors.surface,
        borderColor: isSelected ? color : colors.border,
        boxShadow: isSelected ? `0 4px 12px ${color}20` : '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
          <Cpu size={20} weight="duotone" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: colors.text }}>{agent.name}</span>
            <StatusDot status={agent.status} />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onTelegram() }}
              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wide shrink-0"
              style={{
                color: tgOn ? colors.sky : colors.textMuted,
                borderColor: tgOn ? `${colors.sky}55` : colors.border,
                backgroundColor: tgOn ? `${colors.sky}12` : colors.bg,
              }}
              title={tgOn ? 'Telegram connected' : 'Connect Telegram bot'}
            >
              <PaperPlaneTilt size={14} weight={tgOn ? 'fill' : 'duotone'} />
              TG
            </button>
          </div>
          <div className="text-xs font-medium mb-1" style={{ color }}>{agent.description || 'Agent'}</div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 shrink-0"
          style={{ color: colors.textMuted }}
          title="Edit agent"
        >
          <PencilSimple size={12} />
        </button>
      </div>
    </motion.button>
  )
}

function ThinkingBar({ text, live }: { text: string; live?: boolean }) {
  const [open, setOpen] = useState(false)
  const c = '#9ca3af'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border w-full text-left transition-colors hover:bg-gray-50"
        style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}
      >
        <motion.span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: c }}
          animate={live ? { y: [0, -3, 0], opacity: [0.4, 1, 0.4] } : { y: 0, opacity: 0.6 }}
          transition={live ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
        />
        <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: c }}>Thinking</span>
        <span className="text-xs" style={{ color: '#b0b6bf' }}>{text.length} chars</span>
        <motion.span
          className="ml-auto text-sm"
          style={{ color: '#b0b6bf' }}
          animate={open ? { rotate: 180 } : { rotate: 0 }}
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 p-4 rounded-xl border text-sm leading-relaxed whitespace-pre-wrap italic" style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa', color: '#6b7280', fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ToolCallBar({ tc }: { tc: any }) {
  const [open, setOpen] = useState(false)
  const isRunning = tc.status === 'running'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border w-full text-left transition-colors hover:bg-gray-50"
        style={{ borderColor: colors.border, backgroundColor: colors.bg }}
      >
        {isRunning ? (
          <motion.span className="w-3 h-3 rounded-full border-2 shrink-0" style={{ borderColor: `${colors.primary}40`, borderTopColor: colors.primary }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
        ) : (
          <CheckCircle size={14} weight="bold" style={{ color: colors.emerald }} />
        )}
        <span className="text-xs font-mono" style={{ color: colors.text }}>{tc.tool}</span>
        <span className="text-[10px]" style={{ color: colors.textMuted }}>{isRunning ? 'running...' : 'done'}</span>
        <span className="ml-auto text-xs" style={{ color: colors.textMuted }}>▾</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <pre className="mt-1 p-3 rounded-xl border text-[11px] leading-relaxed whitespace-pre-wrap break-all max-h-48 overflow-y-auto" style={{ borderColor: colors.border, backgroundColor: colors.bg, color: colors.textSecondary }}>
              {JSON.stringify(tc.args, null, 2)}
              {tc.result ? `\n\n${tc.result}` : ''}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ChatBubble({ message }: { message: any }) {
  if (message.role === 'thinking') {
    return <ThinkingBar text={message.text} live={message.id.startsWith('think-')} />
  }
  if (message.role === 'tool') {
    return <ToolCallBar tc={message.tc || message} />
  }
  const isUser = message.role === 'user'
  const isHandoffIn = message.role === 'handoff_in'
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${message.color}15` }}>
        {isUser ? <User size={16} weight="fill" style={{ color: message.color }} /> : <Robot size={16} weight="fill" style={{ color: message.color }} />}
      </div>
      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-xs font-semibold" style={{ color: message.color }}>
            {isHandoffIn ? `${message.agent} → handoff` : message.agent}
          </span>
          <span className="text-xs" style={{ color: colors.textMuted }}>{message.time}</span>
        </div>
        <div className={`text-sm leading-relaxed p-3 rounded-2xl ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'} prose prose-sm max-w-none prose-headings:mb-2 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-code:bg-gray-100 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-[12px]`} style={{ backgroundColor: `${message.color}08`, color: colors.text, ...(isHandoffIn ? { borderLeft: `3px solid ${message.color}` } : {}) }}>
          <ReactMarkdown>{message.text || ''}</ReactMarkdown>
        </div>
      </div>
    </motion.div>
  )
}

function agentColorFor(name: string) {
  return colors.agents[name.charCodeAt(0) % colors.agents.length] || colors.primary
}

function mapApiMessage(m: any, threadAgent: string, idx: number) {
  const id = `${threadAgent}-hist-${m.id ?? idx}`
  if (m.role === 'handoff_in') {
    const sender = m.sender || 'agent'
    return {
      id,
      agent: sender,
      text: m.content,
      time: '',
      color: agentColorFor(sender),
      role: 'handoff_in',
    }
  }
  if (m.role === 'user') {
    const fromTelegram = m.sender === 'telegram'
    return {
      id,
      agent: fromTelegram ? 'Telegram' : 'You',
      text: m.content,
      time: '',
      color: fromTelegram ? colors.sky : colors.primary,
      role: 'user',
      fromTelegram,
    }
  }
  return {
    id,
    agent: threadAgent,
    text: m.content,
    time: '',
    color: agentColorFor(threadAgent),
    role: m.role,
  }
}

// ─── Main Component ─────────────────────────────────────────────

export default function SoftLabDashboard() {
  const [agents, setAgents] = useState<any[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(() => localStorage.getItem('selectedAgent'))
  const [showModal, setShowModal] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  const [agentStates, setAgentStates] = useState<Record<string, any>>({})
  const [activeHandoff, setActiveHandoff] = useState<{ from: string; to: string; phase?: string } | null>(null)
  const [handoffLabel, setHandoffLabel] = useState('')
  const [telegramModalAgent, setTelegramModalAgent] = useState<string | null>(null)
  const [debugLog, setDebugLog] = useState<DebugRow[]>([])
  const selectedRef = useRef<string | null>(null)
  const debugScrollRef = useRef<HTMLDivElement>(null)

  const pushDebug = (row: DebugRow | null) => {
    if (!row) return
    setDebugLog(prev => [row, ...prev].slice(0, MAX_DEBUG))
  }
  const chatScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    selectedRef.current = selectedAgent
    if (selectedAgent) {
      localStorage.setItem('selectedAgent', selectedAgent)
    } else {
      localStorage.removeItem('selectedAgent')
    }
  }, [selectedAgent])

  useEffect(() => {
    // Fetch agents
    fetch(`${API}/agents`)
      .then(r => r.json())
      .then(data => {
        setAgents(data)
        const states: Record<string, any> = {}
        for (const a of data) {
          if (a.status === 'error' || a.error) {
            states[a.name] = {
              name: a.name,
              status: a.status || 'error',
              error: a.error || 'unknown error',
              tools: [],
              lastActivity: 'error',
            }
          }
        }
        if (Object.keys(states).length) setAgentStates(states)
      })
      .catch(() => {})

    fetch(`${API}/debug/logs?limit=80`)
      .then(r => r.json())
      .then(rows => {
        if (!Array.isArray(rows)) return
        setDebugLog(rows.map(debugRowFromApi).slice(0, MAX_DEBUG))
      })
      .catch(() => {})

    // WebSocket
    const ws = new WebSocket(WS_URL)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      const wsRow = debugRowFromWs(msg.type, msg.data || {})
      if (wsRow) pushDebug(wsRow)
      if (msg.type === 'agent_created') {
        setAgents(prev => [...prev, { name: msg.data.name, status: 'idle', description: 'New agent' }])
      } else if (msg.type === 'agent_deleted') {
        setAgents(prev => prev.filter(a => a.name !== msg.data.name))
        setAgentStates(prev => {
          const next = { ...prev }
          delete next[msg.data.name]
          return next
        })
      } else if (msg.type === 'agent_status') {
        setAgentStates(prev => ({
          ...prev,
          [msg.data.agent]: {
            ...(prev[msg.data.agent] || { tools: [] }),
            tools: (prev[msg.data.agent]?.tools) || [],
            status: msg.data.status,
            name: msg.data.agent,
            error: msg.data.status === 'error' ? (msg.data.error || 'unknown error') : undefined,
            lastActivity: msg.data.status === 'thinking'
              ? 'thinking...'
              : msg.data.status === 'working'
                ? 'handoff...'
                : msg.data.status === 'error'
                  ? 'error'
                  : 'waiting',
          },
        }))
      } else if (msg.type === 'telegram_status') {
        const { agent: agentName, ...tg } = msg.data
        setAgents(prev => prev.map(a => (
          a.name === agentName ? { ...a, telegram: tg } : a
        )))
      } else if (msg.type === 'message') {
        const { agent: threadAgent, role, content, sender, source } = msg.data
        if (selectedRef.current !== threadAgent) return
        const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
        if (role === 'user') {
          const fromTelegram = source === 'telegram' || sender === 'telegram'
          setChatMessages(prev => [...prev, {
            id: `u-${Date.now()}`,
            agent: fromTelegram ? 'Telegram' : 'You',
            text: content,
            time: ts,
            color: fromTelegram ? colors.sky : colors.primary,
            role: 'user',
            fromTelegram,
          }])
        } else if (role === 'handoff_in') {
          const fromName = sender || 'agent'
          setChatMessages(prev => [...prev, {
            id: `ho-in-${Date.now()}`,
            agent: fromName,
            text: content,
            time: ts,
            color: agentColorFor(fromName),
            role: 'handoff_in',
          }])
        } else if (role === 'assistant') {
          setChatMessages(prev => [...prev, {
            id: `ho-out-${Date.now()}`,
            agent: threadAgent,
            text: content,
            time: ts,
            color: agentColorFor(threadAgent),
            role: 'assistant',
          }])
        }
      } else if (msg.type === 'tool_call') {
        const ts = Date.now()
        setAgentStates(prev => {
          const cur = prev[msg.data.agent] || { status: 'idle', tools: [] }
          const tc = {
            tool: msg.data.tool,
            status: msg.data.status,
            args: msg.data.args,
            result: msg.data.result,
            ts,
          }
          return {
            ...prev,
            [msg.data.agent]: {
              ...cur,
              name: msg.data.agent,
              tools: [...(cur.tools || []), tc],
              lastActivity: msg.data.status === 'running'
                ? `calling ${msg.data.tool}...`
                : `called ${msg.data.tool} · just now`,
            },
          }
        })
        if (selectedRef.current === msg.data.agent) {
          const agentColor = colors.agents[msg.data.agent.charCodeAt(0) % colors.agents.length] || colors.primary
          setChatMessages(prev => [...prev, {
            id: `tool-${ts}`,
            role: 'tool',
            agent: msg.data.agent,
            tc: {
              tool: msg.data.tool,
              status: msg.data.status,
              args: msg.data.args,
              result: msg.data.result,
              ts,
            },
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            color: agentColor,
          }])
        }
      } else if (msg.type === 'thinking') {
        if (selectedRef.current === msg.data.agent) {
          const agentColor = colors.agents[msg.data.agent.charCodeAt(0) % colors.agents.length] || colors.primary
          setChatMessages(prev => {
            const last = prev[prev.length - 1]
            // merge streaming thinking into the last thinking entry
            if (last && last.role === 'thinking' && last.id.startsWith('think-')) {
              return [
                ...prev.slice(0, -1),
                { ...last, text: last.text + msg.data.content },
              ]
            }
            return [...prev, {
              id: `think-${Date.now()}`,
              role: 'thinking',
              agent: msg.data.agent,
              text: msg.data.content,
              color: agentColor,
            }]
          })
        }
      } else if (msg.type === 'handoff') {
        const { from, to, phase } = msg.data
        if (phase === 'complete') {
          setActiveHandoff(null)
          setHandoffLabel('')
        } else {
          setActiveHandoff({ from, to, phase })
          if (phase === 'start') setHandoffLabel(`${from} → ${to}: delegating…`)
          else if (phase === 'worker_done') setHandoffLabel(`${from}: integrating ${to}'s reply…`)
          else setHandoffLabel(`${from} → ${to}…`)
        }
        setAgentStates(prev => {
          const curFrom = prev[from] || { tools: [] }
          const curTo = prev[to] || { tools: [] }
          return {
            ...prev,
            [from]: {
              ...curFrom,
              tools: curFrom.tools || [],
              status: phase === 'complete' ? 'idle' : (phase === 'start' ? 'working' : curFrom.status || 'thinking'),
              name: from,
              lastActivity: phase === 'complete' ? `handoff to ${to} done` : `handoff → ${to}`,
            },
            [to]: {
              ...curTo,
              tools: curTo.tools || [],
              status: phase === 'start' || phase === 'worker_done' ? 'thinking' : 'idle',
              name: to,
              lastActivity: phase === 'start' ? `handoff from ${from}` : 'idle',
            },
          }
        })
      }
    }
    return () => ws.close()
  }, [])

  const handleCreateAgent = async (name: string, desc: string) => {
    try {
      await fetch(`${API}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc, tools: [], model: 'deepseek-chat' }),
      })
      setShowModal(false)
    } catch (err) {
      console.error('Failed to create agent:', err)
    }
  }

  const [editingAgent, setEditingAgent] = useState<any>(null)
  const [view, setView] = useState<'dashboard' | 'providers' | 'skills'>('dashboard')
  const [appMode, setAppMode] = useState<'workshop' | 'playground'>(() => {
    const saved = localStorage.getItem('sutradhaar-app-mode')
    return saved === 'playground' ? 'playground' : 'workshop'
  })

  useEffect(() => {
    localStorage.setItem('sutradhaar-app-mode', appMode)
  }, [appMode])

  const handleAgentClick = async (agentName: string) => {
    try {
      const res = await fetch(`${API}/agents/${agentName}`)
      const data = await res.json()
      setEditingAgent(data)
    } catch (err) {
      console.error('Failed to load agent:', err)
    }
  }

  // Load persisted chat history when the selected agent changes
  useEffect(() => {
    setChatMessages([])
    if (!selectedAgent) return
    fetch(`${API}/agents/${selectedAgent}/messages`)
      .then(r => r.json())
      .then(data => {
        const mapped = (data.messages || []).map((m: any, i: number) => mapApiMessage(m, selectedAgent, i))
        setChatMessages(mapped)
      })
      .catch(() => {})
  }, [selectedAgent])

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, sending])

  const handleSend = async () => {
    const text = chatInput.trim()
    if (!text || !selectedAgent || sending) return
    setChatInput('')
    setSending(true)
    const color = colors.agents[selectedAgent.charCodeAt(0) % colors.agents.length] || colors.primary
    setChatMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      agent: 'You',
      text,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      color: colors.primary,
      role: 'user',
    }])
    try {
      const res = await fetch(`${API}/agents/${selectedAgent}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      setActiveHandoff(null)
      setHandoffLabel('')
      setChatMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        agent: selectedAgent,
        text: data.response,
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        color,
        role: 'assistant',
      }])
    } catch (err) {
      console.error('Chat failed:', err)
    }
    setSending(false)
  }

  const handleClearChat = async () => {
    if (!selectedAgent) return
    if (!window.confirm(`Clear chat history for ${selectedAgent}?`)) return
    try {
      await fetch(`${API}/agents/${selectedAgent}/messages`, { method: 'DELETE' })
      setChatMessages([])
    } catch (err) {
      console.error('Failed to clear chat:', err)
    }
  }

  const refreshAgents = async () => {
    try {
      const res = await fetch(`${API}/agents`)
      const data = await res.json()
      setAgents(data)
      return data
    } catch (err) {
      console.error('Failed to refresh agents:', err)
      return null
    }
  }

  const toggleAgentSkill = async (agentName: string, skillName: string) => {
    const agent = agents.find(a => a.name === agentName)
    if (!agent) return
    const current = agent.skills || []
    const skills = current.includes(skillName)
      ? current.filter((s: string) => s !== skillName)
      : [...current, skillName]
    try {
      await fetch(`${API}/agents/${agentName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills }),
      })
      await refreshAgents()
    } catch (err) {
      console.error('Failed to toggle skill:', err)
    }
  }

  const toggleAgentMcp = async (agentName: string, serverName: string) => {
    const agent = agents.find(a => a.name === agentName)
    if (!agent) return
    const current = (agent.mcp_servers || []).map((m: any) => typeof m === 'string' ? m : m.name)
    const mcp_servers = current.includes(serverName)
      ? current.filter((s: string) => s !== serverName)
      : [...current, serverName]
    try {
      await fetch(`${API}/agents/${agentName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcp_servers }),
      })
      await refreshAgents()
    } catch (err) {
      console.error('Failed to toggle MCP server:', err)
    }
  }

  const handleEditorSave = async () => {
    // Refresh agents list
    try {
      const res = await fetch(`${API}/agents`)
      const data = await res.json()
      setAgents(data)
    } catch (err) {
      console.error('Failed to refresh agents:', err)
    }
  }

  const handleEditorDelete = async () => {
    // Refresh agents list
    try {
      const res = await fetch(`${API}/agents`)
      const data = await res.json()
      setAgents(data)
    } catch (err) {
      console.error('Failed to refresh agents:', err)
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: appMode === 'playground' ? colors.bg : '#faf8f5' }}>
      {/* App mode: Workshop vs Playground */}
      <div
        className="shrink-0 px-6 py-2.5 flex items-center justify-center gap-3 border-b"
        style={{
          backgroundColor: appMode === 'workshop' ? '#0f1419' : '#eef2ff',
          borderColor: appMode === 'workshop' ? '#292524' : colors.border,
        }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] hidden sm:inline" style={{ color: appMode === 'workshop' ? '#78716c' : colors.textMuted }}>
          Mode
        </span>
        <nav
          className="flex p-1 rounded-full gap-0.5 relative"
          style={{
            backgroundColor: appMode === 'workshop' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
            border: appMode === 'workshop' ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${colors.border}`,
            boxShadow: appMode === 'playground' ? '0 2px 12px rgba(99,102,241,0.12)' : '0 0 20px rgba(217,119,6,0.15)',
          }}
        >
          <button
            type="button"
            onClick={() => setAppMode('workshop')}
            className="relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-colors duration-200 z-10"
            style={
              appMode === 'workshop'
                ? { color: '#fff' }
                : { color: '#78716c' }
            }
          >
            {appMode === 'workshop' && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-full -z-10"
                style={{
                  background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                  boxShadow: '0 4px 16px rgba(217,119,6,0.45)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <GraduationCap size={16} weight={appMode === 'workshop' ? 'fill' : 'duotone'} />
            Workshop
          </button>
          <button
            type="button"
            onClick={() => setAppMode('playground')}
            className="relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-colors duration-200 z-10"
            style={
              appMode === 'playground'
                ? { color: '#fff' }
                : { color: '#a8a29e' }
            }
          >
            {appMode === 'playground' && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-full -z-10"
                style={{
                  backgroundColor: colors.primary,
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <Flask size={16} weight={appMode === 'playground' ? 'fill' : 'duotone'} />
            Playground
          </button>
        </nav>
      </div>

      {appMode === 'workshop' ? (
        <WorkshopPanel onOpenPlayground={() => setAppMode('playground')} />
      ) : (
        <>
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b" style={{ backgroundColor: colors.surface, borderColor: colors.border, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.primaryLight }}>
            <Flask size={20} weight="duotone" style={{ color: colors.primary }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: colors.text }}>Sutradhaar</h1>
          <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: colors.primaryLight, color: colors.primary }}>THOUGHT LAB</span>
        </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: connected ? colors.emerald : colors.textMuted }} />
              <span className="text-xs" style={{ color: colors.textSecondary }}>{agents.length} agents</span>
            </div>
            <nav className="flex items-center gap-1 p-1 rounded-full" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
              <button
                onClick={() => setView('dashboard')}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                style={view === 'dashboard' ? { backgroundColor: colors.primary, color: '#fff', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)' } : { color: colors.textSecondary }}
              >
                Dashboard
              </button>
              <button
                onClick={() => setView('providers')}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5"
                style={view === 'providers' ? { backgroundColor: colors.primary, color: '#fff', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)' } : { color: colors.textSecondary }}
              >
                <Cpu size={14} />
                Providers
              </button>
              <button
                onClick={() => setView('skills')}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5"
                style={view === 'skills' ? { backgroundColor: colors.primary, color: '#fff', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)' } : { color: colors.textSecondary }}
              >
                <Lightbulb size={14} />
                Skills
              </button>
            </nav>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white" style={{ backgroundColor: colors.primary, boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)' }}>
              <Plus size={16} weight="bold" />
              New Agent
            </motion.button>
          </div>
      </header>

      {/* Main Content */}
      {view === 'providers' ? (
        <ProvidersPanel onClose={() => setView('dashboard')} embedded />
      ) : view === 'skills' ? (
        <SkillsPanel onClose={() => setView('dashboard')} embedded />
      ) : (
      <div className="flex-1 grid grid-cols-[280px_1fr_320px] gap-4 p-4 overflow-hidden min-h-0">
        {/* Agent List */}
        <aside className="rounded-2xl border-2 p-4 overflow-y-auto" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Agents</h2>
            <span className="text-xs" style={{ color: colors.textMuted }}>{agents.length} active</span>
          </div>
          <div className="space-y-3">
            {agents.map(agent => (
              <AgentCard
                key={agent.name}
                agent={agent}
                isSelected={selectedAgent === agent.name}
                onClick={() => setSelectedAgent(agent.name)}
                onEdit={() => handleAgentClick(agent.name)}
                onTelegram={() => setTelegramModalAgent(agent.name)}
                telegram={agent.telegram}
              />
            ))}
          </div>
        </aside>

        {/* Center: Pipeline + Chat */}
        <main className="flex flex-col gap-4 overflow-hidden min-h-0">
          <div className="rounded-2xl border-2 p-6 flex-1 min-h-[260px] overflow-hidden flex flex-col" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Pipeline Topology</h2>
              <span className="text-xs" style={{ color: colors.textMuted }}>click a card to chat</span>
            </div>
            <div className="flex-1 min-h-0">
            {agents.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm" style={{ color: colors.textMuted }}>Loading agents…</div>
            ) : (
            <PipelineCanvas
              agents={agents}
              states={agentStates}
              selected={selectedAgent}
              onSelect={setSelectedAgent}
              onToggleSkill={toggleAgentSkill}
              onToggleMcp={toggleAgentMcp}
              activeHandoff={activeHandoff}
            />
            )}
            </div>
          </div>
          <div className="rounded-2xl border-2 flex flex-col overflow-hidden flex-1 min-h-0" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: colors.border }}>
              <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Agent Chat</h2>
              <div className="flex items-center gap-2">
                {selectedAgent && (
                  <button
                    type="button"
                    onClick={() => setTelegramModalAgent(selectedAgent)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium"
                    style={{
                      borderColor: agents.find(a => a.name === selectedAgent)?.telegram?.connected ? colors.sky : colors.border,
                      color: agents.find(a => a.name === selectedAgent)?.telegram?.connected ? colors.sky : colors.textSecondary,
                      backgroundColor: agents.find(a => a.name === selectedAgent)?.telegram?.connected ? `${colors.sky}10` : colors.bg,
                    }}
                  >
                    <PaperPlaneTilt size={14} weight="duotone" />
                    Telegram
                  </button>
                )}
                {selectedAgent && chatMessages.length > 0 && (
                  <button onClick={handleClearChat} className="text-xs px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: colors.textMuted }}>
                    Clear
                  </button>
                )}
                <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: colors.primaryLight, color: colors.primary }}>
                  {selectedAgent || 'no agent selected'}
                </span>
              </div>
            </div>
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-5 py-4">
              {(handoffLabel || sending) && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs" style={{ borderColor: colors.border, backgroundColor: colors.primaryLight, color: colors.primary }}>
                  <motion.span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: colors.primary }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  {handoffLabel || 'Waiting for reply…'}
                </div>
              )}
              {chatMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm" style={{ color: colors.textMuted }}>
                  {selectedAgent ? 'No messages yet. Say something to start the conversation.' : 'Select an agent to chat'}
                </div>
              ) : (
                chatMessages.map(msg => <ChatBubble key={msg.id} message={msg} />)
              )}
              {sending && (
                <div className="flex items-center gap-2 px-2 py-1">
                  <motion.div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }} animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                  <motion.div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }} animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.15 }} />
                  <motion.div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }} animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }} />
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t" style={{ borderColor: colors.border }}>
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                  disabled={!selectedAgent || sending}
                  placeholder={selectedAgent ? `Message ${selectedAgent}...` : 'Select an agent to chat'}
                  className="flex-1 px-3 py-2 rounded-xl border-2 text-sm focus:outline-none transition-colors"
                  style={{ borderColor: colors.border, color: colors.text, backgroundColor: colors.bg }}
                />
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSend}
                  disabled={!selectedAgent || sending || !chatInput.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ backgroundColor: colors.primary, boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)' }}
                >
                  Send
                </motion.button>
              </div>
            </div>
          </div>
        </main>

        {/* Debug Log */}
        <aside className="rounded-2xl border-2 p-4 overflow-hidden flex flex-col min-h-0" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Debug Log</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDebugLog([])}
                className="text-[10px] px-2 py-0.5 rounded-md hover:bg-gray-100"
                style={{ color: colors.textMuted }}
              >
                Clear
              </button>
              <TerminalWindow size={16} weight="duotone" style={{ color: colors.textMuted }} />
            </div>
          </div>
          <div ref={debugScrollRef} className="flex-1 overflow-y-auto space-y-1.5 min-h-0 font-mono text-[10px] leading-snug">
            {debugLog.length === 0 ? (
              <div style={{ color: colors.textMuted }}>Events appear here: chat, handoffs, tools, orchestrator routes…</div>
            ) : (
              debugLog.map(row => (
                <div key={row.id} className="px-2 py-1.5 rounded-lg border" style={{ borderColor: colors.border, backgroundColor: colors.bg }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span style={{ color: colors.textMuted }}>{row.time}</span>
                    <span className="font-semibold truncate" style={{ color: debugKindColor(row.kind) }}>{row.kind}</span>
                    <span className="truncate ml-auto" style={{ color: colors.textMuted }}>{row.agent}</span>
                  </div>
                  <div className="break-words" style={{ color: colors.textSecondary }}>{row.text}</div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
      )}

      {/* New Agent Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-8 max-w-md w-full" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ color: colors.text }}>Create Agent</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} style={{ color: colors.textSecondary }} /></button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleCreateAgent(fd.get('name') as string, fd.get('desc') as string); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>Name</label>
                  <input name="name" type="text" required className="w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none transition-colors" style={{ borderColor: colors.border, color: colors.text }} placeholder="e.g. my-agent" onFocus={(e) => e.target.style.borderColor = colors.primary} onBlur={(e) => e.target.style.borderColor = colors.border} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>Description</label>
                  <textarea name="desc" rows={3} className="w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none transition-colors resize-none" style={{ borderColor: colors.border, color: colors.text }} placeholder="What does this agent do?" onFocus={(e) => e.target.style.borderColor = colors.primary} onBlur={(e) => e.target.style.borderColor = colors.border} />
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl text-sm font-medium" style={{ backgroundColor: colors.bg, color: colors.text }}>Cancel</button>
                  <motion.button type="submit" className="flex-1 py-3 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: colors.primary, boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)' }} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>Create Agent</motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {telegramModalAgent && (
          <TelegramMessengerModal
            agentName={telegramModalAgent}
            open={!!telegramModalAgent}
            onClose={() => setTelegramModalAgent(null)}
            onStatusChange={tg => {
              const name = telegramModalAgent
              setAgents(prev => prev.map(a => (a.name === name ? { ...a, telegram: tg } : a)))
            }}
          />
        )}
      </AnimatePresence>

      {/* Agent Editor */}
      {editingAgent && (
        <AgentEditor
          agent={editingAgent}
          allAgents={agents}
          onClose={() => setEditingAgent(null)}
          onSave={handleEditorSave}
          onDelete={handleEditorDelete}
        />
      )}
        </>
      )}
    </div>
  )
}
