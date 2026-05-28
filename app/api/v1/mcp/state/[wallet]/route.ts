import { NextResponse } from 'next/server'
import { createPublicClient, http, formatUnits, isAddress, erc20Abi } from 'viem'
import { base } from 'viem/chains'
import { CONTRACTS } from '@/lib/contracts'

// Base MCP plugin endpoint: single round-trip view of a wallet's MineBean state.
//
// Aggregates:
//   - ETH balance         (RPC eth_getBalance)
//   - BEAN balance        (Bean.balanceOf)
//   - Staking position    (proxy /api/staking/:address - backend already computes canCompound)
//   - Mining rewards      (GridMining.getTotalPendingRewards - same source venice/hermes/aeon pages use)
//   - BEAN→STAKING allowance  (Bean.allowance)
//   - Lifetime stats      (proxy /api/user/:addr/history → totals.roundsPlayed)
//   - BEAN + ETH prices   (DexScreener)
//
// All fetches run in parallel. Failures degrade gracefully - if prices fail, USD
// fields are omitted but on-chain numbers still return.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com'

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
})

// GridMining.getTotalPendingRewards returns (pendingETH, pendingUnroasted, pendingRoasted, uncheckpointedRound).
// Backend computes 10% fee on unroasted only - mirror that here for parity with /api/user/:addr/rewards.
const getTotalPendingRewardsAbi = [
  {
    name: 'getTotalPendingRewards',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'pendingETH', type: 'uint256' },
      { name: 'pendingUnroasted', type: 'uint256' },
      { name: 'pendingRoasted', type: 'uint256' },
      { name: 'uncheckpointedRound', type: 'uint256' },
    ],
  },
] as const

const BEAN_FEE_BPS = 1000 // 10% fee on unroasted BEAN, matches backend logic

type FormattedAmount = { wei: string; formatted: string; usd?: string }

// Safely format a wei-string from the backend. If it's not a parseable bigint
// (e.g. backend returned a decimal or malformed value), return '0' instead of crashing.
function safeFormatWei(weiStr: string | undefined | null): string {
  if (weiStr == null) return '0'
  try {
    return formatUnits(BigInt(weiStr), 18)
  } catch {
    return '0'
  }
}

function fmtToken(wei: bigint, decimals = 18, priceUsd?: number | null): FormattedAmount {
  const formatted = formatUnits(wei, decimals)
  const out: FormattedAmount = { wei: wei.toString(), formatted }
  if (priceUsd && priceUsd > 0) {
    const usd = parseFloat(formatted) * priceUsd
    out.usd = usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return out
}

async function fetchPrice(token: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }> }
    const pairs = data.pairs ?? []
    // Pick deepest liquidity pair
    const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
    return best?.priceUsd ? parseFloat(best.priceUsd) : null
  } catch {
    return null
  }
}

