-- Security hardening from the chat review pass. Safe to re-run.
--
-- ⚠️ Run together with deploying the code that moves the social auth routes to
-- the service-role client (they currently write via the anon key, which this
-- file revokes). Same coupling rule as the profiles lockdown.
--
-- Fixes, in order:
--  1. social_connections was fully readable AND writable with the anon key
--     (which already ships in the browser bundle) — anyone could dump every
--     wallet↔Discord/Twitter mapping or forge a row to hijack Discord roles.
--  2. chat_messages realtime payloads leaked moderation-internal columns
--     (body_squashed, flagged) because anon kept table-wide SELECT.
--  3. The moderation broadcast topic was public — any client could spoof
--     hide/delete events. Private channel + receive-only policy for clients.
--  4. Lowercase-wallet check constraints so rate-limit/ban identity can never
--     fragment on a future non-lowercased write path.

-- ── 1. social_connections lockdown ──────────────────────────────────────────
alter table public.social_connections enable row level security;

drop policy if exists social_connections_public_read on public.social_connections;
create policy social_connections_public_read on public.social_connections
  for select to anon, authenticated
  using (true);

revoke insert, update, delete on table public.social_connections from anon, authenticated;

-- Column-scope the read: the UI needs the two usernames (keyed by wallet);
-- discord_id / twitter_id are internal and stay hidden from client roles.
revoke select on table public.social_connections from anon, authenticated;
grant select (wallet_address, discord_username, twitter_handle)
  on public.social_connections to anon, authenticated;

-- ── 2. chat_messages column scoping ─────────────────────────────────────────
-- Realtime builds event payloads from the columns the subscriber role can
-- SELECT, so scoping the grant also scopes what every INSERT event carries.
revoke select on table public.chat_messages from anon, authenticated;
grant select (id, wallet, body, status, round_id, created_at)
  on public.chat_messages to anon, authenticated;

-- ── 3. Moderation broadcast: private channel, receive-only for clients ──────
-- RLS on realtime.messages governs private channels: a SELECT policy lets
-- clients receive broadcasts on this topic; with no INSERT policy they cannot
-- send. The server publishes with the service role, which bypasses RLS.
do $$
begin
  execute 'drop policy if exists chat_moderation_receive on realtime.messages';
  execute $pol$
    create policy chat_moderation_receive on realtime.messages
      for select to anon, authenticated
      using (realtime.topic() = 'chat:moderation' and extension = 'broadcast')
  $pol$;
exception
  when undefined_table then
    raise notice 'realtime.messages not found — private broadcast policy skipped';
  when undefined_function then
    raise notice 'realtime.topic() not found — private broadcast policy skipped';
end $$;

-- ── 4. Canonical-lowercase wallets ──────────────────────────────────────────
do $$
begin
  alter table public.chat_messages
    add constraint chat_messages_wallet_lower check (wallet = lower(wallet));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.chat_bans
    add constraint chat_bans_wallet_lower check (wallet = lower(wallet));
exception when duplicate_object then null;
end $$;
