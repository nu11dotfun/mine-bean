import { NextResponse } from 'next/server'

// Canonical "rounds mined" count for a wallet.
//
// Reads the SAME source the main www site uses (ProfilePage.tsx:428):
//   GET /api/user/{addr}/history?type=deploy&limit=500
//   → response.totals.roundsPlayed
//
// Why a same-origin proxy: client-side calls to api.minebean.com from
// agent.minebean.com hit CORS / env-var / rate-limit issues. Proxying
// here keeps it origin-stable, hardcodes the right backend default,
// and rate-limits against one Vercel function IP not the user's browser.
//
// Why limit=500: the backend computes `totals` over the requested page;
// undersized limits (limit=1 etc.) can return wrong totals. 500 is what
// the main site uses.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com'

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const address = (await params).address.toLowerCase()

  try {
    const res = await fetch(
      `${API_BASE}/api/user/${address}/history?type=deploy&limit=500`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) {
      return NextResponse.json({ roundsPlayed: 0 }, { status: res.status })
    }
    const data = await res.json() as {
      totals?: { roundsPlayed?: number }
      pagination?: { total?: number }
    }
    // Prefer canonical totals.roundsPlayed (deduped per-round count);
    // fall back to pagination.total as a last resort (counts raw docs).
    const roundsPlayed = data.totals?.roundsPlayed ?? data.pagination?.total ?? 0

    return NextResponse.json({ roundsPlayed }, {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
    })
  } catch (e) {
    console.error('[rounds-count proxy]', e)
    return NextResponse.json({ roundsPlayed: 0 }, { status: 502 })
  }
}
