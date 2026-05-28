import { NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com'

// blockMask is a uint32 bitmask where bit N = block N was deployed (0-indexed, 0-24)
function decodeBlockMask(mask: string): number[] {
  if (!mask || mask === '0') return []
  const blocks: number[] = []
  const n = BigInt(mask)
  for (let i = 0; i < 25; i++) {
    if ((n >> BigInt(i)) & BigInt(1)) blocks.push(i)
  }
  return blocks
}

function timeAgo(ts: string | number): string {
  const ms = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime()
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  return `${days}d ago`
}

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const address = (await params).address.toLowerCase()

  try {
    // 1. Fetch user's full deployment history (high limit - users deploy multiple blocks per round)
    const histRes = await fetch(`${API_BASE}/api/user/${address}/history?type=deploy&limit=1000`)
    if (!histRes.ok) return NextResponse.json([])

    const histData = await histRes.json()
    const history: Array<{ roundId: number; blockMask: string; totalAmount: string }> = histData.history || []
    if (!history.length) return NextResponse.json([])

    // Deduplicate round IDs, most recent first
    const roundIds = Array.from(new Set(history.map(h => Number(h.roundId)))).slice(0, 100)

    // 1b. Fetch BEAN price in ETH from history totals
    const priceRes = await fetch(`${API_BASE}/api/user/${address}/history?type=deploy&limit=1`).then(r => r.ok ? r.json() : null).catch(() => null)
    const beanPriceEth = priceRes?.totals?.beanPriceEth ? parseFloat(priceRes.totals.beanPriceEth) : 0

    // 2. Fetch per-round miners + round data in parallel for each round ID
    //    Fetching individually avoids the 200-round pagination limit on the bulk endpoint
    const roundResults = await Promise.all(
      roundIds.map(id => Promise.all([
        fetch(`${API_BASE}/api/round/${id}/miners`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/round/${id}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]))
    )

    const rounds = roundIds.map((roundId, idx) => {
      const [minersData, roundData] = roundResults[idx]

      // winningBlock only present once a round is settled
      const winningBlock = minersData?.winningBlock ?? roundData?.winningBlock
      if (winningBlock === undefined || winningBlock === null) return null

      // Aggregate all blocks the user deployed to in this round
      const userBlocks = new Set<number>()
      for (const h of history.filter(h => Number(h.roundId) === roundId)) {
        for (const b of decodeBlockMask(h.blockMask)) userBlocks.add(b)
      }

      // isWin comparison stays 0-indexed - matches both bitmask and API winningBlock
      const isWin = userBlocks.has(Number(winningBlock))
      const beanpotAmountRaw = roundData?.beanpotAmount || '0'
      const isBeanpot = BigInt(beanpotAmountRaw) > BigInt(0)

      // deployed comes from history (covers losers too - miners list only has winners)
      const deployed = history
        .filter(h => Number(h.roundId) === roundId)
        .reduce((sum, h) => sum + Number(h.totalAmount || '0'), 0) / 1e18

      // won and beans only available if user is on the winning block
      const userMiner = minersData?.miners?.find(
        (m: { address: string }) => m.address.toLowerCase() === address
      )
      const won = userMiner ? Number(userMiner.ethReward) / 1e18 : 0
      const beansEarned = userMiner ? Number(userMiner.beanReward) / 1e18 : 0
      const ethPnl = won - deployed
      const beanValueEth = beansEarned * beanPriceEth
      const netPnl = ethPnl + beanValueEth
      const pctChange = deployed > 0 ? Math.round((netPnl / deployed) * 100) : -100

      const ts = roundData?.settledAt || roundData?.endTime || ''

      return {
        id: roundId,
        // API is 0-indexed (0-24); game UI shows blocks 1-25
        block: Number(winningBlock) + 1,
        yourBlocks: Array.from(userBlocks).map(b => b + 1),
        deployed,
        won,
        netPnl,
        pctChange,
        beansEarned,
        beanpotAmount: isBeanpot ? beansEarned : null,
        isWin,
        isBeanpot,
        timestamp: ts ? timeAgo(ts) : '',
      }
    }).filter(Boolean)

    return NextResponse.json(rounds)
  } catch (e) {
    console.error('[rounds route]', e)
    return NextResponse.json([])
  }
}
