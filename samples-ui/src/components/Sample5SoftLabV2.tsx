import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  Heart, Plus, X, Circle, Cpu, GitBranch, TerminalWindow, 
  Database, Sparkle, CheckCircle, Warning, Info,
  PaperPlaneTilt, Robot, User, Gear, Bell
} from '@phosphor-icons/react'

// ─── Color System ───────────────────────────────────────────────
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
  agents: {
    lakshmi: '#ec4899',
    'ba-agent': '#8b5cf6',
    'qa-agent': '#06b6d4',
  }
}

// ─── Mock Data ──────────────────────────────────────────────────
const agents = [
  { 
    id: '1', 
    name: 'lakshmi', 
    status: 'idle', 
    role: 'Orchestrator', 
    desc: 'Routes tasks and manages pipeline flow.',
    color: colors.agents.lakshmi,
    icon: Sparkle
  },
  { 
    id: '2', 
    name: 'ba-agent', 
    status: 'thinking', 
    role: 'Business Analyst', 
    desc: 'Analyzes requirements and generates specs.',
    color: colors.agents['ba-agent'],
    icon: Cpu
  },
  { 
    id: '3', 
    name: 'qa-agent', 
    status: 'idle', 
    role: 'Quality Assurance', 
    desc: 'Validates outputs against acceptance criteria.',
    color: colors.agents['qa-agent'],
    icon: CheckCircle
  },
]

const chatMessages = [
  { id: '1', agent: 'lakshmi', text: 'Received task: generate PRD for user auth module.', time: '14:02', color: colors.agents.lakshmi, icon: Sparkle },
  { id: '2', agent: 'ba-agent', text: 'Analyzing requirements... cross-referencing with existing system docs.', time: '14:03', color: colors.agents['ba-agent'], icon: Cpu },
  { id: '3', agent: 'ba-agent', text: 'Spec draft ready. Routing to QA for validation.', time: '14:05', color: colors.agents['ba-agent'], icon: Cpu },
  { id: '4', agent: 'qa-agent', text: 'Running compliance checks on spec v2.1...', time: '14:06', color: colors.agents['qa-agent'], icon: CheckCircle },
]

const logEntries = [
  { id: '1', level: 'info', text: '[14:02:01] Pipeline initialized. 3 agents registered.', agent: 'system', color: colors.sky },
  { id: '2', level: 'info', text: '[14:02:15] Task "auth-prd" queued → lakshmi', agent: 'system', color: colors.sky },
  { id: '3', level: 'warn', text: '[14:03:40] ba-agent: context window at 72% capacity', agent: 'ba-agent', color: colors.amber },
  { id: '4', level: 'info', text: '[14:05:10] Spec artifact published to artifact store.', agent: 'ba-agent', color: colors.emerald },
  { id: '5', level: 'info', text: '[14:06:05] qa-agent: starting validation pass...', agent: 'qa-agent', color: colors.sky },
]

const pipelineNodes = [
  { x: 100, y: 80, label: 'Ingest', color: colors.sky },
  { x: 240, y: 40, label: 'Orch', color: colors.agents.lakshmi },
  { x: 240, y: 120, label: 'Analyze', color: colors.agents['ba-agent'] },
  { x: 380, y: 80, label: 'Validate', color: colors.agents['qa-agent'] },
  { x: 520, y: 80, label: 'Publish', color: colors.emerald },
]

const pipelineEdges = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
]

// ─── Components ─────────────────────────────────────────────────

