// Sum of yield distributed to stakers over the most recent 7 days in the Dune
// staking-metrics series (BEAN), used to compute a 7-day rolling APR:
//   apr = (7d yield / total staked) * (365 / 7) * 100

import { useEffect, useState } from 'react'
import { fetchDune } from './duneData'

let cache: number | null = null

export function useStaking7dYield(): number | null {
  const [yield7d, setYield7d] = useState<number | null>(cache)
  useEffect(() => {
    let cancelled = false
    fetchDune<{ date: string; yield_bean?: number | string }>('staking-metrics').then((r) => {
      if (cancelled || !r) return
      const n = (v: unknown) => (typeof v === 'string' ? parseFloat(v) : (v as number)) || 0
      const rows = [...r.rows].sort((a, b) => (a.date < b.date ? -1 : 1))
      cache = rows.slice(-7).reduce((a, x) => a + n(x.yield_bean), 0)
      setYield7d(cache)
    })
    return () => { cancelled = true }
  }, [])
  return yield7d
}
