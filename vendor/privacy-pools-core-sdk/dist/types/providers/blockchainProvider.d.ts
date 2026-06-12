import type { Address } from "viem";
import { IBlockchainProvider } from "../internal.js";
export declare class BlockchainProvider implements IBlockchainProvider {
    private client;
    constructor(rpcUrl: string);
    /** @inheritdoc */
    getBalance(address: Address): Promise<bigint>;
}
