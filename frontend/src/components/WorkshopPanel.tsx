import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Lock, CheckCircle, Flask, Sword, Shield, Star,
  Key, Trophy, CaretDown, Sparkle, Target, WarningCircle,
} from '@phosphor-icons/react'
import {
  type LevelId,
  loadUnlocked,
  saveUnlocked,
  loadChecks,
  saveChecks,
  canAttemptUnlock,
  verifyLevelPassword,
  verifyMasterPassword,
  unlockAll,
  levelProgress,
  visualStates,
} from '../workshop/workshopUnlock'

const C = {
  void: '#070b12',
  panel: '#0c1220',
  grid: 'rgba(56, 189, 248, 0.06)',
  gold: '#fbbf24',
  goldDim: '#b45309',
  cyan: '#22d3ee',
  locked: '#334155',
}

const LEVELS = [
  {
    id: 'baseline' as LevelId,
    title: 'Boot the Lab',
    codename: 'INIT',
    xp: 100,
    subtitle: 'Gateway online · first chat · SOUL.md',
    steps: ['Start gateway', 'Chat with demo', 'Create custom agent'],
    nugget: 'Agents are folders: SOUL + yaml, not magic.',
    needsCode: false,
  },
  {
    id: 'lakshmi' as LevelId,
    title: 'Memory Vault',
    codename: 'LAKSHMI',
    xp: 250,
    subtitle: 'Finance coach with zero tools',
    steps: ['Log ₹ expenses', 'Recall totals', 'Refuse Google Sheets'],
    nugget: 'Thread memory beats tool spam for workshop trust.',
    needsCode: true,
  },
  {
    id: 'a2a' as LevelId,
    title: 'Wire the Network',
    codename: 'A2A',
    xp: 400,
    subtitle: 'Agent cards · handoff · synthesis',
    steps: ['Flip A2A card JSON', 'Set handoff targets', 'Watch pipeline handoff'],
    nugget: 'Handoff = worker runs, requester speaks to the user.',
    needsCode: true,
  },
  {
    id: 'orchestrator' as LevelId,
    title: 'One Door',
    codename: 'ORCH',
    xp: 600,
    subtitle: 'Route by rules + descriptions',
    steps: ['Keyword rules', 'Description routing', 'Chat via orchestrator'],
    nugget: 'Orchestrator only sees handoff targets, not every agent.',
    needsCode: true,
  },
]

const stepCounts = Object.fromEntries(LEVELS.map(l => [l.id, l.steps.length])) as Record<LevelId, number>

function stateStyles(state: ReturnType<typeof visualStates>[LevelId]) {
  if (state === 'cleared') return { ring: C.gold, glow: 'rgba(251, 191, 36, 0.5)', badge: 'CLEARED' }
  if (state === 'current') return { ring: C.cyan, glow: 'rgba(34, 211, 238, 0.55)', badge: 'ACTIVE' }
  if (state === 'active') return { ring: '#818cf8', glow: 'transparent', badge: 'OPEN' }
  return { ring: C.locked, glow: 'transparent', badge: 'LOCKED' }
}

interface WorkshopPanelProps {
  onOpenPlayground: () => void
}

function UnlockBox({
  canTry,
  onUnlock,
}: {
  canTry: boolean
  onUnlock: (pw: string) => Promise<'ok' | 'bad' | 'blocked'>
}) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!pw.trim() || busy) return
    setBusy(true)
    setErr(false)
    const r = await onUnlock(pw)
    setBusy(false)
    if (r === 'ok') setPw('')
    else if (r === 'bad') setErr(true)
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
      {!canTry ? (
        <p className="text-[10px] text-slate-500 flex items-center gap-1">
          <Lock size={12} /> Clear the previous level first
        </p>
      ) : (
        <>
          <label className="text-[9px] font-mono uppercase tracking-widest text-amber-400/80 flex items-center gap-1">
            <Key size={10} /> Room code
          </label>
          <div className="flex gap-2">
            <motion.input
              animate={err ? { x: [0, -6, 6, -4, 4, 0] } : {}}
              transition={{ duration: 0.4 }}
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setErr(false) }}
              placeholder="Enter unlock phrase"
              className="flex-1 px-3 py-2 rounded-lg text-xs text-white placeholder:text-slate-600 border bg-black/30 outline-none focus:border-cyan-500/50"
              style={{ borderColor: err ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.1)' }}
            />
            <button
              type="submit"
              disabled={busy || !pw.trim()}
              className="px-3 py-2 rounded-lg text-xs font-bold text-stone-900 disabled:opacity-40"
              style={{ background: `linear-gradient(180deg, ${C.gold}, ${C.goldDim})` }}
            >
              Unlock
            </button>
          </div>
          {err && (
            <p className="text-[10px] text-red-400 flex items-center gap-1">
              <WarningCircle size={12} /> Wrong code — try again
            </p>
          )}
        </>
      )}
    </form>
  )
}

