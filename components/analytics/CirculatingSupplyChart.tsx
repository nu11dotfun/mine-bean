'use client'

import React, { useMemo, useState } from 'react'
import AnalyticsChart, { ChartLine } from './AnalyticsChart'
import { useSupplyHistory, computeSupplyMetrics } from '@/lib/supplyHistory'
import { useProtocolSummary, BEAN_MAX_SUPPLY } from '@/lib/protocolSummary'
import { bucketize, bucketLabel, GRANULARITIES, Granularity } from '@/lib/timeBucket'
import { fmtInt } from '@/lib/analyticsFormat'

const C = '#0052FF'

export default function CirculatingSupplyChart({ isMobile }: { isMobile: boolean }) {
  const series = useSupplyHistory()
  const { summary } = useProtocolSummary()
  const [gran, setGran] = useState<Granularity>('Daily')
  const m = series && summary ? computeSupplyMetrics(series, summary.circulatingSupply, BEAN_MAX_SUPPLY) : null

  const rows = useMemo(() => (series && m ? series.map((d, i) => ({ t: d.t, circ: m.circulatingSeries[i] })) : []), [series, m])
  const buckets = useMemo(() => bucketize(rows, (d) => d.t, gran), [rows, gran])
  const axisTimes = buckets.map((b) => b.t)
  const labels = buckets.map((b) => bucketLabel(b.t, gran))
  const values = buckets.map((b) => (b.rows.length ? b.rows[b.rows.length - 1].circ : null))

  const lines: ChartLine[] = [{ values, color: C, width: 2, fill: true, name: 'Circulating' }]
  const mcapFdv = summary ? (summary.circulatingSupply / BEAN_MAX_SUPPLY) * 100 : null

  return (
    <AnalyticsChart
      title="Total circulating supply"
      description="BEAN in circulation over time. Excludes team-locked supply, anchored to the current circulating figure."
      unit="BEAN"
      granularity={gran}
      granularityOptions={GRANULARITIES as unknown as string[]}
      onGranularity={(g) => setGran(g as Granularity)}
      headline={summary ? fmtInt(summary.circulatingSupply) : undefined}
      footnote={mcapFdv != null ? `${mcapFdv.toFixed(1)}% of max supply (${fmtInt(BEAN_MAX_SUPPLY)})` : undefined}
      lines={lines}
      labels={labels}
      pointLabels={labels}
      axisTimes={axisTimes}
      brush
      brushDefaultFull
      valueFormat={(v) => fmtInt(v)}
      height={isMobile ? 220 : 300}
      loading={!series || !summary}
      empty={!!series && !!summary && rows.length === 0}
      emptyText="No data yet"
      isMobile={isMobile}
    />
  )
}
