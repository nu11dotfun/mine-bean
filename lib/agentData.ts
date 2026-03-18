import { apiFetch } from './api'
import { createPublicClient, http, formatEther, parseAbi } from 'viem'
import { base } from 'viem/chains'

const BEAN_TOKEN = '0x5c72992b83E74c4D5200A8E8920fB946214a5A5D' as const

const publicClient = createPublicClient({
  chain: base,
  transport: http(undefined, {
    batch: true,
    retryCount: 2,
    retryDelay: 500,
  }),
})

// ── In-memory stats cache ──
// Prevents redundant API/RPC calls when navigating between agent pages

interface CachedStats {
  stats: AgentStats
  timestamp: number
}

const statsCache = new Map<string, CachedStats>()
const CACHE_TTL = 120_000 // serve cached data for 120s (matches refresh interval)

// ── API response types ──

interface RewardsResponse {
  pendingETH: string
  pendingETHFormatted: string
  pendingBEAN: {
    unroasted: string
    unroastedFormatted: string
    roasted: string
    roastedFormatted: string
    gross: string
    grossFormatted: string
    fee: string
    feeFormatted: string
    net: string
    netFormatted: string
  }
}

interface HistoryResponse {
  history: HistoryEntry[]
  totals: {
    totalETHWon: string
    totalETHWonFormatted: string
    totalBEANWon: string
    totalBEANWonFormatted: string
    totalETHDeployed: string
    totalETHDeployedFormatted: string
    totalPNL: string
    beanPriceEth: string
    roundsPlayed: number
    roundsWon: number
  }
  pagination: { total: number; page: number; limit: number; pages: number }
}

interface HistoryEntry {
  roundId: number
  totalAmount: string
  blockMask: string
  timestamp: string
  isAutoMine: boolean
  roundResult: {
    settled: boolean
    wonWinningBlock: boolean
    beanpotHit: boolean
    winningBlock: number | null
    ethWon: string
    ethWonFormatted: string
    beanWon: string
    beanWonFormatted: string
    pnl: string
  }
}

// ── Computed types ──

export interface RoundData {
  id: number
  blocksCount: number
  deployed: number
  won: number
  ethPnl: number
  beansEarned: number
  beanValueEth: number
  truePnl: number
  pctChange: number
  isWin: boolean
  isBeanpot: boolean
  settled: boolean
  timestamp: string
}

export interface AgentStats {
  roundsPlayed: number
  winRate: number
  roi: number
  totalDeployed: number
  totalWon: number
  ethPnl: number
  beansEarned: number
  beanValueEth: number
  netPnl: number           // true PnL: ethPnl + beanValueEth (includes paid out BEAN)
  beanPriceEth: number
  totalBeanPaidOut: number  // cumulative BEAN paid to holders
  paidOutValueEth: number   // totalBeanPaidOut * beanPriceEth
  lastActive: string
  sparkline: number[]
  rounds: RoundData[]
}

// ── Helpers ──

function countBits(n: number): number {
  let count = 0
  let val = n
  while (val) { count += val & 1; val >>>= 1 }
  return count
}

function weiToEth(wei: string): number {
  return parseFloat(wei) / 1e18
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Payout summary fetch ──
// Fetches cumulative BEAN paid out per agent from backend

interface PayoutAgentSummary {
  totalPayouts: number
  totalAmount: string
  totalAmountFormatted: string
  lastPayoutAt: string
}

interface PayoutSummaryResponse {
  agents: Record<string, PayoutAgentSummary>
}

let payoutCache: { data: Record<string, number>; timestamp: number } | null = null
const PAYOUT_CACHE_TTL = 120_000 // 2 min cache

export async function fetchPayoutSummary(): Promise<Record<string, number>> {
  if (payoutCache && Date.now() - payoutCache.timestamp < PAYOUT_CACHE_TTL) {
    return payoutCache.data
  }

  try {
    const res = await apiFetch<PayoutSummaryResponse>('/api/payouts/agent/summary')
    const map: Record<string, number> = {}
    for (const [agentId, info] of Object.entries(res.agents)) {
      map[agentId] = parseFloat(info.totalAmountFormatted) || 0
    }
    payoutCache = { data: map, timestamp: Date.now() }
    return map
  } catch (e) {
    console.error('Failed to fetch payout summary:', e)
    return payoutCache?.data ?? {}
  }
}

// ── Batch on-chain balance fetch ──
// Fetches ETH + BEAN balance for multiple wallets in a single burst.
// With viem batch transport, all calls are sent as one HTTP request.

export interface OnChainBalances {
  ethBalance: number
  walletBean: number
}

export async function fetchAllOnChainBalances(
  addresses: string[]
): Promise<Map<string, OnChainBalances>> {
  const calls: Promise<bigint>[] = []
  for (const addr of addresses) {
    calls.push(publicClient.getBalance({ address: addr as `0x${string}` }))
    calls.push(
      publicClient.readContract({
        address: BEAN_TOKEN,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [addr as `0x${string}`],
      }) as Promise<bigint>
    )
  }

  // Race against a 8s timeout — public RPC can hang
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('RPC timeout')), 8_000)
  )
  const results = await Promise.race([Promise.all(calls), timeout])

  const map = new Map<string, OnChainBalances>()
  for (let i = 0; i < addresses.length; i++) {
    map.set(addresses[i], {
      ethBalance: parseFloat(formatEther(results[i * 2])),
      walletBean: parseFloat(formatEther(results[i * 2 + 1])),
    })
  }
  return map
}

