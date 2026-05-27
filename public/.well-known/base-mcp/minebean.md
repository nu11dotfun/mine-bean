---
title: "MineBean Plugin"
description: "MineBean protocol plugin. Read wallet state (BEAN balance, mining rewards, staking position, current round, lifetime stats). Build unsigned calldata for staking, unstaking, compounding, claiming mining rewards (ETH and BEAN), and approving BEAN. Discover BEAN buy venues. Every prepare endpoint returns unsigned calldata for Base MCP send_calls; signing stays with the wallet."
name: minebean
version: 0.1.0
---

# MineBean Plugin

> [!IMPORTANT]
> Complete the short Base MCP onboarding flow defined in `SKILL.md` before calling any MineBean endpoint. The user's wallet address, used as `from` in every prepare call, is fetched lazily when needed.

MineBean is a gamified mining protocol where users compete in 60-second rounds on a 5×5 grid of blocks, deploying ETH to earn BEAN tokens and ETH rewards. BEAN can then be staked to earn protocol yield, funded by treasury buybacks. This plugin exposes the post-mining surface: stake, unstake, compound, claim mining rewards (ETH and BEAN are tracked and claimed separately), approve BEAN, and BEAN buy discovery. Active mining (per-round deploy and AutoMiner configuration) is on the roadmap for a future plugin version and is currently routed through the [Hermes MineBean plugin](https://pypi.org/project/hermes-mine-bean/) and the MineBean web app. The plugin returns **unsigned** call data; signing and broadcasting are the wallet's job (Base MCP `send_calls`).

## Surface routing

| Capability | Hosts | Where it runs |
| --- | --- | --- |
| **View-only reads** (wallet balances, staking position, claimable rewards, round state, leaderboard, contract addresses) | `agent.minebean.com` | Every surface. Use the harness HTTP tool when available. Otherwise Base MCP `web_request`. The host is non-native and may require user-paste fallback on Claude.ai / ChatGPT consumer surfaces. See `references/custom-plugins.md`. |
| **Transaction-builder** (approve, stake, unstake, compound, claim ETH, claim BEAN) | `agent.minebean.com/api/v1/mcp/prepare/*` | Every surface. Same host as reads; prepare endpoints return unsigned calldata only. No auth header required. |
| **Buy BEAN discovery** | `agent.minebean.com/api/v1/mcp/buy-info` | Every surface. Returns canonical buy venues (DEX links, Coinbase Onramp deeplink). Direct swap calldata is on the v0.2 roadmap. |

Routing order for any MineBean HTTP call:

1. **Harness HTTP tool** (`curl`, `fetch`, shell). Works for every host, any method.
2. **Base MCP `web_request`**. Chat-only surfaces. `agent.minebean.com` is not on the default Base MCP allowlist; expect rejection. Fall back to user-paste GET as documented in `references/custom-plugins.md`.

Do not sign, approve, or submit transactions unless the user explicitly asks. Generating call data and `send_calls` approval links is safe; the user approves any real transaction.

No API key or Authorization header is required for the documented public endpoints.

---

## API Service

| Service | Base URL | Routing | Purpose |
| --- | --- | --- | --- |
| minebean-mcp | `https://agent.minebean.com/api/v1/mcp` | Harness HTTP or `web_request` (paste-fallback on consumer surfaces) | Wallet state + unsigned calldata for MineBean staking, claims, and ERC20 approve. |

Source of truth for chain config and contract addresses:

```
GET https://agent.minebean.com/api/v1/mcp/addresses
# → { chainId, chainName, contracts: { BEAN, GRID_MINING, AUTO_MINER, STAKING, TREASURY, LP }, docs, protocol_api }
```

---

## Base-Only Rules

- All prepare-endpoint call data targets Base (`chainId` 8453). There is no chain selector.
- BEAN is the protocol token. ETH is the deploy and reward currency for mining.
- Canonical BEAN address: `0x5c72992b83E74c4D5200A8E8920fB946214a5A5D`.
- Default BEAN spender for staking is the STAKING contract: `0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2`.
- Mining rewards are tracked and claimed as two separate streams: pending ETH and pending BEAN. Pending BEAN is further split into **unroasted** (just earned, claimable as-is) and **roasted** (held longer, slightly higher value). The `claim-bean` prepare endpoint claims both at once.

Live contract addresses:

| Contract | Address |
| --- | --- |
| `BEAN` (ERC20) | `0x5c72992b83E74c4D5200A8E8920fB946214a5A5D` |
| `GRID_MINING` (mining + claim ETH + claim BEAN) | `0x9632495bDb93FD6B0740Ab69cc6c71C9c01da4f0` |
| `AUTO_MINER` (Phase 2, automation) | `0x31358496900D600B2f523d6EdC4933E78F72De89` |
| `STAKING` | `0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2` |
| `TREASURY` (read-only context, buybacks) | `0x38F6E74148D6904286131e190d879A699fE3Aeb3` |

---

## Response envelope (prepare endpoints)

Every prepare endpoint returns a single JSON envelope.

**Success:**

```json
{
  "ok": true,
  "data": {
    "to": "0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2",
    "from": "0x1111111111111111111111111111111111111111",
    "data": "0xb6b55f250000000000000000000000000000000000000000000000056bc75e2d63100000",
    "value": "0x0",
    "chainId": 8453,
    "description": "Stake 100 BEAN into the MineBean Staking contract.",
    "meta": {
      "validation": { "balance": "120.00", "allowance": "100.00", "alreadyStaked": "0.00" }
    }
  }
}
```

Field rules:

- `to`, `from`, `data`, `value`, `chainId` are always present. `value` is hex-encoded wei (`"0x0"` for non-payable calls).
- `description` is short and human-readable. **The agent must display this to the user before calling `send_calls`.** No exceptions.
- `meta.validation` carries pre-flight balance, allowance, and position state so the agent can route to the right next action without an extra call.
- `nonce` and `gas` are never returned. The wallet manages them.

**Error:**

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Stake amount exceeds wallet balance.",
    "details": { "requested": "100.00", "balance": "12.34" }
  }
}
```

Error codes:

- `BAD_REQUEST`. Malformed query parameter or missing required field.
- `VALIDATION_ERROR`. Request is well-formed but fails a pre-flight check (insufficient balance, no allowance, nothing to claim, etc.).
- `UPSTREAM_ERROR`. RPC or backend dependency failed; safe to retry.
- `INTERNAL_ERROR`. Unexpected. Surface to user and stop.

All errors are returned with HTTP 200 and `ok: false` so agent parsing is consistent. Non-2xx responses indicate a transport failure, not a validation failure.

---

## Read endpoints

### Wallet state, one round-trip

```
GET https://agent.minebean.com/api/v1/mcp/state/<wallet>
```

Returns everything the agent needs to render the user's MineBean position. Use this **first** before any prepare call.

```json
{
  "wallet": "0x1111111111111111111111111111111111111111",
  "balances": {
    "eth": { "wei": "12340000000000000000", "formatted": "12.34", "usd": "30850.00" },
    "bean": { "wei": "1234500000000000000000", "formatted": "1234.5", "usd": "15.43" }
  },
  "staking": {
    "balance": { "wei": "5000000000000000000000", "formatted": "5000.0", "usd": "62.50" },
    "pendingRewards": { "wei": "320000000000000000", "formatted": "0.32", "usd": "0.004" },
    "compoundFeeReserve": { "wei": "6000000000000000", "formatted": "0.006" },
    "canCompound": true
  },
  "claimable": {
    "eth": { "wei": "180000000000000000", "formatted": "0.18", "usd": "450.00" },
    "bean": {
      "unroastedWei": "75000000000000000000", "unroastedFormatted": "75.0",
      "roastedWei": "12000000000000000000", "roastedFormatted": "12.0",
      "grossWei": "87000000000000000000", "grossFormatted": "87.0",
      "feeWei": "7500000000000000000", "feeFormatted": "7.5",
      "netWei": "79500000000000000000", "netFormatted": "79.5"
    }
  },
  "lifetime": {
    "roundsPlayed": 204,
    "winRate": 0.073,
    "totalDeployedEth": "2.41",
    "totalEarnedEth": "2.85"
  },
  "allowance": {
    "beanForStaking": "5000.0"
  }
}
```

### Contract addresses and chain config

```
GET https://agent.minebean.com/api/v1/mcp/addresses
```

```json
{
  "chainId": 8453,
  "chainName": "base",
  "contracts": {
    "BEAN": "0x5c72992b83E74c4D5200A8E8920fB946214a5A5D",
    "GRID_MINING": "0x9632495bDb93FD6B0740Ab69cc6c71C9c01da4f0",
    "AUTO_MINER": "0x31358496900D600B2f523d6EdC4933E78F72De89",
    "STAKING": "0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2",
    "TREASURY": "0x38F6E74148D6904286131e190d879A699fE3Aeb3"
  },
  "docs": "https://minebean.com/about",
  "protocol_api": "https://api.minebean.com"
}
```

### Current active round

```
GET https://agent.minebean.com/api/v1/mcp/round/active
```

Returns the live round metadata: round ID, start and end timestamps, total ETH deployed across all blocks, current beanpot pool, and a per-block breakdown.

### Historical round

```
GET https://agent.minebean.com/api/v1/mcp/round/<roundId>
```

Returns settlement state for a completed round (winning block, top miner, total winnings, beanpot amount, isSplit flag). The `isSplit` flag refers to the per-round 1 BEAN reward, not the beanpot. **The beanpot is always distributed proportionally across every winning miner.**

### Leaderboard

```
GET https://agent.minebean.com/api/v1/mcp/leaderboard?board=miners|stakers|earners&limit=20
```

`board` defaults to `miners`. Returns ranked entries with address, value, and truncated display label.

---

## Prepare endpoints (unsigned calldata)

### Approve BEAN for the Staking contract

```
GET https://agent.minebean.com/api/v1/mcp/prepare/approve-bean?from=0x...&amount=max
```

| Param | Required | Notes |
| --- | --- | --- |
| `from` | yes | User wallet address. |
| `amount` | yes | Decimal BEAN amount, or `max` for `2^256 - 1`. |
| `spender` | no | Defaults to STAKING. Accepts a literal address for other use cases. |

`meta.validation` includes current `allowance`, `balance`, and the spender that will be set.

### Stake BEAN

```
GET https://agent.minebean.com/api/v1/mcp/prepare/stake?from=0x...&amount=100
```

Encodes `Staking.deposit(uint256 amount)` payable. The optional `compoundFeeEth` query param funds the contract's per-user compound fee reserve (default `0` if omitted; `0.006` matches the website's default).

`meta.validation`:
- `balance`. BEAN balance of the wallet.
- `allowance`. Current BEAN allowance for STAKING (must be `>= amount`, otherwise the agent should call `approve-bean` first).
- `alreadyStaked`. Existing staking balance (informational; the contract accepts top-ups directly).
- `compoundFeeEth`. ETH amount that will be sent with the deposit.

Returns `VALIDATION_ERROR` if `amount > balance` or `allowance < amount`.

### Unstake BEAN

```
GET https://agent.minebean.com/api/v1/mcp/prepare/unstake?from=0x...&amount=100
```

Encodes `Staking.withdraw(uint256 amount)`. Pass `amount=max` to unstake the full position. Returns `VALIDATION_ERROR` if `amount > stakedBalance`.

### Compound

```
GET https://agent.minebean.com/api/v1/mcp/prepare/compound?from=0x...
```

Encodes `Staking.compound()` (claim pending yield and redeposit in one call). Requires `compoundFeeReserve > 0` on the contract. Otherwise returns `VALIDATION_ERROR` with `code: NO_COMPOUND_RESERVE`, telling the agent to call `prepare/stake` with a non-zero `compoundFeeEth` first.

### Claim mining ETH rewards

```
GET https://agent.minebean.com/api/v1/mcp/prepare/claim-eth?from=0x...
```

Encodes `GridMining.claimETH()`. `meta.validation` returns `pendingEthWei`. Returns `VALIDATION_ERROR` with `code: NOTHING_TO_CLAIM` when pending ETH is zero.

### Claim mining BEAN rewards

```
GET https://agent.minebean.com/api/v1/mcp/prepare/claim-bean?from=0x...
```

Encodes `GridMining.claimBEAN()`. `meta.validation` returns `pendingBeanGrossWei`, `pendingBeanFeeWei`, and `pendingBeanNetWei` so the agent can preview the net BEAN the user will receive. Returns `VALIDATION_ERROR` with `code: NOTHING_TO_CLAIM` when pending BEAN gross is zero.

### Buy BEAN, discovery only (v0.1)

```
GET https://agent.minebean.com/api/v1/mcp/buy-info
```

Returns the canonical BEAN buy paths:

```json
{
  "venues": [
    { "name": "Uniswap", "url": "https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x5c72...A5A5D&chain=base", "kind": "dex", "note": "BEAN/ETH liquidity lives on Uniswap V4. The swap UI auto-routes to V4." }
  ],
  "onramp": {
    "url": "https://pay.coinbase.com/buy/select-asset?...&defaultAsset=ETH",
    "kind": "fiat-to-eth",
    "note": "User onramps ETH first, then swaps to BEAN via Uniswap (V4)."
  }
}
```

A future `prepare/buy-bean` endpoint will return direct swap calldata once the BEAN/ETH liquidity pool integration is finalized. For now, hand the user the discovery URLs.

---

## send_calls mapping

Every successful prepare envelope maps 1:1 into a Base MCP `send_calls` payload:

```json
{
  "chain": "base",
  "calls": [
    {
      "to": "<data.to>",
      "value": "<data.value>",
      "data": "<data.data>"
    }
  ]
}
```

For first-time stakers (who haven't approved BEAN to STAKING yet), batch approve and stake into a single user approval:

```json
{
  "chain": "base",
  "calls": [
    {
      "to": "0x5c72992b83E74c4D5200A8E8920fB946214a5A5D",
      "value": "0x0",
      "data": "<approve-bean envelope data>"
    },
    {
      "to": "0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2",
      "value": "0x0",
      "data": "<stake envelope data>"
    }
  ]
}
```

Same pattern applies to any chained action.

---

## Disclaimers

- All prepare endpoints return unsigned calldata. No signing or broadcasting happens server-side.
- The agent must show `data.description` verbatim to the user before calling `send_calls`. This is non-negotiable.
- MineBean is a gamified protocol. Mining outcomes involve a random component on the BEAN reward path. Do not represent expected returns; quote pending claimable values from `/v1/mcp/state/<wallet>` only.
- Approvals are sticky. `approve-bean?amount=max` is convenient but persistent. Agents should describe this in plain terms before chaining into a stake.

## Links

- Protocol site: `https://minebean.com`
- Mining UI: `https://minebean.com`
- Agent UI (integrations, leaderboards, profile): `https://agent.minebean.com`
- Hermes plugin (PyPI): `https://pypi.org/project/hermes-mine-bean/`
- BEAN on BaseScan: `https://basescan.org/token/0x5c72992b83E74c4D5200A8E8920fB946214a5A5D`