async function fetchStakingPosition(wallet: string) {
  try {
    const res = await fetch(`${API_BASE}/api/staking/${wallet}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as {
      balance?: string
      balanceFormatted?: string
      pendingRewards?: string
      pendingRewardsFormatted?: string
      compoundFeeReserve?: string
      compoundFeeReserveFormatted?: string
      canCompound?: boolean
    }
  } catch {
    return null
  }
}

async function fetchLifetimeStats(wallet: string) {
  try {
    const res = await fetch(
      `${API_BASE}/api/user/${wallet}/history?type=deploy&limit=500`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      totals?: { roundsPlayed?: number; wins?: number; totalDeployed?: string; totalEarned?: string }
    }
    return data.totals ?? null
  } catch {
    return null
  }
}

export async function GET(_req: Request, { params }: { params: { wallet: string } }) {
  const { wallet: rawWallet } = await params

  if (!isAddress(rawWallet)) {
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_REQUEST', message: 'wallet must be a valid Ethereum address' } },
      { status: 200 }
    )
  }

  // Backend stores lowercase addresses for history; RPC is case-insensitive.
  const wallet = rawWallet.toLowerCase() as `0x${string}`

  // Fire everything in parallel. Use allSettled so one failure doesn't kill the response.
  const [ethBalanceR, beanBalanceR, miningRewardsR, allowanceR, stakingR, lifetimeR, beanPriceR, ethPriceR] =
    await Promise.allSettled([
      client.getBalance({ address: wallet }),
      client.readContract({
        address: CONTRACTS.Bean.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [wallet],
      }),
      client.readContract({
        address: CONTRACTS.GridMining.address,
        abi: getTotalPendingRewardsAbi,
        functionName: 'getTotalPendingRewards',
        args: [wallet],
      }),
      client.readContract({
        address: CONTRACTS.Bean.address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [wallet, CONTRACTS.Staking.address],
      }),
      fetchStakingPosition(wallet),
      fetchLifetimeStats(wallet),
      fetchPrice(CONTRACTS.Bean.address),
      fetchPrice('0x4200000000000000000000000000000000000006'), // WETH on Base
    ])

  // Unpack with fallbacks. All on-chain reads fall back to 0n.
  const ethBalance = ethBalanceR.status === 'fulfilled' ? ethBalanceR.value : BigInt(0)
  const beanBalance = beanBalanceR.status === 'fulfilled' ? (beanBalanceR.value as bigint) : BigInt(0)
  const allowanceBean = allowanceR.status === 'fulfilled' ? (allowanceR.value as bigint) : BigInt(0)

  const miningTuple =
    miningRewardsR.status === 'fulfilled'
      ? (miningRewardsR.value as readonly [bigint, bigint, bigint, bigint])
      : ([BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const)
  const [pendingETH, pendingUnroasted, pendingRoasted] = miningTuple

  // Compute BEAN claim breakdown (fee only on unroasted).
  const grossBean = pendingUnroasted + pendingRoasted
  const feeBean = (pendingUnroasted * BigInt(BEAN_FEE_BPS)) / BigInt(10_000)
  const netBean = grossBean - feeBean

  const staking = stakingR.status === 'fulfilled' ? stakingR.value : null
  const lifetime = lifetimeR.status === 'fulfilled' ? lifetimeR.value : null
  const beanPrice = beanPriceR.status === 'fulfilled' ? beanPriceR.value : null
  const ethPrice = ethPriceR.status === 'fulfilled' ? ethPriceR.value : null

  // Compose response
  const response = {
    wallet,
    balances: {
      eth: fmtToken(ethBalance, 18, ethPrice),
      bean: fmtToken(beanBalance, 18, beanPrice),
    },
    staking: staking
      ? {
          balance: {
            wei: staking.balance ?? '0',
            formatted: staking.balanceFormatted ?? '0',
            usd:
              beanPrice && staking.balanceFormatted
                ? (parseFloat(staking.balanceFormatted) * beanPrice).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : undefined,
          },
          pendingRewards: {
            wei: staking.pendingRewards ?? '0',
            formatted: staking.pendingRewardsFormatted ?? '0',
            usd:
              beanPrice && staking.pendingRewardsFormatted
                ? (parseFloat(staking.pendingRewardsFormatted) * beanPrice).toLocaleString('en-US', {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  })
                : undefined,
          },
          compoundFeeReserve: {
            wei: staking.compoundFeeReserve ?? '0',
            formatted: staking.compoundFeeReserveFormatted ?? '0',
          },
          canCompound: staking.canCompound ?? false,
        }
      : null,
    claimable: {
      eth: fmtToken(pendingETH, 18, ethPrice),
      bean: {
        unroastedWei: pendingUnroasted.toString(),
        unroastedFormatted: formatUnits(pendingUnroasted, 18),
        roastedWei: pendingRoasted.toString(),
        roastedFormatted: formatUnits(pendingRoasted, 18),
        grossWei: grossBean.toString(),
        grossFormatted: formatUnits(grossBean, 18),
        feeWei: feeBean.toString(),
        feeFormatted: formatUnits(feeBean, 18),
        netWei: netBean.toString(),
        netFormatted: formatUnits(netBean, 18),
        netUsd:
          beanPrice && netBean > BigInt(0)
            ? (parseFloat(formatUnits(netBean, 18)) * beanPrice).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : undefined,
      },
    },
    lifetime: lifetime
      ? {
          roundsPlayed: lifetime.roundsPlayed ?? 0,
          wins: lifetime.wins ?? 0,
          totalDeployedEth: safeFormatWei(lifetime.totalDeployed),
          totalEarnedEth: safeFormatWei(lifetime.totalEarned),
        }
      : { roundsPlayed: 0, wins: 0, totalDeployedEth: '0', totalEarnedEth: '0' },
    allowance: {
      // Detect "max approve" (typically MaxUint256). Anything above 2^128
      // is way larger than BEAN's 3M total supply, so it's effectively unlimited.
      // Return the literal string "max" instead of a ~78-digit decimal that
      // would render as a glitch in agent UIs.
      beanForStaking: allowanceBean > (BigInt(1) << BigInt(128))
        ? 'max'
        : formatUnits(allowanceBean, 18),
    },
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, max-age=5, stale-while-revalidate=15',
    },
  })
}
