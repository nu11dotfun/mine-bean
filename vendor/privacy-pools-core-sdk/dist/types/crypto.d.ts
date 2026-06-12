import { LeanIMTMerkleProof } from "@zk-kit/lean-imt";
import { Commitment, Hash, Secret, Withdrawal, MasterKeys } from "./types/index.js";
import { Hex } from "viem";
/**
 * Generates two master keys based on some provided seed or a random value.
 *
 * @param {Hex} seed - The optional seed.
 * @returns {MasterKeys} The master key pair.
 */
export declare function generateMasterKeys(mnemonic: string): MasterKeys;
/**
 * Generates a nullifier and secret pair for a deposit commitment.
 *
 * @param {MasterKeys} keys - The master keys pair.
 * @param {Hash} scope - The pool scope.
 * @param {bigint} index - The pool account index for the scope.
 * @returns {Secret, Secret} The commitment nullifier and secret pair.
 */
export declare function generateDepositSecrets(keys: MasterKeys, scope: Hash, index: bigint): {
    nullifier: Secret;
    secret: Secret;
};
/**
 * Generates a nullifier and secret pair for a withdrawal commitment.
 *
 * @param {MasterKeys} keys - The master keys pair.
 * @param {Hash} label - The deposit commitment label.
 * @param {bigint} index - The withdrawal index for the pool account.
 * @returns {Secret, Secret} The commitment nullifier and secret pair.
 */
export declare function generateWithdrawalSecrets(keys: MasterKeys, label: Hash, index: bigint): {
    nullifier: Secret;
    secret: Secret;
};
/**
 * Computes a Poseidon hash for the given nullifier and secret.
 *
 * @param {Secret} nullifier - The nullifier to hash.
 * @param {Secret} secret - The secret to hash.
 * @returns {Hash} The Poseidon hash.
 */
export declare function hashPrecommitment(nullifier: Secret, secret: Secret): Hash;
/**
 * Generates a commitment using the given parameters.
 *
 * @param {bigint} value - The value associated with the commitment.
 * @param {bigint} label - The label used for the commitment.
 * @param {Secret} nullifier - The nullifier used in the precommitment.
 * @param {Secret} secret - The secret used in the precommitment.
 * @returns {Commitment} The generated commitment object.
 */
export declare function getCommitment(value: bigint, label: bigint, nullifier: Secret, secret: Secret): Commitment;
/**
 * Generates a Merkle inclusion proof for a given leaf in a set of leaves.
 *
 * @param {bigint[]} leaves - Array of leaves for the Lean Incremental Merkle tree.
 * @param {bigint} leaf - The specific leaf to generate the inclusion proof for.
 * @returns {LeanIMTMerkleProof<bigint>} A lean incremental Merkle tree inclusion proof.
 * @throws {Error} If the leaf is not found in the leaves array.
 */
export declare function generateMerkleProof(leaves: bigint[], leaf: bigint): LeanIMTMerkleProof<bigint>;
export declare function bigintToHash(value: bigint): Hash;
export declare function bigintToHex(num: bigint | string | undefined): Hex;
/**
 * Calculates the context hash for a withdrawal.
 */
export declare function calculateContext(withdrawal: Withdrawal, scope: Hash): string;
