import { useCallback, useMemo, useState, useEffect } from 'react'
import { ReactFlow, MiniMap, Background, Controls, Handle, Position, useNodesState, useEdgesState, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Cpu, XCircle, Wrench, Robot, ArrowClockwise, Cards, Lightning, LinkSimple,
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

function NodeStatusPill({ status, color, greyscale }: { status: string; color: string; greyscale?: boolean }) {
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

interface AgentNodeData {
  agent: any
  state: any
  selected: boolean
  onSelect: (name: string) => void
}

function AgentNode({ data }: { data: AgentNodeData }) {
  const { agent, state, selected, onSelect } = data
  const color = agentColor(agent.name)
  const st = state || { name: agent.name, status: agent.status || 'idle', tools: [] }
  const isActive = st.status === 'thinking' || st.status === 'working'
  const isError = st.status === 'error'
  const hasActivity = st.tools.length > 0
  const isColored = selected || isActive || isError || hasActivity
  const c = isColored ? color : '#9ca3af'
  const [flipped, setFlipped] = useState(false)
  const [a2aCard, setA2aCard] = useState<any>(null)

  useEffect(() => {
    fetch(`/a2a/${agent.name}/.well-known/agent.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setA2aCard(d))
      .catch(() => {})
  }, [agent.name])

  return (
    <div className="relative w-[200px] h-[300px] [perspective:1000px]">
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-gray-300 !border-2 !border-white !z-50" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-gray-300 !border-2 !border-white !z-50" />
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => setFlipped(f => !f)}
        className="relative w-full h-full cursor-pointer [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* FRONT face */}
        <div
          className="absolute inset-0 rounded-2xl border-2 flex flex-col overflow-hidden shadow-sm [backface-visibility:hidden]"
          style={{ borderColor: selected ? color : isActive ? `${color}70` : `${c}35`, backgroundColor: colors.bg }}
        >
          <div className="px-4 py-3 flex items-center justify-between gap-2 shrink-0" style={{ background: `linear-gradient(135deg, ${c}2E 0%, ${c}1A 100%)` }}>
            <div className="flex items-center gap-2">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${c}30` }}>
                <span style={{ color: c }}>{agentIcon(agent, 24)}</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md border flex items-center gap-1" style={{ borderColor: `${c}40`, color: c, backgroundColor: `${c}08` }}>
                <Lightning size={9} weight="fill" /> A2A
              </span>
            </div>
            <NodeStatusPill status={isError ? 'error' : st.status} color={c} greyscale={!isColored} />
          </div>
          <div className="flex-1 flex flex-col px-4 py-3" style={{ background: `linear-gradient(180deg, ${c}10 0%, ${c}05 100%)` }}>
            <div className="mb-3">
              <div className="text-base font-bold mb-1" style={{ color: colors.text }}>{agent.name}</div>
              <div className="text-[11px] leading-relaxed" style={{ color: colors.textSecondary }}>{agent.description || 'Agent'}</div>
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: `${c}B0` }}>Tools</div>
            <div className="flex flex-wrap gap-1 mb-2 min-h-[20px]">
              {(agent.tools || []).map((t: string) => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[9px] font-medium border" style={{ borderColor: `${c}35`, color: colors.textSecondary, backgroundColor: `${c}12` }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-auto pt-2 border-t flex items-center gap-1" style={{ borderColor: `${c}25`, color: colors.textMuted }}>
              {isActive ? <Wrench size={10} weight="bold" style={{ color: c }} /> : <Robot size={10} weight="fill" />}
              <span className="text-[10px] truncate">{st.lastActivity || (isActive ? 'working...' : 'waiting')}</span>
            </div>
          </div>
        </div>

        {/* BACK face: A2A card */}
        <div
          className="absolute inset-0 rounded-2xl border-2 flex flex-col overflow-hidden shadow-sm [backface-visibility:hidden]"
          style={{ transform: 'rotateY(180deg)', borderColor: `${c}50`, backgroundColor: '#fafafa' }}
        >
          <div className="px-4 py-2.5 flex items-center justify-between shrink-0" style={{ background: `linear-gradient(135deg, ${c}30 0%, ${c}18 100%)` }}>
            <div className="flex items-center gap-2">
              <span style={{ color: c }}>{agentIcon(agent, 18)}</span>
              <span className="text-xs font-bold" style={{ color: colors.text }}>{agent.name}</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md border flex items-center gap-1" style={{ borderColor: `${c}40`, color: c, backgroundColor: `${c}10` }}>
              <Cards size={9} weight="fill" /> A2A CARD
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: colors.textMuted }}>Skills</div>
              <div className="flex flex-wrap gap-1">
                {(a2aCard?.skills || []).length > 0 ? a2aCard.skills.map((s: any) => (
                  <span key={s.id} className="px-2 py-0.5 rounded-full text-[9px] font-medium border" style={{ borderColor: `${c}35`, color: colors.textSecondary, backgroundColor: `${c}10` }}>{s.name}</span>
                )) : (
                  <span className="text-[10px]" style={{ color: colors.textMuted }}>No skills registered</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: colors.textMuted }}>Interfaces</div>
              {(a2aCard?.supportedInterfaces || []).map((i: any, idx: number) => (
                <div key={idx} className="text-[10px] font-mono truncate mb-0.5" style={{ color: colors.textSecondary }}>
                  {i.protocolBinding}: {i.url}
                </div>
              ))}
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: colors.textMuted }}>Version</div>
              <div className="text-[10px]" style={{ color: colors.textSecondary }}>{a2aCard?.version || '1.0.0'}</div>
            </div>
            <a
              href={`/a2a/${agent.name}/.well-known/agent.json`}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 text-[10px] font-medium w-fit px-2 py-1 rounded-lg"
              style={{ backgroundColor: `${c}12`, color: c }}
            >
              <LinkSimple size={10} weight="bold" /> View A2A card JSON
            </a>
          </div>
          <div className="px-4 py-2 border-t flex items-center justify-between shrink-0" style={{ borderColor: `${c}20` }}>
            <span className="text-[9px] flex items-center gap-1" style={{ color: colors.textMuted }}>
              <ArrowClockwise size={9} /> click to flip back
            </span>
            <button
              onClick={e => { e.stopPropagation(); onSelect(agent.name) }}
              className="text-[10px] font-medium px-2 py-1 rounded-lg text-white"
              style={{ backgroundColor: c }}
            >
              Chat
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

const nodeTypes = { agent: AgentNode }

function PipelineCanvasInner({
  agents,
  states,
  selected,
  onSelect,
}: {
  agents: any[]
  states: Record<string, any>
  selected: string | null
  onSelect: (name: string) => void
}) {
  const initialNodes = useMemo(() =>
    agents.map((a, i) => ({
      id: a.name,
      type: 'agent',
      position: { x: i * 280, y: 40 + (i % 2) * 60 },
      data: { agent: a, state: states[a.name], selected: selected === a.name, onSelect },
    })),
  [agents, states, selected, onSelect])

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

  // keep nodes/edges in sync when agents/states/selection change
  const syncNodes = useCallback(() => setNodes(initialNodes), [initialNodes, setNodes])
  const syncEdges = useCallback(() => setEdges(initialEdges), [initialEdges, setEdges])
  useMemo(() => { syncNodes(); syncEdges() }, [syncNodes, syncEdges])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.4 }}
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
