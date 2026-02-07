# BEANS Protocol — Frontend

## Overview

Gamified mining protocol on BNB Chain. Users compete in 60-second rounds on a 5×5 grid of blocks, deploying BNB to earn BEANS tokens and BNB rewards. Built with Next.js 14 (App Router), React 18, TypeScript, and Wagmi/RainbowKit for wallet integration.

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
  stake/page.tsx    — Staking interface
  layout.tsx        — Root layout with Web3Provider
  globals.css       — Global styles

components/
  Header.tsx          — Top nav with BNB/BEAN price feeds, wallet button
  BottomNav.tsx       — Mobile bottom navigation
  LandingPage.tsx     — Landing/intro screen with CTA
  MiningGrid.tsx      — 5×5 interactive block grid
  SidebarControls.tsx — Desktop mining controls (manual/auto modes)
  MobileControls.tsx  — Mobile mining controls
  ClaimRewards.tsx    — Rewards display + claim buttons (BNB, unrefined/refined BEAN)
  MinersPanel.tsx     — Winning miners sliding panel (BNB + BEAN rewards per round)
  MobileMiners.tsx    — Mobile miners panel
  MobileStatsBar.tsx  — Mobile stats bar
  GlobalStats.tsx     — Protocol metrics (supply, burned, revenue)
  MiningTable.tsx     — Mining history table
  RevenueTable.tsx    — Protocol revenue breakdown
  LeaderboardTable.tsx— Top miners/stakers leaderboard
  StakePage.tsx       — Staking deposit/withdraw interface
  WalletButton.tsx    — Wallet connection with balance display
  BeanLogo.tsx        — Logo SVG components
  AboutPage.tsx       — About content with expandable sections

