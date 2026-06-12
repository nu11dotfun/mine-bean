import { Hash, Secret } from "./types/index.js";
import { Hex } from "viem";
export declare function genMasterKeys(seed?: Hex): [Secret, Secret];
/**
 * Computes a Poseidon hash for the given nullifier and secret.
 *
 * @param {Secret} nullifier - The nullifier to hash.
 * @param {Secret} secret - The secret to hash.
 * @returns {Hash} The Poseidon hash.
 */
export declare function getDepositSecrets(masterKey: [Secret, Secret], scope: Hash, index: bigint): {
    nullifier: Secret;
    secret: Secret;
};
export declare function getWithdrawalSecrets(masterKey: [Secret, Secret], label: Hash, index: bigint): {
    nullifier: Secret;
    secret: Secret;
};
