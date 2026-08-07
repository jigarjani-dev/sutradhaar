import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, X, PencilSimple, Note, Notebook, ChatText, ListNumbers } from '@phosphor-icons/react'

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
  { id: '1', level: 'info', text: '14:02:01  Pipeline initialized. 3 agents registered.', agent: 'system' },
  { id: '2', level: 'info', text: '14:02:15  Task "auth-prd" queued → lakshmi', agent: 'system' },
  { id: '3', level: 'warn', text: '14:03:40  ba-agent: context window at 72% capacity', agent: 'ba-agent' },
  { id: '4', level: 'info', text: '14:05:10  Spec artifact published to artifact store.', agent: 'ba-agent' },
  { id: '5', level: 'info', text: '14:06:05  qa-agent: starting validation pass...', agent: 'qa-agent' },
]

const statusLabels: Record<string, string> = {
  idle: '— idle',
  thinking: '— thinking...',
  error: '— error',
}

const pipelineNodes = [
  { x: 60, y: 55, label: 'INGEST' },
  { x: 180, y: 30, label: 'ORCH' },
  { x: 180, y: 80, label: 'ANALYZE' },
  { x: 300, y: 55, label: 'VALIDATE' },
  { x: 420, y: 55, label: 'PUBLISH' },
]

const pipelineEdges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]]

