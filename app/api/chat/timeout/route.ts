import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CHAT_COOKIE, verifySession } from '@/lib/chat/session'
import { isMod, isModResult } from '@/lib/chat/mods'
import { bodyTooLarge, clientKeyHash } from '@/lib/chat/ip'

// Moderator action: temporarily ban a wallet from chatting. Writes a row into
// chat_bans with an expiry; the send/report/delete routes all consult it.
//
// Invariants: only mods can call this; mods cannot be targeted (fails CLOSED
// if that lookup errors); and a timeout can only ever EXTEND a ban — it never
// shortens or overwrites a longer or permanent one.

const err = (message: string, status: number) => NextResponse.json({ error: message }, { status })

const ALLOWED_MINUTES = [5, 60, 1440] // 5m, 1h, 24h
const TIMEOUT_IP_LIMIT = 20
const TIMEOUT_WINDOW_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  if (bodyTooLarge(req, 2048)) return err('Invalid request', 413)

  const wallet = verifySession(req.cookies.get(CHAT_COOKIE)?.value)
  if (!wallet) return err('Sign in to chat', 401)
  if (!(await isMod(wallet))) return err('Not a moderator', 403)

  // Modest abuse brake, same shape as the delete route.
  const windowStart = new Date(Date.now() - TIMEOUT_WINDOW_MS).toISOString()
  const ipHash = clientKeyHash(req, wallet)
  const ipRes = await supabaseAdmin
    .from('chat_ip_hits')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('kind', 'timeout')
    .gte('created_at', windowStart)
  if (ipRes.error) return err('Try again shortly', 503)
  if ((ipRes.count ?? 0) >= TIMEOUT_IP_LIMIT) return err('Slow down', 429)
  await supabaseAdmin.from('chat_ip_hits').insert({ ip_hash: ipHash, kind: 'timeout' })

  let parsed: { wallet?: unknown; minutes?: unknown }
  try {
    parsed = await req.json()
  } catch {
    return err('Invalid request', 400)
  }
  const target = typeof parsed.wallet === 'string' ? parsed.wallet.toLowerCase() : ''
  const minutes = Number(parsed.minutes)
  if (!/^0x[a-f0-9]{40}$/.test(target)) return err('Invalid wallet', 400)
  if (!ALLOWED_MINUTES.includes(minutes)) return err('Invalid duration', 400)
  if (target === wallet) return err('You cannot time yourself out', 400)

  // Target protection fails CLOSED: if we cannot verify the target isn't a
  // mod, refuse rather than risk timing one out during a DB blip.
  const targetCheck = await isModResult(target)
  if (targetCheck.failed) return err('Try again shortly', 503)
  if (targetCheck.mod) return err('Cannot time out a moderator', 400)

  // A timeout only ever EXTENDS: never overwrite a permanent ban (until null)
  // or one that already lasts longer than this timeout would.
  const until = new Date(Date.now() + minutes * 60 * 1000)
  const existingRes = await supabaseAdmin
    .from('chat_bans')
    .select('until')
    .eq('wallet', target)
    .maybeSingle()
  if (existingRes.error) return err('Try again shortly', 503)
  const existing = existingRes.data
  if (existing && (existing.until === null || new Date(existing.until as string) > until)) {
    return err('Already banned for longer', 409)
  }

  const { error } = await supabaseAdmin.from('chat_bans').upsert(
    {
      wallet: target,
      until: until.toISOString(),
      reason: `timeout ${minutes}m`,
      created_by: wallet,
    },
    { onConflict: 'wallet' }
  )
  if (error) {
    console.error('[chat] timeout failed:', error)
    return err('Could not apply timeout', 500)
  }

  return NextResponse.json({ ok: true, until: until.toISOString() })
}
