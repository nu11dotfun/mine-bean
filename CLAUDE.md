# BEAN Protocol — Frontend

## Overview

Gamified mining protocol on Base. Users compete in 60-second rounds on a 5×5 grid of blocks, deploying ETH to earn BEAN tokens and ETH rewards. Built with Next.js 14 (App Router), React 18, TypeScript, and Wagmi/RainbowKit for wallet integration.

## Tech Stack

- **Framework:** Next.js 14.2.3 (App Router)
- **UI:** React 18.3.1, TypeScript 5
- **Web3:** Wagmi 2.8.0, Viem 2.9.20, RainbowKit 2.1.2
- **State:** TanStack React Query 5.28.4, useState, custom window events
- **Styling:** Inline React styles (no CSS framework). Dark theme `#0a0a0a`, accent `#F0B90B`

## Project Structure

```
app/
  page.tsx          — Home / Mining interface (LandingPage → MiningGrid)
  about/page.tsx    — Protocol documentation
  global/page.tsx   — Global stats, mining tables, revenue, leaderboard
  stake/page.tsx    — Staking contract orchestrator (approve→deposit chain, withdraw, claim, compound)
  profile/page.tsx  — User profile management
  privacy/page.tsx  — Privacy Policy
  terms/page.tsx    — Terms of Service
  layout.tsx        — Root layout with Web3Provider
  globals.css       — Global styles
  (agent)/          — Agent subdomain route group (agent.minebean.com)
    agents/page.tsx       — Agent carousel with live stats cards
    agents/[id]/page.tsx  — Individual agent profile (detailed stats, round history)
    beanbook/page.tsx     — Social feed page

components/
  Header.tsx          — Top nav with ETH/BEAN price feeds, wallet button
  BottomNav.tsx       — Mobile bottom navigation
  LandingPage.tsx     — Landing/intro screen with CTA
  MiningGrid.tsx      — 5×5 interactive block grid
  SidebarControls.tsx — Desktop mining controls (manual/auto modes)
  MobileControls.tsx  — Mobile mining controls
  ClaimRewards.tsx    — Rewards display + claim buttons (ETH, unroasted/roasted BEAN)
  MinersPanel.tsx     — Winning miners sliding panel (ETH + BEAN rewards per round)
  MobileMiners.tsx    — Mobile miners panel
  MobileStatsBar.tsx  — Mobile stats bar
  BeanpotCelebration.tsx — Beanpot win celebration (confetti, sound, "BEANPOT HIT" overlay)
  CountdownCelebration.tsx — Countdown celebration overlay
  HelpButton.tsx      — Help menu with how-to-play modal, sound mute toggle, links
  ProfilePage.tsx     — User profile (avatar upload, username, bio, portfolio display)
  GlobalStats.tsx     — Protocol metrics (supply, burned, revenue)
  MiningTable.tsx     — Mining history table
  RevenueTable.tsx    — Protocol revenue breakdown
  LeaderboardTable.tsx— Top miners/stakers leaderboard
  StakePage.tsx       — Staking interface (deposit/withdraw, user position, global stats, APR calculator)
  WalletButton.tsx    — Wallet connection with balance display
  BeanLogo.tsx        — Logo SVG components
  AboutPage.tsx       — About content with expandable sections

lib/
  api.ts            — Backend API helpers (apiFetch, apiMutate). Base URL via NEXT_PUBLIC_API_URL env var (default https://api.minebean.com)
  SSEContext.tsx    — Centralized SSE provider (useSSE hook for subscribeGlobal/subscribeUser)
  contracts.ts      — Contract addresses, ABIs, and constants (MIN_DEPLOY_PER_BLOCK, EXECUTOR_FEE_BPS, EXECUTOR_FLAT_FEE)
  UserDataContext.tsx — Shared user data provider (rewards, staking, profile) with sessionStorage caching
  RoundTimerContext.tsx — Centralized round countdown timer with RPC block.timestamp calibration
  types.ts          — Typed window event interfaces and global WindowEventMap declarations
  useProfileResolver.ts — Hook for batch-resolving wallet addresses to profile data (username, pfp)
  supabase.ts       — Supabase client (anon key, cache: 'no-store' to bypass Next.js fetch cache). Used only by Next.js API routes for profile storage.
  providers.tsx     — Web3Provider (Wagmi, RainbowKit, React Query, SSEProvider, UserDataProvider, RoundTimerProvider)
  wagmi.ts          — Chain config (Base mainnet + testnet)
  agents.ts         — Agent metadata (AGENTS array: id, apiAgentId, name, strategy, walletAddress, initialFunding, status)
  agentData.ts      — Agent stats computation (fetchAgentStats for individual agent pages, AgentStats/RoundData types, sparkline/PnL calculation)
  abis/             — Contract ABI JSON files (GridMining, AutoMiner, Bean, Treasury, ERC20, Staking)

components/
  AgentHeader.tsx     — Agent subdomain top nav
  AgentBottomNav.tsx  — Agent subdomain mobile bottom nav
```

## Commands

```bash
npm run dev       # Development server
npm run build     # Production build
npm start         # Production server
npm run lint      # Linter
npx vitest run    # Run test suite
```

## Conventions

- **Styling:** Inline `React.CSSProperties` objects. No Tailwind or CSS-in-JS library.
- **Colors:** Background `#0a0a0a`, accent/yellow `#F0B90B`, text white/gray variants.
- **Responsive:** Mobile breakpoint at `768px`. Separate mobile components (`MobileControls`, `MobileMiners`, `MobileStatsBar`).
- **Cross-component communication:** `window.dispatchEvent` / `window.addEventListener` with custom events.
- **No global state library.** Component-level `useState` and prop drilling.

## Contract Addresses

| Contract    | Address                                      |
|-------------|----------------------------------------------|
| Bean        | `0x5c72992b83E74c4D5200A8E8920fB946214a5A5D` |
| GridMining  | `0x9632495bDb93FD6B0740Ab69cc6c71C9c01da4f0` |
| AutoMiner   | `0x31358496900D600B2f523d6EdC4933E78F72De89` |
| Treasury    | `0x38F6E74148D6904286131e190d879A699fE3Aeb3` |
| Staking     | `0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2` |
| BEAN/ETH LP | `0xd7e5522c9cc3682c960afada6adde0f8116580f2ad2cef08c197faf625e53842` |

**ABI source:** `lib/abis/GridMining.json` is extracted from Hardhat artifacts (`hardhat/artifacts/contracts/GridMining.sol/GridMining.json`). Includes `AlreadyDeployedThisRound` custom error, `ResetRequested` event, and `topMinerSeed`/`winnersDeployed` fields in `RoundSettled` event.

## Integration Status

