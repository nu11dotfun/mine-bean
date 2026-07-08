// Daily BEAN and BTC closes aligned by date, for the indexed price-performance
// chart. BEAN from GeckoTerminal (same source as the price chart), BTC from Binance.

import { useEffect, useState } from 'react'

const POOL = '0xd7e5522c9cc3682c960afada6adde0f8116580f2ad2cef08c197faf625e53842'

export interface PricePoint { t: number; bean: number; btc: number }

let cache: PricePoint[] | null = null

export function usePriceVsBtc(): PricePoint[] | null {
  const [data, setData] = useState<PricePoint[] | null>(cache)
  useEffect(() => {
    if (cache) return
    let cancelled = false
    ;(async () => {
      try {
        const [gt, bn] = await Promise.all([
          fetch(`https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL}/ohlcv/day?aggregate=1&limit=250&currency=usd`).then((r) => r.json()),
          fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=250').then((r) => r.json()),
        ])
        if (cancelled) return
        const beanByDay = new Map<string, number>()
        const list: number[][] = gt?.data?.attributes?.ohlcv_list ?? []
        for (const x of list) beanByDay.set(new Date(x[0] * 1000).toISOString().slice(0, 10), x[4])
        const btcByDay = new Map<string, number>()
        if (Array.isArray(bn)) for (const k of bn) btcByDay.set(new Date(k[0]).toISOString().slice(0, 10), parseFloat(k[4]))
        const out: PricePoint[] = []
        for (const [day, bean] of [...beanByDay.entries()].sort()) {
          const btc = btcByDay.get(day)
          if (bean > 0 && btc && btc > 0) out.push({ t: new Date(day + 'T00:00:00Z').getTime(), bean, btc })
        }
        cache = out
        setData(out)
      } catch {
        /* leave null */
      }
    })()
    return () => { cancelled = true }
  }, [])
  return data
}
