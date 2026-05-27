import { NextResponse } from 'next/server'

// Same-origin proxy to Nookplot's gateway for the mining epoch.
// Returns: { nextEpochTime, timeUntilEpochSeconds, timeUntilEpochHuman, currentEpoch, epochCronSchedule, minIntervalHours }
// Mining epochs roll daily at 2am UTC (cron 0 2 * * *).
// No auth required upstream.

const NOOK_GATEWAY = 'https://gateway.nookplot.com/v1/mining/next-epoch-time'

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
        // Epoch ticks down by seconds, but we don't need second-precision in the UI.
        // 60s cache + 5min SWR keeps load off the gateway while letting agents poll.
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (e) {
    console.error('[mcp/nook/epoch] proxy fail', e)
    return NextResponse.json({ ok: false, error: 'proxy failure' }, { status: 502 })
  }
}
