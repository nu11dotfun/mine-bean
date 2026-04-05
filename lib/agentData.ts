import { apiFetch } from './api'

// ── API response types ──

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

export interface PendingRewards {
  eth: string
  ethFormatted: string
  beanUnroasted: string
  beanUnroastedFormatted: string
  beanRoasted: string
  beanRoastedFormatted: string
  beanGross: string
  beanGrossFormatted: string
}

// Pre-calculated stats from GET /api/agents/stats
export interface AgentStats {
  address: string
  roundsPlayed: number
  winRate: number
  roi: number
  totalDeployed: number
  totalWon: number
  ethPnl: number
  netPnl: number
  beanPriceEth: number
  totalBeanClaimed: number
  totalBeanEarned: number
  totalBeanEarnedEth: number
  pendingRewards: PendingRewards | null
  totalBeanPaidOut: number
  paidOutValueEth: number
  lastActive: string
  sparkline: number[]
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

// ── Fetch round history for agent profile page ──
// Fetches deploy history and processes into RoundData[] for the round table + analytics.

export async function fetchAgentRounds(
  address: string,
  historyPages: number,
  beanPriceEth: number,
  oldAddress?: string
): Promise<RoundData[]> {
  // Fetch history for primary address
  const fetchHistory = async (addr: string, pages: number): Promise<HistoryEntry[]> => {
    const data = await apiFetch<HistoryResponse>(
      `/api/user/${addr}/history?type=deploy&limit=50`
    )
    const history = [...data.history]
    if (pages > 1) {
      const pagesToFetch = Math.min(pages, data.pagination.pages)
      const pagePromises = []
      for (let page = 2; page <= pagesToFetch; page++) {
        pagePromises.push(
          apiFetch<HistoryResponse>(
            `/api/user/${addr}/history?type=deploy&limit=50&page=${page}`
          ).catch(e => {
            console.error(`[${addr.slice(0, 8)}] Failed page ${page}:`, e)
            return null
          })
        )
      }
      const results = await Promise.all(pagePromises)
      for (const pageData of results) {
        if (pageData) history.push(...pageData.history)
      }
    }
    return history
  }

  // Fetch both addresses in parallel
  const [newHistory, oldHistory] = await Promise.all([
    fetchHistory(address, historyPages),
    oldAddress ? fetchHistory(oldAddress, historyPages) : Promise.resolve([]),
  ])

  const allHistory = [...newHistory, ...oldHistory]

  // Consolidate entries by roundId (multiple deploys per round possible)
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

  return recentEntries.map(entry => {
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
}
