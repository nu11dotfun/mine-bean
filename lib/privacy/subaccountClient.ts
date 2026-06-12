/**
 * BEAN Private Deploys — subaccount transaction client
 *
 * The subaccount is a fully self-custodial viem account held in the dapp
 * session. It signs and submits its OWN transactions (deploy/claim, and the
 * cashout DEPOSIT into the pool), paying gas from the ETH the pool sent it.
 * The main wallet never signs anything on its behalf — that is the core
 * unlinkability invariant.
 *
 * HARD RULES:
 *  - The subaccount is funded ONLY by pool withdrawals. Nothing here may move
 *    ETH main → subaccount directly; that single transfer would link the two
 *    addresses forever.
 *  - Cashout is NOT a direct subaccount → main transfer (that would publicly
 *    link them). It is a pool deposit FROM the subaccount, then a ZK
 *    withdrawal TO main — see `depositFromSubaccount` + the cashout flow in
 *    PrivacyContext.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  concatHex,
  encodeFunctionData,
  type Abi,
  type Address,
  type Hex,
  type PrivateKeyAccount,
  type TransactionReceipt,
} from 'viem'
import { base } from 'viem/chains'
import { BUILDER_CODE_SUFFIX } from '../contracts'
import {
  ENTRYPOINT_ADDRESS,
  ENTRYPOINT_DEPOSIT_ABI,
  ENTRYPOINT_DEPOSIT_ERC20_ABI,
  ENTRYPOINT_ASSET_CONFIG_ABI,
  ERC20_ABI,
  NATIVE_ASSET,
} from './config'

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC || undefined

// Types are inferred from the builders: Base ships OP-stack chain formatters,
// which makes the concrete client types incompatible with the generic
// PublicClient/WalletClient annotations.
const buildPublicClient = () =>
  createPublicClient({ chain: base, transport: http(RPC_URL) })

let publicClient: ReturnType<typeof buildPublicClient> | null = null

/** Shared Base public client (reads, receipts, gas estimation). */
export function getPrivacyPublicClient() {
  publicClient ??= buildPublicClient()
  return publicClient
}

/** Wallet client signing with the subaccount key (kept in memory only). */
export function createSubaccountClient(account: PrivateKeyAccount) {
  return createWalletClient({ account, chain: base, transport: http(RPC_URL) })
}

export type SubaccountClient = ReturnType<typeof createSubaccountClient>

/**
 * Send a contract call from the subaccount with the builder-code suffix
 * appended — the equivalent of wagmi's `dataSuffix` option used for
 * main-wallet deploys, so private deploys carry the same attribution.
 */
export async function sendContractWithSuffix(params: {
  client: SubaccountClient
  account: PrivateKeyAccount
  address: Address
  abi: Abi
  functionName: string
  args: readonly unknown[]
  value?: bigint
}): Promise<Hex> {
  const { client, account, address, abi, functionName, args, value } = params
  const data = concatHex([
    encodeFunctionData({ abi, functionName, args }),
    BUILDER_CODE_SUFFIX,
  ])
  return client.sendTransaction({
    account,
    chain: base,
    to: address,
    data,
    value,
  })
}

export function getSubBalance(address: Address): Promise<bigint> {
  return getPrivacyPublicClient().getBalance({ address })
}

/**
 * True if `address` is a smart-contract account (has deployed bytecode).
 * Private mode is EOA-only: smart accounts (ERC-4337 / passkey wallets like
 * Coinbase Smart Wallet) sign non-deterministically (WebAuthn assertions carry
 * a changing counter), so `keccak256(signature)` can't reproduce the same
 * subaccount — funds would be unrecoverable. We block them instead.
 *
 * Caveat: a counterfactual (not-yet-deployed) smart account reads as empty and
 * would pass as an EOA — but anyone who has played has transacted, so they're
 * deployed. Good enough for the real population.
 */
export async function isContractAccount(address: Address): Promise<boolean> {
  const code = await getPrivacyPublicClient().getBytecode({ address })
  return !!code && code !== '0x'
}

/**
 * Poll until the subaccount balance reaches `min` (used after the relayer
 * submits the withdrawal — funds arrive when the tx lands).
 */
