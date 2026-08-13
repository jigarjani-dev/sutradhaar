import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { X, Plus, Lightbulb, CaretRight, CaretDown, CheckCircle, WarningCircle, PlugsConnected, Trash, FileCode } from '@phosphor-icons/react'

const API = '/api'

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
}

interface SkillsPanelProps {
  onClose: () => void
  embedded?: boolean
}

export default function SkillsPanel({ onClose, embedded }: SkillsPanelProps) {
  const [skills, setSkills] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [mcpConfig, setMcpConfig] = useState<{ servers: Record<string, any> }>({ servers: {} })
  const [mcpTools, setMcpTools] = useState<any[]>([])
  const [mcpStatus, setMcpStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showAddMcp, setShowAddMcp] = useState(false)
  const [mcpForm, setMcpForm] = useState({ name: '', command: '', args: '', url: '' })
  const [savingMcp, setSavingMcp] = useState(false)
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [skillForm, setSkillForm] = useState({ name: '', description: '', body: '' })
  const [savingSkill, setSavingSkill] = useState(false)
  const [skillStatus, setSkillStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  const loadSkills = async () => {
    try {
      const res = await fetch(`${API}/skills`)
      setSkills(await res.json())
    } catch (err) { console.error('load skills failed', err) }
  }

  const loadAgents = async () => {
    try {
      const res = await fetch(`${API}/agents`)
      setAgents(await res.json())
    } catch (err) { console.error('load agents failed', err) }
  }

  const loadMcp = async () => {
    try {
      const [cfgRes, toolsRes] = await Promise.all([
        fetch(`${API}/mcp/config`),
        fetch(`${API}/mcp/servers`),
      ])
      setMcpConfig(await cfgRes.json())
      const td = await toolsRes.json()
      setMcpTools(td.tools || [])
    } catch (err) { console.error('load mcp failed', err) }
  }

  useEffect(() => { loadSkills(); loadAgents(); loadMcp() }, [])

  const agentsUsingSkill = (skillName: string) =>
    agents.filter(a => (a.skills || []).includes(skillName)).map(a => a.name)

  const handleSaveMcp = async () => {
    if (!mcpForm.name) return
    setSavingMcp(true)
    setMcpStatus(null)
    const server: Record<string, any> = {}
    const url = mcpForm.url.trim()
    if (mcpForm.url) {
      // Streamable HTTP mode (url field shown; stub "http://" means not filled yet)
      if (!url || url === 'http://') {
        setMcpStatus({ ok: false, msg: 'Enter a Streamable HTTP MCP URL.' })
        setSavingMcp(false)
        return
      }
      server.url = url
    } else {
      server.command = mcpForm.command || 'npx'
      server.args = mcpForm.args ? mcpForm.args.split(' ').filter(Boolean) : []
    }
    const updated = { ...mcpConfig.servers, [mcpForm.name]: server }
    try {
      const res = await fetch(`${API}/mcp/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers: updated }),
      })
      const data = await res.json()
      setMcpConfig(data)
      setMcpStatus({ ok: true, msg: 'Saved. Reconnected MCP servers.' })
      setShowAddMcp(false)
      setMcpForm({ name: '', command: '', args: '', url: '' })
      await loadMcp()
    } catch (err: any) {
      setMcpStatus({ ok: false, msg: String(err?.message || err) })
    }
    setSavingMcp(false)
  }

  const handleCreateSkill = async () => {
    if (!skillForm.name.trim()) return
    setSavingSkill(true)
    setSkillStatus(null)
    try {
      const res = await fetch(`${API}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: skillForm.name,
          description: skillForm.description,
          body: skillForm.body,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSkillStatus({ ok: false, msg: data.detail || 'Failed to create skill' })
        setSavingSkill(false)
        return
      }
      setSkillStatus({ ok: true, msg: `Created skill "${data.name}".` })
      setShowAddSkill(false)
      setSkillForm({ name: '', description: '', body: '' })
      await loadSkills()
      setExpanded(data.name)
    } catch (err: any) {
      setSkillStatus({ ok: false, msg: String(err?.message || err) })
    }
    setSavingSkill(false)
  }

  const handleDeleteSkill = async (name: string) => {
    const usedBy = agentsUsingSkill(name)
    const extra = usedBy.length ? `\n\nStill listed on agents: ${usedBy.join(', ')}. Remove it from those agents after delete.` : ''
    if (!window.confirm(`Delete skill "${name}" from data/skills/?${extra}`)) return
    try {
      const res = await fetch(`${API}/skills/${encodeURIComponent(name)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSkillStatus({ ok: false, msg: data.detail || 'Failed to delete skill' })
        return
      }
      setSkillStatus({ ok: true, msg: `Deleted "${name}".` })
      if (expanded === name) setExpanded(null)
      await loadSkills()
    } catch (err: any) {
      setSkillStatus({ ok: false, msg: String(err?.message || err) })
    }
  }

  const handleRemoveMcp = async (name: string) => {
    if (!window.confirm(`Remove MCP server "${name}"?`)) return
    const updated = { ...mcpConfig.servers }
    delete updated[name]
    const res = await fetch(`${API}/mcp/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servers: updated }),
    })
    setMcpConfig(await res.json())
    await loadMcp()
  }

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all`

  const header = (
    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#6366f115' }}>
          <Lightbulb size={20} weight="duotone" style={{ color: '#6366f1' }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Skills & MCP</h2>
          <p className="text-xs text-gray-500">SKILL.md packages and Model Context Protocol servers</p>
        </div>
      </div>
      {!embedded && (
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X size={20} className="text-gray-500" />
        </button>
      )}
    </div>
  )

  const body = (
    <div className={embedded ? 'space-y-6' : 'flex-1 overflow-y-auto px-6 py-4 space-y-6'}>
      {/* Skills section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: colors.text }}>Installed Skills</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: colors.textMuted }}>{skills.length} total · data/skills/</span>
            <button onClick={() => setShowAddSkill(o => !o)} className="text-xs font-medium px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: colors.primary }}>
              <Plus size={12} weight="bold" className="inline mr-0.5" /> Add skill
            </button>
          </div>
        </div>

        {skillStatus && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-2" style={{ backgroundColor: skillStatus.ok ? '#ecfdf5' : '#fef2f2', color: skillStatus.ok ? '#059669' : '#dc2626' }}>
            {skillStatus.ok ? <CheckCircle size={14} weight="bold" /> : <WarningCircle size={14} weight="bold" />}
            {skillStatus.msg}
          </div>
        )}

        {showAddSkill && (
          <div className="rounded-2xl border-2 p-4 space-y-3 mb-3" style={{ borderColor: colors.primary, backgroundColor: '#fafaff' }}>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input value={skillForm.name} onChange={e => setSkillForm({ ...skillForm, name: e.target.value.toLowerCase().replace(/\s+/g, '-') })} className={inputCls} placeholder="my-skill" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input value={skillForm.description} onChange={e => setSkillForm({ ...skillForm, description: e.target.value })} className={inputCls} placeholder="What this skill does and when to use it" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Instructions (markdown body, optional)</label>
              <textarea value={skillForm.body} onChange={e => setSkillForm({ ...skillForm, body: e.target.value })} className={`${inputCls} min-h-[100px] font-mono text-xs`} placeholder="# My skill&#10;&#10;Steps for the agent..." />
            </div>
            <p className="text-[10px] text-gray-500">Creates data/skills/&lt;name&gt;/SKILL.md and an empty scripts/ folder. Add scripts on disk or copy from another skill.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowAddSkill(false); setSkillForm({ name: '', description: '', body: '' }) }} className="flex-1 px-3 py-2 rounded-lg text-sm text-gray-700 bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button onClick={handleCreateSkill} disabled={savingSkill || !skillForm.name.trim()} className="flex-1 px-3 py-2 rounded-lg text-sm text-white disabled:opacity-50" style={{ backgroundColor: colors.primary }}>
                {savingSkill ? 'Creating...' : 'Create skill'}
              </button>
            </div>
          </div>
        )}

        {skills.length === 0 && !showAddSkill ? (
          <p className="text-sm text-gray-400">No skills installed. Use Add skill above.</p>
        ) : skills.length === 0 ? null : (
          <div className="space-y-2">
            {skills.map(s => {
              const isOpen = expanded === s.name
              const usedBy = agentsUsingSkill(s.name)
              return (
                <div key={s.name} className="rounded-2xl border-2 transition-colors" style={{ borderColor: isOpen ? colors.primary : colors.border, backgroundColor: colors.surface }}>
                  <div className="flex items-center gap-1 pr-2">
                  <button onClick={() => setExpanded(isOpen ? null : s.name)} className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0">
                    {isOpen ? <CaretDown size={14} style={{ color: colors.textMuted }} /> : <CaretRight size={14} style={{ color: colors.textMuted }} />}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: colors.primaryLight }}>
                      <Lightbulb size={15} weight="duotone" style={{ color: colors.primary }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500 truncate">{s.description}</div>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">{s.scripts?.length || 0} scripts</span>
                    {usedBy.length > 0 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: colors.primaryLight, color: colors.primary }}>
                        used by {usedBy.join(', ')}
                      </span>
                    )}
                  </button>
                  <button type="button" onClick={() => handleDeleteSkill(s.name)} className="p-1.5 hover:bg-red-50 rounded text-red-500 shrink-0" title="Delete skill">
                    <Trash size={14} />
                  </button>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100">
                      <div className="pt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="text-gray-500">Name</div><div className="text-gray-900 font-mono">{s.name}</div>
                        <div className="text-gray-500">License</div><div className="text-gray-900">{s.license || '—'}</div>
                        <div className="text-gray-500">Location</div><div className="text-gray-900 font-mono text-[10px] truncate">{s.path}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Scripts</div>
                        <div className="flex flex-wrap gap-1">
                          {(s.scripts || []).map((sc: string) => (
                            <span key={sc} className="px-2 py-0.5 rounded-full text-[10px] font-mono border flex items-center gap-1" style={{ borderColor: colors.border, color: colors.textSecondary, backgroundColor: colors.bg }}>
                              <FileCode size={10} /> {sc}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">SKILL.md instructions</div>
                        <pre className="p-3 rounded-xl border text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto" style={{ borderColor: colors.border, backgroundColor: colors.bg, color: colors.textSecondary }}>
                          {s.body}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MCP section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: colors.text }}>
            <PlugsConnected size={15} style={{ color: colors.primary }} /> MCP Servers
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: colors.textMuted }}>{mcpTools.length} tools</span>
            <button onClick={() => setShowAddMcp(o => !o)} className="text-xs font-medium px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: colors.primary }}>
              <Plus size={12} weight="bold" className="inline mr-0.5" /> Add server
            </button>
          </div>
        </div>

        {mcpStatus && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-2" style={{ backgroundColor: mcpStatus.ok ? '#ecfdf5' : '#fef2f2', color: mcpStatus.ok ? '#059669' : '#dc2626' }}>
            {mcpStatus.ok ? <CheckCircle size={14} weight="bold" /> : <WarningCircle size={14} weight="bold" />}
            {mcpStatus.msg}
          </div>
        )}

        {showAddMcp && (
          <div className="rounded-2xl border-2 p-4 space-y-3 mb-3" style={{ borderColor: colors.primary, backgroundColor: '#fafaff' }}>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input value={mcpForm.name} onChange={e => setMcpForm({ ...mcpForm, name: e.target.value.toLowerCase().replace(/\s+/g, '-') })} className={inputCls} placeholder="filesystem" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <div className="flex gap-2">
                <button onClick={() => setMcpForm({ ...mcpForm, url: '' })} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border-2 ${!mcpForm.url ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>stdio (local)</button>
                <button onClick={() => setMcpForm({ ...mcpForm, command: '', args: '', url: mcpForm.url || 'http://' })} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border-2 ${mcpForm.url ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>Streamable HTTP</button>
              </div>
            </div>
            {mcpForm.url ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
                <input value={mcpForm.url} onChange={e => setMcpForm({ ...mcpForm, url: e.target.value })} className={inputCls} placeholder="http://host:8000/mcp" />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Command</label>
                  <input value={mcpForm.command} onChange={e => setMcpForm({ ...mcpForm, command: e.target.value })} className={inputCls} placeholder="npx" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Args</label>
                  <input value={mcpForm.args} onChange={e => setMcpForm({ ...mcpForm, args: e.target.value })} className={inputCls} placeholder="-y @modelcontextprotocol/server-filesystem /data" />
                </div>
              </>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowAddMcp(false); setMcpForm({ name: '', command: '', args: '', url: '' }) }} className="flex-1 px-3 py-2 rounded-lg text-sm text-gray-700 bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button onClick={handleSaveMcp} disabled={savingMcp || !mcpForm.name} className="flex-1 px-3 py-2 rounded-lg text-sm text-white disabled:opacity-50" style={{ backgroundColor: colors.primary }}>
                {savingMcp ? 'Saving...' : 'Save server'}
              </button>
            </div>
          </div>
        )}

        {Object.keys(mcpConfig.servers).length === 0 && !showAddMcp ? (
          <p className="text-sm text-gray-400">No MCP servers configured. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(mcpConfig.servers).map(([name, s]: [string, any]) => {
              const serverTools = mcpTools.filter(t => t.function?.name?.startsWith(`mcp__${name}__`))
              const isHttp = !!s.url
              return (
                <div key={name} className="rounded-2xl border-2 p-3" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: colors.primaryLight }}>
                      <PlugsConnected size={15} weight="duotone" style={{ color: colors.primary }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900">{name}</div>
                      <div className="text-[11px] font-mono text-gray-500 truncate">{isHttp ? s.url : `${s.command} ${(s.args || []).join(' ')}`}</div>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400">{serverTools.length} tools</span>
                    <button onClick={() => handleRemoveMcp(name)} className="p-1.5 hover:bg-red-50 rounded text-red-500">
                      <Trash size={14} />
                    </button>
                  </div>
                  {serverTools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t" style={{ borderColor: colors.border }}>
                      {serverTools.map(t => (
                        <span key={t.function.name} className="px-2 py-0.5 rounded-full text-[9px] font-mono border" style={{ borderColor: colors.border, color: colors.textSecondary, backgroundColor: colors.bg }}>
                          {t.function.name.replace(`mcp__${name}__`, '')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  if (embedded) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8f9fa' }}>
        {header}
        <div className="flex-1 overflow-y-auto px-6 py-4 max-w-3xl w-full mx-auto">
          {body}
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} onClick={e => e.stopPropagation()} className="w-[640px] h-full bg-white shadow-2xl flex flex-col overflow-hidden" style={{ borderLeft: '4px solid #6366f1' }}>
        {header}
        {body}
      </motion.div>
    </motion.div>
  )
}
