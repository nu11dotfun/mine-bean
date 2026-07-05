// Beanpot aggregates from the Dune beanpot-history query, for the Beanpot hero
// cards. The beanpot pays out in BEAN (the query's beanpot_eth / beanpot_usd are
// ETH-derived and wrong, so they are ignored). "Biggest" is the most valuable
// single beanpot, BEAN valued at BEAN's price on that date (GeckoTerminal daily,
// the same source the price chart uses).

import { useEffect, useState } from 'react'
import { fetchDune } from './duneData'

const POOL = '0xd7e5522c9cc3682c960afada6adde0f8116580f2ad2cef08c197faf625e53842'

export interface BeanpotTotals {
  count: number
  totalBean: number
  biggestBean: number // BEAN of the most valuable beanpot
  biggestUsd: number // its USD value at the time
  avgParticipants: number
}

let cache: BeanpotTotals | null = null

async function fetchBeanPricesByDay(): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const r = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL}/ohlcv/day?aggregate=1&limit=250&currency=usd`,
    )
    const d = await r.json()
    const list: number[][] = d?.data?.attributes?.ohlcv_list ?? []
    for (const x of list) map.set(new Date(x[0] * 1000).toISOString().slice(0, 10), x[4])
  } catch {
    /* leave empty; biggestUsd stays 0 */
  }
  return map
}

export function useBeanpotTotals(): BeanpotTotals | null {
  const [totals, setTotals] = useState<BeanpotTotals | null>(cache)
  useEffect(() => {
    if (cache) return
    let cancelled = false
    ;(async () => {
      const [r, prices] = await Promise.all([
        fetchDune<{ beanpot_bean?: number | string; participants?: number | string; date?: string }>('beanpot-history'),
        fetchBeanPricesByDay(),
      ])
      if (cancelled || !r) return
      const fin = (v: unknown) => {
        const n = typeof v === 'string' ? parseFloat(v) : (v as number)
        return typeof n === 'number' && isFinite(n) ? n : 0
      }
      let totalBean = 0
      let biggestBean = 0
      let biggestUsd = 0
      let participants = 0
      for (const x of r.rows) {
        const b = fin(x.beanpot_bean)
        totalBean += b
        participants += fin(x.participants)
        const p = prices.get(String(x.date).slice(0, 10))
        const usd = p ? b * p : 0
        if (usd > biggestUsd) {
          biggestUsd = usd
          biggestBean = b
        }
      }
      cache = {
        count: r.rows.length,
        totalBean,
        biggestBean,
        biggestUsd,
        avgParticipants: r.rows.length ? participants / r.rows.length : 0,
      }
      setTotals(cache)
    })()
    return () => { cancelled = true }
  }, [])
  return totals
}
