/**
 * Unified error codes for the SDK.
 */
export declare enum ErrorCode {
    UNKNOWN = "UNKNOWN",
    INVALID_INPUT = "INVALID_INPUT",
    OPERATION_FAILED = "OPERATION_FAILED",
    NETWORK_ERROR = "NETWORK_ERROR",
    PROOF_GENERATION_FAILED = "PROOF_GENERATION_FAILED",
    PROOF_VERIFICATION_FAILED = "PROOF_VERIFICATION_FAILED",
    INVALID_PROOF = "INVALID_PROOF",
    INVALID_PUBLIC_SIGNALS = "INVALID_PUBLIC_SIGNALS",
    CIRCUIT_ERROR = "CIRCUIT_ERROR",
    CONTRACT_ERROR = "CONTRACT_ERROR",
    CRYPTO_ERROR = "CRYPTO_ERROR",
    MERKLE_ERROR = "MERKLE_ERROR"
}
/**
 * Base error class for the SDK.
 * All other error classes should extend this.
 */
export declare class SDKError extends Error {
    readonly code: ErrorCode;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown> | undefined);
    /**
     * Creates a JSON representation of the error.
     */
    toJSON(): Record<string, unknown>;
}
/**
 * Specialized error class for proof-related operations.
 */
export declare class ProofError extends SDKError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
    /**
     * Creates an error for proof generation failures.
     */
    static generationFailed(details?: Record<string, unknown>): ProofError;
    /**
     * Creates an error for proof verification failures.
     */
    static verificationFailed(details?: Record<string, unknown>): ProofError;
    /**
     * Creates an error for invalid proof format.
     */
    static invalidProof(details?: Record<string, unknown>): ProofError;
}
export declare class ContractError extends SDKError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
    static scopeNotFound(scope: bigint): ContractError;
    static assetNotFound(address: string): ContractError;
}
