import { ErrorCode, SDKError } from "./base.error.js";
import { Hash } from "../types/commitment.js";
export declare class AccountError extends SDKError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
    static commitmentNotFound(hash: Hash | string): AccountError;
    static invalidPoolAccount(): AccountError;
    static accountInitializationFailed(reason: string): AccountError;
    static duplicatePools(scope: bigint): AccountError;
    static invalidIndex(index: bigint): AccountError;
}
