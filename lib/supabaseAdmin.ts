import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client using the service-role key, which bypasses RLS.
// Every chat/profile WRITE goes through this client inside an API route —
// the browser only ever holds the anon key, which is read-only under RLS.

if (typeof window !== 'undefined') {
  throw new Error('supabaseAdmin is server-only and must never be imported in client code')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!serviceKey) {
  // In production this is a hard failure: silently degrading to the anon key
  // would break the "service role is the only write path" invariant.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY must be set in production')
  }
  console.warn(
    '[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not set — falling back to the anon key. ' +
      'Writes will fail once RLS lockdown is applied. Add the key from Supabase → Settings → API.'
  )
}

const fetchNoCache = (input: RequestInfo | URL, options?: RequestInit) =>
  fetch(input, { ...options, cache: 'no-store' })

export const supabaseAdmin = createClient(url, serviceKey || anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchNoCache },
})

export const hasServiceRoleKey = Boolean(serviceKey)
