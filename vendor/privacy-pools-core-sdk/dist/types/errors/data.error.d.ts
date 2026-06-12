import { ErrorCode, SDKError } from "./base.error.js";
export declare class DataError extends SDKError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
    static invalidLog(type: string, reason: string): DataError;
    static chainNotConfigured(chainId: number): DataError;
    static networkError(chainId: number, error: Error): DataError;
}
