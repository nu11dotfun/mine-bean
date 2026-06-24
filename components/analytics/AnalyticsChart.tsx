'use client'

import React, { useId, useState } from 'react'

export interface ChartLine {
  values: (number | null)[]
  color: string
  width?: number
  fill?: boolean
  opacity?: number
  name?: string
}

interface AnalyticsChartProps {
  title: string
  headline?: string
  footnote?: string
  lines: ChartLine[]
  labels?: string[]
  zeroLine?: boolean
  height?: number
  loading?: boolean
  empty?: boolean
  emptyText?: string
  periods?: string[]
  activePeriod?: string
  onPeriod?: (p: string) => void
  legend?: { color: string; label: string }[]
  pointLabels?: string[]
  valueFormat?: (v: number) => string
}

const W = 600
const PAD = 6

export default function AnalyticsChart({
  title,
  headline,
  footnote,
  lines,
  labels,
  zeroLine = false,
  height = 220,
  loading = false,
  empty = false,
  emptyText = 'No data',
  periods,
  activePeriod,
  onPeriod,
  legend,
  pointLabels,
  valueFormat,
}: AnalyticsChartProps) {
  const gid = useId().replace(/:/g, '')
  const [hover, setHover] = useState<{ index: number; width: number } | null>(null)
  const H = height

  // Global value domain across every line, ignoring nulls.
  const all: number[] = []
  for (const ln of lines) for (const v of ln.values) if (v != null && isFinite(v)) all.push(v)
  let min = all.length ? Math.min(...all) : 0
  let max = all.length ? Math.max(...all) : 1
  if (zeroLine) {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  if (min === max) max = min + 1
  const padSpan = (max - min) * 0.12
  min -= padSpan
  max += padSpan
  const range = max - min
  const n = Math.max(...lines.map((l) => l.values.length), 1)

  const xFor = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W)
  const yFor = (v: number) => H - ((v - min) / range) * (H - PAD * 2) - PAD
  const ticks = niceTicks(min, max)
  const fmtTick = (v: number) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(1))

  // Build a polyline points string, skipping null gaps (MA warm-up).
  const pointsFor = (values: (number | null)[]) =>
    values
      .map((v, i) => (v != null && isFinite(v) ? `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}` : null))
      .filter(Boolean)
      .join(' ')

  const showChart = !loading && !empty && all.length > 0
  const zeroY = yFor(0)
  const fmtVal = (v: number) => (valueFormat ? valueFormat(v) : v.toFixed(2))
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || n <= 1) return
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover({ index: Math.round(frac * (n - 1)), width: rect.width })
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        {headline != null && <span style={styles.headline}>{headline}</span>}
      </div>

      {periods && periods.length > 0 && (
        <div style={styles.periods}>
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => onPeriod?.(p)}
              style={{ ...styles.period, ...(p === activePeriod ? styles.periodActive : {}) }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div style={{ ...styles.plot, height: H }}>
        {showChart ? (
          <div style={{ display: 'flex', height: H }}>
            <div style={styles.yAxis}>
              {ticks.map((t) => (
                <span key={t} style={{ ...styles.yLabel, top: yFor(t) }}>
                  {fmtTick(t)}
                </span>
              ))}
            </div>
            <div
              style={{ flex: 1, minWidth: 0, position: 'relative' }}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            >
              <svg
                width="100%"
                height={H}
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                style={{ display: 'block' }}
              >
            <defs>
              {lines.map((ln, idx) =>
                ln.fill ? (
                  <linearGradient key={idx} id={`${gid}-fill-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ln.color} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={ln.color} stopOpacity="0" />
                  </linearGradient>
                ) : null
              )}
            </defs>

            {ticks.map((t) => (
              <line
                key={t}
                x1="0"
                y1={yFor(t)}
                x2={W}
                y2={yFor(t)}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            ))}

            {[1, 2, 3, 4, 5].map((k) => (
              <line
                key={'v' + k}
                x1={(k / 6) * W}
                y1={0}
                x2={(k / 6) * W}
                y2={H}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {zeroLine && (
              <line
                x1="0"
                y1={zeroY}
                x2={W}
                y2={zeroY}
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="1"
                strokeDasharray="5,5"
              />
            )}

            {lines.map((ln, idx) => {
              const pts = pointsFor(ln.values)
              if (!pts) return null
              const first = ln.values.findIndex((v) => v != null)
              const lastI = ln.values.length - 1 - [...ln.values].reverse().findIndex((v) => v != null)
              return (
                <g key={idx}>
                  {ln.fill && (
                    <polygon
                      points={`${xFor(first).toFixed(1)},${H} ${pts} ${xFor(lastI).toFixed(1)},${H}`}
                      fill={`url(#${gid}-fill-${idx})`}
                    />
                  )}
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={ln.color}
                    strokeWidth={ln.width ?? 2.5}
                    strokeOpacity={ln.opacity ?? 1}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
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
                    {lines.map((ln, i) => {
                      const v = ln.values[hover.index]
                      if (v == null || !isFinite(v)) return null
                      return (
                        <div key={i} style={{ ...styles.dot, background: ln.color, left: px, top: yFor(v) }} />
                      )
                    })}
                    <div
                      style={{
                        ...styles.tooltip,
                        left: anchorRight ? px - 10 : px + 10,
                        transform: anchorRight ? 'translateX(-100%)' : 'none',
                      }}
                    >
                      {pointLabels && pointLabels[hover.index] && (
                        <div style={styles.ttHeader}>{pointLabels[hover.index]}</div>
                      )}
                      {lines.map((ln, i) => {
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
          </div>
        ) : (
          <div style={styles.state}>
            {loading ? (
              <span style={styles.spinner} />
            ) : (
              <span style={styles.emptyText}>{emptyText}</span>
            )}
          </div>
        )}
      </div>

      {legend && legend.length > 0 && (
        <div style={styles.legend}>
          {legend.map((l) => (
            <span key={l.label} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}

      {labels && labels.length > 1 && showChart && (
        <div style={styles.axis}>
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}

      {footnote && <div style={styles.footnote}>{footnote}</div>}
    </div>
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
  card: {
    position: 'relative',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '18px 20px 30px',
    boxShadow: '0 0 40px rgba(0,82,255,0.08)',
    fontFamily: 'Inter, system-ui, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: 500,
    color: '#fff',
    letterSpacing: 0.2,
  },
  headline: {
    fontSize: 18,
    fontWeight: 500,
    color: '#fff',
    fontFamily: "'Space Mono', monospace",
    whiteSpace: 'nowrap',
  },
  periods: {
    display: 'flex',
    gap: 6,
    marginTop: 10,
    marginBottom: 6,
  },
  period: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.5)',
    borderRadius: 7,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  periodActive: {
    background: 'rgba(0,82,255,0.18)',
    border: '1px solid rgba(0,82,255,0.6)',
    color: '#fff',
  },
  plot: {
    width: '100%',
    marginTop: 14,
  },
  yAxis: {
    position: 'relative',
    width: 38,
    flexShrink: 0,
  },
  yLabel: {
    position: 'absolute',
    right: 8,
    transform: 'translateY(-50%)',
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: "'Space Mono', monospace",
    whiteSpace: 'nowrap',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
  crosshair: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    background: 'rgba(255,255,255,0.25)',
  },
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
  ttHeader: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  ttRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
  },
  ttDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  ttName: {
    color: 'rgba(255,255,255,0.6)',
  },
  ttVal: {
    color: '#fff',
    fontFamily: "'Space Mono', monospace",
    marginLeft: 'auto',
    paddingLeft: 12,
  },
  state: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid rgba(0,82,255,0.25)',
    borderTopColor: '#0052FF',
    animation: 'spin 0.8s linear infinite',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  legendDot: {
    width: 10,
    height: 3,
    borderRadius: 2,
  },
  axis: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 8,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: "'Space Mono', monospace",
  },
  footnote: {
    marginTop: 10,
    fontSize: 10,
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.3)',
    maxWidth: '80%',
  },
}