export default function Sample2Editorial() {
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')

  return (
    <div className="min-h-screen text-[#1a1a1a] bg-[#f8f5f0]" style={{ fontFamily: "'Georgia', 'Crimson Text', serif" }}>
      {/* Watermark-like grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 31px, #1a1a1a 31px, #1a1a1a 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, #1a1a1a 31px, #1a1a1a 32px)',
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-[#cc3333]/15 bg-[#f8f5f0]">
        <div className="flex items-center gap-3">
          <PencilSimple size={22} className="text-[#cc3333]" weight="duotone" />
          <h1 className="text-xl italic text-[#1a1a1a] border-b-2 border-[#cc3333]/30 pb-0.5">Agent Gateway</h1>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#cc3333]/60 font-sans">Field Notes</span>
        </div>
        <div className="flex items-center gap-6 text-[11px] text-[#1a1a1a]/50 font-sans tracking-wide">
          <span>3 contributors</span>
          <span>pipeline active</span>
          <span className="text-[#cc3333]/60">draft v4</span>
        </div>
      </header>

      <div className="relative z-10 grid grid-cols-[260px_1fr_280px] gap-5 p-5 h-[calc(100vh-72px)]">
        {/* Agent Cards */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-[#1a1a1a]/40 font-sans font-bold">Contributors</h2>
            <button
              onClick={() => setModalOpen(true)}
              className="p-1.5 text-[#cc3333]/50 hover:text-[#cc3333] transition-colors"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
          {agents.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, rotate: -0.5 }}
              animate={{ opacity: 1, rotate: i % 2 === 0 ? -0.3 : 0.4 }}
              className="bg-[#fdfcf8] border border-[#1a1a1a]/10 p-4 shadow-sm hover:shadow-md transition-shadow"
              style={{ boxShadow: '2px 3px 6px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-sans ${a.status === 'thinking' ? 'text-[#cc3333] animate-pulse' : 'text-[#1a1a1a]/30'}`}>
                  {statusLabels[a.status]}
                </span>
              </div>
              <h3 className="text-base font-bold text-[#1a1a1a] mb-0.5">{a.name}</h3>
              <p className="text-[10px] text-[#cc3333]/70 font-sans uppercase tracking-wider mb-1">{a.role}</p>
              <p className="text-[11px] text-[#1a1a1a]/50 leading-relaxed italic">{a.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Pipeline + Chat */}
        <div className="flex flex-col gap-5">
          {/* Pipeline SVG - hand-drawn */}
          <div className="bg-[#fdfcf8] border border-[#1a1a1a]/10 p-5 h-[180px] flex-shrink-0" style={{ boxShadow: '2px 3px 6px rgba(0,0,0,0.04)' }}>
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-[#1a1a1a]/40 font-sans font-bold mb-3">Pipeline Diagram</h2>
            <svg viewBox="0 0 480 110" className="w-full h-full">
              {/* Dashed edges */}
              {pipelineEdges.map(([from, to], i) => {
                const a = pipelineNodes[from]
                const b = pipelineNodes[to]
                return (
                  <motion.line
                    key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="#cc3333" strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.35}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                  />
                )
              })}
              {/* Nodes as small squares */}
              {pipelineNodes.map((n, i) => (
                <g key={i}>
                  <motion.rect
                    x={n.x - 8} y={n.y - 7} width={16} height={14}
                    fill="#fdfcf8"
                    stroke="#cc3333" strokeWidth={1.5}
                    rx={1}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
                  />
                  <motion.circle
                    cx={n.x} cy={n.y} r={2.5}
                    fill="#cc3333"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.7 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                  />
                  <text x={n.x} y={n.y + 18} textAnchor="middle" fill="#1a1a1a" opacity={0.45} fontSize={7} fontFamily="sans-serif" fontWeight="bold">{n.label}</text>
                </g>
              ))}
            </svg>
          </div>

          {/* Chat */}
          <div className="flex-1 bg-[#fdfcf8] border border-[#1a1a1a]/10 p-5 overflow-y-auto flex flex-col gap-3" style={{ boxShadow: '2px 3px 6px rgba(0,0,0,0.04)' }}>
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-[#1a1a1a]/40 font-sans font-bold mb-1">Conversation</h2>
            {chatMessages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-[#faf8f3] border-l-2 border-[#cc3333]/30 pl-4 py-3 pr-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-[#1a1a1a] font-sans">{m.agent}</span>
                  <span className="text-[9px] text-[#1a1a1a]/30 font-sans ml-auto">{m.time}</span>
                </div>
                <p className="text-[13px] text-[#1a1a1a]/65 leading-relaxed">{m.text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Debug Log - typewriter */}
        <div className="bg-[#fdfcf8] border border-[#1a1a1a]/10 p-5 overflow-y-auto flex flex-col gap-0.5" style={{ boxShadow: '2px 3px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-2 mb-3">
            <ListNumbers size={14} className="text-[#cc3333]/60" weight="duotone" />
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-[#1a1a1a]/40 font-sans font-bold">Log</h2>
          </div>
          {logEntries.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-[10px] font-sans leading-relaxed py-0.5 border-b border-[#1a1a1a]/5 ${
                e.level === 'warn' ? 'text-[#cc3333]/60 italic' : 'text-[#1a1a1a]/45'
              }`}
            >
              {e.text}
            </motion.div>
          ))}
          <motion.span
            className="text-[10px] font-sans text-[#cc3333]/40 mt-1"
            animate={{ opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            |
          </motion.span>
        </div>
      </div>

      {/* New Agent Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/30"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-[#fdfcf8] border border-[#1a1a1a]/15 w-96"
              style={{ boxShadow: '4px 6px 20px rgba(0,0,0,0.1)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]/10">
                <h2 className="text-sm font-bold italic text-[#1a1a1a]">Add Contributor</h2>
                <button onClick={() => setModalOpen(false)} className="text-[#1a1a1a]/30 hover:text-[#cc3333]">
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contributor name"
                  className="bg-transparent border-b border-[#1a1a1a]/15 px-0 py-2 text-sm text-[#1a1a1a] placeholder:text-[#1a1a1a]/25 italic focus:outline-none focus:border-[#cc3333]/50 font-sans"
                />
                <input
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Role"
                  className="bg-transparent border-b border-[#1a1a1a]/15 px-0 py-2 text-sm text-[#1a1a1a] placeholder:text-[#1a1a1a]/25 italic focus:outline-none focus:border-[#cc3333]/50 font-sans"
                />
                <button className="w-full mt-2 py-2.5 border border-[#cc3333]/30 text-[13px] font-sans font-bold text-[#cc3333] hover:bg-[#cc3333]/5 transition-colors tracking-wider uppercase">
                  Register
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
