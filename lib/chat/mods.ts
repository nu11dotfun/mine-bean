import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Moderator lookup against chat_mods (wallets stored lowercase). Service-role
// only — the table has no anon access.

export interface ModCheck {
  mod: boolean
  /** True when the lookup itself errored — callers protecting a TARGET must
   * fail closed on this instead of treating the target as a non-mod. */
  failed: boolean
}

export async function isModResult(walletLower: string): Promise<ModCheck> {
  const { data, error } = await supabaseAdmin
    .from('chat_mods')
    .select('wallet')
    .eq('wallet', walletLower)
    .maybeSingle()
  return { mod: Boolean(data), failed: Boolean(error) }
}

/** Convenience for ACTOR checks: an errored lookup returns false, which fails
 * closed (the caller gets denied). Never use this to protect a target. */
export async function isMod(walletLower: string): Promise<boolean> {
  return (await isModResult(walletLower)).mod
}
