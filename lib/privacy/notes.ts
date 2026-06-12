/**
 * BEAN Private Deploys — local note store (UX cache, NOT the source of truth)
 *
 * A "note" records one deposit into the privacy pool: its label, value and
 * which derivation index produced its secrets. Notes contain NO secrets —
 * secrets are re-derived from the wallet signature on demand (keys.ts).
 *
 * Everything here is recoverable without this cache: scan the pool's
 * `Deposited` events for both `_depositor == main` (FUNDING deposits) and
 * `_depositor == subaccount` (CASHOUT deposits) — indexed → one eth_getLogs
 * call each from POOL_DEPLOY_BLOCK — and match recomputed precommitments for
 * indices 0..N. localStorage just makes the common path instant.
 *
 * Funding invariant: at most ONE unspent FUNDING note per main address
 * (deposits are blocked while a live funding note exists; withdrawals take
 * the full value). Cashout notes are tracked separately (a cashout creates
 * its own note that withdraws to main, not the subaccount).
 */

import type { Address } from 'viem'
import type { PoolKey } from './config'

/** Which leg of the round-trip a note belongs to. */
export type NotePurpose = 'funding' | 'cashout'
/** Who signed the pool deposit (matters for ragequit recovery — the pool
 *  records `depositors[label] = msg.sender`). Funding = main, cashout = sub. */
export type NoteDepositor = 'main' | 'subaccount'

export interface PrivateNote {
  /** Pool label (decimal string) — identifies the note in ASP/withdrawals. */
  label: string
  /** Deposited value in wei (decimal string). */
  value: string
  /** Commitment hash (decimal string) — the state-tree leaf. */
  commitment: string
  /** Derivation index used for this note's deposit secrets. */
  depositIndex: number
  /** True once a withdrawal for this note has been relayed successfully. */
  spent: boolean
  /** Deposit transaction hash. */
  txHash: string
  /** Unix ms at creation (display only). */
  createdAt: number
  /** Funding (main→pool→sub) vs cashout (sub→pool→main). Optional for
   *  back-compat with notes written before this field existed (≡ 'funding'). */
  purpose?: NotePurpose
  /** Address that signed the deposit. Optional/back-compat (≡ 'main'). */
  depositor?: NoteDepositor
  /** Which pool the note lives in (routes scope + state leaves). Optional/
   *  back-compat with notes written before BEAN support (≡ 'eth'). */
  pool?: PoolKey
}

/** A note's purpose, defaulting legacy untagged notes to 'funding'. */
export function notePurpose(note: PrivateNote): NotePurpose {
  return note.purpose ?? 'funding'
}

/** A note's pool, defaulting legacy untagged notes to 'eth'. */
export function notePool(note: PrivateNote): PoolKey {
  return note.pool ?? 'eth'
}

const NOTES_KEY = (main: Address) =>
  `bean_privacy_notes_v1_${main.toLowerCase()}`
const SUBADDR_KEY = (main: Address) =>
  `bean_privacy_subaddr_v1_${main.toLowerCase()}`
const EXPORTED_KEY = (main: Address) =>
  `bean_privacy_exported_v1_${main.toLowerCase()}`

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function loadNotes(main: Address): PrivateNote[] {
  const s = storage()
  if (!s) return []
  try {
    const raw = s.getItem(NOTES_KEY(main))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveNotes(main: Address, notes: PrivateNote[]): void {
  storage()?.setItem(NOTES_KEY(main), JSON.stringify(notes))
}

export function addNote(main: Address, note: PrivateNote): PrivateNote[] {
  const notes = loadNotes(main)
  if (notes.some((n) => n.label === note.label)) return notes
  const next = [...notes, note]
  saveNotes(main, next)
  return next
}

export function markSpent(main: Address, label: string): PrivateNote[] {
  const next = loadNotes(main).map((n) =>
    n.label === label ? { ...n, spent: true } : n
  )
  saveNotes(main, next)
  return next
}

/**
 * The single live FUNDING note, if any. Cashout notes are deliberately
 * excluded so the deposit-form invariant and the background proving watcher
 * (which proves a withdrawal to the SUBACCOUNT) never pick up a cashout note
 * that must withdraw to MAIN instead.
 */
export function getUnspentNote(main: Address): PrivateNote | undefined {
  return loadNotes(main).find((n) => !n.spent && notePurpose(n) === 'funding')
}

/**
 * The in-flight cashout note for `pool`, if any (resume an interrupted
 * cashout). Per-pool: ETH and BEAN cashouts are independent unspent notes.
 */
export function getUnspentCashoutNote(
  main: Address,
  pool: PoolKey
): PrivateNote | undefined {
  return loadNotes(main).find(
    (n) => !n.spent && notePurpose(n) === 'cashout' && notePool(n) === pool
  )
}

/**
 * Derivation index for the NEXT deposit into `pool` (0-based, monotonic per
 * pool — the same index under different scopes yields different secrets, so
 * each pool keeps its own sequence).
 */
export function nextDepositIndex(main: Address, pool: PoolKey): number {
  const indices = loadNotes(main)
    .filter((n) => notePool(n) === pool)
    .map((n) => n.depositIndex)
  return indices.length === 0 ? 0 : Math.max(...indices) + 1
}

/** Replace the full note set (used by recovery rescan). */
export function replaceNotes(main: Address, notes: PrivateNote[]): void {
  saveNotes(main, notes)
}

/**
 * Cached subaccount address, used to detect wallets whose signatures are not
 * deterministic: if a re-derivation yields a different address than the one
 * recorded at creation, the caller must hard-error instead of silently using
 * a fresh (empty) subaccount.
 */
export function loadCachedSubaccountAddress(main: Address): Address | null {
  return (storage()?.getItem(SUBADDR_KEY(main)) as Address | null) ?? null
}

export function saveCachedSubaccountAddress(main: Address, sub: Address): void {
  storage()?.setItem(SUBADDR_KEY(main), sub)
}

/**
 * Whether the user has acknowledged backing up their subaccount private key
 * (downloaded the file + clicked "I've saved it"). Gate for deposit/deploy so
 * funds never enter before a recovery copy exists. Device-local on purpose:
 * re-prompting on a new device / after a storage clear is fail-safe (it just
 * nudges another backup) — there's no adversary, the gate only protects the
 * user's own funds.
 */
export function hasExportedKey(main: Address): boolean {
  return storage()?.getItem(EXPORTED_KEY(main)) === 'true'
}

export function markExported(main: Address): void {
  storage()?.setItem(EXPORTED_KEY(main), 'true')
}
