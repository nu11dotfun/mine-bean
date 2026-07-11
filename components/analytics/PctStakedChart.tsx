'use client'

import React, { useEffect, useMemo, useState } from 'react'
import AnalyticsChart, { ChartLine } from './AnalyticsChart'
import { fetchDune } from '@/lib/duneData'
import { useProtocolSummary } from '@/lib/protocolSummary'
import { bucketize, bucketLabel, GRANULARITIES, Granularity } from '@/lib/timeBucket'

const C1 = '#4C82FF', C2 = '#F5A623'
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return typeof n === 'number' && isFinite(n) ? n : 0
}

// Staked BEAN as a share of circulating supply, over time. Second line adds the
// unclaimed rewards pool (treasury) on top. Denominator is current circulating.
export default function PctStakedChart({ isMobile }: { isMobile: boolean }) {
  const { summary } = useProtocolSummary()
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [state, setState] = useState<'loading' | 'live' | 'empty'>('loading')
  const [gran, setGran] = useState<Granularity>('Weekly')

  useEffect(() => {
    let cancelled = false
    fetchDune('tvl-by-day').then((r) => {
      if (cancelled) return
      if (r && r.rows.length) {
        setRows([...r.rows].sort((a, b) => new Date(String((a as Record<string, unknown>).day ?? (a as Record<string, unknown>).date)).getTime() - new Date(String((b as Record<string, unknown>).day ?? (b as Record<string, unknown>).date)).getTime()) as Record<string, unknown>[])
        setState('live')
      } else setState('empty')
    })
    return () => { cancelled = true }
  }, [])

  const circ = summary && summary.circulatingSupply > 0 ? summary.circulatingSupply : 0
  const buckets = useMemo(() => bucketize(rows ?? [], (r) => new Date(String(r.day ?? r.date)).getTime(), gran), [rows, gran])
  const axisTimes = buckets.map((b) => b.t)
  const labels = buckets.map((b) => bucketLabel(b.t, gran))

  const { staked, withTreasury } = useMemo(() => {
    const s: (number | null)[] = []
    const wt: (number | null)[] = []
    for (const b of buckets) {
      const lastRow = b.rows[b.rows.length - 1]
      if (!lastRow || circ <= 0) { s.push(null); wt.push(null); continue }
      const st = num(lastRow.staked_bean)
      const unc = num(lastRow.unclaimed_bean)
      s.push((st / circ) * 100)
      wt.push(((st + unc) / circ) * 100)
    }
    return { staked: s, withTreasury: wt }
  }, [buckets, circ])

  const lines: ChartLine[] = [
    { values: staked, color: C1, width: 2, name: '% staked' },
    { values: withTreasury, color: C2, width: 2, name: '% staked + treasury' },
  ]

  return (
    <AnalyticsChart
      title="% of circulating staked"
      description="Staked BEAN as a share of circulating supply; the second line adds the unclaimed rewards pool."
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
      legend={[
        { color: C1, label: '% staked', shape: 'line' },
        { color: C2, label: '% staked + treasury', shape: 'line' },
      ]}
      isMobile={isMobile}
    />
  )
}
