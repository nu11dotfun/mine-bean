'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChartFrame, ChartXAxis } from './AnalyticsUI'
import { useLlamaRevenue } from '@/lib/defiLlama'
import { fmtUsdCompact } from '@/lib/analyticsFormat'
import { bucketize, bucketLabel, GRANULARITIES, Granularity } from '@/lib/timeBucket'

const W = 600
const P = 6
const BAR = '#4C82FF'
const MA7 = '#F5A623'
const MA30 = '#C5D82D'
const MA90 = '#2DD4BF'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function movingAvg(vals: number[], win: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < vals.length; i++) {
    sum += vals[i]
    if (i >= win) sum -= vals[i - win]
    out.push(i >= win - 1 ? sum / win : null)
  }
  return out
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

interface Point { t: number; usd: number; ma: (number | null)[] }

// Total protocol revenue over time: daily bars + 7/30/90-day moving averages,
// with a brush to backdate and a granularity dropdown. Bars aggregate to the
// chosen period; the MA lines are the daily MAs sampled at each period's end.
export default function RevenueOverTimeChart({ isMobile }: { isMobile: boolean }) {
  const rev = useLlamaRevenue()
  const [gran, setGran] = useState<Granularity>('Daily')

  const points: Point[] = useMemo(() => {
    const daily = rev?.daily ?? []
    const usd = daily.map((d) => d.usd)
    const ma = [movingAvg(usd, 7), movingAvg(usd, 30), movingAvg(usd, 90)]
    const aug = daily.map((d, i) => ({ t: d.t, usd: d.usd, ma: [ma[0][i], ma[1][i], ma[2][i]] as (number | null)[] }))
    return bucketize(aug, (d) => d.t, gran).map((b) => {
      const total = b.rows.reduce((a, r) => a + r.usd, 0)
      const last = b.rows[b.rows.length - 1]
      return { t: b.t, usd: total, ma: last.ma }
    })
  }, [rev, gran])

  const n = points.length

  const [win, setWin] = useState<{ start: number; end: number } | null>(null)
  useEffect(() => { setWin(points.length > 1 ? { start: 0, end: points.length - 1 } : null) }, [points])

  const [drag, setDrag] = useState<null | 'start' | 'end' | 'pan'>(null)
  const brushRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ x: number; start: number; end: number } | null>(null)
  const [hover, setHover] = useState<{ i: number; width: number } | null>(null)

  useEffect(() => {
    if (!drag) return
    const onMove = (e: MouseEvent) => {
      const rect = brushRef.current?.getBoundingClientRect()
      if (!rect || n < 2) return
      const idx = Math.round(clamp((e.clientX - rect.left) / rect.width, 0, 1) * (n - 1))
      setWin((w) => {
        if (!w) return w
        if (drag === 'start') return { start: clamp(idx, 0, w.end - 1), end: w.end }
        if (drag === 'end') return { start: w.start, end: clamp(idx, w.start + 1, n - 1) }
        const p = panRef.current
        if (!p) return w
        const delta = Math.round(((e.clientX - p.x) / rect.width) * (n - 1))
        const width = p.end - p.start
        const s = clamp(p.start + delta, 0, n - 1 - width)
        return { start: s, end: s + width }
      })
    }
    const onUp = () => { setDrag(null); panRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, n])

  const H = isMobile ? 200 : 260
  const BH = 38
  const axisW = isMobile ? 46 : 54
  const ready = n > 1 && !!win
  const start = win?.start ?? 0
  const end = win?.end ?? Math.max(0, n - 1)
  const wN = end - start + 1

  const wUsd = points.slice(start, end + 1).map((p) => p.usd)
  const wMa = [0, 1, 2].map((k) => points.slice(start, end + 1).map((p) => p.ma[k]))
  const wT = points.slice(start, end + 1).map((p) => p.t)

  let max = 1
  for (const v of wUsd) if (v > max) max = v
  for (const m of wMa) for (const v of m) if (v != null && v > max) max = v
  max *= 1.12
  const yFor = (v: number) => H - (v / max) * (H - P * 2) - P
  const xFor = (i: number) => (wN <= 1 ? 0 : (i / (wN - 1)) * W)
  const barW = wN > 1 ? Math.max(1, (W / wN) * 0.72) : W * 0.3
  const ticks = niceTicks(0, max)
  const linePts = (m: (number | null)[]) =>
    m.map((v, i) => (v != null && isFinite(v) ? `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}` : null)).filter(Boolean).join(' ')

  const allUsd = points.map((p) => p.usd)
  const bMax = allUsd.length ? Math.max(1, ...allUsd) : 1
  const bX = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W)
  const bY = (v: number) => BH - (v / bMax) * (BH - 4) - 2
  const brushArea = allUsd.map((v, i) => `${bX(i).toFixed(1)},${bY(v).toFixed(1)}`).join(' ')
  const startFrac = n > 1 ? start / (n - 1) : 0
  const endFrac = n > 1 ? end / (n - 1) : 1

  const onPlotMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || wN < 2) return
    setHover({ i: Math.round(clamp((e.clientX - rect.left) / rect.width, 0, 1) * (wN - 1)), width: rect.width })
  }

  const maRows = [
    { l: 'Total', c: BAR, v: hover ? wUsd[hover.i] : null },
    { l: '7D MA', c: MA7, v: hover ? wMa[0][hover.i] : null },
    { l: '30D MA', c: MA30, v: hover ? wMa[1][hover.i] : null },
    { l: '90D MA', c: MA90, v: hover ? wMa[2][hover.i] : null },
  ]

  return (
    <ChartFrame
      title="Total Protocol Revenue Over Time"
      description="Vault fees, used for buybacks and staking yield."
      unit="USD"
      granularity={gran}
      granularityOptions={GRANULARITIES as unknown as string[]}
      onGranularity={(g) => setGran(g as Granularity)}
      legend={[
        { color: BAR, label: 'Total', shape: 'bar' },
        { color: MA7, label: '7D MA', shape: 'line' },
        { color: MA30, label: '30D MA', shape: 'line' },
        { color: MA90, label: '90D MA', shape: 'line' },
      ]}
      isMobile={isMobile}
    >
      {!ready ? (
        <div style={{ height: H + BH + 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={spinner} />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ position: 'relative', width: axisW, height: H, flexShrink: 0, marginRight: 6 }}>
            {ticks.map((t) => (
              <span key={t} style={{ ...yLabel, top: yFor(t) }}>{fmtUsdCompact(t)}</span>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', height: H }} onMouseMove={onPlotMove} onMouseLeave={() => setHover(null)}>
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                {ticks.map((t) => (
                  <line key={t} x1="0" y1={yFor(t)} x2={W} y2={yFor(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                ))}
                {wUsd.map((v, i) => (
                  <rect key={i} x={xFor(i) - barW / 2} y={yFor(v)} width={barW} height={Math.max(0, H - P - yFor(v))} fill={BAR} opacity={0.82} />
                ))}
                {[{ m: wMa[0], c: MA7 }, { m: wMa[1], c: MA30 }, { m: wMa[2], c: MA90 }].map((s, idx) => {
                  const pts = linePts(s.m)
                  return pts ? <polyline key={idx} points={pts} fill="none" stroke={s.c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null
                })}
                <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke="rgba(255,255,255,0.16)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </svg>
              {hover && wUsd[hover.i] != null && (() => {
                const px = (hover.i / Math.max(1, wN - 1)) * hover.width
                const right = px > hover.width * 0.6
                return (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)', left: px }} />
                    <div style={{ position: 'absolute', top: 6, left: right ? px - 10 : px + 10, transform: right ? 'translateX(-100%)' : 'none', background: 'rgba(10,14,24,0.94)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 9px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{bucketLabel(wT[hover.i], gran)}</div>
                      {maRows.map((r) => (r.v != null && isFinite(r.v) ? (
                        <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.c }} />
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{r.l}</span>
                          <span style={{ color: '#fff', fontFamily: "'Space Mono', monospace", marginLeft: 'auto', paddingLeft: 12 }}>{fmtUsdCompact(r.v)}</span>
                        </div>
                      ) : null))}
                    </div>
                  </div>
                )
              })()}
            </div>

            <ChartXAxis times={wT} granularity={gran} isMobile={isMobile} />

            <div ref={brushRef} style={brushWrap}>
              <svg width="100%" height={BH} viewBox={`0 0 ${W} ${BH}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                <polygon points={`0,${BH} ${brushArea} ${W},${BH}`} fill="rgba(76,130,255,0.16)" />
                <polyline points={brushArea} fill="none" stroke="rgba(76,130,255,0.45)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </svg>
              <div style={{ ...brushMask, left: 0, width: `${startFrac * 100}%` }} />
              <div style={{ ...brushMask, right: 0, width: `${(1 - endFrac) * 100}%` }} />
              <div
                onMouseDown={(e) => { panRef.current = { x: e.clientX, start, end }; setDrag('pan') }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: `${startFrac * 100}%`, width: `${(endFrac - startFrac) * 100}%`, cursor: 'grab' }}
              />
              <div onMouseDown={() => setDrag('start')} style={{ ...handle, left: `${startFrac * 100}%` }} />
              <div onMouseDown={() => setDrag('end')} style={{ ...handle, left: `${endFrac * 100}%`, transform: 'translateX(-100%)' }} />
            </div>
          </div>
        </div>
      )}
    </ChartFrame>
  )
}

const yLabel: React.CSSProperties = { position: 'absolute', left: 0, transform: 'translateY(-50%)', fontSize: 10.5, color: 'rgba(255,255,255,0.42)', fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' }
const brushWrap: React.CSSProperties = { position: 'relative', height: 38, marginTop: 12, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', userSelect: 'none' }
const brushMask: React.CSSProperties = { position: 'absolute', top: 0, bottom: 0, background: 'rgba(8,11,20,0.55)' }
const handle: React.CSSProperties = { position: 'absolute', top: 0, bottom: 0, width: 9, borderRadius: 3, background: BAR, cursor: 'ew-resize', boxShadow: '0 0 0 1px rgba(8,11,20,0.55)' }
const spinner: React.CSSProperties = { width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(76,130,255,0.25)', borderTopColor: BAR, animation: 'spin 0.8s linear infinite' }
