'use client'

import React, { useMemo, useState } from 'react'
import AnalyticsChart, { ChartLine } from './AnalyticsChart'
import { usePriceVsBtc } from '@/lib/priceVsBtc'
import { bucketize, bucketLabel, GRANULARITIES, Granularity } from '@/lib/timeBucket'

const BEAN_C = '#4C82FF'
const BTC_C = '#F5A623'
const WINDOWS: Record<string, number> = { '1M': 30, '3M': 90, ALL: Infinity }

// BEAN vs BTC, each indexed to 100 at the start of the selected window. The window
// dropdown reuses the unit slot; a second dropdown controls granularity.
export default function PriceVsBtcChart({ isMobile }: { isMobile: boolean }) {
  const data = usePriceVsBtc()
  const [win, setWin] = useState('1M')
  const [gran, setGran] = useState<Granularity>('Daily')

  const sliced = useMemo(() => {
    if (!data) return []
    const days = WINDOWS[win] ?? Infinity
    return days === Infinity ? data : data.slice(Math.max(0, data.length - days))
  }, [data, win])

  const indexed = useMemo(() => {
    if (!sliced.length) return []
    const b0 = sliced[0].bean
    const x0 = sliced[0].btc
    return sliced.map((p) => ({ t: p.t, bean: (p.bean / b0) * 100, btc: (p.btc / x0) * 100 }))
  }, [sliced])

  const buckets = useMemo(() => bucketize(indexed, (d) => d.t, gran), [indexed, gran])
  const axisTimes = useMemo(() => buckets.map((b) => b.t), [buckets])
  const labels = useMemo(() => buckets.map((b) => bucketLabel(b.t, gran)), [buckets, gran])
  const last = (k: 'bean' | 'btc') => buckets.map((b) => (b.rows.length ? b.rows[b.rows.length - 1][k] : 0))

  const lines: ChartLine[] = [
    { values: last('bean'), color: BEAN_C, name: 'BEAN', width: 2 },
    { values: last('btc'), color: BTC_C, name: 'BTC', width: 2 },
  ]

  return (
    <AnalyticsChart
      title="Price performance vs BTC"
      description={`Indexed to 100 at the start of the window (${win}). 100 = flat, above = outperforming.`}
      unit={win}
      unitOptions={Object.keys(WINDOWS)}
      onUnit={setWin}
      granularity={gran}
      granularityOptions={GRANULARITIES as unknown as string[]}
      onGranularity={(g) => setGran(g as Granularity)}
      lines={lines}
      labels={labels}
      pointLabels={labels}
      axisTimes={axisTimes}
      brush
      brushDefaultFull
      valueFormat={(v) => Math.round(v).toLocaleString()}
      height={isMobile ? 200 : 280}
      loading={!data}
      empty={!!data && indexed.length === 0}
      emptyText="No data yet"
      legend={[
        { color: BEAN_C, label: 'BEAN', shape: 'line' },
        { color: BTC_C, label: 'BTC', shape: 'line' },
      ]}
      isMobile={isMobile}
    />
  )
}
