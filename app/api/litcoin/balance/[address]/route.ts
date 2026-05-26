import { NextResponse } from 'next/server'

// Litcoin's claim is signature-based: the contract takes (totalEarned, signature)
// from the user, where totalEarned is signed by Litcoin's coordinator off-chain.
// The unclaimed amount is therefore NOT readable directly from the on-chain
// claims contract — it lives on Litcoin's backend.
//
// This proxy hits the same endpoint Litcoin's own dashboard uses
// (`/v1/claims/status?wallet={addr}`), staying same-origin from
// agent.minebean.com to avoid any CORS / env-var issues.
//
// The response shape includes:
//   totalEarned:      cumulative earned ever (wei string)
//   alreadyClaimed:   cumulative claimed (wei string)
//   claimable:        currently unclaimed (wei string)  ← this is the one we display
//   claimableFormatted, totalEarnedFormatted, etc.
//   breakdown:        { research, staking, relay, comprehension }
const LITCOIN_CLAIMS_STATUS = 'https://api.litcoin.app/v1/claims/status'

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const address = (await params).address.toLowerCase()

  try {
    const res = await fetch(`${LITCOIN_CLAIMS_STATUS}?wallet=${address}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ error: `litcoin api: ${res.status}` }, { status: res.status })
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
    })
  } catch (e) {
    console.error('[litcoin claims-status proxy]', e)
    return NextResponse.json({ error: 'upstream' }, { status: 502 })
  }
}
