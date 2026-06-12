import { describe, it, expect } from 'vitest'
import { decodeAbiParameters, type Address } from 'viem'
import {
  buildWithdrawal,
  buildStateProof,
  stateRootOf,
  buildAspProof,
} from './withdrawal'
import { ENTRYPOINT_ADDRESS, FEE_DATA_ABI } from './config'

const SUB = '0x1111111111111111111111111111111111111111' as Address

describe('buildWithdrawal', () => {
  it('targets the entrypoint and encodes the recipient with zero fee', () => {
    const w = buildWithdrawal(SUB)
    expect(w.processooor).toBe(ENTRYPOINT_ADDRESS)
    const [decoded] = decodeAbiParameters(FEE_DATA_ABI, w.data)
    expect(decoded.recipient.toLowerCase()).toBe(SUB.toLowerCase())
    // feeRecipient must NOT be the Entrypoint (its receive() rejects ETH, so
    // the zero-fee transfer would revert). Point it at the recipient EOA.
    expect(decoded.feeRecipient.toLowerCase()).toBe(SUB.toLowerCase())
    expect(decoded.relayFeeBPS).toBe(0n)
  })
})

describe('buildStateProof', () => {
  it('captures depth before padding and pads siblings to exactly 32', async () => {
    const leaves = [1n, 2n, 3n]
    const state = await buildStateProof(leaves, 2n)
    // 3-leaf LeanIMT has depth 2.
    expect(state.depth).toBe(2n)
    expect(state.proof.siblings).toHaveLength(32)
    // Padding is zeros beyond the real depth.
    expect(state.proof.siblings.slice(2).every((s) => s === 0n)).toBe(true)
    expect(state.proof.leaf).toBe(2n)
    expect(state.root).toBe(await stateRootOf(leaves))
  })

  it('handles the single-leaf tree (first deposit): depth 0, root = leaf', async () => {
    const state = await buildStateProof([42n], 42n)
    expect(state.depth).toBe(0n)
    expect(state.root).toBe(42n)
    expect(state.proof.siblings).toHaveLength(32)
  })

  it('throws when the commitment is not in the pool state', async () => {
    await expect(buildStateProof([1n, 2n], 99n)).rejects.toThrow(
      /not found in pool state/
    )
  })
})

describe('stateRootOf', () => {
  it('changes when the leaf set changes (staleness signal)', async () => {
    const a = await stateRootOf([1n, 2n])
    const b = await stateRootOf([1n, 2n, 3n])
    expect(a).not.toBe(b)
  })
})

describe('buildAspProof', () => {
  it('maps the relayer response to bigint circuit inputs', () => {
    const asp = buildAspProof(
      { root: '99', depth: 1, index: 0, siblings: ['7', ...Array(31).fill('0')] },
      '123'
    )
    expect(asp.root).toBe(99n)
    expect(asp.depth).toBe(1n)
    expect(asp.proof.leaf).toBe(123n)
    expect(asp.proof.index).toBe(0)
    expect(asp.proof.siblings[0]).toBe(7n)
    expect(asp.proof.siblings).toHaveLength(32)
  })
})
