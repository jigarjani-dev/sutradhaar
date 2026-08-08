import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import { 
  Plus, X, Cpu, TerminalWindow, 
  Robot, User, PencilSimple, CheckCircle, Lightbulb, Flask
} from '@phosphor-icons/react'
import AgentEditor from './AgentEditor'
import ProvidersPanel from './Providers'
import PipelineCanvas from './PipelineCanvas'
import SkillsPanel from './SkillsPanel'

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

function AgentCard({ agent, isSelected, onClick, onEdit }: { agent: any; isSelected: boolean; onClick: () => void; onEdit: () => void }) {
  const color = colors.agents[agent.name.charCodeAt(0) % colors.agents.length]
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
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm" style={{ color: colors.text }}>{agent.name}</span>
            <StatusDot status={agent.status} />
          </div>
          <div className="text-xs font-medium mb-1" style={{ color }}>{agent.description || 'Agent'}</div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
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
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${message.color}15` }}>
        {isUser ? <User size={16} weight="fill" style={{ color: message.color }} /> : <Robot size={16} weight="fill" style={{ color: message.color }} />}
      </div>
      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-xs font-semibold" style={{ color: message.color }}>{message.agent}</span>
          <span className="text-xs" style={{ color: colors.textMuted }}>{message.time}</span>
        </div>
        <div className={`text-sm leading-relaxed p-3 rounded-2xl ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'} prose prose-sm max-w-none prose-headings:mb-2 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-code:bg-gray-100 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-[12px]`} style={{ backgroundColor: `${message.color}08`, color: colors.text }}>
          <ReactMarkdown>{message.text || ''}</ReactMarkdown>
        </div>
      </div>
    </motion.div>
  )
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
  const selectedRef = useRef<string | null>(null)
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

    // WebSocket
    const ws = new WebSocket(WS_URL)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
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
            status: msg.data.status,
            name: msg.data.agent,
            error: msg.data.status === 'error' ? (msg.data.error || 'unknown error') : undefined,
            lastActivity: msg.data.status === 'thinking' ? 'thinking...' : msg.data.status === 'error' ? 'error' : 'waiting',
          },
        }))
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
        setAgentStates(prev => ({
          ...prev,
          [msg.data.from]: {
            ...(prev[msg.data.from] || { tools: [] }),
            status: 'idle',
            name: msg.data.from,
            lastActivity: `handed off to ${msg.data.to}`,
          },
        }))
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
        const color = colors.agents[selectedAgent.charCodeAt(0) % colors.agents.length] || colors.primary
        const mapped = (data.messages || []).map((m: any, i: number) => ({
          id: `${selectedAgent}-hist-${i}`,
          agent: m.role === 'user' ? 'You' : selectedAgent,
          text: m.content,
          time: '',
          color: m.role === 'user' ? colors.primary : color,
          role: m.role,
        }))
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
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b" style={{ backgroundColor: colors.surface, borderColor: colors.border, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.primaryLight }}>
            <Flask size={20} weight="duotone" style={{ color: colors.primary }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: colors.text }}>Agent Gateway</h1>
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
              />
            ))}
          </div>
        </aside>

        {/* Center: Pipeline + Chat */}
        <main className="flex flex-col gap-4 overflow-hidden min-h-0">
          <div className="rounded-2xl border-2 p-6 flex-1 overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Pipeline Topology</h2>
              <span className="text-xs" style={{ color: colors.textMuted }}>click a card to chat</span>
            </div>
            <PipelineCanvas
              agents={agents}
              states={agentStates}
              selected={selectedAgent}
              onSelect={setSelectedAgent}
            />
          </div>
          <div className="rounded-2xl border-2 flex flex-col overflow-hidden flex-1 min-h-0" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: colors.border }}>
              <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Agent Chat</h2>
              <div className="flex items-center gap-2">
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
        <aside className="rounded-2xl border-2 p-4 overflow-y-auto" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Debug Log</h2>
            <TerminalWindow size={16} weight="duotone" style={{ color: colors.textMuted }} />
          </div>
          <div className="space-y-1">
            <div className="text-xs" style={{ color: colors.textMuted }}>No events yet</div>
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
    </div>
  )
}
