import { CircuitsInterface } from "../interfaces/circuits.interface.js";
import { CommitmentProof } from "../types/commitment.js";
/**
 * Service responsible for handling commitment-related operations.
 * All hash operations use Poseidon for ZK-friendly hashing.
 */
export declare class CommitmentService {
    private readonly circuits;
    constructor(circuits: CircuitsInterface);
    /**
     * Generates a zero-knowledge proof for a commitment using Poseidon hash.
     *
     * @param value - The value being committed to
     * @param label - Label associated with the commitment
     * @param nullifier - Unique nullifier for the commitment
     * @param secret - Secret key for the commitment
     * @returns Promise resolving to proof and public signals
     * @throws {ProofError} If proof generation fails
     */
    proveCommitment(value: bigint, label: bigint, nullifier: bigint, secret: bigint): Promise<CommitmentProof>;
    /**
     * Verifies a commitment proof.
     *
     * @param proof - The commitment proof to verify
     * @param publicSignals - Public signals associated with the proof
     * @returns Promise resolving to boolean indicating proof validity
     * @throws {ProofError} If verification fails
     */
    verifyCommitment({ proof, publicSignals, }: CommitmentProof): Promise<boolean>;
}