### Connected to Backend + Smart Contract
- **app/page.tsx** — Orchestrates deploy and claim flows. Uses wagmi `useWriteContract` to call `GridMining.deploy(uint8[] blockIds)` payable, `GridMining.claimETH()`, and `GridMining.claimBEAN()`. On deploy tx success, dispatches `userDeployed` window event for optimistic block tracking. Passes `onDeploy`, `onClaimETH`, `onClaimBEAN` callbacks to child components. Mounts `<BeanpotCelebration />` and `<CountdownCelebration />` (desktop layout only). **Hydration-safe:** `showMining` state initializes as `false`, then reads `sessionStorage('bean_visited')` in a `useEffect` to avoid SSR/client mismatch.
- **BeanpotCelebration.tsx** — Uses `subscribeGlobal('roundTransition')` via SSE directly (no window event dependency). Triggers celebration (canvas-confetti + Web Audio API sound + "BEANPOT HIT" text overlay) when `settled.beanpotAmount > 0`. Handles hex string amounts from backend via `BigInt()` conversion. Sound respects `bean_muted` localStorage flag. Text auto-hides after 6 seconds.
- **MiningGrid.tsx** — Fetches `GET /api/round/current?user=` on mount (with wallet address when connected), uses `useSSE()` to subscribe to global events (`deployed`, `roundSettled`, `gameStarted`) and user events (`autoMineExecuted`). Dispatches `roundData`, `roundDeployed`, and `roundSettled` window events. Tracks `userDeployedBlocks` (blocks user already deployed to this round) via `GET /api/user/:address/history?type=deploy&roundId=X` on load and optimistic `userDeployed` events. Deployed blocks are visually marked (green border + ✓) and unclickable. **One deploy per round:** `hasDeployedThisRound` boolean locks ALL grid blocks after the first deploy — set `true` on `userDeployed` event or when backend history shows existing deploys, reset to `false` in `resetForNewRound()`. The `selectAllBlocks` listener is also ignored when `hasDeployedThisRound` is true. **AutoMiner grid lock:** When in auto mode (`autoMode.enabled`), all grid cells are disabled to prevent manual selection.
- **SidebarControls.tsx** — Receives round data (beanpot, round number, total deployed, user deployed) via `roundData`/`roundDeployed`/`roundSettled` window events from MiningGrid. Timer from `useRoundTimer()` context. Uses `useSSE()` to subscribe to user events (`autoMineExecuted`, `configDeactivated`, `stopped`) for AutoMiner real-time updates. Fetches ETH and BEAN prices from `GET /api/stats` every 30s. Phase (counting/eliminating/winner) driven by backend events, not a local timer. Deploy button enabled only when `canDeploy` (perBlock >= MIN_DEPLOY_PER_BLOCK, blocks > 0, timer > 0, phase === "counting", `userDeployed === 0`). When `hasDeployed` (userDeployed > 0), button shows "✓ Deployed" and is disabled. **Input is per-block amount** — total is calculated as `perBlock × selectedBlocks`.
- **MobileControls.tsx** — Same as SidebarControls but mobile layout. Uses `useSSE()` for user event subscriptions. Phase-aware deploy button with same `canDeploy` logic. Tracks `userDeployed` via `roundData` and `roundDeployed` window events (matches `user` field against connected `userAddress` prop). Shows "✓ Deployed" when locked.
- **MobileStatsBar.tsx** — Receives beanpot, total deployed, and user deployed via `roundData`/`roundDeployed` window events. Timer from `useRoundTimer()` context.
- **ClaimRewards.tsx** — Uses shared `useUserData()` context for rewards data (no local fetching or SSE subscriptions). Shows ETH rewards, unroasted BEAN, roasted BEAN separately. Conditionally rendered — hidden when all rewards are zero. Claim buttons call `onClaimETH`/`onClaimBEAN` callbacks from page.tsx.
- **MinersPanel.tsx** — Sliding left panel showing winning miners from the last settled round. Listens to `roundSettled` window event to capture the settled roundId (stored in a ref), then on `settlementComplete` (after 8s animation) fetches `GET /api/round/:id/miners` to get computed ETH and BEAN rewards per winner. Uses a consume-once ref pattern: `settledRoundIdRef` is set by `roundSettled` and cleared after consumption by `settlementComplete`, so empty rounds (no `roundSettled` event) don't re-trigger old data. Panel auto-opens when winners data arrives; collapsed state shows a trophy icon tab on the left edge. If the round had no deployments (empty miners response), keeps showing the previous round's data without re-opening.
- **app/page.tsx** — Also handles AutoMiner contract interactions via `handleAutoActivate` (calls `AutoMiner.setConfig(strategyId, numRounds, numBlocks, blockMask)` payable) and `handleAutoStop` (calls `AutoMiner.stop`). Dispatches `autoMinerActivated`/`autoMinerStopped` window events on success.
- **SidebarControls.tsx / MobileControls.tsx** — Support both Manual and Auto mining modes. Auto mode: fetches `GET /api/automine/:address` on mount, uses `useSSE()` to subscribe to `autoMineExecuted`/`configDeactivated`/`stopped` events for real-time updates. When AutoMiner is active, hides Manual tab and shows active status (balance, strategy, rounds executed/total, per block/round). Three strategies: **All** (all 25 blocks), **Random** (user-chosen count), **Select** (user picks specific blocks on grid, encoded as `blockMask` bitmask). Configure view validates per-block amount against `MIN_DEPLOY_PER_BLOCK` using hybrid fee calculation (see AutoMiner Integration). Calls `onAutoActivate`/`onAutoStop` props from page.tsx.
- **MiningGrid.tsx** — Also uses `useSSE()` to subscribe to `autoMineExecuted` to highlight deployed blocks green. Additionally handles AutoMiner deployments in the global `deployed` SSE handler: when `isAutoMine === true` and user matches, fetches deployment history and decodes `blockMask` to mark deployed blocks.
- **MiningTable.tsx** — Fetches `GET /api/rounds?page=N&limit=12&settled=true` on mount. Supports two tabs: "Rounds" (all settled rounds) and "Beanpot" (rounds where beanpot was won, via `&beanpot=true`). Server-side pagination. Displays: Round ID, winning block, BEAN winner (address or "Split" badge based on `isSplit`), winner count, ETH deployed/vaulted/winnings, beanpot amount (or dash if 0), relative time. **Clickable rows:** Each row links to the fulfilment transaction on BaseScan (`txHash` field from API).
- **RevenueTable.tsx** — Fetches `GET /api/treasury/buybacks?page=N&limit=12` on mount. Server-side pagination. Displays buyback transactions: Time (relative), ETH Spent, BEAN Burned, Yield Generated (BEAN to stakers). No tabs — only Buybacks view. **Clickable rows:** Each row links to the buyback transaction on BaseScan (`txHash` field from API).
- **LeaderboardTable.tsx** — Fetches `GET /api/leaderboard/miners?period=all&limit=12`, `GET /api/leaderboard/stakers?limit=12`, and `GET /api/leaderboard/earners?limit=12` on mount in parallel. Three tabs: Miners (total ETH deployed), Stakers (total BEAN staked), Unroasted (unclaimed BEAN). Displays: Rank, Address (with profile picture if available), Value with icon (ETH or BEAN). **Clickable rows:** Each row links to the wallet address on BaseScan. Uses `useProfileResolver` to get both `profiles` map (for pfp) and `resolve` function (for username).
- **GlobalStats.tsx** — Fetches `GET /api/stats` and `GET /api/treasury/stats` on mount. Displays: Max Supply (hardcoded 3M), Circulating Supply (`totalMintedFormatted`), Burned (`totalBurnedFormatted`), Protocol Revenue (`totalVaultedFormatted`).
- **app/stake/page.tsx** — Orchestrates staking contract interactions. Uses wagmi `useWriteContract` (2 instances) to handle the ERC20 approve→deposit chain: first `Bean.approve(Staking, amount)`, then `Staking.deposit(amount)` with optional `msg.value` for compound fee ETH. Chains transactions via `useWaitForTransactionReceipt` watching approval tx hash; on confirmation, fires deposit with stored `pendingApprovalAmount` and `pendingCompoundFee`. Also handles `Staking.withdraw(amount)`, `Staking.claimYield()`, and `Staking.compound()`. Reads BEAN balance via `useBalance({ token: CONTRACTS.Bean.address })`. Passes `onDeposit`, `onWithdraw`, `onClaimYield`, `onCompound` callbacks to StakePage component.
- **StakePage.tsx** — Full staking interface connected to backend and smart contract. Fetches `GET /api/staking/stats` on mount for global stats (totalStaked, APR, TVL). Uses `useUserData()` for user stake info (`stakeInfo`, `refetchStakeInfo`) — no longer fetches `/api/staking/:address` directly. Uses `useSSE()` to subscribe to global `yieldDistributed` and user `stakeDeposited`/`stakeWithdrawn`/`yieldCompounded` events — triggers global stats re-fetch. Summary section shows Total Deposits, APR, TVL. Deposit/withdraw section shows BEAN balance, input field, and auto-compound settings (toggle + ETH input, default 0.006). User position card (visible when staked > 0) shows total staked, pending rewards, "Claim" and "Claim & Deposit" buttons. Info icons ('i') on all metrics open tooltip dialogues on hover (desktop) or click (mobile). Includes APR Calculator modal using real APR from backend. **Delayed re-fetch pattern:** Since `/api/staking/stats` is cached with 60s refresh on backend, SSE event handlers re-fetch immediately + again after 10s to catch cache updates.

