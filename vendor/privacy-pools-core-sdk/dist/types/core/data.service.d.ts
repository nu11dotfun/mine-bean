import { ChainConfig, DepositEvent, RagequitEvent, WithdrawalEvent } from "../types/events.js";
import { PoolInfo } from "../types/account.js";
import { ChainLogFetchConfig } from "../types/rateLimit.js";
/**
 * Service responsible for fetching and managing privacy pool events across multiple chains.
 * Handles event retrieval, parsing, and validation for deposits, withdrawals, and ragequits.
 *
 * @remarks
 * This service uses viem's PublicClient to efficiently fetch and process blockchain events.
 * It supports multiple chains and provides robust error handling and validation.
 * All uint256 values from events are handled as bigints, with Hash type assertions for commitment-related fields.
 */
export declare class DataService {
    private readonly chainConfigs;
    private readonly clients;
    private readonly logger;
    private readonly logFetchConfigs;
    /**
     * Initialize the data service with chain configurations
     *
     * @param chainConfigs - Array of chain configurations containing chainId, RPC URL, and API key
     * @param logFetchConfig - Per-chain configuration for rate-limited log fetching as a Map<chainId, config>.
     *                         Each chain can have its own specific settings (e.g., different block chunk sizes).
     * @throws {DataError} If client initialization fails for any chain
     */
    constructor(chainConfigs: ChainConfig[], logFetchConfig?: ChainLogFetchConfig);
    /**
     * Get deposit events for a specific chain
     *
     * @param pool - Pool info containing chainId, address, and deployment block
     * @returns Array of deposit events with properly typed fields (bigint for numbers, Hash for commitments)
     * @throws {DataError} If client is not configured, network error occurs, or event data is invalid
     */
    getDeposits(pool: PoolInfo): Promise<DepositEvent[]>;
    /**
     * Get withdrawal events for a specific chain
     *
     * @param pool - Pool info containing chainId, address, and deployment block
     * @param fromBlock - Optional starting block (defaults to pool deployment block)
     * @returns Array of withdrawal events with properly typed fields (bigint for numbers, Hash for commitments)
     * @throws {DataError} If client is not configured, network error occurs, or event data is invalid
     */
    getWithdrawals(pool: PoolInfo, fromBlock?: bigint): Promise<WithdrawalEvent[]>;
    /**
     * Get ragequit events for a specific chain
     *
     * @param pool - Pool info containing chainId, address, and deployment block
     * @param fromBlock - Optional starting block (defaults to pool deployment block)
     * @returns Array of ragequit events with properly typed fields (bigint for numbers, Hash for commitments)
     * @throws {DataError} If client is not configured, network error occurs, or event data is invalid
     */
    getRagequits(pool: PoolInfo, fromBlock?: bigint): Promise<RagequitEvent[]>;
    /**
     * Gets the current block number for a chain
     */
    private getCurrentBlock;
    /**
     * Generates block ranges for chunked fetching
     */
    private generateBlockRanges;
    /**
     * Fetches logs for a single block range with retry logic
     */
    private fetchLogsWithRetry;
    /**
     * Helper to add delay between requests
     */
    private sleep;
    private getClientForChain;
    private getConfigForChain;
    private getLogFetchConfigForChain;
}
