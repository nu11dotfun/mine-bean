'use client'

import React from 'react'
import { SectionHeader } from '../AnalyticsUI'
import HeroStatCard from '../HeroStatCard'
import DuneSeriesChart from '../DuneSeriesChart'
import MiningTable from '@/components/MiningTable'
import HolderTable from '../HolderTable'
import { useMiningStats } from '@/lib/miningStats'
import { fmtInt, fmtEth } from '@/lib/analyticsFormat'

const D = '—'

export default function MiningSection({ isMobile }: { isMobile: boolean }) {
  const stats = useMiningStats()

  const heroGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
    gap: isMobile ? 12 : 16,
    marginBottom: isMobile ? 20 : 24,
  }

  return (
    <div>
      <SectionHeader title="Mining" description="Deployment activity across every 60-second round." isMobile={isMobile} />

      <div style={heroGrid}>
        <HeroStatCard title="Total Deployments" value={stats ? fmtInt(stats.deployments) : D} caption="All-time block deploys" isMobile={isMobile} />
        <HeroStatCard title="Total ETH Deployed" value={stats ? `${fmtInt(stats.totalEth)} ETH` : D} caption="All-time" isMobile={isMobile} />
        <HeroStatCard title="Avg Deploy Size" value={stats ? `${fmtEth(stats.avgEthPerDeploy, 4)} ETH` : D} caption="Mean ETH per deploy" isMobile={isMobile} />
      </div>

      <div style={{ marginBottom: isMobile ? 24 : 32 }}>
        <DuneSeriesChart
          query="mining-volume"
          title="Deployments per day"
          description="Block deploys across all rounds each day."
          dateKey="day"
          series={[{ keys: { Deployments: 'num_deployments' }, label: 'Deployments', color: '#4C82FF', type: 'bar', agg: 'sum' }]}
          height={isMobile ? 200 : 280}
          isMobile={isMobile}
        />
      </div>

      <MiningTable />

      <div style={{ marginTop: isMobile ? 24 : 32 }}>
        <HolderTable type="unroasted" isMobile={isMobile} />
      </div>
    </div>
  )
}