### Client-Side External API Calls (Not Through Backend)
- **Header.tsx** — BEAN price from DexScreener via `CONTRACTS.LP.address`. ETH price from Binance API.
- **LandingPage.tsx** — BEAN price from DexScreener via `CONTRACTS.LP.address`.
- **StakePage.tsx** — BEAN price for APR calculator from DexScreener via `CONTRACTS.LP.address`.
- **WalletButton.tsx** — Wallet connection and balance reads via wagmi.

### Not Yet Connected
- **MobileMiners.tsx** — Hardcoded miner list (not yet connected to `/api/round/:id/miners`).

### Agent Pages (`agent.minebean.com`)

The agent subdomain displays autonomous mining agents and their performance. Routes live in `app/(agent)/` route group. Middleware (`middleware.ts`) redirects `/agents` and `/beanbook` paths to `agent.minebean.com` in production and passes through on localhost.

- **`app/(agent)/agents/page.tsx`** — Agent carousel displaying 5 agent cards with live stats. Fetches all agent data from a single `GET /api/agents/stats` backend endpoint (cached 30s on backend). Maps response into `statsMap` state keyed by agent ID. Auto-refreshes every 120s. Cards display: win rate, ROI, net PnL (ETH), sparkline (cumulative PnL over 7 days), rounds played. Total PnL summary section aggregates across all agents. Uses `AgentStats` type from `lib/agentData.ts`.

- **`app/(agent)/agents/[id]/page.tsx`** — Individual agent profile page. Uses `fetchAgentStats()` from `lib/agentData.ts` directly (not the batch endpoint) with `historyPages=4` for deeper round history. Displays detailed stats, round-by-round table, and performance charts. Still makes individual API calls (`/api/user/{addr}/history`, `/api/user/{addr}/rewards`) plus on-chain balance reads.

- **`lib/agents.ts`** — Agent metadata: `AGENTS` array with `id`, `apiAgentId`, `name`, `strategy`, `walletAddress`, `initialFunding`, `status`. Also exports `PRE_BURN_HOLDER_PAYOUTS` (395 BEAN) and `PRE_BURN_PER_AGENT` for PnL offset calculation.

- **`lib/agentData.ts`** — Agent stats computation. `fetchAgentStats()` fetches history + rewards + on-chain balances for a single agent, computes PnL, win rate, ROI, sparkline. Has 120s in-memory cache (`statsCache`). Used only by individual agent profile page. The carousel page uses the batch backend endpoint instead.

## Architecture Notes

### Agent Subdomain Routing (`middleware.ts`)

The middleware routes agent paths (`/agents`, `/beanbook`) to the `agent.minebean.com` subdomain in production. On `localhost`, all paths pass through without redirects. The agent route group `app/(agent)/` shares the same Next.js app — the middleware only controls which domain serves which paths.

- **`agent.minebean.com`** — Serves `/agents`, `/agents/[id]`, `/beanbook`. Non-agent paths redirect to `www.minebean.com`.
- **`www.minebean.com`** — Serves all other paths. Agent paths redirect to `agent.minebean.com`.
- **`localhost`** — All paths pass through (no redirects). Access agent pages at `http://localhost:3000/agents`.
- **Passthrough paths** — `/api/`, `/_next/`, `/favicon`, `/images/`, `/.well-known/` are never redirected.

### MiningGrid Round Lifecycle

The grid handles three SSE events with careful ordering logic since `roundSettled` and `gameStarted` originate from the same blockchain transaction and can arrive in any order:

1. **`deployed`** — Updates grid cells with aggregated block data from backend. Skipped during settlement animation.
2. **`roundSettled`** — Freezes current grid into a `snapshotCellsRef` (immune to resets), starts 5-second elimination animation, shows winner for 3 seconds, then resets.
3. **`gameStarted`** — Always buffered into `pendingResetRef`, never resets immediately. A 2-second fallback timer handles the case where `roundSettled` was missed.

**Key pattern:** During the 8-second settlement animation, the render reads from `snapshotCellsRef` instead of `cells` state. This ensures the old round's deployment data stays visible even if the cells state is reset by other events. After the animation, `resetForNewRound()` clears the snapshot, resets all state, and re-fetches `/api/round/current?user=` to catch any deployments that arrived during the animation window.

### User Address Prop Threading

