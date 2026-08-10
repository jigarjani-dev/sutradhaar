import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { PaperPlaneTilt, X, CheckCircle, WarningCircle } from '@phosphor-icons/react'

const API = '/api'

export type TelegramPublicStatus = {
  connected: boolean
  status: string
  bot_username: string | null
  allowed_chat_ids: number[]
  has_token?: boolean
}

type Props = {
  agentName: string
  open: boolean
  onClose: () => void
  onStatusChange: (status: TelegramPublicStatus) => void
}

export default function TelegramMessengerModal({
  agentName,
  open,
  onClose,
  onStatusChange,
}: Props) {
  const [status, setStatus] = useState<TelegramPublicStatus | null>(null)
  const [token, setToken] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !agentName) return
    setError('')
    setHint('')
    setToken('')
    fetch(`${API}/agents/${encodeURIComponent(agentName)}/telegram`)
      .then(r => r.json())
      .then(data => {
        setStatus(data)
        onStatusChange(data)
      })
      .catch(() => setError('Could not load Telegram status'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when modal opens for this agent
  }, [open, agentName])

  if (!open) return null

  const saveToken = async () => {
    if (!token.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${API}/agents/${encodeURIComponent(agentName)}/telegram`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        let msg = 'Failed to save token'
        if (res.status === 404) {
          msg = 'Telegram API not available. Restart the gateway (uvicorn) and hard-refresh the page.'
        } else if (typeof data.detail === 'string') {
          msg = data.detail
        } else if (Array.isArray(data.detail)) {
          msg = data.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ') || msg
        }
        throw new Error(msg)
      }
      setStatus(data)
      setHint(data.hint || '')
      onStatusChange(data)
      setToken('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
    setBusy(false)
  }

  const disconnect = async () => {
    if (busy || !window.confirm(`Disconnect Telegram from ${agentName}?`)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${API}/agents/${encodeURIComponent(agentName)}/telegram`, {
        method: 'DELETE',
      })
      const data = await res.json()
      setStatus(data)
      setHint('')
      onStatusChange(data)
    } catch {
      setError('Disconnect failed')
    }
    setBusy(false)
  }

  const connected = status?.connected
  const pending = status?.has_token && !connected

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-200"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <PaperPlaneTilt size={22} weight="duotone" className="text-sky-500" />
            <div>
              <h3 className="font-bold text-slate-900">Telegram messenger</h3>
              <p className="text-xs text-slate-500">Agent: {agentName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>

        <ol className="text-xs text-slate-600 space-y-1.5 mb-4 list-decimal list-inside">
          <li>Open Telegram and chat with <strong>@BotFather</strong>.</li>
          <li>Run <code className="bg-slate-100 px-1 rounded">/newbot</code> and copy the token.</li>
          <li>Paste the token below (one bot per agent).</li>
          <li>Send any message to your bot to finish linking.</li>
        </ol>

        {connected && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">
            <CheckCircle size={18} weight="fill" />
            Connected{status?.bot_username ? ` as @${status.bot_username}` : ''}
          </div>
        )}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
            <WarningCircle size={18} weight="fill" />
            Waiting for your first message to @{status?.bot_username || 'your bot'}
          </div>
        )}

        {hint && (
          <p className="text-xs text-slate-600 mb-3 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{hint}</p>
        )}
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bot token</label>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="123456789:ABC..."
          className="w-full mt-1 mb-3 px-3 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-200"
          autoComplete="off"
        />

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !token.trim()}
            onClick={saveToken}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-sky-500 disabled:opacity-40"
          >
            {status?.has_token ? 'Update token' : 'Save token'}
          </button>
          {status?.has_token && (
            <button
              type="button"
              disabled={busy}
              onClick={disconnect}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200"
            >
              Disconnect
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
