'use client'

import React, { useEffect, useMemo, useState } from 'react'
import AnalyticsChart, { ChartLine } from './AnalyticsChart'
import { fetchDune } from '@/lib/duneData'
import { useProtocolSummary } from '@/lib/protocolSummary'
import { bucketize, bucketLabel, GRANULARITIES, Granularity } from '@/lib/timeBucket'

const C = '#F5A623'
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return typeof n === 'number' && isFinite(n) ? n : 0
}

// Cumulative BEAN bought back as a share of total minted supply, over time.
export default function BuybackSupplyChart({ isMobile }: { isMobile: boolean }) {
  const { summary } = useProtocolSummary()
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [state, setState] = useState<'loading' | 'live' | 'empty'>('loading')
  const [gran, setGran] = useState<Granularity>('Weekly')

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

  const supply = summary && summary.totalMinted > 0 ? summary.totalMinted : 0
  const buckets = useMemo(() => bucketize(rows ?? [], (r) => new Date(String(r.date)).getTime(), gran), [rows, gran])
  const axisTimes = buckets.map((b) => b.t)
  const labels = buckets.map((b) => bucketLabel(b.t, gran))

  const values = useMemo(() => {
    let cum = 0
    return buckets.map((b) => {
      cum += b.rows.reduce((a, r) => a + num(r.bean_bought), 0)
      return supply > 0 ? (cum / supply) * 100 : null
    })
  }, [buckets, supply])

  const lines: ChartLine[] = [{ values, color: C, width: 2, fill: true, name: '% of supply' }]

  return (
    <AnalyticsChart
      title="Cumulative buyback % of supply"
      description="Share of total minted BEAN that has been bought back."
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
      valueFormat={(v) => v.toFixed(1) + '%'}
      height={isMobile ? 200 : 260}
      loading={state === 'loading' || !summary}
      empty={state === 'empty'}
      emptyText="No data yet"
      isMobile={isMobile}
    />
  )
}