lib/
  api.ts            — Backend API helpers (apiFetch). Base URL via NEXT_PUBLIC_API_URL env var (default http://localhost:3001)
  SSEContext.tsx    — Centralized SSE provider (useSSE hook for subscribeGlobal/subscribeUser)
  contracts.ts      — Contract addresses, ABIs, and constants (MIN_DEPLOY_PER_BLOCK, EXECUTOR_FEE_BPS)
  providers.tsx     — Web3Provider (Wagmi, RainbowKit, React Query, SSEProvider)
  wagmi.ts          — Chain config (BSC mainnet + testnet)
  abis/             — Contract ABI JSON files (GridMining, AutoMiner, Bean, Treasury, ERC20)
```

## Commands

```bash
npm run dev       # Development server
npm run build     # Production build
npm start         # Production server
npm run lint      # Linter
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
| BEANS Token | `0x000Ae314E2A2172a039B26378814C252734f556A` |
| Bean        | `0xBe4764ccE14B7BF478597AA00F5f6A5D42547925` |
| GridMining  | `0x103182b4E9E530ff2e0c69b0CC2a43EE7bb262`   |
| Treasury    | `0x0093DB20543d17F294F58432D08c4FA47C70dfe9` |
| AutoMiner   | `0x89286f7B9aFc0249CbB67fA661a9eB1039fe75dB` |
| BEAN/BNB LP | `0x7e58f160b5b77b8b24cd9900c09a3e730215ac47` |

**ABI source:** `lib/abis/GridMining.json` is extracted from Hardhat artifacts (`hardhat/artifacts/contracts/GridMining.sol/GridMining.json`). Includes `AlreadyDeployedThisRound` custom error, `ResetRequested` event, and `topMinerSeed`/`winnersDeployed` fields in `RoundSettled` event.

## Integration Status

### Connected to Backend + Smart Contract
- **app/page.tsx** — Orchestrates deploy and claim flows. Uses wagmi `useWriteContract` to call `GridMining.deploy(uint8[] blockIds)` payable, `GridMining.claimBNB()`, and `GridMining.claimBEAN()`. On deploy tx success, dispatches `userDeployed` window event for optimistic block tracking. Passes `onDeploy`, `onClaimBNB`, `onClaimBEAN` callbacks to child components.
- **MiningGrid.tsx** — Fetches `GET /api/round/current?user=` on mount (with wallet address when connected), uses `useSSE()` to subscribe to global events (`deployed`, `roundSettled`, `gameStarted`) and user events (`autoMineExecuted`). Dispatches `roundData`, `roundDeployed`, and `roundSettled` window events. Tracks `userDeployedBlocks` (blocks user already deployed to this round) via `GET /api/user/:address/history?type=deploy&roundId=X` on load and optimistic `userDeployed` events. Deployed blocks are visually marked (green border + ✓) and unclickable. **One deploy per round:** `hasDeployedThisRound` boolean locks ALL grid blocks after the first deploy — set `true` on `userDeployed` event or when backend history shows existing deploys, reset to `false` in `resetForNewRound()`. The `selectAllBlocks` listener is also ignored when `hasDeployedThisRound` is true. **AutoMiner grid lock:** When in auto mode (`autoMode.enabled`), all grid cells are disabled to prevent manual selection.
- **SidebarControls.tsx** — Receives round data (beanpot, timer, round number, total deployed, user deployed) via `roundData`/`roundDeployed`/`roundSettled` window events from MiningGrid. Uses `useSSE()` to subscribe to user events (`autoMineExecuted`, `configDeactivated`, `stopped`) for AutoMiner real-time updates. Fetches BNB and BEAN prices from `GET /api/stats` every 30s. Phase (counting/eliminating/winner) driven by backend events, not a local timer. Deploy button enabled only when `canDeploy` (perBlock >= MIN_DEPLOY_PER_BLOCK, blocks > 0, timer > 0, phase === "counting", `userDeployed === 0`). When `hasDeployed` (userDeployed > 0), button shows "✓ Deployed" and is disabled. **Input is per-block amount** — total is calculated as `perBlock × selectedBlocks`.
- **MobileControls.tsx** — Same as SidebarControls but mobile layout. Uses `useSSE()` for user event subscriptions. Phase-aware deploy button with same `canDeploy` logic. Tracks `userDeployed` via `roundData` and `roundDeployed` window events (matches `user` field against connected `userAddress` prop). Shows "✓ Deployed" when locked.
- **MobileStatsBar.tsx** — Receives beanpot, timer, total deployed, and user deployed via `roundData`/`roundDeployed` window events.
- **ClaimRewards.tsx** — Fetches `GET /api/user/:address/rewards` on mount. Re-fetches on `settlementComplete` window event (after 8s animation). Uses `useSSE()` to subscribe to `claimedBNB`/`claimedBEAN` events to refresh after on-chain claim. Shows BNB rewards, unrefined BEAN, refined BEAN separately. Conditionally rendered — hidden when all rewards are zero. Claim buttons call `GridMining.claimBNB()` and `GridMining.claimBEAN()` via wagmi `useWriteContract`.
- **MinersPanel.tsx** — Sliding left panel showing winning miners from the last settled round. Listens to `roundSettled` window event to capture the settled roundId (stored in a ref), then on `settlementComplete` (after 8s animation) fetches `GET /api/round/:id/miners` to get computed BNB and BEAN rewards per winner. Uses a consume-once ref pattern: `settledRoundIdRef` is set by `roundSettled` and cleared after consumption by `settlementComplete`, so empty rounds (no `roundSettled` event) don't re-trigger old data. Panel auto-opens when winners data arrives; collapsed state shows a trophy icon tab on the left edge. If the round had no deployments (empty miners response), keeps showing the previous round's data without re-opening.
- **app/page.tsx** — Also handles AutoMiner contract interactions via `handleAutoActivate` (calls `AutoMiner.setConfig` payable) and `handleAutoStop` (calls `AutoMiner.stop`). Dispatches `autoMinerActivated`/`autoMinerStopped` window events on success.
- **SidebarControls.tsx / MobileControls.tsx** — Support both Manual and Auto mining modes. Auto mode: fetches `GET /api/automine/:address` on mount, uses `useSSE()` to subscribe to `autoMineExecuted`/`configDeactivated`/`stopped` events for real-time updates. When AutoMiner is active, hides Manual tab and shows active status (balance, strategy, rounds executed/total, per block/round). Configure view validates per-block amount against `MIN_DEPLOY_PER_BLOCK` accounting for `EXECUTOR_FEE_BPS` (0.5%). Calls `onAutoActivate`/`onAutoStop` props from page.tsx.
- **MiningGrid.tsx** — Also uses `useSSE()` to subscribe to `autoMineExecuted` to highlight deployed blocks green. Additionally handles AutoMiner deployments in the global `deployed` SSE handler: when `isAutoMine === true` and user matches, fetches deployment history and decodes `blockMask` to mark deployed blocks.
- **MiningTable.tsx** — Fetches `GET /api/rounds?page=N&limit=12&settled=true` on mount. Supports two tabs: "Rounds" (all settled rounds) and "Beanpot" (rounds where motherlode was won, via `&beanpot=true`). Server-side pagination. Displays: Round ID, winning block, BEAN winner (address or "Split" badge based on `isSplit`), winner count, BNB deployed/vaulted/winnings, beanpot amount (or dash if 0), relative time.
- **RevenueTable.tsx** — Fetches `GET /api/treasury/buybacks?page=N&limit=12` on mount. Server-side pagination. Displays buyback transactions: Time (relative), BNB Spent, BEAN Burned, Yield Generated (BEAN to stakers). No tabs — only Buybacks view.
- **LeaderboardTable.tsx** — Fetches `GET /api/leaderboard/miners?period=all&limit=12` and `GET /api/leaderboard/earners?limit=12` on mount. Three tabs: Miners (total BNB deployed), Stakers (coming soon - empty state), Unrefined (unclaimed BEAN). Displays: Rank, Address (truncated), Value with icon (BNB or BEAN).
- **GlobalStats.tsx** — Fetches `GET /api/stats` and `GET /api/treasury/stats` on mount. Displays: Max Supply (hardcoded 3M), Circulating Supply (`totalMintedFormatted`), Burned (`totalBurnedFormatted`), Protocol Revenue (`totalVaultedFormatted`).

### Still Using Mock/Hardcoded Data
- **Header.tsx** — Price feeds from Binance/DexScreener directly.
- **MobileMiners.tsx** — Hardcoded miner list (not yet connected to `/api/round/:id/miners`).
- **StakePage.tsx** — Mock staking data.
- **WalletButton.tsx** — Wallet connection functional, balance reads via wagmi.

### Not Yet Connected
- Smart contract write interactions for staking
- User data endpoints (profile)

## Architecture Notes

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
| `roundData` | MiningGrid | SidebarControls, MobileControls, MobileStatsBar | Full round metadata: `{ roundId, startTime, endTime, motherlodePoolFormatted, totalDeployedFormatted, userDeployedFormatted, ... }` |
| `roundDeployed` | MiningGrid | SidebarControls, MobileControls, MobileStatsBar | Live deployment update: `{ totalDeployed, totalDeployedFormatted, user, userDeployedFormatted }` |
| `roundSettled` | MiningGrid | SidebarControls, MobileControls, MinersPanel | Settlement data: `{ roundId, winningBlock, topMiner, totalWinnings, ... }` |
| `blocksChanged` | MiningGrid | SidebarControls, MobileControls | `{ blocks: number[], count: number }` |
| `selectAllBlocks` | SidebarControls, MobileControls | MiningGrid | `{ selectAll: boolean }` |
| `userDeployed` | app/page.tsx (on tx success) | MiningGrid | `{ blockIds: number[] }` — optimistically marks blocks as deployed |
| `settlementComplete` | MiningGrid | ClaimRewards, MinersPanel | No payload — signals that the 8s settlement animation finished and grid has reset |

### MinersPanel Off-Chain Reward Calculation

The `GET /api/round/:id/miners` endpoint computes per-winner rewards entirely off-chain from MongoDB data:

1. **Filter winners:** Query deployments for the round, filter by `blockMask & (1 << winningBlock) !== 0`
2. **BNB rewards:** `(totalWinnings × userDeployed) / totalWinnersDeployed` — proportional for all rounds
3. **BEAN rewards (split, `isSplit=true`):** `(topMinerReward × userDeployed) / totalWinnersDeployed`
4. **BEAN rewards (non-split, `isSplit=false`):** Weighted random replay:
   - `sample = topMinerSeed % winnersDeployed`
   - Replay deployments to winning block in `blockNumber + logIndex` order
   - Each adds `amountPerBlock` to cumulative; first to exceed `sample` is BEAN winner
   - Winner gets full `topMinerReward`; others get 0 BEAN
5. **Motherlode:** `(motherlodeAmount × userDeployed) / totalWinnersDeployed` — added to all winners

`topMinerSeed` and `winnersDeployed` are emitted in the `RoundSettled` contract event and stored in the Round model. Deployment ordering relies on `blockNumber` + `logIndex` fields stored in the Deployment model (populated from QuickNode stream filter).

### One Deploy Per Round

The GridMining contract enforces one deploy per round per user — calling `deploy()` a second time in the same round reverts with `AlreadyDeployedThisRound`. The frontend mirrors this constraint:

1. **MiningGrid** — `hasDeployedThisRound` state (boolean). Set `true` when `userDeployed` window event fires (optimistic, on tx success) or when backend history shows `userDeployedBlocks.size > 0`. All grid cells become `disabled` when true. `selectAllBlocks` events are ignored. On `userDeployed`, selected blocks are cleared and `blocksChanged` is dispatched with empty blocks. Reset to `false` in `resetForNewRound()`.

2. **SidebarControls** — `hasDeployed` derived from `userDeployed > 0` (tracked via `roundData` and `roundDeployed` events). Added to `canDeploy` as `!hasDeployed`. Button text changes to "✓ Deployed" when locked.

3. **MobileControls** — Same `hasDeployed` / `canDeploy` logic. Tracks `userDeployed` state via `roundData` (initial load) and `roundDeployed` (live SSE updates, matched against connected `userAddress` prop). Reset to 0 on `roundSettled`.

**Lifecycle:** User connects → loads round → backend returns `userDeployedFormatted` → if non-zero, grid and buttons are locked. User deploys → `userDeployed` event fires → grid locks immediately (optimistic). New round starts → `resetForNewRound()` clears `hasDeployedThisRound`, controls reset `userDeployed` to 0 on `roundSettled`.

### AutoMiner Integration

The AutoMiner contract uses a single payable `setConfig(strategyId, numRounds, numBlocks)` to deposit BNB and configure in one transaction, and `stop()` to deactivate and refund remaining BNB.

**Frontend constants in `lib/contracts.ts`:**
- `MIN_DEPLOY_PER_BLOCK = 0.00001` — minimum BNB per block
- `EXECUTOR_FEE_BPS = 50` — 0.5% executor fee deducted from deposits

**Fee-adjusted validation:** Frontend mirrors contract formula to validate per-block amount:
```typescript
const effectiveAmountPerBlock = (deposit × 10000) / (numBlocks × numRounds × (10000 + EXECUTOR_FEE_BPS))
```

**UI States:**
1. **Manual mode** — Normal block selection and deploy flow
2. **Auto Configure** — Input BNB deposit, strategy (All/Random), blocks (if random), rounds. Shows calculated per-block and per-round amounts.
3. **Auto Active** — When `autoMinerState.active === true`. Hides Manual tab, shows status: balance (refundable), strategy, rounds executed/total, per block. Stop button triggers refund.

**Real-time updates via `useSSE()`:**
- SidebarControls/MobileControls use `subscribeUser()` for `autoMineExecuted`, `configDeactivated`, `stopped` events
- On any event, re-fetches `GET /api/automine/:address` to update display
- On `configDeactivated`, switches back to manual mode

**Grid highlighting for AutoMiner:**
- MiningGrid uses `subscribeUser('autoMineExecuted')` to add deployed blocks to `userDeployedBlocks` Set
- Also handles AutoMiner in global `deployed` SSE (via `subscribeGlobal`): when `isAutoMine === true` and user matches, fetches `/api/user/:address/history?type=deploy&roundId=X&limit=1`, decodes `blockMask`, and updates `userDeployedBlocks`
- This dual approach handles the race condition where user SSE may not be connected for the first round

**Grid lock in AutoMiner mode:**
- When `autoMode.enabled === true`, all grid cell clicks are disabled
- Prevents users from manually selecting/deselecting blocks while AutoMiner is active

**Window events:**
| Event | Dispatched By | Consumed By |
|-------|--------------|-------------|
| `autoMinerActivated` | page.tsx (setConfig success) | SidebarControls, MobileControls |
| `autoMinerStopped` | page.tsx (stop success) | SidebarControls, MobileControls |

### `lib/api.ts` Helpers

- **`apiFetch<T>(path)`** — Typed GET request to backend. Base URL from `NEXT_PUBLIC_API_URL` env var (default `http://localhost:3001`).

### Centralized SSE Architecture (`lib/SSEContext.tsx`)

The app uses a centralized SSE provider to maintain exactly **2 connections** per browser session (1 global + 1 user) instead of per-component connections that caused connection stacking and 429 rate limit errors.

**Provider setup in `lib/providers.tsx`:**
```tsx
function SSEWrapper({ children }: { children: React.ReactNode }) {
  const { address } = useAccount()
  return <SSEProvider userAddress={address}>{children}</SSEProvider>
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
  const unsub = subscribeUser('claimedBNB', (data) => { ... })
  return () => unsub()
}, [subscribeUser])
```

**Connection lifecycle:**
- **Global connection** (`/api/events/rounds`) — Opens on app mount, never closes. Listens for: `gameStarted`, `deployed`, `roundSettled`
- **User connection** (`/api/user/{address}/events`) — Opens when wallet connects, closes on disconnect. Listens for: `autoMineExecuted`, `configDeactivated`, `stopped`, `claimedBNB`, `claimedBEAN`, `checkpointed`

**Components using `useSSE()`:**
| Component | Global Events | User Events |
|-----------|---------------|-------------|
| MiningGrid | `deployed`, `roundSettled`, `gameStarted` | `autoMineExecuted` |
| SidebarControls | — | `autoMineExecuted`, `configDeactivated`, `stopped` |
| MobileControls | — | `autoMineExecuted`, `configDeactivated`, `stopped` |
| ClaimRewards | — | `claimedBNB`, `claimedBEAN` |

### Global Page (`/global`)

The `/global` page displays protocol-wide statistics and historical data. Components render after client mount to prevent Next.js SSR hydration mismatches.

**Components:**
| Component | Data Source | Status |
|-----------|-------------|--------|
| **GlobalStats** | `GET /api/stats`, `GET /api/treasury/stats` | ✅ Connected |
| **MiningTable** | `GET /api/rounds` | ✅ Connected |
| **RevenueTable** | `GET /api/treasury/buybacks` | ✅ Connected |
| **LeaderboardTable** | `GET /api/leaderboard/miners`, `GET /api/leaderboard/earners` | ✅ Connected (Stakers tab pending) |

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
2. For "Beanpot" tab, adds `&beanpot=true` to filter rounds where `motherlodeAmount > 0`
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
| Beanpot | `motherlodeAmount` | Format if > 0, else dash |
| Time | `settledAt` or `endTime` | Relative time string |

**RevenueTable Data Flow:**
1. Fetches `GET /api/treasury/buybacks?page=1&limit=12` on mount
2. Transforms API response using pre-formatted strings from backend
3. Server-side pagination via `page` query param

**RevenueTable Column Mapping:**
| Column | API Field | Transform |
|--------|-----------|-----------|
| Time | `timestamp` | `getRelativeTime()` → relative time string |
| Spent | `bnbSpentFormatted` | `parseFloat()` → BNB amount |
| Burned | `beanBurnedFormatted` | `parseFloat()` → BEAN amount |
| Yield Generated | `beanToStakersFormatted` | `parseFloat()` → BEAN amount |

**LeaderboardTable Data Flow:**
1. Fetches both endpoints in parallel on mount:
   - `GET /api/leaderboard/miners?period=all&limit=12` for Miners tab
   - `GET /api/leaderboard/earners?limit=12` for Unrefined tab
2. Transforms API responses to `LeaderboardEntry` format with rank, truncated address, and value
3. Stakers tab shows "Coming soon" empty state (no staking contract yet)

**LeaderboardTable Column Mapping:**
| Tab | API Endpoint | Value Field | Icon |
|-----|--------------|-------------|------|
| Miners | `/api/leaderboard/miners` | `totalDeployedFormatted` | BNB |
| Stakers | N/A (coming soon) | - | BEAN |
| Unrefined | `/api/leaderboard/earners` | `unclaimedFormatted` | BEAN |

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
  "motherlodePool": "string",
  "motherlodePoolFormatted": "string",
  "prices": { "bean": { "usd": "string" }, "bnb": { "usd": "string" } },
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
  "vaultedBNB": "string",
  "vaultedBNBFormatted": "string",
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
      "bnbSpent": "string",
      "bnbSpentFormatted": "string",
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
  "motherlodePool": "string",
  "motherlodePoolFormatted": "string",
  "settled": false,
  "blocks": [
    { "id": 0, "deployed": "string", "deployedFormatted": "string", "minerCount": 0 }
  ],
  "userDeployed": "string",
  "userDeployedFormatted": "string"
}
```

#### `GET /api/round/:id`
Historical round by ID. Returns full round document including settlement data (`winningBlock`, `topMiner`, `topMinerReward`, `motherlodeAmount`, `isSplit`, `topMinerSeed`, `winnersDeployed`).

#### `GET /api/round/:id/miners`
Computed winning miners for a settled round. Calculates BNB rewards (proportional), BEAN rewards (split: proportional, non-split: weighted random replay using `topMinerSeed`), and motherlode bonus. Requires deployments stored with `blockNumber` + `logIndex` for correct ordering. **Connected by MinersPanel.tsx**.
```json
{
  "roundId": 0,
  "winningBlock": 0,
  "miners": [
    {
      "address": "string",
      "bnbReward": "string", "bnbRewardFormatted": "string",
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
- `beanpot=true` — Only return rounds where motherlode was won (`motherlodeAmount > 0`)

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
      "motherlodeAmount": "0",
      "settledAt": "2026-02-04T10:33:28.000Z",
      "endTime": "2026-02-04T10:33:22.000Z"
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
Pending claimable rewards. Calls `GridMining.getTotalPendingRewards(address)` which returns `(pendingBNB, pendingUnrefinedBEAN, pendingRefinedBEAN, uncheckpointedRound)`. Backend computes fee (10% of unrefined only) and net.
```json
{
  "pendingBNB": "string",
  "pendingBNBFormatted": "string",
  "pendingBEAN": {
    "unrefined": "string", "unrefinedFormatted": "string",
    "refined": "string", "refinedFormatted": "string",
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
Top miners by total BNB deployed. **Connected by LeaderboardTable.tsx** (Miners tab).
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

#### `GET /api/leaderboard/earners?limit=20`
Top users by unclaimed BEAN (unrefined). **Connected by LeaderboardTable.tsx** (Unrefined tab).
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
    "active": true
  },
  "costPerRoundFormatted": "string",
  "roundsRemaining": 0,
  "totalRefundableFormatted": "string"
}
```

### Server-Sent Events (SSE)

#### `GET /api/events/rounds`
Global real-time event stream. Events:
- `gameStarted` — new round began (`{ roundId, startTime, endTime, motherlodePool, motherlodePoolFormatted }`)
- `deployed` — a user deployed BNB to blocks (`{ roundId, user, totalAmount, isAutoMine, totalDeployed, totalDeployedFormatted, userDeployed, userDeployedFormatted, blocks[] }`) — note: `userDeployed*` fields are for the deploying user, not the receiving client
- `roundSettled` — round completed with winner (`{ roundId, winningBlock, topMiner, totalWinnings, topMinerReward, motherlodeAmount, isSplit }`)
- `heartbeat` — keep-alive every 30s

#### `GET /api/user/:address/events`
User-specific event stream. **Connected by ClaimRewards.tsx, SidebarControls.tsx, MobileControls.tsx, and MiningGrid.tsx**.
- `claimedBNB` — user claimed BNB rewards (`{ amount, txHash, timestamp }`)
- `claimedBEAN` — user claimed BEAN rewards (`{ gross, fee, net, txHash, timestamp }`)
- `checkpointed` — reward checkpoint processed
- `autoMineExecuted` — AutoMiner deployed on user's behalf (`{ roundId, blocks[], totalDeployed, fee, roundsExecuted }`)
- `configDeactivated` — AutoMiner completed all rounds (`{ roundsCompleted }`)
- `stopped` — AutoMiner manually stopped (`{ refundAmount, roundsCompleted }`)
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
