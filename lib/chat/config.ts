import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizeForms, type BlockPattern } from './normalize'

// One cached fetch of everything the send/report routes need per request:
// the config row, the blocklist, and the allowlist. 10s TTL keeps dashboard
// edits near-instant while adding zero queries to a message burst.

export interface ChatConfig {
  enabled: boolean
  slow_mode_seconds: number
  rate_limit_count: number
  rate_limit_window_s: number
  autohide_reports: number
  require_rounds_played: number
  max_message_length: number
}

export interface ChatContext {
  config: ChatConfig
  blockPatterns: BlockPattern[]
  allowSet: Set<string>
}

const TTL_MS = 10_000
let cache: { at: number; ctx: ChatContext } | null = null

export async function getChatContext(): Promise<ChatContext> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ctx

  const [configRes, blockRes, allowRes] = await Promise.all([
    supabaseAdmin.from('chat_config').select('*').eq('id', 1).maybeSingle(),
    supabaseAdmin.from('chat_blocklist').select('pattern, mode, is_regex'),
    supabaseAdmin.from('chat_allowlist').select('word'),
  ])

  if (configRes.error || !configRes.data) {
    throw new Error('chat_config unavailable — has the chat migration been run?')
  }
  // Fail closed: a partial failure must never cache an empty blocklist and
  // run the chat unfiltered for a TTL window.
  if (blockRes.error || allowRes.error) {
    throw new Error('chat blocklist/allowlist unavailable')
  }

  const config = configRes.data as ChatConfig
  const blockPatterns = (blockRes.data ?? []) as BlockPattern[]
  // Allowlist entries are normalized once here so matching compares like with like.
  const allowSet = new Set(
    (allowRes.data ?? [])
      .map((r) => normalizeForms(String((r as { word: string }).word)).spaced)
      .filter(Boolean)
  )

  const ctx: ChatContext = { config, blockPatterns, allowSet }
  cache = { at: Date.now(), ctx }
  return ctx
}
