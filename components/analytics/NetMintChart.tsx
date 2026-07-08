'use client'

import React, { useMemo, useState } from 'react'
import AnalyticsChart, { ChartBar } from './AnalyticsChart'
import { useSupplyHistory, computeSupplyMetrics } from '@/lib/supplyHistory'
import { useProtocolSummary, BEAN_MAX_SUPPLY } from '@/lib/protocolSummary'
import { bucketize, bucketLabel, GRANULARITIES, Granularity } from '@/lib/timeBucket'
import { fmtInt } from '@/lib/analyticsFormat'

const MINT_C = '#22C55E'
const BURN_C = '#EF4444'

export default function NetMintChart({ isMobile }: { isMobile: boolean }) {
  const series = useSupplyHistory()
  const { summary } = useProtocolSummary()
  const [gran, setGran] = useState<Granularity>('Daily')
  const m = series && summary ? computeSupplyMetrics(series, summary.circulatingSupply, BEAN_MAX_SUPPLY) : null

  const buckets = useMemo(() => (series ? bucketize(series, (d) => d.t, gran) : []), [series, gran])
  const axisTimes = buckets.map((b) => b.t)
  const labels = buckets.map((b) => bucketLabel(b.t, gran))
  const mint = buckets.map((b) => b.rows.reduce((s, r) => s + r.dailyMint, 0))
  const burn = buckets.map((b) => -b.rows.reduce((s, r) => s + r.dailyBurn, 0)) // negative → drawn below zero

  const bars: ChartBar[] = [
    { values: mint, color: MINT_C, name: 'Minted' },
    { values: burn, color: BURN_C, name: 'Burnt' },
  ]

  return (
    <AnalyticsChart
      title="Net mint over time"
      description="BEAN minted (above the line) vs burnt (below) each period. The gap is net new supply."
      unit="BEAN"
      granularity={gran}
      granularityOptions={GRANULARITIES as unknown as string[]}
      onGranularity={(g) => setGran(g as Granularity)}
      headline={m ? `${m.burnMintPct.toFixed(0)}% burnt / minted` : undefined}
      bars={bars}
      lines={[]}
      labels={labels}
      pointLabels={labels}
      axisTimes={axisTimes}
      brush
      zeroLine
      valueFormat={(v) => `${v >= 0 ? '+' : ''}${fmtInt(v)}`}
      height={isMobile ? 220 : 300}
      loading={!series}
      empty={!!series && buckets.length === 0}
      emptyText="No data yet"
      legend={[
        { color: MINT_C, label: 'Minted', shape: 'bar' },
        { color: BURN_C, label: 'Burnt', shape: 'bar' },
      ]}
      isMobile={isMobile}
    />
  )
}
