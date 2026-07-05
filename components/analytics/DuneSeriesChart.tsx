'use client'

import React, { useEffect, useMemo, useState } from 'react'
import AnalyticsChart, { ChartBar, ChartLine } from './AnalyticsChart'
import { fetchDune } from '@/lib/duneData'
import { bucketize, bucketLabel, GRANULARITIES, Granularity } from '@/lib/timeBucket'
import { fmtUsdCompact } from '@/lib/analyticsFormat'

export interface DuneSeries {
  keys: Record<string, string> // unit label -> Dune column (e.g. { USD: 'usd_spent', ETH: 'eth_spent' })
  label: string
  color: string
  type: 'bar' | 'line'
  agg?: 'sum' | 'last' | 'count' // combine rows in a bucket: 'sum' flows, 'last' balances, 'count' rows
  cumulative?: boolean
  diff?: boolean       // day/period-over-period change (net flow from a balance column)
  fill?: boolean
}

const num = (v: any): number => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return typeof n === 'number' && isFinite(n) ? n : 0
}

function defaultFmt(v: number, unit: string): string {
  if (unit === 'USD') return v >= 1000 || v <= -1000 ? fmtUsdCompact(v) : '$' + v.toFixed(2)
  if (unit === 'ETH') return v.toFixed(3)
  return Math.round(v).toLocaleString()
}

// Dune-backed time-series chart with working unit (USD / ETH / ...) and
// granularity (Daily / Weekly / Monthly / Quarterly) dropdowns.
export default function DuneSeriesChart({
  query,
  title,
  description,
  info,
  dateKey = 'date',
  series,
  height,
  fullRange,
  fillGaps,
  isMobile,
}: {
  query: string
  title: string
  description?: string
  info?: string
  dateKey?: string
  series: DuneSeries[]
  height?: number
  fullRange?: boolean
  fillGaps?: boolean
  isMobile: boolean
}) {
  const [rows, setRows] = useState<Record<string, any>[] | null>(null)
  const [state, setState] = useState<'loading' | 'live' | 'empty'>('loading')

  const unitOptions = useMemo(() => Object.keys(series[0]?.keys ?? {}), [series])
  const [unit, setUnit] = useState(unitOptions[0] ?? '')
  const [gran, setGran] = useState<Granularity>('Daily')

  useEffect(() => {
    let cancelled = false
    fetchDune(query).then((r) => {
      if (cancelled) return
      if (r && r.rows.length) {
        const sorted = [...(r.rows as Record<string, any>[])].sort(
          (a, b) => new Date(a[dateKey]).getTime() - new Date(b[dateKey]).getTime(),
        )
        setRows(sorted)
        setState('live')
      } else {
        setState('empty')
      }
    })
    return () => { cancelled = true }
  }, [query, dateKey])

  const pts = rows ?? []
  const buckets = useMemo(
    () => bucketize(pts, (r) => new Date(r[dateKey]).getTime(), gran, fillGaps),
    [rows, dateKey, gran, fillGaps],
  )
  // Stable references so the chart's brush window doesn't reset every render.
  const axisTimes = useMemo(() => buckets.map((b) => b.t), [buckets])
  const labels = useMemo(() => buckets.map((b) => bucketLabel(b.t, gran)), [buckets, gran])

  const bars: ChartBar[] = []
  const lines: ChartLine[] = []
  for (const s of series) {
    const col = s.keys[unit] ?? Object.values(s.keys)[0]
    let vals = buckets.map((b) => {
      if (s.agg === 'count') return b.rows.length
      const xs = b.rows.map((r) => num(r[col]))
      return s.agg === 'last' ? (xs.length ? xs[xs.length - 1] : 0) : xs.reduce((a, c) => a + c, 0)
    })
    if (s.cumulative) { let acc = 0; vals = vals.map((v) => (acc += v)) }
    else if (s.diff) { let prev: number | null = null; vals = vals.map((v) => { const d = prev == null ? v : v - prev; prev = v; return d }) }
    if (s.type === 'bar') bars.push({ values: vals, color: s.color, name: s.label })
    else lines.push({ values: vals, color: s.color, name: s.label, width: 2, fill: s.fill })
  }

  return (
    <AnalyticsChart
      title={title}
      info={info}
      description={description}
      unit={unit || undefined}
      unitOptions={unitOptions.length > 1 ? unitOptions : undefined}
      onUnit={setUnit}
      granularity={gran}
      granularityOptions={GRANULARITIES as unknown as string[]}
      onGranularity={(g) => setGran(g as Granularity)}
      bars={bars}
      lines={lines}
      labels={labels}
      pointLabels={labels}
      axisTimes={axisTimes}
      brush
      brushDefaultFull={fullRange}
      valueFormat={(v) => defaultFmt(v, unit)}
      zeroLine={bars.length > 0}
      height={height ?? (isMobile ? 200 : 260)}
      loading={state === 'loading'}
      empty={state === 'empty'}
      emptyText="No data yet"
      legend={series.map((s) => ({ color: s.color, label: s.label, shape: s.type === 'bar' ? 'bar' : 'line' }))}
      isMobile={isMobile}
    />
  )
}
