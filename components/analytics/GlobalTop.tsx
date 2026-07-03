'use client'

import React from 'react'
import StatsPanel from './StatsPanel'
import PriceChart from './PriceChart'

// The top band of /global, modelled on the Blockworks token page: a heading, a
// left stats sidebar, and the BEAN price chart on the right.
export default function GlobalTop({ isMobile }: { isMobile: boolean }) {
  return (
    <div>
      <div style={{ marginBottom: isMobile ? 18 : 24 }}>
        <h1 style={{ fontSize: isMobile ? 26 : 34, fontWeight: 700, color: '#fff', margin: 0 }}>Global</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '288px 1fr',
          gap: isMobile ? 14 : 18,
          alignItems: 'stretch',
        }}
      >
        <StatsPanel isMobile={isMobile} />
        <PriceChart isMobile={isMobile} />
      </div>
    </div>
  )
}
