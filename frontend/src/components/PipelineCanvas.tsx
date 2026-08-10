import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ReactFlow, MiniMap, Background, Controls, Handle, Position, useNodesState, useEdgesState, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Cpu, X, XCircle, Wrench, Robot, ArrowClockwise, Cards, Lightning, LinkSimple, Plus, Check, PlugsConnected,
  Envelope, Wallet, Scan, PaperPlaneTilt, TreeStructure, SealCheck,
} from '@phosphor-icons/react'
import { motion } from 'motion/react'

const colors = {
  bg: '#f8f9fa',
  border: '#e5e7eb',
  text: '#1f2937',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  primary: '#6366f1',
  emerald: '#10b981',
  rose: '#f43f5e',
  agents: ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
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

function NodeStatusPill({ status, color, greyscale, error, onErrorClick }: { status: string; color: string; greyscale?: boolean; error?: string; onErrorClick?: () => void }) {
  if (status === 'thinking' || status === 'working') {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${color}12`, color }}>
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: color }}
            animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
          />
        ))}
        <span className="text-[8px] font-semibold uppercase tracking-wide">thinking</span>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <button
        onClick={e => { e.stopPropagation(); onErrorClick && onErrorClick() }}
        title={error || 'Agent error'}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-pointer hover:bg-rose-100 transition-colors"
        style={{ backgroundColor: '#fef2f2', color: colors.rose }}
      >
        <XCircle size={10} weight="bold" />
        <span className="text-[8px] font-semibold uppercase tracking-wide">error</span>
      </button>
    )
  }
  const idleColor = greyscale ? '#9ca3af' : colors.emerald
  return (
    <motion.div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-full shrink-0"
      style={{ backgroundColor: `${idleColor}12`, color: idleColor }}
      animate={{ opacity: greyscale ? 1 : [1, 0.7, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: idleColor }} />
      <span className="text-[8px] font-semibold uppercase tracking-wide">idle</span>
    </motion.div>
  )
}

interface AgentNodeData {
  agent: any
  state: any
  selected: boolean
  onSelect: (name: string) => void
  onToggleSkill: (agentName: string, skillName: string) => void
  onToggleMcp: (agentName: string, serverName: string) => void
}

function AgentNode({ data }: { data: AgentNodeData }) {
  const { agent, state, selected, onSelect, onToggleSkill, onToggleMcp } = data
  const color = agentColor(agent.name)
  const st = state || { name: agent.name, status: agent.status || 'idle', tools: [] }
  const isActive = st.status === 'thinking' || st.status === 'working'
  const isError = st.status === 'error'
  const hasActivity = st.tools.length > 0
  // Selected / active / recent tool use get agent color; error uses rose pill only (not full color)
  const isColored = selected || isActive || hasActivity
  const c = isColored ? color : '#9ca3af'
  const [flipped, setFlipped] = useState(false)
  const [showCardJson, setShowCardJson] = useState(false)
  const [showError, setShowError] = useState(false)
  const [a2aCard, setA2aCard] = useState<any>(null)
  const [picker, setPicker] = useState<'skills' | 'mcp' | null>(null)
  const [availableSkills, setAvailableSkills] = useState<any[]>([])
  const [availableMcp, setAvailableMcp] = useState<string[]>([])

  useEffect(() => {
    fetch(`/a2a/${agent.name}/.well-known/agent.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setA2aCard(d))
      .catch(() => {})
  }, [agent.name])

  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(d => setAvailableSkills(d || []))
      .catch(() => {})
    fetch('/api/mcp/servers')
      .then(r => r.json())
      .then(d => setAvailableMcp((d.servers || []).filter((s: string) => s !== '__proto__')))
      .catch(() => {})
  }, [])

  const enabledSkills = new Set(agent.skills || [])
  const enabledMcp = new Set((agent.mcp_servers || []).map((m: any) => typeof m === 'string' ? m : m.name))

  return (
    <div className="relative w-[160px] [perspective:1000px]">
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-gray-300 !border-2 !border-white !z-50" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-gray-300 !border-2 !border-white !z-50" />
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect(agent.name)}
        className="relative w-full grid [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* FRONT face */}
        <div
          className="rounded-2xl border-2 flex flex-col overflow-hidden shadow-sm [backface-visibility:hidden] min-h-[230px]"
          style={{ borderColor: selected ? color : isActive ? `${color}70` : `${c}35`, backgroundColor: colors.bg }}
        >
          <div className="px-3 py-2 flex items-center justify-between gap-2 shrink-0" style={{ background: `linear-gradient(135deg, ${c}2E 0%, ${c}1A 100%)` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: `${c}30` }}>
              <span style={{ color: c }}>{agentIcon(agent, 18)}</span>
            </div>
            <div className="flex flex-col items-end gap-1 min-w-0">
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-md border flex items-center gap-1" style={{ borderColor: `${c}40`, color: c, backgroundColor: `${c}08` }}>
                <Lightning size={8} weight="fill" /> A2A
              </span>
              <NodeStatusPill status={isError ? 'error' : st.status} color={c} greyscale={!isColored} error={st.error} onErrorClick={() => setShowError(true)} />
            </div>
          </div>
          <div className="flex-1 flex flex-col px-3 py-2" style={{ background: `linear-gradient(180deg, ${c}10 0%, ${c}05 100%)` }}>
            <div className="mb-2">
              <div className="text-sm font-bold mb-0.5 truncate" style={{ color: colors.text }}>{agent.name}</div>
              <div className="text-[10px] leading-snug line-clamp-2" style={{ color: colors.textSecondary }}>{agent.description || 'Agent'}</div>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: `${c}B0` }}>Skills</span>
              <button onClick={e => { e.stopPropagation(); setPicker('skills') }} title="Add skill" className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors" style={{ color: c, backgroundColor: `${c}15` }}>
                <Plus size={8} weight="bold" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-1 min-h-[14px]">
              {(agent.skills && agent.skills.length > 0 ? agent.skills : agent.tools || []).map((t: string) => (
                <span key={t} className="px-1.5 py-0.5 rounded-full text-[8px] font-medium border truncate max-w-[70px]" style={{ borderColor: `${c}35`, color: colors.textSecondary, backgroundColor: `${c}12` }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: `${c}B0` }}>MCP</span>
              <button onClick={e => { e.stopPropagation(); setPicker('mcp') }} title="Add MCP server" className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors" style={{ color: c, backgroundColor: `${c}15` }}>
                <Plus size={8} weight="bold" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-1 min-h-[14px]">
              {(agent.mcp_servers || []).map((m: any) => {
                const n = typeof m === 'string' ? m : m.name
                return (
                  <span key={n} className="px-1.5 py-0.5 rounded-full text-[8px] font-medium border flex items-center gap-1" style={{ borderColor: `${c}35`, color: colors.textSecondary, backgroundColor: `${c}12` }}>
                    <Lightning size={7} weight="fill" style={{ color: c }} /> {n}
                  </span>
                )
              })}
            </div>
            <div className="mt-auto pt-1.5 border-t flex items-center gap-1" style={{ borderColor: `${c}25`, color: colors.textMuted }}>
              <button
                onClick={e => { e.stopPropagation(); setFlipped(true) }}
                title="Flip to A2A card"
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-medium hover:bg-gray-100 transition-colors shrink-0"
                style={{ color: c, backgroundColor: `${c}10` }}
              >
                <ArrowClockwise size={8} weight="bold" /> flip
              </button>
              {isActive ? <Wrench size={9} weight="bold" style={{ color: c }} /> : <Robot size={9} weight="fill" />}
              <span className="text-[9px] truncate">{st.lastActivity || (isActive ? 'working...' : 'waiting')}</span>
            </div>
          </div>
        </div>

        {/* BACK face: A2A card */}
        <div
          className="absolute inset-0 rounded-2xl border-2 flex flex-col overflow-hidden shadow-sm [backface-visibility:hidden]"
          style={{ transform: 'rotateY(180deg)', borderColor: `${c}50`, backgroundColor: '#fafafa' }}
        >
          <div className="px-3 py-2 flex items-center justify-between shrink-0" style={{ background: `linear-gradient(135deg, ${c}30 0%, ${c}18 100%)` }}>
            <div className="flex items-center gap-1.5">
              <span style={{ color: c }}>{agentIcon(agent, 15)}</span>
              <span className="text-[11px] font-bold truncate" style={{ color: colors.text }}>{agent.name}</span>
            </div>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-md border flex items-center gap-1" style={{ borderColor: `${c}40`, color: c, backgroundColor: `${c}10` }}>
              <Cards size={8} weight="fill" /> A2A
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5">
            <div>
              <div className="text-[8px] font-semibold uppercase tracking-wide mb-1" style={{ color: colors.textMuted }}>Skills</div>
              {(a2aCard?.skills || []).length > 0 ? a2aCard.skills.map((s: any) => (
                <div key={s.id} className="mb-1.5 p-1.5 rounded-lg border" style={{ borderColor: `${c}25`, backgroundColor: `${c}06` }}>
                  <div className="text-[9px] font-semibold" style={{ color: colors.text }}>{s.name}</div>
                  {s.description && (
                    <div className="text-[8px] leading-snug mt-0.5 line-clamp-2" style={{ color: colors.textSecondary }}>{s.description}</div>
                  )}
                  {s.tools && s.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {s.tools.map((t: string) => (
                        <span key={t} className="px-1 py-0.5 rounded text-[7px] font-mono border" style={{ borderColor: `${c}30`, color: colors.textSecondary, backgroundColor: `${c}10` }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )) : (
                <span className="text-[9px]" style={{ color: colors.textMuted }}>No skills registered</span>
              )}
            </div>
            <div>
              <div className="text-[8px] font-semibold uppercase tracking-wide mb-1" style={{ color: colors.textMuted }}>Interfaces</div>
              {(a2aCard?.supportedInterfaces || []).map((i: any, idx: number) => (
                <div key={idx} className="text-[9px] font-mono truncate mb-0.5" style={{ color: colors.textSecondary }}>
                  {i.protocolBinding}: {i.url}
                </div>
              ))}
            </div>
            <div>
              <div className="text-[8px] font-semibold uppercase tracking-wide mb-1" style={{ color: colors.textMuted }}>Version</div>
              <div className="text-[9px]" style={{ color: colors.textSecondary }}>{a2aCard?.version || '1.0.0'}</div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setShowCardJson(true) }}
              className="flex items-center gap-1.5 text-[9px] font-medium w-fit px-1.5 py-1 rounded-lg"
              style={{ backgroundColor: `${c}12`, color: c }}
            >
              <LinkSimple size={9} weight="bold" /> View A2A card JSON
            </button>
          </div>
          <div className="px-3 py-1.5 border-t flex items-center justify-between shrink-0" style={{ borderColor: `${c}20` }}>
            <button
              onClick={e => { e.stopPropagation(); setFlipped(false) }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-medium hover:bg-gray-100 transition-colors"
              style={{ color: c, backgroundColor: `${c}10` }}
            >
              <ArrowClockwise size={8} weight="bold" /> flip back
            </button>
            <button
              onClick={e => { e.stopPropagation(); onSelect(agent.name) }}
              className="text-[9px] font-medium px-2 py-1 rounded-lg text-white"
              style={{ backgroundColor: c }}
            >
              Chat
            </button>
          </div>
        </div>
      </motion.div>

      {/* A2A card JSON modal (portal) */}
      {showCardJson && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowCardJson(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl flex flex-col shadow-2xl w-[min(92vw,680px)] max-h-[85vh]"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: colors.border }}>
              <h3 className="text-sm font-bold" style={{ color: colors.text }}>A2A Card · {agent.name}</h3>
              <button onClick={() => setShowCardJson(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <pre className="p-4 text-[12px] leading-relaxed whitespace-pre-wrap break-words overflow-y-auto flex-1" style={{ color: colors.textSecondary }}>
              {JSON.stringify(a2aCard || {}, null, 2)}
            </pre>
          </motion.div>
        </div>,
        document.body
      )}

      {/* error modal (portal) */}
      {showError && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowError(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl flex flex-col shadow-2xl w-[min(92vw,520px)] max-h-[85vh]"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: colors.border }}>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: colors.rose }}>
                <XCircle size={16} weight="bold" /> Agent Error · {agent.name}
              </h3>
              <button onClick={() => setShowError(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="p-5 text-sm leading-relaxed whitespace-pre-wrap break-words overflow-y-auto flex-1" style={{ color: colors.textSecondary, fontFamily: 'ui-monospace, monospace' }}>
              {st.error || 'Unknown error'}
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* skills / MCP picker popup (portal) */}
      {picker && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(3px)' }}
          onClick={() => setPicker(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl flex flex-col shadow-2xl w-[min(92vw,420px)] max-h-[80vh]"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0" style={{ borderColor: colors.border }}>
              <h3 className="text-sm font-bold" style={{ color: colors.text }}>
                {picker === 'skills' ? 'Skills' : 'MCP Servers'} · {agent.name}
              </h3>
              <button onClick={() => setPicker(null)} className="p-1 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto flex-1 space-y-1">
              {(picker === 'skills' ? availableSkills : availableMcp).length === 0 ? (
                <p className="text-xs text-gray-400 px-1 py-2">
                  {picker === 'skills' ? 'No skills installed. Add SKILL.md folders under data/skills/.' : 'No MCP servers configured in data/mcp.json.'}
                </p>
              ) : picker === 'skills' ? (
                availableSkills.map(s => {
                  const active = enabledSkills.has(s.name)
                  return (
                    <button
                      key={s.name}
                      onClick={() => onToggleSkill(agent.name, s.name)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border-2 text-left transition-all ${
                        active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${active ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-transparent'}`}>
                        <Check size={10} weight="bold" />
                      </span>
                      <span className="truncate">{s.name}</span>
                      <span className="ml-auto text-[9px] text-gray-400 shrink-0">{s.scripts?.length || 0} scripts</span>
                    </button>
                  )
                })
              ) : (
                availableMcp.map(name => {
                  const active = enabledMcp.has(name)
                  return (
                    <button
                      key={name}
                      onClick={() => onToggleMcp(agent.name, name)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border-2 text-left transition-all ${
                        active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${active ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-transparent'}`}>
                        <Check size={10} weight="bold" />
                      </span>
                      <PlugsConnected size={13} style={{ color: active ? '#6366f1' : '#9ca3af' }} />
                      <span className="truncate">{name}</span>
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  )
}

const nodeTypes = { agent: AgentNode }

function PipelineCanvasInner({
  agents,
  states,
  selected,
  onSelect,
  onToggleSkill,
  onToggleMcp,
}: {
  agents: any[]
  states: Record<string, any>
  selected: string | null
  onSelect: (name: string) => void
  onToggleSkill?: (agentName: string, skillName: string) => void
  onToggleMcp?: (agentName: string, serverName: string) => void
}) {
  const initialNodes = useMemo(() =>
    agents.map((a, i) => ({
      id: a.name,
      type: 'agent',
      position: { x: i * 280, y: 40 + (i % 2) * 60 },
      data: { agent: a, state: states[a.name], selected: selected === a.name, onSelect, onToggleSkill, onToggleMcp },
    })),
  [agents, states, selected, onSelect, onToggleSkill, onToggleMcp])

  const initialEdges = useMemo(() => {
    const edges: any[] = []
    for (let i = 0; i < agents.length; i++) {
      for (let j = 0; j < agents.length; j++) {
        if (i === j) continue
        const from = agents[i]
        const to = agents[j]
        if ((from.handoff_targets || []).includes(to.name)) {
          edges.push({
            id: `${from.name}-${to.name}`,
            source: from.name,
            target: to.name,
            animated: true,
            style: { stroke: `${agentColor(from.name)}99`, strokeWidth: 2 },
            label: 'A2A →',
            labelStyle: { fill: agentColor(from.name), fontWeight: 700, fontSize: 10 },
            labelBgStyle: { fill: '#ffffff', fillOpacity: 0.85 },
            labelBgPadding: [4, 2] as [number, number],
            labelBgBorderRadius: 4,
          })
        }
      }
    }
    return edges
  }, [agents])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const { fitView } = useReactFlow()

  // Sync node/edge data when agents, selection, or activity change — preserve drag positions.
  useEffect(() => {
    setNodes(current =>
      initialNodes.map(n => {
        const prev = current.find(c => c.id === n.id)
        return prev ? { ...n, position: prev.position } : n
      }),
    )
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  // Fit viewport when agent count changes, not on every card click / selection.
  useEffect(() => {
    if (agents.length === 0) return
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.4, duration: 200 })
    })
    return () => cancelAnimationFrame(id)
  }, [agents.length, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      nodesDraggable
      panOnDrag
      zoomOnScroll
      className="!bg-transparent"
    >
      <Background color="#e5e7eb" gap={24} size={1} />
      <MiniMap position="bottom-right" className="!bg-white !rounded-xl" style={{ width: 160, height: 110 }} />
      <Controls className="!bg-white !rounded-xl !shadow !border !border-gray-200" />
    </ReactFlow>
  )
}

export default function PipelineCanvas(props: any) {
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <PipelineCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
