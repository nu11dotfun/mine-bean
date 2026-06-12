import { Commitment, Hash, Precommitment } from "../types/commitment.js";
/**
 * Parameters required for brute-force commitment recovery.
 */
interface BruteForceRecoveryParams {
    /** The target commitment hash to match against */
    commitmentHash: Hash;
    /** Defines the range of values to search within */
    valueRange: {
        min: number;
        max: number;
        step: number;
    };
    /** The precommitment object containing the hash, nullifier, and secret */
    basePrecommitment: Precommitment;
    /** The label used during commitment computation */
    label: bigint;
    /** Optional settings: timeout in milliseconds */
    options?: {
        timeout?: number;
    };
}
/**
 * The result of the brute-force commitment recovery process.
 */
interface RecoveryResult {
    /** Indicates whether the recovery was successful */
    success: boolean;
    /** Contains the found commitment and its value if successful */
    data?: Array<{
        commitment: Commitment;
        value: number;
    }>;
    /** Contains an error code and message if the recovery fails */
    error?: {
        code: string;
        message: string;
    };
}
/**
 * Service for brute-force recovering commitments by iterating over possible values.
 * This method is useful when the original commitment value is lost, but the precommitment and hash are known.
 */
export declare class BruteForceRecoveryService {
    /**
     * Attempts to recover a commitment by brute-forcing through the given value range.
     *
     * @param params - The parameters required for the brute-force search.
     * @returns A `Promise` resolving to a `RecoveryResult` containing either the found commitment or an error.
     */
    bruteForceRecoverCommitment(params: BruteForceRecoveryParams): Promise<RecoveryResult>;
    /**
     * Computes the Poseidon hash of a commitment.
     */
    private computeCommitmentHash;
    /**
     * Determines the number of decimal places in a given number.
     */
    private getDecimalPlaces;
}
export {};
