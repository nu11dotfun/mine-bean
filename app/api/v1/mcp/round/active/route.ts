import { NextResponse } from 'next/server'

// Base MCP plugin endpoint: current active round.
// Server-side proxy to the existing Express backend /api/round/current.
// Server-to-server fetch sidesteps CORS / browser-side rate-limit issues that
// surface when agent.minebean.com clients call api.minebean.com directly.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com'

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/round/current`, {
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

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=5, stale-while-revalidate=15',
      },
    })
  } catch (e) {
    console.error('[mcp/round/active]', e)
    return NextResponse.json(
      { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Failed to reach backend' } },
      { status: 200 }
    )
  }
}
