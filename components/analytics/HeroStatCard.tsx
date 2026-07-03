'use client'

import React from 'react'

// Big headline stat, modelled on Blockworks' hero cards: title (and optional
// subtitle) top-left, a large centred value, and a caption beneath it.
export default function HeroStatCard({
  title,
  subtitle,
  value,
  caption,
  delta,
  accent = 'default',
  isMobile,
}: {
  title: string
  subtitle?: string
  value: string
  caption: string
  delta?: string
  accent?: 'default' | 'green'
  isMobile?: boolean
}) {
  return (
    <div style={{ ...card, minHeight: isMobile ? 152 : 226, padding: isMobile ? '20px 22px' : '26px 30px' }}>
      <div>
        <div style={titleStyle}>{title}</div>
        {subtitle && <div style={subtitleStyle}>{subtitle}</div>}
      </div>
      <div style={middle}>
        <div style={{ ...valueStyle, fontSize: isMobile ? 42 : 66, color: accent === 'green' ? '#4ADE80' : '#fff' }}>
          {value}
        </div>
        <div style={captionRow}>
          <span style={captionStyle}>{caption}</span>
          {delta && <span style={{ ...deltaStyle, color: delta.startsWith('-') ? '#F87171' : '#4ADE80' }}>{delta}</span>}
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'rgba(11,14,22,0.55)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  boxShadow: '0 0 44px rgba(0,82,255,0.05)',
}
const titleStyle: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: '#fff' }
const subtitleStyle: React.CSSProperties = { fontSize: 12.5, color: '#6b7789', marginTop: 4 }
const middle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: '18px 0 6px',
}
const valueStyle: React.CSSProperties = { fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1, textAlign: 'center' }
const captionRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }
const captionStyle: React.CSSProperties = { fontSize: 14, color: '#8597b0', textAlign: 'center' }
const deltaStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: '#4ADE80',
  fontFamily: "'Space Mono', monospace",
}
