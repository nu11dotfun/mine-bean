'use client'

import React from 'react'
import HeroStatCard from './HeroStatCard'
import { useSupplyHistory, computeSupplyMetrics } from '@/lib/supplyHistory'
import { useProtocolSummary, BEAN_MAX_SUPPLY } from '@/lib/protocolSummary'

const D = '—'

export default function SupplyStats({ isMobile }: { isMobile: boolean }) {
  const series = useSupplyHistory()
  const { summary } = useProtocolSummary()
  const m = series && summary ? computeSupplyMetrics(series, summary.circulatingSupply, BEAN_MAX_SUPPLY) : null

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
    gap: isMobile ? 12 : 16,
    marginBottom: isMobile ? 20 : 24,
  }

  const daysToMax = !m
    ? D
    : !isFinite(m.daysToMax)
      ? 'Never'
      : m.daysToMax > 730
        ? `~${(m.daysToMax / 365).toFixed(0)} yrs`
        : `~${Math.round(m.daysToMax).toLocaleString()} days`

  return (
    <div style={grid}>
      <HeroStatCard
        title="Inflation Rate (30D)"
        value={m ? `${m.inflation30dPct >= 0 ? '+' : ''}${m.inflation30dPct.toFixed(1)}%` : D}
        caption="circulating supply, past 30 days"
        isMobile={isMobile}
      />
      <HeroStatCard
        title="Burn / Mint Ratio"
        value={m ? `${m.burnMintPct.toFixed(0)}%` : D}
        caption="BEAN burnt vs minted, all time"
        isMobile={isMobile}
      />
      <HeroStatCard
        title="Days to Max Supply"
        value={daysToMax}
        caption="at the current emission pace"
        isMobile={isMobile}
      />
    </div>
  )
}
