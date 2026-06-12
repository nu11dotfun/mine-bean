import { Groth16Proof, PublicSignals } from 'snarkjs';
import { Address, Hex, Chain } from 'viem';
export { Address } from 'viem';
import { LeanIMTMerkleProof } from '@zk-kit/lean-imt';
export { LeanIMTMerkleProof } from '@zk-kit/lean-imt';

/**
 * Represents a hash value in the system.
 * This is a branded type to ensure type safety.
 */
type Hash = bigint & {
    readonly __brand: unique symbol;
};
/**
 * Represents a secret value in the system.
 * This is a branded type to ensure type safety.
 */
type Secret = bigint & {
    readonly __brand: unique symbol;
};
/**
 * Represents a precommitment structure containing the hash, nullifier, and secret.
 * All hashes are computed using Poseidon.
 */
interface Precommitment {
    readonly hash: Hash;
    readonly nullifier: Secret;
    readonly secret: Secret;
}
/**
 * Represents the preimage of a commitment containing the value, label, and precommitment.
 */
interface CommitmentPreimage {
    readonly value: bigint;
    readonly label: bigint;
    readonly precommitment: Precommitment;
}
/**
 * Represents a complete commitment structure.
 * All hashes are computed using Poseidon.
 */
interface Commitment {
    readonly hash: Hash;
    readonly nullifierHash: Hash;
    readonly preimage: CommitmentPreimage;
}
/**
 * Represents the result of a commitment proof operation.
 */
interface CommitmentProof {
    readonly proof: Groth16Proof;
    readonly publicSignals: PublicSignals;
}

/**
 * Represents a withdrawal request in the system.
 */
interface Withdrawal {
    readonly processooor: Address;
    readonly data: Hex;
}
interface WithdrawalProof {
    readonly proof: Groth16Proof;
    readonly publicSignals: PublicSignals;
}
/**
 * Input parameters required for withdrawal proof generation.
 */
interface WithdrawalProofInput {
    readonly context: bigint;
    readonly withdrawalAmount: bigint;
    readonly stateMerkleProof: LeanIMTMerkleProof<bigint>;
    readonly aspMerkleProof: LeanIMTMerkleProof<bigint>;
    readonly stateRoot: Hash;
    readonly stateTreeDepth: bigint;
    readonly aspRoot: Hash;
    readonly aspTreeDepth: bigint;
    readonly newSecret: Secret;
    readonly newNullifier: Secret;
}

interface MasterKeys {
    masterNullifier: Secret;
    masterSecret: Secret;
}

/**
 * Configuration options for rate-limited log fetching
 */
interface LogFetchConfig {
    /**
     * Maximum number of blocks to fetch in a single RPC call.
     * Default: 10000 (typical limit for most RPC providers)
     */
    blockChunkSize: number;
    /**
     * Maximum number of concurrent log fetch operations.
     * Default: 3
     */
    concurrency: number;
    /**
     * Delay in milliseconds between chunk requests (for additional throttling).
     * Default: 0 (no delay)
     */
    chunkDelayMs: number;
    /**
     * Whether to retry failed chunk fetches.
     * Default: true
     */
    retryOnFailure: boolean;
    /**
     * Maximum number of retries for a failed chunk.
     * Default: 3
     */
    maxRetries: number;
    /**
     * Base delay for exponential backoff on retries (ms).
     * Default: 1000
     */
    retryBaseDelayMs: number;
}
/**
 * Default log fetch configuration
 */
declare const DEFAULT_LOG_FETCH_CONFIG: LogFetchConfig;
/**
 * Per-chain log fetch configuration map
 * Maps chainId to its specific LogFetchConfig
 */
type ChainLogFetchConfig = Map<number, Partial<LogFetchConfig>>;
/**
 * Block range for chunked fetching
 */
interface BlockRange {
    fromBlock: bigint;
    toBlock: bigint;
}

/**
 * Generates two master keys based on some provided seed or a random value.
 *
 * @param {Hex} seed - The optional seed.
 * @returns {MasterKeys} The master key pair.
 */
declare function generateMasterKeys(mnemonic: string): MasterKeys;
/**
 * Generates a nullifier and secret pair for a deposit commitment.
 *
 * @param {MasterKeys} keys - The master keys pair.
 * @param {Hash} scope - The pool scope.
 * @param {bigint} index - The pool account index for the scope.
 * @returns {Secret, Secret} The commitment nullifier and secret pair.
 */
