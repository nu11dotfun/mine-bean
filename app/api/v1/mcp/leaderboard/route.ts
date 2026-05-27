import { NextResponse } from 'next/server'

// Base MCP plugin endpoint: leaderboard across miners / stakers / earners.
// Proxies whichever board is requested and normalises into a unified entry shape
// so agents only need to learn one schema. Per-board native fields are
// preserved in `raw` for power users.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com'

type Board = 'miners' | 'stakers' | 'earners'

interface UnifiedEntry {
  rank: number
  address: string
  label: string
  value: string
  valueFormatted: string
  unit: 'ETH' | 'BEAN'
  raw: Record<string, unknown>
}

function truncate(addr: string): string {
  if (!addr || addr.length < 10) return addr || ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function shape(board: Board, items: unknown[]): UnifiedEntry[] {
  // miners' value is ETH deployed; stakers + earners are BEAN
  const unit: 'ETH' | 'BEAN' = board === 'miners' ? 'ETH' : 'BEAN'

  return items.map((item, idx) => {
    const i = item as Record<string, unknown>
    const address = String(i.address ?? '')

    let value = '0'
    let valueFormatted = '0'

    if (board === 'miners') {
      value = String(i.totalDeployed ?? '0')
      valueFormatted = String(i.totalDeployedFormatted ?? '0')
    } else if (board === 'stakers') {
      value = String(i.stakedBalance ?? '0')
      valueFormatted = String(i.stakedBalanceFormatted ?? '0')
    } else {
      value = String(i.unclaimed ?? '0')
      valueFormatted = String(i.unclaimedFormatted ?? '0')
    }

    return {
      rank: idx + 1,
      address,
      label: truncate(address),
      value,
      valueFormatted,
      unit,
      raw: i,
    }
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const boardParam = (url.searchParams.get('board') ?? 'miners').toLowerCase()
  const limitParam = url.searchParams.get('limit') ?? '20'

  // Validate board
  if (boardParam !== 'miners' && boardParam !== 'stakers' && boardParam !== 'earners') {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'board must be miners, stakers, or earners',
          details: { received: boardParam },
        },
      },
      { status: 200 }
    )
  }
  const board = boardParam as Board

  // Validate limit
  const limit = parseInt(limitParam, 10)
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'limit must be an integer 1-100', details: { received: limitParam } },
      },
      { status: 200 }
    )
  }

  // Pick the upstream endpoint based on board
  const upstreamPath =
    board === 'miners'
      ? `/api/leaderboard/miners?period=all&limit=${limit}`
      : board === 'stakers'
      ? `/api/leaderboard/stakers?limit=${limit}`
      : `/api/leaderboard/earners?limit=${limit}`

  try {
    const res = await fetch(`${API_BASE}${upstreamPath}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: { code: 'UPSTREAM_ERROR', message: `Backend returned ${res.status}` } },
        { status: 200 }
      )
    }

    const data = await res.json()

    // Each leaderboard response uses a different key (deployers / stakers / earners).
    const items =
      board === 'miners'
        ? data.deployers ?? []
        : board === 'stakers'
        ? data.stakers ?? []
        : data.earners ?? []

    return NextResponse.json(
      {
        board,
        limit,
        entries: shape(board, items),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
        },
      }
    )
  } catch (e) {
    console.error('[mcp/leaderboard]', e)
    return NextResponse.json(
      { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Failed to reach backend' } },
      { status: 200 }
    )
  }
}
