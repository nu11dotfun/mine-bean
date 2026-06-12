import { ErrorCode } from "./base.error.js";
import { DataError } from "./data.error.js";
import { Hash } from "../types/commitment.js";
export declare class EventError extends DataError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
    static depositEventError(chainId: number, scope: Hash, error: Error): EventError;
    static withdrawalEventError(chainId: number, scope: Hash, error: Error): EventError;
    static ragequitEventError(chainId: number, scope: Hash, error: Error): EventError;
}
