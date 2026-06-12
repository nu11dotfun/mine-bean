import { Hash, Secret } from "../types/commitment.js";
import { Hex } from "viem";
import { DataService } from "./data.service.js";
import { AccountCommitment, PoolAccount, PoolInfo, PrivacyPoolAccount } from "../types/account.js";
import { DepositEvent, PoolEventsError, PoolEventsResult, RagequitEvent, WithdrawalEvent } from "../types/events.js";
type AccountServiceConfig = {
    mnemonic: string;
    poolConcurrency?: number;
} | {
    account: PrivacyPoolAccount;
    poolConcurrency?: number;
};
/**
 * Service responsible for managing privacy pool accounts and their associated commitments.
 * Handles account initialization, deposit/withdrawal tracking, and history synchronization.
 *
 * @remarks
 * This service maintains the state of all pool accounts and their commitments across different
 * chains and scopes. It uses deterministic key generation to recover account state from a mnemonic.
 */
export declare class AccountService {
    private readonly dataService;
    account: PrivacyPoolAccount;
    private readonly logger;
    private readonly poolConcurrency;
    /**
     * Creates a new AccountService instance.
     *
     * @param dataService - Service for fetching on-chain events
     * @param config - Configuration for the account service (either mnemonic or existing account)
     * @param config.mnemonic - Optional mnemonic for deterministic key generation
     * @param config.account - Optional existing account to initialize with
     * @param config.poolConcurrency - Optional maximum number of pools to fetch events for concurrently (default: 2)
     *
     * @throws {AccountError} If account initialization fails
     */
    constructor(dataService: DataService, config: AccountServiceConfig);
    /**
     * Initializes a new account from a mnemonic phrase.
     *
     * @param mnemonic - The mnemonic phrase to derive keys from
     * @returns A new PrivacyPoolAccount with derived master keys
     *
     * @remarks
     * This method derives two master keys from the mnemonic:
     * 1. A master nullifier key from account index 0
     * 2. A master secret key from account index 1
     * These keys are used to deterministically generate nullifiers and secrets for deposits and withdrawals.
     *
     * @throws {AccountError} If account initialization fails
     * @private
     */
    private _initializeAccount;
    /**
     * Generates a deterministic nullifier for a deposit.
     *
     * @param scope - The scope of the pool
     * @param index - The index of the deposit
     * @returns A deterministic nullifier for the deposit
     * @private
     */
    private _genDepositNullifier;
    /**
     * Generates a deterministic secret for a deposit.
     *
     * @param scope - The scope of the pool
     * @param index - The index of the deposit
     * @returns A deterministic secret for the deposit
     * @private
     */
    private _genDepositSecret;
    /**
     * Generates a deterministic nullifier for a withdrawal.
     *
     * @param label - The label of the commitment
     * @param index - The index of the withdrawal
     * @returns A deterministic nullifier for the withdrawal
     * @private
     */
    private _genWithdrawalNullifier;
    /**
     * Generates a deterministic secret for a withdrawal.
     *
     * @param label - The label of the commitment
     * @param index - The index of the withdrawal
     * @returns A deterministic secret for the withdrawal
     * @private
     */
    private _genWithdrawalSecret;
    /**
     * Hashes a commitment using the Poseidon hash function.
     *
     * @param value - The value of the commitment
     * @param label - The label of the commitment
     * @param precommitment - The precommitment hash
     * @returns The commitment hash
     * @private
     */
    private _hashCommitment;
    /**
     * Hashes a precommitment using the Poseidon hash function.
     *
     * @param nullifier - The nullifier for the commitment
     * @param secret - The secret for the commitment
     * @returns The precommitment hash
     * @private
     */
    private _hashPrecommitment;
    /**
     * Gets all spendable commitments across all pools.
     *
     * @returns A map of scope to array of spendable commitments
     *
     * @remarks
     * A commitment is considered spendable if:
     * 1. It has a non-zero value
     * 2. The account it belongs to has not been ragequit
     */
    getSpendableCommitments(): Map<bigint, AccountCommitment[]>;
    /**
     * Creates nullifier and secret for a new deposit
     *
     * @param scope - The scope of the pool to deposit into
     * @param index - Optional index for deterministic generation
     * @returns The nullifier, secret, and precommitment for the deposit
     *
     * @remarks
     * If no index is provided, it uses the current number of accounts for the scope.
     * The precommitment is a hash of the nullifier and secret, used in the deposit process.
     */
    createDepositSecrets(scope: Hash, index?: bigint): {
        nullifier: Secret;
        secret: Secret;
        precommitment: Hash;
    };
    /**
     * Creates nullifier and secret for spending a commitment
     *
     * @param commitment - The commitment to spend
     * @returns The nullifier and secret for the new commitment
     *
     * @remarks
     * The index used for generating the withdrawal nullifier and secret is based on
     * the number of children the account already has, ensuring each withdrawal has
     * a unique nullifier.
     *
     * @throws {AccountError} If no account is found for the commitment
     */
    createWithdrawalSecrets(commitment: AccountCommitment): {
        nullifier: Secret;
        secret: Secret;
    };
    /**
     * Adds a new pool account after depositing
     *
     * @param scope - The scope of the pool
     * @param value - The deposit value
     * @param nullifier - The nullifier used for the deposit
     * @param secret - The secret used for the deposit
     * @param label - The label for the commitment
     * @param blockNumber - The block number of the deposit
     * @param txHash - The transaction hash of the deposit
     * @returns The new pool account
     *
     * @remarks
     * This method creates a new account with the deposit commitment and adds it to the
     * pool accounts map under the specified scope. The commitment hash is calculated
     * from the value, label, and precommitment.
     */
    addPoolAccount(scope: Hash, value: bigint, nullifier: Secret, secret: Secret, label: Hash, blockNumber: bigint, txHash: Hex): PoolAccount;
    /**
     * Adds a new commitment to the account after spending
     *
     * @param parentCommitment - The commitment that was spent
     * @param value - The remaining value after spending
     * @param nullifier - The nullifier used for spending
     * @param secret - The secret used for spending
     * @param blockNumber - The block number of the withdrawal
     * @param txHash - The transaction hash of the withdrawal
     * @returns The new commitment
     *
     * @remarks
     * This method finds the account containing the parent commitment, creates a new
     * commitment with the provided parameters, and adds it to the account's children.
     * The new commitment inherits the label from the parent commitment.
     *
     * @throws {AccountError} If no account is found for the commitment
     */
    addWithdrawalCommitment(parentCommitment: AccountCommitment, value: bigint, nullifier: Secret, secret: Secret, blockNumber: bigint, txHash: Hex): AccountCommitment;
    /**
     * Adds a ragequit event to an existing pool account
     *
     * @param label - The label of the account to add the ragequit to
     * @param ragequit - The ragequit event to add
     * @returns The updated pool account
     *
     * @remarks
     * When an account has a ragequit event, it can no longer be spent.
     * This method finds the account with the matching label and attaches
     * the ragequit event to it.
     *
     * @throws {AccountError} If no account is found with the given label
     */
    addRagequitToAccount(label: Hash, ragequit: RagequitEvent): PoolAccount;
    /**
     * Fetches deposit events for a given pool and returns a map of precommitments to their events for efficient lookup
     *
     * @param pool - The pool to fetch deposit events for
     *
     * @returns A map of precommitments to their events
     */
    getDepositEvents(pool: PoolInfo): Promise<Map<Hash, DepositEvent>>;
    /**
     * Fetches withdrawal events for a given pool and returns a map of spent nullifiers to their events for efficient lookup
     *
     * @param pool - The pool to fetch withdrawal events for
     *
     * @returns A map of spent nullifiers to their events
     */
    getWithdrawalEvents(pool: PoolInfo): Promise<Map<Hash, WithdrawalEvent>>;
    /**
     * Fetches ragequit events for a given pool and returns a map of ragequit labels to their events for efficient lookup
     *
     * @param pool - The pool to fetch ragequit events for
     *
     * @returns A map of ragequit labels to their events
     */
    getRagequitEvents(pool: PoolInfo): Promise<Map<Hash, RagequitEvent>>;
    /**
     * Fetches events for a given set of pools
     *
     * @param pools - The pools to fetch events for
     *
     * @returns A map of pool scopes to their events
     */
    getEvents(pools: PoolInfo[]): Promise<PoolEventsResult>;
    /**
     * Processes deposit events for a given scope and adds them to the account
     * Deterministically generate deposit secrets and check if they match on-chain deposits
     *
     * @param scope - The scope of the pool
     * @param depositEvents - The map of deposit events
     *
     */
    private _processDepositEvents;
    /**
     * Processes withdrawal events for a given scope and adds them to the account
     *
     * @param scope - The scope of the pool
     * @param withdrawalEvents - The map of withdrawal events
     *
     * @remarks
     * This method performs the following steps for each pool:
     * 1. Identifies the earliest deposit block for each scope
     * 2. For each account, reconstructs the withdrawal history by:
     *    - Generating nullifiers sequentially
     *    - Matching them against on-chain events
     *    - Adding matched withdrawals to the account state
     *
     * @throws {DataError} If event fetching fails
     * @private
     *
     */
    private _processWithdrawalEvents;
    /**
     * Processes ragequit events for a given scope and adds them to the account
     *
     * @param scope - The scope of the pool
     * @param ragequitEvents - The map of ragequit events
     *
     * @remarks
     * This method performs the following steps for each pool:
     * 1. Adds ragequit events to accounts if found
     *
     * @throws {DataError} If event fetching fails
     * @private
     *
     */
    private _processRagequitEvents;
    /**
     * Initializes an AccountService instance with events for a given set of pools
     *
     * @param dataService - The data service to use for fetching events
     * @param source - The source to use for initializing the account. Either a mnemonic or an existing account service instance
     * @param pools - The pools to fetch events for
     *
     * @remarks
     * This method performs the following steps for each pool:
     * 1. Fetches deposit, withdrawal, and ragequit events for each pool
     * 2. Processes deposit events and creates pool accounts
     * 3. Processes withdrawal events and adds commitments to pool accounts
     * 4. Processes ragequit events and adds ragequit to pool accounts
     *
     * @returns The initialized AccountService instance and array of errors if any pool events fetching fails
     *
     * if any pool events fetching fails, the account will be initialized without the events for that pool
     * user can then call to this method again with the same account and missing pools to fetch the missing events
     *
     * @throws {AccountError} If account state reconstruction fails or if duplicate pools are found
     */
    static initializeWithEvents(dataService: DataService, source: {
        mnemonic: string;
    } | {
        service: AccountService;
    }, pools: PoolInfo[]): Promise<{
        account: AccountService;
        errors: PoolEventsError[];
    }>;
    /**
     * @deprecated Use `initializeWithEvents` for instantiating an account with history reconstruction
     * Retrieves the history of deposits and withdrawals for the given pools.
     *
     * @param pools - Array of pool configurations to sync history for
     *
     * @remarks
     * This method performs the following steps:
     * 1. Initializes pool accounts for each pool if they don't exist
     * 2. For each pool, fetches deposit events and reconstructs accounts
     * 3. Processes withdrawals and ragequits to update account state
     *
     * The account reconstruction is deterministic based on the master keys,
     * allowing the full state to be recovered from on-chain events.
     *
     * @throws {DataError} If event fetching fails
     * @throws {AccountError} If account state reconstruction fails
     */
    retrieveHistory(pools: PoolInfo[]): Promise<void>;
    /**
     * Processes withdrawal events for all pools and updates account state.
     *
     * @param pools - Array of pool configurations to process withdrawals for
     *
     * @remarks
     * This method performs the following steps for each pool:
     * 1. Identifies the earliest deposit block for each scope
     * 2. Fetches withdrawal and ragequit events from that block
     * 3. Maps withdrawals by nullifier hash and ragequits by label for efficient lookup
     * 4. For each account, reconstructs the withdrawal history by:
     *    - Generating nullifiers sequentially
     *    - Matching them against on-chain events
     *    - Adding matched withdrawals to the account state
     * 5. Adds ragequit events to accounts if found
     *
     * @throws {DataError} If event fetching fails
     * @private
     */
    private _processWithdrawalsAndRagequits;
}
export {};
