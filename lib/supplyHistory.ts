// Supply dynamics from the two Dune queries we already have: daily + cumulative
// mint (mining-rewards) and daily burn (buyback-history). These cover mining mint
// and buyback burn; the genesis mint (team-locked 33K + initial liquidity) isn't in
// them, so LEVEL charts anchor to the live circulating figure and let mint-burn drive
// the shape, while FLOW charts (daily mint/burn) use the raw daily numbers directly.

import { useEffect, useState } from 'react'

export interface SupplyDay {
  t: number
  dailyMint: number
  dailyBurn: number
  cumMint: number
  cumBurn: number
  netFlow: number // cumMint - cumBurn
}

// Team-locked wallet 0xe261B366f231B12FCB58D6BbD71e57fAEE82431D, balance verified
// on-chain (33,000 BEAN); on-chain supply - locked reconciles to DexScreener circulating.
export const LOCKED_SUPPLY = 33000

let cache: SupplyDay[] | null = null

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(x) ? x : 0
}
const dayKey = (s: unknown) => String(s).slice(0, 10)

export function useSupplyHistory(): SupplyDay[] | null {
  const [data, setData] = useState<SupplyDay[] | null>(cache)
  useEffect(() => {
    if (cache) return
    let cancelled = false
    ;(async () => {
      try {
        const [mrRes, bbRes] = await Promise.all([
          fetch('/api/dune?q=mining-rewards').then((r) => r.json()),
          fetch('/api/dune?q=buyback-history').then((r) => r.json()),
        ])
        if (cancelled) return
        const mr: Record<string, unknown>[] = mrRes?.rows ?? []
        const bb: Record<string, unknown>[] = bbRes?.rows ?? []

        const mintDaily = new Map<string, number>()
        const mintCum = new Map<string, number>()
        for (const r of mr) {
          const k = dayKey(r.date)
          mintDaily.set(k, n(r.bean_allocated))
          mintCum.set(k, n(r.total_bean))
        }
        const burnDaily = new Map<string, number>()
        for (const r of bb) {
          const k = dayKey(r.date)
          burnDaily.set(k, (burnDaily.get(k) ?? 0) + n(r.bean_burnt))
        }

        const days = [...new Set([...mintCum.keys(), ...burnDaily.keys()])].sort()
        let cumBurn = 0
        let lastCumMint = 0
        const out: SupplyDay[] = []
        for (const k of days) {
          const dm = mintDaily.get(k) ?? 0
          const db = burnDaily.get(k) ?? 0
          cumBurn += db
          const cm = mintCum.has(k) ? mintCum.get(k)! : lastCumMint
          lastCumMint = cm
          out.push({ t: new Date(k + 'T00:00:00Z').getTime(), dailyMint: dm, dailyBurn: db, cumMint: cm, cumBurn, netFlow: cm - cumBurn })
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

export interface SupplyMetrics {
  circAtLaunch: number
  netFlow30d: number
  avgNetPerDay: number
  inflation30dPct: number
  burnMintPct: number
  daysToMax: number
  circulatingSeries: number[] // anchored circulating per day, aligned to the series
}

export function computeSupplyMetrics(series: SupplyDay[], liveCirc: number, maxSupply: number): SupplyMetrics | null {
  if (!series.length || !(liveCirc > 0)) return null
  const last = series[series.length - 1]
  const nfLast = last.netFlow
  // Anchor to the live figure; walk the shape backwards via net flow.
  const circulatingSeries = series.map((d) => liveCirc + d.netFlow - nfLast)

  const cutoff = last.t - 30 * 86400 * 1000
  let nf30 = series[0].netFlow
  for (const d of series) if (d.t <= cutoff) nf30 = d.netFlow
  const netFlow30d = nfLast - nf30
  const avgNetPerDay = netFlow30d / 30
  const inflation30dPct = (netFlow30d / liveCirc) * 100
  const burnMintPct = last.cumMint > 0 ? (last.cumBurn / last.cumMint) * 100 : 0
  const existing = liveCirc + LOCKED_SUPPLY

  // Days to max: 3M is the cap on TOTAL issuance, so burns don't hand back minting
  // headroom. Project GROSS emissions against BEAN ever minted, not net mint (a noisy
  // mint-minus-burn difference that swung the estimate by years) against existing supply.
  // Gross mint = avg of the last 30 days that actually minted; total minted = existing + burned.
  const mintDays = series.filter((d) => d.dailyMint > 0).slice(-30)
  const grossMintPerDay = mintDays.length ? mintDays.reduce((s, d) => s + d.dailyMint, 0) / mintDays.length : 0
  const totalMinted = existing + last.cumBurn
  const daysToMax = grossMintPerDay > 0 ? (maxSupply - totalMinted) / grossMintPerDay : Infinity

  return { circAtLaunch: circulatingSeries[0], netFlow30d, avgNetPerDay, inflation30dPct, burnMintPct, daysToMax, circulatingSeries }
}
