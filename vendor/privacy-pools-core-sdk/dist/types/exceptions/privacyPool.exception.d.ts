export declare enum ErrorCode {
    INVALID_COMMITMENT = "INVALID_COMMITMENT",
    INVALID_MERKLE_PROOF = "INVALID_MERKLE_PROOF",
    INVALID_NULLIFIER = "INVALID_NULLIFIER",
    INVALID_SECRET = "INVALID_SECRET",
    INVALID_VALUE = "INVALID_VALUE",
    INVALID_LABEL = "INVALID_LABEL",
    MERKLE_ERROR = "MERKLE_ERROR"
}
export declare class PrivacyPoolError extends Error {
    code: ErrorCode;
    constructor(code: ErrorCode, message: string);
}
