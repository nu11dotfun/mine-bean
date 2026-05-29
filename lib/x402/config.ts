// MineBean x402 paid mining — client-side config.
//
// Architecture note (May 2026):
// The x402 paid endpoint is owned and hosted by the dev at
//   POST https://api.minebean.com/api/strategy/decide
// We act purely as the client (browser → dev's endpoint via x402-fetch).
//
// Everything that used to live here for our own Next.js paywall (receiver
// wallet allow-list, x402-next middleware config, module-load guards) has
// moved server-side to dev's express integration. This file now only holds:
//   - the dev endpoint URL (overridable for local/staging)
//   - the strategy id whitelist for type-safe params

// Endpoint dev hosts the x402 paywall at. Hardcoded for production to
// neutralize the risk of a malicious env var redirecting paid calls to an
// attacker host. The override is honored ONLY in development builds so we
// can still point at a local strategy mock during testing.
const PRODUCTION_STRATEGY_API_URL = 'https://api.minebean.com/api/strategy/decide'
export const STRATEGY_API_URL =
  process.env.NODE_ENV !== 'production'
    ? (process.env.NEXT_PUBLIC_X402_STRATEGY_API_URL || PRODUCTION_STRATEGY_API_URL)
    : PRODUCTION_STRATEGY_API_URL

// Strategy ids exposed via the x402 endpoint. Beanpot Hunter is intentionally
// NOT exposed (its decision is trivial from a free on-chain read — paying for
// it provides no value).
export const VALID_STRATEGIES = [
  'nostradamus',
  'anti-winner',
  'anti-loser',
  'sniper',
] as const
export type StrategyId = (typeof VALID_STRATEGIES)[number]
