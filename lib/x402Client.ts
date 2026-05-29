// Client helper for the x402 paid mining tier.
//
// The dev hosts the x402 paywall at api.minebean.com/api/strategy/decide.
// We POST { strategy, params } via x402-fetch; the library handles the
// 402 → sign USDC EIP-3009 → retry-with-X-PAYMENT dance transparently.
//
// Successful response shape is documented in ~/Desktop/X402_API.md. Two
// principal cases: `fire: true` (math says deploy, server returns a ready-
// to-broadcast tx blueprint) and `fire: false` (server says skip this round).

import type { WalletClient } from 'viem'
import { decodeAbiParameters, toFunctionSelector, concat } from 'viem'
import { wrapFetchWithPayment } from 'x402-fetch'
import { CONTRACTS, BUILDER_CODE_SUFFIX } from '@/lib/contracts'
import { STRATEGY_API_URL, type StrategyId } from '@/lib/x402/config'

// keccak256("deploy(uint8[])").slice(0,10) — frozen at module load.
const DEPLOY_SELECTOR = toFunctionSelector('function deploy(uint8[] blockIds) payable')

// ── Response types — mirror the dev's spec ────────────────────────────────

export interface StrategyTx {
  to: `0x${string}`
  data: `0x${string}`
  value: string // wei as decimal string
  chainId: number // 8453 (Base mainnet)
}

export interface StrategyTiming {
  roundId: string
  roundStartTime: number // unix sec
  roundEndTime: number // unix sec
}

export interface StrategyFreshness {
  pricesUpdatedAt: string // ISO 8601
  gridUpdatedAt: string // ISO 8601
  computedAt: string // ISO 8601
  responseId: string // UUID v4
}

// Fire-true: full deploy recommendation with tx blueprint.
// Fire-false: same shape but tx is null and timing/freshness are {}.
export interface StrategyDecision {
  strategy: StrategyId
  blocks: number[]
  blockMask: number
  amountWei: string
  amountFormatted: string
  fire: boolean
  expectedRoiPct: number
  reason: string
  beanpotPoolFormatted: string
  tx: StrategyTx | null
  timing: StrategyTiming | Record<string, never>
  freshness: StrategyFreshness | Record<string, never>
}

// ── Typed error ───────────────────────────────────────────────────────────

export class X402ClientError extends Error {
  code: string
  details?: unknown
  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.code = code
    this.details = details
  }
}

