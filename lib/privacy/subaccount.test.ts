import { describe, it, expect, vi } from 'vitest'
import { keccak256, toHex, type Hex, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  SUBACCOUNT_DERIVATION_VERSION,
  buildDerivationMessage,
  derivePrivateKeyFromSignature,
  deriveSubaccount,
  subaccountAddressFromSignature,
  isDeterminismAssumedSafe,
} from './subaccount'

const MAIN = '0xAbC0000000000000000000000000000000000001' as Address
// A deterministic, non-trivial "signature" (any hex works for derivation).
const SIG_A = keccak256(toHex('signature-a')) as Hex
const SIG_B = keccak256(toHex('signature-b')) as Hex

describe('buildDerivationMessage', () => {
  it('is deterministic for the same (version, address)', () => {
    expect(buildDerivationMessage(MAIN)).toBe(buildDerivationMessage(MAIN))
  })

  it('lowercases the address so checksum casing cannot change the bytes', () => {
    const lower = MAIN.toLowerCase() as Address
    expect(buildDerivationMessage(MAIN)).toBe(buildDerivationMessage(lower))
    expect(buildDerivationMessage(MAIN)).toContain(MAIN.toLowerCase())
  })

  it('embeds the version and changes when version changes', () => {
    expect(buildDerivationMessage(MAIN, 1)).toContain('Version: 1')
    expect(buildDerivationMessage(MAIN, 1)).not.toBe(buildDerivationMessage(MAIN, 2))
  })

  it('defaults to the current scheme version', () => {
    expect(buildDerivationMessage(MAIN)).toContain(`Version: ${SUBACCOUNT_DERIVATION_VERSION}`)
  })

  it('states the no-broadcast invariant to the user', () => {
    expect(buildDerivationMessage(MAIN).toLowerCase()).toContain('never broadcast')
  })
})

describe('derivePrivateKeyFromSignature', () => {
  it('produces a valid 32-byte (66-char) hex key', () => {
    const key = derivePrivateKeyFromSignature(SIG_A)
    expect(key).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('is deterministic: same signature → same key', () => {
    expect(derivePrivateKeyFromSignature(SIG_A)).toBe(derivePrivateKeyFromSignature(SIG_A))
  })

  it('different signatures → different keys', () => {
    expect(derivePrivateKeyFromSignature(SIG_A)).not.toBe(derivePrivateKeyFromSignature(SIG_B))
  })

  it('equals keccak256(signature)', () => {
    expect(derivePrivateKeyFromSignature(SIG_A)).toBe(keccak256(SIG_A))
  })

  it('rejects malformed input', () => {
    expect(() => derivePrivateKeyFromSignature('' as Hex)).toThrow()
    expect(() => derivePrivateKeyFromSignature('deadbeef' as Hex)).toThrow()
  })

  it('yields a usable viem account', () => {
    const key = derivePrivateKeyFromSignature(SIG_A)
    const acct = privateKeyToAccount(key)
    expect(acct.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })
})

describe('subaccountAddressFromSignature', () => {
  it('matches the address from the full derivation path', () => {
    const key = derivePrivateKeyFromSignature(SIG_A)
    const expected = privateKeyToAccount(key).address
    expect(subaccountAddressFromSignature(SIG_A)).toBe(expected)
  })
})

describe('deriveSubaccount', () => {
  it('signs the canonical message and returns a matching account', async () => {
    const signMessage = vi.fn(async () => SIG_A)
    const sub = await deriveSubaccount({ mainAddress: MAIN, signMessage })

    expect(signMessage).toHaveBeenCalledOnce()
    expect(signMessage).toHaveBeenCalledWith({ message: buildDerivationMessage(MAIN) })
    expect(sub.address).toBe(subaccountAddressFromSignature(SIG_A))
    expect(sub.account.address).toBe(sub.address)
    expect(sub.privateKey).toBe(derivePrivateKeyFromSignature(SIG_A))
    expect(sub.version).toBe(SUBACCOUNT_DERIVATION_VERSION)
  })

  it('is stable across sessions when the wallet re-signs the same message', async () => {
    const signMessage = vi.fn(async () => SIG_A)
    const first = await deriveSubaccount({ mainAddress: MAIN, signMessage })
    const second = await deriveSubaccount({ mainAddress: MAIN, signMessage })
    expect(first.address).toBe(second.address)
    expect(first.privateKey).toBe(second.privateKey)
  })

  it('passes the version through into the signed message', async () => {
    const signMessage = vi.fn(async () => SIG_B)
    await deriveSubaccount({ mainAddress: MAIN, signMessage, version: 2 })
    expect(signMessage).toHaveBeenCalledWith({ message: buildDerivationMessage(MAIN, 2) })
  })
})

describe('isDeterminismAssumedSafe', () => {
  it('is true for known RFC-6979 connectors', () => {
    expect(isDeterminismAssumedSafe('metaMask')).toBe(true)
    expect(isDeterminismAssumedSafe('io.rabby')).toBe(true)
    expect(isDeterminismAssumedSafe('coinbaseWalletSDK')).toBe(true)
  })

  it('is false for unknown or missing connectors', () => {
    expect(isDeterminismAssumedSafe('walletConnect')).toBe(false)
    expect(isDeterminismAssumedSafe(undefined)).toBe(false)
  })
})
