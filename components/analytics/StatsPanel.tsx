'use client'

import React from 'react'
import { useProtocolSummary } from '@/lib/protocolSummary'
import { fmtUsdCompact } from '@/lib/analyticsFormat'

const D = '—'

// Left-hand token stats, modelled on the Blockworks price page (minus the
// transparency rating, which the founder does not want).
export default function StatsPanel({ isMobile }: { isMobile: boolean }) {
  const { summary } = useProtocolSummary()

  const rows = [
    { label: 'Market Cap', value: summary ? fmtUsdCompact(summary.marketCapUsd) : D },
    { label: 'FDV', value: summary ? fmtUsdCompact(summary.fdvUsd) : D },
    { label: '24h Volume', value: summary ? fmtUsdCompact(summary.volume24h) : D },
  ]

  return (
    <div style={{ ...card, padding: isMobile ? '18px 20px' : '22px 24px' }}>
      <div style={heading}>Stats</div>
      <div>
        {rows.map((r, i) => (
          <div key={r.label} style={{ ...row, borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={labelStyle}>{r.label}</span>
            <span style={valueStyle}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  background: 'rgba(11,14,22,0.55)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  boxShadow: '0 0 44px rgba(0,82,255,0.05)',
  height: '100%',
}
const heading: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0' }
const labelStyle: React.CSSProperties = { fontSize: 13.5, color: '#8597b0' }
const valueStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: '#fff', fontVariantNumeric: 'tabular-nums' }