declare function generateDepositSecrets(keys: MasterKeys, scope: Hash, index: bigint): {
    nullifier: Secret;
    secret: Secret;
};
/**
 * Generates a nullifier and secret pair for a withdrawal commitment.
 *
 * @param {MasterKeys} keys - The master keys pair.
 * @param {Hash} label - The deposit commitment label.
 * @param {bigint} index - The withdrawal index for the pool account.
 * @returns {Secret, Secret} The commitment nullifier and secret pair.
 */
declare function generateWithdrawalSecrets(keys: MasterKeys, label: Hash, index: bigint): {
    nullifier: Secret;
    secret: Secret;
};
/**
 * Computes a Poseidon hash for the given nullifier and secret.
 *
 * @param {Secret} nullifier - The nullifier to hash.
 * @param {Secret} secret - The secret to hash.
 * @returns {Hash} The Poseidon hash.
 */
declare function hashPrecommitment(nullifier: Secret, secret: Secret): Hash;
/**
 * Generates a commitment using the given parameters.
 *
 * @param {bigint} value - The value associated with the commitment.
 * @param {bigint} label - The label used for the commitment.
 * @param {Secret} nullifier - The nullifier used in the precommitment.
 * @param {Secret} secret - The secret used in the precommitment.
 * @returns {Commitment} The generated commitment object.
 */
declare function getCommitment(value: bigint, label: bigint, nullifier: Secret, secret: Secret): Commitment;
/**
 * Generates a Merkle inclusion proof for a given leaf in a set of leaves.
 *
 * @param {bigint[]} leaves - Array of leaves for the Lean Incremental Merkle tree.
 * @param {bigint} leaf - The specific leaf to generate the inclusion proof for.
 * @returns {LeanIMTMerkleProof<bigint>} A lean incremental Merkle tree inclusion proof.
 * @throws {Error} If the leaf is not found in the leaves array.
 */
declare function generateMerkleProof(leaves: bigint[], leaf: bigint): LeanIMTMerkleProof<bigint>;
declare function bigintToHash(value: bigint): Hash;
declare function bigintToHex(num: bigint | string | undefined): Hex;
/**
 * Calculates the context hash for a withdrawal.
 */
declare function calculateContext(withdrawal: Withdrawal, scope: Hash): string;

declare class InvalidRpcUrl extends Error {
    constructor(url: string);
}

/**
 * Represents an interface for a blockchain provider.
 */
interface IBlockchainProvider {
    /**
     * Retrieves the balance of the specified address.
     * @param {Address} address The address for which to retrieve the balance.
     * @returns {Promise<bigint>} A Promise that resolves to the balance of the address.
     */
    getBalance(address: Address): Promise<bigint>;
}

declare class BlockchainProvider implements IBlockchainProvider {
    private client;
    constructor(rpcUrl: string);
    /** @inheritdoc */
    getBalance(address: Address): Promise<bigint>;
}

/**
 * Enum representing available versions of circuit artifacts.
 */
declare enum Version {
    /**
     * The latest version of the circuit artifacts.
     */
    Latest = "latest"
}
/**
 * Type representing a version string, which is a string literal derived from the Version enum.
 */
type VersionString = `${Version}`;
/**
 * Enum representing the names of available circuits.
 */
declare enum CircuitName$1 {
    /**
     * Circuit for commitments.
     */
    Commitment = "commitment",
    /**
     * Circuit for Merkle tree operations.
     */
    MerkleTree = "merkleTree",
    /**
     * Circuit for withdrawal operations.
     */
    Withdraw = "withdraw"
}
/**
 * Type representing a circuit name string, which is a string literal derived from the CircuitName enum.
 */
type CircuitNameString = `${CircuitName$1}`;
/**
 * Interface representing the artifacts associated with a circuit.
 */
interface CircuitArtifacts {
    /**
     * The precompiled wasm file for the circuit.
     * @type {Uint8Array}
     */
    wasm: Uint8Array;
    /**
     * The verification key for the circuit.
     * @type {Uint8Array}
     */
    vkey: Uint8Array;
    /**
     * The proving key for the circuit.
     * @type {Uint8Array}
     */
    zkey: Uint8Array;
}
/**
 * Type representing the mapping of circuit name strings to their associated circuit artifacts.
 */
interface Binaries {
    commitment: CircuitArtifacts;
    withdraw: CircuitArtifacts;
    merkleTree?: CircuitArtifacts;
}
/**
 * Interface defining the methods required for managing circuits and their artifacts.
 */
