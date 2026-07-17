import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

// Rate-limit key derivation, hardened against X-Forwarded-For spoofing.
//
// XFF is client-appendable: behind a typical proxy the header arrives as
// "<whatever the client sent>, <real client ip>" — so the LEFTMOST entry is
// attacker-controlled and rotating it would mint a fresh bucket per request.
// Trust order therefore is: x-real-ip (set by our own proxy) → the RIGHTMOST
// XFF entry (appended by our own proxy) → the authenticated wallet, so an
// unknown-IP request still lands in a per-user bucket instead of a shared one.

function clientIp(req: NextRequest): string | null {
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return null
}

export function clientKeyHash(req: NextRequest, wallet?: string): string {
  const salt = process.env.CHAT_IP_SALT
  if (!salt && process.env.NODE_ENV === 'production') {
    console.error('[chat] CHAT_IP_SALT is not set in production — IP hashes are weakly protected')
  }
  const key = clientIp(req) ?? (wallet ? `w:${wallet}` : 'unknown')
  return createHash('sha256').update(`${salt || 'bean-chat-dev-salt'}:${key}`).digest('hex')
}

/** 413 guard before parsing a JSON body. Content-Length can be absent, but
 * when present an oversized declaration is rejected before buffering. */
export function bodyTooLarge(req: NextRequest, maxBytes: number): boolean {
  const len = Number(req.headers.get('content-length') ?? 0)
  return Number.isFinite(len) && len > maxBytes
}
