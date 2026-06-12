/**
 * BEAN Private Deploys — relayer API client
 *
 * Talks to Backend/privacy-relayer through the Next.js rewrite `/relayer/*`
 * (the relayer serves no CORS headers — see next.config.js). The relayer is
 * the ONLY party that submits withdrawals on-chain; the frontend builds the
 * proof and POSTs it here. Nothing secret ever goes into these requests: the
 * withdrawal struct, proof, and public signals are all destined for calldata
 * anyway.
 *
 * Serialization rule: every numeric field crossing this boundary is a decimal
 * string (the relayer/SDK re-BigInts them). Never put a raw BigInt in a JSON
 * body — JSON.stringify throws.
 */

import { RELAYER_BASE } from './config'
import type { Hex, Address } from 'viem'

export class RelayerError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'RelayerError'
  }
}

/**
 * The Entrypoint reverts `IncorrectASPRoot()` when the proof's ASPRoot signal
 * doesn't match `Entrypoint.latestRoot()` at relay time. This happens when the
 * postman publishes a NEW root between proof generation and relay (a window
 * dominated by the 10–30s groth16 prove time). The caller should treat this as
 * retryable: refetch the proof against the now-current published root and try
 * again.
 */
export function isAspRootMismatch(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return /IncorrectASPRoot/i.test(e.message)
}

export interface RelayerInfo {
  entrypoint: Address
  /** Each pool's address + scope (one Entrypoint serves both pools). */
  pools?: Array<{ key: 'eth' | 'bean'; address: Address; scope: string }>
  /** Legacy single-pool field — kept optional for back-compat. */
  pool?: Address
  scope?: string
  /** Postman's IN-MEMORY ASP tree root — includes newly approved labels NOT
   *  YET committed on-chain. /asp/proof builds proofs against this root. */
  aspRoot: string
  /** On-chain `Entrypoint.latestRoot()` — what `relay` actually checks against.
   *  Lags `aspRoot` until the postman's next publish cycle. */
  publishedRoot?: string
  approved: number
}

/** snarkjs groth16 output, untouched (decimal strings). */
export interface SnarkProof {
  proof: {
    pi_a: string[]
    pi_b: string[][]
    pi_c: string[]
    protocol: string
    curve: string
  }
  publicSignals: string[]
}

export interface AspProofResponse {
  root: string
  depth: number
  index: number
  siblings: string[]
}

async function relayerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${RELAYER_BASE}${path}`, init)
  } catch (e) {
    throw new RelayerError(
      `relayer unreachable (${e instanceof Error ? e.message : 'network error'})`
    )
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new RelayerError(`relayer returned non-JSON (HTTP ${res.status})`, res.status)
  }
  if (!res.ok) {
    const msg =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`
    throw new RelayerError(msg, res.status)
  }
  return body as T
}

/** Addresses, scope and current ASP root — also serves as a health check. */
export function getRelayerInfo(): Promise<RelayerInfo> {
  return relayerFetch<RelayerInfo>('/info')
}

/**
 * A pool's commitments in insertion order, as bigints. The state Merkle proof
 * is built from these (LeanIMT + poseidon). Each pool has its OWN state tree —
 * pass `'bean'` for BEAN withdrawals; defaults to the ETH pool.
 */
export async function getStateLeaves(pool: 'eth' | 'bean' = 'eth'): Promise<bigint[]> {
  const { leaves } = await relayerFetch<{ pool?: string; leaves: string[] }>(
    `/state/leaves?pool=${pool}`
  )
  return leaves.map((l) => BigInt(l))
}

/**
 * ASP membership proof for a deposit label. Throws RelayerError with the
 * relayer's "label not approved yet" message until the postman publishes it.
 */
export function getAspProof(label: string): Promise<AspProofResponse> {
  return relayerFetch<AspProofResponse>(
    `/asp/proof?label=${encodeURIComponent(label)}`
  )
}

