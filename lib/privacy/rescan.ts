/**
 * BEAN Private Deploys — note recovery rescan
 *
 * Rebuilds the local note cache purely from the chain + the wallet-derived
 * keys, for when localStorage is wiped (or the user moves browsers):
 *
 *   1. Per pool (ETH and BEAN): eth_getLogs for that pool's `Deposited` events
 *      filtered by `_depositor ∈ {main, subaccount}` (indexed param — the RPC
 *      filters), from that pool's deploy block. BOTH depositors matter:
 *      FUNDING deposits are signed by main, CASHOUT deposits by the subaccount
 *      (the pool records `depositors[label] = msg.sender`, which ragequit checks).
 *   2. For each event, recompute precommitments at derivation index 0..N using
 *      THAT pool's scope and match against `_precommitmentHash` to recover the
 *      index (each pool has its own per-scope index sequence).
 *   3. Spent detection: a note is spent iff its nullifier hash is flagged in
 *      that pool's `nullifierHashes` mapping — one eth_call each.
 *
 * This is the recovery path only — the live flow keeps notes in localStorage.
 */

import { parseAbiItem, type Address } from 'viem'
import type { MasterKeys, Hash } from '@0xbow/privacy-pools-core-sdk'
import { POOLS, type PoolConfig } from './config'
import { getPrivacyPublicClient } from './subaccountClient'
import { replaceNotes, type PrivateNote, type NoteDepositor } from './notes'

const DEPOSITED_EVENT = parseAbiItem(
  'event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)'
)

/** State.nullifierHashes(uint256) — true once a commitment has been spent. */
const NULLIFIER_HASHES_ABI = [
  {
    type: 'function',
    name: 'nullifierHashes',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

/**
 * Scan the chain for the main wallet's deposits, re-derive their indices,
 * and replace the local note cache. Returns the recovered notes.
 *
 * `extraIndexSlack` covers deposits whose notes were never stored locally
 * (indices are probed up to count + slack).
 */
type Poseidon = (inputs: bigint[]) => bigint
type SdkCrypto = typeof import('@0xbow/privacy-pools-core-sdk')

/** Scan a single pool for the user's deposits and return recovered notes. */
async function rescanPool(
  pool: PoolConfig,
  main: Address,
  subaccount: Address,
  keys: MasterKeys,
  sdk: SdkCrypto,
  poseidon: Poseidon,
  extraIndexSlack: number
): Promise<PrivateNote[]> {
  const client = getPrivacyPublicClient()
  const mainLower = main.toLowerCase()

  // OR-match both depositors on the indexed topic in a single query.
  const logs = await client.getLogs({
    address: pool.address,
    event: DEPOSITED_EVENT,
    args: { _depositor: [main, subaccount] },
    fromBlock: pool.deployBlock,
    toBlock: 'latest',
  })

  // Candidate precommitments for indices 0..N+slack, derived with THIS pool's
  // scope (each pool has its own index sequence).
  const maxIndex = logs.length + extraIndexSlack
  const byPrecommitment = new Map<bigint, { index: number; nullifier: bigint }>()
  for (let i = 0; i < maxIndex; i++) {
    const { nullifier, secret } = sdk.generateDepositSecrets(
      keys,
      pool.scope as unknown as Hash,
      BigInt(i)
    )
    const pre = sdk.hashPrecommitment(nullifier, secret) as bigint
    byPrecommitment.set(pre, { index: i, nullifier: nullifier as bigint })
  }

  const notes: PrivateNote[] = []
  for (const log of logs) {
    const { _depositor, _commitment, _label, _value, _precommitmentHash } = log.args
    if (
      _depositor === undefined ||
      _commitment === undefined ||
      _label === undefined ||
      _value === undefined ||
      _precommitmentHash === undefined
    ) {
      continue
    }
    const match = byPrecommitment.get(_precommitmentHash)
    if (!match) continue

    let spent = false
    try {
      spent = await client.readContract({
        address: pool.address,
        abi: NULLIFIER_HASHES_ABI,
        functionName: 'nullifierHashes',
        args: [poseidon([match.nullifier])],
      })
    } catch {
      // Conservative: leave unspent if the check fails (chain enforces truth).
    }

    const isMain = _depositor.toLowerCase() === mainLower
    const depositor: NoteDepositor = isMain ? 'main' : 'subaccount'

    notes.push({
      label: _label.toString(),
      value: _value.toString(),
      commitment: _commitment.toString(),
      depositIndex: match.index,
      spent,
      txHash: log.transactionHash,
      createdAt: Date.now(),
      // main = funding, subaccount = cashout.
      purpose: isMain ? 'funding' : 'cashout',
      depositor,
      pool: pool.key,
    })
  }
  return notes
}

/**
 * Scan BOTH pools for the user's deposits, re-derive their indices, and
 * replace the local note cache. Returns the recovered notes.
 *
 * `extraIndexSlack` covers deposits whose notes were never stored locally
 * (indices probed up to per-pool count + slack).
 */
export async function rescanNotes(params: {
  keys: MasterKeys
  main: Address
  /** Subaccount address — its deposits are the CASHOUT notes. */
  subaccount: Address
  extraIndexSlack?: number
}): Promise<PrivateNote[]> {
  const { keys, main, subaccount, extraIndexSlack = 5 } = params
  const sdk = await import('@0xbow/privacy-pools-core-sdk')
  // The on-chain spent marker is poseidon1(nullifier) (withdraw.circom).
  const { poseidon } = await import('maci-crypto/build/ts/hashing.js')

  const perPool = await Promise.all(
    Object.values(POOLS).map((pool) =>
      rescanPool(pool, main, subaccount, keys, sdk, poseidon, extraIndexSlack)
    )
  )

  const notes = perPool.flat().sort((a, b) => a.depositIndex - b.depositIndex)
  replaceNotes(main, notes)
  return notes
}
