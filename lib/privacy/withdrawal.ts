/**
 * BEAN Private Deploys — withdrawal proof pipeline
 *
 * Builds the full-value withdrawal (pool → subaccount) ZK proof in the
 * browser, mirroring the canonical CLI recipe
 * (privacy-pools-core/packages/contracts/scripts/pp-sdk.mjs):
 *
 *   1. state Merkle proof — LeanIMT over ALL pool commitments (from the
 *      relayer's /state/leaves), poseidon hashing. The circuit wants the
 *      tree depth BEFORE the siblings are padded to 32 — the SDK's own
 *      generateMerkleProof pads but discards the depth, so we build the
 *      tree ourselves.
 *   2. ASP Merkle proof — served pre-built by the relayer per label.
 *   3. context — keccak256(abi.encode(withdrawal, scope)) % SNARK field,
 *      binding the proof to the recipient so the relayer cannot redirect it.
 *   4. groth16 prove + OFFLINE VERIFY — a proof that fails local
 *      verification is never sent anywhere.
 *
 * The result is JSON-safe (decimal/hex strings only) so it can sit in
 * sessionStorage until the user actually deploys, and then go straight to
 * POST /relay. It contains no secrets — only commitments, roots, and the
 * proof itself, all destined for public calldata anyway.
 *
 * Heavy deps (SDK/snarkjs, lean-imt, poseidon) load via dynamic import.
 */

import { encodeAbiParameters, type Address, type Hex } from 'viem'
import type { MasterKeys, Hash } from '@0xbow/privacy-pools-core-sdk'
import { ENTRYPOINT_ADDRESS, FEE_DATA_ABI, poolFor } from './config'
import { withdrawalSecretsAt } from './keys'
import { getStateLeaves, getAspProof, type AspProofResponse, type SnarkProof } from './relayerClient'
import { notePool, type PrivateNote } from './notes'

/** Withdrawal struct submitted (via the relayer) to `Entrypoint.relay`. */
export interface WithdrawalStruct {
  processooor: Address
  data: Hex
}

/**
 * Encode the withdrawal payload paying out to `recipient` (the subaccount).
 *
 * relayFeeBPS is 0 (the local relayer takes no fee). IMPORTANT: even with a
 * zero fee, `Entrypoint.relay` ALWAYS calls `_transfer(feeRecipient, 0)`,
 * which does `feeRecipient.call{value: 0}('')`. The Entrypoint's own
 * `receive()` rejects ETH from anyone but the native pool, so feeRecipient
 * MUST NOT be the Entrypoint — that 0-value call would revert and bubble up
 * as `NativeAssetTransferFailed`. We point it at the recipient (an EOA that
 * accepts ETH); with a 0 fee nothing is actually paid out twice.
 */
export function buildWithdrawal(recipient: Address): WithdrawalStruct {
  const data = encodeAbiParameters(FEE_DATA_ABI, [
    { recipient, feeRecipient: recipient, relayFeeBPS: 0n },
  ])
  return { processooor: ENTRYPOINT_ADDRESS, data }
}

interface MerkleProofParts {
  root: bigint
  depth: bigint
  /** Proof with siblings padded to 32 (circuit-fixed width). */
  proof: { root: bigint; leaf: bigint; index: number; siblings: bigint[] }
}

type TreeModules = {
  LeanIMT: typeof import('@zk-kit/lean-imt').LeanIMT
  poseidon: (inputs: bigint[]) => bigint
}

let treeModulesPromise: Promise<TreeModules> | null = null

function loadTreeModules(): Promise<TreeModules> {
  treeModulesPromise ??= Promise.all([
    import('@zk-kit/lean-imt'),
    import('maci-crypto/build/ts/hashing.js'),
  ]).then(([imt, hashing]) => ({
    LeanIMT: imt.LeanIMT,
    poseidon: hashing.poseidon,
  }))
  return treeModulesPromise
}

/**
 * Build the inclusion proof for `leaf` over the ordered pool leaves.
 * Captures depth BEFORE padding siblings to 32 — do not reorder.
 */
export async function buildStateProof(
  leaves: bigint[],
  leaf: bigint
): Promise<MerkleProofParts> {
  const { LeanIMT, poseidon } = await loadTreeModules()
  const tree = new LeanIMT<bigint>((a, b) => poseidon([a, b]))
  if (leaves.length) tree.insertMany(leaves)
  const index = tree.indexOf(leaf)
  if (index < 0) {
    throw new Error(
      'commitment not found in pool state — the deposit may not be indexed yet'
    )
  }
  const p = tree.generateProof(index)
  const depth = BigInt(p.siblings.length)
  const siblings = [...p.siblings, ...Array(32 - p.siblings.length).fill(0n)]
  return {
    root: tree.root,
    depth,
    proof: { root: tree.root, leaf, index: p.index, siblings },
  }
}

