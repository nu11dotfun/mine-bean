import { describe, it, expect, beforeEach } from 'vitest'
import type { Address } from 'viem'
import {
  type CachedProof,
  loadProof,
  saveProof,
  clearProof,
  isProofCurrent,
} from './proofCache'

const MAIN = '0xabc0000000000000000000000000000000000001' as Address
const SUB = '0x1111111111111111111111111111111111111111' as Address

const entry = (overrides: Partial<CachedProof> = {}): CachedProof => ({
  noteLabel: '123',
  withdrawal: {
    processooor: '0xF1310bB55EA962C56Ed67D15c79C7b0f5055d370',
    data: '0xdead',
  },
  proof: {
    proof: {
      pi_a: ['1', '2'],
      pi_b: [
        ['3', '4'],
        ['5', '6'],
      ],
      pi_c: ['7', '8'],
      protocol: 'groth16',
      curve: 'bn128',
    },
    publicSignals: ['9'],
  },
  stateRoot: '111',
  aspRoot: '222',
  subaccountAddress: SUB,
  generatedAt: 1700000000000,
  ...overrides,
})

const check = {
  currentStateRoot: '111',
  currentAspRoot: '222',
  noteLabel: '123',
  subaccountAddress: SUB,
}

beforeEach(() => {
  window.sessionStorage.clear()
})

describe('proof cache', () => {
  it('round-trips through sessionStorage', () => {
    expect(loadProof(MAIN)).toBeNull()
    saveProof(MAIN, entry())
    expect(loadProof(MAIN)).toEqual(entry())
    clearProof(MAIN)
    expect(loadProof(MAIN)).toBeNull()
  })

  it('is keyed per main address', () => {
    saveProof(MAIN, entry())
    expect(loadProof(SUB as Address)).toBeNull()
  })

  it('stores no keys or secrets (only calldata-bound fields)', () => {
    saveProof(MAIN, entry())
    const raw = window.sessionStorage.getItem(
      `bean_privacy_proof_v2_${MAIN.toLowerCase()}`
    )!
    const keys = Object.keys(JSON.parse(raw))
    expect(keys.sort()).toEqual(
      [
        'aspRoot',
        'generatedAt',
        'noteLabel',
        'proof',
        'stateRoot',
        'subaccountAddress',
        'withdrawal',
      ].sort()
    )
    expect(raw).not.toMatch(/nullifier|secret|privateKey|mnemonic/i)
  })

  it('treats corrupt entries as cache misses', () => {
    window.sessionStorage.setItem(
      `bean_privacy_proof_v2_${MAIN.toLowerCase()}`,
      '{"withdrawal":{}}'
    )
    expect(loadProof(MAIN)).toBeNull()
  })
})

describe('isProofCurrent', () => {
  it('accepts a matching entry', () => {
    expect(isProofCurrent(entry(), check)).toBe(true)
  })

  it('rejects null', () => {
    expect(isProofCurrent(null, check)).toBe(false)
  })

  it('rejects when the state root moved (any pool activity)', () => {
    expect(isProofCurrent(entry({ stateRoot: '999' }), check)).toBe(false)
  })

  it('rejects when the ASP root moved (new approval)', () => {
    expect(isProofCurrent(entry({ aspRoot: '999' }), check)).toBe(false)
  })

  it('rejects when the note differs', () => {
    expect(isProofCurrent(entry({ noteLabel: '999' }), check)).toBe(false)
  })

  it('rejects when the recipient differs (case-insensitive match)', () => {
    expect(
      isProofCurrent(
        entry({ subaccountAddress: SUB.toUpperCase().replace('0X', '0x') as Address }),
        check
      )
    ).toBe(true)
    expect(
      isProofCurrent(
        entry({
          subaccountAddress: '0x2222222222222222222222222222222222222222' as Address,
        }),
        check
      )
    ).toBe(false)
  })
})
