import { CheckCircle, Lock, Circle } from '@phosphor-icons/react'
import type { LevelId, VisualState } from '../../workshop/workshopUnlock'
import { WORKSHOP_STAGES } from '../../workshop/stages'
import { workshopColors as c } from './workshopTheme'

type Props = {
  activeId: LevelId
  visuals: Record<LevelId, VisualState>
  unlocked: Set<LevelId>
  onSelect: (id: LevelId) => void
}

function stageIcon(state: VisualState, locked: boolean) {
  if (state === 'cleared') {
    return <CheckCircle size={14} weight="fill" style={{ color: c.emerald }} />
  }
  if (locked) {
    return <Lock size={14} weight="duotone" style={{ color: c.textMuted }} />
  }
  return <Circle size={10} weight="fill" style={{ color: c.primary }} />
}

export default function WorkshopStageNav({ activeId, visuals, unlocked, onSelect }: Props) {
  return (
    <div
      className="shrink-0 border-b overflow-x-auto"
      style={{ backgroundColor: c.surface, borderColor: c.border }}
    >
      <div className="flex min-w-max px-4 sm:px-6">
        {WORKSHOP_STAGES.map(stage => {
          const locked = !unlocked.has(stage.id)
          const state = visuals[stage.id]
          const active = activeId === stage.id

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelect(stage.id)}
              className="relative flex items-center gap-2 px-4 py-3.5 text-left border-b-2 transition-colors"
              style={{
                borderBottomColor: active ? c.primary : 'transparent',
                color: active ? c.text : locked ? c.textMuted : c.textSecondary,
                backgroundColor: active ? c.primaryLight : 'transparent',
              }}
            >
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{
                  backgroundColor: active ? c.primary : c.bg,
                  color: active ? '#fff' : c.textSecondary,
                }}
              >
                {stage.index}
              </span>
              <span className="flex flex-col items-start min-w-0">
                <span className="text-xs font-semibold truncate max-w-[7rem] sm:max-w-none">
                  {stage.shortTitle}
                </span>
                <span className="text-[10px]" style={{ color: c.textMuted }}>
                  +{stage.xp} XP
                </span>
              </span>
              <span className="shrink-0 ml-1">{stageIcon(state, locked)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
