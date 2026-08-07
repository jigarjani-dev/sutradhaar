import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, X, Sparkle, Crown, ChatCircle, TerminalWindow } from '@phosphor-icons/react'

const agents = [
  { id: '1', name: 'lakshmi', status: 'idle', role: 'Orchestrator', desc: 'Routes tasks and manages pipeline flow.' },
  { id: '2', name: 'ba-agent', status: 'thinking', role: 'Business Analyst', desc: 'Analyzes requirements and generates specs.' },
  { id: '3', name: 'qa-agent', status: 'idle', role: 'Quality Assurance', desc: 'Validates outputs against acceptance criteria.' },
]

const chatMessages = [
  { id: '1', agent: 'lakshmi', text: 'Received task: generate PRD for user auth module.', time: '14:02' },
  { id: '2', agent: 'ba-agent', text: 'Analyzing requirements — cross-referencing with existing system docs.', time: '14:03' },
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
  { x: 60, y: 55, label: 'Ingest' },
  { x: 180, y: 30, label: 'Orchestrate' },
  { x: 180, y: 80, label: 'Analyze' },
  { x: 300, y: 55, label: 'Validate' },
  { x: 420, y: 55, label: 'Publish' },
]

const pipelineEdges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]]

export default function Sample4DarkLuxe() {
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')

  return (
    <div className="min-h-screen text-[#f0ece4] bg-[#0a0a0a]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <Crown size={20} className="text-[#c9a84c]" weight="duotone" />
          <h1 className="text-base font-medium tracking-[0.15em] text-[#f0ece4]">AGENT GATEWAY</h1>
          <span className="text-[9px] uppercase tracking-[0.3em] text-[#c9a84c]/50 border border-[#c9a84c]/15 rounded-full px-3 py-1">
            dark luxe
          </span>
        </div>
        <div className="flex items-center gap-8 text-[10px] tracking-[0.12em] text-[#f0ece4]/35 uppercase">
          <span>3 agents</span>
          <span>pipeline idle</span>
        </div>
      </header>

      <div className="grid grid-cols-[260px_1fr_280px] gap-6 p-6 h-[calc(100vh-66px)]">
        {/* Agent List */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[9px] tracking-[0.3em] text-[#c9a84c]/50 uppercase font-medium">Agents</h2>
            <button
              onClick={() => setModalOpen(true)}
              className="p-1.5 rounded-lg border border-white/[0.06] text-white/30 hover:text-[#c9a84c] hover:border-[#c9a84c]/20 transition-all"
            >
              <Plus size={13} weight="bold" />
            </button>
          </div>
          {agents.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-[#c9a84c]/15 transition-all"
              style={{ borderTop: a.status === 'thinking' ? '2px solid rgba(201,168,76,0.5)' : '2px solid rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkle
                  size={12}
                  weight="fill"
                  className={a.status === 'thinking' ? 'text-[#c9a84c] animate-pulse' : 'text-white/10'}
                />
                <span className="text-[13px] font-medium text-[#f0ece4]">{a.name}</span>
              </div>
              <p className="text-[9px] tracking-[0.2em] text-[#c9a84c]/40 uppercase mb-2">{a.role}</p>
              <p className="text-[11px] text-white/25 leading-relaxed">{a.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Pipeline + Chat */}
        <div className="flex flex-col gap-6">
          {/* Pipeline SVG */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 h-[170px] flex-shrink-0">
            <h2 className="text-[9px] tracking-[0.3em] text-[#c9a84c]/50 uppercase font-medium mb-4">Pipeline</h2>
            <svg viewBox="0 0 480 100" className="w-full h-full">
              {pipelineEdges.map(([from, to], i) => {
                const a = pipelineNodes[from]
                const b = pipelineNodes[to]
                return (
                  <motion.line
                    key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="#c9a84c" strokeWidth={0.5}
                    opacity={0.25}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, delay: i * 0.12 }}
                  />
                )
              })}
              {pipelineNodes.map((n, i) => (
                <g key={i}>
                  <motion.circle
                    cx={n.x} cy={n.y} r={6}
                    fill="rgba(201,168,76,0.06)"
                    stroke="#c9a84c" strokeWidth={0.8}
                    opacity={0.5}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.4 + i * 0.1 }}
                  />
                  <motion.circle
                    cx={n.x} cy={n.y} r={2}
                    fill="#c9a84c"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.7 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                  />
                  <text x={n.x} y={n.y + 17} textAnchor="middle" fill="white" opacity={0.2} fontSize={7} fontWeight={300} fontFamily="system-ui, sans-serif">{n.label}</text>
                </g>
              ))}
            </svg>
          </div>

          {/* Chat */}
          <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 overflow-y-auto flex flex-col gap-4">
            <h2 className="text-[9px] tracking-[0.3em] text-[#c9a84c]/50 uppercase font-medium mb-1">Chat</h2>
            {chatMessages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg p-3"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium text-[#c9a84c]/50">{m.agent}</span>
                  <span className="text-[9px] text-white/15 ml-auto">{m.time}</span>
                </div>
                <p className="text-[12px] text-white/40 leading-relaxed tracking-[0.02em]">{m.text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Debug Log */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 overflow-y-auto flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-3">
            <TerminalWindow size={13} className="text-[#c9a84c]/30" weight="duotone" />
            <h2 className="text-[9px] tracking-[0.3em] text-[#c9a84c]/50 uppercase font-medium">Log</h2>
          </div>
          {logEntries.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-white/15 leading-relaxed tracking-[0.03em]"
            >
              {e.text}
            </motion.div>
          ))}
          <motion.div
            className="text-[10px] text-[#c9a84c]/30 mt-2"
            animate={{ opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            &#x2022;
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl p-8 w-96"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[13px] tracking-[0.15em] text-[#c9a84c] uppercase font-medium">New Agent</h2>
                <button onClick={() => setModalOpen(false)} className="text-white/20 hover:text-[#c9a84c] transition-colors">
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Agent name"
                  className="bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[13px] text-[#f0ece4] placeholder:text-white/15 focus:outline-none focus:border-[#c9a84c]/30 tracking-[0.03em]"
                />
                <input
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Agent role"
                  className="bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[13px] text-[#f0ece4] placeholder:text-white/15 focus:outline-none focus:border-[#c9a84c]/30 tracking-[0.03em]"
                />
                <button className="w-full mt-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[12px] tracking-[0.15em] text-[#f0ece4]/60 hover:border-[#c9a84c]/25 hover:text-[#c9a84c] transition-all uppercase font-medium">
                  Register Agent
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
