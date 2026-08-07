import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, X, Circle, Cpu, GitBranch, TerminalWindow, Database } from '@phosphor-icons/react'

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
  { id: '1', level: 'info', text: '[14:02:01] Pipeline initialized. 3 agents registered.', agent: 'system' },
  { id: '2', level: 'info', text: '[14:02:15] Task "auth-prd" queued → lakshmi', agent: 'system' },
  { id: '3', level: 'warn', text: '[14:03:40] ba-agent: context window at 72% capacity', agent: 'ba-agent' },
  { id: '4', level: 'info', text: '[14:05:10] Spec artifact published to artifact store.', agent: 'ba-agent' },
  { id: '5', level: 'info', text: '[14:06:05] qa-agent: starting validation pass...', agent: 'qa-agent' },
]

const statusColors: Record<string, string> = {
  idle: 'text-[#e8a850]/60',
  thinking: 'text-[#e8a850]',
  error: 'text-red-400',
}

const levelStyles: Record<string, string> = {
  info: 'text-[#e8a850]/70',
  warn: 'text-yellow-400',
  error: 'text-red-400',
}

const pipelineNodes = [
  { x: 80, y: 60, label: 'Ingest' },
  { x: 200, y: 30, label: 'Orch' },
  { x: 200, y: 90, label: 'Analyze' },
  { x: 320, y: 60, label: 'Validate' },
  { x: 440, y: 60, label: 'Publish' },
]

const pipelineEdges = [
  [0, 1], [0, 2], [1, 3], [2, 3], [3, 4],
]

