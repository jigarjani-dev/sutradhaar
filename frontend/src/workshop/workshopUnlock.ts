/**
 * Client-only CTF unlocks (fun workshop; not secret).
 * Facilitator passwords → SHA-256(salt + password) below.
 * Placeholders:
 *   shape=soul, lakshmi=banana, sheets=sticky, gmail=inbox,
 *   handoff=wire, door=route, master=sutradhaar
 */

const STORAGE_UNLOCKED = 'sutradhaar-workshop-unlocked'
const STORAGE_CHECKS = 'sutradhaar-workshop-checks'

const BASE_SALT = 'sutradhaar-ctf-v1'

export const LEVEL_ORDER = [
  'boot',
  'shape',
  'lakshmi',
  'sheets',
  'gmail',
  'handoff',
  'door',
] as const
export type LevelId = (typeof LEVEL_ORDER)[number]

const FIRST_LEVEL: LevelId = 'boot'

/** Old ids → new (localStorage migration). */
const LEGACY_LEVEL: Record<string, LevelId> = {
  baseline: 'boot',
  a2a: 'handoff',
  orchestrator: 'door',
}

/** level id → hex sha256(salt-level + password) */
export const UNLOCK_HASHES: Record<string, string> = {
  shape: 'e6e09805155b9d9c8ebfe951fe8d9bd2494fbc2c63a74e3758e542f45659f9d2',
  lakshmi: '333432218a6b0976a0bfa25f03912dbe9edc35520b6b6e5c60c4f34ef5828b56',
  sheets: '64ea2fde5d4fabbbbfa43505816f36392acbfc5898eadea72311e4975455ba29',
  gmail: 'fcebaa53301b0a6a0f4bbb6942dbc6142f9501cda767a778a7d2b7848d6549f4',
  handoff: '6a08b5468cd4b1127f22245ac23426d081babadb45c6afd4e65b2298eecad067',
  door: '6f9431ccc96652cab4508a095111264db2cac297ccf0c62a0918be2dd0b631aa',
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

function normalizeLevelId(id: string): LevelId | null {
  if ((LEVEL_ORDER as readonly string[]).includes(id)) return id as LevelId
  return LEGACY_LEVEL[id] ?? null
}

export function loadUnlocked(): Set<LevelId> {
  try {
    const raw = localStorage.getItem(STORAGE_UNLOCKED)
    const parsed = raw ? (JSON.parse(raw) as string[]) : [FIRST_LEVEL]
    const next = new Set<LevelId>([FIRST_LEVEL])
    for (const id of parsed) {
      const n = normalizeLevelId(id)
      if (n) next.add(n)
    }
    return next
  } catch {
    return new Set<LevelId>([FIRST_LEVEL])
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
    const merged: CheckState = { ...parsed }
    if (parsed.baseline && !merged.boot) merged.boot = parsed.baseline
    if (parsed.a2a && !merged.handoff) merged.handoff = parsed.a2a
    if (parsed.orchestrator && !merged.door) merged.door = parsed.orchestrator
    const out: CheckState = {}
    for (const id of LEVEL_ORDER) {
      const n = stepCounts[id] ?? 0
      const prev = merged[id] || []
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
  if (id === FIRST_LEVEL) return true
  const prev = previousLevel(id)
  return prev ? unlocked.has(prev) : true
}

export async function verifyLevelPassword(
  levelId: LevelId,
  password: string,
): Promise<boolean> {
  const expected = UNLOCK_HASHES[levelId]
  if (!expected) return levelId === FIRST_LEVEL
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
