import { NextResponse } from 'next/server'

// Same-origin proxy to Nookplot's gateway for an agent wallet's mining stats.
// Returns: { tier, stakedNook, multiplier, totalSolves, totalEarned, avgScore, claimableBalance, pendingRewards }
// Mining stats roll daily at 2am UTC alongside the epoch turnover.
// No auth required upstream.

const NOOK_GATEWAY = 'https://gateway.nookplot.com/v1/mining/stats/agent'

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const { address } = await params
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ ok: false, error: 'invalid address' }, { status: 400 })
  }

  try {
    const res = await fetch(`${NOOK_GATEWAY}/${address}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `nookplot gateway ${res.status}` },
        { status: res.status }
      )
    }
    const data = await res.json()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    })
  } catch (e) {
    console.error('[nook/stats] proxy fail', e)
    return NextResponse.json({ ok: false, error: 'proxy failure' }, { status: 502 })
  }
}