interface CircuitsInterface$1 {
    /**
     * Downloads all artifacts for the specified version of circuits.
     * @param {VersionString} version - The version of the artifacts to download.
     * @returns {Promise<Binaries>} A promise that resolves to the binaries containing all circuit artifacts.
     * @async
     */
    downloadArtifacts(version: VersionString): Promise<Binaries>;
    /**
     * Initializes the artifacts for the specified version of circuits.
     * @param {VersionString} version - The version of the artifacts to initialize.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @async
     */
    initArtifacts(version: VersionString): Promise<void>;
    /**
     * Retrieves the verification key for a specified circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @param {VersionString} [version] - The version of the artifacts (defaults to the latest).
     * @returns {Promise<Uint8Array>} A promise that resolves to the verification key.
     * @async
     */
    getVerificationKey(circuitName: CircuitNameString, version?: VersionString): Promise<Uint8Array>;
    /**
     * Retrieves the proving key for a specified circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @param {VersionString} [version] - The version of the artifacts (defaults to the latest).
     * @returns {Promise<Uint8Array>} A promise that resolves to the proving key.
     * @async
     */
    getProvingKey(circuitName: CircuitNameString, version?: VersionString): Promise<Uint8Array>;
    /**
     * Retrieves the wasm file for a specified circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @param {VersionString} [version] - The version of the artifacts (defaults to the latest).
     * @returns {Promise<Uint8Array>} A promise that resolves to the wasm file.
     * @async
     */
    getWasm(circuitName: CircuitNameString, version?: VersionString): Promise<Uint8Array>;
}

interface CircuitOptions {
    baseUrl?: string;
    browser?: boolean;
}
/**
 * Class representing circuit management and artifact handling.
 * Implements the CircuitsInterface.
 */
declare class Circuits implements CircuitsInterface$1 {
    /**
     * Indicates whether the circuits have been initialized.
     * @type {boolean}
     * @protected
     */
    protected initialized: boolean;
    /**
     * The version of the circuit artifacts being used.
     * @type {VersionString}
     * @protected
     */
    protected version: VersionString;
    /**
     * The binaries containing circuit artifacts such as wasm, vkey, and zkey files.
     * @type {Binaries}
     * @protected
     */
    protected binaries: Binaries;
    /**
     * The base URL for fetching circuit artifacts.
     * @type {string}
     * @protected
     */
    protected baseUrl: string;
    protected readonly browser: boolean;
    /**
     * Constructor to initialize the Circuits class with an optional custom base URL.
     * @param {string} [options.baseUrl] - The base URL for fetching circuit artifacts (optional).
     * @param {boolean} [options.browser] - Controls how the circuits will be loaded, using either `fetch` if true or `fs` otherwise. Defaults to true.
     */
    constructor(options?: CircuitOptions);
    /**
     * Determines whether the environment is a browser.
     * @returns {boolean} True if running in a browser environment, false otherwise.
     * @protected
     */
    _browser(): boolean;
    /**
     * Initializes the circuit manager with binaries and a version.
     * @param {Binaries} binaries - The binaries containing circuit artifacts.
     * @param {VersionString} version - The version of the circuit artifacts.
     * @protected
     */
    protected _initialize(binaries: Binaries, version: VersionString): void;
    /**
     * Handles initialization of circuit artifacts, fetching them if necessary.
     * @param {VersionString} [version=Version.latest] - The version of the circuit artifacts.
     * @throws {CircuitInitialization} If an error occurs during initialization.
     * @protected
     * @async
     */
    protected _handleInitialization(version?: VersionString): Promise<void>;
    /**
     * Fetches a versioned artifact from a given path.
     * @param {string} artifactPath - The path to the artifact.
     * @param {VersionString} version - The version of the artifact.
     * @returns {Promise<Uint8Array>} A promise that resolves to the artifact as a Uint8Array.
     * @throws {FetchArtifact} If the artifact cannot be fetched.
     * @protected
     * @async
     */
    _fetchVersionedArtifact(artifactPath: string): Promise<Uint8Array>;
    /**
     * Downloads and returns the circuit artifacts for a specific circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @returns {Promise<CircuitArtifacts>} A promise that resolves to the circuit artifacts.
     * @protected
     * @async
     */
    _downloadCircuitArtifacts(circuitName: CircuitNameString): Promise<CircuitArtifacts>;
    /**
     * Downloads all circuit artifacts for the specified version.
     * @param {VersionString} version - The version of the artifacts.
     * @returns {Promise<Binaries>} A promise that resolves to the binaries containing all circuit artifacts.
     * @async
     */
    downloadArtifacts(version: VersionString): Promise<Binaries>;
    /**
     * Initializes the circuit artifacts for the specified version.
     * @param {VersionString} version - The version of the artifacts.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @async
     */
    initArtifacts(version: VersionString): Promise<void>;
    /**
     * Retrieves the verification key for a specified circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @param {VersionString} [version=Version.latest] - The version of the artifacts.
     * @returns {Promise<Uint8Array>} A promise that resolves to the verification key.
     * @async
     */
    getVerificationKey(circuitName: CircuitNameString, version?: VersionString): Promise<Uint8Array>;
    /**
     * Retrieves the proving key for a specified circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @param {VersionString} [version=Version.latest] - The version of the artifacts.
     * @returns {Promise<Uint8Array>} A promise that resolves to the proving key.
     * @async
     */
    getProvingKey(circuitName: CircuitNameString, version?: VersionString): Promise<Uint8Array>;
    /**
     * Retrieves the wasm file for a specified circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @param {VersionString} [version=Version.latest] - The version of the artifacts.
     * @returns {Promise<Uint8Array>} A promise that resolves to the wasm file.
     * @async
     */
    getWasm(circuitName: CircuitNameString, version?: VersionString): Promise<Uint8Array>;
}