function StatusDot({ status, color }: { status: string; color: string }) {
  return (
    <div className="relative flex items-center justify-center">
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{ 
          backgroundColor: status === 'idle' ? colors.emerald : colors.amber,
          boxShadow: `0 0 0 4px ${status === 'idle' ? colors.emerald : colors.amber}20`
        }}
      />
      {status === 'thinking' && (
        <motion.div
          className="absolute w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: colors.amber }}
          animate={{ scale: [1, 2], opacity: [1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
    </div>
  )
}

function AgentCard({ agent, isSelected, onClick }: { agent: any; isSelected: boolean; onClick: () => void }) {
  const Icon = agent.icon
  return (
    <motion.button
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border-2 transition-all duration-200"
      style={{
        backgroundColor: isSelected ? `${agent.color}10` : colors.surface,
        borderColor: isSelected ? agent.color : colors.border,
        boxShadow: isSelected ? `0 4px 12px ${agent.color}20` : '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-start gap-3">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${agent.color}15` }}
        >
          <Icon size={20} weight="duotone" style={{ color: agent.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm" style={{ color: colors.text }}>{agent.name}</span>
            <StatusDot status={agent.status} color={agent.color} />
          </div>
          <div className="text-xs font-medium mb-1" style={{ color: agent.color }}>{agent.role}</div>
          <div className="text-xs leading-relaxed" style={{ color: colors.textSecondary }}>{agent.desc}</div>
        </div>
      </div>
    </motion.button>
  )
}

function PipelineSVG() {
  return (
    <svg viewBox="0 0 620 160" className="w-full h-full">
      <defs>
        {pipelineEdges.map((edge, i) => (
          <linearGradient key={`grad-${i}`} id={`edge-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={pipelineNodes[edge.from].color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={pipelineNodes[edge.to].color} stopOpacity="0.3" />
          </linearGradient>
        ))}
      </defs>
      
      {/* Edges */}
      {pipelineEdges.map((edge, i) => {
        const from = pipelineNodes[edge.from]
        const to = pipelineNodes[edge.to]
        return (
          <g key={`edge-${i}`}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={`url(#edge-grad-${i})`}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <motion.circle
              r="4"
              fill={pipelineNodes[edge.from].color}
              initial={{ cx: from.x, cy: from.y }}
              animate={{ cx: to.x, cy: to.y }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ opacity: 0.6 }}
            />
          </g>
        )
      })}
      
      {/* Nodes */}
      {pipelineNodes.map((node, i) => (
        <g key={`node-${i}`}>
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="20"
            fill={colors.surface}
            stroke={node.color}
            strokeWidth="3"
            animate={{ 
              boxShadow: [
                `0 0 0 0px ${node.color}40`,
                `0 0 0 8px ${node.color}00`,
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <circle cx={node.x} cy={node.y} r="8" fill={node.color} />
          <text
            x={node.x}
            y={node.y + 35}
            textAnchor="middle"
            className="text-xs font-medium"
            fill={colors.textSecondary}
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function ChatBubble({ message }: { message: any }) {
  const Icon = message.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-3 mb-4"
    >
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${message.color}15` }}
      >
        <Icon size={16} weight="fill" style={{ color: message.color }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold" style={{ color: message.color }}>{message.agent}</span>
          <span className="text-xs" style={{ color: colors.textMuted }}>{message.time}</span>
        </div>
        <div 
          className="text-sm leading-relaxed p-3 rounded-2xl rounded-tl-none"
          style={{ 
            backgroundColor: `${message.color}08`,
            color: colors.text,
          }}
        >
          {message.text}
        </div>
      </div>
    </motion.div>
  )
}

function LogEntry({ entry }: { entry: any }) {
  const Icon = entry.level === 'warn' ? Warning : entry.level === 'error' ? Warning : Info
  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <Icon size={14} weight="fill" style={{ color: entry.color }} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono leading-relaxed" style={{ color: colors.textSecondary }}>
          {entry.text}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export default function Sample5SoftLabV2() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <header 
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{ 
          backgroundColor: colors.surface,
          borderColor: colors.border,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center gap-3">
          <Heart size={24} weight="fill" style={{ color: colors.rose }} />
          <h1 className="text-xl font-bold" style={{ color: colors.text }}>Agent Gateway</h1>
          <span 
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ backgroundColor: colors.primaryLight, color: colors.primary }}
          >
            SOFT LAB
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs" style={{ color: colors.textSecondary }}>3 agents</span>
          </div>
          <motion.button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{ 
              backgroundColor: colors.primary,
              color: 'white',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
            }}
            whileHover={{ y: -1, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)' }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus size={16} weight="bold" />
            New Agent
          </motion.button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-[280px_1fr_320px] gap-4 p-4 overflow-hidden">
        {/* Agent List */}
        <aside 
          className="rounded-2xl border-2 p-4 overflow-y-auto"
          style={{ 
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Agents</h2>
            <span className="text-xs" style={{ color: colors.textMuted }}>{agents.length} active</span>
          </div>
          <div className="space-y-3">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedAgent === agent.id}
                onClick={() => setSelectedAgent(agent.id)}
              />
            ))}
          </div>
        </aside>

        {/* Center: Pipeline + Chat */}
        <main className="flex flex-col gap-4 overflow-hidden">
          {/* Pipeline */}
          <div 
            className="rounded-2xl border-2 p-6 flex-1"
            style={{ 
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: colors.text }}>Pipeline Topology</h2>
            <PipelineSVG />
          </div>

          {/* Chat */}
          <div 
            className="rounded-2xl border-2 p-6 h-[300px] overflow-y-auto"
            style={{ 
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: colors.text }}>Agent Chat</h2>
            <div>
              {chatMessages.map(msg => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
            </div>
          </div>
        </main>

        {/* Debug Log */}
        <aside 
          className="rounded-2xl border-2 p-4 overflow-y-auto"
          style={{ 
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Debug Log</h2>
            <TerminalWindow size={16} weight="duotone" style={{ color: colors.textMuted }} />
          </div>
          <div className="space-y-1">
            {logEntries.map(entry => (
              <LogEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </aside>
      </div>

      {/* New Agent Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-md w-full"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ color: colors.text }}>Create Agent</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} style={{ color: colors.textSecondary }} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>Name</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
                    style={{ 
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                    placeholder="e.g. my-agent"
                    onFocus={(e) => e.target.style.borderColor = colors.primary}
                    onBlur={(e) => e.target.style.borderColor = colors.border}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>Role</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none transition-colors"
                    style={{ 
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                    placeholder="e.g. Data Analyst"
                    onFocus={(e) => e.target.style.borderColor = colors.primary}
                    onBlur={(e) => e.target.style.borderColor = colors.border}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>Description</label>
                  <textarea 
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none transition-colors resize-none"
                    style={{ 
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                    placeholder="What does this agent do?"
                    onFocus={(e) => e.target.style.borderColor = colors.primary}
                    onBlur={(e) => e.target.style.borderColor = colors.border}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                  Cancel
                </button>
                <motion.button
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white transition-all"
                  style={{ 
                    backgroundColor: colors.primary,
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                  }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Create Agent
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
