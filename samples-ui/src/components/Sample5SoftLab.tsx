import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, X, Smiley, Heart, ChatCircle, TerminalWindow } from '@phosphor-icons/react'

const agentColors: Record<string, { accent: string; bg: string }> = {
  lakshmi: { accent: '#ff6b8a', bg: '#fff0f3' },
  'ba-agent': { accent: '#4ade80', bg: '#ecfdf5' },
  'qa-agent': { accent: '#a78bfa', bg: '#f5f3ff' },
}

const agents = [
  { id: '1', name: 'lakshmi', status: 'idle', role: 'Orchestrator', desc: 'Routes tasks and manages pipeline flow.' },
  { id: '2', name: 'ba-agent', status: 'thinking', role: 'Business Analyst', desc: 'Analyzes requirements and generates specs.' },
  { id: '3', name: 'qa-agent', status: 'idle', role: 'Quality Assurance', desc: 'Validates outputs against acceptance criteria.' },
]

const chatMessages = [
  { id: '1', agent: 'lakshmi', text: 'Received task: generate PRD for user auth module.', time: '14:02' },
  { id: '2', agent: 'ba-agent', text: 'Analyzing requirements... cross-referencing with existing system docs.', time: '14:03' },
  { id: '3', agent: 'ba-agent', text: 'Spec draft ready. Routing to QA for validation.', time: '14:05' },
  { id: '4', agent: 'qa-agent', text: 'Running compliance checks on spec v2.1...', time: '14:06' },
]

const logEntries = [
  { id: '1', text: '14:02:01  Pipeline initialized — 3 agents registered.', agent: 'system' },
  { id: '2', text: '14:02:15  Task "auth-prd" queued → lakshmi', agent: 'system' },
  { id: '3', text: '14:03:40  ba-agent: context window at 72%', agent: 'ba-agent' },
  { id: '4', text: '14:05:10  Spec artifact published.', agent: 'ba-agent' },
  { id: '5', text: '14:06:05  qa-agent: validation pass started.', agent: 'qa-agent' },
]

const pipelineNodes = [
  { x: 50, y: 55, label: 'Ingest', color: '#60a5fa' },
  { x: 170, y: 28, label: 'Orch', color: '#ff6b8a' },
  { x: 170, y: 82, label: 'Analyze', color: '#4ade80' },
  { x: 290, y: 55, label: 'Validate', color: '#a78bfa' },
  { x: 410, y: 55, label: 'Publish', color: '#f59e0b' },
]

const pipelineEdges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]]

