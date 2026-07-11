'use client'

import React from 'react'
import { SectionHeader } from '../AnalyticsUI'
import HeroStatCard from '../HeroStatCard'
import DuneSeriesChart from '../DuneSeriesChart'
import AcquisitionCostChart from '../AcquisitionCostChart'
import BuybackSupplyChart from '../BuybackSupplyChart'
import RevenueTable from '@/components/RevenueTable'
import { useProtocolSummary } from '@/lib/protocolSummary'
import { useBuybackTotals } from '@/lib/buybackTotals'
import { fmtInt, fmtPct, fmtUsdCompact } from '@/lib/analyticsFormat'

const D = '—'

export default function BuybackBurnSection({ isMobile }: { isMobile: boolean }) {
  const { summary } = useProtocolSummary()
  const totals = useBuybackTotals()
  const pctBought =
    totals && summary && summary.totalMinted > 0 ? (totals.beanBought / summary.totalMinted) * 100 : null

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
    marginBottom: isMobile ? 24 : 32,
  }
  const H = isMobile ? 200 : 260

  return (
    <div>
      <SectionHeader title="Buyback & Burn" description="BEAN bought back from protocol fees and burned." isMobile={isMobile} />

      <div style={heroGrid}>
        <HeroStatCard title="Total Buybacks" value={totals ? fmtInt(totals.beanBought) : D} caption="BEAN bought back" isMobile={isMobile} />
        <HeroStatCard title="Total Buyback Amount" subtitle="in USD" value={totals ? fmtUsdCompact(totals.usdSpent) : D} caption="Spent on buybacks" isMobile={isMobile} />
        <HeroStatCard title="% of Supply Bought Back" value={pctBought != null ? fmtPct(pctBought, 1) : D} caption="Of total minted supply" isMobile={isMobile} />
      </div>

      <div style={grid}>
        <DuneSeriesChart
          query="buyback-history"
          title="Daily buyback spend"
          description="Value spent buying back BEAN each day."
          series={[{ keys: { USD: 'usd_spent', ETH: 'eth_spent' }, label: 'Buyback', color: '#4C82FF', type: 'bar', agg: 'sum' }]}
          height={H}
          isMobile={isMobile}
        />
        <DuneSeriesChart
          query="buyback-history"
          title="Cumulative BEAN burned"
          description="Total BEAN burned over time."
          series={[{ keys: { BEAN: 'bean_burnt' }, label: 'BEAN burned', color: '#F5A623', type: 'line', agg: 'sum', cumulative: true, fill: true }]}
          height={H}
          isMobile={isMobile}
        />
      </div>
      <div style={grid}>
        <AcquisitionCostChart isMobile={isMobile} />
        <BuybackSupplyChart isMobile={isMobile} />
      </div>
      <RevenueTable />
    </div>
  )
}