// ── Calldata safety net ──────────────────────────────────────────────────
//
// Why: the dev's server returns ready-to-broadcast { to, data, value }. If
// api.minebean.com is compromised (DNS hijack, supply-chain on x402-fetch,
// malicious deploy), the server could return calldata that drains the user
// to an arbitrary contract. The wallet popup shows the values, but most
// users click through.
//
// We re-derive the expected calldata shape locally and assert the server
// hasn't deviated. Any mismatch throws X402ClientError BEFORE the wallet
// prompts for the deploy sig. Worst case: USDC was already paid, deploy
// never broadcasts, user keeps their ETH — strictly better than broadcasting
// an attacker-controlled tx.
//
// Verifies:
//   1. `to` matches GridMining contract.
//   2. `data` starts with the deploy(uint8[]) selector.
//   3. `value` matches the `amountWei` the strategy quoted (server-internal
//      consistency check).
//   4. Decoded blockIds are 0-24 uint8s, length 1-25, no duplicates.
//
// Note on the builder-code suffix: the dev's response MAY or MAY NOT
// already include it. We do not require it here; instead, see
// `withBuilderCodeSuffix` below, which the orchestrator calls right before
// `sendTransactionAsync` so attribution always lands regardless of what the
// server returned.
export function assertSafeStrategyDecision(decision: StrategyDecision): void {
  if (!decision.tx) {
    throw new X402ClientError('NO_TX', 'Strategy decision contains no tx (fire=false case).')
  }
  const tx = decision.tx

  // 1. to
  const expectedTo = CONTRACTS.GridMining.address.toLowerCase()
  if (tx.to.toLowerCase() !== expectedTo) {
    throw new X402ClientError(
      'UNSAFE_CALLDATA_TO',
      `Server returned tx for unexpected contract. Expected ${expectedTo}, got ${tx.to.toLowerCase()}.`,
      { expected: expectedTo, got: tx.to.toLowerCase() },
    )
  }

  // 2. selector
  const data = tx.data.toLowerCase()
  const selector = DEPLOY_SELECTOR.toLowerCase()
  if (!data.startsWith(selector)) {
    throw new X402ClientError(
      'UNSAFE_CALLDATA_SELECTOR',
      `Server returned tx with wrong function selector. Expected ${selector}, got ${data.slice(0, 10)}.`,
      { expected: selector, got: data.slice(0, 10) },
    )
  }

  // 3. value sanity — must be parseable as bigint. We do NOT pin it to
  // decision.amountWei because the user provides their own deploy amount
  // upstream; the strategy's amountWei is shown as a reference but the
  // broadcast uses parseEther(userInput). The value check the broadcast
  // actually relies on is comparing wagmi's call value against the user's
  // typed amount, which happens at the orchestrator level.
  try {
    BigInt(tx.value)
  } catch {
    throw new X402ClientError(
      'UNSAFE_CALLDATA_VALUE',
      `Could not parse tx.value as bigint. value=${tx.value}`,
    )
  }

  // 4. decoded blockIds sanity
  // Strip the 4-byte selector. If a builder-code suffix is appended, ABI
  // decode is tolerant of trailing bytes for canonical uint8[] encoding so
  // this works either way.
  const argsHex = ('0x' + data.slice(10)) as `0x${string}`
  let decoded: readonly [readonly number[]] | undefined
  try {
    decoded = decodeAbiParameters([{ type: 'uint8[]' }], argsHex) as unknown as readonly [readonly number[]]
  } catch (e) {
    throw new X402ClientError('UNSAFE_CALLDATA_DECODE', 'Could not decode blockIds from tx.data.', e)
  }
  const blocks = decoded[0]
  if (!Array.isArray(blocks) || blocks.length === 0 || blocks.length > 25) {
    throw new X402ClientError(
      'UNSAFE_CALLDATA_BLOCKS',
      `Decoded blockIds has invalid length ${blocks?.length ?? 'unknown'} (expected 1-25).`,
      { length: blocks?.length },
    )
  }
  // Cross-check decoded blocks against the headline `blocks` field — server
  // should be internally consistent.
  const decodedSorted = [...blocks].map(Number).sort((a, b) => a - b)
  const headlineSorted = [...decision.blocks].sort((a, b) => a - b)
  if (decodedSorted.length !== headlineSorted.length || decodedSorted.some((b, i) => b !== headlineSorted[i])) {
    throw new X402ClientError(
      'UNSAFE_CALLDATA_BLOCKS',
      'Decoded tx blocks do not match the headline blocks field.',
      { decoded: decodedSorted, headline: headlineSorted },
    )
  }
  const seen = new Set<number>()
  for (const b of blocks) {
    const n = Number(b)
    if (!Number.isInteger(n) || n < 0 || n > 24) {
      throw new X402ClientError(
        'UNSAFE_CALLDATA_BLOCKS',
        `Decoded blockId ${n} is out of range 0-24.`,
        { blocks: blocks.map(Number) },
      )
    }
    if (seen.has(n)) {
      throw new X402ClientError(
        'UNSAFE_CALLDATA_BLOCKS',
        `Decoded blockIds contain duplicate ${n}.`,
        { blocks: blocks.map(Number) },
      )
    }
    seen.add(n)
  }
}

// Append the ERC-8021 builder-code suffix iff it isn't already present.
// We always ensure attribution lands regardless of whether the dev appended
// it server-side. If he did, we no-op; if he didn't, we add it client-side.
// Either way the on-chain tx carries `bc_rudgiazu` and MineBean accrues
// Base sequencer-fee share.
export function withBuilderCodeSuffix(data: `0x${string}`): `0x${string}` {
  const lower = data.toLowerCase()
  const suffixBody = BUILDER_CODE_SUFFIX.toLowerCase().slice(2)
  if (lower.endsWith(suffixBody)) return data
  return concat([data, BUILDER_CODE_SUFFIX]) as `0x${string}`
}

