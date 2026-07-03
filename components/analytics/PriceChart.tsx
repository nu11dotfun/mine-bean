'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { fetchBeanPriceHistory, Candle, Timeframe, TIMEFRAMES } from '@/lib/priceHistory'
import { useProtocolSummary } from '@/lib/protocolSummary'
import { fmtUsdCompact } from '@/lib/analyticsFormat'

const LINE = '#4C82FF'
const GREEN = '#4ADE80'
const RED = '#F87171'
const W = 800
const P = 8

const fmtPrice = (v: number) =>
  '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })

function fmtAxisDate(t: number, tf: Timeframe): { primary: string; secondary: string } {
  const d = new Date(t)
  if (tf === '1D') return { primary: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), secondary: '' }
  if (tf === '1Y' || tf === 'ALL') return { primary: d.toLocaleDateString('en-GB', { month: 'short' }), secondary: String(d.getFullYear()) }
  return { primary: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), secondary: String(d.getFullYear()) }
}

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1
  const step0 = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const start = Math.ceil(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Number(v.toFixed(8)))
  return out
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={up ? GREEN : RED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: up ? 'none' : 'rotate(180deg)' }} aria-hidden="true">
      <path d="M12 5v14M6 11l6-6 6 6" />
    </svg>
  )
}

function DownTri() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
      <path d="M8 11 1.5 1.5 14.5 1.5Z" fill="#0a0d15" stroke="rgba(255,255,255,0.5)" strokeWidth="0.9" strokeLinejoin="round" />
    </svg>
  )
}

