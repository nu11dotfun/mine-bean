// One cached fetch of the point-in-time protocol figures every analytics
// section reuses (supply, treasury, staking, prices). Sections share a single
// module-level cache with a short TTL so opening several tabs in a row makes at
// most one round of requests, keeping us well under the 60 req/min limiter.
//
// Prices: BEAN comes from /api/stats (stats.bean.priceUsd, DexScreener-backed);
// ETH is NOT in the backend, so it is pulled from Binance the same way the
// header and mining controls do.

import { useEffect, useState } from 'react'
import { apiFetch } from './api'

export const BEAN_MAX_SUPPLY = 3_000_000

// The GridMining vault takes a fixed 9.5% of every round's deploy — verified
// constant (0.0950) across both recent rounds and 100k-round-old samples — so
// total ETH ever deployed (protocol volume) = total vaulted / 0.095.
export const VAULT_FEE_RATIO = 0.095

export interface ProtocolSummary {
  circulatingSupply: number
  totalMinted: number
  beanUsd: number
  ethUsd: number
  beanChange24h: number
  volume24h: number
  beanpotPool: number
  burnedTotal: number
  protocolRevenueEth: number
  protocolRevenueUsd: number
  totalDeployedEth: number
  totalVolumeUsd: number
  totalBuybackCount: number
  totalToStakers: number
  totalStaked: number
  stakingApr: number
  stakingTvlUsd: number
  marketCapUsd: number
  fdvUsd: number
  minted30d: number
  burned30d: number
  netMint30d: number
}

interface PeriodBucket { rounds?: number; minted?: number; burnt?: number; events?: number }
interface StatsResp {
  totalSupplyFormatted?: string
  totalMintedFormatted?: string
  beanpotPoolFormatted?: string
  bean?: { priceUsd?: string; priceChange24h?: number; fdv?: number; volume24h?: number }
  beanEmissions?: Record<string, PeriodBucket>
  beanBurns?: Record<string, PeriodBucket>
}
interface TreasuryResp {
  totalVaultedFormatted?: string
  vaultedETHFormatted?: string
  totalBurnedFormatted?: string
  totalBuybacks?: string
  totalToStakersFormatted?: string
}
interface StakingResp {
  totalStakedFormatted?: string
  apr?: string
  tvlUsd?: string
}

const num = (s?: string | number): number => {
  if (typeof s === 'number') return isFinite(s) ? s : 0
  return s ? parseFloat(s) || 0 : 0
}

async function fetchEthUsd(): Promise<number> {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT')
    const d = await r.json()
    return parseFloat(d.price) || 0
  } catch {
    return 0
  }
}

const BEAN_ETH_POOL = '0xd7e5522c9cc3682c960afada6adde0f8116580f2ad2cef08c197faf625e53842'

// Accurate market cap / FDV / price straight from DexScreener (what the token's
// DexScreener page shows), rather than computing them from an on-chain supply
// figure that isn't the true circulating supply.
async function fetchDexScreener(): Promise<{ marketCap: number; fdv: number; priceUsd: number } | null> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${BEAN_ETH_POOL}`)
    const d = await r.json()
    const p = Array.isArray(d?.pairs) ? d.pairs[0] : d?.pair
    if (!p) return null
    return { marketCap: num(p.marketCap), fdv: num(p.fdv), priceUsd: num(p.priceUsd) }
  } catch {
    return null
  }
}

const TTL = 30_000
let cache: { data: ProtocolSummary; at: number } | null = null
let inflight: Promise<ProtocolSummary | null> | null = null

export async function fetchProtocolSummary(force = false): Promise<ProtocolSummary | null> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data
  // Dedupe concurrent callers (the overview band and the default section both
  // mount at once) so they share a single round of requests.
  if (!force && inflight) return inflight
  inflight = load().finally(() => { inflight = null })
  return inflight
}

async function load(): Promise<ProtocolSummary | null> {
  try {
    const [stats, treasury, staking, ethUsd, dex] = await Promise.all([
      apiFetch<StatsResp>('/api/stats'),
      apiFetch<TreasuryResp>('/api/treasury/stats'),
      apiFetch<StakingResp>('/api/staking/stats').catch(() => ({} as StakingResp)),
      fetchEthUsd(),
      fetchDexScreener(),
    ])
    const beanUsd = dex?.priceUsd || num(stats.bean?.priceUsd)
    // True circulating supply = DexScreener's implied circulating (marketCap / price),
    // which is what the market uses. The on-chain totalSupply is NOT the true
    // circulating figure, so fall back to it only when DexScreener is unavailable.
    const circulatingSupply =
      dex && dex.marketCap > 0 && beanUsd > 0 ? dex.marketCap / beanUsd : num(stats.totalSupplyFormatted)
    const protocolRevenueEth = num(treasury.totalVaultedFormatted ?? treasury.vaultedETHFormatted)
    const totalDeployedEth = protocolRevenueEth / VAULT_FEE_RATIO
    const minted30d = num(stats.beanEmissions?.['30d']?.minted)
    const burned30d = num(stats.beanBurns?.['30d']?.burnt)
    const data: ProtocolSummary = {
      circulatingSupply,
      totalMinted: num(stats.totalMintedFormatted),
      beanUsd,
      ethUsd,
      beanChange24h: num(stats.bean?.priceChange24h),
      volume24h: num(stats.bean?.volume24h),
      beanpotPool: num(stats.beanpotPoolFormatted),
      burnedTotal: num(treasury.totalBurnedFormatted),
      protocolRevenueEth,
      protocolRevenueUsd: protocolRevenueEth * ethUsd,
      totalDeployedEth,
      totalVolumeUsd: totalDeployedEth * ethUsd,
      totalBuybackCount: num(treasury.totalBuybacks),
      totalToStakers: num(treasury.totalToStakersFormatted),
      totalStaked: num(staking.totalStakedFormatted),
      stakingApr: num(staking.apr),
      stakingTvlUsd: num(staking.tvlUsd),
      marketCapUsd: dex?.marketCap || circulatingSupply * beanUsd,
      fdvUsd: dex?.fdv || BEAN_MAX_SUPPLY * beanUsd,
      minted30d,
      burned30d,
      netMint30d: minted30d - burned30d,
    }
    cache = { data, at: Date.now() }
    return data
  } catch (err) {
    console.error('Failed to fetch protocol summary:', err)
    return cache?.data ?? null
  }
}

export function useProtocolSummary(): { summary: ProtocolSummary | null; loading: boolean } {
  const [summary, setSummary] = useState<ProtocolSummary | null>(cache?.data ?? null)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    let cancelled = false
    fetchProtocolSummary().then((d) => {
      if (cancelled) return
      if (d) setSummary(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  return { summary, loading }
}