The connected wallet address flows from `app/page.tsx` (via `useAccount()`) down to components as `userAddress` prop:

- **MiningGrid** — Uses it to fetch `/api/round/current?user={address}`, which returns `userDeployedFormatted` in the response. This is included in the `roundData` window event. Also keeps a `userAddressRef` so the `resetForNewRound` callback always reads the latest address.
- **SidebarControls / MobileStatsBar** — Use it to match the `user` field in `roundDeployed` events against the connected wallet. When the deployer matches, `userDeployedFormatted` (provided by backend in the SSE `deployed` event) updates the "You deployed" display in real time.

**Stale closure note:** The `useEffect` that registers window event listeners in SidebarControls and MobileStatsBar must include `userAddress` in its dependency array, otherwise the `handleRoundDeployed` callback captures `undefined` from initial render and never matches.

### Custom Window Events

Components communicate via `window.dispatchEvent` / `window.addEventListener`:

| Event | Dispatched By | Consumed By | Payload |
|-------|--------------|-------------|---------|
| `roundData` | MiningGrid | SidebarControls, MobileControls, MobileStatsBar | Full round metadata: `{ roundId, startTime, endTime, beanpotPoolFormatted, totalDeployedFormatted, userDeployedFormatted, ... }` |
| `roundDeployed` | MiningGrid | SidebarControls, MobileControls, MobileStatsBar | Live deployment update: `{ totalDeployed, totalDeployedFormatted, user, userDeployedFormatted }` |
| `roundSettled` | MiningGrid | SidebarControls, MobileControls, MinersPanel | Settlement data: `{ roundId, winningBlock, topMiner, totalWinnings, beanpotAmount (hex), ... }` |
| `blocksChanged` | MiningGrid | SidebarControls, MobileControls | `{ blocks: number[], count: number }` |
| `selectAllBlocks` | SidebarControls, MobileControls | MiningGrid | `{ selectAll: boolean }` |
| `userDeployed` | app/page.tsx (on tx success) | MiningGrid | `{ blockIds: number[] }` — optimistically marks blocks as deployed |
| `settlementComplete` | MiningGrid | ClaimRewards, MinersPanel | No payload — signals that the 8s settlement animation finished and grid has reset |

### MinersPanel Off-Chain Reward Calculation

The `GET /api/round/:id/miners` endpoint computes per-winner rewards entirely off-chain from MongoDB data:

1. **Filter winners:** Query deployments for the round, filter by `blockMask & (1 << winningBlock) !== 0`
2. **ETH rewards:** `(totalWinnings × userDeployed) / totalWinnersDeployed` — proportional for all rounds
3. **BEAN rewards (split, `isSplit=true`):** `(topMinerReward × userDeployed) / totalWinnersDeployed`
4. **BEAN rewards (non-split, `isSplit=false`):** Weighted random replay:
   - `sample = topMinerSeed % winnersDeployed`
   - Replay deployments to winning block in `blockNumber + logIndex` order
   - Each adds `amountPerBlock` to cumulative; first to exceed `sample` is BEAN winner
   - Winner gets full `topMinerReward`; others get 0 BEAN
5. **Beanpot:** `(beanpotAmount × userDeployed) / totalWinnersDeployed` — added to all winners

`topMinerSeed` and `winnersDeployed` are emitted in the `RoundSettled` contract event and stored in the Round model. Deployment ordering relies on `blockNumber` + `logIndex` fields stored in the Deployment model (populated from QuickNode stream filter).

### One Deploy Per Round

The GridMining contract enforces one deploy per round per user — calling `deploy()` a second time in the same round reverts with `AlreadyDeployedThisRound`. The frontend mirrors this constraint:

1. **MiningGrid** — `hasDeployedThisRound` state (boolean). Set `true` when `userDeployed` window event fires (optimistic, on tx success) or when backend history shows `userDeployedBlocks.size > 0`. All grid cells become `disabled` when true. `selectAllBlocks` events are ignored. On `userDeployed`, selected blocks are cleared and `blocksChanged` is dispatched with empty blocks. Reset to `false` in `resetForNewRound()`.

2. **SidebarControls** — `hasDeployed` derived from `userDeployed > 0` (tracked via `roundData` and `roundDeployed` events). Added to `canDeploy` as `!hasDeployed`. Button text changes to "✓ Deployed" when locked.

3. **MobileControls** — Same `hasDeployed` / `canDeploy` logic. Tracks `userDeployed` state via `roundData` (initial load) and `roundDeployed` (live SSE updates, matched against connected `userAddress` prop). Reset to 0 on `roundSettled`.

**Lifecycle:** User connects → loads round → backend returns `userDeployedFormatted` → if non-zero, grid and buttons are locked. User deploys → `userDeployed` event fires → grid locks immediately (optimistic). New round starts → `resetForNewRound()` clears `hasDeployedThisRound`, controls reset `userDeployed` to 0 on `roundSettled`.

### AutoMiner Integration

The AutoMiner contract uses a single payable `setConfig(strategyId, numRounds, numBlocks, blockMask)` to deposit ETH and configure in one transaction, and `stop()` to deactivate and refund remaining ETH.

**Strategies:**
- **All** (ID 1) — Deploy to all 25 blocks every round. `blockMask = 0`.
- **Random** (ID 0) — Deploy to N random blocks every round. `blockMask = 0`.
- **Select** (ID 2) — Deploy to user-chosen blocks every round. `blockMask` = bitmask of selected block IDs (uint32, bits 0-24 for the 5×5 grid). Computed as `selectedBlockIds.reduce((m, id) => m | (1 << id), 0)`.

**Frontend constants in `lib/contracts.ts`:**
- `MIN_DEPLOY_PER_BLOCK = 0.0000025` — minimum ETH per block
- `EXECUTOR_FEE_BPS = 100` — 1% executor fee deducted from deposits
- `EXECUTOR_FLAT_FEE = 0.000006` — ETH per round flat fee floor

**Hybrid fee calculation:** The contract charges `max(percentageFee, flatFee)` per round. Frontend mirrors this to calculate the required deposit:
```typescript
const pctFeePerRound = perBlockAmount * numBlocks * EXECUTOR_FEE_BPS / 10000
const deposit = pctFeePerRound >= EXECUTOR_FLAT_FEE
  ? perBlockAmount * totalBlocks * (10000 + EXECUTOR_FEE_BPS) / 10000   // percentage path
  : perBlockAmount * totalBlocks + EXECUTOR_FLAT_FEE * numRounds         // flat fee path
```

**UI States:**
1. **Manual mode** — Normal block selection and deploy flow
2. **Auto Configure** — Input ETH per-block amount, strategy (All/Random/Select), blocks (if random; if select, user picks on grid), rounds. Shows calculated per-block, per-round, and total deposit amounts.
3. **Auto Active** — When `autoMinerState.active === true`. Hides Manual tab, shows status: balance (refundable), strategy (All/Random/Select), rounds executed/total, per block. Stop button triggers refund.