interface AssetConfig {
    pool: Address;
    minimumDepositAmount: bigint;
    vettingFeeBPS: bigint;
    maxRelayFeeBPS: bigint;
}
interface TransactionResponse {
    hash: string;
    wait: () => Promise<void>;
}
interface ContractInteractions {
    depositERC20(asset: Address, amount: bigint, precommitment: bigint): Promise<TransactionResponse>;
    depositETH(amount: bigint, precommitment: bigint): Promise<TransactionResponse>;
    withdraw(withdrawal: Withdrawal, withdrawalProof: WithdrawalProof, scope: Hash): Promise<TransactionResponse>;
    relay(withdrawal: Withdrawal, withdrawalProof: WithdrawalProof, scope: Hash): Promise<TransactionResponse>;
    ragequit(commitmentProof: CommitmentProof, privacyPoolAddress: Address): Promise<TransactionResponse>;
    getScope(privacyPoolAddress: Address): Promise<bigint>;
    getStateRoot(privacyPoolAddress: Address): Promise<bigint>;
    getStateSize(privacyPoolAddress: Address): Promise<bigint>;
    getAssetConfig(assetAddress: Address): Promise<AssetConfig>;
    getScopeData(scope: bigint): Promise<{
        poolAddress: Address | null;
        assetAddress: Address | null;
    }>;
    approveERC20(spenderAddress: Address, tokenAddress: Address, amount: bigint): Promise<TransactionResponse>;
}

