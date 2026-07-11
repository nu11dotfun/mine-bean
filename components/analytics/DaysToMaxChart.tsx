'use client'

import React, { useMemo, useState } from 'react'
import AnalyticsChart, { ChartLine } from './AnalyticsChart'
import { useSupplyHistory, LOCKED_SUPPLY } from '@/lib/supplyHistory'
import { useProtocolSummary, BEAN_MAX_SUPPLY } from '@/lib/protocolSummary'
import { bucketize, bucketLabel, GRANULARITIES, Granularity } from '@/lib/timeBucket'

const C = '#4C82FF'

// Days until the 3M cap is minted, computed at each day from that day's rolling
// 30-day gross emission pace against BEAN minted so far.
export default function DaysToMaxChart({ isMobile }: { isMobile: boolean }) {
  const series = useSupplyHistory()
  const { summary } = useProtocolSummary()
  const [gran, setGran] = useState<Granularity>('Daily')

  const daily = useMemo(() => {
    if (!series || !series.length || !summary || !(summary.circulatingSupply > 0)) return []
    const last = series[series.length - 1]
    // genesis = constant day-0 mint (team-locked + initial liquidity), back-solved
    const genesis = summary.circulatingSupply + LOCKED_SUPPLY - last.netFlow
    const out: { t: number; days: number | null }[] = []
    for (let i = 0; i < series.length; i++) {
      let sum = 0, cnt = 0
      for (let j = Math.max(0, i - 29); j <= i; j++) {
        if (series[j].dailyMint > 0) { sum += series[j].dailyMint; cnt++ }
      }
      const gross = cnt > 0 ? sum / cnt : 0
      const remaining = BEAN_MAX_SUPPLY - (genesis + series[i].cumMint)
      out.push({ t: series[i].t, days: gross > 0 && remaining > 0 ? remaining / gross : null })
    }
    return out
  }, [series, summary])

  const buckets = useMemo(() => bucketize(daily, (d) => d.t, gran), [daily, gran])
  const axisTimes = buckets.map((b) => b.t)
  const labels = buckets.map((b) => bucketLabel(b.t, gran))
  const values = buckets.map((b) => (b.rows.length ? b.rows[b.rows.length - 1].days : null))

  const lines: ChartLine[] = [{ values, color: C, width: 2, fill: true, name: 'Days to max' }]

  return (
    <AnalyticsChart
      title="Days to max supply over time"
      description="Days until the 3M cap is minted, at each day's emission pace."
      unit="days"
      granularity={gran}
      granularityOptions={GRANULARITIES as unknown as string[]}
      onGranularity={(g) => setGran(g as Granularity)}
      lines={lines}
      labels={labels}
      pointLabels={labels}
      axisTimes={axisTimes}
      brush
      brushDefaultFull
      valueFormat={(v) => Math.round(v).toLocaleString() + ' days'}
      height={isMobile ? 200 : 260}
      loading={!series || !summary}
      empty={!!series && !!summary && daily.length === 0}
      emptyText="No data yet"
      isMobile={isMobile}
    />
  )
}