**Real-time updates via `useSSE()`:**
- SidebarControls/MobileControls use `subscribeUser()` for `autoMineExecuted`, `configDeactivated`, `stopped` events
- On any event, re-fetches `GET /api/automine/:address` to update display
- On `configDeactivated`, switches back to manual mode

**Grid highlighting for AutoMiner:**
- MiningGrid uses `subscribeUser('autoMineExecuted')` to add deployed blocks to `userDeployedBlocks` Set
- Also handles AutoMiner in global `deployed` SSE (via `subscribeGlobal`): when `isAutoMine === true` and user matches, fetches `/api/user/:address/history?type=deploy&roundId=X&limit=1`, decodes `blockMask`, and updates `userDeployedBlocks`
- This dual approach handles the race condition where user SSE may not be connected for the first round

**Grid interaction in AutoMiner mode:**
- When `autoMode.enabled === true` and strategy is All or Random, all grid cell clicks are disabled
- When strategy is **Select**, grid cells remain clickable during configuration so the user can pick blocks. `autoMinerMode` event dispatched with `strategy: "select"` tells MiningGrid to allow selection.
- Once AutoMiner is activated (`isAutoMinerActive === true`), grid is locked regardless of strategy

**Window events:**
| Event | Dispatched By | Consumed By |
|-------|--------------|-------------|
| `autoMinerActivated` | page.tsx (setConfig success) | SidebarControls, MobileControls |
| `autoMinerStopped` | page.tsx (stop success) | SidebarControls, MobileControls |

### Staking Integration

The staking page (`/stake`) allows users to deposit BEAN tokens to earn yield from protocol buybacks. Connected to `Staking` contract (`0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2`) via wagmi.

**Deposit flow (approve→deposit chain):**
1. User enters BEAN amount + optional auto-compound toggle (ETH for `compoundFeeReserve`)
2. `app/stake/page.tsx` calls `Bean.approve(Staking, amount)` via `writeContract` (hook 1)
3. `useWaitForTransactionReceipt` watches approval tx hash
4. On confirmation, `useEffect` fires `Staking.deposit(amount)` with `value: compoundFeeEth` via `writeContract2` (hook 2)
5. `pendingApprovalAmount` and `pendingCompoundFee` state cleared after deposit tx sent

**Contract functions used:**
- `deposit(uint256 amount)` payable — deposit BEAN, optional ETH `msg.value` goes to `compoundFeeReserve`
- `withdraw(uint256 amount)` — withdraw staked BEAN
- `claimYield()` — claim accumulated BEAN yield
- `compound()` — claim yield and re-deposit (label: "Claim & Deposit")

**Data sources:**
- `GET /api/staking/stats` — Global stats (totalStaked, apr, tvlUsd). Cached 60s on backend.
- `GET /api/staking/:address` — User stake info (balance, pendingRewards, compoundFeeReserve, canCompound). Fresh RPC call, not cached.

**Real-time updates via `useSSE()`:**
- `subscribeGlobal('yieldDistributed')` → re-fetches both global stats and user stake info
- `subscribeUser('stakeDeposited'|'stakeWithdrawn'|'yieldClaimed'|'yieldCompounded')` → re-fetches user stake info + global stats with delayed re-fetch

**Delayed re-fetch pattern:** Since `/api/staking/stats` is cached with 60s refresh, SSE events trigger an immediate fetch (may get stale cache) plus a 10-second delayed fetch to catch the cache update. Timers are cleaned up on unmount.

**UI components:**
1. **Summary section** — Total Deposits (BEAN), APR (%), TVL (USD) from `/api/staking/stats`
2. **Deposit/Withdraw** — Tab switch, BEAN balance display, amount input, MAX button. Deposit tab shows auto-compound toggle (default off) with ETH input (default 0.006) when enabled
3. **User Position** — Visible when `userStakeInfo.balance > 0`. Shows total staked, pending rewards (accent color), "Claim" and "Claim & Deposit" buttons
4. **APR Calculator** — Modal with real APR from backend, calculates projected earnings
5. **Info icons** — Hover (desktop) / click (mobile) tooltips explaining each metric

### `lib/api.ts` Helpers

- **`apiFetch<T>(path)`** — Typed GET request to backend. Base URL from `NEXT_PUBLIC_API_URL` env var (default `https://api.minebean.com`).
- **`apiMutate<T>(path, method, body)`** — Typed POST/PUT/DELETE request to backend. Sends JSON body.

### Profile Storage (`lib/supabase.ts` + `app/api/user/[address]/profile/route.ts`)

Profile data (`username`, `bio`, `pfp_url`, `banner_url`) is stored in **Supabase** (separate from MongoDB game data). All reads and writes go through a Next.js API route — the Express backend is not involved in profile operations.

**`lib/supabase.ts`** — exports a single `supabase` client (anon key) with `cache: 'no-store'` passed via the `global.fetch` option to bypass Next.js data cache on all Supabase calls.

**`GET /api/user/[address]/profile`** — reads `username`, `bio`, `pfp_url`, `banner_url` from Supabase `profiles` table. Called by ProfilePage on mount (relative URL, hits the Next.js route) and by `useUserData` on mount (via `apiFetch` to Express backend, which proxies to the same data).

**`PUT /api/user/[address]/profile`** — writes profile updates. Security:
- Timestamp validation (rejects requests older than 5 minutes)
- Wallet signature verification — server reconstructs the expected message (`BEAN Protocol Profile Update\nAddress: {addr}\nTimestamp: {ts}`) rather than trusting the client
- Image validation: data URL only, JPEG/PNG only, max 200KB
- Text validation: username max 20 chars, bio max 160 chars
- Only upserts fields that were provided (partial update)

After a successful PUT, **ProfilePage calls `patchProfile(fields)`** from `useUserData()` to update WalletButton immediately without a re-fetch.

### Centralized SSE Architecture (`lib/SSEContext.tsx`)

The app uses a centralized SSE provider to maintain exactly **2 connections** per browser session (1 global + 1 user) instead of per-component connections that caused connection stacking and 429 rate limit errors.

**Provider setup in `lib/providers.tsx`:**
```tsx
function SSEWrapper({ children }: { children: React.ReactNode }) {
  const { address } = useAccount()
  return (
    <SSEProvider userAddress={address}>
      <UserDataProvider userAddress={address}>
        <RoundTimerProvider>
          {children}
        </RoundTimerProvider>
      </UserDataProvider>
    </SSEProvider>
  )
}
```

**Usage in components:**
```tsx
import { useSSE } from '@/lib/SSEContext'

const { subscribeGlobal, subscribeUser } = useSSE()

// Subscribe to global events (round lifecycle)
useEffect(() => {
  const unsub = subscribeGlobal('deployed', (data) => { ... })
  return () => unsub()
}, [subscribeGlobal])

// Subscribe to user-specific events (claims, autominer)
useEffect(() => {
  const unsub = subscribeUser('claimedETH', (data) => { ... })
  return () => unsub()
}, [subscribeUser])
```

