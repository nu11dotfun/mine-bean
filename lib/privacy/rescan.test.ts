import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Address } from 'viem'

const MAIN = '0xabc0000000000000000000000000000000000001' as Address
const SUB = '0x1111111111111111111111111111111111111111' as Address

// --- mock the chain client (getLogs + nullifierHashes read) ---
const getLogs = vi.fn()
const readContract = vi.fn(async () => false) // unspent
vi.mock('./subaccountClient', () => ({
  getPrivacyPublicClient: () => ({ getLogs, readContract }),
}))

// --- mock the SDK secret derivation so precommitments are predictable ---
// index i → precommitment = 1000+i, nullifier = i.
vi.mock('@0xbow/privacy-pools-core-sdk', () => ({
  generateDepositSecrets: (_k: unknown, _s: unknown, i: bigint) => ({
    nullifier: i,
    secret: i,
  }),
  hashPrecommitment: (n: bigint) => 1000n + n,
}))
vi.mock('maci-crypto/build/ts/hashing.js', () => ({
  poseidon: (inputs: bigint[]) => inputs[0], // identity is fine for the read mock
}))

import { rescanNotes } from './rescan'
import { ETH_POOL, BEAN_POOL } from './config'

const keys = { masterNullifier: 1n, masterSecret: 2n } as any

beforeEach(() => {
  window.localStorage.clear()
  getLogs.mockReset()
  readContract.mockResolvedValue(false)
})

describe('rescanNotes — dual depositor', () => {
  it('queries Deposited for BOTH main and subaccount as depositors', async () => {
    getLogs.mockResolvedValue([])
    await rescanNotes({ keys, main: MAIN, subaccount: SUB })
    const arg = getLogs.mock.calls[0][0]
    expect(arg.args._depositor).toEqual([MAIN, SUB])
  })

  it('tags an ETH main deposit funding and a BEAN subaccount deposit cashout', async () => {
    // ETH pool: a main (funding) deposit. BEAN pool: a subaccount (cashout) deposit.
    getLogs.mockImplementation((args: { address: string }) => {
      if (args.address.toLowerCase() === ETH_POOL.address.toLowerCase()) {
        return [{
          transactionHash: '0xa',
          args: { _depositor: MAIN, _commitment: 11n, _label: 101n, _value: 500n, _precommitmentHash: 1000n },
        }]
      }
      if (args.address.toLowerCase() === BEAN_POOL.address.toLowerCase()) {
        return [{
          transactionHash: '0xb',
          args: { _depositor: SUB, _commitment: 22n, _label: 202n, _value: 400n, _precommitmentHash: 1000n },
        }]
      }
      return []
    })

    const notes = await rescanNotes({ keys, main: MAIN, subaccount: SUB })
    expect(notes).toHaveLength(2)

    const funding = notes.find((n) => n.label === '101')!
    expect(funding.purpose).toBe('funding')
    expect(funding.depositor).toBe('main')
    expect(funding.pool).toBe('eth')

    const cashout = notes.find((n) => n.label === '202')!
    expect(cashout.purpose).toBe('cashout')
    expect(cashout.depositor).toBe('subaccount')
    expect(cashout.pool).toBe('bean')
  })

  it('marks a note spent when its nullifier hash is consumed on-chain', async () => {
    readContract.mockResolvedValue(true)
    getLogs.mockResolvedValue([
      {
        transactionHash: '0xa',
        args: {
          _depositor: MAIN,
          _commitment: 11n,
          _label: 101n,
          _value: 500n,
          _precommitmentHash: 1000n,
        },
      },
    ])
    const notes = await rescanNotes({ keys, main: MAIN, subaccount: SUB })
    expect(notes[0].spent).toBe(true)
  })
})