export async function waitForBalanceAtLeast(
  address: Address,
  min: bigint,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<bigint> {
  const { intervalMs = 2_000, timeoutMs = 120_000 } = opts
  const start = Date.now()
  for (;;) {
    const balance = await getSubBalance(address)
    if (balance >= min) return balance
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        'timed out waiting for the withdrawal to land at the private account'
      )
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

export function waitForReceipt(hash: Hex): Promise<TransactionReceipt> {
  return getPrivacyPublicClient().waitForTransactionReceipt({ hash })
}

export interface PoolAssetConfig {
  pool: Address
  minimumDepositAmount: bigint
  vettingFeeBPS: bigint
  maxRelayFeeBPS: bigint
}

/** Read the live pool fee + minimum deposit for native ETH. */
export async function getPoolAssetConfig(): Promise<PoolAssetConfig> {
  const [pool, minimumDepositAmount, vettingFeeBPS, maxRelayFeeBPS] =
    await getPrivacyPublicClient().readContract({
      address: ENTRYPOINT_ADDRESS,
      abi: ENTRYPOINT_ASSET_CONFIG_ABI,
      functionName: 'assetConfig',
      args: [NATIVE_ASSET],
    })
  return { pool, minimumDepositAmount, vettingFeeBPS, maxRelayFeeBPS }
}

/**
 * Estimate the gas the subaccount must keep to pay for its OWN cashout
 * deposit tx. Uses a real estimate against a representative value, falling
 * back to a conservative fixed reserve if the node can't estimate (e.g. the
 * tentative value would exceed balance). The result is multiplied by a 1.5x
 * safety margin — leftover dust simply stays at the subaccount.
 */
export async function estimateDepositGasReserve(
  account: PrivateKeyAccount
): Promise<bigint> {
  const pub = getPrivacyPublicClient()
  const gasPrice = await pub.getGasPrice()
  // Pool deposit inserts into a LeanIMT — a fixed, conservative limit covers
  // it without needing the actual precommitment/value.
  const FALLBACK_GAS = 400_000n
  let gas = FALLBACK_GAS
  try {
    gas = await pub.estimateContractGas({
      account,
      address: ENTRYPOINT_ADDRESS,
      abi: ENTRYPOINT_DEPOSIT_ABI,
      functionName: 'deposit',
      args: [1n],
      value: 1n,
    })
  } catch {
    // keep the fallback
  }
  return (gas * gasPrice * 150n) / 100n
}

/**
 * CASHOUT step 1 — the subaccount DEPOSITS ETH into the pool (it signs and
 * pays its own gas). NO builder suffix: this is a 0xbow pool deposit, not a
 * GridMining tx. The matching ZK withdrawal to main is a separate step.
 */
export async function depositFromSubaccount(params: {
  account: PrivateKeyAccount
  precommitment: bigint
  value: bigint
}): Promise<Hex> {
  const { account, precommitment, value } = params
  const data = encodeFunctionData({
    abi: ENTRYPOINT_DEPOSIT_ABI,
    functionName: 'deposit',
    args: [precommitment],
  })
  return createSubaccountClient(account).sendTransaction({
    account,
    chain: base,
    to: ENTRYPOINT_ADDRESS,
    data,
    value,
  })
}

/** BEAN balance of an address (ERC20 balanceOf). */
export function getSubTokenBalance(token: Address, address: Address): Promise<bigint> {
  return getPrivacyPublicClient().readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  })
}

/**
 * BEAN CASHOUT step 1a — the subaccount approves the Entrypoint to pull BEAN.
 * The caller MUST await the receipt before depositing: an immediate deposit
 * simulates against a stale (zero) allowance and reverts ERC20InsufficientAllowance.
 */
export async function approveErc20FromSubaccount(params: {
  account: PrivateKeyAccount
  token: Address
  spender: Address
  amount: bigint
}): Promise<Hex> {
  const { account, token, spender, amount } = params
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spender, amount],
  })
  return createSubaccountClient(account).sendTransaction({
    account,
    chain: base,
    to: token,
    data,
  })
}

/**
 * BEAN CASHOUT step 1b — the subaccount deposits BEAN into the BEAN pool via
 * the ERC20 deposit overload `deposit(asset, value, precommitment)` (nonpayable,
 * no builder suffix). Allowance must already be set (see approveErc20FromSubaccount).
 */
export async function depositErc20FromSubaccount(params: {
  account: PrivateKeyAccount
  asset: Address
  amount: bigint
  precommitment: bigint
}): Promise<Hex> {
  const { account, asset, amount, precommitment } = params
  const data = encodeFunctionData({
    abi: ENTRYPOINT_DEPOSIT_ERC20_ABI,
    functionName: 'deposit',
    args: [asset, amount, precommitment],
  })
  return createSubaccountClient(account).sendTransaction({
    account,
    chain: base,
    to: ENTRYPOINT_ADDRESS,
    data,
  })
}

/**
 * ETH the subaccount must hold to pay gas for a BEAN cashout — the approve
 * AND the ERC20 deposit (two txs), with margin. Used to gate/warn before a
 * BEAN withdrawal (the withdrawal itself is relayer-paid).
 */
export async function estimateErc20CashoutGasReserve(): Promise<bigint> {
  const gasPrice = await getPrivacyPublicClient().getGasPrice()
  // approve (~50k) + ERC20 pool deposit (~400k), generous, ×1.5 margin.
  const TWO_TX_GAS = 450_000n
  return (TWO_TX_GAS * gasPrice * 150n) / 100n
}