export default function Sample1Blueprint() {
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')

  return (
    <div className="min-h-screen text-[#e0e6f0] bg-[#0a1628]" style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(232,168,80,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(232,168,80,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[#e8a850]/20 bg-[#0d1f3c]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Cpu size={24} className="text-[#e8a850]" weight="duotone" />
          <h1 className="text-lg font-bold tracking-wider text-[#e8a850]">AGENT GATEWAY</h1>
          <span className="text-[10px] text-[#e8a850]/40 border border-[#e8a850]/20 rounded px-2 py-0.5">BLUEPRINT</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#e8a850]/60">
          <span>NODES: 3 active</span>
          <span>PIPELINE: idle</span>
        </div>
      </header>

      <div className="relative z-10 grid grid-cols-[260px_1fr_280px] gap-4 p-4 h-[calc(100vh-64px)]">
        {/* Agent List */}
        <div className="bg-[#0d1f3c]/80 backdrop-blur-sm border border-[#e8a850]/20 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-bold tracking-wider text-[#e8a850]/70 uppercase">Agents</h2>
            <button
              onClick={() => setModalOpen(true)}
              className="p-1 rounded border border-[#e8a850]/30 text-[#e8a850]/60 hover:bg-[#e8a850]/10 transition-colors"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
          {agents.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#09152a] border border-[#e8a850]/15 rounded-lg p-3 hover:border-[#e8a850]/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <Circle size={8} weight="fill" className={statusColors[a.status] + (a.status === 'thinking' ? ' animate-pulse' : '')} />
                <span className="text-sm font-semibold text-[#e8a850]">{a.name}</span>
              </div>
              <p className="text-[10px] text-[#e8a850]/50 mb-1">{a.role}</p>
              <p className="text-[10px] text-[#e0e6f0]/40 leading-relaxed">{a.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Pipeline + Chat */}
        <div className="flex flex-col gap-4">
          {/* Pipeline SVG */}
          <div className="bg-[#0d1f3c]/80 backdrop-blur-sm border border-[#e8a850]/20 rounded-lg p-4 h-[180px] flex-shrink-0">
            <h2 className="text-xs font-bold tracking-wider text-[#e8a850]/70 uppercase mb-2">Pipeline Topology</h2>
            <svg viewBox="0 0 520 120" className="w-full h-full">
              {/* Grid dots */}
              {Array.from({ length: 13 }).flatMap((_, xi) =>
                Array.from({ length: 6 }).map((_, yi) => (
                  <circle key={`${xi}-${yi}`} cx={xi * 40 + 20} cy={yi * 20 + 10} r={1} fill="#e8a850" opacity={0.15} />
                ))
              )}
              {/* Edges */}
              {pipelineEdges.map(([from, to], i) => {
                const a = pipelineNodes[from]
                const b = pipelineNodes[to]
                return (
                  <motion.line
                    key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="#e8a850" strokeWidth={1}
                    opacity={0.4}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                  />
                )
              })}
              {/* Nodes */}
              {pipelineNodes.map((n, i) => (
                <g key={i}>
                  <motion.circle
                    cx={n.x} cy={n.y} r={10}
                    fill="#0d1f3c"
                    stroke="#e8a850" strokeWidth={1.5}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
                  />
                  <motion.circle
                    cx={n.x} cy={n.y} r={3}
                    fill="#e8a850"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.4, 1] }}
                    transition={{ duration: 2, delay: 0.5 + i * 0.1, repeat: Infinity, repeatDelay: 3 }}
                  />
                  <text x={n.x} y={n.y + 20} textAnchor="middle" fill="#e8a850" opacity={0.5} fontSize={8} fontFamily="'IBM Plex Mono', monospace">{n.label}</text>
                </g>
              ))}
            </svg>
          </div>

          {/* Chat */}
          <div className="flex-1 bg-[#0d1f3c]/80 backdrop-blur-sm border border-[#e8a850]/20 rounded-lg p-4 overflow-y-auto flex flex-col gap-3">
            <h2 className="text-xs font-bold tracking-wider text-[#e8a850]/70 uppercase mb-1">Agent Chat</h2>
            {chatMessages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#09152a] border border-[#e8a850]/10 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Database size={10} className="text-[#e8a850]/60" weight="fill" />
                  <span className="text-[10px] font-bold text-[#e8a850]/60">{m.agent}</span>
                  <span className="text-[9px] text-[#e8a850]/30 ml-auto">{m.time}</span>
                </div>
                <p className="text-xs text-[#e0e6f0]/70 leading-relaxed">{m.text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Debug Log */}
        <div className="bg-[#0d1f3c]/80 backdrop-blur-sm border border-[#e8a850]/20 rounded-lg p-4 overflow-y-auto flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-2">
            <TerminalWindow size={14} className="text-[#e8a850]/70" weight="duotone" />
            <h2 className="text-xs font-bold tracking-wider text-[#e8a850]/70 uppercase">Debug Log</h2>
          </div>
          {logEntries.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-[10px] font-mono leading-relaxed py-0.5 ${levelStyles[e.level] || 'text-[#e8a850]/50'}`}
            >
              {e.text}
            </motion.div>
          ))}
          <motion.div
            className="text-[10px] font-mono text-[#e8a850] mt-1"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ▊
          </motion.div>
        </div>
      </div>

      {/* New Agent Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0d1f3c] border border-[#e8a850]/30 rounded-xl p-6 w-96"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#e8a850] tracking-wider">NEW AGENT</h2>
                <button onClick={() => setModalOpen(false)} className="text-[#e8a850]/40 hover:text-[#e8a850]">
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Agent name"
                  className="bg-[#09152a] border border-[#e8a850]/20 rounded px-3 py-2 text-sm text-[#e0e6f0] placeholder:text-[#e8a850]/30 focus:outline-none focus:border-[#e8a850]/50"
                />
                <input
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Agent role"
                  className="bg-[#09152a] border border-[#e8a850]/20 rounded px-3 py-2 text-sm text-[#e0e6f0] placeholder:text-[#e8a850]/30 focus:outline-none focus:border-[#e8a850]/50"
                />
                <button className="w-full mt-2 py-2 bg-[#e8a850]/10 border border-[#e8a850]/30 rounded text-sm font-bold text-[#e8a850] hover:bg-[#e8a850]/20 transition-colors">
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
