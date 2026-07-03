// Cumulative buyback totals from the Dune buyback-history query (same data the
// daily-buyback chart uses), for the Buyback & Burn hero cards.

import { useEffect, useState } from 'react'
import { fetchDune } from './duneData'

export interface BuybackTotals {
  beanBought: number
  usdSpent: number
}

let cache: BuybackTotals | null = null

export function useBuybackTotals(): BuybackTotals | null {
  const [totals, setTotals] = useState<BuybackTotals | null>(cache)
  useEffect(() => {
    let cancelled = false
    fetchDune<{ bean_bought?: number | string; usd_spent?: number | string }>('buyback-history').then((r) => {
      if (cancelled || !r) return
      const n = (v: unknown) => (typeof v === 'string' ? parseFloat(v) : (v as number)) || 0
      const beanBought = r.rows.reduce((a, x) => a + n(x.bean_bought), 0)
      const usdSpent = r.rows.reduce((a, x) => a + n(x.usd_spent), 0)
      cache = { beanBought, usdSpent }
      setTotals(cache)
    })
    return () => { cancelled = true }
  }, [])
  return totals
}
