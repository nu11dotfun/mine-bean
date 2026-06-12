/**
 * BEAN Private Deploys — Privacy Pool configuration (Base mainnet, chain 8453)
 *
 * Forked 0xbow Privacy Pools deployed unmodified. The frontend integrates
 * against the Entrypoint proxy; the pool address is needed only to decode the
 * `Deposited` event from deposit receipts and to scan logs during recovery.
 *
 * The relayer backend (Backend/privacy-relayer) is reached through the Next.js
 * rewrite `/relayer/:path*` (see next.config.js) because it serves no CORS
 * headers. The frontend NEVER submits withdrawals itself — it builds the proof
 * and POSTs it to the relayer.
 */

import { parseEther, type Address } from 'viem'
import { CONTRACTS } from '../contracts'
import { API_BASE } from '../api'

/**
 * Addresses come from `lib/contracts.ts` (CONTRACTS) so privacy contracts
 * follow the same single-source-of-truth as the BEAN game contracts. The
 * scope + deploy block for each pool stay here — they're per-pool crypto/log
 * parameters used only by the privacy module, not addresses to swap.
 */

/** Entrypoint proxy — all deposits and relayed withdrawals go through this. */
export const ENTRYPOINT_ADDRESS = CONTRACTS.PrivacyEntrypoint.address

/** PrivacyPoolSimple (native ETH pool). Emits Deposited / LeafInserted. */
export const POOL_ADDRESS = CONTRACTS.PrivacyPoolETH.address

/** Pool scope — binds proofs/withdrawals to this specific pool. */
export const POOL_SCOPE = BigInt(
  '8040549376629235314547876629120286807283718171447012907536222469424252168530'
)

/** Block the pool was deployed at — lower bound for recovery log scans. */
export const POOL_DEPLOY_BLOCK = 47231482n

/** BEAN ERC20 token (18 decimals) — the asset of the BEAN pool. */
export const BEAN_TOKEN_ADDRESS = CONTRACTS.Bean.address

/** PrivacyPoolComplex (ERC20 BEAN pool), same Entrypoint, routed by scope. */
export const BEAN_POOL_ADDRESS = CONTRACTS.PrivacyPoolBEAN.address

export const BEAN_POOL_SCOPE = BigInt(
  '14815471643825675061925655794882469149726153424592609367365621632219327008497'
)

/** BEAN pool deploy block — lower bound for BEAN recovery log scans. */
export const BEAN_POOL_DEPLOY_BLOCK = 47231673n

/**
 * Pool descriptor — both pools share one Entrypoint and one global ASP root;
 * a withdrawal is routed to a pool by its `scope`, and its state proof comes
 * from that pool's own commitment leaves (`/state/leaves?pool=<key>`).
 */
export type PoolKey = 'eth' | 'bean'
export interface PoolConfig {
  key: PoolKey
  address: Address
  scope: bigint
  /** Asset deposited: NATIVE_ASSET for ETH, the BEAN token for the BEAN pool. */
  asset: Address
  deployBlock: bigint
  isErc20: boolean
}

export const ETH_POOL: PoolConfig = {
  key: 'eth',
  address: POOL_ADDRESS,
  scope: POOL_SCOPE,
  asset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  deployBlock: POOL_DEPLOY_BLOCK,
  isErc20: false,
}

export const BEAN_POOL: PoolConfig = {
  key: 'bean',
  address: BEAN_POOL_ADDRESS,
  scope: BEAN_POOL_SCOPE,
  asset: BEAN_TOKEN_ADDRESS,
  deployBlock: BEAN_POOL_DEPLOY_BLOCK,
  isErc20: true,
}

export const POOLS: Record<PoolKey, PoolConfig> = { eth: ETH_POOL, bean: BEAN_POOL }

/** Resolve the pool a note belongs to (legacy untagged notes ≡ ETH). */
export function poolFor(key: PoolKey | undefined): PoolConfig {
  return POOLS[key ?? 'eth']
}

