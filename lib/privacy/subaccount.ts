/**
 * BEAN Private Deploys — Subaccount derivation (Phase 1)
 *
 * Derives a self-custodial "subaccount" EOA deterministically from a single
 * signature by the user's main wallet. This is the core of the UI-only flow:
 * the user connects ONE wallet, signs ONE message, and the dapp computes a
 * private playing account entirely in the browser — no import, no seed phrase.
 *
 * SECURITY INVARIANTS (from the approved plan):
 *  1. The derivation signature is signed locally and MUST NEVER be broadcast in
 *     a transaction or sent to a server. `ecrecover` can only recover a
 *     signature that appears in calldata; keep it in the browser and this stays
 *     unlinkable to the main wallet. These functions are PURE and do no I/O —
 *     do not log, POST, or persist the raw signature.
 *  2. The subaccount is independent: it signs and submits its OWN transactions.
 *     Nothing here ever asks the main wallet to sign "on behalf of" it.
 *  3. Determinism: re-signing the same message must reproduce the same key, so
 *     the message is a FIXED function of (version, mainAddress) — no nonces, no
 *     timestamps. Recovery = reconnect main + re-sign.
 *
 * DETERMINISM CAVEAT: this relies on the wallet producing deterministic ECDSA
 * signatures (RFC 6979) for `personal_sign`. MetaMask / Coinbase / Rabby do.
 * For wallets that don't, the derived key must instead be persisted (encrypted)
 * on first creation rather than re-derived — see `isDeterminismAssumedSafe`.
 */

import { keccak256, type Hex, type Address } from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

/** Current derivation scheme version. Bump to rotate every user's subaccount. */
export const SUBACCOUNT_DERIVATION_VERSION = 1

/** secp256k1 curve order (n). A valid private key is in [1, n-1]. */
const SECP256K1_N = BigInt(
  '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
)

/**
 * Wallets known to produce deterministic (RFC 6979) signatures, for which
 * re-derivation is safe. Others should fall back to encrypted key storage.
 */
const DETERMINISTIC_CONNECTOR_IDS = new Set([
  'metaMask',
  'io.metamask',
  'coinbaseWallet',
  'coinbaseWalletSDK',
  'rabby',
  'io.rabby',
])

/**
 * Build the canonical message the main wallet signs to derive its subaccount.
 *
 * Must be a pure, stable function of (version, mainAddress) so re-signing
 * reproduces the same key. The address is lowercased so checksum casing from
 * different callers cannot change the bytes signed.
 */
export function buildDerivationMessage(
  mainAddress: Address,
  version: number = SUBACCOUNT_DERIVATION_VERSION
): string {
  const addr = mainAddress.toLowerCase()
  return [
    'BEAN Private Account',
    `Version: ${version}`,
    '',
    'Signing this derives your private playing account.',
    'It is computed locally in your browser and is NEVER broadcast or shared.',
    'Only sign this in the official BEAN app.',
    '',
    `Main wallet: ${addr}`,
  ].join('\n')
}

/**
 * Derive a 32-byte secp256k1 private key from a main-wallet signature.
 *
 * key = keccak256(signature), validated to lie in [1, n-1]. The out-of-range
 * case is astronomically unlikely (~2^-128); if it ever occurs, bump the
 * derivation version to re-sign a different message.
 *
 * @param signature The raw hex signature returned by the wallet (e.g. 65 bytes).
 *                  NEVER transmit this value.
 */
export function derivePrivateKeyFromSignature(signature: Hex): Hex {
  if (!signature || !signature.startsWith('0x') || signature.length < 4) {
    throw new Error('derivePrivateKeyFromSignature: invalid signature input')
  }
  const key = keccak256(signature)
  const asInt = BigInt(key)
  if (asInt === BigInt(0) || asInt >= SECP256K1_N) {
    // Practically unreachable; guarded for correctness.
    throw new Error(
      'derivePrivateKeyFromSignature: derived key out of secp256k1 range — bump derivation version'
    )
  }
  return key
}

/** A derived subaccount: the viem account plus the scheme version used. */
export interface Subaccount {
  /** viem account that signs/sends the subaccount's own transactions. */
  account: PrivateKeyAccount
  /** Subaccount EOA address. */
  address: Address
  /** Raw private key. Sensitive — keep in memory / encrypted storage only. */
  privateKey: Hex
  /** Derivation scheme version this key was produced with. */
  version: number
}

/**
 * Async signer the caller supplies — typically wagmi's `signMessageAsync`
 * bound to the main wallet. It must sign LOCALLY and return the raw signature;
 * the returned value must not be sent anywhere by the caller.
 */
export type SignMessageFn = (args: { message: string }) => Promise<Hex>

/**
 * Derive the subaccount for a given main wallet.
 *
 * Flow: build canonical message → main wallet signs it locally (one popup,
 * no gas, never broadcast) → keccak256 → private key → viem account.
 */
export async function deriveSubaccount(params: {
  mainAddress: Address
  signMessage: SignMessageFn
  version?: number
}): Promise<Subaccount> {
  const version = params.version ?? SUBACCOUNT_DERIVATION_VERSION
  const message = buildDerivationMessage(params.mainAddress, version)
  const signature = await params.signMessage({ message })
  const privateKey = derivePrivateKeyFromSignature(signature)
  const account = privateKeyToAccount(privateKey)
  return { account, address: account.address, privateKey, version }
}

/**
 * Compute the subaccount address that a given signature would yield, without
 * constructing a full signer. Useful for previewing / matching an address.
 */
export function subaccountAddressFromSignature(signature: Hex): Address {
  const privateKey = derivePrivateKeyFromSignature(signature)
  return privateKeyToAccount(privateKey).address
}

/**
 * Whether re-derivation is safe for a given wagmi connector id. If false, the
 * caller should persist the derived key (encrypted) on first creation instead
 * of re-deriving on later sessions.
 */
export function isDeterminismAssumedSafe(connectorId?: string): boolean {
  if (!connectorId) return false
  return DETERMINISTIC_CONNECTOR_IDS.has(connectorId)
}
