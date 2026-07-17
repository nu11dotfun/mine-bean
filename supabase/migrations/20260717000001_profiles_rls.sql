-- Lock down the profiles table against the anon key.
--
-- ⚠️ ORDER MATTERS. Run this ONLY AFTER:
--   1. SUPABASE_SERVICE_ROLE_KEY is set in the app environment (local + prod), and
--   2. the code change moving profile writes to the service-role client is deployed
--      (app/api/user/[address]/profile/route.ts now uses lib/supabaseAdmin).
-- Running it earlier breaks profile saves: the route would still write via the
-- anon key, which this file strips of write access.
--
-- Why: the anon key ALREADY ships in the browser bundle (ProfilePage has
-- imported the Supabase client client-side since before chat existed), so any
-- visitor can query whatever the anon role has access to. This lockdown is
-- overdue independent of chat — run it (and the chat hardening migration) as
-- soon as the code above is deployed.

alter table public.profiles enable row level security;

-- Profiles are public data (usernames/pfps are rendered for everyone).
drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
  for select to anon, authenticated
  using (true);

-- No write path for client roles. All writes go through the Next.js route,
-- which verifies a wallet signature and uses the service-role key.
revoke insert, update, delete on table public.profiles from anon, authenticated;
