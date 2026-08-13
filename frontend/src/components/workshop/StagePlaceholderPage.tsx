import { useState } from 'react'
import { Lock, Key } from '@phosphor-icons/react'
import type { LevelId } from '../../workshop/workshopUnlock'
import { STAGE_BY_ID } from '../../workshop/stages'
import { workshopColors as c } from './workshopTheme'

type Props = {
  stageId: LevelId
  locked: boolean
  canTryUnlock: boolean
  onUnlock: (password: string) => Promise<'ok' | 'bad' | 'blocked'>
}

export default function StagePlaceholderPage({ stageId, locked, canTryUnlock, onUnlock }: Props) {
  const stage = STAGE_BY_ID[stageId]
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw.trim() || busy) return
    setBusy(true)
    setErr(false)
    const r = await onUnlock(pw)
    setBusy(false)
    if (r === 'ok') setPw('')
    else if (r === 'bad') setErr(true)
  }

  return (
    <article className="space-y-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: c.primary }}>
          Stage {stage.index}
        </p>
        <h1 className="text-xl font-bold" style={{ color: c.text }}>
          {stage.title}
        </h1>
        <p className="text-sm mt-1" style={{ color: c.textSecondary }}>
          Instructions for this stage are coming soon.
        </p>
      </header>

      {locked ? (
        <section
          className="rounded-2xl border-2 p-4 sm:p-5"
          style={{ backgroundColor: c.surface, borderColor: c.border }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Lock size={18} weight="duotone" style={{ color: c.textMuted }} />
            <h2 className="text-sm font-semibold" style={{ color: c.text }}>
              Locked
            </h2>
          </div>
          {!canTryUnlock ? (
            <p className="text-sm" style={{ color: c.textSecondary }}>
              Finish the previous stage and get the room code from your facilitator.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3 max-w-sm">
              <label className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: c.textMuted }}>
                <Key size={12} /> Room code
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={pw}
                  onChange={e => { setPw(e.target.value); setErr(false) }}
                  placeholder="Enter unlock phrase"
                  className="flex-1 px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: err ? c.rose : c.border, color: c.text }}
                />
                <button
                  type="submit"
                  disabled={busy || !pw.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: c.primary }}
                >
                  Unlock
                </button>
              </div>
              {err && (
                <p className="text-xs" style={{ color: c.rose }}>
                  Wrong code. Try again.
                </p>
              )}
            </form>
          )}
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {['Objectives', 'Walkthrough', 'Checkpoint'].map(label => (
            <div
              key={label}
              className="rounded-2xl border-2 border-dashed p-4 min-h-[120px]"
              style={{ borderColor: c.border, backgroundColor: c.surface }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: c.textMuted }}>
                {label}
              </p>
              <p className="text-xs" style={{ color: c.textMuted }}>
                Content TBD
              </p>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
