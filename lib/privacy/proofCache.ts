/**
 * BEAN Private Deploys — pre-generated withdrawal proof cache
 *
 * The withdrawal proof is generated in the BACKGROUND as soon as a note is
 * ASP-approved (all inputs — full note value, subaccount recipient, roots —
 * are known then; nothing about the future deploy enters the proof). Caching
 * it in sessionStorage means the deploy click only pays the relay tx + deploy
 * tx (~seconds), while the funds keep sitting in the pool until that moment.
 *
 * SAFE TO PERSIST: the entry holds the withdrawal struct, the groth16 proof
 * and its public signals — all destined for public calldata — plus roots for
 * staleness checks. It contains NO keys and NO secrets.
 *
 * STALENESS: the proof binds a specific state root (changes on ANY pool
 * deposit/withdrawal) and ASP root (changes on every postman approval). The
 * background watcher revalidates and silently re-proves when either moves.
 */

import type { Address } from 'viem'
import type { ProvenWithdrawal } from './withdrawal'

export interface CachedProof extends ProvenWithdrawal {
  /** Label of the note this proof spends. */
  noteLabel: string
  /** Recipient the proof pays out to (must match the live subaccount). */
  subaccountAddress: Address
  /** Unix ms when the proof was generated (display only). */
  generatedAt: number
}

// v2: the withdrawal `feeRecipient` changed (was the Entrypoint, which
// reverts the zero-fee transfer) — bumping the key discards any proof whose
// context was bound to the old, unrelayable withdrawal data.
const PROOF_KEY = (main: Address) =>
  `bean_privacy_proof_v2_${main.toLowerCase()}`

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

export function loadProof(main: Address): CachedProof | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(PROOF_KEY(main))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedProof
    // Minimal shape check — a corrupt entry is just a cache miss.
    if (!parsed?.withdrawal?.data || !parsed?.proof?.publicSignals) return null
    return parsed
  } catch {
    return null
  }
}

export function saveProof(main: Address, entry: CachedProof): void {
  try {
    storage()?.setItem(PROOF_KEY(main), JSON.stringify(entry))
  } catch {
    // Quota/serialization failure — worst case we re-prove at deploy time.
  }
}

export function clearProof(main: Address): void {
  storage()?.removeItem(PROOF_KEY(main))
}

export interface ProofCurrencyCheck {
  currentStateRoot: string
  currentAspRoot: string
  noteLabel: string
  subaccountAddress: Address
}

/**
 * Whether a cached proof is still submittable. Conservative: any drift in
 * roots, note, or recipient → regenerate (proving is background-cheap).
 */
export function isProofCurrent(
  entry: CachedProof | null,
  check: ProofCurrencyCheck
): entry is CachedProof {
  if (!entry) return false
  return (
    entry.noteLabel === check.noteLabel &&
    entry.subaccountAddress.toLowerCase() ===
      check.subaccountAddress.toLowerCase() &&
    entry.stateRoot === check.currentStateRoot &&
    entry.aspRoot === check.currentAspRoot
  )
}
