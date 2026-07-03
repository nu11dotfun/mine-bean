import { NextRequest, NextResponse } from 'next/server'

// Server-side proxy for Dune query results. The Dune API key stays in the server
// env (DUNE_API_KEY) and is never sent to the browser. Only whitelisted queries
// can be requested, so the key can't be used to run arbitrary Dune queries.
//
// Results are cached in-memory (Dune data is daily-grained) so we read Dune at
// most once an hour per query and don't burn credits on every page view.

const QUERIES: Record<string, number> = {
  'mining-volume': 6749152,
  'beanpot-history': 6754454,
  'mining-rewards': 6754722,
  'buyback-history': 6754597,
  'tvl-by-day': 6753759,
  'staking-metrics': 6754658,
}

const cache: Record<string, { data: unknown; at: number }> = {}
const TTL = 60 * 60 * 1000 // 1h

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  const id = QUERIES[q]
  if (!id) return NextResponse.json({ error: 'unknown query', allowed: Object.keys(QUERIES) }, { status: 400 })

  if (cache[q] && Date.now() - cache[q].at < TTL) {
    return NextResponse.json(cache[q].data)
  }

  const key = process.env.DUNE_API_KEY
  if (!key) return NextResponse.json({ error: 'DUNE_API_KEY not set on the server' }, { status: 500 })

  try {
    const res = await fetch(`https://api.dune.com/api/v1/query/${id}/results?limit=5000`, {
      headers: { 'X-Dune-API-Key': key },
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: `dune ${res.status}`, detail: body.slice(0, 240) }, { status: 502 })
    }
    const json = await res.json()
    const rows = json?.result?.rows ?? []
    const payload = { rows, rowCount: rows.length, executedAt: json?.execution_ended_at ?? null }
    cache[q] = { data: payload, at: Date.now() }
    return NextResponse.json(payload, { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
