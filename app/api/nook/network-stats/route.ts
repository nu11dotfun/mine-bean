import { NextResponse } from 'next/server'

// Same-origin proxy to Nookplot's network-wide mining stats.
// Returns: { totalChallenges, openChallenges, totalSubmissions, verifiedSubmissions,
//   uniqueMiners, avgCompositeScore, totalNookEarned, nookBreakdown, totalStaked,
//   newMinersThisEpoch, challengesSolvedThisEpoch }
const NOOK_GATEWAY = 'https://gateway.nookplot.com/v1/mining/stats'

export async function GET() {
  try {
    const res = await fetch(NOOK_GATEWAY, {
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
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (e) {
    console.error('[nook/network-stats] proxy fail', e)
    return NextResponse.json({ ok: false, error: 'proxy failure' }, { status: 502 })
  }
}
