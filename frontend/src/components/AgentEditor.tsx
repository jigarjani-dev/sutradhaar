import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, FloppyDisk, Trash, Cpu, ArrowClockwise } from '@phosphor-icons/react'

const API = '/api'

const COLORS = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

interface AgentEditorProps {
  agent: any
  allAgents: any[]
  onClose: () => void
  onSave: () => void
  onDelete: () => void
}

export default function AgentEditor({ agent, allAgents, onClose, onSave, onDelete }: AgentEditorProps) {
  const [name, setName] = useState(agent.name)
  const [description, setDescription] = useState(agent.description || '')
  const [soulMd, setSoulMd] = useState(agent.soul_md || `# ${agent.name}\n\nYou are a helpful assistant.`)
  const [model, setModel] = useState(agent.model || 'deepseek-chat')
  const [providerId, setProviderId] = useState(agent.provider || '')
  const [providers, setProviders] = useState<any[]>([])
  const [providerModels, setProviderModels] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [skills, setSkills] = useState<string[]>(agent.skills || [])
  const [mcpServers, setMcpServers] = useState<string[]>(
    (agent.mcp_servers || []).map((m: any) => typeof m === 'string' ? m : m.name)
  )
  const [handoffTargets, setHandoffTargets] = useState<string[]>(agent.handoff?.targets || [])
  const [orchestratorEnabled, setOrchestratorEnabled] = useState(agent.orchestrator?.enabled || false)
  const [orchestratorRules, setOrchestratorRules] = useState(agent.orchestrator?.rules || [])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Load config from config_yaml if present
  useEffect(() => {
    if (agent.config_yaml) {
      try {
        // Simple YAML parse for basic fields
        const lines = agent.config_yaml.split('\n')
        for (const line of lines) {
          if (line.startsWith('model:')) setModel(line.split(':')[1].trim().replace(/"/g, ''))
          if (line.startsWith('provider:')) setProviderId(line.split(':')[1].trim().replace(/"/g, ''))
        }
      } catch {}
    }
    // handoff targets come back from the API at top level (handoff_targets)
    if (agent.handoff_targets?.length) {
      setHandoffTargets(agent.handoff_targets)
    } else if (agent.handoff?.targets?.length) {
      setHandoffTargets(agent.handoff.targets)
    }
    // orchestrator state from the API / config
    if (agent.orchestrator) setOrchestratorEnabled(true)
    if (agent.orchestrator_rules?.length) setOrchestratorRules(agent.orchestrator_rules)
  }, [agent.config_yaml, agent.handoff_targets, agent.handoff?.targets, agent.orchestrator, agent.orchestrator_rules])

  // Load providers for the dropdown
  useEffect(() => {
    fetch(`${API}/providers`)
      .then(r => r.json())
      .then(data => {
        setProviders(data)
        // if agent has a provider, load its models
        const pid = agent.provider || (agent.config_yaml ? '' : '')
        if (pid) {
          const prov = data.find((p: any) => p.id === pid)
          if (prov?.models?.length) setProviderModels(prov.models)
        }
      })
      .catch(() => {})
  }, [agent.provider])

  // Load available skills + mcp servers
  const [availableSkills, setAvailableSkills] = useState<any[]>([])
  const [availableMcpServers, setAvailableMcpServers] = useState<string[]>([])
  useEffect(() => {
    fetch(`${API}/skills`)
      .then(r => r.json())
      .then(data => setAvailableSkills(data))
      .catch(() => {})
    fetch(`${API}/mcp/servers`)
      .then(r => r.json())
      .then(data => setAvailableMcpServers((data.servers || []).filter((s: string) => s !== '__proto__')))
      .catch(() => {})
  }, [])

  const loadProviderModels = async (pid: string) => {
    if (!pid) { setProviderModels([]); return }
    const prov = providers.find(p => p.id === pid)
    if (prov?.models?.length) {
      setProviderModels(prov.models)
      return
    }
    setFetchingModels(true)
    try {
      const res = await fetch(`${API}/providers/${pid}/fetch-models`, { method: 'POST' })
      const data = await res.json()
      setProviderModels(data.models || [])
    } catch (err) {
      console.error('Failed to fetch provider models:', err)
    }
    setFetchingModels(false)
  }

  const toggleSkill = (skillName: string) => {
    setSkills((prev: string[]) => prev.includes(skillName) ? prev.filter(s => s !== skillName) : [...prev, skillName])
  }

  const toggleMcpServer = (serverName: string) => {
    setMcpServers((prev: string[]) => prev.includes(serverName) ? prev.filter(s => s !== serverName) : [...prev, serverName])
  }

  const toggleHandoffTarget = (targetName: string) => {
    setHandoffTargets((prev: string[]) => prev.includes(targetName) ? prev.filter(t => t !== targetName) : [...prev, targetName])
  }

  const addOrchestratorRule = () => {
    setOrchestratorRules((prev: any[]) => [...prev, { match: [], target: '' }])
  }

  const updateRule = (index: number, field: string, value: any) => {
    setOrchestratorRules((prev: any[]) => prev.map((r: any, i: number) => i === index ? { ...r, [field]: value } : r))
  }

  const removeRule = (index: number) => {
    setOrchestratorRules((prev: any[]) => prev.filter((_: any, i: number) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/agents/${agent.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soul_md: soulMd,
          description,
          model,
          provider: providerId,
          skills,
          mcp_servers: mcpServers,
          handoff_enabled: handoffTargets.length > 0,
          handoff_targets: handoffTargets,
          orchestrator_enabled: orchestratorEnabled,
          orchestrator_rules: orchestratorRules,
        }),
      })
      onSave()
      onClose()
    } catch (err) {
      console.error('Save failed:', err)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    try {
      await fetch(`${API}/agents/${agent.name}`, { method: 'DELETE' })
      onDelete()
      onClose()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const agentColor = COLORS[agent.name.charCodeAt(0) % COLORS.length]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          ref={panelRef}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onClick={e => e.stopPropagation()}
          className="w-[480px] h-full bg-white shadow-2xl flex flex-col overflow-hidden"
          style={{ borderLeft: '4px solid #6366f1' }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${agentColor}15` }}>
                <Cpu size={20} weight="duotone" style={{ color: agentColor }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{name}</h2>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.status === 'idle' ? '#10b981' : agent.status === 'thinking' ? '#f59e0b' : '#ef4444' }} />
                  <span className="text-xs text-gray-500 capitalize">{agent.status}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Name & Description */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="agent-name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Description</label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="What does this agent do?"
                />
              </div>
            </div>

            {/* SOUL.md */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">SOUL.md</label>
              <textarea
                value={soulMd}
                onChange={e => setSoulMd(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                placeholder="# Agent Name&#10;&#10;You are a helpful assistant..."
              />
              <p className="text-xs text-gray-400 mt-1">Define the agent's persona, rules, and behavior.</p>
            </div>

            {/* Provider + Model */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Provider</label>
                <select
                  value={providerId}
                  onChange={e => { setProviderId(e.target.value); loadProviderModels(e.target.value) }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                >
                  <option value="">Use default (global .env)</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Model</label>
                <div className="flex gap-2">
                  {providerId ? (
                    <select
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    >
                      {providerModels.length > 0 ? (
                        providerModels.map(m => <option key={m} value={m}>{m}</option>)
                      ) : (
                        <option value={model}>{model}</option>
                      )}
                    </select>
                  ) : (
                    <input
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="model id (e.g. deepseek-chat)"
                    />
                  )}
                  <button
                    onClick={() => loadProviderModels(providerId)}
                    disabled={!providerId || fetchingModels}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <ArrowClockwise size={14} className={fetchingModels ? 'animate-spin' : ''} />
                    Fetch
                  </button>
                </div>
                {providerId && providerModels.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Click Fetch to load models from the provider endpoint.</p>
                )}
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Skills</label>
              <div className="grid grid-cols-2 gap-2">
                {availableSkills.length === 0 ? (
                  <p className="text-xs text-gray-400 col-span-2">No skills installed. Add SKILL.md folders under data/skills/.</p>
                ) : availableSkills.map(skill => {
                  const active = skills.includes(skill.name)
                  return (
                    <button
                      key={skill.name}
                      onClick={() => toggleSkill(skill.name)}
                      title={skill.description}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all text-left ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: active ? '#6366f1' : '#e5e7eb', color: active ? '#fff' : '#9ca3af' }}>
                        S
                      </span>
                      <span className="truncate">{skill.name}</span>
                      <span className="ml-auto text-[9px] text-gray-400 shrink-0">{skill.scripts?.length || 0} scripts</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* MCP Servers */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">MCP Servers</label>
              {availableMcpServers.length === 0 ? (
                <p className="text-xs text-gray-400">No MCP servers configured in data/mcp.json</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableMcpServers.map(server => {
                    const active = mcpServers.includes(server)
                    return (
                      <button
                        key={server}
                        onClick={() => toggleMcpServer(server)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                          active
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? '#6366f1' : '#9ca3af' }} />
                        {server}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Handoff */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Handoff Targets</label>
              {allAgents.filter(a => a.name !== agent.name).length === 0 ? (
                <p className="text-xs text-gray-400">No other agents available. Create more agents first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allAgents.filter(a => a.name !== agent.name).map(a => {
                    const active = handoffTargets.includes(a.name)
                    const color = COLORS[a.name.charCodeAt(0) % COLORS.length]
                    return (
                      <button
                        key={a.name}
                        onClick={() => toggleHandoffTarget(a.name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                          active
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        {a.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Orchestrator */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Orchestrator</label>
                <button
                  onClick={() => setOrchestratorEnabled(!orchestratorEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${orchestratorEnabled ? 'bg-indigo-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${orchestratorEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {orchestratorEnabled && (
                <div className="space-y-2">
                  {orchestratorRules.map((rule: any, i: number) => (
                    <div key={i} className="flex gap-2 items-start p-2 rounded-lg bg-gray-50 border border-gray-200">
                      <input
                        value={rule.match?.join(', ') || ''}
                        onChange={e => updateRule(i, 'match', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        className="flex-1 px-2 py-1 rounded border border-gray-300 text-xs text-gray-900"
                        placeholder="keywords (comma-separated)"
                      />
                      <span className="text-gray-400 text-xs py-1">→</span>
                      <select
                        value={rule.target || ''}
                        onChange={e => updateRule(i, 'target', e.target.value)}
                        className="px-2 py-1 rounded border border-gray-300 text-xs text-gray-900 bg-white"
                      >
                        <option value="">Select target</option>
                        {allAgents.filter(a => a.name !== agent.name).map(a => (
                          <option key={a.name} value={a.name}>{a.name}</option>
                        ))}
                      </select>
                      <button onClick={() => removeRule(i)} className="p-1 hover:bg-red-50 rounded text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button onClick={addOrchestratorRule} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                    + Add Rule
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash size={16} className="inline mr-1" />
                Delete
              </button>
              <div className="flex-1" />
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <FloppyDisk size={16} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Delete Confirmation */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                onClick={() => setShowDeleteConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Agent?</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    This will permanently delete <strong>{name}</strong> and all its configuration. This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
