import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CHAT_COOKIE, verifySession } from '@/lib/chat/session'
import { getChatContext } from '@/lib/chat/config'
import { detectLink, matchBlocklist, normalizeForms } from '@/lib/chat/normalize'
import { bodyTooLarge, clientKeyHash } from '@/lib/chat/ip'
import { broadcastModeration } from '@/lib/chat/broadcast'

// The chat filter chain: config → session → parse → [ban + IP + wallet +
// recent, fetched in PARALLEL] → checks in the same cheap-first order → links
// → blocklist → insert → post-insert race enforcement (also parallel).
//
// Independent lookups share one round trip instead of stacking four — the
// Supabase project is remote, so sequential awaits were the send latency.
//
// Failure posture: every limiter query FAILS CLOSED — a database error rejects
// the message rather than skipping the check. Clients never write to Supabase
// directly (no anon insert policy exists).

const err = (message: string, status: number) => NextResponse.json({ error: message }, { status })

async function checkEligibility(wallet: string, required: number): Promise<boolean> {
  const { data: cached } = await supabaseAdmin
    .from('chat_eligibility')
    .select('wallet')
    .eq('wallet', wallet)
    .maybeSingle()
  if (cached) return true

  // The backend user endpoint is rate limited (5/min/IP), so a pass is cached
  // permanently and this fetch happens at most once per wallet.
  const base = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com'
  try {
    const res = await fetch(`${base}/api/user/${wallet}`, { cache: 'no-store' })
    if (!res.ok) return false
    const json = (await res.json()) as { stats?: { roundsPlayed?: number } }
    const rounds = Number(json?.stats?.roundsPlayed ?? 0)
    if (rounds >= required) {
      await supabaseAdmin.from('chat_eligibility').upsert({ wallet }, { onConflict: 'wallet' })
      return true
    }
  } catch {
    return false
  }
  return false
}

