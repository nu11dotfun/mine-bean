'use client'

import React from 'react'
import { SectionHeader } from '../AnalyticsUI'
import HeroStatCard from '../HeroStatCard'
import DuneSeriesChart from '../DuneSeriesChart'
import StakingApyChart from '../StakingApyChart'
import PctStakedChart from '../PctStakedChart'
import HolderTable from '../HolderTable'
import { useProtocolSummary } from '@/lib/protocolSummary'
import { useStaking7dYield } from '@/lib/stakingApr'
import { fmtInt, fmtPct, fmtUsdCompact } from '@/lib/analyticsFormat'

const D = '—'

export default function StakingSection({ isMobile }: { isMobile: boolean }) {
  const { summary } = useProtocolSummary()
  const yield7d = useStaking7dYield()

  // APR from a 7-day rolling window of actual yield, annualised on the current stake.
  const apr7d =
    summary && yield7d != null && summary.totalStaked > 0
      ? (yield7d / summary.totalStaked) * (365 / 7) * 100
      : null
  const pctCircStaked =
    summary && summary.circulatingSupply > 0 ? (summary.totalStaked / summary.circulatingSupply) * 100 : null

  const heroGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
    gap: isMobile ? 12 : 16,
    marginBottom: isMobile ? 24 : 32,
  }
  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: isMobile ? 14 : 18,
  }
  const H = isMobile ? 200 : 260

  return (
    <div>
      <SectionHeader title="Staking" description="BEAN staked to earn a share of protocol fees." isMobile={isMobile} />
      <div style={heroGrid}>
        <HeroStatCard
          title="Total Staked"
          subtitle="in USD"
          value={summary && summary.stakingTvlUsd > 0 ? fmtUsdCompact(summary.stakingTvlUsd) : D}
          caption={summary ? `${fmtInt(summary.totalStaked)} BEAN staked` : 'BEAN staked'}
          isMobile={isMobile}
        />
        <HeroStatCard
          title="% of Circulating Staked"
          value={pctCircStaked != null ? fmtPct(pctCircStaked, 1) : D}
          caption="Of circulating supply"
          isMobile={isMobile}
        />
        <HeroStatCard
          title="Staking APR"
          subtitle="7-day rolling"
          value={apr7d != null ? fmtPct(apr7d, 1) : D}
          caption="Annualised estimate"
          isMobile={isMobile}
        />
      </div>
      <div style={{ marginBottom: isMobile ? 14 : 18 }}>
        <DuneSeriesChart
          query="tvl-by-day"
          title="Total staked over time"
          description="BEAN staked over time."
          dateKey="day"
          series={[{ keys: { BEAN: 'staked_bean' }, label: 'Staked BEAN', color: '#4C82FF', type: 'line', agg: 'last', fill: true }]}
          height={isMobile ? 220 : 320}
          fullRange
          isMobile={isMobile}
        />
      </div>
      <div style={grid}>
        <DuneSeriesChart
          query="staking-metrics"
          title="Daily staking yield"
          description="Yield distributed to stakers each day."
          series={[{ keys: { BEAN: 'yield_bean', USD: 'yield_usd', ETH: 'yield_eth' }, label: 'Yield', color: '#4C82FF', type: 'bar', agg: 'sum' }]}
          height={H}
          fullRange
          isMobile={isMobile}
        />
        <DuneSeriesChart
          query="tvl-by-day"
          title="Staking flows"
          description="Net BEAN staked or unstaked per period."
          dateKey="day"
          series={[{ keys: { BEAN: 'staked_bean' }, label: 'Net flow', color: '#4C82FF', type: 'bar', agg: 'last', diff: true }]}
          height={H}
          fullRange
          isMobile={isMobile}
        />
      </div>
      <div style={{ ...grid, marginTop: isMobile ? 14 : 18 }}>
        <StakingApyChart isMobile={isMobile} />
        <PctStakedChart isMobile={isMobile} />
      </div>
      <div style={{ marginTop: isMobile ? 24 : 32 }}>
        <HolderTable type="stakers" isMobile={isMobile} />
      </div>
    </div>
  )
}
