import { NextResponse } from 'next/server'

// Same-origin proxy to Nookplot's gateway for a wallet's claimable rewards.
// Returns: { nook, weth } — both null means nothing claimable yet.
// No auth required upstream.

const NOOK_GATEWAY = 'https://gateway.nookplot.com/v1/rewards/merkle/claimable'

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const { address } = await params
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ ok: false, error: 'invalid address' }, { status: 400 })
  }

  try {
    const res = await fetch(`${NOOK_GATEWAY}/${address.toLowerCase()}`, {
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
        // Claimable only updates when a new Merkle root is published (weekly).
        // 60s cache is plenty.
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (e) {
    console.error('[mcp/nook/claimable] proxy fail', e)
    return NextResponse.json({ ok: false, error: 'proxy failure' }, { status: 502 })
  }
}