export default function PriceChart({ isMobile }: { isMobile: boolean }) {
  const { summary } = useProtocolSummary()
  const [tf, setTf] = useState<Timeframe>('7D')
  const [mode, setMode] = useState<'price' | 'mcap'>('price')
  const [candles, setCandles] = useState<Candle[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState<{ index: number; width: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchBeanPriceHistory(tf).then((c) => {
      if (cancelled) return
      setCandles(c)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [tf])

  const circ = summary?.circulatingSupply ?? 0
  const series = useMemo(() => {
    const cs = candles ?? []
    return cs.map((c) => ({ t: c.t, v: mode === 'mcap' ? c.close * circ : c.close }))
  }, [candles, mode, circ])

  const H = isMobile ? 230 : 330
  const n = series.length
  const vals = series.map((s) => s.v)
  let min = vals.length ? Math.min(...vals) : 0
  let max = vals.length ? Math.max(...vals) : 1
  if (min === max) max = min + 1
  const pad = (max - min) * 0.12
  min -= pad
  max += pad
  const range = max - min
  const xFor = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W)
  const yFor = (v: number) => H - ((v - min) / range) * (H - P * 2) - P
  const ticks = niceTicks(min, max)

  const pts = series.map((s, i) => `${xFor(i).toFixed(1)},${yFor(s.v).toFixed(1)}`).join(' ')

  // Headline value + change over the selected window.
  const firstV = series[0]?.v
  const lastV = series[n - 1]?.v
  const headlineNow = mode === 'price'
    ? (summary?.beanUsd ?? lastV ?? 0)
    : (summary?.marketCapUsd ?? lastV ?? 0)
  const winChange = firstV != null && lastV != null && firstV !== 0 ? ((lastV - firstV) / firstV) * 100 : (summary?.beanChange24h ?? 0)
  const winDollar = firstV != null && lastV != null ? lastV - firstV : 0
  const up = winChange >= 0

  // Range indicator (low / current / high across the window).
  const lo = vals.length ? Math.min(...vals) : 0
  const hi = vals.length ? Math.max(...vals) : 0
  const cur = lastV ?? headlineNow
  const rangePos = hi > lo ? Math.min(1, Math.max(0, (cur - lo) / (hi - lo))) : 0.5

  const fmtV = (v: number) => (mode === 'price' ? fmtPrice(v) : fmtUsdCompact(v))

  const labelCount = isMobile ? 4 : 7
  const dateLabels = useMemo(() => {
    if (n < 2) return [] as { primary: string; secondary: string }[]
    const out: { primary: string; secondary: string }[] = []
    for (let k = 0; k < labelCount; k++) {
      const idx = Math.round((k / (labelCount - 1)) * (n - 1))
      out.push(fmtAxisDate(series[idx].t, tf))
    }
    return out
  }, [series, n, tf, labelCount])

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || n <= 1) return
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover({ index: Math.round(frac * (n - 1)), width: rect.width })
  }

  const showChart = !loading && n > 0
  const axisW = isMobile ? 50 : 62

  return (
    <div style={{ ...card, padding: isMobile ? '16px 16px 18px' : '20px 24px 22px' }}>
      {/* Header: pair, price, change  +  range */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={pair}>BEAN / ETH</div>
          <div style={{ ...price, fontSize: isMobile ? 30 : 40 }}>{fmtV(headlineNow)}</div>
          <div style={{ ...changeRow, color: up ? GREEN : RED }}>
            <span>{fmtV(Math.abs(winDollar))}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Arrow up={up} />
              {Math.abs(winChange).toFixed(2)}%
            </span>
          </div>
        </div>
        {!isMobile && vals.length > 0 && (
          <div style={rangeBox}>
            <div style={rangeTrackWrap}>
              <div style={rangeTrack} />
              <div style={{ ...rangeFill, width: `${rangePos * 100}%` }} />
              <div style={{ ...rangeMarker, left: `${rangePos * 100}%` }}><DownTri /></div>
            </div>
            <div style={rangeLabels}>
              <span style={rangeVal}>{fmtV(lo)}</span>
              <span style={rangeMid}>{tf} range</span>
              <span style={rangeVal}>{fmtV(hi)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls: price/mcap toggle  +  timeframes + external link */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <div style={toggleWrap}>
          <button style={{ ...toggleBtn, ...(mode === 'price' ? toggleOn : {}) }} onClick={() => setMode('price')}>Price</button>
          <button style={{ ...toggleBtn, ...(mode === 'mcap' ? toggleOn : {}) }} onClick={() => setMode('mcap')}>Market Cap</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {TIMEFRAMES.map((t) => (
            <button key={t} style={{ ...tfBtn, ...(t === tf ? tfOn : {}) }} onClick={() => setTf(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ marginTop: 18 }}>
        {showChart ? (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', width: axisW, height: H, flexShrink: 0, marginRight: 6 }}>
              {ticks.map((t) => (
                <span key={t} style={{ ...yLabel, top: yFor(t) }}>{mode === 'price' ? '$' + t.toFixed(2) : fmtUsdCompact(t)}</span>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ position: 'relative', height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
                <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                  <defs>
                    <linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={LINE} stopOpacity="0.28" />
                      <stop offset="100%" stopColor={LINE} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {ticks.map((t) => (
                    <line key={t} x1="0" y1={yFor(t)} x2={W} y2={yFor(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  ))}
                  {n > 1 && (
                    <polygon points={`${xFor(0).toFixed(1)},${H} ${pts} ${xFor(n - 1).toFixed(1)},${H}`} fill="url(#pc-fill)" />
                  )}
                  <polyline points={pts} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke="rgba(255,255,255,0.16)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                </svg>

                {hover && series[hover.index] && (() => {
                  const px = (hover.index / Math.max(1, n - 1)) * hover.width
                  const v = series[hover.index].v
                  const anchorRight = px > hover.width * 0.6
                  return (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.22)', left: px }} />
                      <div style={{ position: 'absolute', width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, borderRadius: '50%', background: LINE, border: '2px solid rgba(8,11,20,0.9)', left: px, top: yFor(v) }} />
                      <div style={{ position: 'absolute', top: 6, left: anchorRight ? px - 10 : px + 10, transform: anchorRight ? 'translateX(-100%)' : 'none', background: 'rgba(10,14,24,0.94)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 9px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
                          {new Date(series[hover.index].t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: tf === '1D' ? '2-digit' : undefined, minute: tf === '1D' ? '2-digit' : undefined })}
                        </div>
                        <div style={{ fontSize: 13, color: '#fff', fontFamily: "'Space Mono', monospace" }}>{fmtV(v)}</div>
                      </div>
                    </div>
                  )
                })()}
              </div>
              {dateLabels.length > 0 && (
                <div style={xAxis}>
                  {dateLabels.map((l, i) => (
                    <div key={i} style={xTick}>
                      <span style={xPrimary}>{l.primary}</span>
                      {l.secondary ? <span style={xSecondary}>{l.secondary}</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? <span style={spinner} /> : <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>No price data</span>}
          </div>
        )}
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  background: 'rgba(11,14,22,0.55)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  boxShadow: '0 0 44px rgba(0,82,255,0.05)',
}
const pair: React.CSSProperties = { fontSize: 12.5, color: '#8597b0', letterSpacing: '0.06em', fontWeight: 500 }
const price: React.CSSProperties = { fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.05 }
const changeRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 15, fontWeight: 500 }
const rangeBox: React.CSSProperties = { width: 235, paddingTop: 4 }
const rangeTrackWrap: React.CSSProperties = { position: 'relative', height: 14, marginTop: 10 }
const rangeTrack: React.CSSProperties = { position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.14)' }
const rangeFill: React.CSSProperties = { position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: 6, borderRadius: 3, background: LINE }
const rangeMarker: React.CSSProperties = { position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', lineHeight: 0 }
const rangeLabels: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', marginTop: 9, fontSize: 12 }
const rangeVal: React.CSSProperties = { color: '#dbe2ee' }
const rangeMid: React.CSSProperties = { color: '#6b7789' }
const toggleWrap: React.CSSProperties = { display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: 2 }
const toggleBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#8597b0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, padding: '6px 13px', borderRadius: 5 }
const toggleOn: React.CSSProperties = { background: 'rgba(76,130,255,0.16)', color: '#fff' }
const tfBtn: React.CSSProperties = { background: 'transparent', border: '1px solid transparent', color: '#8597b0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, padding: '5px 9px', borderRadius: 6 }
const tfOn: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff' }
const xAxis: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', marginTop: 12 }
const xTick: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }
const xPrimary: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#c4cddd' }
const xSecondary: React.CSSProperties = { fontSize: 11, color: '#5f6b7e' }
const yLabel: React.CSSProperties = { position: 'absolute', left: 0, transform: 'translateY(-50%)', fontSize: 11, color: 'rgba(255,255,255,0.42)', fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' }
const spinner: React.CSSProperties = { width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(76,130,255,0.25)', borderTopColor: LINE, animation: 'spin 0.8s linear infinite' }
