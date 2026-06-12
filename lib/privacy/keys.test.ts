import { describe, it, expect, beforeAll } from 'vitest'
import { keccak256, toHex, type Hex } from 'viem'
import {
  DEPOSIT_KEYS_DOMAIN,
  deriveDepositEntropy,
  depositMnemonicFromSignature,
  deriveDepositMasterKeys,
  depositSecretsAt,
  withdrawalSecretsAt,
} from './keys'
import { derivePrivateKeyFromSignature } from './subaccount'

// Deterministic, non-trivial "signatures" (any hex works for derivation).
const SIG_A = keccak256(toHex('signature-a')) as Hex
const SIG_B = keccak256(toHex('signature-b')) as Hex

// First call pays the SDK dynamic import + HD/poseidon init, which can blow
// the default 5s timeout when the whole suite runs in parallel.
beforeAll(async () => {
  await deriveDepositMasterKeys(SIG_A)
}, 60_000)

describe('deriveDepositEntropy', () => {
  it('produces 32 bytes of hex', () => {
    expect(deriveDepositEntropy(SIG_A)).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('is deterministic', () => {
    expect(deriveDepositEntropy(SIG_A)).toBe(deriveDepositEntropy(SIG_A))
  })

  it('differs across signatures', () => {
    expect(deriveDepositEntropy(SIG_A)).not.toBe(deriveDepositEntropy(SIG_B))
  })

  it('is domain-separated from the subaccount key (keccak256(sig))', () => {
    expect(deriveDepositEntropy(SIG_A)).not.toBe(
      derivePrivateKeyFromSignature(SIG_A)
    )
  })

  it('pins the v1 domain string (spec must never change within a version)', () => {
    expect(DEPOSIT_KEYS_DOMAIN).toBe('BEAN/privacy/deposit-keys/v1')
  })

  it('rejects malformed input', () => {
    expect(() => deriveDepositEntropy('' as Hex)).toThrow()
    expect(() => deriveDepositEntropy('deadbeef' as Hex)).toThrow()
  })
})

describe('depositMnemonicFromSignature', () => {
  it('yields a deterministic 24-word mnemonic', () => {
    const m = depositMnemonicFromSignature(SIG_A)
    expect(m.split(' ')).toHaveLength(24)
    expect(depositMnemonicFromSignature(SIG_A)).toBe(m)
    expect(depositMnemonicFromSignature(SIG_B)).not.toBe(m)
  })
})

describe('deriveDepositMasterKeys', () => {
  it('is deterministic and signature-bound', async () => {
    const a1 = await deriveDepositMasterKeys(SIG_A)
    const a2 = await deriveDepositMasterKeys(SIG_A)
    const b = await deriveDepositMasterKeys(SIG_B)
    expect(a1.masterNullifier).toBe(a2.masterNullifier)
    expect(a1.masterSecret).toBe(a2.masterSecret)
    expect(a1.masterNullifier).not.toBe(b.masterNullifier)
    expect(typeof a1.masterNullifier).toBe('bigint')
  })

  it('nullifier and secret keys are distinct', async () => {
    const keys = await deriveDepositMasterKeys(SIG_A)
    expect(keys.masterNullifier).not.toBe(keys.masterSecret)
  })
})

describe('depositSecretsAt', () => {
  const SCOPE_A = 111n
  const SCOPE_B = 222n

  it('is stable per (scope,index) and distinct across indices', async () => {
    const keys = await deriveDepositMasterKeys(SIG_A)
    const i0a = await depositSecretsAt(keys, SCOPE_A, 0n)
    const i0b = await depositSecretsAt(keys, SCOPE_A, 0n)
    const i1 = await depositSecretsAt(keys, SCOPE_A, 1n)
    expect(i0a.nullifier).toBe(i0b.nullifier)
    expect(i0a.secret).toBe(i0b.secret)
    expect(i0a.precommitment).toBe(i0b.precommitment)
    expect(i0a.nullifier).not.toBe(i1.nullifier)
    expect(i0a.precommitment).not.toBe(i1.precommitment)
  })

  it('differs across scopes at the same index (ETH vs BEAN pool)', async () => {
    const keys = await deriveDepositMasterKeys(SIG_A)
    const a = await depositSecretsAt(keys, SCOPE_A, 0n)
    const b = await depositSecretsAt(keys, SCOPE_B, 0n)
    expect(a.precommitment).not.toBe(b.precommitment)
  })
})

describe('withdrawalSecretsAt', () => {
  it('is stable per (label, index) and distinct across labels', async () => {
    const keys = await deriveDepositMasterKeys(SIG_A)
    const w1 = await withdrawalSecretsAt(keys, 123n, 0n)
    const w2 = await withdrawalSecretsAt(keys, 123n, 0n)
    const w3 = await withdrawalSecretsAt(keys, 456n, 0n)
    expect(w1.nullifier).toBe(w2.nullifier)
    expect(w1.secret).toBe(w2.secret)
    expect(w1.nullifier).not.toBe(w3.nullifier)
  })
})