// ── Main fetch ──
// Uses `totals` for all-time stats (single API call).
// Pass historyPages > 1 to fetch deeper history for sparkline/best-worst/round table.
// Pass preBalances to skip on-chain reads (already fetched via fetchAllOnChainBalances).

export async function fetchAgentStats(walletAddress: string, historyPages = 1, initialFunding = 1.0, totalBeanPaidOut = 0, skipCache = false, preBalances?: OnChainBalances): Promise<AgentStats> {
  // Return cached stats if fresh enough
  const cacheKey = `${walletAddress}-${historyPages}`
  if (!skipCache) {
    const cached = statsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.stats
    }
  }

  let ethBalance: number
  let walletBean: number
  let data: HistoryResponse
  let rewards: RewardsResponse

  if (preBalances) {
    // On-chain balances already fetched — only need API calls
    ethBalance = preBalances.ethBalance
    walletBean = preBalances.walletBean
    ;[data, rewards] = await Promise.all([
      apiFetch<HistoryResponse>(
        `/api/user/${walletAddress}/history?type=deploy&limit=50`
      ),
      apiFetch<RewardsResponse>(
        `/api/user/${walletAddress}/rewards`
      ),
    ])
  } else {
    // Fetch API history + rewards + on-chain balances in parallel
    const [d, r, ethBalanceWei, walletBeanRaw] = await Promise.all([
      apiFetch<HistoryResponse>(
        `/api/user/${walletAddress}/history?type=deploy&limit=50`
      ),
      apiFetch<RewardsResponse>(
        `/api/user/${walletAddress}/rewards`
      ),
      publicClient.getBalance({ address: walletAddress as `0x${string}` }),
      publicClient.readContract({
        address: BEAN_TOKEN,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`],
      }),
    ])
    data = d
    rewards = r
    ethBalance = parseFloat(formatEther(ethBalanceWei))
    walletBean = parseFloat(formatEther(walletBeanRaw))
  }

  // Fetch additional history pages in parallel if requested
  const allHistory = [...data.history]
  if (historyPages > 1) {
    const pagesToFetch = Math.min(historyPages, data.pagination.pages)
    const pagePromises = []
    for (let page = 2; page <= pagesToFetch; page++) {
      pagePromises.push(
        apiFetch<HistoryResponse>(
          `/api/user/${walletAddress}/history?type=deploy&limit=50&page=${page}`
        ).catch(e => {
          console.error(`[${walletAddress.slice(0, 8)}] Failed page ${page}:`, e)
          return null
        })
      )
    }
    const results = await Promise.all(pagePromises)
    for (const pageData of results) {
      if (pageData) allHistory.push(...pageData.history)
    }
  }

  // ── All-time stats from totals + on-chain balances ──
  const totals = data.totals
  const beanPriceEth = parseFloat(totals.beanPriceEth) || 0
  const totalDeployed = parseFloat(totals.totalETHDeployedFormatted) || 0
  const totalWon = parseFloat(totals.totalETHWonFormatted) || 0
  const pendingBean = parseFloat(rewards.pendingBEAN.grossFormatted) || 0
  const beansEarned = walletBean + pendingBean // wallet BEAN + unclaimed BEAN
  const beanValueEth = beansEarned * beanPriceEth
  const paidOutValueEth = totalBeanPaidOut * beanPriceEth
  const totalValue = ethBalance + beanValueEth + paidOutValueEth
  const netPnl = totalValue - initialFunding
  const ethPnl = ethBalance - initialFunding // ETH-only P&L (before BEAN value)
  const roundsPlayed = totals.roundsPlayed
  const winRate = roundsPlayed > 0 ? Math.round((totals.roundsWon / roundsPlayed) * 100) : 0
  const roi = initialFunding > 0 ? Math.round((netPnl / initialFunding) * 100) : 0

  // ── Per-round data from history entries (round table + sparkline) ──
  const roundMap = new Map<number, {
    roundId: number
    deployed: number
    blockMasks: number[]
    timestamp: string
    settled: boolean
    isWin: boolean
    isBeanpot: boolean
    won: number
    beans: number
  }>()

  for (const entry of allHistory) {
    const deployed = weiToEth(entry.totalAmount)
    const won = parseFloat(entry.roundResult.ethWonFormatted) || 0
    const beans = parseFloat(entry.roundResult.beanWonFormatted) || 0
    const mask = parseInt(entry.blockMask)

    const existing = roundMap.get(entry.roundId)
    if (existing) {
      existing.deployed += deployed
      existing.blockMasks.push(mask)
      existing.won += won
      existing.beans += beans
    } else {
      roundMap.set(entry.roundId, {
        roundId: entry.roundId,
        deployed,
        blockMasks: [mask],
        timestamp: entry.timestamp,
        settled: entry.roundResult.settled,
        isWin: entry.roundResult.wonWinningBlock,
        isBeanpot: entry.roundResult.beanpotHit,
        won,
        beans,
      })
    }
  }

  const sortedEntries = Array.from(roundMap.values()).sort((a, b) => b.roundId - a.roundId)

  // Filter to last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentEntries = sortedEntries.filter(e => new Date(e.timestamp).getTime() >= sevenDaysAgo)

  const rounds: RoundData[] = recentEntries.map(entry => {
    const mergedMask = entry.blockMasks.reduce((a, b) => a | b, 0)
    const blocksCount = countBits(mergedMask)
    const roundEthPnl = entry.won - entry.deployed
    const roundBeanValue = entry.beans * beanPriceEth
    const truePnl = roundEthPnl + roundBeanValue

    return {
      id: entry.roundId,
      blocksCount,
      deployed: entry.deployed,
      won: entry.won,
      ethPnl: roundEthPnl,
      beansEarned: entry.beans,
      beanValueEth: roundBeanValue,
      truePnl,
      pctChange: entry.settled && entry.deployed > 0
        ? Math.round((truePnl / entry.deployed) * 100)
        : 0,
      isWin: entry.isWin,
      isBeanpot: entry.isBeanpot,
      settled: entry.settled,
      timestamp: entry.timestamp,
    }
  })

  // Sparkline: cumulative true PnL over settled rounds (chronological order)
  const settledRoundsChron = rounds.filter(r => r.settled).reverse()
  const cumPnl: number[] = []
  let running = 0
  for (const r of settledRoundsChron) {
    running += r.truePnl
    cumPnl.push(running)
  }

  const sparkline: number[] = []
  if (cumPnl.length === 0) {
    sparkline.push(0, 0, 0, 0, 0, 0, 0, 0)
  } else if (cumPnl.length <= 8) {
    const pad = 8 - cumPnl.length
    for (let i = 0; i < pad; i++) sparkline.push(0)
    sparkline.push(...cumPnl)
  } else {
    for (let i = 0; i < 8; i++) {
      const idx = Math.floor((i / 7) * (cumPnl.length - 1))
      sparkline.push(cumPnl[idx])
    }
  }

  const result: AgentStats = {
    roundsPlayed,
    winRate,
    roi,
    totalDeployed,
    totalWon,
    ethPnl,
    beansEarned,
    beanValueEth,
    netPnl,
    beanPriceEth,
    totalBeanPaidOut,
    paidOutValueEth,
    lastActive: allHistory.length > 0 ? relativeTime(allHistory[0].timestamp) : 'unknown',
    sparkline,
    rounds,
  }

  // Cache the result
  statsCache.set(cacheKey, { stats: result, timestamp: Date.now() })

  return result
}
