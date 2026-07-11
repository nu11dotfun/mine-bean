'use client'

import React, { useEffect, useMemo, useState } from 'react'
import AnalyticsChart, { ChartLine } from './AnalyticsChart'
import { fetchDune } from '@/lib/duneData'
import { bucketize, bucketLabel, GRANULARITIES, Granularity } from '@/lib/timeBucket'

const C7 = '#4C82FF', C30 = '#F5A623', C90 = '#2DD4BF'
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return typeof n === 'number' && isFinite(n) ? n : 0
}
const dayKey = (v: unknown) => String(v).slice(0, 10)

interface ApyRow { t: number; apy7: number | null; apy30: number | null; apy90: number | null }

// Annualised yield to stakers over rolling 7 / 30 / 90-day windows:
//   apy_N(t) = (yield over last N days ÷ staked) × (365 / N)
// Yield from staking-metrics, staked from tvl-by-day, joined by day.
export default function StakingApyChart({ isMobile }: { isMobile: boolean }) {
  const [data, setData] = useState<ApyRow[] | null>(null)
  const [state, setState] = useState<'loading' | 'live' | 'empty'>('loading')
  const [gran, setGran] = useState<Granularity>('Daily')

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchDune('staking-metrics'), fetchDune('tvl-by-day')]).then(([sm, tvl]) => {
      if (cancelled) return
      if (!sm || !sm.rows.length) { setState('empty'); return }
      const yieldByDay = new Map<string, number>()
      for (const r of sm.rows as Record<string, unknown>[]) yieldByDay.set(dayKey(r.date), num(r.yield_bean))
      const stakedByDay = new Map<string, number>()
      for (const r of (tvl?.rows ?? []) as Record<string, unknown>[]) stakedByDay.set(dayKey(r.day ?? r.date), num(r.staked_bean))

      const days = [...new Set([...yieldByDay.keys(), ...stakedByDay.keys()])].sort()
      let lastStaked = 0
      const rows = days.map((d) => {
        const staked = stakedByDay.has(d) ? stakedByDay.get(d)! : lastStaked
        lastStaked = staked
        return { t: new Date(d + 'T00:00:00Z').getTime(), y: yieldByDay.get(d) ?? 0, staked }
      })
      const rolling = (win: number) =>
        rows.map((_, i) => {
          const from = Math.max(0, i - win + 1)
          if (i - from + 1 < win) return null
          let sum = 0
          for (let j = from; j <= i; j++) sum += rows[j].y
          const staked = rows[i].staked
          return staked > 0 ? (sum / staked) * (365 / win) * 100 : null
        })
      const a7 = rolling(7), a30 = rolling(30), a90 = rolling(90)
      setData(rows.map((r, i) => ({ t: r.t, apy7: a7[i], apy30: a30[i], apy90: a90[i] })))
      setState('live')
    })
    return () => { cancelled = true }
  }, [])

  const buckets = useMemo(() => bucketize(data ?? [], (d) => d.t, gran), [data, gran])
  const axisTimes = buckets.map((b) => b.t)
  const labels = buckets.map((b) => bucketLabel(b.t, gran))
  const last = (k: 'apy7' | 'apy30' | 'apy90') => buckets.map((b) => (b.rows.length ? b.rows[b.rows.length - 1][k] : null))

  const lines: ChartLine[] = [
    { values: last('apy7'), color: C7, width: 2, name: '7D' },
    { values: last('apy30'), color: C30, width: 2, name: '30D' },
    { values: last('apy90'), color: C90, width: 2, name: '90D' },
  ]

  return (
    <AnalyticsChart
      title="Implied staking APY"
      description="Annualised yield to stakers over rolling 7 / 30 / 90-day windows."
      unit="%"
      granularity={gran}
      granularityOptions={GRANULARITIES as unknown as string[]}
      onGranularity={(g) => setGran(g as Granularity)}
      lines={lines}
      labels={labels}
      pointLabels={labels}
      axisTimes={axisTimes}
      brush
      brushDefaultFull
      valueFormat={(v) => v.toFixed(0) + '%'}
      height={isMobile ? 200 : 260}
      loading={state === 'loading'}
      empty={state === 'empty'}
      emptyText="No data yet"
      legend={[
        { color: C7, label: '7D', shape: 'line' },
        { color: C30, label: '30D', shape: 'line' },
        { color: C90, label: '90D', shape: 'line' },
      ]}
      isMobile={isMobile}
    />
  )
}
