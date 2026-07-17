// Server → clients moderation push via Supabase Realtime's REST broadcast
// endpoint (no socket needed from a route handler).
//
// Why this exists: RLS means a message that flips visible → hidden stops
// matching the anon select policy, so clients never receive that UPDATE as a
// postgres_changes event. A broadcast on a public channel is how open clients
// learn to drop it instantly.

export async function broadcastModeration(
  event: 'hide' | 'delete',
  payload: { id: string }
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Dual-publish: the private copy is the primary channel (receive-only
        // RLS policy; only the service role can publish). The public copy
        // exists solely for clients on the fallback subscription (realtime
        // auth not provisioned) — spoofing on the public topic is neutralized
        // client-side by verify-before-act, so it adds reach, not risk.
        messages: [
          { topic: 'chat:moderation', event, payload, private: true },
          { topic: 'chat:moderation', event, payload, private: false },
        ],
      }),
      cache: 'no-store',
    })
  } catch (err) {
    // Non-fatal: the row is already hidden in the database; open clients just
    // keep the message until their next refresh.
    console.error('[chat] moderation broadcast failed', err)
  }
}