/** Current state-tree root for the ordered pool leaves (staleness checks). */
export async function stateRootOf(leaves: bigint[]): Promise<bigint> {
  const { LeanIMT, poseidon } = await loadTreeModules()
  const tree = new LeanIMT<bigint>((a, b) => poseidon([a, b]))
  if (leaves.length) tree.insertMany(leaves)
  return tree.root
}

/** Map the relayer's ASP proof response into circuit-input form. */
export function buildAspProof(
  resp: AspProofResponse,
  label: string
): MerkleProofParts {
  return {
    root: BigInt(resp.root),
    depth: BigInt(resp.depth),
    proof: {
      root: BigInt(resp.root),
      leaf: BigInt(label),
      index: resp.index,
      siblings: resp.siblings.map(BigInt),
    },
  }
}

/** A fully-built, JSON-safe withdrawal ready to POST to the relayer. */
export interface ProvenWithdrawal {
  withdrawal: WithdrawalStruct
  proof: SnarkProof
  /** Pool scope this proof targets — must be sent in the /relay body. */
  scope: string
  /** Roots the proof was generated against — for cache staleness checks. */
  stateRoot: string
  aspRoot: string
}

export type ProveStatus =
  | 'fetching-state'
  | 'fetching-asp'
  | 'building-proofs'
  | 'proving'
  | 'verifying'

/**
 * Prove the full-value withdrawal of `note` to `recipient`.
 *
 * Throws if the note's commitment cannot be recomputed from the wallet-derived
 * secrets, if the commitment is not in the pool state, if the label is not
 * ASP-approved yet, or if the proof fails offline verification.
 */
export async function proveNoteWithdrawal(params: {
  keys: MasterKeys
  note: PrivateNote
  recipient: Address
  onStatus?: (s: ProveStatus) => void
}): Promise<ProvenWithdrawal> {
  const { keys, note, recipient, onStatus } = params
  const sdkModule = await import('@0xbow/privacy-pools-core-sdk')
  const { getPrivacySdk } = await import('./circuits')

  // Route to the note's pool: scope + state leaves come from THAT pool.
  const pool = poolFor(notePool(note))

  // Re-derive the deposit secrets and rebuild the commitment (pool scope).
  const { generateDepositSecrets, getCommitment, calculateContext } = sdkModule
  const { nullifier, secret } = generateDepositSecrets(
    keys,
    pool.scope as unknown as Hash,
    BigInt(note.depositIndex)
  )
  const commitment = getCommitment(
    BigInt(note.value),
    BigInt(note.label),
    nullifier,
    secret
  )
  if ((commitment.hash as bigint) !== BigInt(note.commitment)) {
    throw new Error(
      'derived secrets do not reproduce the stored commitment — wrong wallet or corrupted note'
    )
  }

  onStatus?.('fetching-state')
  const leaves = await getStateLeaves(pool.key)
  // A depth-0 (single-leaf) pool cannot generate a withdrawal proof — the
  // witness generator fails. Pools are seeded with ≥2 deposits at launch.
  if (leaves.length < 2) {
    throw new Error(
      'this pool needs more deposits before withdrawals work — try again later'
    )
  }

  onStatus?.('fetching-asp')
  const aspResp = await getAspProof(note.label)

  onStatus?.('building-proofs')
  const state = await buildStateProof(leaves, commitment.hash as bigint)
  const asp = buildAspProof(aspResp, note.label)

  const withdrawal = buildWithdrawal(recipient)
  const context = BigInt(calculateContext(withdrawal, pool.scope as unknown as Hash))
  const newSecrets = await withdrawalSecretsAt(keys, BigInt(note.label), 0n)

  onStatus?.('proving')
  const sdk = await getPrivacySdk()
  const proof = await sdk.proveWithdrawal(commitment, {
    context,
    withdrawalAmount: BigInt(note.value),
    stateMerkleProof: state.proof,
    aspMerkleProof: asp.proof,
    stateRoot: state.root as Hash,
    stateTreeDepth: state.depth,
    aspRoot: asp.root as Hash,
    aspTreeDepth: asp.depth,
    newNullifier: newSecrets.nullifier,
    newSecret: newSecrets.secret,
  })

  onStatus?.('verifying')
  const ok = await sdk.verifyWithdrawal(proof)
  if (!ok) {
    throw new Error('withdrawal proof failed offline verification — not relaying')
  }

  return {
    withdrawal,
    proof: toJsonSafeProof(proof),
    scope: pool.scope.toString(),
    stateRoot: state.root.toString(),
    aspRoot: aspResp.root,
  }
}

/** Normalize snarkjs output to plain decimal strings (JSON/storage safe). */
function toJsonSafeProof(proof: {
  proof: unknown
  publicSignals: unknown
}): SnarkProof {
  return JSON.parse(
    JSON.stringify(proof, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  ) as SnarkProof
}
