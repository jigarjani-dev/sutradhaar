import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Cpu, CheckCircle, XCircle, ArrowRight, Wrench, Robot,
  Envelope, Wallet, Scan, PaperPlaneTilt, TreeStructure, SealCheck,
} from '@phosphor-icons/react'

const colors = {
  bg: '#f8f9fa',
  surface: '#ffffff',
  border: '#e5e7eb',
  text: '#1f2937',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  primary: '#6366f1',
  primaryLight: '#eef2ff',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  agents: ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
}

interface ToolCall {
  tool: string
  status: 'running' | 'done' | 'error'
  args: Record<string, any>
  result?: string
  ts: number
}

interface AgentCardState {
  name: string
  status: string
  tools: ToolCall[]
  lastActivity?: string
}

const agentColor = (name: string) => colors.agents[name.charCodeAt(0) % colors.agents.length]

const agentIcon = (agent: any, size = 20) => {
  const tools = agent.tools || []
  const orchestrator = agent.orchestrator
  const props = { size, weight: 'duotone' as const }
  if (orchestrator) return <TreeStructure {...props} />
  if (tools.includes('gmail_reader')) return <Envelope {...props} />
  if (tools.some((t: string) => t.startsWith('sheets'))) return <Wallet {...props} />
  if (tools.includes('ocr_reader')) return <Scan {...props} />
  if (tools.includes('telegram_sender')) return <PaperPlaneTilt {...props} />
  if (tools.length > 0) return <SealCheck {...props} />
  return <Cpu {...props} />
}

