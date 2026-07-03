'use client'

import React from 'react'
import { SectionHeader } from '../AnalyticsUI'
import HeroStatCard from '../HeroStatCard'
import DuneSeriesChart from '../DuneSeriesChart'
import RevenueOverTimeChart from '../RevenueOverTimeChart'
import { useProtocolSummary } from '@/lib/protocolSummary'
import { useLlamaRevenue } from '@/lib/defiLlama'
import { useTrueVolume } from '@/lib/trueVolume'
import { fmtUsdCompact } from '@/lib/analyticsFormat'

const D = '—'

export default function FinancialsSection({ isMobile }: { isMobile: boolean }) {
  const { summary } = useProtocolSummary()
  const rev = useLlamaRevenue()
  const trueVolume = useTrueVolume()

  const heroGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
    gap: isMobile ? 12 : 16,
    marginBottom: isMobile ? 24 : 32,
  }

  return (
    <div>
      <SectionHeader title="Revenue" description="Protocol revenue and volume." isMobile={isMobile} />

      <div style={heroGrid}>
        <HeroStatCard
          title="Total Volume"
          value={trueVolume != null ? fmtUsdCompact(trueVolume) : summary ? fmtUsdCompact(summary.totalVolumeUsd) : D}
          caption="ETH deployed, valued at deploy time"
          isMobile={isMobile}
        />
        <HeroStatCard
          title="Total Protocol Revenue"
          value={rev ? fmtUsdCompact(rev.allTimeUsd) : D}
          caption="All time"
          isMobile={isMobile}
        />
        <HeroStatCard
          title="Protocol Revenue (30D)"
          value={rev ? fmtUsdCompact(rev.last30dUsd) : D}
          caption="Past 30 days"
          isMobile={isMobile}
        />
      </div>

      <div style={{ marginBottom: isMobile ? 14 : 18 }}>
        <RevenueOverTimeChart isMobile={isMobile} />
      </div>

      <DuneSeriesChart
        query="mining-volume"
        title="Total ETH deployed"
        description="ETH deployed into mining rounds each day."
        dateKey="day"
        series={[{ keys: { ETH: 'total_eth_deployed' }, label: 'ETH deployed', color: '#4C82FF', type: 'bar', agg: 'sum' }]}
        height={isMobile ? 200 : 260}
        isMobile={isMobile}
      />
    </div>
  )
}
