'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { ChartFrame, ChartLegendItem, ChartXAxis } from './AnalyticsUI'

export interface ChartLine {
  values: (number | null)[]
  color: string
  width?: number
  fill?: boolean
  opacity?: number
  name?: string
}

export interface ChartBar {
  values: (number | null)[]
  color: string
  name?: string
  opacity?: number
}

interface AnalyticsChartProps {
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
  footnote?: string
  bars?: ChartBar[]
  lines: ChartLine[]
  labels?: string[]
  axisTimes?: number[]
  brush?: boolean
  brushDefaultFull?: boolean
  zeroLine?: boolean
  height?: number
  loading?: boolean
  empty?: boolean
  emptyText?: string
  legend?: ChartLegendItem[]
  pointLabels?: string[]
  valueFormat?: (v: number) => string
  isMobile?: boolean
}

const W = 600
const PAD = 6
const BH = 34
const TWO_WEEKS = 14 * 86400 * 1000
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export default function AnalyticsChart({
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
  footnote,
  bars = [],
  lines,
  labels,
  axisTimes,
  brush = false,
  brushDefaultFull = false,
  zeroLine = false,
  height = 220,
  loading = false,
  empty = false,
  emptyText = 'No data',
  legend,
  pointLabels,
  valueFormat,
  isMobile,
}: AnalyticsChartProps) {
  const gid = useId().replace(/:/g, '')
  const H = height
  const [hover, setHover] = useState<{ index: number; width: number } | null>(null)

  const fullN = Math.max(...lines.map((l) => l.values.length), ...bars.map((b) => b.values.length), 1)

  // ── Brush window: defaults to the last ~2 weeks; drag to expand to all time ──
  const [win, setWin] = useState<{ start: number; end: number } | null>(null)
  useEffect(() => {
    if (!brush || fullN < 2) { setWin(null); return }
    // Dense (daily) data opens on the last ~2 weeks; sparse data
    // (weekly / monthly / quarterly) opens on the full range so the window never
    // collapses to a single bucket when granularity changes.
    let start = 0
    if (!brushDefaultFull && fullN > 24 && axisTimes && axisTimes.length === fullN) {
      const cutoff = axisTimes[fullN - 1] - TWO_WEEKS
      const idx = axisTimes.findIndex((t) => t >= cutoff)
      if (idx > 0 && fullN - idx >= 4) start = idx
    }
    setWin({ start, end: fullN - 1 })
  }, [brush, brushDefaultFull, fullN, axisTimes])

  const [drag, setDrag] = useState<null | 'start' | 'end' | 'pan'>(null)
  const brushRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ x: number; start: number; end: number } | null>(null)
  useEffect(() => {
    if (!drag) return
    const onMove = (e: MouseEvent) => {
      const rect = brushRef.current?.getBoundingClientRect()
      if (!rect || fullN < 2) return
      const idx = Math.round(clamp((e.clientX - rect.left) / rect.width, 0, 1) * (fullN - 1))
      setWin((w) => {
        if (!w) return w
        if (drag === 'start') return { start: clamp(idx, 0, w.end - 1), end: w.end }
        if (drag === 'end') return { start: w.start, end: clamp(idx, w.start + 1, fullN - 1) }
        const p = panRef.current
        if (!p) return w
        const delta = Math.round(((e.clientX - p.x) / rect.width) * (fullN - 1))
        const width = p.end - p.start
        const s = clamp(p.start + delta, 0, fullN - 1 - width)
        return { start: s, end: s + width }
      })
    }
    const onUp = () => { setDrag(null); panRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [drag, fullN])

  const brushed = brush && !!win && fullN > 1
  const start = brushed ? win!.start : 0
  const end = brushed ? win!.end : fullN - 1
  const n = end - start + 1

  const wBars = bars.map((b) => ({ ...b, values: b.values.slice(start, end + 1) }))
  const wLines = lines.map((l) => ({ ...l, values: l.values.slice(start, end + 1) }))
  const wAxisTimes = axisTimes ? axisTimes.slice(start, end + 1) : undefined
  const wPointLabels = pointLabels ? pointLabels.slice(start, end + 1) : undefined

  // Value domain across the visible window only, so the y-axis fits what's shown.
  const all: number[] = []
  for (const b of wBars) for (const v of b.values) if (v != null && isFinite(v)) all.push(v)
  for (const ln of wLines) for (const v of ln.values) if (v != null && isFinite(v)) all.push(v)
  let min = all.length ? Math.min(...all) : 0
  let max = all.length ? Math.max(...all) : 1
  if (zeroLine) { min = Math.min(min, 0); max = Math.max(max, 0) }
  if (min === max) max = min + 1
  const padSpan = (max - min) * 0.12
  min -= padSpan
  max += padSpan
  const range = max - min

  const xFor = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W)
  const yFor = (v: number) => H - ((v - min) / range) * (H - PAD * 2) - PAD
  const ticks = niceTicks(min, max)
  const fmtTick = (v: number) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(1))
  const barW = n > 1 ? Math.max(1, (W / n) * 0.6) : W * 0.4

  const pointsFor = (values: (number | null)[]) =>
    values.map((v, i) => (v != null && isFinite(v) ? `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}` : null)).filter(Boolean).join(' ')

  const showChart = !loading && !empty && all.length > 0
  const zeroY = yFor(0)
  const baseY = zeroLine ? zeroY : H - PAD
  const fmtVal = (v: number) => (valueFormat ? valueFormat(v) : v.toFixed(2))
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || n <= 1) return
    setHover({ index: Math.round(clamp((e.clientX - rect.left) / rect.width, 0, 1) * (n - 1)), width: rect.width })
  }

  // Brush strip preview across the whole series (first bar, else first line).
  const brushEls = brushed ? (() => {
    const series = (bars[0]?.values ?? lines[0]?.values ?? []).map((v) => (v != null && isFinite(v) ? v : 0))
    const fMax = series.length ? Math.max(1, ...series.map((v) => Math.abs(v))) : 1
    const bX = (i: number) => (fullN <= 1 ? 0 : (i / (fullN - 1)) * W)
    const bY = (v: number) => BH - (Math.abs(v) / fMax) * (BH - 4) - 2
    return {
      area: series.map((v, i) => `${bX(i).toFixed(1)},${bY(v).toFixed(1)}`).join(' '),
      sFrac: fullN > 1 ? start / (fullN - 1) : 0,
      eFrac: fullN > 1 ? end / (fullN - 1) : 1,
    }
  })() : null

  const plot = showChart ? (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ ...styles.yAxis, height: H }}>
          {ticks.map((t) => (
            <span key={t} style={{ ...styles.yLabel, top: yFor(t) }}>{fmtTick(t)}</span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
              <defs>
                {wLines.map((ln, idx) => ln.fill ? (
                  <linearGradient key={idx} id={`${gid}-fill-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ln.color} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={ln.color} stopOpacity="0" />
                  </linearGradient>
                ) : null)}
              </defs>
              {ticks.map((t) => (
                <line key={t} x1="0" y1={yFor(t)} x2={W} y2={yFor(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              ))}
              {wBars.map((b, bi) => b.values.map((v, i) => v != null && isFinite(v) ? (
                <rect key={`${bi}-${i}`} x={xFor(i) - barW / 2} y={Math.min(yFor(v), baseY)} width={barW} height={Math.abs(baseY - yFor(v))} fill={b.color} opacity={b.opacity ?? 0.85} />
              ) : null))}
              {zeroLine && (
                <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="5,5" />
              )}
              {wLines.map((ln, idx) => {
                const pts = pointsFor(ln.values)
                if (!pts) return null
                const first = ln.values.findIndex((v) => v != null)
                const lastI = ln.values.length - 1 - [...ln.values].reverse().findIndex((v) => v != null)
                return (
                  <g key={idx}>
                    {ln.fill && <polygon points={`${xFor(first).toFixed(1)},${H} ${pts} ${xFor(lastI).toFixed(1)},${H}`} fill={`url(#${gid}-fill-${idx})`} />}
                    <polyline points={pts} fill="none" stroke={ln.color} strokeWidth={ln.width ?? 2.5} strokeOpacity={ln.opacity ?? 1} strokeLinejoin="round" strokeLinecap="round" />
                  </g>
                )
              })}
            </svg>

            {hover && (() => {
              const px = (hover.index / Math.max(1, n - 1)) * hover.width
              const anchorRight = px > hover.width * 0.6
              return (
                <div style={styles.overlay}>
                  <div style={{ ...styles.crosshair, left: px }} />
                  {wLines.map((ln, i) => {
                    const v = ln.values[hover.index]
                    if (v == null || !isFinite(v)) return null
                    return <div key={i} style={{ ...styles.dot, background: ln.color, left: px, top: yFor(v) }} />
                  })}
                  <div style={{ ...styles.tooltip, left: anchorRight ? px - 10 : px + 10, transform: anchorRight ? 'translateX(-100%)' : 'none' }}>
                    {wPointLabels && wPointLabels[hover.index] && <div style={styles.ttHeader}>{wPointLabels[hover.index]}</div>}
                    {wBars.map((b, i) => {
                      const v = b.values[hover.index]
                      if (v == null || !isFinite(v)) return null
                      return (
                        <div key={`b${i}`} style={styles.ttRow}>
                          <span style={{ ...styles.ttDot, background: b.color }} />
                          <span style={styles.ttName}>{b.name ?? `Bars ${i + 1}`}</span>
                          <span style={styles.ttVal}>{fmtVal(v)}</span>
                        </div>
                      )
                    })}
                    {wLines.map((ln, i) => {
                      const v = ln.values[hover.index]
                      if (v == null || !isFinite(v)) return null
                      return (
                        <div key={i} style={styles.ttRow}>
                          <span style={{ ...styles.ttDot, background: ln.color }} />
                          <span style={styles.ttName}>{ln.name ?? `Series ${i + 1}`}</span>
                          <span style={styles.ttVal}>{fmtVal(v)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>

          {wAxisTimes && wAxisTimes.length > 1 ? (
            <ChartXAxis times={wAxisTimes} granularity={granularity} isMobile={isMobile} />
          ) : labels && labels.length > 1 ? (
            <div style={styles.axis}>
              <span>{labels[0]}</span>
              <span>{labels[labels.length - 1]}</span>
            </div>
          ) : null}

          {brushEls && (
            <div ref={brushRef} style={styles.brushWrap}>
              <svg width="100%" height={BH} viewBox={`0 0 ${W} ${BH}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                <polygon points={`0,${BH} ${brushEls.area} ${W},${BH}`} fill="rgba(76,130,255,0.16)" />
                <polyline points={brushEls.area} fill="none" stroke="rgba(76,130,255,0.45)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </svg>
              <div style={{ ...styles.brushMask, left: 0, width: `${brushEls.sFrac * 100}%` }} />
              <div style={{ ...styles.brushMask, right: 0, width: `${(1 - brushEls.eFrac) * 100}%` }} />
              <div
                onMouseDown={(e) => { panRef.current = { x: e.clientX, start, end }; setDrag('pan') }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: `${brushEls.sFrac * 100}%`, width: `${(brushEls.eFrac - brushEls.sFrac) * 100}%`, cursor: 'grab' }}
              />
              <div onMouseDown={() => setDrag('start')} style={{ ...styles.brushHandle, left: `${brushEls.sFrac * 100}%` }} />
              <div onMouseDown={() => setDrag('end')} style={{ ...styles.brushHandle, left: `${brushEls.eFrac * 100}%`, transform: 'translateX(-100%)' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div style={{ ...styles.state, height: H }}>
      {loading ? <span style={styles.spinner} /> : <span style={styles.emptyText}>{emptyText}</span>}
    </div>
  )

  return (
    <ChartFrame
      title={title}
      info={info}
      description={description}
      unit={unit}
      granularity={granularity}
      unitOptions={unitOptions}
      onUnit={onUnit}
      granularityOptions={granularityOptions}
      onGranularity={onGranularity}
      headline={headline}
      legend={showChart ? legend : undefined}
      footnote={footnote}
      isMobile={isMobile}
    >
      {plot}
    </ChartFrame>
  )
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1
  const step0 = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const start = Math.ceil(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Number(v.toFixed(6)))
  return out
}

const styles: { [key: string]: React.CSSProperties } = {
  yAxis: { position: 'relative', width: 38, flexShrink: 0 },
  yLabel: {
    position: 'absolute',
    right: 8,
    transform: 'translateY(-50%)',
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: "'Space Mono', monospace",
    whiteSpace: 'nowrap',
  },
  overlay: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  crosshair: { position: 'absolute', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.25)' },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    marginLeft: -4,
    marginTop: -4,
    borderRadius: '50%',
    border: '1.5px solid rgba(8,11,20,0.9)',
    boxShadow: '0 0 6px rgba(0,0,0,0.4)',
  },
  tooltip: {
    position: 'absolute',
    top: 8,
    background: 'rgba(10,14,24,0.92)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '7px 9px',
    whiteSpace: 'nowrap',
    zIndex: 2,
  },
  ttHeader: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  ttRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 },
  ttDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  ttName: { color: 'rgba(255,255,255,0.6)' },
  ttVal: { color: '#fff', fontFamily: "'Space Mono', monospace", marginLeft: 'auto', paddingLeft: 12 },
  state: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid rgba(0,82,255,0.25)',
    borderTopColor: '#0052FF',
    animation: 'spin 0.8s linear infinite',
  },
  axis: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 8,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: "'Space Mono', monospace",
  },
  brushWrap: {
    position: 'relative',
    height: 34,
    marginTop: 12,
    borderRadius: 6,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden',
    userSelect: 'none',
  },
  brushMask: { position: 'absolute', top: 0, bottom: 0, background: 'rgba(8,11,20,0.55)' },
  brushHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 9,
    borderRadius: 3,
    background: '#4C82FF',
    cursor: 'ew-resize',
    boxShadow: '0 0 0 1px rgba(8,11,20,0.55)',
  },
}