**Connection lifecycle:**
- **Global connection** (`/api/events/rounds`) — Opens on app mount, never closes. Listens for: `gameStarted`, `deployed`, `roundSettled`, `roundTransition`, `yieldDistributed`
- **User connection** (`/api/user/{address}/events`) — Opens when wallet connects, closes on disconnect. Listens for: `autoMineExecuted`, `configDeactivated`, `stopped`, `claimedETH`, `claimedBEAN`, `checkpointed`, `stakeDeposited`, `stakeWithdrawn`, `yieldClaimed`, `yieldCompounded`

**Components using `useSSE()`:**
| Component | Global Events | User Events |
|-----------|---------------|-------------|
| MiningGrid | `deployed`, `roundSettled`, `gameStarted` | `autoMineExecuted` |
| BeanpotCelebration | `roundTransition` | — |
| SidebarControls | — | `autoMineExecuted`, `configDeactivated`, `stopped` |
| MobileControls | — | `autoMineExecuted`, `configDeactivated`, `stopped` |
| UserDataProvider | — | `stakeDeposited`, `stakeWithdrawn`, `yieldCompounded`, `yieldClaimed`, `claimedBEAN`, `claimedETH` |
| StakePage | `yieldDistributed` | `stakeDeposited`, `stakeWithdrawn`, `yieldCompounded` |

### Shared User Data (`lib/UserDataContext.tsx`)

Centralized provider for user-specific data that multiple components need. Eliminates duplicate API calls and provides sessionStorage caching for instant render on page refresh.

**Provider:** `UserDataProvider` wraps the app with `userAddress` prop. Components consume via `useUserData()` hook.

**Data streams:**
| Data | API Endpoint | Consumers |
|------|-------------|-----------|
| `rewards` | `GET /api/user/:address/rewards` | ClaimRewards |
| `stakeInfo` | `GET /api/staking/:address` | StakePage |
| `profile` | `GET /api/user/:address/profile` (Express backend) | WalletButton |

**Lifecycle:**
1. On mount / address change: loads from sessionStorage (instant), then fetches fresh data from API
2. On wallet disconnect: clears all state
3. SSE events update state in-place (e.g. `claimedBEAN` zeros out pending BEAN rewards)
4. `settlementComplete` window event triggers rewards re-fetch
5. `patchProfile(patch)` — directly merges a `Partial<ProfileData>` into profile state and sessionStorage cache; called by ProfilePage after a successful save so WalletButton updates immediately without a re-fetch

**SessionStorage caching:** Address-scoped keys (`beans_rewards_{addr}`, `beans_stake_{addr}`, `beans_profile_{addr}`). Survives page refresh but not tab close. API responses are written to cache on success; on 429/network error, cached values are preserved.

### Round Timer (`lib/RoundTimerContext.tsx`)

Centralized countdown timer that calibrates against actual chain `block.timestamp` via RPC, replacing the previous `BLOCK_TIME_DRIFT_SECONDS` constant approach.

**How it works:**
1. Listens for `roundData` window events to get `endTime`
2. On new endTime: fetches latest block from RPC, computes `chainRemaining = endTime - blockTimestamp`
3. Anchors to wall clock: stores `{ wallTime, chainRemaining }` reference point
4. Tick (every 1s): `remaining = chainRemaining - (Date.now()/1000 - wallTime)` — drift-free countdown
5. Falls back to wall clock if RPC call fails

**Hook:** `useRoundTimer()` returns `{ timeRemaining, endTime, roundId }`

**Consumers:** SidebarControls, MobileControls, MobileStatsBar, CountdownCelebration

### Global Page (`/global`)

The `/global` page displays protocol-wide statistics and historical data. Components render after client mount to prevent Next.js SSR hydration mismatches.

**Components:**
| Component | Data Source | Status |
|-----------|-------------|--------|
| **GlobalStats** | `GET /api/stats`, `GET /api/treasury/stats` | ✅ Connected |
| **MiningTable** | `GET /api/rounds` | ✅ Connected |
| **RevenueTable** | `GET /api/treasury/buybacks` | ✅ Connected |
| **LeaderboardTable** | `GET /api/leaderboard/miners`, `GET /api/leaderboard/stakers`, `GET /api/leaderboard/earners` | ✅ Connected |

**Hydration Pattern:** Components using dynamic data (API fetches or `Math.random()`) must return `null` until after mount to prevent SSR/client mismatch:

```typescript
const [mounted, setMounted] = useState(false)

useEffect(() => {
    setMounted(true)
}, [])

// Early return before mount
if (!mounted) {
    return null
}
```

**MiningTable Data Flow:**
1. Fetches `GET /api/rounds?page=1&limit=12&settled=true` on mount
2. For "Beanpot" tab, adds `&beanpot=true` to filter rounds where `beanpotAmount > 0`
3. Transforms API response using `formatWei()` for amounts and `getRelativeTime()` for timestamps
4. Server-side pagination via `page` query param

**MiningTable Column Mapping:**
| Column | API Field | Transform |
|--------|-----------|-----------|
| Round | `roundId` | `#${roundId.toLocaleString()}` |
| Block | `winningBlock` | `#${winningBlock}` |
| BEAN Winner | `beanWinner`, `isSplit` | "Split" badge if `isSplit`, else truncated address |
| Winners | `winnerCount` | Direct display |
| Deployed | `totalDeployed` | `parseFloat(wei) / 1e18` |
| Vaulted | `vaultedAmount` | `parseFloat(wei) / 1e18` |
| Winnings | `totalWinnings` | `parseFloat(wei) / 1e18` |
| Beanpot | `beanpotAmount` | Format if > 0, else dash |
| Time | `settledAt` or `endTime` | Relative time string |

**RevenueTable Data Flow:**
1. Fetches `GET /api/treasury/buybacks?page=1&limit=12` on mount
2. Transforms API response using pre-formatted strings from backend
3. Server-side pagination via `page` query param

**RevenueTable Column Mapping:**
| Column | API Field | Transform |
|--------|-----------|-----------|
| Time | `timestamp` | `getRelativeTime()` → relative time string |
| Spent | `ethSpentFormatted` | `parseFloat()` → ETH amount |
| Burned | `beanBurnedFormatted` | `parseFloat()` → BEAN amount |
| Yield Generated | `beanToStakersFormatted` | `parseFloat()` → BEAN amount |

**LeaderboardTable Data Flow:**
1. Fetches all three endpoints in parallel on mount:
   - `GET /api/leaderboard/miners?period=all&limit=12` for Miners tab
   - `GET /api/leaderboard/stakers?limit=12` for Stakers tab
   - `GET /api/leaderboard/earners?limit=12` for Unroasted tab
