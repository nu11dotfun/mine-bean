'use client'

import React, { useState, useRef, useEffect } from 'react'
import { bucketLabel, Granularity } from '@/lib/timeBucket'

// ── Small glyphs ──────────────────────────────────────────────────────────

export function InfoIcon({ title }: { title?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7789" strokeWidth="1.8" style={{ flexShrink: 0 }}>
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" strokeLinecap="round" />
      <circle cx="12" cy="7.6" r="0.4" fill="#6b7789" stroke="#6b7789" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ opacity: 0.6 }}>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Dropdown for the unit / granularity chips. Closes on outside click.
export function Dropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ ...chip, cursor: 'pointer', fontFamily: 'inherit' }}>
        {value}<Chevron />
      </button>
      {open && (
        <div style={menu}>
          {options.map((o) => (
            <button key={o} onClick={() => { onChange(o); setOpen(false) }} style={{ ...menuItem, ...(o === value ? menuItemOn : {}) }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared date x-axis (two-line: date + year), used by every dated chart ──

export function ChartXAxis({ times, granularity, isMobile }: { times: number[]; granularity?: string; isMobile?: boolean }) {
  const n = times.length
  if (n < 2) return null
  const count = isMobile ? 4 : 7
  const coarse = granularity === 'Monthly' || granularity === 'Quarterly'
  const labels: { primary: string; secondary: string }[] = []
  for (let k = 0; k < count; k++) {
    const t = times[Math.round((k / (count - 1)) * (n - 1))]
    const d = new Date(t)
    if (coarse) labels.push({ primary: bucketLabel(t, granularity as Granularity), secondary: '' })
    else labels.push({ primary: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }), secondary: String(d.getUTCFullYear()) })
  }
  return (
    <div style={xAxisStyle}>
      {labels.map((l, i) => (
        <div key={i} style={xTickStyle}>
          <span style={xPrimaryStyle}>{l.primary}</span>
          {l.secondary ? <span style={xSecondaryStyle}>{l.secondary}</span> : null}
        </div>
      ))}
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────────────

export function SectionHeader({ title, description, isMobile }: { title: string; description?: string; isMobile?: boolean }) {
  return (
    <div style={{ marginBottom: isMobile ? 16 : 22 }}>
      <h2 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: '#fff', margin: 0, marginBottom: description ? 6 : 0 }}>
        {title}
      </h2>
      {description && <p style={{ fontSize: isMobile ? 13 : 15, color: '#8597b0', margin: 0 }}>{description}</p>}
    </div>
  )
}

// ── Chart card chrome ───────────────────────────────────────────────────────

export interface ChartLegendItem {
  color: string
  label: string
  shape?: 'bar' | 'line'
}

export function ChartFrame({
  title,
  info,
  description,
  unit,
  granularity,
  unitOptions,
  onUnit,
  granularityOptions,
  onGranularity,
  headline,
  legend,
  footnote,
  isMobile,
  children,
}: {
  title: string
  info?: string
  description?: string
  unit?: string
  granularity?: string
  unitOptions?: string[]
  onUnit?: (u: string) => void
  granularityOptions?: string[]
  onGranularity?: (g: string) => void
  headline?: string
  legend?: ChartLegendItem[]
  footnote?: string
  isMobile?: boolean
  children: React.ReactNode
}) {
  const legendItems = legend && legend.length > 0 ? legend : null
  // Only show a chip when it's an actual multi-option dropdown. A single fixed
  // unit (ETH / BEAN) or granularity has nothing to switch to, so show nothing.
  const unitDropdown = unit && unitOptions && unitOptions.length > 1 && onUnit
    ? <Dropdown value={unit} options={unitOptions} onChange={onUnit} />
    : null
  const granDropdown = granularity && granularityOptions && granularityOptions.length > 1 && onGranularity
    ? <Dropdown value={granularity} options={granularityOptions} onChange={onGranularity} />
    : null
  return (
    <div style={{ ...frameCard, padding: isMobile ? '16px 16px 18px' : '20px 22px 22px' }}>
      <div style={frameHead}>
        <div style={{ minWidth: 0 }}>
          <div style={frameTitleRow}>
            <span style={frameTitle}>{title}</span>
            {info && <InfoIcon title={info} />}
          </div>
          {description && <div style={frameDesc}>{description}</div>}
        </div>
        {headline && <span style={frameHeadline}>{headline}</span>}
      </div>

      {(unitDropdown || granDropdown) && (
        <div style={chipRow}>
          {unitDropdown}
          {granDropdown}
        </div>
      )}

      {legendItems && (
        <div style={legendTop}>
          {legendItems.map((l) => (
            <span key={l.label} style={legendItem}>
              <span style={{ ...legendMark, ...(l.shape === 'line' ? { height: 3, borderRadius: 2 } : {}), background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: legendItems ? 10 : 16 }}>{children}</div>

      {footnote && <div style={frameFootnote}>{footnote}</div>}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const frameCard: React.CSSProperties = {
  position: 'relative',
  background: 'rgba(11,14,22,0.55)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  boxShadow: '0 0 44px rgba(0,82,255,0.05)',
  overflow: 'hidden',
}
const frameHead: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }
const frameTitleRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7 }
const frameTitle: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }
const frameDesc: React.CSSProperties = { fontSize: 13, color: '#8597b0', marginTop: 5, lineHeight: 1.45 }
const frameHeadline: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 500,
  color: '#fff',
  fontFamily: "'Space Mono', monospace",
  whiteSpace: 'nowrap',
  flexShrink: 0,
}
const chipRow: React.CSSProperties = { display: 'flex', gap: 8, marginTop: 14 }
const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 12.5,
  color: '#b8c2d4',
  fontWeight: 500,
}
const menu: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  minWidth: 128,
  background: 'rgba(16,20,30,0.98)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: 5,
  zIndex: 20,
  boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
}
const menuItem: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  color: '#b8c2d4',
  cursor: 'pointer',
  fontWeight: 500,
}
const menuItemOn: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', color: '#fff' }
const xAxisStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', marginTop: 10 }
const xTickStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }
const xPrimaryStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: '#c4cddd' }
const xSecondaryStyle: React.CSSProperties = { fontSize: 10.5, color: '#5f6b7e' }
const legendTop: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14 }
const legendItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#8597b0' }
const legendMark: React.CSSProperties = { width: 11, height: 11, borderRadius: 3, flexShrink: 0 }
const frameFootnote: React.CSSProperties = { marginTop: 14, fontSize: 11, lineHeight: 1.5, color: '#5b6b85' }
