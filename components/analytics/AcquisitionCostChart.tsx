'use client'

import React, { useEffect, useMemo, useState } from 'react'
import AnalyticsChart, { ChartLine } from './AnalyticsChart'
import { fetchDune } from '@/lib/duneData'
import { bucketize, bucketLabel, GRANULARITIES, Granularity } from '@/lib/timeBucket'

const PERIOD_C = '#4C82FF'
const BLENDED_C = '#F5A623'
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return typeof n === 'number' && isFinite(n) ? n : 0
}

// What the protocol paid per BEAN bought back: the cost of each period's buybacks
// vs the blended cost basis across all buybacks. Both in $/BEAN, from buyback-history.
export default function AcquisitionCostChart({ isMobile }: { isMobile: boolean }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [state, setState] = useState<'loading' | 'live' | 'empty'>('loading')
  const [gran, setGran] = useState<Granularity>('Daily')

  useEffect(() => {
    let cancelled = false
    fetchDune('buyback-history').then((r) => {
      if (cancelled) return
      if (r && r.rows.length) {
        setRows([...r.rows].sort((a, b) => new Date(String((a as Record<string, unknown>).date)).getTime() - new Date(String((b as Record<string, unknown>).date)).getTime()) as Record<string, unknown>[])
        setState('live')
      } else setState('empty')
    })
    return () => { cancelled = true }
  }, [])

  const buckets = useMemo(() => bucketize(rows ?? [], (r) => new Date(String(r.date)).getTime(), gran), [rows, gran])
  const axisTimes = buckets.map((b) => b.t)
  const labels = buckets.map((b) => bucketLabel(b.t, gran))

  const { perPeriod, blended } = useMemo(() => {
    let cumUsd = 0, cumBean = 0
    const per: (number | null)[] = []
    const bl: (number | null)[] = []
    for (const b of buckets) {
      const usd = b.rows.reduce((a, r) => a + num(r.usd_spent), 0)
      const bean = b.rows.reduce((a, r) => a + num(r.bean_bought), 0)
      cumUsd += usd; cumBean += bean
      per.push(bean > 0 ? usd / bean : null)
      bl.push(cumBean > 0 ? cumUsd / cumBean : null)
    }
    return { perPeriod: per, blended: bl }
  }, [buckets])

  const lines: ChartLine[] = [
    { values: perPeriod, color: PERIOD_C, width: 2, name: 'Per buyback' },
    { values: blended, color: BLENDED_C, width: 2, name: 'Blended average' },
  ]

  return (
    <AnalyticsChart
      title="Buyback acquisition cost"
      description="Price paid per BEAN bought back, each period vs the blended average."
      unit="$/BEAN"
      granularity={gran}
      granularityOptions={GRANULARITIES as unknown as string[]}
      onGranularity={(g) => setGran(g as Granularity)}
      lines={lines}
      labels={labels}
      pointLabels={labels}
      axisTimes={axisTimes}
      brush
      brushDefaultFull
      valueFormat={(v) => '$' + v.toFixed(2)}
      height={isMobile ? 200 : 260}
      loading={state === 'loading'}
      empty={state === 'empty'}
      emptyText="No data yet"
      legend={[
        { color: PERIOD_C, label: 'Per buyback', shape: 'line' },
        { color: BLENDED_C, label: 'Blended average', shape: 'line' },
      ]}
      isMobile={isMobile}
    />
  )
}
