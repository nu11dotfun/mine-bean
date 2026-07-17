import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CHAT_COOKIE, verifySession } from '@/lib/chat/session'
import { getChatContext } from '@/lib/chat/config'
import { broadcastModeration } from '@/lib/chat/broadcast'
import { bodyTooLarge, clientKeyHash } from '@/lib/chat/ip'

// Community moderation: any signed-in wallet can report a message; one report
// per wallet per message (unique constraint dedupes). At `autohide_reports`
// distinct reports the message auto-hides pending review — the crowd flags,
// the threshold acts, the founder is the appeals court.
//
// Brigade brakes: spoof-resistant per-IP limit AND a per-wallet limit, plus
// banned wallets lose report power entirely.

const err = (message: string, status: number) => NextResponse.json({ error: message }, { status })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const REPORT_IP_LIMIT = 12
const REPORT_WALLET_LIMIT = 10
const REPORT_WINDOW_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  if (bodyTooLarge(req, 2048)) return err('Invalid request', 413)

  let ctx
  try {
    ctx = await getChatContext()
  } catch {
    return err('Chat is not configured yet', 503)
  }

  const wallet = verifySession(req.cookies.get(CHAT_COOKIE)?.value)
  if (!wallet) return err('Sign in to chat', 401)

  // Banned wallets keep a valid cookie but lose report power.
  const banRes = await supabaseAdmin
    .from('chat_bans')
    .select('until')
    .eq('wallet', wallet)
    .maybeSingle()
  if (banRes.error) return err('Try again shortly', 503)
  if (banRes.data && (banRes.data.until === null || new Date(banRes.data.until as string) > new Date())) {
    return err('You are banned from chat', 403)
  }

  let parsed: { messageId?: unknown }
  try {
    parsed = await req.json()
  } catch {
    return err('Invalid request', 400)
  }
  const messageId = parsed.messageId
  if (typeof messageId !== 'string' || !UUID_RE.test(messageId)) {
    return err('Invalid request', 400)
  }

  // Rate limits — per IP (spoof-resistant key) and per wallet, fail closed.
  const windowStart = new Date(Date.now() - REPORT_WINDOW_MS).toISOString()
  const ipHash = clientKeyHash(req, wallet)
  const ipRes = await supabaseAdmin
    .from('chat_ip_hits')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('kind', 'report')
    .gte('created_at', windowStart)
  if (ipRes.error) return err('Try again shortly', 503)
  if ((ipRes.count ?? 0) >= REPORT_IP_LIMIT) return err('Slow down', 429)

  const walletRes = await supabaseAdmin
    .from('chat_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_wallet', wallet)
    .gte('created_at', windowStart)
  if (walletRes.error) return err('Try again shortly', 503)
  if ((walletRes.count ?? 0) >= REPORT_WALLET_LIMIT) return err('Slow down', 429)

  await supabaseAdmin.from('chat_ip_hits').insert({ ip_hash: ipHash, kind: 'report' })

  // Only visible messages can accrue reports; anything else resolves quietly.
  const { data: message } = await supabaseAdmin
    .from('chat_messages')
    .select('id, status')
    .eq('id', messageId)
    .maybeSingle()
  if (!message || message.status !== 'visible') {
    return NextResponse.json({ ok: true, hidden: false })
  }

  await supabaseAdmin
    .from('chat_reports')
    .upsert(
      { message_id: messageId, reporter_wallet: wallet },
      { onConflict: 'message_id,reporter_wallet', ignoreDuplicates: true }
    )

  const { count: reportCount } = await supabaseAdmin
    .from('chat_reports')
    .select('id', { count: 'exact', head: true })
    .eq('message_id', messageId)
  const flags = reportCount ?? 0

  const shouldHide = flags >= ctx.config.autohide_reports
  await supabaseAdmin
    .from('chat_messages')
    .update(shouldHide ? { flags_count: flags, status: 'hidden' } : { flags_count: flags })
    .eq('id', messageId)

  // Hidden ≠ deleted: it sits in the review queue and can be restored, which
  // is what keeps report-brigading survivable.
  if (shouldHide) await broadcastModeration('hide', { id: messageId })

  return NextResponse.json({ ok: true, hidden: shouldHide })
}
