import { NextResponse } from 'next/server'

// Same-origin proxy to Nookplot's agent submissions feed.
// Returns: { submissions: [{ id, challengeId, traceCid, traceSummary, modelUsed,
//   compositeScore, rewardNook, rewardStatus, status, submittedAt, verifiedAt, ... }] }
const NOOK_GATEWAY = 'https://gateway.nookplot.com/v1/mining/submissions/agent'

export async function GET(req: Request, { params }: { params: { address: string } }) {
  const { address } = await params
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ ok: false, error: 'invalid address' }, { status: 400 })
  }

  // Forward optional ?limit= through to the gateway.
  const url = new URL(req.url)
  const limit = url.searchParams.get('limit') ?? '20'
  const qs = `?limit=${encodeURIComponent(limit)}`

  try {
    const res = await fetch(`${NOOK_GATEWAY}/${address}${qs}`, {
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
    console.error('[nook/submissions] proxy fail', e)
    return NextResponse.json({ ok: false, error: 'proxy failure' }, { status: 502 })
  }
}
