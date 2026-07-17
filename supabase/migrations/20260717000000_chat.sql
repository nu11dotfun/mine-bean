-- MineBean chat — Phase 1 schema.
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- Security model: the browser (anon key) can ONLY read visible messages and
-- receive Realtime events for them. Every write goes through Next.js API
-- routes using the service-role key. No anon write policy exists anywhere.

-- ── Messages ────────────────────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  wallet        text not null,
  body          text not null check (char_length(body) between 1 and 1000),
  body_squashed text not null default '',
  status        text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  flagged       boolean not null default false,
  flags_count   int not null default 0,
  round_id      bigint,
  created_at    timestamptz not null default now()
);
create index if not exists chat_messages_visible_created
  on public.chat_messages (created_at desc) where status = 'visible';
create index if not exists chat_messages_wallet_created
  on public.chat_messages (wallet, created_at desc);

-- ── Bans ────────────────────────────────────────────────────────────────────
create table if not exists public.chat_bans (
  wallet     text primary key,
  until      timestamptz,          -- null = permanent
  reason     text,
  created_by text,
  created_at timestamptz not null default now()
);

-- ── Blocklist / allowlist ───────────────────────────────────────────────────
-- Patterns are matched against normalized text (see lib/chat/normalize.ts).
-- mode 'block' rejects the message; 'flag' posts it but queues it for review.
create table if not exists public.chat_blocklist (
  id         uuid primary key default gen_random_uuid(),
  pattern    text not null unique,
  mode       text not null default 'block' check (mode in ('block', 'flag')),
  is_regex   boolean not null default false,
  note       text,
  created_at timestamptz not null default now()
);

-- Words that contain a blocked substring but are legitimate (Scunthorpe fix).
create table if not exists public.chat_allowlist (
  word text primary key
);

-- ── Reports (community moderation) ──────────────────────────────────────────
create table if not exists public.chat_reports (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references public.chat_messages(id) on delete cascade,
  reporter_wallet text not null,
  created_at      timestamptz not null default now(),
  unique (message_id, reporter_wallet)
);

-- ── IP rate limiting (hashed IPs only, never raw) ───────────────────────────
create table if not exists public.chat_ip_hits (
  id         uuid primary key default gen_random_uuid(),
  ip_hash    text not null,
  kind       text not null default 'send',
  created_at timestamptz not null default now()
);
create index if not exists chat_ip_hits_lookup
  on public.chat_ip_hits (ip_hash, kind, created_at desc);

-- ── Mods, eligibility cache, config ─────────────────────────────────────────
create table if not exists public.chat_mods (
  wallet text primary key,
  role   text not null default 'mod'
);

-- Wallets that passed the rounds-played gate (permanent cache so the
-- rate-limited backend endpoint is hit at most once per wallet).
create table if not exists public.chat_eligibility (
  wallet    text primary key,
  passed_at timestamptz not null default now()
);

create table if not exists public.chat_config (
  id                    int primary key default 1 check (id = 1),
  enabled               boolean not null default true,   -- kill switch
  slow_mode_seconds     int not null default 0,
  rate_limit_count      int not null default 5,
  rate_limit_window_s   int not null default 30,
  autohide_reports      int not null default 3,
  require_rounds_played int not null default 0,          -- eligibility gate (0 = off)
  max_message_length    int not null default 500
);
insert into public.chat_config (id) values (1) on conflict (id) do nothing;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.chat_messages    enable row level security;
alter table public.chat_bans        enable row level security;
alter table public.chat_blocklist   enable row level security;
alter table public.chat_allowlist   enable row level security;
alter table public.chat_reports     enable row level security;
alter table public.chat_ip_hits     enable row level security;
alter table public.chat_mods        enable row level security;
alter table public.chat_eligibility enable row level security;
alter table public.chat_config      enable row level security;

-- The ONLY anon-facing policy in the whole chat system: read visible messages.
drop policy if exists chat_messages_read_visible on public.chat_messages;
create policy chat_messages_read_visible on public.chat_messages
  for select to anon, authenticated
  using (status = 'visible');

-- Belt and braces on top of RLS: strip default grants from client roles.
revoke insert, update, delete on table public.chat_messages from anon, authenticated;
revoke all on table public.chat_bans        from anon, authenticated;
revoke all on table public.chat_blocklist   from anon, authenticated;
revoke all on table public.chat_allowlist   from anon, authenticated;
revoke all on table public.chat_reports     from anon, authenticated;
revoke all on table public.chat_ip_hits     from anon, authenticated;
revoke all on table public.chat_mods        from anon, authenticated;
revoke all on table public.chat_eligibility from anon, authenticated;
revoke all on table public.chat_config      from anon, authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Publish chat_messages so clients get INSERT events (RLS still filters rows).
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ── Starter blocklist ───────────────────────────────────────────────────────
-- Deliberately minimal; manage the real list from the dashboard (Phase 2: admin UI).
insert into public.chat_blocklist (pattern, mode, note) values
  ('nigger',  'block', 'slur'),
  ('faggot',  'block', 'slur'),
  ('retard',  'flag',  'review'),
  ('kys',     'flag',  'review'),
  ('airdrop', 'flag',  'common scam framing — review')
on conflict (pattern) do nothing;
