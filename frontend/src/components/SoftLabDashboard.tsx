import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  Heart, Plus, X, Cpu, TerminalWindow, 
  Robot, User
} from '@phosphor-icons/react'

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

function AgentCard({ agent, isSelected, onClick }: { agent: any; isSelected: boolean; onClick: () => void }) {
  const color = colors.agents[agent.name.charCodeAt(0) % colors.agents.length]
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border-2 transition-all duration-200"
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
      </div>
    </motion.button>
  )
}

function PipelineSVG({ agents }: { agents: any[] }) {
  const nodes = agents.map((a, i) => ({
    x: 100 + (i * 120),
    y: 80 + (i % 2 === 0 ? 0 : 40),
    label: a.name,
    color: colors.agents[i % colors.agents.length],
  }))

  return (
    <svg viewBox="0 0 620 160" className="w-full h-full">
      <defs>
        {nodes.slice(0, -1).map((_, i) => (
          <linearGradient key={`grad-${i}`} id={`edge-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={nodes[i].color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={nodes[i + 1].color} stopOpacity="0.3" />
          </linearGradient>
        ))}
      </defs>
      {nodes.slice(0, -1).map((_, i) => (
        <g key={`edge-${i}`}>
          <line x1={nodes[i].x} y1={nodes[i].y} x2={nodes[i + 1].x} y2={nodes[i + 1].y} stroke={`url(#edge-grad-${i})`} strokeWidth="3" strokeLinecap="round" />
          <motion.circle r="4" fill={nodes[i].color} initial={{ cx: nodes[i].x, cy: nodes[i].y }} animate={{ cx: nodes[i + 1].x, cy: nodes[i + 1].y }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} style={{ opacity: 0.6 }} />
        </g>
      ))}
      {nodes.map((node, i) => (
        <g key={`node-${i}`}>
          <circle cx={node.x} cy={node.y} r="20" fill={colors.surface} stroke={node.color} strokeWidth="3" />
          <circle cx={node.x} cy={node.y} r="8" fill={node.color} />
          <text x={node.x} y={node.y + 35} textAnchor="middle" className="text-xs font-medium" fill={colors.textSecondary} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{node.label}</text>
        </g>
      ))}
    </svg>
  )
}

function ChatBubble({ message }: { message: any }) {
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
        <div className={`text-sm leading-relaxed p-3 rounded-2xl ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'}`} style={{ backgroundColor: `${message.color}08`, color: colors.text }}>{message.text}</div>
      </div>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export default function SoftLabDashboard() {
  const [agents, setAgents] = useState<any[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Fetch agents
    fetch(`${API}/agents`)
      .then(r => r.json())
      .then(data => setAgents(data))
      .catch(() => {})

    // WebSocket
    const ws = new WebSocket(WS_URL)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'message') {
        const color = colors.agents[msg.data.agent?.charCodeAt(0) % colors.agents.length] || colors.primary
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          agent: msg.data.agent,
          text: msg.data.content,
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          color,
          role: msg.data.role,
        }])
      } else if (msg.type === 'agent_created') {
        setAgents(prev => [...prev, { name: msg.data.name, status: 'idle', description: 'New agent' }])
      } else if (msg.type === 'agent_deleted') {
        setAgents(prev => prev.filter(a => a.name !== msg.data.name))
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

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b" style={{ backgroundColor: colors.surface, borderColor: colors.border, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3">
          <Heart size={24} weight="fill" style={{ color: colors.rose }} />
          <h1 className="text-xl font-bold" style={{ color: colors.text }}>Agent Gateway</h1>
          <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: colors.primaryLight, color: colors.primary }}>SOFT LAB</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: connected ? colors.emerald : colors.textMuted }} />
            <span className="text-xs" style={{ color: colors.textSecondary }}>{agents.length} agents</span>
          </div>
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white" style={{ backgroundColor: colors.primary, boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)' }}>
            <Plus size={16} weight="bold" />
            New Agent
          </motion.button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-[280px_1fr_320px] gap-4 p-4 overflow-hidden">
        {/* Agent List */}
        <aside className="rounded-2xl border-2 p-4 overflow-y-auto" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Agents</h2>
            <span className="text-xs" style={{ color: colors.textMuted }}>{agents.length} active</span>
          </div>
          <div className="space-y-3">
            {agents.map(agent => (
              <AgentCard key={agent.name} agent={agent} isSelected={selectedAgent === agent.name} onClick={() => setSelectedAgent(agent.name)} />
            ))}
          </div>
        </aside>

        {/* Center: Pipeline + Chat */}
        <main className="flex flex-col gap-4 overflow-hidden">
          <div className="rounded-2xl border-2 p-6 flex-1" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: colors.text }}>Pipeline Topology</h2>
            {agents.length > 0 ? <PipelineSVG agents={agents} /> : <div className="flex items-center justify-center h-full text-sm" style={{ color: colors.textMuted }}>No agents deployed</div>}
          </div>
          <div className="rounded-2xl border-2 p-6 h-[300px] overflow-y-auto" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: colors.text }}>Agent Chat</h2>
            {chatMessages.length === 0 ? <div className="text-sm" style={{ color: colors.textMuted }}>No messages yet</div> : chatMessages.map(msg => <ChatBubble key={msg.id} message={msg} />)}
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
    </div>
  )
}