export async function POST(req: NextRequest) {
  if (bodyTooLarge(req, 8192)) return err('Message too large', 413)

  // 1. Config (cached 10s) — also the kill switch
  let ctx
  try {
    ctx = await getChatContext()
  } catch (e) {
    console.error('[chat] context load failed:', e)
    return err('Chat is not configured yet', 503)
  }
  const cfg = ctx.config
  if (!cfg.enabled) return err('Chat is paused', 503)

  // 2. Session
  const wallet = verifySession(req.cookies.get(CHAT_COOKIE)?.value)
  if (!wallet) return err('Sign in to chat', 401)

  // 3. Body (local, free)
  let parsed: { body?: unknown }
  try {
    parsed = await req.json()
  } catch {
    return err('Invalid request', 400)
  }
  if (typeof parsed.body !== 'string') return err('Invalid request', 400)
  const text = parsed.body.trim()
  if (text.length === 0) return err('Message is empty', 400)
  if (text.length > cfg.max_message_length) {
    return err(`Max ${cfg.max_message_length} characters`, 400)
  }

  // 4. All independent lookups in ONE round trip
  const windowStart = new Date(Date.now() - cfg.rate_limit_window_s * 1000).toISOString()
  const ipHash = clientKeyHash(req, wallet)
  const [banRes, ipRes, walletRes, recentRes] = await Promise.all([
    supabaseAdmin.from('chat_bans').select('until').eq('wallet', wallet).maybeSingle(),
    supabaseAdmin
      .from('chat_ip_hits')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .eq('kind', 'send')
      .gte('created_at', windowStart),
    supabaseAdmin
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('created_at', windowStart),
    supabaseAdmin
      .from('chat_messages')
      .select('body_squashed, created_at')
      .eq('wallet', wallet)
      // Window must cover slow mode even when it's configured above 5 minutes.
      .gte(
        'created_at',
        new Date(Date.now() - Math.max(5 * 60 * 1000, cfg.slow_mode_seconds * 1000)).toISOString()
      )
      .order('created_at', { ascending: false })
      .limit(10),
  ])
  // Fail closed on any lookup error
  if (banRes.error || ipRes.error || walletRes.error || recentRes.error) {
    return err('Try again shortly', 503)
  }

  // 5. Ban
  const ban = banRes.data
  if (ban && (ban.until === null || new Date(ban.until as string) > new Date())) {
    return err('You are banned from chat', 403)
  }

  // 6. IP rate limit — counted per ATTEMPT (not per accepted message), so a
  // flood of rejected messages still burns through the sender's budget. The
  // key is spoof-resistant (see lib/chat/ip.ts).
  if ((ipRes.count ?? 0) >= cfg.rate_limit_count) return err('Slow down', 429)
  await supabaseAdmin.from('chat_ip_hits').insert({ ip_hash: ipHash, kind: 'send' })

  // 7. Eligibility gate (dormant while require_rounds_played = 0)
  if (cfg.require_rounds_played > 0) {
    const ok = await checkEligibility(wallet, cfg.require_rounds_played)
    if (!ok) {
      return err(`Play at least ${cfg.require_rounds_played} round${cfg.require_rounds_played === 1 ? '' : 's'} to unlock chat`, 403)
    }
  }

  // 8. Wallet rate limit (accepted messages in the window)
  if ((walletRes.count ?? 0) >= cfg.rate_limit_count) return err('Slow down', 429)

  // 9. Slow mode + 10. Duplicate
  const recent = recentRes.data ?? []
  if (cfg.slow_mode_seconds > 0 && recent.length > 0) {
    const last = new Date(recent[0].created_at as string).getTime()
    if (Date.now() - last < cfg.slow_mode_seconds * 1000) {
      return err(`Slow mode: one message every ${cfg.slow_mode_seconds}s`, 429)
    }
  }

  const forms = normalizeForms(text)
  if (recent.some((r) => r.body_squashed && r.body_squashed === forms.squashed)) {
    return err('You just sent that', 400)
  }

  // 11. Links — none allowed, no exceptions
  if (detectLink(text)) return err("Links aren't allowed in chat", 400)

  // 12. Blocklist
  const hit = matchBlocklist(text, forms, ctx.blockPatterns, ctx.allowSet)
  if (hit && hit.mode === 'block') return err('Message blocked', 400)

  // 13. Insert (service role — the only write path)
  const { data: message, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      wallet,
      body: text,
      body_squashed: forms.squashed,
      flagged: hit?.mode === 'flag',
    })
    .select('id, wallet, body, created_at')
    .single()
  if (error || !message) {
    console.error('[chat] insert failed:', error)
    return err('Could not send message', 500)
  }

  // 14. Post-insert race enforcement, both checks in one round trip. The
  // pre-checks are check-then-act, so N concurrent sends can all pass them;
  // re-checking AFTER the insert makes the invariants eventually hold — the
  // overflow rows delete themselves. Fails CLOSED like the pre-checks: an
  // errored re-check removes the row rather than skipping enforcement.
  // The dup re-check is skipped for empty squashed forms (emoji/CJK-only
  // messages all squash to '' — two different ones are not duplicates).
  const [postCountRes, dupRes] = await Promise.all([
    supabaseAdmin
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('created_at', windowStart),
    forms.squashed
      ? supabaseAdmin
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('wallet', wallet)
          .eq('body_squashed', forms.squashed)
          .neq('id', message.id)
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .lt('created_at', message.created_at as string)
      : Promise.resolve({ error: null, count: 0 }),
  ])
  // A post-insert removal must also broadcast: the INSERT already fanned out
  // to every client, so without the broadcast a ghost row lingers on screen.
  const removeInserted = async () => {
    await supabaseAdmin.from('chat_messages').delete().eq('id', message.id).eq('wallet', wallet)
    await broadcastModeration('delete', { id: message.id as string })
  }
  if (postCountRes.error || dupRes.error) {
    await removeInserted()
    return err('Try again shortly', 503)
  }
  if ((postCountRes.count ?? 0) > cfg.rate_limit_count) {
    await removeInserted()
    return err('Slow down', 429)
  }
  if ((dupRes.count ?? 0) > 0) {
    await removeInserted()
    return err('You just sent that', 400)
  }

  // Occasionally sweep IP hits older than an hour.
  if (Math.random() < 0.05) {
    await supabaseAdmin
      .from('chat_ip_hits')
      .delete()
      .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  }

  return NextResponse.json({ message })
}
