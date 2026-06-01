---
name: mine-bean-x402
version: 0.1.0
description: Run a hands-off MineBean agent whose deploy decision is powered by the paid x402 strategy endpoint. Each cycle the agent pays the x402 paywall for a fire/no-fire call, deploys ETH from your own wallet when it says fire (no 1% auto-miner cut), then claims pending ETH rewards. Works whether or not you already run an agent framework.
author: MineBean
license: MIT
homepage: https://minebean.com
repository: https://github.com/damo-nu11/hermes-mine-bean
network: base-mainnet
---

# mine-bean-x402

Autonomous loop driven by the MineBean x402 strategy endpoint: pay the paywall for a fire/no-fire decision, deploy from your own wallet on fire, claim pending ETH. Runs on whatever cadence you schedule.

Companion to the base `mine-bean` skill. That skill computes strategy locally and is free. This one routes the decision through `api.minebean.com/api/strategy/decide` (paid x402, $0.10 USDC/call), so the deploy carries the server's canonical strategy outcome and the fee routes to the treasury buyback.

## The loop

Every cycle, on whatever cadence you choose:

1. **Decide** — POST to `api.minebean.com/api/strategy/decide` over x402. The library handles the `402 → sign USDC EIP-3009 → retry with X-PAYMENT` handshake. You get back `{ fire, blocks, amountWei, tx, ... }`.
2. **Deploy** — if `fire` is true, validate the returned tx blueprint against the expected GridMining `deploy(uint8[])` shape, then sign and broadcast it from your own EOA. No auto-miner contract, so no 1% executor fee.
3. **Claim** — read pending ETH via `getTotalPendingRewards`, and if it clears your floor, broadcast `claimETH()`.

If `fire` is false, nothing is broadcast and you only paid the strategy fee.

## Pick your track

### Track A — you already run an agent (Hermes, Claude, AEON, etc.)

Your agent already has wallet and x402 capability, so no install. Point it at this loop:

- Each cycle, have the agent make the paid request to `api.minebean.com/api/strategy/decide` with a `strategy` body (one of `nostradamus`, `anti-winner`, `anti-loser`, `sniper`).
- Run the same calldata safety check shown below before broadcasting.
- Broadcast the returned `tx` from your wallet, then claim.
- Schedule it with your framework's task runner (`hermes cron`, a scheduled task, etc.). A sane default is one cycle every few minutes, not every 60-second round (see Cost).

If you run the `mine-bean` Hermes plugin, you can keep using its `minebean_claim` / `minebean_autostart` cron machinery for the claim + scheduling half, and supply the deploy from the x402 decision instead of a local preset.

### Track B — you do not run an agent

Use the self-contained Node runner below. One file, one cron line, no framework.

```bash
mkdir -p ~/minebean-x402 && cd ~/minebean-x402
npm init -y
npm install viem @x402/fetch @x402/core @x402/evm dotenv --legacy-peer-deps
# paste runner.mjs (below) and .env (below) into this folder
```

The MineBean strategy endpoint runs **x402 v2** on Base mainnet. The v2 packages are namespaced under `@x402/...` — the older non-namespaced `x402-fetch` (latest `1.2.0`) reads payment requirements from the response body and will crash against this endpoint with `Cannot read .map of undefined`. `--legacy-peer-deps` skips a React 19 peer dep on `@x402/paywall` (browser-only paywall UI, not used here).

`.env`:

