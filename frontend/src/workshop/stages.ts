import type { LevelId } from './workshopUnlock'

export type WorkshopStage = {
  id: LevelId
  index: number
  title: string
  shortTitle: string
  xp: number
  /** Step labels for progress checkboxes (baseline only populated for MVP). */
  steps: string[]
  needsCode: boolean
}

export const WORKSHOP_STAGES: WorkshopStage[] = [
  {
    id: 'baseline',
    index: 1,
    title: 'Boot the lab',
    shortTitle: 'Boot',
    xp: 100,
    steps: ['Gateway running on :8080', 'Chat with the demo agent', 'Create your first agent'],
    needsCode: false,
  },
  {
    id: 'lakshmi',
    index: 2,
    title: 'Memory vault',
    shortTitle: 'Memory',
    xp: 250,
    steps: [],
    needsCode: true,
  },
  {
    id: 'a2a',
    index: 3,
    title: 'Wire the network',
    shortTitle: 'Handoff',
    xp: 400,
    steps: [],
    needsCode: true,
  },
  {
    id: 'orchestrator',
    index: 4,
    title: 'One door',
    shortTitle: 'Route',
    xp: 600,
    steps: [],
    needsCode: true,
  },
]

export const STAGE_BY_ID = Object.fromEntries(
  WORKSHOP_STAGES.map(s => [s.id, s]),
) as Record<LevelId, WorkshopStage>

export const STEP_COUNTS = Object.fromEntries(
  WORKSHOP_STAGES.map(s => [s.id, s.steps.length]),
) as Record<LevelId, number>
