// Custom Agent presets, stored in localStorage scoped per wallet address.
// See plan.md for the design and dev review history.

export const CUSTOM_AGENT_SCHEMA_VERSION = 1
export const MAX_CUSTOM_AGENTS_PER_WALLET = 10
export const MAX_NAME_LENGTH = 32

// Must mirror the AgentId type at AgentConfigDrawer.tsx:12 exactly.
export type BaseAgentId = 'sniper' | 'anti-winner' | 'beanpot-hunter'

export type CustomAgent = {
  v: 1
  id: string
  name: string
  baseAgent: BaseAgentId
  params: Record<string, number>
  perBlock: number
  numRounds: number
  createdAt: string
  lastUsedAt?: string
}

export type SaveResult =
  | { ok: true; agent: CustomAgent }
  | { ok: false; reason: 'limit_reached' | 'name_collision' | 'invalid_name' }

const VALID_BASE_AGENTS: ReadonlySet<BaseAgentId> = new Set<BaseAgentId>([
  'sniper',
  'anti-winner',
  'beanpot-hunter',
])

function storageKey(walletAddr: string): string {
  return `bean_custom_agents_${walletAddr.toLowerCase()}`
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isValidEntry(value: unknown): value is CustomAgent {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<CustomAgent>
  return (
    v.v === CUSTOM_AGENT_SCHEMA_VERSION &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.baseAgent === 'string' &&
    VALID_BASE_AGENTS.has(v.baseAgent as BaseAgentId) &&
    typeof v.params === 'object' && v.params !== null &&
    typeof v.perBlock === 'number' &&
    typeof v.numRounds === 'number' &&
    typeof v.createdAt === 'string' &&
    (v.lastUsedAt === undefined || typeof v.lastUsedAt === 'string')
  )
}

function readRaw(walletAddr: string): CustomAgent[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(storageKey(walletAddr))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid: CustomAgent[] = []
    let droppedCount = 0
    for (const entry of parsed) {
      if (isValidEntry(entry)) valid.push(entry)
      else droppedCount += 1
    }
    if (droppedCount > 0) {
      console.warn(
        `[customAgents] Dropped ${droppedCount} stale or invalid entries from localStorage`,
      )
    }
    return valid
  } catch (err) {
    console.warn('[customAgents] Failed to parse localStorage entry:', err)
    return []
  }
}

function writeRaw(walletAddr: string, agents: CustomAgent[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(storageKey(walletAddr), JSON.stringify(agents))
  } catch (err) {
    // Quota exceeded or storage unavailable. Surface the error so callers can
    // decide whether to retry or warn the user; we don't have a typed error
    // path for storage failures yet because they should be vanishingly rare.
    console.error('[customAgents] Failed to write to localStorage:', err)
  }
}

function sortAgents(agents: CustomAgent[]): CustomAgent[] {
  return [...agents].sort((a, b) => {
    // Entries with lastUsedAt come first, sorted desc by lastUsedAt.
    // Entries without lastUsedAt come second, sorted desc by createdAt.
    if (a.lastUsedAt && b.lastUsedAt) {
      return b.lastUsedAt.localeCompare(a.lastUsedAt)
    }
    if (a.lastUsedAt && !b.lastUsedAt) return -1
    if (!a.lastUsedAt && b.lastUsedAt) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function listCustomAgents(walletAddr: string): CustomAgent[] {
  if (!walletAddr) return []
  return sortAgents(readRaw(walletAddr))
}

export function saveCustomAgent(walletAddr: string, agent: CustomAgent): SaveResult {
  if (!walletAddr) return { ok: false, reason: 'invalid_name' }

  const trimmedName = agent.name.trim()
  if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) {
    return { ok: false, reason: 'invalid_name' }
  }

  const existing = readRaw(walletAddr)
  const indexById = existing.findIndex((a) => a.id === agent.id)
  const isUpdate = indexById >= 0

  // Name collision check: only against OTHER entries.
  const nameClash = existing.some(
    (a, i) => i !== indexById && a.name.trim().toLowerCase() === trimmedName.toLowerCase(),
  )
  if (nameClash) return { ok: false, reason: 'name_collision' }

  // Cap check: only on new entries, not updates.
  if (!isUpdate && existing.length >= MAX_CUSTOM_AGENTS_PER_WALLET) {
    return { ok: false, reason: 'limit_reached' }
  }

  const normalised: CustomAgent = { ...agent, name: trimmedName, v: CUSTOM_AGENT_SCHEMA_VERSION }
  const next = isUpdate
    ? existing.map((a, i) => (i === indexById ? normalised : a))
    : [...existing, normalised]

  writeRaw(walletAddr, next)
  return { ok: true, agent: normalised }
}

export function removeCustomAgent(walletAddr: string, id: string): void {
  if (!walletAddr) return
  const existing = readRaw(walletAddr)
  const next = existing.filter((a) => a.id !== id)
  if (next.length !== existing.length) writeRaw(walletAddr, next)
}

export function markCustomAgentUsed(walletAddr: string, id: string): void {
  if (!walletAddr) return
  const existing = readRaw(walletAddr)
  const now = new Date().toISOString()
  let mutated = false
  const next = existing.map((a) => {
    if (a.id === id) {
      mutated = true
      return { ...a, lastUsedAt: now }
    }
    return a
  })
  if (mutated) writeRaw(walletAddr, next)
}
