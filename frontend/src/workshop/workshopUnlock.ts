/**
 * Client-only CTF unlocks (fun workshop; not secret).
 * Facilitator passwords → SHA-256(salt + password) below.
 * Placeholders: lakshmi=banana, a2a=wire, orchestrator=route, master=sutradhaar
 */

const STORAGE_UNLOCKED = 'sutradhaar-workshop-unlocked'
const STORAGE_CHECKS = 'sutradhaar-workshop-checks'

const BASE_SALT = 'sutradhaar-ctf-v1'

export const LEVEL_ORDER = ['baseline', 'lakshmi', 'a2a', 'orchestrator'] as const
export type LevelId = (typeof LEVEL_ORDER)[number]

/** level id → hex sha256(salt-level + password) */
export const UNLOCK_HASHES: Record<string, string> = {
  lakshmi: '333432218a6b0976a0bfa25f03912dbe9edc35520b6b6e5c60c4f34ef5828b56',
  a2a: 'b396d7481c67b5c8af21a3d2258553c65e37b12b8b3d0764007be9ad06c612e4',
  orchestrator: '817e32d043ba5d8cef973cbbe4abbb799d5a9dbb44397c2db62ddb1d98361ab4',
}

export const MASTER_HASH =
  'ec988f1dce9f1fb7ed5f5bb80e11dc98a07abd5c2b67b3ded1760972d9ac0eaf'

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashLevel(levelId: string, password: string): Promise<string> {
  return sha256Hex(`${BASE_SALT}-${levelId}${password.trim()}`)
}

async function hashMaster(password: string): Promise<string> {
  return sha256Hex(`${BASE_SALT}-master${password.trim()}`)
}

export function loadUnlocked(): Set<LevelId> {
  try {
    const raw = localStorage.getItem(STORAGE_UNLOCKED)
    const parsed = raw ? (JSON.parse(raw) as string[]) : ['baseline']
    return new Set([...(parsed as LevelId[]), 'baseline'])
  } catch {
    return new Set(['baseline'])
  }
}

export function saveUnlocked(set: Set<LevelId>) {
  localStorage.setItem(STORAGE_UNLOCKED, JSON.stringify([...set]))
}

export type CheckState = Record<string, boolean[]>

export function loadChecks(stepCounts: Record<string, number>): CheckState {
  try {
    const raw = localStorage.getItem(STORAGE_CHECKS)
    const parsed = raw ? (JSON.parse(raw) as CheckState) : {}
    const out: CheckState = {}
    for (const id of LEVEL_ORDER) {
      const n = stepCounts[id] ?? 0
      const prev = parsed[id] || []
      out[id] = Array.from({ length: n }, (_, i) => !!prev[i])
    }
    return out
  } catch {
    const out: CheckState = {}
    for (const id of LEVEL_ORDER) {
      out[id] = Array.from({ length: stepCounts[id] ?? 0 }, () => false)
    }
    return out
  }
}

export function saveChecks(state: CheckState) {
  localStorage.setItem(STORAGE_CHECKS, JSON.stringify(state))
}

export function previousLevel(id: LevelId): LevelId | null {
  const i = LEVEL_ORDER.indexOf(id)
  return i > 0 ? LEVEL_ORDER[i - 1] : null
}

export function canAttemptUnlock(id: LevelId, unlocked: Set<LevelId>): boolean {
  if (id === 'baseline') return true
  const prev = previousLevel(id)
  return prev ? unlocked.has(prev) : true
}

export async function verifyLevelPassword(
  levelId: LevelId,
  password: string,
): Promise<boolean> {
  const expected = UNLOCK_HASHES[levelId]
  if (!expected) return levelId === 'baseline'
  const got = await hashLevel(levelId, password)
  return got === expected
}

export async function verifyMasterPassword(password: string): Promise<boolean> {
  return (await hashMaster(password)) === MASTER_HASH
}

export function unlockAll(): Set<LevelId> {
  return new Set(LEVEL_ORDER)
}

export function levelProgress(checks: CheckState, levelId: LevelId, stepCount: number) {
  const arr = checks[levelId] || []
  const done = arr.slice(0, stepCount).filter(Boolean).length
  return { done, total: stepCount, complete: stepCount > 0 && done >= stepCount }
}

export type VisualState = 'cleared' | 'current' | 'active' | 'locked'

export function visualStates(
  unlocked: Set<LevelId>,
  checks: CheckState,
  stepCounts: Record<LevelId, number>,
): Record<LevelId, VisualState> {
  const out = {} as Record<LevelId, VisualState>
  let currentSet = false
  for (const id of LEVEL_ORDER) {
    if (!unlocked.has(id)) {
      out[id] = 'locked'
      continue
    }
    const { complete } = levelProgress(checks, id, stepCounts[id])
    if (complete) {
      out[id] = 'cleared'
      continue
    }
    if (!currentSet) {
      out[id] = 'current'
      currentSet = true
    } else {
      out[id] = 'active'
    }
  }
  return out
}