export default function WorkshopPanel({ onOpenPlayground }: WorkshopPanelProps) {
  const [unlocked, setUnlocked] = useState<Set<LevelId>>(() => loadUnlocked())
  const [checks, setChecks] = useState(() => loadChecks(stepCounts))
  const [expanded, setExpanded] = useState<string | null>('baseline')
  const [masterPw, setMasterPw] = useState('')
  const [masterErr, setMasterErr] = useState(false)
  const [showMaster, setShowMaster] = useState(false)

  useEffect(() => {
    saveUnlocked(unlocked)
  }, [unlocked])

  useEffect(() => {
    saveChecks(checks)
  }, [checks])

  const visuals = useMemo(() => visualStates(unlocked, checks, stepCounts), [unlocked, checks])

  const totalXp = LEVELS.reduce((s, l) => s + l.xp, 0)
  const earnedXp = LEVELS.filter(l => visuals[l.id] === 'cleared').reduce((s, l) => s + l.xp, 0)
  const progress = Math.round((earnedXp / totalXp) * 100)

  const toggleCheck = useCallback((levelId: LevelId, index: number) => {
    setChecks(prev => {
      const row = [...(prev[levelId] || Array(stepCounts[levelId]).fill(false))]
      row[index] = !row[index]
      return { ...prev, [levelId]: row }
    })
  }, [])

  const tryUnlockLevel = useCallback(async (levelId: LevelId, password: string) => {
    if (!canAttemptUnlock(levelId, unlocked)) return 'blocked' as const
    const ok = await verifyLevelPassword(levelId, password)
    if (!ok) return 'bad' as const
    setUnlocked(prev => new Set([...prev, levelId]))
    setExpanded(levelId)
    return 'ok' as const
  }, [unlocked])

  const tryMaster = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await verifyMasterPassword(masterPw)
    if (ok) {
      setUnlocked(unlockAll())
      setMasterErr(false)
      setMasterPw('')
      setShowMaster(false)
    } else {
      setMasterErr(true)
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative" style={{ backgroundColor: C.void }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, ${C.gold} 0%, transparent 65%)` }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.22, 0.15] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative shrink-0 px-4 sm:px-8 py-5 border-b border-white/5">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="relative w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(145deg, ${C.goldDim}, ${C.gold})` }}
              animate={{ rotate: [0, 2, -2, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Sword size={24} weight="duotone" className="text-stone-900" />
            </motion.div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-400/80">Campaign</p>
              <h2 className="text-lg font-bold text-white tracking-tight">Sutradhaar CTF</h2>
            </div>
          </div>

          <div className="flex-1 max-w-xs">
            <div className="flex justify-between text-[10px] font-mono mb-1">
              <span className="text-slate-400">XP {earnedXp} / {totalXp}</span>
              <span className="text-amber-300">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden border border-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${C.goldDim}, ${C.gold}, ${C.cyan})` }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onOpenPlayground}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white border border-indigo-400/30"
            style={{ background: 'linear-gradient(180deg, #6366f1 0%, #4338ca 100%)' }}
          >
            <Flask size={18} weight="duotone" />
            Enter Playground
          </motion.button>
        </div>

        <div className="max-w-3xl mx-auto mt-3">
          <button
            type="button"
            onClick={() => setShowMaster(s => !s)}
            className="text-[10px] font-mono text-slate-500 hover:text-amber-400/80 uppercase tracking-widest"
          >
            {showMaster ? '− Hide master key' : '+ Master key (unlock all)'}
          </button>
          <AnimatePresence>
            {showMaster && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={tryMaster}
                className="flex gap-2 mt-2 overflow-hidden"
              >
                <input
                  type="password"
                  value={masterPw}
                  onChange={e => { setMasterPw(e.target.value); setMasterErr(false) }}
                  placeholder="Master phrase"
                  className="flex-1 max-w-xs px-3 py-1.5 rounded-lg text-xs text-white border bg-black/30 border-white/10"
                />
                <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-bold text-stone-900 bg-amber-400">
                  Unlock all
                </button>
                {masterErr && <span className="text-xs text-red-400 self-center">Nope</span>}
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-4 sm:px-8 py-8">
        <div className="max-w-2xl mx-auto relative">
          <div
            className="absolute left-[27px] sm:left-[31px] top-8 bottom-8 w-0.5 rounded-full"
            style={{ background: `linear-gradient(180deg, ${C.gold} 0%, ${C.cyan} 35%, ${C.locked} 100%)` }}
          />

          <ul className="space-y-6 relative">
            {LEVELS.map((level, i) => {
              const state = visuals[level.id]
              const st = stateStyles(state)
              const isOpen = expanded === level.id
              const isLocked = state === 'locked'
              const prog = levelProgress(checks, level.id, level.steps.length)

              return (
                <motion.li
                  key={level.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i, type: 'spring', stiffness: 120 }}
                >
                  <div className="flex gap-4 sm:gap-5">
                    <div className="relative z-10 shrink-0 pt-1">
                      <motion.div
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center border-2 font-mono text-[10px] font-bold"
                        style={{
                          borderColor: st.ring,
                          backgroundColor: C.panel,
                          boxShadow: state === 'current' ? `0 0 24px ${st.glow}` : 'none',
                        }}
                        animate={
                          state === 'current'
                            ? { boxShadow: [`0 0 12px ${st.glow}`, `0 0 28px ${st.glow}`, `0 0 12px ${st.glow}`] }
                            : isLocked
                              ? { opacity: [0.55, 0.75, 0.55] }
                              : {}
                        }
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {state === 'cleared' ? (
                          <CheckCircle size={26} weight="fill" style={{ color: C.gold }} />
                        ) : isLocked ? (
                          <Lock size={22} weight="duotone" className="text-slate-500" />
                        ) : (
                          <Target size={26} weight="duotone" style={{ color: st.ring }} />
                        )}
                        <span className="text-[8px] mt-0.5 text-slate-500">{i + 1}</span>
                      </motion.div>
                    </div>

                    <div
                      className="flex-1 rounded-2xl border overflow-hidden"
                      style={{
                        borderColor: state === 'current' ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)',
                        background: isLocked
                          ? 'linear-gradient(145deg, rgba(15,23,42,0.9), rgba(15,23,42,0.6))'
                          : `linear-gradient(145deg, rgba(12,18,32,0.95), rgba(30,27,75,0.25))`,
                      }}
                    >
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => !isLocked && setExpanded(isOpen ? null : level.id)}
                        className="w-full text-left p-4 sm:p-5 disabled:cursor-not-allowed"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md tracking-wider"
                            style={{ backgroundColor: `${st.ring}22`, color: st.ring, border: `1px solid ${st.ring}44` }}
                          >
                            {st.badge}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">{level.codename}</span>
                          {!isLocked && (
                            <span className="text-[9px] font-mono text-slate-500">
                              {prog.done}/{prog.total} objectives
                            </span>
                          )}
                          <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-amber-400/90">
                            <Star size={10} weight="fill" /> +{level.xp} XP
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-white">{level.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{level.subtitle}</p>

                        {isLocked && level.needsCode && (
                          <UnlockBox
                            canTry={canAttemptUnlock(level.id, unlocked)}
                            onUnlock={pw => tryUnlockLevel(level.id, pw)}
                          />
                        )}

                        {!isLocked && (
                          <div className="flex items-center gap-1 mt-3 text-[10px] text-cyan-400/80 font-medium">
                            <Sparkle size={12} />
                            {isOpen ? 'Collapse briefing' : 'Expand briefing'}
                            <motion.span animate={{ rotate: isOpen ? 180 : 0 }}><CaretDown size={12} /></motion.span>
                          </div>
                        )}
                      </button>

                      <AnimatePresence>
                        {isOpen && !isLocked && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-white/5"
                          >
                            <div className="px-4 sm:px-5 py-4 bg-black/20 space-y-3">
                              <div>
                                <p className="text-[9px] font-mono uppercase tracking-widest text-fuchsia-400/80 mb-2 flex items-center gap-1">
                                  <Shield size={10} /> Objectives
                                </p>
                                <ul className="space-y-2">
                                  {level.steps.map((step, si) => {
                                    const checked = !!(checks[level.id]?.[si])
                                    return (
                                      <li key={step}>
                                        <label className="flex items-start gap-2 cursor-pointer group">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleCheck(level.id, si)}
                                            className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 accent-cyan-500 cursor-pointer"
                                          />
                                          <span
                                            className={`text-xs leading-snug ${checked ? 'text-slate-500 line-through' : 'text-slate-300 group-hover:text-white'}`}
                                          >
                                            {step}
                                          </span>
                                        </label>
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                              <div className="rounded-xl p-3 border border-amber-500/20" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08), transparent)' }}>
                                <p className="text-[9px] font-mono uppercase tracking-widest text-amber-400/90 mb-1 flex items-center gap-1">
                                  <Trophy size={10} /> Nugget
                                </p>
                                <p className="text-xs text-slate-300 leading-relaxed">{level.nugget}</p>
                              </div>
                              <button
                                type="button"
                                onClick={onOpenPlayground}
                                className="w-full py-2 rounded-lg text-xs font-semibold text-indigo-100 border border-indigo-500/30 hover:bg-indigo-500/10 transition-colors"
                              >
                                Do this in Playground →
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </ul>

          <p className="text-center text-[10px] font-mono text-slate-600 mt-10 uppercase tracking-widest">
            Progress saved in this browser only
          </p>
        </div>
      </div>
    </div>
  )
}
