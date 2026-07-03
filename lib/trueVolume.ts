// True time-weighted USD volume: each day's ETH deployed valued at THAT day's
// ETH price, instead of all-time ETH x today's price. ETH has fallen since much
// of the volume was deployed, so the current-price method understates it.
// Sources: Dune mining-volume (daily ETH deployed) x Binance daily ETH close.

import { useEffect, useState } from 'react'
import { fetchDune } from './duneData'

let cache: number | null = null

export function useTrueVolume(): number | null {
  const [vol, setVol] = useState<number | null>(cache)
  useEffect(() => {
    if (cache != null) return
    let cancelled = false
    ;(async () => {
      try {
        const [dune, klines] = await Promise.all([
          fetchDune<{ day: string; total_eth_deployed?: number | string }>('mining-volume'),
          fetch('https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=400').then((r) => r.json()),
        ])
        if (cancelled || !dune) return
        // UTC date (YYYY-MM-DD) -> that day's ETH close price
        const priceByDay = new Map<string, number>()
        if (Array.isArray(klines)) {
          for (const k of klines) priceByDay.set(new Date(k[0]).toISOString().slice(0, 10), parseFloat(k[4]))
        }
        const n = (v: unknown) => (typeof v === 'string' ? parseFloat(v) : (v as number)) || 0
        let total = 0
        for (const row of dune.rows) {
          const price = priceByDay.get(String(row.day).slice(0, 10))
          if (price) total += n(row.total_eth_deployed) * price
        }
        if (!cancelled && total > 0) {
          cache = total
          setVol(total)
        }
      } catch {
        /* leave null; the card falls back to the current-price figure */
      }
    })()
    return () => { cancelled = true }
  }, [])
  return vol
}