export default function Sample5SoftLab() {
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')

  return (
    <div className="min-h-screen text-[#2d2d2d] bg-[#fafaf8]" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <header className="flex items-center justify-between px-8 py-5 border-b border-[#2d2d2d]/6 bg-white/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Heart size={22} className="text-[#ff6b8a]" weight="fill" />
          <h1 className="text-lg font-bold text-[#2d2d2d]">Agent Gateway</h1>
          <span className="text-[10px] font-medium text-[#a78bfa] bg-[#f5f3ff] rounded-full px-3 py-1">
            soft lab
          </span>
        </div>
        <div className="flex items-center gap-6 text-[12px] text-[#2d2d2d]/40 font-medium">
          <span>3 agents</span>
          <span>pipeline idle</span>
        </div>
      </header>

      <div className="grid grid-cols-[260px_1fr_280px] gap-5 p-5 h-[calc(100vh-68px)]">
        {/* Agent List */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[11px] font-semibold text-[#2d2d2d]/40 uppercase tracking-wider">Agents</h2>
            <button
              onClick={() => setModalOpen(true)}
              className="p-2 rounded-full bg-white border border-[#2d2d2d]/8 text-[#2d2d2d]/40 hover:text-[#ff6b8a] hover:border-[#ff6b8a]/30 transition-all shadow-sm"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
          {agents.map((a) => {
            const c = agentColors[a.name]
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                style={{ borderLeft: `4px solid ${c.accent}` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Smiley
                    size={14}
                    weight="fill"
                    style={{ color: a.status === 'thinking' ? c.accent : '#2d2d2d20' }}
                    className={a.status === 'thinking' ? 'animate-pulse' : ''}
                  />
                  <span className="text-[13px] font-semibold text-[#2d2d2d]">{a.name}</span>
                </div>
                <p className="text-[10px] font-medium text-[#2d2d2d]/40 uppercase tracking-wider mb-2">{a.role}</p>
                <p className="text-[12px] text-[#2d2d2d]/50 leading-relaxed">{a.desc}</p>
              </motion.div>
            )
          })}
        </div>

        {/* Pipeline + Chat */}
        <div className="flex flex-col gap-5">
          {/* Pipeline SVG */}
          <div className="rounded-2xl bg-white p-6 shadow-sm h-[170px] flex-shrink-0">
            <h2 className="text-[11px] font-semibold text-[#2d2d2d]/40 uppercase tracking-wider mb-4">Pipeline</h2>
            <svg viewBox="0 0 460 105" className="w-full h-full">
              {/* Soft thick lines */}
              {pipelineEdges.map(([from, to], i) => {
                const a = pipelineNodes[from]
                const b = pipelineNodes[to]
                return (
                  <motion.line
                    key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={a.color} strokeWidth={3}
                    strokeLinecap="round"
                    opacity={0.25}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.7, delay: i * 0.1 }}
                  />
                )
              })}
              {pipelineNodes.map((n, i) => (
                <g key={i}>
                  <motion.circle
                    cx={n.x} cy={n.y} r={12}
                    fill="white"
                    stroke={n.color} strokeWidth={3}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 + i * 0.1 }}
                  />
                  <motion.circle
                    cx={n.x} cy={n.y} r={5}
                    fill={n.color}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.5, 1] }}
                    transition={{ duration: 2.5, delay: 0.6 + i * 0.1, repeat: Infinity, repeatDelay: 2 }}
                  />
                  <text x={n.x} y={n.y + 23} textAnchor="middle" fill="#2d2d2d" opacity={0.35} fontSize={8} fontWeight={600} fontFamily="system-ui, sans-serif">{n.label}</text>
                </g>
              ))}
            </svg>
          </div>

          {/* Chat */}
          <div className="flex-1 rounded-2xl bg-white p-6 shadow-sm overflow-y-auto flex flex-col gap-3">
            <h2 className="text-[11px] font-semibold text-[#2d2d2d]/40 uppercase tracking-wider mb-1">Chat</h2>
            {chatMessages.map((m) => {
              const c = agentColors[m.agent] || { accent: '#60a5fa', bg: '#eff6ff' }
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl px-4 py-3"
                  style={{ background: c.bg, borderBottomLeftRadius: '4px' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold" style={{ color: c.accent }}>{m.agent}</span>
                    <span className="text-[9px] text-[#2d2d2d]/25 ml-auto">{m.time}</span>
                  </div>
                  <p className="text-[12px] text-[#2d2d2d]/60 leading-relaxed">{m.text}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Debug Log */}
        <div className="rounded-2xl bg-white p-6 shadow-sm overflow-y-auto flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-3">
            <TerminalWindow size={14} className="text-[#a78bfa]/60" weight="duotone" />
            <h2 className="text-[11px] font-semibold text-[#2d2d2d]/40 uppercase tracking-wider">Log</h2>
          </div>
          {logEntries.map((e) => {
            const c = agentColors[e.agent] || { accent: '#d4d4d4' }
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl p-3 text-[11px] text-[#2d2d2d]/45 leading-relaxed"
                style={{ background: '#fafaf8', borderLeft: `3px solid ${c.accent}20` }}
              >
                {e.text}
              </motion.div>
            )
          })}
          <motion.div
            className="text-[11px] text-[#a78bfa]/30 mt-2"
            animate={{ opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ...
          </motion.div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d2d2d]/15 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl p-8 w-96 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold text-[#2d2d2d]">New Agent</h2>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-[#2d2d2d]/5 text-[#2d2d2d]/30 hover:text-[#2d2d2d]/60 transition-colors"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Agent name"
                  className="bg-[#fafaf8] border border-[#2d2d2d]/8 rounded-2xl px-5 py-3 text-[13px] text-[#2d2d2d] placeholder:text-[#2d2d2d]/25 focus:outline-none focus:border-[#a78bfa]/40 transition-colors"
                />
                <input
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Agent role"
                  className="bg-[#fafaf8] border border-[#2d2d2d]/8 rounded-2xl px-5 py-3 text-[13px] text-[#2d2d2d] placeholder:text-[#2d2d2d]/25 focus:outline-none focus:border-[#a78bfa]/40 transition-colors"
                />
                <button className="w-full mt-3 py-3.5 rounded-full bg-[#a78bfa] text-white text-[13px] font-semibold hover:bg-[#8b6fe0] transition-colors shadow-md">
                  Add Agent
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