```
# A DEDICATED wallet. Never your main wallet. Fund it only with the ETH you
# intend to mine plus a little USDC for strategy fees.
MINER_PRIVATE_KEY=0x...dedicated_wallet_key...

# Base RPC. A private endpoint (Alchemy/QuickNode) is steadier than the public one.
BASE_RPC_URL=https://mainnet.base.org

# Which paid strategy to request.
STRATEGY=sniper

# Hard safety gate. The runner refuses to broadcast unless this is 1.
LIVE_BROADCAST_UNLOCKED=0

# Per-call USDC ceiling (atomic 6-dp). 500000 = $0.50, 5x the current $0.10 fee.
MAX_PAYMENT_USDC_ATOMIC=500000

# Only claim when pending ETH >= this many wei. 1e14 = 0.0001 ETH (~20-40x gas).
MIN_CLAIM_WEI=100000000000000

# Hard ceiling on a single deploy, in wei. The server sets the deploy amount;
# this caps it so a bad endpoint can never spend more than you allow.
# 1e16 = 0.01 ETH. Set it to your own per-round risk tolerance.
MAX_DEPLOY_WEI=10000000000000000
```

Requires Node 18+ (the runner uses the global `fetch`).

`runner.mjs`:

```javascript
import 'dotenv/config'
import {
  createWalletClient, createPublicClient, http,
  decodeAbiParameters, toFunctionSelector, parseAbi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
// x402 v2 client. Build an x402Client, register the EVM "exact" scheme for
// Base mainnet (CAIP-2 eip155:8453) with our viem Account as the signer, then
// wrap fetch. The wrapper handles 402 → read payment-required header → sign
// EIP-3009 transferWithAuthorization → retry with X-PAYMENT transparently.
import { wrapFetchWithPayment } from '@x402/fetch'
import { x402Client } from '@x402/core/client'
import { ExactEvmScheme } from '@x402/evm/exact/client'

const GRIDMINING = '0x9632495bDb93FD6B0740Ab69cc6c71C9c01da4f0'
const STRATEGY_URL = 'https://api.minebean.com/api/strategy/decide'
const DEPLOY_SELECTOR = toFunctionSelector('function deploy(uint8[] blockIds) payable')
// ERC-8021 builder-code attribution (bc_rudgiazu). Appended below if the server
// did not already include it, so MineBean keeps its sequencer-fee share.
const BUILDER_CODE_SUFFIX = '0x62635f7275646769617a750b0080218021802180218021802180218021'
const ABI = parseAbi([
  'function claimETH()',
  'function getTotalPendingRewards(address) view returns (uint256,uint256,uint256,uint256)',
])

// Append the builder suffix only if it is not already present.
function withBuilderSuffix(data) {
  const body = BUILDER_CODE_SUFFIX.slice(2).toLowerCase()
  return data.toLowerCase().endsWith(body) ? data : (data + body)
}

const {
  MINER_PRIVATE_KEY, BASE_RPC_URL = 'https://mainnet.base.org',
  STRATEGY = 'sniper', LIVE_BROADCAST_UNLOCKED = '0',
  MAX_PAYMENT_USDC_ATOMIC = '500000', MIN_CLAIM_WEI = '100000000000000',
  // Hard ceiling on a single deploy. The server sets the amount; this caps it
  // so a buggy or hijacked endpoint cannot drain the wallet. 1e16 = 0.01 ETH.
  MAX_DEPLOY_WEI = '10000000000000000',
} = process.env

if (!MINER_PRIVATE_KEY) throw new Error('MINER_PRIVATE_KEY not set')
const LIVE = LIVE_BROADCAST_UNLOCKED === '1'

const account = privateKeyToAccount(MINER_PRIVATE_KEY)
const transport = http(BASE_RPC_URL)
const wallet = createWalletClient({ account, chain: base, transport })
const pub = createPublicClient({ chain: base, transport })

// Re-derive the expected deploy calldata and refuse anything else. A compromised
// or hijacked endpoint cannot make you broadcast an attacker tx: a mismatch here
// throws BEFORE any signature. Worst case you paid the strategy fee and kept your ETH.
function assertSafeDecision(d) {
  if (!d.tx) throw new Error('decision has no tx (fire=false)')
  const tx = d.tx
  if (tx.to.toLowerCase() !== GRIDMINING.toLowerCase())
    throw new Error(`tx.to is not GridMining: ${tx.to}`)
  const data = tx.data.toLowerCase()
  if (!data.startsWith(DEPLOY_SELECTOR.toLowerCase()))
    throw new Error(`wrong selector: ${data.slice(0, 10)}`)
  BigInt(tx.value) // must parse
  const [blocks] = decodeAbiParameters([{ type: 'uint8[]' }], ('0x' + data.slice(10)))
  if (!blocks.length || blocks.length > 25) throw new Error('bad block count')
  const seen = new Set()
  for (const b of blocks.map(Number)) {
    if (!Number.isInteger(b) || b < 0 || b > 24) throw new Error(`block out of range: ${b}`)
    if (seen.has(b)) throw new Error(`duplicate block: ${b}`)
    seen.add(b)
  }
}

// Build the v2 x402 client once. Reused across cycles — the wrapper is cheap.
const x402 = new x402Client()
x402.register('eip155:8453', new ExactEvmScheme(account))   // Base mainnet
const paidFetch = wrapFetchWithPayment(fetch, x402)

// v2 has no built-in per-call price ceiling like v1's third-arg. Preflight the
// 402 challenge ourselves, decode the base64 `payment-required` header, and
// abort if the asking amount exceeds MAX_PAYMENT_USDC_ATOMIC. One extra HTTP
// round-trip per cycle in exchange for the safety guarantee — a server-side
// price change can never silently drain you.
async function assertPriceWithinCap(body) {
  const probe = await fetch(STRATEGY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (probe.status === 200) return                       // no payment asked (shouldn't happen, but fine)
  if (probe.status !== 402) throw new Error(`preflight HTTP ${probe.status}`)
  const headerB64 = probe.headers.get('payment-required')
  if (!headerB64) throw new Error('402 with no payment-required header')
  const challenge = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'))
  const ask = challenge.accepts?.[0]
  if (!ask) throw new Error('challenge has no accepts')
  if (BigInt(ask.amount) > BigInt(MAX_PAYMENT_USDC_ATOMIC))
    throw new Error(`server asks ${ask.amount} USDC atoms, exceeds cap ${MAX_PAYMENT_USDC_ATOMIC}`)
}

async function cycle() {
  // 1. DECIDE — paid x402 v2 call. Preflight enforces the USDC ceiling, then
  // the wrapped fetch does the real call (which re-fetches internally, but
  // we already know the price is within cap).
  const body = JSON.stringify({ strategy: STRATEGY })
  await assertPriceWithinCap(body)
  const res = await paidFetch(STRATEGY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) { console.log(`[decide] HTTP ${res.status}`); return }
  const decision = await res.json()
  // Optional: settlement receipt from CDP facilitator on the 200 response.
  const receipt = res.headers.get('x-payment-response')
  if (receipt) console.log(`[paid] x-payment-response present (settled on-chain)`)
  console.log(`[decide] fire=${decision.fire} blocks=${decision.blocks} amountWei=${decision.amountWei}`)

  // 2. DEPLOY — only on fire, only after the safety check + value cap.
  // Wrapped so an unsafe or over-cap deploy is skipped, never aborts the claim.
  if (decision.fire) {
    try {
      assertSafeDecision(decision)
      const value = BigInt(decision.tx.value)
      if (value > BigInt(MAX_DEPLOY_WEI))
        throw new Error(`value ${value} exceeds MAX_DEPLOY_WEI ${MAX_DEPLOY_WEI}`)
      const data = withBuilderSuffix(decision.tx.data)
      if (!LIVE) {
        console.log(`[deploy] would deploy ${value} wei to ${decision.blocks} (dry-run)`)
      } else {
        const hash = await wallet.sendTransaction({ to: decision.tx.to, data, value })
        const r = await pub.waitForTransactionReceipt({ hash })
        console.log(`[deploy] ${hash} status=${r.status}`)
      }
    } catch (e) {
      console.log(`[deploy] skipped: ${e.message}`)
    }
  }

  // 3. CLAIM — independent of the deploy outcome.
  const [pendingEth] = await pub.readContract({
    address: GRIDMINING, abi: ABI, functionName: 'getTotalPendingRewards', args: [account.address],
  })
  if (pendingEth >= BigInt(MIN_CLAIM_WEI)) {
    if (!LIVE) {
      console.log(`[claim] would claim ${pendingEth} wei (dry-run)`)
    } else {
      const hash = await wallet.writeContract({ address: GRIDMINING, abi: ABI, functionName: 'claimETH' })
      const r = await pub.waitForTransactionReceipt({ hash })
      console.log(`[claim] ${hash} status=${r.status} cleared=${pendingEth} wei`)
    }
  } else {
    console.log(`[claim] pending ${pendingEth} wei below floor, skip`)
  }
}

cycle().catch((e) => { console.error('[cycle] error:', e.message); process.exit(1) })
```