declare class ContractInteractionsService implements ContractInteractions {
    private publicClient;
    private walletClient;
    private entrypointAddress;
    private account;
    /**
     * Initializes the contract interactions service.
     *
     * @param rpcUrl - The RPC endpoint URL for the blockchain network.
     * @param chain - The blockchain network configuration.
     * @param entrypointAddress - The address of the entrypoint contract.
     * @param accountPrivateKey - The private key used for signing transactions.
     */
    constructor(rpcUrl: string, chain: Chain, entrypointAddress: Address, accountPrivateKey: Hex);
    /**
     * Deposits ERC20 tokens into the privacy pool.
     *
     * @param asset - The address of the ERC20 token.
     * @param amount - The amount of tokens to deposit.
     * @param precommitment - The precommitment value.
     * @returns Transaction response containing the transaction hash.
     */
    depositERC20(asset: Address, amount: bigint, precommitment: bigint): Promise<TransactionResponse>;
    /**
     * Deposits ETH into the privacy pool.
     *
     * @param amount - The amount of ETH to deposit.
     * @param precommitment - The precommitment value.
     * @returns Transaction response containing the transaction hash.
     */
    depositETH(amount: bigint, precommitment: bigint): Promise<TransactionResponse>;
    /**
     * Withdraws funds from the privacy pool.
     *
     * @param withdrawal - The withdrawal object containing recipient details and amount.
     * @param withdrawalProof - The cryptographic proof verifying the withdrawal.
     * @returns Transaction response containing the transaction hash.
     */
    withdraw(withdrawal: Withdrawal, withdrawalProof: WithdrawalProof, scope: Hash): Promise<TransactionResponse>;
    /**
     * Relays a withdrawal transaction to the entrypoint contract.
     * This function is used to facilitate relayer transactions.
     *
     * @param withdrawal - The withdrawal data structure.
     * @param withdrawalProof - The cryptographic proof required for withdrawal.
     * @returns Transaction response containing hash and wait function.
     */
    relay(withdrawal: Withdrawal, withdrawalProof: WithdrawalProof, scope: Hash): Promise<TransactionResponse>;
    /**
     * Executes a ragequit operation, allowing a user to exit the pool
     * by nullifying their commitment and proving their withdrawal.
     *
     * @param commitmentProof - The cryptographic proof of the commitment.
     * @param privacyPoolAddress - The address of the privacy pool contract.
     * @returns Transaction response containing hash and wait function.
     */
    ragequit(commitmentProof: CommitmentProof, privacyPoolAddress: Address): Promise<TransactionResponse>;
    /**
     * Retrieves the scope identifier of a given privacy pool.
     *
     * @param privacyPoolAddress - The address of the privacy pool contract.
     * @returns The scope identifier as a bigint.
     */
    getScope(privacyPoolAddress: Address): Promise<bigint>;
    /**
     * Retrieves the latest state root of the privacy pool from the entrypoint contract.
     *
     * @param privacyPoolAddress - The address of the privacy pool contract.
     * @returns The latest state root as a bigint.
     */
    getStateRoot(privacyPoolAddress: Address): Promise<bigint>;
    /**
     * Retrieves the current state size of the privacy pool.
     *
     * @param privacyPoolAddress - The address of the privacy pool contract.
     * @returns The size of the state tree as a bigint.
     */
    getStateSize(privacyPoolAddress: Address): Promise<bigint>;
    /**
     * Retrieves data from the corresponding asset
     *
     * @param assetAddress - The asset contract address.
     * @returns AssetConfig - An object containing the privacy pool address, minimum deposit amount, vetting fee and maximum relaying fee.
     * @throws ContractError if the asset does not exist in the pool.
     */
    getAssetConfig(assetAddress: Address): Promise<AssetConfig>;
    /**
     * Retrieves data about a specific scope, including the associated privacy pool
     * and the asset used in that pool.
     *
     * @param scope - The scope identifier to look up.
     * @returns An object containing the privacy pool address and asset address.
     * @throws ContractError if the scope does not exist.
     */
    getScopeData(scope: bigint): Promise<{
        poolAddress: Address;
        assetAddress: Address;
    }>;
    /**
     * Approves the entrypoint contract to spend a specified amount of ERC20 tokens.
     *
     * @param spenderAddress - The address of the entity that will be approved to spend tokens.
     * @param tokenAddress - The address of the ERC20 token contract.
     * @param amount - The amount of tokens to approve.
     * @returns Transaction response containing hash and wait function.
     */
    approveERC20(spenderAddress: Address, tokenAddress: Address, amount: bigint): Promise<TransactionResponse>;
    private formatProof;
    private executeTransaction;
}

/**
 * Available circuit types in the system.
 */
declare enum CircuitName {
    Commitment = "commitment",
    Withdraw = "withdraw"
}
/**
 * Type for circuit input signals.
 */
type CircuitSignals = {
    [key: string]: bigint | bigint[] | string;
};
/**
 * Interface for accessing circuit-related resources.
 */
interface CircuitsInterface {
    /**
     * Gets the WASM binary for a circuit.
     */
    getWasm(name: CircuitName): Promise<Uint8Array>;
    /**
     * Gets the proving key for a circuit.
     */
    getProvingKey(name: CircuitName): Promise<Uint8Array>;
    /**
     * Gets the verification key for a circuit.
     */
    getVerificationKey(name: CircuitName): Promise<Uint8Array>;
}

/**
 * Represents a deposit event from a privacy pool
 */
interface DepositEvent {
    depositor: string;
    commitment: Hash;
    label: Hash;
    value: bigint;
    precommitment: Hash;
    blockNumber: bigint;
    transactionHash: Hex;
}
/**
 * Represents a withdrawal event from a privacy pool
 */
interface WithdrawalEvent {
    withdrawn: bigint;
    spentNullifier: Hash;
    newCommitment: Hash;
    blockNumber: bigint;
    transactionHash: Hex;
}
/**
 * Represents a ragequit event from a privacy pool
 */
interface RagequitEvent {
    ragequitter: string;
    commitment: Hash;
    label: Hash;
    value: bigint;
    blockNumber: bigint;
    transactionHash: Hex;
}
/**
 * Configuration for a chain's data provider
 */
