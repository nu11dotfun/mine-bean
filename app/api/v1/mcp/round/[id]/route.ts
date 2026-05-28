import { NextResponse } from 'next/server'

// Base MCP plugin endpoint: historical round by ID.
// Server-side proxy to /api/round/:id on the Express backend.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = await params

  // Basic validation: numeric round ID
  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_REQUEST', message: 'round id must be a positive integer' } },
      { status: 200 }
    )
  }

  try {
    const res = await fetch(`${API_BASE}/api/round/${id}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) {
      const code = res.status === 404 ? 'BAD_REQUEST' : 'UPSTREAM_ERROR'
      const message = res.status === 404 ? `Round ${id} not found` : `Backend returned ${res.status}`
      return NextResponse.json({ ok: false, error: { code, message } }, { status: 200 })
    }

    const data = await res.json()

    return NextResponse.json(data, {
      headers: {
        // Historical rounds are immutable once settled - cache long.
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (e) {
    console.error('[mcp/round/:id]', e)
    return NextResponse.json(
      { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Failed to reach backend' } },
      { status: 200 }
    )
  }
}
