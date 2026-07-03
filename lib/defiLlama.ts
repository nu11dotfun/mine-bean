// Protocol revenue from DefiLlama (MineBean is listed, id 7486, slug "minebean",
// category "Gamified Mining"). DefiLlama's fees adapter is the ecosystem-standard
// figure analysts see, so we use it for the Financials revenue cards. The API
// serves `access-control-allow-origin: *`, so the browser fetches it directly.
//
// Note: DefiLlama tracks fees/revenue and TVL only — it does NOT expose our
// deployment volume (no dex adapter), so "protocol volume" still needs a backend
// total-deployed rollup.

import { useEffect, useState } from 'react'

export interface LlamaRevenue {
  allTimeUsd: number
  last30dUsd: number
  last7dUsd: number
  last24hUsd: number
  daily: { t: number; usd: number }[]
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return typeof n === 'number' && isFinite(n) ? n : 0
}

let cache: { data: LlamaRevenue; at: number } | null = null
const TTL = 5 * 60_000

export async function fetchLlamaRevenue(): Promise<LlamaRevenue | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.data
  try {
    const res = await fetch('https://api.llama.fi/summary/fees/minebean?dataType=dailyRevenue')
    if (!res.ok) return null
    const j = await res.json()
    const daily = (Array.isArray(j.totalDataChart) ? j.totalDataChart : [])
      .map((row: [number, number]) => ({ t: row[0] * 1000, usd: num(row[1]) }))
      .filter((p: { usd: number }) => isFinite(p.usd))
    const data: LlamaRevenue = {
      allTimeUsd: num(j.totalAllTime),
      last30dUsd: num(j.total30d),
      last7dUsd: num(j.total7d),
      last24hUsd: num(j.total24h),
      daily,
    }
    cache = { data, at: Date.now() }
    return data
  } catch {
    return null
  }
}

export function useLlamaRevenue(): LlamaRevenue | null {
  const [rev, setRev] = useState<LlamaRevenue | null>(cache?.data ?? null)
  useEffect(() => {
    let cancelled = false
    fetchLlamaRevenue().then((r) => {
      if (!cancelled && r) setRev(r)
    })
    return () => { cancelled = true }
  }, [])
  return rev
}