const NOT_APPROVED_RE = /not approved/i

/**
 * Poll the ASP proof until the postman approves the label (it republishes
 * roughly every 15s). Non-"not approved" errors propagate immediately.
 */
export async function pollAspProof(
  label: string,
  opts: { intervalMs?: number; timeoutMs?: number; onTick?: (elapsedMs: number) => void } = {}
): Promise<AspProofResponse> {
  const { intervalMs = 5_000, timeoutMs = 300_000, onTick } = opts
  const start = Date.now()
  for (;;) {
    try {
      return await getAspProof(label)
    } catch (e) {
      if (!(e instanceof RelayerError) || !NOT_APPROVED_RE.test(e.message)) throw e
      const elapsed = Date.now() - start
      if (elapsed + intervalMs > timeoutMs) {
        throw new RelayerError(
          `ASP approval timed out after ${Math.round(timeoutMs / 1000)}s — the postman may be down`
        )
      }
      onTick?.(elapsed)
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }
}

/**
 * Poll until the postman has APPROVED the label AND PUBLISHED the resulting
 * ASP root on-chain. Returns the proof whose `root` equals the relayer's
 * `publishedRoot` (which mirrors `Entrypoint.latestRoot()`).
 *
 * `/asp/proof` builds its merkle proof against the postman's IN-MEMORY tree
 * (which advances as soon as a new deposit is approved). `relay` checks against
 * `Entrypoint.latestRoot()`, only updated on the postman's publish cycle. Using
 * a proof against the in-memory root before publish reverts `IncorrectASPRoot`.
 */
export async function pollAspProofPublished(
  label: string,
  opts: { intervalMs?: number; timeoutMs?: number; onTick?: (elapsedMs: number, stage: 'approval' | 'publish') => void } = {}
): Promise<AspProofResponse> {
  const { intervalMs = 5_000, timeoutMs = 300_000, onTick } = opts
  const start = Date.now()
  // Phase 1: wait for the label to be in the in-memory tree (approval).
  const approved = await pollAspProof(label, {
    intervalMs,
    timeoutMs,
    onTick: (e) => onTick?.(e, 'approval'),
  })
  // Phase 2: wait for the postman to publish that root on-chain. If the root
  // advances under us (new approvals → next root), refetch the proof against
  // the newer root and continue waiting for THAT to be published.
  let current = approved
  for (;;) {
    let info: RelayerInfo
    try {
      info = await getRelayerInfo()
    } catch (e) {
      const elapsed = Date.now() - start
      if (elapsed + intervalMs > timeoutMs) throw e
      await new Promise((r) => setTimeout(r, intervalMs))
      continue
    }
    // Old relayer versions don't expose publishedRoot — assume it matches
    // aspRoot and proceed (back-compat).
    if (info.publishedRoot === undefined) return current
    if (info.publishedRoot === current.root) return current

    // Either the proof's root hasn't been published yet, or a newer root has
    // been published. In both cases keep waiting; refetch the proof so it
    // tracks the current in-memory tree root.
    const elapsed = Date.now() - start
    if (elapsed + intervalMs > timeoutMs) {
      throw new RelayerError(
        `ASP publish timed out after ${Math.round(timeoutMs / 1000)}s — the postman may be lagging`
      )
    }
    onTick?.(elapsed, 'publish')
    await new Promise((r) => setTimeout(r, intervalMs))
    try {
      current = await getAspProof(label)
    } catch {
      // transient — try again next cycle
    }
  }
}

export interface RelayRequest {
  withdrawal: { processooor: Address; data: Hex }
  proof: SnarkProof
  scope: string
}

/** Submit the withdrawal via the relayer. Returns the on-chain tx hash. */
export async function relayWithdrawal(req: RelayRequest): Promise<Hex> {
  const { hash } = await relayerFetch<{ hash: Hex }>('/relay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  return hash
}