Run once to confirm it reads and plans without broadcasting (`LIVE_BROADCAST_UNLOCKED=0`):

```bash
node ~/minebean-x402/runner.mjs
```

When the dry-run output looks right, set `LIVE_BROADCAST_UNLOCKED=1` and schedule it. One cycle every 5 minutes:

```bash
( crontab -l 2>/dev/null; echo "*/5 * * * * cd \$HOME/minebean-x402 && /usr/bin/env node runner.mjs >> cron.log 2>&1" ) | crontab -
```

## Cost

The fee is charged on every call, fire or not. At $0.10/call:

- One call per 60-second round = ~$144/day in fees before any deploy. Default to a slower cadence (every few minutes, or fixed windows).
- Per deploy, the $0.10 flat fee undercuts the auto-miner's 1% cut only above ~$10 deployed. Below that the flat fee can exceed the cut you avoided. Note the fee is also paid on no-fire calls, so net economics depend on fire-rate, not deploy size alone.
- The fee routes to the treasury buyback.

## Safety

- `LIVE_BROADCAST_UNLOCKED` must be `1` or the runner only plans, never broadcasts. Same gate the Hermes plugin uses.
- **Calldata guard** — `assertSafeDecision` re-derives the expected `deploy(uint8[])` calldata locally and throws on any deviation before signing. A hijacked or compromised endpoint cannot redirect your ETH; the worst case is a paid strategy call with no deploy.
- **Deploy ceiling** — `MAX_DEPLOY_WEI` hard-caps the ETH a single deploy can spend. The server picks the amount; this is your backstop so a bad response can never spend more than you allow. An over-cap or unsafe decision is skipped, and the claim still runs.
- **Per-call USDC cap** — `MAX_PAYMENT_USDC_ATOMIC` is enforced by a preflight that decodes the v2 `payment-required` challenge header before the paid retry; an over-cap ask throws before any signature. Bounds the EIP-3009 authorization so a server-side price change cannot drain you.
- **Dedicated wallet** — use a throwaway funded only with mining ETH and a little USDC. Never your main key.
- **Claim floor** — `MIN_CLAIM_WEI` stops dust claims from being eaten by gas. Reads `getTotalPendingRewards`, which includes the freshly-won, not-yet-checkpointed round (so you never under-claim).
- The claim is independent of the deploy: a reverted or skipped deploy never blocks the claim, and the nonce sequences cleanly because each tx is built fresh.

## Why route through x402

- **Canonical outcome.** The decision is computed server-side from current grid and price data. No local strategy port to keep in sync.
- **No upkeep.** One call returns blocks, amount, and ready-to-sign calldata. No price feeds, no math to maintain when strategies change.
- **Fee funds the buyback.** Every call routes to the treasury buyback regardless of round outcome.

## Repo

Source, issues, releases: https://github.com/damo-nu11/hermes-mine-bean
