import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { X, Plus, PlugsConnected, CaretRight, CaretDown, CheckCircle, WarningCircle } from '@phosphor-icons/react'

const API = '/api'

const PRESET_CARDS = [
  { id: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1', models: [] },
  { id: 'anthropic', name: 'Anthropic Claude', base_url: 'https://api.anthropic.com/v1/', models: ['claude-sonnet-4-6', 'claude-haiku-4-5'] },
  { id: 'deepseek', name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', models: [] },
  { id: 'opencode-zen', name: 'OpenCode Zen', base_url: 'https://opencode.ai/zen/v1', models: [] },
  { id: 'opencode-go', name: 'OpenCode Go', base_url: 'https://opencode.ai/zen/go/v1', models: [] },
]

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

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

interface ProvidersPanelProps {
  onClose: () => void
}

export default function ProvidersPanel({ onClose }: ProvidersPanelProps) {
  const [providers, setProviders] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string } | undefined>>({})
  const [fetching, setFetching] = useState<string | null>(null)
  const [editing, setEditing] = useState<any>(null)

  const load = async () => {
    try {
      const res = await fetch(`${API}/providers`)
      const data = await res.json()
      setProviders(data)
    } catch (err) {
      console.error('Failed to load providers:', err)
    }
  }

  useEffect(() => { load() }, [])

  const handleTest = async (pid: string) => {
    setTesting(pid)
    setTestResult(prev => ({ ...prev, [pid]: undefined }))
    try {
      const res = await fetch(`${API}/providers/${pid}/test`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setTestResult(prev => ({ ...prev, [pid]: { ok: true, msg: `Connected · ${data.models?.length || 0} models` } }))
      } else {
        const detail = await res.json().catch(() => ({}))
        setTestResult(prev => ({ ...prev, [pid]: { ok: false, msg: detail.detail || 'Connection failed' } }))
      }
    } catch (err: any) {
      setTestResult(prev => ({ ...prev, [pid]: { ok: false, msg: String(err?.message || err) } }))
    }
    setTesting(null)
  }

  const handleFetch = async (pid: string) => {
    setFetching(pid)
    try {
      const res = await fetch(`${API}/providers/${pid}/fetch-models`, { method: 'POST' })
      const data = await res.json()
      setTestResult(prev => ({ ...prev, [pid]: { ok: true, msg: `Fetched ${data.models?.length || 0} models` } }))
      await load()
    } catch (err: any) {
      setTestResult(prev => ({ ...prev, [pid]: { ok: false, msg: String(err?.message || err) } }))
    }
    setFetching(null)
  }

  const handleSave = async () => {
    if (!editing.id || !editing.base_url) return
    try {
      const body = {
        id: editing.id,
        name: editing.name || editing.id,
        base_url: editing.base_url,
        api_key: editing.api_key || '',
        protocol: 'openai-completions',
        auto_fetch: true,
      }
      const existing = providers.find(p => p.id === editing.id)
      const url = existing ? `${API}/providers/${editing.id}` : `${API}/providers`
      await fetch(url, {
        method: existing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setEditing(null)
      setAdding(false)
      await load()
    } catch (err) {
      console.error('Failed to save provider:', err)
    }
  }

  const handleDelete = async (pid: string) => {
    if (!window.confirm(`Delete provider "${pid}"?`)) return
    try {
      await fetch(`${API}/providers/${pid}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      console.error('Failed to delete provider:', err)
    }
  }

  const startEdit = (p: any) => {
    setEditing({ id: p.id, name: p.name, base_url: p.base_url, api_key: '' })
    setAdding(true)
  }

  const startPreset = (p: any) => {
    setEditing({ id: p.id, name: p.name, base_url: p.base_url, api_key: '' })
    setAdding(true)
  }

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all`

  return (
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
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={e => e.stopPropagation()}
        className="w-[560px] h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{ borderLeft: '4px solid #6366f1' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#6366f115' }}>
              <PlugsConnected size={20} weight="duotone" style={{ color: '#6366f1' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Model Providers</h2>
              <p className="text-xs text-gray-500">OpenAI, Claude, DeepSeek, OpenCode Go/Zen, custom</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {providers.length === 0 && !adding && (
            <p className="text-sm text-gray-400">No providers yet. Add one below.</p>
          )}

          {providers.map(p => {
            const isOpen = expanded === p.id
            const tr = testResult[p.id]
            return (
              <div key={p.id} className="rounded-2xl border-2 transition-colors" style={{ borderColor: isOpen ? '#6366f1' : colors.border, backgroundColor: colors.surface }}>
                <button onClick={() => setExpanded(isOpen ? null : p.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  {isOpen ? <CaretDown size={14} style={{ color: colors.textMuted }} /> : <CaretRight size={14} style={{ color: colors.textMuted }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">{p.name}</span>
                      {p.has_key && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primaryLight, color: colors.primary }}>key set</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{p.base_url}</div>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">{p.models?.length || 0} models</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-2 pt-3">
                      <div className="text-xs text-gray-500">ID</div>
                      <div className="text-xs text-gray-900 font-mono">{p.id}</div>
                      <div className="text-xs text-gray-500">API key</div>
                      <div className="text-xs text-gray-900 font-mono">{p.api_key || 'not set'}</div>
                      <div className="text-xs text-gray-500">Created</div>
                      <div className="text-xs text-gray-900">{formatDate(p.created_at)}</div>
                    </div>

                    {tr && (
                      <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: tr.ok ? '#ecfdf5' : '#fef2f2', color: tr.ok ? '#059669' : '#dc2626' }}>
                        {tr.ok ? <CheckCircle size={14} weight="bold" /> : <WarningCircle size={14} weight="bold" />}
                        <span className="truncate">{tr.msg}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleTest(p.id)} disabled={testing === p.id}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50">
                        {testing === p.id ? 'Testing...' : 'Test connection'}
                      </button>
                      <button onClick={() => handleFetch(p.id)} disabled={fetching === p.id}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50">
                        {fetching === p.id ? 'Fetching...' : 'Fetch models'}
                      </button>
                      <button onClick={() => startEdit(p)} className="px-3 py-2 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Edit</button>
                      <button onClick={() => handleDelete(p.id)} className="px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {adding && editing ? (
            <div className="rounded-2xl border-2 p-4 space-y-3" style={{ borderColor: colors.primary, backgroundColor: '#fafaff' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{providers.find(p => p.id === editing.id) ? `Edit ${editing.id}` : 'Add Provider'}</h3>
                <button onClick={() => { setAdding(false); setEditing(null) }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ID</label>
                <input value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })} className={inputCls} placeholder="my-provider" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className={inputCls} placeholder="My Provider" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Base URL</label>
                <input value={editing.base_url} onChange={e => setEditing({ ...editing, base_url: e.target.value })} className={inputCls} placeholder="https://.../v1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                <input type="password" value={editing.api_key} onChange={e => setEditing({ ...editing, api_key: e.target.value })} className={inputCls} placeholder="sk-..." />
                <p className="text-[10px] text-gray-400 mt-1">Leave blank to keep the existing key. Local servers (Ollama) can use "ollama".</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setAdding(false); setEditing(null) }} className="flex-1 px-3 py-2 rounded-lg text-sm text-gray-700 bg-gray-100 hover:bg-gray-200">Cancel</button>
                <button onClick={handleSave} className="flex-1 px-3 py-2 rounded-lg text-sm text-white bg-indigo-500 hover:bg-indigo-600">Save Provider</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setEditing({ id: '', name: '', base_url: '', api_key: '' }) }}
              className="w-full py-3 rounded-2xl border-2 border-dashed text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
              style={{ borderColor: colors.border }}>
              <Plus size={16} weight="bold" /> Add custom provider
            </button>
          )}
        </div>

        {/* Presets footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_CARDS.map(p => (
              <button key={p.id} onClick={() => startPreset(p)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border-2 text-gray-600 bg-white hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                style={{ borderColor: colors.border }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