interface ChainConfig {
    chainId: number;
    privacyPoolAddress: Address;
    startBlock: bigint;
    rpcUrl: string;
}
/**
 * Event filter options
 */
interface EventFilterOptions {
    fromBlock?: bigint;
    toBlock?: bigint;
    depositor?: string;
    limit?: number;
    skip?: number;
}
/**
 * Collection of pool events
 */
interface PoolEvents {
    deposits: DepositEvent[];
    withdrawals: WithdrawalEvent[];
}
interface PoolEventsSuccess {
    depositEvents: Map<Hash, DepositEvent>;
    withdrawalEvents: Map<Hash, WithdrawalEvent>;
    ragequitEvents: Map<Hash, RagequitEvent>;
}
interface PoolEventsError {
    reason: string;
    scope: Hash;
}
type PoolEventsResult = Map<Hash, PoolEventsSuccess | PoolEventsError>;
type ProcessedDepositEventsResult = Map<Hash, DepositEvent>;

interface PoolAccount {
    label: Hash;
    deposit: AccountCommitment;
    children: AccountCommitment[];
    ragequit?: RagequitEvent;
}
interface AccountCommitment {
    hash: Hash;
    value: bigint;
    label: Hash;
    nullifier: Secret;
    secret: Secret;
    blockNumber: bigint;
    timestamp?: bigint;
    txHash: Hex;
}
interface PrivacyPoolAccount {
    masterKeys: [masterNullifier: Secret, masterSecret: Secret];
    poolAccounts: Map<Hash, PoolAccount[]>;
    creationTimestamp?: bigint;
    lastUpdateTimestamp?: bigint;
}
interface PoolInfo {
    chainId: number;
    address: Hex;
    scope: Hash;
    deploymentBlock: bigint;
}

/**
 * Main SDK class providing access to all privacy pool functionality.
 * Uses Poseidon hash for all commitment operations.
 */
declare class PrivacyPoolSDK {
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

/**
 * Unified error codes for the SDK.
 */
declare enum ErrorCode {
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
declare class SDKError extends Error {
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
declare class ProofError extends SDKError {
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
declare class ContractError extends SDKError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
    static scopeNotFound(scope: bigint): ContractError;
    static assetNotFound(address: string): ContractError;
}

declare class AccountError extends SDKError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
    static commitmentNotFound(hash: Hash | string): AccountError;
    static invalidPoolAccount(): AccountError;
    static accountInitializationFailed(reason: string): AccountError;
    static duplicatePools(scope: bigint): AccountError;
    static invalidIndex(index: bigint): AccountError;
}

/**
 * Service responsible for handling commitment-related operations.
 * All hash operations use Poseidon for ZK-friendly hashing.
 */
declare class CommitmentService {
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

/**
 * Service responsible for handling withdrawal-related operations.
 */
declare class WithdrawalService {
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

/**
 * Service responsible for fetching and managing privacy pool events across multiple chains.
 * Handles event retrieval, parsing, and validation for deposits, withdrawals, and ragequits.
 *
 * @remarks
 * This service uses viem's PublicClient to efficiently fetch and process blockchain events.
 * It supports multiple chains and provides robust error handling and validation.
 * All uint256 values from events are handled as bigints, with Hash type assertions for commitment-related fields.
 */
declare class DataService {
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
declare class AccountService {
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

export { type AccountCommitment, AccountError, AccountService, type BlockRange, BlockchainProvider, type ChainConfig, type ChainLogFetchConfig, CircuitName, type CircuitSignals, Circuits, type CircuitsInterface, type Commitment, type CommitmentPreimage, type CommitmentProof, CommitmentService, ContractError, ContractInteractionsService, DEFAULT_LOG_FETCH_CONFIG, DataService, type DepositEvent, ErrorCode, type EventFilterOptions, type Hash, type IBlockchainProvider, InvalidRpcUrl, type LogFetchConfig, type MasterKeys, type PoolAccount, type PoolEvents, type PoolEventsError, type PoolEventsResult, type PoolEventsSuccess, type PoolInfo, type Precommitment, type PrivacyPoolAccount, PrivacyPoolSDK, type ProcessedDepositEventsResult, ProofError, type RagequitEvent, SDKError, type Secret, type Withdrawal, type WithdrawalEvent, type WithdrawalProof, type WithdrawalProofInput, WithdrawalService, bigintToHash, bigintToHex, calculateContext, generateDepositSecrets, generateMasterKeys, generateMerkleProof, generateWithdrawalSecrets, getCommitment, hashPrecommitment };
