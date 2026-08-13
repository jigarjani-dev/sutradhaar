import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flask, Star } from '@phosphor-icons/react'
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
  visualStates,
} from '../workshop/workshopUnlock'
import { WORKSHOP_STAGES, STEP_COUNTS } from '../workshop/stages'
import WorkshopStageNav from './workshop/WorkshopStageNav'
import StageBaselinePage from './workshop/StageBaselinePage'
import StagePlaceholderPage from './workshop/StagePlaceholderPage'
import { workshopColors as c } from './workshop/workshopTheme'

interface WorkshopPanelProps {
  onOpenPlayground: () => void
}

export default function WorkshopPanel({ onOpenPlayground }: WorkshopPanelProps) {
  const [unlocked, setUnlocked] = useState<Set<LevelId>>(() => loadUnlocked())
  const [checks, setChecks] = useState(() => loadChecks(STEP_COUNTS))
  const [activeStage, setActiveStage] = useState<LevelId>('baseline')
  const [masterPw, setMasterPw] = useState('')
  const [masterErr, setMasterErr] = useState(false)
  const [showMaster, setShowMaster] = useState(false)

  useEffect(() => {
    saveUnlocked(unlocked)
  }, [unlocked])

  useEffect(() => {
    saveChecks(checks)
  }, [checks])

  const visuals = useMemo(() => visualStates(unlocked, checks, STEP_COUNTS), [unlocked, checks])

  const totalXp = WORKSHOP_STAGES.reduce((s, l) => s + l.xp, 0)
  const earnedXp = WORKSHOP_STAGES.filter(l => visuals[l.id] === 'cleared').reduce((s, l) => s + l.xp, 0)
  const progress = Math.round((earnedXp / totalXp) * 100)

  const toggleCheck = useCallback((levelId: LevelId, index: number) => {
    setChecks(prev => {
      const row = [...(prev[levelId] || Array(STEP_COUNTS[levelId]).fill(false))]
      row[index] = !row[index]
      return { ...prev, [levelId]: row }
    })
  }, [])

  const tryUnlockLevel = useCallback(async (levelId: LevelId, password: string) => {
    if (!canAttemptUnlock(levelId, unlocked)) return 'blocked' as const
    const ok = await verifyLevelPassword(levelId, password)
    if (!ok) return 'bad' as const
    setUnlocked(prev => new Set([...prev, levelId]))
    setActiveStage(levelId)
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

  const selectStage = (id: LevelId) => {
    setActiveStage(id)
  }

  const renderStagePage = () => {
    if (activeStage === 'baseline') {
      return (
        <StageBaselinePage
          checks={checks.baseline || []}
          onToggleCheck={i => toggleCheck('baseline', i)}
          onOpenPlayground={onOpenPlayground}
        />
      )
    }

    return (
      <StagePlaceholderPage
        stageId={activeStage}
        locked={!unlocked.has(activeStage)}
        canTryUnlock={canAttemptUnlock(activeStage, unlocked)}
        onUnlock={pw => tryUnlockLevel(activeStage, pw)}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ backgroundColor: c.bg }}>
      {/* Top bar */}
      <div
        className="shrink-0 px-4 sm:px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center gap-4"
        style={{ backgroundColor: c.surface, borderColor: c.border }}
      >
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold" style={{ color: c.text }}>
            Workshop
          </h2>
          <p className="text-xs mt-0.5" style={{ color: c.textSecondary }}>
            Guided stages · progress saved in this browser
          </p>
        </div>

        <div className="flex items-center gap-4 flex-1 max-w-md">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-[10px] font-mono mb-1">
              <span className="flex items-center gap-1" style={{ color: c.textSecondary }}>
                <Star size={10} weight="fill" style={{ color: c.amber }} />
                {earnedXp} / {totalXp} XP
              </span>
              <span style={{ color: c.primary }}>{progress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: c.bg }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: c.primary }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPlayground}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white"
            style={{ backgroundColor: c.primary }}
          >
            <Flask size={14} weight="duotone" />
            Playground
          </button>
        </div>
      </div>

      <WorkshopStageNav
        activeId={activeStage}
        visuals={visuals}
        unlocked={unlocked}
        onSelect={selectStage}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto">{renderStagePage()}</div>
      </div>

      <footer
        className="shrink-0 px-4 sm:px-6 py-2 border-t text-center"
        style={{ borderColor: c.border, backgroundColor: c.surface }}
      >
        <button
          type="button"
          onClick={() => setShowMaster(s => !s)}
          className="text-[10px] uppercase tracking-wider"
          style={{ color: c.textMuted }}
        >
          {showMaster ? 'Hide facilitator unlock' : 'Facilitator unlock all'}
        </button>
        {showMaster && (
          <form onSubmit={tryMaster} className="flex gap-2 justify-center mt-2 max-w-xs mx-auto">
            <input
              type="password"
              value={masterPw}
              onChange={e => { setMasterPw(e.target.value); setMasterErr(false) }}
              placeholder="Master phrase"
              className="flex-1 px-3 py-1.5 rounded-lg text-xs border"
              style={{ borderColor: c.border }}
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: c.primary }}
            >
              Unlock
            </button>
            {masterErr && <span className="text-xs self-center" style={{ color: c.rose }}>No</span>}
          </form>
        )}
      </footer>
    </div>
  )
}
