# Chat — setup and rollout

Phase 1 of the in-site miners chat. Everything is code-complete; the steps
below are the operational pieces only the founder can do (env secrets, running
SQL against production Supabase).

## Architecture in one paragraph

Clients read messages via Supabase Realtime with the anon key, which RLS
restricts to `select` on visible rows of `chat_messages` — nothing else, on any
table. Every write goes through Next.js API routes using the service-role key:
`/api/chat/session` (one wallet signature per 24h → HTTP-only cookie),
`/api/chat/send` (ban → rate limits per wallet + per hashed IP → slow mode →
duplicate → link block → normalized blocklist → insert), and
`/api/chat/report` (3 distinct reports auto-hide a message pending review,
pushed live to open clients via a Realtime broadcast). Kill switch, slow mode,
thresholds, and a dormant rounds-played eligibility gate all live in the
`chat_config` row and are editable from the Supabase dashboard with no deploy.

## 1. Environment variables

Append to `.env.local` (and mirror on the production host before pushing):

```bash
# Supabase → Settings → API → service_role (secret). Server-only — no NEXT_PUBLIC_ prefix.
SUPABASE_SERVICE_ROLE_KEY=...

# Generate both locally:
#   openssl rand -hex 32
CHAT_SESSION_SECRET=...
CHAT_IP_SALT=...
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already in
use and stay as they are. Note the anon key now ships in the browser bundle
(the chat panel subscribes to Realtime client-side) — that is what step 3
exists for.

## 2. Run the chat migration

Supabase dashboard → SQL editor → paste and run
`supabase/migrations/20260717000000_chat.sql`.

Creates the nine chat tables, RLS, the Realtime publication for
`chat_messages`, the config row, and a minimal starter blocklist. Idempotent —
safe to re-run.

## 3. Run the two lockdown migrations — order matters, and this is urgent

`20260717000001_profiles_rls.sql` (profiles read-only for anon) and
`20260717000002_chat_hardening.sql` (social_connections lockdown, chat column
scoping, private moderation broadcasts, wallet-casing constraints).

**Why urgent:** the anon key already ships in the live browser bundle (it
predates chat — ProfilePage imports the Supabase client). Until these two run,
anyone can read AND write `profiles` and `social_connections` with that key —
including forging a social_connections row to hijack Discord holder/whale
roles, and dumping every wallet-to-Discord/Twitter mapping.

Run them only after:

1. `SUPABASE_SERVICE_ROLE_KEY` is set in the environment (local and prod), and
2. this branch is deployed (profile writes AND the four social auth routes now
   use the service-role client instead of the anon key).

Running them before both are true breaks profile saves and Discord/Twitter
connect on the old code. The safe sequence for prod, all in one sitting:
set env vars on the host → push → deploy finishes → run 0001 → run 0002.

## 4. Verify locally

1. `npm run dev`, open the mining page. A speech-bubble tab sits on the left
   edge under the leaderboard tab.
2. Open it, connect a wallet, "Sign in to chat" (one signature), send a message.
3. Second browser window: the message appears without a refresh.
4. Try `check out minebean.com` → rejected ("Links aren't allowed in chat").
5. Try `f.u.c.k` → rejected ("Message blocked").
6. Send 6 messages fast → the 6th gets "Slow down".
7. Report a message from 3 different signed-in wallets → it disappears live
   in every window.
8. Hover one of your own messages → trash icon → delete → it disappears from
   every open window and never comes back on refresh.

## Day-to-day moderation (until the Phase 2 admin page)

All from the Supabase dashboard, effective within ~10 seconds, no deploy:

| Action | Where |
|---|---|
| Kill switch | `chat_config.enabled` → false |
| Slow mode | `chat_config.slow_mode_seconds` |
| Ban a wallet | insert into `chat_bans` (`until` null = permanent) |
| Add a banned word | insert into `chat_blocklist` (`mode` block or flag) |
| Fix a false positive | insert the innocent word into `chat_allowlist` |
| Review hidden messages | `chat_messages` where `status = 'hidden'` — set back to `visible` to restore |
| Review flagged messages | `chat_messages` where `flagged = true` |
| Raise the gate after a raid | `chat_config.require_rounds_played` → e.g. 1 |

## Phase 2 (together)

- `/admin/chat` page: blocklist editor, hidden/flagged review queue, ban
  button, kill switch, slow mode — gated by `chat_mods` wallets.
- Mobile layout (panel is desktop-only right now).
- 30-day message retention sweep.
- Message reactions (SVG, not emoji), reply-to, mention highlighting.
- CLAUDE.md documentation once the feature settles.