/**
 * Base URL for the relayer API. The relayer is part of the main backend at
 * `api.minebean.com`, mounted at `/privacy/*` (nginx proxies to the internal
 * port 8787). Same origin/CORS as the rest of `apiFetch`. Override with
 * `NEXT_PUBLIC_RELAYER_URL` for local dev (e.g. `http://localhost:8787`, which
 * has no `/privacy` prefix — the internal paths are at the root).
 */
export const RELAYER_BASE =
  process.env.NEXT_PUBLIC_RELAYER_URL || `${API_BASE}/privacy`

/**
 * ETH the subaccount must keep on top of any deploy amount so it can pay its
 * own gas for deploy/claim txs (it is fully self-custodial). Conservative —
 * actual Base gas is ~10x smaller — to absorb gas spikes. This single source
 * of truth gates both the deploy button (SidebarControls) and `ensureFunded`.
 */
export const SUBACCOUNT_GAS_BUFFER = parseEther('0.0003')

/**
 * Minimum deposit the Entrypoint accepts (`assetConfig.minimumDepositAmount`);
 * a smaller deposit reverts. We read the live value on enable, but fall back
 * to this constant (0.001 ETH on this deployment, expected to hold in prod).
 */
export const MIN_DEPOSIT_WEI = parseEther('0.001')

/** Sentinel address the pool uses for native ETH (Constants.NATIVE_ASSET). */
export const NATIVE_ASSET =
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`

/** Entrypoint.deposit — payable, called by the MAIN wallet (public, accepted). */
export const ENTRYPOINT_DEPOSIT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [{ name: '_precommitment', type: 'uint256' }],
    outputs: [{ name: '_commitment', type: 'uint256' }],
  },
] as const

/**
 * Entrypoint.deposit ERC20 overload — `deposit(asset, value, precommitment)`,
 * nonpayable. Separate fragment from the payable ETH one because viem needs
 * the exact signature to encode an overloaded function.
 */
export const ENTRYPOINT_DEPOSIT_ERC20_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_asset', type: 'address' },
      { name: '_value', type: 'uint256' },
      { name: '_precommitment', type: 'uint256' },
    ],
    outputs: [{ name: '_commitment', type: 'uint256' }],
  },
] as const

/** Minimal ERC20 — approve (deposit allowance) + balanceOf (BEAN balance). */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/**
 * Entrypoint.assetConfig(asset) view — read the live pool fee + minimum
 * deposit. The pool deducts `vettingFeeBPS` on EVERY deposit (funding AND
 * cashout), so we surface it in the UI rather than hardcoding.
 */
export const ENTRYPOINT_ASSET_CONFIG_ABI = [
  {
    type: 'function',
    name: 'assetConfig',
    stateMutability: 'view',
    inputs: [{ name: '_asset', type: 'address' }],
    outputs: [
      { name: 'pool', type: 'address' },
      { name: 'minimumDepositAmount', type: 'uint256' },
      { name: 'vettingFeeBPS', type: 'uint256' },
      { name: 'maxRelayFeeBPS', type: 'uint256' },
    ],
  },
] as const

/** Pool `Deposited` event — decoded from the deposit receipt to build the note. */
export const POOL_DEPOSITED_EVENT_ABI = [
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: '_depositor', type: 'address', indexed: true },
      { name: '_commitment', type: 'uint256', indexed: false },
      { name: '_label', type: 'uint256', indexed: false },
      { name: '_value', type: 'uint256', indexed: false },
      { name: '_precommitmentHash', type: 'uint256', indexed: false },
    ],
  },
] as const

/**
 * FeeData tuple ABI-encoded into `Withdrawal.data`. `recipient` is where the
 * pool pays out (subaccount). NOTE: `Entrypoint.relay` always runs
 * `_transfer(feeRecipient, fee)` even when fee == 0, and a 0-value call into
 * the Entrypoint reverts (its receive() only accepts ETH from the pool), so
 * feeRecipient must be an ETH-accepting EOA — see buildWithdrawal.
 */
export const FEE_DATA_ABI = [
  {
    type: 'tuple',
    components: [
      { name: 'recipient', type: 'address' },
      { name: 'feeRecipient', type: 'address' },
      { name: 'relayFeeBPS', type: 'uint256' },
    ],
  },
] as const
