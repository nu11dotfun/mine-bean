import { CircuitsInterface } from "../interfaces/circuits.interface.js";
import { WithdrawalProof, WithdrawalProofInput } from "../types/withdrawal.js";
import { AccountCommitment, Commitment } from "../index.js";
/**
 * Service responsible for handling withdrawal-related operations.
 */
export declare class WithdrawalService {
    private readonly circuits;
    constructor(circuits: CircuitsInterface);
    /**
     * Generates a withdrawal proof.
     *
     * @param commitment - Commitment to withdraw
     * @param input - Input parameters for the withdrawal
     * @param withdrawal - Withdrawal details
     * @returns Promise resolving to withdrawal payload
     * @throws {ProofError} If proof generation fails
     */
    proveWithdrawal(commitment: Commitment | AccountCommitment, input: WithdrawalProofInput): Promise<WithdrawalProof>;
    /**
     * Verifies a withdrawal proof.
     *
     * @param withdrawalPayload - The withdrawal payload to verify
     * @returns Promise resolving to boolean indicating proof validity
     * @throws {ProofError} If verification fails
     */
    verifyWithdrawal(withdrawalPayload: WithdrawalProof): Promise<boolean>;
    /**
     * Prepares input signals for the withdrawal circuit.
     */
    private prepareInputSignals;
}
