import { describe, it, expect, beforeAll } from 'vitest'
import {
  keccak256,
  toHex,
  encodeEventTopics,
  encodeAbiParameters,
  type Hex,
  type Address,
  type TransactionReceipt,
} from 'viem'
import { getCommitment } from '@0xbow/privacy-pools-core-sdk'
import { prepareDeposit, extractNoteFromReceipt } from './deposit'
import { deriveDepositMasterKeys } from './keys'
import { POOL_ADDRESS, POOL_DEPOSITED_EVENT_ABI, ETH_POOL } from './config'

const MAIN = '0xabc0000000000000000000000000000000000001' as Address
const SIG = keccak256(toHex('signature-a')) as Hex
const VALUE = 1_000_000_000_000_000n // 0.001 ETH
const LABEL = 12345n

// Warm the SDK dynamic import + HD/poseidon init so individual tests stay
// under the default timeout during parallel full-suite runs.
beforeAll(async () => {
  await deriveDepositMasterKeys(SIG)
}, 60_000)

/** Build a receipt carrying a pool Deposited log for the given values. */
function receiptWith(args: {
  commitment: bigint
  precommitmentHash: bigint
  address?: Address
}): TransactionReceipt {
  const topics = encodeEventTopics({
    abi: POOL_DEPOSITED_EVENT_ABI,
    eventName: 'Deposited',
    args: { _depositor: MAIN },
  })
  const data = encodeAbiParameters(
    [
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
    ],
    [args.commitment, LABEL, VALUE, args.precommitmentHash]
  )
  return {
    transactionHash: '0xfeedbeef',
    logs: [
      // Unrelated log that must be skipped.
      { address: '0x9999999999999999999999999999999999999999', topics: [], data: '0x' },
      { address: args.address ?? POOL_ADDRESS, topics, data },
    ],
  } as unknown as TransactionReceipt
}

describe('prepareDeposit', () => {
  it('derives index-0 secrets with a precommitment', async () => {
    window.localStorage.clear()
    const keys = await deriveDepositMasterKeys(SIG)
    const prepared = await prepareDeposit(keys, MAIN, ETH_POOL)
    expect(prepared.depositIndex).toBe(0)
    expect(typeof prepared.secrets.precommitment).toBe('bigint')
  })
})

describe('extractNoteFromReceipt', () => {
  it('decodes the Deposited event and returns a verified note', async () => {
    window.localStorage.clear()
    const keys = await deriveDepositMasterKeys(SIG)
    const prepared = await prepareDeposit(keys, MAIN, ETH_POOL)
    const commitment = getCommitment(
      VALUE,
      LABEL,
      prepared.secrets.nullifier,
      prepared.secrets.secret
    )

    const note = await extractNoteFromReceipt(
      receiptWith({
        commitment: commitment.hash as bigint,
        precommitmentHash: prepared.secrets.precommitment as bigint,
      }),
      prepared
    )

    expect(note.label).toBe(LABEL.toString())
    expect(note.value).toBe(VALUE.toString())
    expect(note.commitment).toBe((commitment.hash as bigint).toString())
    expect(note.depositIndex).toBe(0)
    expect(note.spent).toBe(false)
    expect(note.txHash).toBe('0xfeedbeef')
  })

  it('rejects when no pool Deposited log is present', async () => {
    window.localStorage.clear()
    const keys = await deriveDepositMasterKeys(SIG)
    const prepared = await prepareDeposit(keys, MAIN, ETH_POOL)
    const receipt = receiptWith({
      commitment: 1n,
      precommitmentHash: prepared.secrets.precommitment as bigint,
      address: '0x8888888888888888888888888888888888888888',
    })
    await expect(extractNoteFromReceipt(receipt, prepared)).rejects.toThrow(
      /no pool Deposited event/
    )
  })

  it('rejects a precommitment mismatch (wrong derivation)', async () => {
    window.localStorage.clear()
    const keys = await deriveDepositMasterKeys(SIG)
    const prepared = await prepareDeposit(keys, MAIN, ETH_POOL)
    const receipt = receiptWith({ commitment: 1n, precommitmentHash: 777n })
    await expect(extractNoteFromReceipt(receipt, prepared)).rejects.toThrow(
      /precommitment does not match/
    )
  })

  it('rejects a commitment mismatch (unspendable note)', async () => {
    window.localStorage.clear()
    const keys = await deriveDepositMasterKeys(SIG)
    const prepared = await prepareDeposit(keys, MAIN, ETH_POOL)
    const receipt = receiptWith({
      commitment: 999n,
      precommitmentHash: prepared.secrets.precommitment as bigint,
    })
    await expect(extractNoteFromReceipt(receipt, prepared)).rejects.toThrow(
      /recomputed commitment does not match/
    )
  })
})
