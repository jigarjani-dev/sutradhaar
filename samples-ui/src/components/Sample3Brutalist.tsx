import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, X, Square, Asterisk } from '@phosphor-icons/react'

const agents = [
  { id: '1', name: 'lakshmi', status: 'idle', role: 'ORCHESTRATOR', desc: 'Routes tasks and manages pipeline flow.' },
  { id: '2', name: 'ba-agent', status: 'thinking', role: 'BUSINESS ANALYST', desc: 'Analyzes requirements and generates specs.' },
  { id: '3', name: 'qa-agent', status: 'idle', role: 'QA', desc: 'Validates outputs against acceptance criteria.' },
]

const chatMessages = [
  { id: '1', agent: 'lakshmi', text: '> Received task: generate PRD for user auth module.', time: '14:02' },
  { id: '2', agent: 'ba-agent', text: '> Analyzing requirements... cross-referencing with system docs.', time: '14:03' },
  { id: '3', agent: 'ba-agent', text: '> Spec draft ready. Routing to QA for validation.', time: '14:05' },
  { id: '4', agent: 'qa-agent', text: '> Running compliance checks on spec v2.1...', time: '14:06' },
]

const logEntries = [
  { id: '1', text: '[14:02:01] PIPELINE INITIALIZED. 3 AGENTS.', agent: 'system' },
  { id: '2', text: '[14:02:15] TASK "auth-prd" QUEUED -> lakshmi', agent: 'system' },
  { id: '3', text: '[14:03:40] WARN ba-agent: context 72% full', agent: 'ba-agent' },
  { id: '4', text: '[14:05:10] OK ba-agent: spec published', agent: 'ba-agent' },
  { id: '5', text: '[14:06:05] OK qa-agent: validation started', agent: 'qa-agent' },
]

const pipelineNodes = [
  { x: 50, y: 50, label: 'INGEST' },
  { x: 160, y: 25, label: 'ORCH' },
  { x: 160, y: 75, label: 'ANALYZE' },
  { x: 280, y: 50, label: 'VALIDATE' },
  { x: 400, y: 50, label: 'PUBLISH' },
]

const pipelineEdges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]]

export default function Sample3Brutalist() {
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')

  return (
    <div className="min-h-screen text-white bg-black" style={{ fontFamily: "'Courier New', 'Courier', monospace" }}>
      <header className="flex items-center justify-between px-6 py-4 border-b-4 border-white bg-black">
        <div className="flex items-center gap-3">
          <Asterisk size={22} className="text-[#00ff41]" weight="bold" />
          <h1 className="text-lg font-bold tracking-tighter uppercase">AGENT_GATEWAY</h1>
          <span className="text-[10px] text-[#00ff41] border-2 border-[#00ff41] px-2 py-0.5">BRUTALIST</span>
        </div>
        <div className="flex items-center gap-6 text-[11px] text-white/60">
          <span>NODES: 3</span>
          <span>STATUS: IDLE</span>
        </div>
      </header>

      <div className="grid grid-cols-[260px_1fr_280px] gap-0 h-[calc(100vh-60px)]">
        {/* Agent List */}
        <div className="border-r-4 border-white flex flex-col">
          <div className="flex items-center justify-between p-4 border-b-4 border-white">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#00ff41]">AGENTS</h2>
            <button
              onClick={() => setModalOpen(true)}
              className="border-2 border-white px-2 py-1 text-white hover:bg-white hover:text-black transition-colors"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
          {agents.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="border-b-4 border-white p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Square
                  size={10}
                  weight="fill"
                  className={a.status === 'thinking' ? 'text-[#00ff41] animate-pulse' : 'text-white/40'}
                />
                <span className="text-sm font-bold uppercase">{a.name}</span>
              </div>
              <p className="text-[10px] text-[#00ff41] mb-1">{a.role}</p>
              <p className="text-[10px] text-white/50 leading-relaxed">{a.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Pipeline + Chat */}
        <div className="flex flex-col border-r-4 border-white">
          {/* Pipeline */}
          <div className="p-4 border-b-4 border-white h-[180px] flex-shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#00ff41] mb-3">PIPELINE TOPOLOGY</h2>
            <svg viewBox="0 0 450 100" className="w-full h-full">
              {/* Grid */}
              {Array.from({ length: 12 }).flatMap((_, xi) =>
                Array.from({ length: 5 }).map((_, yi) => (
                  <text key={`${xi}-${yi}`} x={xi * 38 + 10} y={yi * 20 + 10} fill="white" opacity={0.06} fontSize={6} fontFamily="'Courier New', monospace">+</text>
                ))
              )}
              {pipelineEdges.map(([from, to], i) => {
                const a = pipelineNodes[from]
                const b = pipelineNodes[to]
                return (
                  <motion.line
                    key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="white" strokeWidth={3}
                    opacity={0.7}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                  />
                )
              })}
              {pipelineNodes.map((n, i) => (
                <g key={i}>
                  <motion.rect
                    x={n.x - 10} y={n.y - 8} width={20} height={16}
                    fill="black"
                    stroke="white" strokeWidth={3}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                  />
                  <motion.rect
                    x={n.x - 4} y={n.y - 3} width={8} height={6}
                    fill="white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.3, 1] }}
                    transition={{ duration: 2, delay: 0.5 + i * 0.1, repeat: Infinity, repeatDelay: 3 }}
                  />
                  <text x={n.x} y={n.y + 18} textAnchor="middle" fill="white" opacity={0.5} fontSize={7} fontFamily="'Courier New', monospace">{n.label}</text>
                </g>
              ))}
            </svg>
          </div>

          {/* Chat - IRC style */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-1 border-b-4 border-white">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#00ff41] mb-2">#AGENT-CHAT</h2>
            {chatMessages.map((m) => (
              <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs">
                <span className="text-white/30">{m.time}</span>
                {' '}
                <span className={m.agent === 'ba-agent' ? 'text-[#00ff41]' : 'text-white'}>{`<${m.agent}>`}</span>
                {' '}
                <span className="text-white/70">{m.text}</span>
              </motion.div>
            ))}
            <motion.span
              className="text-xs text-[#00ff41] mt-1"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              _
            </motion.span>
          </div>
        </div>

        {/* Debug Log - terminal */}
        <div className="p-4 overflow-y-auto flex flex-col gap-0.5 bg-black">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#00ff41] mb-3">DEBUG.LOG</h2>
          {logEntries.map((e) => (
            <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] leading-relaxed text-[#00ff41]">
              {e.text}
            </motion.div>
          ))}
          <motion.span
            className="text-[10px] text-[#00ff41]"
            animate={{ opacity: [1, 0.4] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          >
            ▊
          </motion.span>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-black border-4 border-white w-96"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b-4 border-white">
                <h2 className="text-sm font-bold uppercase text-[#00ff41]">NEW AGENT</h2>
                <button onClick={() => setModalOpen(false)} className="text-white hover:text-[#00ff41]">
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="AGENT NAME"
                  className="bg-black border-2 border-white px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ff41] uppercase"
                />
                <input
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="AGENT ROLE"
                  className="bg-black border-2 border-white px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ff41] uppercase"
                />
                <button className="w-full py-3 border-2 border-white text-sm font-bold text-white hover:bg-white hover:text-black transition-colors uppercase">
                  REGISTER
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
