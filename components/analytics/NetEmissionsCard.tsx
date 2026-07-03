'use client'

import React, { useEffect, useState } from 'react'
import AnalyticsChart, { ChartLine } from './AnalyticsChart'
import { fetchNetEmissions, NetEmissionsResponse } from '@/lib/analyticsData'

// Net BEAN emitted per round vs the buyback potential from protocol fees, as
// 20- and 100-round moving averages. The one time-series chart already backed by
// a live endpoint (/api/stats/net-emissions).
export default function NetEmissionsCard({ isMobile }: { isMobile: boolean }) {
  const [net, setNet] = useState<NetEmissionsResponse | null>(null)
  const [state, setState] = useState<'loading' | 'live' | 'empty'>('loading')

  useEffect(() => {
    fetchNetEmissions().then((r) => {
      if (r && r.points && r.points.length) {
        setNet(r)
        setState('live')
      } else {
        setState('empty')
      }
    })
  }, [])

  const pts = net?.points ?? []
  const lines: ChartLine[] = [
    { values: pts.map((p) => p.ma20), color: '#0052FF', width: 2, fill: true, name: '20-round average' },
    { values: pts.map((p) => p.ma100), color: '#ffffff', width: 2.5, name: '100-round average' },
  ]
  const latestMa100 = [...pts].reverse().find((p) => p.ma100 != null)?.ma100 ?? null

  return (
    <AnalyticsChart
      title="Net BEAN emissions per round"
      description="Emissions minus buyback potential. Below zero is deflationary."
      unit="BEAN"
      granularity="Per round"
      headline={latestMa100 != null ? `${latestMa100 >= 0 ? '+' : ''}${latestMa100.toFixed(2)} BEAN/round` : undefined}
      lines={lines}
      pointLabels={pts.map((p) => `Round ${p.roundId.toLocaleString()}`)}
      valueFormat={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
      zeroLine
      height={isMobile ? 220 : 300}
      loading={state === 'loading'}
      empty={state === 'empty'}
      emptyText="No data yet"
      legend={[
        { color: '#0052FF', label: '20-round average', shape: 'line' },
        { color: '#ffffff', label: '100-round average', shape: 'line' },
      ]}
      isMobile={isMobile}
    />
  )
}
