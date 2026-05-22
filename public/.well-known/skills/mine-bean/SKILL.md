---
name: mine-bean
version: 0.4.1
description: Mine $BEAN on Base from inside Hermes Agent. Round-based on-chain deployment, five strategy presets, autonomous cron mode, agent-callable Venice inference, multi-provider hook across six providers, VVV staking awareness, signed Gitlawb audit log.
author: MineBean
license: MIT
homepage: https://minebean.com
repository: https://github.com/damo-nu11/hermes-mine-bean
network: base-mainnet
audit_log: gitlawb://did:key:z6MkwVfgaAnuypajisEkJLkVbWPiPEBwceMkGutfXpEEYHKi/minebean-rounds
---

# mine-bean

MineBean ($BEAN) is a round-based mining game on Base. New round every 60 seconds. Pick a strategy, deploy ETH into blocks on a 5x5 grid, earn $BEAN rewards on each round close. Occasional beanpot jackpots hit ~1-in-777 rounds.

This skill gives any Hermes agent access to the live game through ten tools and a `/minebean` slash command. Run interactively from a chat, or schedule headless mining via the bundled `hermes-minebean-deploy` console script.

## Install

```bash
python3 -m venv ~/hermes-mine-bean-env
source ~/hermes-mine-bean-env/bin/activate
pip install hermes-agent hermes-mine-bean
hermes plugins install damo-nu11/hermes-mine-bean --enable
```

Or with MCP support for Claude Desktop / Cursor:

```bash
pip install "hermes-mine-bean[mcp]"
```

## Configure

Add to `~/.hermes/.env`:

```
# Required for autonomous mining (broadcasting)
MINEBEAN_DEPLOYER_KEY=0x...your_dedicated_test_wallet_private_key...

# Optional: route LLM inference through Venice (the plugin defaults to Venice
# but Venice itself only fires when a key is set)
VENICE_API_KEY=...

# Optional safety guards
MINEBEAN_MAX_DEPLOYS_PER_DAY=100
MINEBEAN_PER_BLOCK_WEI=2500000000000

# Optional RPC override
# BASE_RPC_URL=https://mainnet.base.org
```

For read-only inspection (no broadcasting):

```
MINEBEAN_MINER_ADDRESS=0x...the_address_you_want_to_observe...
```

> Bankr-managed signing is documented as a v0.5 feature. v0.4 ships local EOA signing only.

## Tools

| Tool | What it does |
|---|---|
| `minebean_status` | Live round state, beanpot pool, caller's pending balances |
| `minebean_pending` | Pending ETH + BEAN for any address |
| `minebean_set_profile` | Save default strategy (sniper, anti-winner, beanpot-hunter, anti-loser, nostradamus) |
| `minebean_deploy` | Build deploy plan, optionally broadcast (dry-run default) |
| `minebean_claim` | Claim pending winnings (dry-run default) |
| `minebean_autostart` | Install autonomous mining cron job |
| `minebean_autostop` | Remove the cron job |
| `minebean_inference_status` | Active inference provider, base URL, default model, per-provider configured map |
| `minebean_chat` | Send a prompt to the configured LLM provider (Venice by default), multi-provider hook |
| `minebean_vvv_status` | Read VVV + sVVV balances on Base for an address (Venice staking awareness) |

Slash command: `/minebean <subcommand>`. Try `/minebean status` first.

## Strategy presets

All five use the closed-form EV optimum `X* = sqrt(K × P × T) − T` where P is BEAN price in ETH, T is the deployment total (strategy-specific), and K = B / 0.105.

| Preset | Blocks | T source | K | At T ≥ threshold |
|---|---|---|---|---|
| anti-winner | 24 (excl. prev winner) | current grid | 10.476 (B=1.1) | Deploy minimum (beanpot eligibility) |
| nostradamus | All 25 | avg of last 3 rounds | 9.524 (B=1.0) | Skip |
| anti-loser | 24 (excl. coldest 100-rd) | max(grid, avg last 3) | 9.524 | Skip |
| sniper | All 25 | live grid at deploy | 9.524 | Skip |
| beanpot-hunter | All 25 | current grid | dynamic (B=1+pot/777) | Skip if pot < 62.16 BEAN |

Beanpot-hunter additionally scales size linearly from 0.5% of wallet at 62.16 BEAN to max at 700 BEAN. Sniper uses adaptive 2-10s timing offsets at broadcast.

## Autonomous mode

```bash
hermes cron add --name "MineBean deploy" --no-agent --script /path/to/wrapper.sh "every 60s"
```

Or use the built-in autostart: `/minebean autostart every 60s`.

The cron entry enforces `MINEBEAN_MAX_DEPLOYS_PER_DAY` and exits cleanly on ceiling hit (cron doesn't error-spam).

## Inference provider

The plugin defaults `HERMES_INFERENCE_PROVIDER=venice` on enable, so any Hermes agent running mine-bean routes LLM calls through Venice out of the box. Set `VENICE_API_KEY` in `~/.hermes/.env`.

> v0.3 users: `HERMES_VENICE_API_KEY` is still recognised. The plugin bridges the legacy name to the canonical `VENICE_API_KEY` automatically at startup so existing configs keep working.

Venice's no-log mode is platform-default at the API layer (prompts and responses are never persisted).

The bootstrap is non-destructive: if you have already pinned `HERMES_INFERENCE_PROVIDER` to `openai`, `anthropic`, `openrouter`, `ollama`, or `lmstudio`, the plugin respects your choice. v0.4 ships the real OpenAI-compatible client adapter, so calls actually route through your chosen provider, not just env-default. Inspect at runtime via `minebean_inference_status`.

`minebean_chat` lets the agent send a prompt to the active provider mid-session. Useful for ad-hoc reasoning, a second opinion, or routing a specific call through Venice without leaving the Hermes session.

`minebean_vvv_status` reads VVV (`0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf`) and sVVV (`0x321b7ff75154472B18EDb199033fF4D116F340Ff`) balances on Base. Useful when the agent wants to know whether the user qualifies for free Venice inference allowance via staking. Read-only.

## Safety

- `dry_run=true` is the hard default on every deploy and claim call. Live broadcast requires `MINEBEAN_LIVE_BROADCAST_UNLOCKED=1`.
- Daily deploy ceiling enforced via env var
- Already-deployed-this-round guard prevents accidental double-deploys
- Readonly mode (just `MINEBEAN_MINER_ADDRESS`, no key) lets users inspect any address without exposing keys
- `minebean_chat` server-side caps prompt at 100k chars, system message at 20k chars
- VVV staking module ships with a read-only ERC-20 ABI; module is structurally incapable of issuing on-chain writes

## Verifiability

Every round is mirrored to `gitlawb://did:key:.../minebean-rounds` every 5 minutes. Signed, append-only, replicated across the Gitlawb network. Pull the latest window file to audit any round independently of minebean.com.

## Repo

Source, issues, releases: https://github.com/damo-nu11/hermes-mine-bean
