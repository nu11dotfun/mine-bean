import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CHAT_COOKIE, verifySession } from '@/lib/chat/session'
import { broadcastModeration } from '@/lib/chat/broadcast'
import { bodyTooLarge, clientKeyHash } from '@/lib/chat/ip'
import { isMod } from '@/lib/chat/mods'

// Delete a message: your own, or anyone's if you are a moderator. Soft delete
// (status = 'deleted'): the row survives for moderation history and keeps
// counting toward the sender's rate-limit window, so delete-and-respam gains
// nothing. RLS drops it from every future read; the broadcast drops it from
// clients that already have it on screen.

const err = (message: string, status: number) => NextResponse.json({ error: message }, { status })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DELETE_IP_LIMIT = 20
const DELETE_WINDOW_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  if (bodyTooLarge(req, 2048)) return err('Invalid request', 413)

  const wallet = verifySession(req.cookies.get(CHAT_COOKIE)?.value)
  if (!wallet) return err('Sign in to chat', 401)

  // Banned wallets lose delete power along with everything else.
  const banRes = await supabaseAdmin
    .from('chat_bans')
    .select('until')
    .eq('wallet', wallet)
    .maybeSingle()
  if (banRes.error) return err('Try again shortly', 503)
  if (banRes.data && (banRes.data.until === null || new Date(banRes.data.until as string) > new Date())) {
    return err('You are banned from chat', 403)
  }

  // Modest abuse brake: each delete attempt burns IP budget.
  const windowStart = new Date(Date.now() - DELETE_WINDOW_MS).toISOString()
  const ipHash = clientKeyHash(req, wallet)
  const ipRes = await supabaseAdmin
    .from('chat_ip_hits')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('kind', 'delete')
    .gte('created_at', windowStart)
  if (ipRes.error) return err('Try again shortly', 503)
  if ((ipRes.count ?? 0) >= DELETE_IP_LIMIT) return err('Slow down', 429)
  await supabaseAdmin.from('chat_ip_hits').insert({ ip_hash: ipHash, kind: 'delete' })

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

  const { data: message } = await supabaseAdmin
    .from('chat_messages')
    .select('id, wallet, status')
    .eq('id', messageId)
    .maybeSingle()

  if (!message || message.status === 'deleted') return NextResponse.json({ ok: true })

  const own = message.wallet === wallet
  if (!own && !(await isMod(wallet))) return err('Not your message', 403)

  let del = supabaseAdmin.from('chat_messages').update({ status: 'deleted' }).eq('id', messageId)
  // Non-mods stay double-scoped to their own row.
  if (own) del = del.eq('wallet', wallet)
  const { error } = await del
  if (error) {
    console.error('[chat] delete failed:', error)
    return err('Could not delete', 500)
  }

  await broadcastModeration('delete', { id: messageId })
  return NextResponse.json({ ok: true })
}
