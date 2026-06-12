import { CircuitsInterface } from "../interfaces/circuits.interface.js";
import { Commitment, CommitmentProof } from "../types/commitment.js";
import { WithdrawalProof, WithdrawalProofInput } from "../types/withdrawal.js";
import { ContractInteractionsService } from "./contracts.service.js";
import { Hex, Address, Chain } from "viem";
import { AccountCommitment } from "../types/account.js";
/**
 * Main SDK class providing access to all privacy pool functionality.
 * Uses Poseidon hash for all commitment operations.
 */
export declare class PrivacyPoolSDK {
    private readonly commitmentService;
    private readonly withdrawalService;
    constructor(circuits: CircuitsInterface);
    createContractInstance(rpcUrl: string, chain: Chain, entrypointAddress: Address, privateKey: Hex): ContractInteractionsService;
    /**
     * Generates a commitment proof.
     *
     * @param value - Value to commit
     * @param label - Label for the commitment
     * @param nullifier - Nullifier for the commitment
     * @param secret - Secret for the commitment
     */
    proveCommitment(value: bigint, label: bigint, nullifier: bigint, secret: bigint): Promise<CommitmentProof>;
    /**
     * Verifies a commitment proof.
     *
     * @param proof - The proof to verify
     */
    verifyCommitment(proof: CommitmentProof): Promise<boolean>;
    /**
     * Generates a withdrawal proof.
     *
     * @param commitment - Commitment to withdraw
     * @param input - Input parameters for the withdrawal
     * @param withdrawal - Withdrawal details
     */
    proveWithdrawal(commitment: Commitment | AccountCommitment, input: WithdrawalProofInput): Promise<WithdrawalProof>;
    /**
     * Verifies a withdrawal proof.
     *
     * @param withdrawalProof - The withdrawal payload to verify
     */
    verifyWithdrawal(withdrawalProof: WithdrawalProof): Promise<boolean>;
}
