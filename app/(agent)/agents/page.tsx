'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import AgentHeader from '@/components/AgentHeader'
import AgentBottomNav from '@/components/AgentBottomNav'
import { AGENTS, PRE_BURN_HOLDER_PAYOUTS } from '@/lib/agents'
import { AgentStats } from '@/lib/agentData'
import { apiFetch } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'active' | 'paused' | 'new' }) {
  const color = status === 'active' ? '#00C853' : status === 'new' ? '#0052FF' : 'rgba(255,255,255,0.25)'
  const label = status === 'active' ? 'ONLINE' : status === 'new' ? 'DEPLOYING' : 'STANDBY'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color, fontWeight: 700, fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0, ...(status !== 'paused' ? { animation: 'pulse-glow 2s ease-in-out infinite' } : {}) }} />
      {label}
    </span>
  )
}

function Sparkline({ data, positive, isCenter }: { data: number[]; positive: boolean; isCenter: boolean }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const w = 200, h = 64
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ')
  const gradId = `sg-${positive}-${isCenter}`
  const strokeColor = isCenter
    ? (positive ? '#0052FF' : '#FF4444')
    : (positive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)')
  const fillOpacity = isCenter ? (positive ? '0.15' : '0.06') : (positive ? '0.05' : '0.02')
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isCenter && positive ? '#0052FF' : '#fff'} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={isCenter && positive ? '#0052FF' : '#fff'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const tiltRef = useRef<HTMLDivElement>(null)
  const [statsMap, setStatsMap] = useState<Record<string, AgentStats>>({})
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Fetch all agent stats from batch endpoint + auto-refresh every 120s
  useEffect(() => {
    function fetchAll() {
      apiFetch<{ agents: Record<string, AgentStats> }>('/api/agents/stats')
        .then(res => {
          const map: Record<string, AgentStats> = {}
          for (const a of AGENTS) {
            if (res.agents[a.apiAgentId]) map[a.id] = res.agents[a.apiAgentId]
          }
          setStatsMap(map)
        })
        .catch(console.error)
    }
    fetchAll()
    const interval = setInterval(fetchAll, 120_000)
    return () => clearInterval(interval)
  }, [])

  const total = AGENTS.length

  const prev = useCallback(() => setActiveIndex(i => (i - 1 + total) % total), [total])
  const next = useCallback(() => setActiveIndex(i => (i + 1) % total), [total])

  // keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

  // Touch swipe support
  const touchStart = useRef<number | null>(null)
  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) next()
      else prev()
    }
    touchStart.current = null
  }

  // positions: -2, -1, 0 (center), +1, +2
  function getOffset(idx: number): number {
    let diff = idx - activeIndex
    if (diff > total / 2) diff -= total
    if (diff < -total / 2) diff += total
    return diff
  }

  function handleTiltMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = tiltRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: x * 8, y: y * -8 })
  }

  function handleTiltLeave() {
    setTilt({ x: 0, y: 0 })
  }

  return (
    <div style={s.page}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
        @keyframes border-glow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .agent-arrow:hover {
          border-color: rgba(0,82,255,0.5) !important;
          background: rgba(0,82,255,0.08) !important;
          color: #fff !important;
        }
        .agent-view-btn:hover {
          border-color: #0052FF !important;
          color: #fff !important;
          background: rgba(0,82,255,0.08) !important;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <AgentHeader currentPage="agents" />

      <main style={isMobile ? { padding: '16px 16px 80px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } : s.main}>
        {/* Carousel */}
        <div style={s.carouselWrap}>
          {/* Left arrow (hidden on mobile — use swipe) */}
          {!isMobile && (
            <button onClick={prev} className="agent-arrow" style={s.arrow}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Cards track */}
          <div style={{ ...s.track, height: '100%' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {AGENTS.map((a, idx) => {
              const offset = getOffset(idx)
              if (offset < -2 || offset > 2) return null

              const isCenter = offset === 0
              const isAdjacent = Math.abs(offset) === 1
              const isFar = Math.abs(offset) === 2

              const scale = isCenter ? 1 : isAdjacent ? 0.82 : 0.68
              const opacity = isCenter ? 1 : isAdjacent ? 0.45 : 0.15
              const translateX = offset * (isMobile ? 220 : 380)
              const zIndex = isCenter ? 10 : isAdjacent ? 5 : 1
              const blur = isCenter ? 0 : isAdjacent ? 2 : 4

              // Live stats (or placeholders while loading)
              const stats = statsMap[a.id]
              const winRate = stats?.winRate ?? 0
              const roi = stats?.roi ?? 0
              const aIsPositive = roi >= 0
              const sparkline = stats?.sparkline ?? [0, 0, 0, 0, 0, 0, 0, 0]
              const roundsPlayed = stats?.roundsPlayed ?? 0
              const netPnl = stats?.netPnl ?? 0
              const aNum = String(parseInt(a.id.replace('agent', ''))).padStart(3, '0')

              return (
                <div
                  key={a.id}
                  ref={isCenter ? tiltRef : undefined}
                  onClick={() => setActiveIndex(idx)}
                  onMouseMove={isCenter ? handleTiltMove : undefined}
                  onMouseLeave={isCenter ? handleTiltLeave : undefined}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: isMobile ? 310 : 420,
                    transform: `translate(calc(-50% + ${translateX}px), -50%) scale(${scale})${isCenter ? ` perspective(800px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` : ''}`,
                    opacity,
                    zIndex,
                    filter: blur ? `blur(${blur}px)` : 'none',
                    transition: isCenter ? 'opacity 0.5s, filter 0.5s, transform 0.15s ease-out' : 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: isCenter ? 'default' : 'pointer',
                    pointerEvents: isFar ? 'none' : 'auto',
                  }}
                >
                  {/* Neon glow behind center card */}
                  {isCenter && (<>
                    {/* Outer glow layer */}
                    <div style={{
                      position: 'absolute',
                      inset: -20,
                      borderRadius: 40,
                      background: 'radial-gradient(ellipse at center, rgba(0,100,255,0.12) 0%, transparent 70%)',
                      zIndex: -2,
                      pointerEvents: 'none',
                    }} />
                    {/* Border glow */}
                    <div style={{
                      position: 'absolute',
                      inset: -3,
                      borderRadius: 23,
                      border: '2px solid rgba(0,140,255,0.8)',
                      boxShadow: '0 0 8px rgba(0,120,255,0.9), 0 0 20px rgba(0,100,255,0.7), 0 0 45px rgba(0,80,255,0.5), 0 0 80px rgba(0,60,255,0.3), 0 0 120px rgba(0,40,255,0.15), inset 0 0 20px rgba(0,100,255,0.15), inset 0 0 50px rgba(0,80,255,0.05)',
                      zIndex: -1,
                      animation: 'border-glow-pulse 3s ease-in-out infinite',
                      pointerEvents: 'none',
                    }}>
                      {/* Corner flares */}
                      {[[0, 0], [100, 0], [0, 100], [100, 100]].map(([x, y], i) => (
                        <div key={i} style={{
                          position: 'absolute',
                          left: `${x}%`, top: `${y}%`,
                          transform: 'translate(-50%, -50%)',
                          width: 50, height: 50,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(200,225,255,0.9) 0%, rgba(80,160,255,0.6) 20%, rgba(0,100,255,0.3) 45%, transparent 70%)',
                          filter: 'blur(4px)',
                        }} />
                      ))}
                      {/* Mid-edge flares */}
                      {[[50, 0], [50, 100], [0, 50], [100, 50]].map(([x, y], i) => (
                        <div key={`m${i}`} style={{
                          position: 'absolute',
                          left: `${x}%`, top: `${y}%`,
                          transform: 'translate(-50%, -50%)',
                          width: 30, height: 30,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(150,200,255,0.5) 0%, rgba(0,100,255,0.2) 40%, transparent 70%)',
                          filter: 'blur(4px)',
                        }} />
                      ))}
                    </div>
                  </>)}

                  <div style={{
                    ...s.card,
                    borderColor: isCenter ? 'rgba(0,120,255,0.7)' : 'rgba(255,255,255,0.06)',
                    background: isCenter
                      ? 'linear-gradient(180deg, rgba(0,40,120,0.15) 0%, rgba(0,15,50,0.08) 100%)'
                      : 'rgba(255,255,255,0.02)',
                    boxShadow: isCenter
                      ? 'inset 0 0 30px rgba(0,80,255,0.08), inset 0 1px 0 rgba(150,200,255,0.15)'
                      : '0 4px 20px rgba(0,0,0,0.2)',
                  }}>
                    {/* Top row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <span style={s.agentId}>AGENT_{aNum}</span>
                      <StatusDot status={a.status} />
                    </div>

                    {/* Name */}
                    <div style={s.cardName}>{a.name}</div>

                    {/* Strategy */}
                    <div style={s.cardStrategy}>{a.strategy}</div>

                    {/* Sparkline */}
                    <div style={{ marginTop: 20, marginBottom: 20 }}>
                      <Sparkline data={sparkline} positive={aIsPositive} isCenter={isCenter} />
                    </div>

                    {/* Stats */}
                    <div style={s.statsRow}>
                      <div style={s.stat}>
                        {stats ? (
                          <span style={s.statVal}>{winRate}%</span>
                        ) : (
                          <div style={s.skeleton} />
                        )}
                        <span style={s.statLabel}>WIN RATE</span>
                      </div>
                      <div style={s.statDivider} />
                      <div style={s.stat}>
                        {stats ? (
                          <span style={{
                            ...s.statVal,
                            color: aIsPositive ? '#00C853' : '#FF4444',
                          }}>
                            {aIsPositive ? '+' : ''}{roi}%
                          </span>
                        ) : (
                          <div style={s.skeleton} />
                        )}
                        <span style={s.statLabel}>NET ROI</span>
                      </div>
                      <div style={s.statDivider} />
                      <div style={s.stat}>
                        {stats ? (
                          <span style={{
                            ...s.statVal,
                            color: netPnl >= 0 ? '#00C853' : '#FF4444',
                          }}>
                            {netPnl >= 0 ? '+' : ''}{netPnl.toFixed(3)}
                          </span>
                        ) : (
                          <div style={s.skeleton} />
                        )}
                        <span style={s.statLabel}>P&L (ETH)</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                      {stats ? (
                        <span style={s.rounds}>{roundsPlayed.toLocaleString()} rounds</span>
                      ) : (
                        <div style={{ ...s.skeleton, width: 80, height: 12 }} />
                      )}
                      {isCenter && (
                        <Link href={`/agents/${a.id}`} className="agent-view-btn" style={s.viewLink} onClick={e => e.stopPropagation()}>
                          VIEW AGENT →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right arrow (hidden on mobile — use swipe) */}
          {!isMobile && (
            <button onClick={next} className="agent-arrow" style={s.arrow}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>

        {/* Total PnL summary across all agents */}
        {(() => {
          const loadedAgents = AGENTS.filter(a => statsMap[a.id])
          if (loadedAgents.length === 0) return null
          // PnL only counts profitable agents
          const eligibleAgents = loadedAgents.filter(a => (statsMap[a.id]?.netPnl ?? 0) > 0)
          const totalPnl = eligibleAgents.reduce((sum, a) => sum + (statsMap[a.id]?.netPnl ?? 0), 0)
          // BEAN burnt from agent profits (subtract pre-burn holder payouts)
          const totalBeanPaidOut = Math.max(0, loadedAgents.reduce((sum, a) => sum + (statsMap[a.id]?.totalBeanPaidOut ?? 0), 0) - PRE_BURN_HOLDER_PAYOUTS)
          const totalRounds = loadedAgents.reduce((sum, a) => sum + (statsMap[a.id]?.roundsPlayed ?? 0), 0)
          const eligibleCount = eligibleAgents.length
          const pnlPositive = totalPnl >= 0
          return (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? 16 : 32,
              padding: isMobile ? '12px 0' : '14px 0',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{
                  fontSize: isMobile ? 16 : 18, fontWeight: 700,
                  fontFamily: "'Space Mono', monospace",
                  color: pnlPositive ? '#00C853' : '#FF4444',
                }}>
                  {pnlPositive ? '+' : ''}{totalPnl.toFixed(4)} ETH
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  AGENT TOTAL P&L
                </span>
              </div>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{
                  fontSize: isMobile ? 16 : 18, fontWeight: 700,
                  fontFamily: "'Space Mono', monospace",
                  color: '#fff',
                }}>
                  {eligibleCount} / {AGENTS.length}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  ELIGIBLE AGENTS
                </span>
              </div>
            </div>
          )
        })()}

        {/* Agent selector */}
        <div style={s.selectorWrap}>
          <div style={s.selectorLine} />
          <div style={s.selectorRow}>
            {AGENTS.map((a, idx) => {
              const isActive = activeIndex === idx
              const aNum = String(parseInt(a.id.replace('agent', ''))).padStart(3, '0')
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveIndex(idx)}
                  style={{
                    ...s.selectorBtn,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.2)',
                    borderColor: isActive ? 'rgba(0,82,255,0.6)' : 'rgba(255,255,255,0.06)',
                    background: isActive ? 'rgba(0,82,255,0.12)' : 'transparent',
                    boxShadow: isActive ? '0 0 12px rgba(0,82,255,0.3), 0 0 4px rgba(0,82,255,0.2)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{aNum}</span>
                </button>
              )
            })}
          </div>
          <div style={s.selectorLine} />
        </div>

      </main>

      {isMobile && <AgentBottomNav currentPage="agents" />}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const s: { [key: string]: React.CSSProperties } = {
  page: { fontFamily: "'Inter', -apple-system, sans-serif", minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent' },

  main: { maxWidth: 1400, margin: '0 auto', padding: '24px 60px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%' },

  carouselWrap: { display: 'flex', alignItems: 'center', gap: 20, position: 'relative', minHeight: '55vh' },
  track: { flex: 1, position: 'relative', overflow: 'visible' },

  arrow: { width: 52, height: 52, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 20, transition: 'all 0.2s ease' },

  card: { display: 'flex', flexDirection: 'column', padding: 28, borderRadius: 20, border: '1px solid', textDecoration: 'none', backdropFilter: 'blur(12px)' },
  agentId: { fontSize: 11, fontWeight: 700, color: 'rgba(0,82,255,0.5)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.08em' },
  cardName: { fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 },
  cardStrategy: { fontSize: 14, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, minHeight: 44 },

  statsRow: { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 0' },
  stat: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statVal: { fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'Space Mono', monospace" },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Space Mono', monospace" },
  statDivider: { width: 1, height: 28, background: 'rgba(255,255,255,0.06)', flexShrink: 0 },

  rounds: { fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'Space Mono', monospace" },
  viewLink: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', padding: '8px 18px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em', textDecoration: 'none', transition: 'all 0.2s ease' },

  selectorWrap: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, flexShrink: 0 },
  selectorLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' },
  selectorRow: { display: 'flex', alignItems: 'center', gap: 10 },
  skeleton: {
    width: 50, height: 18, borderRadius: 4,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  selectorBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '8px 16px', borderRadius: 8,
    border: '1px solid',
    fontFamily: "'Space Mono', monospace",
    cursor: 'pointer',
    transition: 'all 0.25s ease',
  },
}
