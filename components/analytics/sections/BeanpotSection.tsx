'use client'

import React from 'react'
import { SectionHeader } from '../AnalyticsUI'
import HeroStatCard from '../HeroStatCard'
import DuneSeriesChart from '../DuneSeriesChart'
import { useBeanpotTotals } from '@/lib/beanpotTotals'
import { fmtInt, fmtUsdCompact } from '@/lib/analyticsFormat'

const D = '—'

export default function BeanpotSection({ isMobile }: { isMobile: boolean }) {
  const totals = useBeanpotTotals()

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
      <SectionHeader title="Beanpot" description="Jackpot rounds and the BEAN they've paid out to miners." isMobile={isMobile} />

      <div style={heroGrid}>
        <HeroStatCard title="Beanpots Hit" value={totals ? fmtInt(totals.count) : D} caption="All-time" isMobile={isMobile} />
        <HeroStatCard title="Total Paid Out" subtitle="in BEAN" value={totals ? fmtInt(totals.totalBean) : D} caption="To winners" isMobile={isMobile} />
        <HeroStatCard
          title="Biggest Beanpot"
          subtitle="in USD terms"
          value={totals && totals.biggestUsd ? fmtUsdCompact(totals.biggestUsd) : D}
          caption={totals ? `${fmtInt(totals.biggestBean)} BEAN` : 'Single round'}
          isMobile={isMobile}
        />
      </div>

      <div style={grid}>
        <DuneSeriesChart
          query="beanpot-history"
          title="Beanpot paid out"
          description="BEAN jackpot paid to miners each period."
          series={[{ keys: { BEAN: 'beanpot_bean' }, label: 'Beanpot', color: '#4C82FF', type: 'bar', agg: 'sum' }]}
          height={H}
          fillGaps
          isMobile={isMobile}
        />
        <DuneSeriesChart
          query="beanpot-history"
          title="Cumulative beanpot paid"
          description="Total BEAN jackpot paid to miners over time."
          series={[{ keys: { BEAN: 'beanpot_bean' }, label: 'Beanpot', color: '#F5A623', type: 'line', agg: 'sum', cumulative: true, fill: true }]}
          height={H}
          fillGaps
          isMobile={isMobile}
        />
        <DuneSeriesChart
          query="beanpot-history"
          title="Beanpots hit per period"
          description="How often the jackpot lands."
          series={[{ keys: { Beanpots: 'round_id' }, label: 'Beanpots', color: '#2DD4BF', type: 'bar', agg: 'count' }]}
          height={H}
          fillGaps
          isMobile={isMobile}
        />
        <DuneSeriesChart
          query="beanpot-history"
          title="Beanpot participants"
          description="Miners entering jackpot rounds each period."
          series={[{ keys: { Miners: 'participants' }, label: 'Participants', color: '#C5D82D', type: 'bar', agg: 'sum' }]}
          height={H}
          fillGaps
          isMobile={isMobile}
        />
      </div>
    </div>
  )
}