2. Transforms API responses to `LeaderboardEntry` format with rank, truncated address, and value
3. Uses `useProfileResolver` hook to resolve addresses to usernames via batch profile lookup

**LeaderboardTable Column Mapping:**
| Tab | API Endpoint | Value Field | Icon |
|-----|--------------|-------------|------|
| Miners | `/api/leaderboard/miners` | `totalDeployedFormatted` | ETH |
| Stakers | `/api/leaderboard/stakers` | `stakedBalanceFormatted` | BEAN |
| Unroasted | `/api/leaderboard/earners` | `unclaimedFormatted` | BEAN |

**GlobalStats Data Flow:**
1. Fetches both endpoints in parallel on mount:
   - `GET /api/stats` for circulating supply (`totalSupplyFormatted`)
   - `GET /api/treasury/stats` for burned and protocol revenue
2. Max Supply is hardcoded (3,000,000 BEAN contract constant)

**GlobalStats Column Mapping:**
| Stat | Source | Field |
|------|--------|-------|
| Max Supply | Hardcoded | `3,000,000` |
| Circulating Supply | `/api/stats` | `totalSupplyFormatted` |
| Burned | `/api/treasury/stats` | `totalBurnedFormatted` |
| Protocol Revenue | `/api/treasury/stats` | `totalVaultedFormatted` |

---

## Backend API Reference

Backend located at `../Backend` (Express.js + MongoDB + ethers.js). Runs on **port 3001**.

### Global Stats

#### `GET /api/stats`
Global protocol statistics.
```json
{
  "totalSupply": "string",
  "totalSupplyFormatted": "string",
  "totalMinted": "string",
  "totalMintedFormatted": "string",
  "beanpotPool": "string",
  "beanpotPoolFormatted": "string",
  "prices": { "bean": { "usd": "string" }, "eth": { "usd": "string" } },
  "fetchedAt": "ISO date"
}
```

#### `GET /api/price`
BEAN token price from DexScreener.
```json
{
  "priceUsd": "string",
  "priceNative": "string",
  "volume24h": "string",
  "liquidity": "string",
  "priceChange24h": "string",
  "fdv": "string",
  "fetchedAt": "ISO date"
}
```

#### `GET /api/treasury/stats`
Treasury and buyback stats.
```json
{
  "vaultedETH": "string",
  "vaultedETHFormatted": "string",
  "totalBurned": "string",
  "totalBurnedFormatted": "string",
  "totalToStakers": "string",
  "totalToStakersFormatted": "string",
  "totalBuybacks": "string",
  "totalBuybacksFormatted": "string",
  "lastRefresh": "ISO date"
}
```

#### `GET /api/treasury/buybacks?page=1&limit=12`
Paginated list of buyback transactions. **Connected by RevenueTable.tsx**.
```json
{
  "buybacks": [
    {
      "ethSpent": "string",
      "ethSpentFormatted": "string",
      "beanReceived": "string",
      "beanReceivedFormatted": "string",
      "beanBurned": "string",
      "beanBurnedFormatted": "string",
      "beanToStakers": "string",
      "beanToStakersFormatted": "string",
      "txHash": "string",
      "blockNumber": 0,
      "timestamp": "ISO date"
    }
  ],
  "pagination": { "page": 1, "limit": 12, "total": 50, "pages": 5 }
}
```

### Round Data

#### `GET /api/round/current?user=0x...`
Current active round. Optional `user` query param adds user-specific deployment data.
```json
{
  "roundId": "string",
  "startTime": "number (unix)",
  "endTime": "number (unix)",
  "totalDeployed": "string",
  "totalDeployedFormatted": "string",
  "beanpotPool": "string",
  "beanpotPoolFormatted": "string",
  "settled": false,
  "blocks": [
    { "id": 0, "deployed": "string", "deployedFormatted": "string", "minerCount": 0 }
  ],
  "userDeployed": "string",
  "userDeployedFormatted": "string"
}
```

#### `GET /api/round/:id`
Historical round by ID. Returns full round document including settlement data (`winningBlock`, `topMiner`, `topMinerReward`, `beanpotAmount`, `isSplit`, `topMinerSeed`, `winnersDeployed`).

#### `GET /api/round/:id/miners`
Computed winning miners for a settled round. Calculates ETH rewards (proportional), BEAN rewards (split: proportional, non-split: weighted random replay using `topMinerSeed`), and beanpot bonus. Requires deployments stored with `blockNumber` + `logIndex` for correct ordering. **Connected by MinersPanel.tsx**.
```json
{
  "roundId": 0,
  "winningBlock": 0,
  "miners": [
    {
      "address": "string",
      "ethReward": "string", "ethRewardFormatted": "string",
      "beanReward": "string", "beanRewardFormatted": "string",
      "deployed": "string", "deployedFormatted": "string"
    }
  ]
}
```

#### `GET /api/rounds?page=1&limit=20&settled=true&beanpot=true`
Paginated list of rounds. Query params:
- `page` — Page number (1-indexed)
- `limit` — Results per page
- `settled=true` — Only return settled rounds
- `beanpot=true` — Only return rounds where beanpot was won (`beanpotAmount > 0`)

**Connected by MiningTable.tsx** for the Mining leaderboard on `/global` page.

```json
{
  "rounds": [
    {
      "roundId": 123,
      "winningBlock": 14,
      "beanWinner": "0x1234...5678",
      "isSplit": false,
      "winnerCount": 5,
      "totalDeployed": "1000000000000000000",
      "vaultedAmount": "100000000000000000",
      "totalWinnings": "890000000000000000",
      "beanpotAmount": "0",
      "settledAt": "2026-02-04T10:33:28.000Z",
      "endTime": "2026-02-04T10:33:22.000Z",
      "txHash": "0x1234...abcd"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 100, "pages": 5 }
}
```

### User Data

**Rate limit:** 5 req/min/IP on all user endpoints.

#### `GET /api/user/:address`
User balances and game stats.
```json
{
  "address": "string",
  "balances": {
    "bean": "string", "beanFormatted": "string",
    "bnb": "string", "bnbFormatted": "string"
  },
  "stats": {
    "roundsPlayed": 0,
    "wins": 0,
    "totalDeployed": "string"
  }
}
```

#### `GET /api/user/:address/rewards`
Pending claimable rewards. Calls `GridMining.getTotalPendingRewards(address)` which returns `(pendingETH, pendingUnroastedBEAN, pendingRoastedBEAN, uncheckpointedRound)`. Backend computes fee (10% of unroasted only) and net.
```json
{
  "pendingETH": "string",
  "pendingETHFormatted": "string",
  "pendingBEAN": {
    "unroasted": "string", "unroastedFormatted": "string",
    "roasted": "string", "roastedFormatted": "string",
    "gross": "string", "grossFormatted": "string",
    "fee": "string", "feeFormatted": "string",
    "net": "string", "netFormatted": "string"
  },
  "uncheckpointedRound": "string"
}
```

