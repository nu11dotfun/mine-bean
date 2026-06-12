/**
 * BEAN Private Deploys — Deposit-secret key derivation (wallet-derived)
 *
 * PUBLISHED DERIVATION SPEC (v1) — recovery must be reproducible by any tool:
 *
 *   message    = buildDerivationMessage(mainAddress, 1)        (subaccount.ts)
 *   signature  = personal_sign(message)  — local only, NEVER broadcast/sent
 *   subaccount = keccak256(signature)                          (subaccount.ts)
 *   entropy    = keccak256(signature ‖ utf8("BEAN/privacy/deposit-keys/v1"))
 *   mnemonic   = bip39.entropyToMnemonic(entropy, english)     (24 words)
 *   masterKeys = generateMasterKeys(mnemonic)                  (0xbow PP SDK)
 *   deposit  secrets: generateDepositSecrets(masterKeys, scope, depositIndex)
 *   withdraw secrets: generateWithdrawalSecrets(masterKeys, label, index)
 *
 * SECURITY INVARIANTS (mirror subaccount.ts):
 *  1. The raw signature, entropy, mnemonic, and all derived secrets are
 *     computed locally and MUST NEVER leave the browser — no logging, no
 *     POSTing, no persistence. These functions do no I/O.
 *  2. Everything is deterministic from the one signature: re-sign → same
 *     secrets → user can always recover pool funds (ragequit) with zero
 *     operator infrastructure. NOTHING here may be random.
 *  3. Domain separation: the subaccount key is keccak256(signature) while the
 *     deposit entropy hashes signature ‖ domain-tag, so the two key spaces
 *     never collide. Never change an existing version's domain string — add a
 *     new version instead.
 *
 * The SDK is loaded via a cached dynamic import so snarkjs never enters the
 * app's entry bundle (this module is reachable from the root provider).
 */

import { keccak256, concatHex, stringToHex, hexToBytes, type Hex } from 'viem'
import { entropyToMnemonic } from '@scure/bip39'
import { wordlist as english } from '@scure/bip39/wordlists/english'
import type { MasterKeys, Secret, Hash } from '@0xbow/privacy-pools-core-sdk'

/** Current deposit-key derivation version. Never change v1's domain string. */
export const DEPOSIT_KEYS_DERIVATION_VERSION = 1

/** Domain tag appended to the signature before hashing (v1). */
export const DEPOSIT_KEYS_DOMAIN = 'BEAN/privacy/deposit-keys/v1'

type SdkCrypto = typeof import('@0xbow/privacy-pools-core-sdk')

let sdkCryptoPromise: Promise<SdkCrypto> | null = null

/** Cached dynamic import of the SDK (keeps snarkjs out of the entry bundle). */
function loadSdkCrypto(): Promise<SdkCrypto> {
  sdkCryptoPromise ??= import('@0xbow/privacy-pools-core-sdk')
  return sdkCryptoPromise
}

/**
 * 32 bytes of entropy for the deposit master keys, domain-separated from the
 * subaccount key (which is keccak256(signature) with no tag).
 */
export function deriveDepositEntropy(signature: Hex): Hex {
  if (!signature || !signature.startsWith('0x') || signature.length < 4) {
    throw new Error('deriveDepositEntropy: invalid signature input')
  }
  return keccak256(concatHex([signature, stringToHex(DEPOSIT_KEYS_DOMAIN)]))
}

/** BIP-39 mnemonic (24 words, english) encoding the deposit entropy. */
export function depositMnemonicFromSignature(signature: Hex): string {
  return entropyToMnemonic(hexToBytes(deriveDepositEntropy(signature)), english)
}

/**
 * Derive the deposit master keys from the main-wallet signature.
 * Deterministic; safe to call repeatedly.
 */
export async function deriveDepositMasterKeys(
  signature: Hex
): Promise<MasterKeys> {
  const sdk = await loadSdkCrypto()
  return sdk.generateMasterKeys(depositMnemonicFromSignature(signature))
}

export interface DepositSecrets {
  nullifier: Secret
  secret: Secret
  precommitment: Hash
}

/**
 * Secrets + precommitment for the deposit at `depositIndex` into the pool with
 * `scope` (0-based count of the user's deposits into that scope). The scope is
 * part of the derivation, so ETH and BEAN pools produce different secrets even
 * at the same index.
 */
export async function depositSecretsAt(
  keys: MasterKeys,
  scope: bigint,
  depositIndex: bigint
): Promise<DepositSecrets> {
  const sdk = await loadSdkCrypto()
  const { nullifier, secret } = sdk.generateDepositSecrets(
    keys,
    scope as Hash,
    depositIndex
  )
  return { nullifier, secret, precommitment: sdk.hashPrecommitment(nullifier, secret) }
}

/**
 * Fresh (nullifier, secret) for the change commitment of a withdrawal from
 * the note `label`. Full-value withdrawals leave zero change, but the circuit
 * still requires them — wallet-derived keeps even that recoverable.
 */
export async function withdrawalSecretsAt(
  keys: MasterKeys,
  label: bigint,
  index: bigint
): Promise<{ nullifier: Secret; secret: Secret }> {
  const sdk = await loadSdkCrypto()
  return sdk.generateWithdrawalSecrets(keys, label as Hash, index)
}
