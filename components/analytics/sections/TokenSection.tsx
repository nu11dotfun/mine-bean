'use client'

import React from 'react'
import { SectionHeader } from '../AnalyticsUI'
import HeroStatCard from '../HeroStatCard'
import NetEmissionsCard from '../NetEmissionsCard'
import DuneSeriesChart from '../DuneSeriesChart'
import { useProtocolSummary, BEAN_MAX_SUPPLY } from '@/lib/protocolSummary'
import { fmtInt, fmtUsdCompact } from '@/lib/analyticsFormat'

const D = '—'

export default function TokenSection({ isMobile }: { isMobile: boolean }) {
  const { summary } = useProtocolSummary()

  const heroGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
    gap: isMobile ? 12 : 16,
    marginBottom: isMobile ? 20 : 24,
  }
  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: isMobile ? 14 : 18,
    alignItems: 'stretch',
  }
  const H = isMobile ? 220 : 300

  return (
    <div>
      <SectionHeader title="Token" description="Supply, market cap and emissions." isMobile={isMobile} />

      <div style={heroGrid}>
        <HeroStatCard title="Circulating Supply" value={summary ? fmtInt(summary.circulatingSupply) : D} caption="BEAN" isMobile={isMobile} />
        <HeroStatCard title="Fully Diluted Value" value={summary ? fmtUsdCompact(summary.fdvUsd) : D} caption="USD" isMobile={isMobile} />
        <HeroStatCard title="Max Supply" value={fmtInt(BEAN_MAX_SUPPLY)} caption="BEAN" isMobile={isMobile} />
      </div>

      <div style={{ marginBottom: isMobile ? 14 : 18 }}>
        <NetEmissionsCard isMobile={isMobile} />
      </div>

      <div style={grid}>
        <DuneSeriesChart
          query="mining-rewards"
          title="Total BEAN minted to miners"
          description="Cumulative BEAN minted to miners."
          series={[{ keys: { BEAN: 'total_bean' }, label: 'BEAN minted', color: '#F5A623', type: 'line', agg: 'last', fill: true }]}
          height={H}
          isMobile={isMobile}
        />
        <DuneSeriesChart
          query="mining-rewards"
          title="BEAN emitted daily"
          description="BEAN minted to miners each day."
          series={[{ keys: { BEAN: 'bean_allocated' }, label: 'BEAN emitted', color: '#4C82FF', type: 'bar', agg: 'sum' }]}
          height={H}
          isMobile={isMobile}
        />
      </div>
    </div>
  )
}