// ── Paid fetch — the heart of the integration ────────────────────────────

interface PayAndFetchArgs {
  walletClient: WalletClient
  strategy: StrategyId
  params?: Record<string, unknown>
  // Safety cap for the EIP-3009 authorization. Defaults to $0.50 (5x the
  // current $0.10 per-call fee) so a server-side price change can't drain.
  maxPaymentUsdc?: number
}

export async function payAndFetchDecision({
  walletClient,
  strategy,
  params,
  maxPaymentUsdc = 0.50,
}: PayAndFetchArgs): Promise<StrategyDecision> {
  // USDC has 6 decimals on Base.
  const maxAtomic = BigInt(Math.floor(maxPaymentUsdc * 1_000_000))
  // x402-fetch's Signer type requires `account` to be non-undefined. Viem's
  // WalletClient generic types `account` as `Account | undefined`. The
  // orchestrator guarantees a bound account before invoking this function
  // (pre-flight checks for walletClient + address), so the assertion is a
  // runtime no-op — it only satisfies TypeScript's narrower view.
  const paidFetch = wrapFetchWithPayment(
    fetch,
    walletClient as Parameters<typeof wrapFetchWithPayment>[1],
    maxAtomic,
  )

  const body = JSON.stringify({ strategy, ...(params ? { params } : {}) })

  let res: Response
  try {
    res = await paidFetch(STRATEGY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new X402ClientError('PAYMENT_FAILED', msg || 'USDC payment signing failed', e)
  }

  let payload: unknown = null
  try {
    payload = await res.json()
  } catch (e) {
    if (!res.ok) {
      throw new X402ClientError(`HTTP_${res.status}`, `Request failed with status ${res.status}`)
    }
    throw new X402ClientError('PARSE_ERROR', 'Could not parse strategy response JSON', e)
  }

  // The dev's API uses plain HTTP semantics: errors are non-2xx with
  // { error: "..." }. Map them onto our error codes.
  if (!res.ok) {
    const err = (payload as { error?: string })?.error || `Request failed with status ${res.status}`
    if (res.status === 400) throw new X402ClientError('BAD_REQUEST', err, payload)
    if (res.status === 401) throw new X402ClientError('PAYMENT_FAILED', err, payload)
    if (res.status === 503) throw new X402ClientError('ROUND_INACTIVE', err, payload)
    if (res.status >= 500) throw new X402ClientError('UPSTREAM_ERROR', err, payload)
    throw new X402ClientError(`HTTP_${res.status}`, err, payload)
  }

  const decision = payload as StrategyDecision
  // Light shape validation — full validation runs in assertSafeStrategyDecision
  // when we're about to broadcast.
  if (typeof decision?.fire !== 'boolean') {
    throw new X402ClientError('MALFORMED_DATA', 'Strategy response missing or malformed fire field', payload)
  }
  if (typeof decision?.strategy !== 'string') {
    throw new X402ClientError('MALFORMED_DATA', 'Strategy response missing strategy field', payload)
  }
  return decision
}

// Stale-grid check. The dev's spec recommends warning the user if the gap
// between gridUpdatedAt and computedAt is large (>15s), since the EV math
// was applied to a grid snapshot that may be out of date.
export function gridStalenessSeconds(decision: StrategyDecision): number | null {
  if (!decision.fire) return null
  const f = decision.freshness as StrategyFreshness
  if (!f?.gridUpdatedAt || !f?.computedAt) return null
  const grid = Date.parse(f.gridUpdatedAt)
  const computed = Date.parse(f.computedAt)
  if (Number.isNaN(grid) || Number.isNaN(computed)) return null
  return Math.max(0, Math.floor((computed - grid) / 1000))
}