function StatusPill({ status, color, greyscale }: { status: string; color: string; greyscale?: boolean }) {
  if (status === 'thinking' || status === 'working') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${color}12`, color }}>
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
            animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
          />
        ))}
        <span className="text-[10px] font-semibold uppercase tracking-wide">thinking</span>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#fef2f2', color: colors.rose }}>
        <XCircle size={12} weight="bold" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">error</span>
      </div>
    )
  }
  const idleColor = greyscale ? '#9ca3af' : colors.emerald
  return (
    <motion.div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ backgroundColor: `${idleColor}12`, color: idleColor }}
      animate={{ opacity: greyscale ? 1 : [1, 0.7, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: idleColor }} />
      <span className="text-[10px] font-semibold uppercase tracking-wide">idle</span>
    </motion.div>
  )
}

function ToolChip({ tc, color }: { tc: ToolCall; color: string }) {
  const [open, setOpen] = useState(false)
  const isRunning = tc.status === 'running'
  return (
    <motion.div layout initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium transition-colors"
        style={{
          borderColor: isRunning ? `${color}50` : colors.border,
          backgroundColor: isRunning ? `${color}08` : colors.surface,
          color: isRunning ? color : colors.textSecondary,
        }}
      >
        {isRunning ? (
          <motion.span className="w-3 h-3 rounded-full border-2" style={{ borderColor: `${color}40`, borderTopColor: color }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
        ) : tc.status === 'error' ? (
          <XCircle size={12} weight="bold" style={{ color: colors.rose }} />
        ) : (
          <CheckCircle size={12} weight="bold" style={{ color: colors.emerald }} />
        )}
        <span className="max-w-[90px] truncate">{tc.tool}</span>
      </button>
      <AnimatePresence>
        {open && tc.result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre className="mt-1 p-2 rounded-lg text-[9px] leading-snug bg-gray-50 border border-gray-200 whitespace-pre-wrap break-all max-h-24 overflow-y-auto" style={{ color: colors.textSecondary }}>
              {tc.result}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function PipelineCards({
  agents,
  states,
  selected,
  onSelect,
}: {
  agents: any[]
  states: Record<string, AgentCardState>
  selected: string | null
  onSelect: (name: string) => void
}) {
  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: colors.textMuted }}>
        No agents deployed
      </div>
    )
  }

  const list = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
  } as const
  const card = {
    hidden: { opacity: 0, y: 16, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } },
    exit: { opacity: 0, scale: 0.94, transition: { duration: 0.15 } },
  } as const

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col justify-center">
        <motion.div
          variants={list}
          initial="hidden"
          animate="show"
          className="flex items-center gap-2 px-2 overflow-x-auto pb-2"
        >
          <AnimatePresence mode="popLayout">
            {agents.map((a, i) => {
              const color = agentColor(a.name)
              const st = states[a.name] || { name: a.name, status: a.status || 'idle', tools: [] }
              const isSelected = selected === a.name
              const isActive = st.status === 'thinking' || st.status === 'working'
              const isError = st.status === 'error'
              const hasActivity = st.tools.length > 0
              // colored when selected OR invoked (active / has tool activity); greyscale otherwise
              const isColored = isSelected || isActive || isError || hasActivity
              const c = isColored ? color : '#9ca3af'
              const prevColored = states[agents[i - 1]?.name]?.tools?.length > 0 || agents[i - 1]?.name === selected

              return (
                <div key={a.name} className="flex items-center gap-2">
                  {i > 0 && (
                    <div className="flex items-center shrink-0">
                      <motion.div
                        className="w-10 h-px"
                        style={{
                          background: isColored && prevColored
                            ? `linear-gradient(to right, ${agentColor(agents[i - 1].name)}66, ${color}66)`
                            : 'linear-gradient(to right, #d1d5db, #d1d5db)',
                        }}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <ArrowRight size={12} weight="bold" style={{ color: isColored ? colors.textMuted : '#d1d5db' }} />
                    </div>
                  )}

                  <motion.div
                    variants={card}
                    layout
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelect(a.name)}
                    className="relative w-[200px] h-[300px] rounded-2xl border-2 cursor-pointer flex flex-col overflow-hidden"
                    style={{
                      borderColor: isSelected ? color : isActive ? `${color}70` : `${c}35`,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* header band: darker tint */}
                    <div
                      className="px-4 py-3 flex items-center justify-between gap-2 shrink-0"
                      style={{ background: `linear-gradient(135deg, ${c}2E 0%, ${c}1A 100%)` }}
                    >
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${c}30` }}>
                        <span style={{ color: c }}>{agentIcon(a, 24)}</span>
                      </div>
                      <StatusPill status={isError ? 'error' : st.status} color={c} greyscale={!isColored} />
                    </div>

                    {/* body: lighter pastel */}
                    <div className="flex-1 flex flex-col px-4 py-3" style={{ background: `linear-gradient(180deg, ${c}10 0%, ${c}05 100%)` }}>
                      {/* name + description */}
                      <div className="mb-3">
                        <div className="text-base font-bold mb-1" style={{ color: colors.text }}>{a.name}</div>
                        <div className="text-[11px] leading-relaxed" style={{ color: colors.textSecondary }}>
                          {a.description || 'Agent'}
                        </div>
                      </div>

                      {/* tools summary */}
                      <div className="text-[9px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: `${c}B0` }}>
                        Tools
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2 min-h-[20px]">
                        {(a.tools || []).map((t: string) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-[9px] font-medium border" style={{ borderColor: `${c}35`, color: colors.textSecondary, backgroundColor: `${c}12` }}>
                            {t}
                          </span>
                        ))}
                      </div>

                      {/* tool call chips (live activity) */}
                      {st.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          <AnimatePresence>
                            {st.tools.slice(-2).map(tc => <ToolChip key={`${tc.tool}-${tc.ts}`} tc={tc} color={color} />)}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* footer pinned to bottom */}
                      <div className="mt-auto pt-2 border-t flex items-center gap-1" style={{ borderColor: `${c}25`, color: colors.textMuted }}>
                        {isActive ? <Wrench size={10} weight="bold" style={{ color: c }} /> : <Robot size={10} weight="fill" />}
                        <span className="text-[10px] truncate">
                          {st.lastActivity || (isActive ? 'working...' : 'waiting')}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
