/**
 * BEAN Private Deploys — deposit helpers
 *
 * The deposit itself is an ordinary PUBLIC transaction from the MAIN wallet:
 * `Entrypoint.deposit{value}(precommitment)` (sent via wagmi by the caller).
 * This module prepares the wallet-derived precommitment and turns the receipt
 * into a stored note.
 *
 * The precommitment MUST come from wallet-derived secrets (keys.ts) — that is
 * what makes the note recoverable by re-signing. Never random.
 */

import { decodeEventLog, type TransactionReceipt } from 'viem'
import type { Address } from 'viem'
import type { MasterKeys } from '@0xbow/privacy-pools-core-sdk'
import { POOL_DEPOSITED_EVENT_ABI, poolFor, type PoolConfig } from './config'
import { depositSecretsAt, type DepositSecrets } from './keys'
import {
  nextDepositIndex,
  type PrivateNote,
  type NotePurpose,
  type NoteDepositor,
} from './notes'

export interface PreparedDeposit {
  /** Derivation index this deposit's secrets were generated at. */
  depositIndex: number
  /** Wallet-derived secrets + precommitment (keep in memory only). */
  secrets: DepositSecrets
}

/**
 * Derive the secrets for the user's NEXT deposit into `pool`. Secrets are
 * scope-bound, so the pool's scope is part of the derivation. The returned
 * `secrets.precommitment` is the uint256 argument for `Entrypoint.deposit`.
 */
export async function prepareDeposit(
  keys: MasterKeys,
  main: Address,
  pool: PoolConfig
): Promise<PreparedDeposit> {
  const depositIndex = nextDepositIndex(main, pool.key)
  const secrets = await depositSecretsAt(keys, pool.scope, BigInt(depositIndex))
  return { depositIndex, secrets }
}

/**
 * Decode the pool's `Deposited` event out of the deposit receipt and build
 * the note to persist. Sanity-checks that the on-chain commitment matches the
 * one recomputed from our secrets — a mismatch means the derivation is wrong
 * and the note would be unspendable, so we throw instead of storing it.
 */
export async function extractNoteFromReceipt(
  receipt: TransactionReceipt,
  prepared: PreparedDeposit,
  tags: { purpose?: NotePurpose; depositor?: NoteDepositor; pool?: PoolConfig['key'] } = {}
): Promise<PrivateNote> {
  const pool = poolFor(tags.pool)
  let decoded:
    | { commitment: bigint; label: bigint; value: bigint; precommitmentHash: bigint }
    | undefined

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== pool.address.toLowerCase()) continue
    try {
      const d = decodeEventLog({
        abi: POOL_DEPOSITED_EVENT_ABI,
        data: log.data,
        topics: log.topics,
      })
      if (d.eventName === 'Deposited') {
        decoded = {
          commitment: d.args._commitment,
          label: d.args._label,
          value: d.args._value,
          precommitmentHash: d.args._precommitmentHash,
        }
        break
      }
    } catch {
      // not the Deposited event — keep scanning
    }
  }

  if (!decoded) {
    throw new Error(
      'deposit receipt contains no pool Deposited event — wrong contract or failed tx'
    )
  }

  if (decoded.precommitmentHash !== (prepared.secrets.precommitment as bigint)) {
    throw new Error(
      'on-chain precommitment does not match derived secrets — refusing to store note'
    )
  }

  // Recompute the full commitment hash from our secrets and compare with the
  // leaf the pool inserted (same check the CLI reference performs).
  const sdk = await import('@0xbow/privacy-pools-core-sdk')
  const recomputed = sdk.getCommitment(
    decoded.value,
    decoded.label,
    prepared.secrets.nullifier,
    prepared.secrets.secret
  )
  if ((recomputed.hash as bigint) !== decoded.commitment) {
    throw new Error(
      'recomputed commitment does not match on-chain commitment — refusing to store note'
    )
  }

  return {
    label: decoded.label.toString(),
    value: decoded.value.toString(),
    commitment: decoded.commitment.toString(),
    depositIndex: prepared.depositIndex,
    spent: false,
    txHash: receipt.transactionHash,
    createdAt: Date.now(),
    purpose: tags.purpose ?? 'funding',
    depositor: tags.depositor ?? 'main',
    pool: pool.key,
  }
}
