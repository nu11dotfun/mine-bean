import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage } from 'viem'
import {
  CHAT_COOKIE,
  SESSION_TTL_MS,
  loginMessage,
  signSession,
  verifySession,
} from '@/lib/chat/session'
import { isMod } from '@/lib/chat/mods'

// Sign-once chat auth. POST verifies a wallet signature (same pattern as the
// profile PUT route) and sets an HTTP-only session cookie; send/report read
// the wallet from that cookie so it can never be forged in a request body.

export async function POST(req: NextRequest) {
  const len = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(len) && len > 4096) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 413 })
  }

  let body: { address?: unknown; signature?: unknown; timestamp?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { address, signature, timestamp } = body
  if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }
  if (typeof signature !== 'string' || typeof timestamp !== 'number') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Reject stale requests (>5 min old). Future skew is capped at 30s — a
  // client-chosen future timestamp must not stretch the replay window.
  const now = Math.floor(Date.now() / 1000)
  if (now - timestamp > 300 || timestamp - now > 30) {
    return NextResponse.json({ error: 'Expired timestamp' }, { status: 401 })
  }

  const addressLower = address.toLowerCase()
  try {
    const valid = await verifyMessage({
      address: addressLower as `0x${string}`,
      message: loginMessage(addressLower, timestamp),
      signature: signature as `0x${string}`,
    })
    if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let cookie: string
  try {
    cookie = signSession(addressLower)
  } catch (err) {
    console.error('[chat] session signing failed:', err)
    return NextResponse.json({ error: 'Chat is not configured yet' }, { status: 503 })
  }

  const res = NextResponse.json({ wallet: addressLower, isMod: await isMod(addressLower) })
  res.cookies.set(CHAT_COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: '/',
  })
  return res
}

export async function GET(req: NextRequest) {
  const wallet = verifySession(req.cookies.get(CHAT_COOKIE)?.value)
  if (!wallet) return NextResponse.json({ error: 'No session' }, { status: 401 })
  return NextResponse.json({ wallet, isMod: await isMod(wallet) })
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(CHAT_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' })
  return res
}
