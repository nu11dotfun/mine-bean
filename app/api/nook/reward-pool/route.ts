import { NextResponse } from 'next/server'

// Same-origin proxy to Nookplot's mining reward pool stats.
// Returns: { balance, totalDeposited, totalDistributed,
//   dex: { priceUsd, volume24h, estimatedDailyFeeUsd, estimatedDailyFeeNook, lastUpdated } }
const NOOK_GATEWAY = 'https://gateway.nookplot.com/v1/mining/reward-pool'

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
    console.error('[nook/reward-pool] proxy fail', e)
    return NextResponse.json({ ok: false, error: 'proxy failure' }, { status: 502 })
  }
}