#### `GET /api/user/:address/history?page=1&limit=20&type=deploy|claim|all`
User deployment and claim history.
```json
{
  "history": [
    { "...document fields", "historyType": "deploy | claim" }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 50, "pages": 3 }
}
```

### Leaderboards

#### `GET /api/leaderboard/miners?period=24h|7d|30d|all&limit=20`
Top miners by total ETH deployed. **Connected by LeaderboardTable.tsx** (Miners tab).
```json
{
  "period": "all",
  "deployers": [
    {
      "address": "0x...",
      "totalDeployed": "5000000000000000000",
      "totalDeployedFormatted": "5.0",
      "roundsPlayed": 42
    }
  ]
}
```

#### `GET /api/leaderboard/stakers?limit=20`
Top stakers by total BEAN staked. **Connected by LeaderboardTable.tsx** (Stakers tab).
```json
{
  "stakers": [
    {
      "address": "0x...",
      "stakedBalance": "1000000000000000000",
      "stakedBalanceFormatted": "1.0"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 50, "pages": 3 }
}
```

#### `GET /api/leaderboard/earners?limit=20`
Top users by unclaimed BEAN (unroasted). **Connected by LeaderboardTable.tsx** (Unroasted tab).
```json
{
  "earners": [
    {
      "address": "0x...",
      "unclaimed": "500000000000000000",
      "unclaimedFormatted": "0.5"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 150, "pages": 8 }
}
```

### Staking

#### `GET /api/staking/stats`
Global staking statistics. Cached 60s on backend. **Connected by StakePage.tsx**.
```json
{
  "totalStaked": "string",
  "totalStakedFormatted": "string",
  "apr": "string",
  "tvlUsd": "string",
  "rewardRate": "string",
  "rewardRateFormatted": "string"
}
```

#### `GET /api/staking/:address`
User's staking position. Fresh RPC call (not cached). Rate limited (5/min). **Connected by StakePage.tsx**.
```json
{
  "balance": "string",
  "balanceFormatted": "string",
  "pendingRewards": "string",
  "pendingRewardsFormatted": "string",
  "compoundFeeReserve": "string",
  "compoundFeeReserveFormatted": "string",
  "canCompound": true
}
```

### AutoMiner

#### `GET /api/automine/:address`
User's AutoMiner configuration and state. Rate limited (5/min). **Connected by SidebarControls.tsx and MobileControls.tsx**.
```json
{
  "config": {
    "strategyId": 0,
    "numBlocks": 0,
    "numRounds": 0,
    "roundsExecuted": 0,
    "amountPerBlockFormatted": "string",
    "depositAmountFormatted": "string",
    "selectedBlockMask": 0,
    "selectedBlocks": [],
    "active": true
  },
  "costPerRoundFormatted": "string",
  "roundsRemaining": 0,
  "totalRefundableFormatted": "string"
}
```

### Agent Stats

#### `GET /api/agents/stats`
Aggregated stats for all mining agents. Cached 30s on backend (module-level cache). **Connected by agents/page.tsx (carousel)**.

Fetches per-agent: deploy history (last 50), rewards (RPC), ETH + BEAN balances (RPC), payout summary (MongoDB). Computes PnL, win rate, ROI, sparkline. All agents fetched in parallel server-side.
```json
{
  "agents": {
    "[agentId]": {
      "address": "string",
      "roundsPlayed": 0,
      "winRate": 0,
      "roi": 0,
      "totalDeployed": "string",
      "totalWon": "string",
      "ethPnl": 0,
      "beansEarned": 0,
      "beanValueEth": 0,
      "netPnl": 0,
      "beanPriceEth": 0,
      "totalBeanPaidOut": 0,
      "paidOutValueEth": 0,
      "lastActive": "string",
      "sparkline": [0, 0, 0, 0, 0, 0, 0, 0],
      "rounds": [
        {
          "roundId": 0,
          "deployed": "string",
          "ethWon": "string",
          "beanWon": "string",
          "pnl": 0,
          "isWin": false,
          "isBeanpot": false,
          "settled": true,
          "timestamp": "ISO date"
        }
      ]
    }
  },
  "cachedAt": "ISO date"
}
```

### Server-Sent Events (SSE)

#### `GET /api/events/rounds`
Global real-time event stream. Events:
- `gameStarted` — new round began (`{ roundId, startTime, endTime, beanpotPool, beanpotPoolFormatted }`)
- `deployed` — a user deployed ETH to blocks (`{ roundId, user, totalAmount, isAutoMine, totalDeployed, totalDeployedFormatted, userDeployed, userDeployedFormatted, blocks[] }`) — note: `userDeployed*` fields are for the deploying user, not the receiving client
- `roundSettled` — round completed with winner (`{ roundId, winningBlock, topMiner, totalWinnings, topMinerReward, beanpotAmount, isSplit }`)
- `roundTransition` — round transition event
- `yieldDistributed` — staking yield distributed from buyback (`{ amount, amountFormatted, timestamp }`)
- `heartbeat` — keep-alive every 30s

#### `GET /api/user/:address/events`
User-specific event stream. **Connected by ClaimRewards.tsx, SidebarControls.tsx, MobileControls.tsx, MiningGrid.tsx, and StakePage.tsx**.
- `claimedETH` — user claimed ETH rewards (`{ amount, txHash, timestamp }`)
- `claimedBEAN` — user claimed BEAN rewards (`{ gross, fee, net, txHash, timestamp }`)
- `checkpointed` — reward checkpoint processed
- `autoMineExecuted` — AutoMiner deployed on user's behalf (`{ roundId, blocks[], totalDeployed, fee, roundsExecuted }`)
- `configDeactivated` — AutoMiner completed all rounds (`{ roundsCompleted }`)
- `stopped` — AutoMiner manually stopped (`{ refundAmount, roundsCompleted }`)
- `stakeDeposited` — user deposited BEAN to staking (`{ amount, amountFormatted, txHash, timestamp }`)
- `stakeWithdrawn` — user withdrew BEAN from staking (`{ amount, amountFormatted, txHash, timestamp }`)
- `yieldClaimed` — user claimed staking yield (`{ amount, amountFormatted, txHash, timestamp }`)
- `yieldCompounded` — user compounded staking yield (`{ amount, amountFormatted, txHash, timestamp }`)
- `heartbeat` — keep-alive every 30s

### Health Check

#### `GET /health`
Returns service status for MongoDB, blockchain, and cache subsystems.

### Rate Limits

| Scope | Limit |
|-------|-------|
| Default (`/api/*`) | 60 req/min/IP |
| Strict (user, rewards, automine) | 5 req/min/IP |
| SSE connections | 10 per IP, 1000 total |
