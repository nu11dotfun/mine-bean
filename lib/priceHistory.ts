// BEAN price history for the /global price chart. Fetched straight from
// GeckoTerminal (CoinGecko's DEX data, coingecko id "minebean") for our BEAN/ETH
// Uniswap V4 pool. GeckoTerminal serves `access-control-allow-origin: *`, so the
// browser can call it directly (no key, no proxy), and each user hits it from
// their own IP. Cached per timeframe so switching back and forth is instant.

export interface Candle {
  t: number
  close: number
  volume: number
}

export type Timeframe = '1D' | '7D' | '1M' | '3M' | '1Y' | 'YTD' | 'ALL'
export const TIMEFRAMES: Timeframe[] = ['1D', '7D', '1M', '3M', '1Y', 'YTD', 'ALL']

const POOL = '0xd7e5522c9cc3682c960afada6adde0f8116580f2ad2cef08c197faf625e53842'
const OHLCV = `https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL}/ohlcv`

const MAP: Record<Timeframe, { tf: string; agg: number; limit: number }> = {
  '1D': { tf: 'hour', agg: 1, limit: 24 },
  '7D': { tf: 'hour', agg: 4, limit: 42 },
  '1M': { tf: 'day', agg: 1, limit: 30 },
  '3M': { tf: 'day', agg: 1, limit: 90 },
  '1Y': { tf: 'day', agg: 1, limit: 365 },
  'YTD': { tf: 'day', agg: 1, limit: 365 },
  'ALL': { tf: 'day', agg: 1, limit: 1000 },
}

const cache: Record<string, { data: Candle[]; at: number }> = {}
const TTL = 60_000

export async function fetchBeanPriceHistory(tf: Timeframe): Promise<Candle[] | null> {
  if (cache[tf] && Date.now() - cache[tf].at < TTL) return cache[tf].data
  const p = MAP[tf] ?? MAP['7D']
  try {
    const res = await fetch(`${OHLCV}/${p.tf}?aggregate=${p.agg}&limit=${p.limit}&currency=usd`)
    if (!res.ok) return null
    const json = await res.json()
    const list: number[][] = json?.data?.attributes?.ohlcv_list ?? []
    let candles: Candle[] = list
      .map((row) => ({ t: row[0] * 1000, close: Number(row[4]), volume: Number(row[5]) }))
      .filter((c) => isFinite(c.close) && c.close > 0)
      .sort((a, b) => a.t - b.t)
    if (tf === 'YTD') {
      const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime()
      candles = candles.filter((c) => c.t >= jan1)
    }
    cache[tf] = { data: candles, at: Date.now() }
    return candles
  } catch {
    return null
  }
}
