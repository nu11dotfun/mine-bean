import { Address, Chain, Hex } from "viem";
import { Withdrawal, WithdrawalProof } from "../types/withdrawal.js";
import { AssetConfig, ContractInteractions, TransactionResponse } from "../interfaces/contracts.interface.js";
import { CommitmentProof, Hash } from "../types/commitment.js";
export declare class ContractInteractionsService implements ContractInteractions {
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
