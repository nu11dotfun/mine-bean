'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useProfileResolver } from '@/lib/useProfileResolver'

interface Entry {
  rank: number
  address: string
  displayName?: string
  points: number
  prizeUsd?: number
}
interface ApiEntry {
  rank: number
  address: string
  points: number
  prizeUsd?: number
}
interface WeekInfo {
  id?: string
  status?: 'pre_competition' | 'upcoming' | 'live' | 'final'
  secondsUntilReset?: number
  secondsUntilStart?: number
  competitionStartsAt?: string
}
interface CompetitionResponse {
  week?: WeekInfo
  totalEligible?: number
  entries: ApiEntry[]
}

const GOLD = '#F4B740'
const BLUE = '#3D8BFF'
const GREEN = '#4ADE80'
const MONO = "'Space Mono', ui-monospace, monospace"
const MEDAL: Record<number, string> = { 1: '#F4B740', 2: '#C7D0DE', 3: '#D08B4E' }

function short(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

function fmtDuration(secs?: number): string {
  if (secs == null || secs <= 0) return ''
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(1, m)}m`
}

function fmtStart(iso?: string): string {
  if (!iso) return ''
  try {
    return `${new Date(iso).toLocaleString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })} UTC`
  } catch { return '' }
}

function Trophy({ size = 18, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
    </svg>
  )
}

function Crown({ size = 15, color = GOLD, style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" style={style}>
      <path d="M12 6l4 6l5 -4l-2 9h-14l-2 -9l5 4z" />
      <rect x="5" y="17.4" width="14" height="2" rx="0.7" />
    </svg>
  )
}

const SHIMMER = `
@keyframes obpShine { 0% { background-position: -100% 0; } 100% { background-position: 200% 0; } }
.obp-1, .obp-2, .obp-3 { background-color: #4b93ff; background-repeat: no-repeat; background-size: 50% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: obpShine 3.4s linear infinite; will-change: background-position; }
.obp-1 { background-image: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%); filter: drop-shadow(0 0 1px rgba(150,190,255,0.5)) drop-shadow(0 0 6px rgba(30,110,255,0.26)) drop-shadow(0 0 12px rgba(0,90,255,0.14)); }
.obp-2 { background-image: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%); filter: drop-shadow(0 0 4px rgba(30,110,255,0.16)); }
.obp-3 { background-image: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%); }
`

export default function OverallLeaderboardPanel() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<CompetitionResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => apiFetch<CompetitionResponse>('/api/competition/leaderboard')
      .then(res => { if (!cancelled && res) setData(res) })
      .catch(err => console.error('Failed to fetch leaderboard:', err))
    load()
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const addresses = useMemo(() => (data?.entries ?? []).map(e => e.address), [data])
  const { resolve } = useProfileResolver(addresses)

  const entries: Entry[] = useMemo(
    () => (data?.entries ?? []).map(e => ({
      rank: e.rank,
      address: e.address,
      displayName: resolve(e.address),
      points: e.points,
      prizeUsd: e.prizeUsd,
    })),
    [data, resolve],
  )

  const status = data?.week?.status
  const total = data?.totalEligible ?? 0
  let sub = 'Loading…'
  if (data) {
    if (status === 'pre_competition' || status === 'upcoming') {
      sub = 'Upcoming'
    } else if (status === 'final') {
      sub = `Final · ${total.toLocaleString()} miners`
    } else {
      const reset = fmtDuration(data.week?.secondsUntilReset)
      sub = reset ? `This week · ${total.toLocaleString()} miners · resets ${reset}` : `This week · ${total.toLocaleString()} miners`
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHIMMER }} />

      {!open && (
        <button style={s.tab} onClick={() => setOpen(true)} aria-label="Open mining leaderboard">
          <Trophy size={22} />
        </button>
      )}

      <div style={{ ...s.panel, transform: open ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div style={s.head}>
          <div style={s.headLeft}>
            <Trophy size={18} />
            <span style={s.title}>Mining leaderboard</span>
          </div>
          <button style={s.close} onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </div>
        <div style={s.sub}>{sub}</div>
        <div style={s.list}>
          {!data ? (
            <div style={s.empty}>Loading…</div>
          ) : (status === 'pre_competition' || status === 'upcoming') ? (
            <div style={s.preComp}>
              <div style={s.preLabel}>WEEKLY COMPETITION</div>
              {fmtStart(data.week?.competitionStartsAt) ? <div style={s.preDate}>Starts {fmtStart(data.week?.competitionStartsAt)}</div> : null}
              {fmtDuration(data.week?.secondsUntilStart) ? <div style={s.preCountdown}>in {fmtDuration(data.week?.secondsUntilStart)}</div> : null}
            </div>
          ) : entries.length === 0 ? (
            <div style={s.empty}>No eligible miners yet this week.</div>
          ) : (
            entries.map(e => (
              <div key={e.address} style={s.row}>
                <span style={{ ...s.rank, ...(e.rank === 1 ? { color: GOLD } : {}) }}>{e.rank === 1 ? <Crown size={16} style={{ marginLeft: -3 }} /> : e.rank}</span>
                <span
                  className={e.rank <= 3 ? `obp-${e.rank}` : undefined}
                  style={e.rank <= 3 ? { ...s.name, color: 'transparent', overflow: 'visible', textOverflow: 'clip' } : s.name}
                >{e.displayName || short(e.address)}</span>
                {e.prizeUsd ? (
                  <span style={{ ...s.prize, color: MEDAL[e.rank] ?? GREEN, background: `${MEDAL[e.rank] ?? GREEN}18`, borderColor: `${MEDAL[e.rank] ?? GREEN}59` }}>${e.prizeUsd}</span>
                ) : null}
                <span style={s.points}>{e.points.toLocaleString()} pts</span>
              </div>
            ))
          )}
        </div>
      </div>

      {open && <div style={s.overlay} onClick={() => setOpen(false)} />}
    </>
  )
}

const s: { [k: string]: React.CSSProperties } = {
  tab: { position: 'fixed', left: 0, top: 160, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(244,183,64,0.4)', borderLeft: 'none', borderRadius: '0 10px 10px 0', padding: '14px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel: { position: 'fixed', left: 0, top: 0, bottom: 0, width: 360, maxWidth: '86vw', background: '#0B0F1A', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', zIndex: 101, transition: 'transform 0.3s ease', fontFamily: "'Inter', -apple-system, sans-serif" },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  headLeft: { display: 'flex', alignItems: 'center', gap: 9 },
  title: { fontSize: 16, fontWeight: 500, color: '#F5F8FF' },
  close: { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', padding: 4, lineHeight: 1 },
  sub: { padding: '10px 20px', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: MONO, letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  list: { flex: 1, overflowY: 'auto', padding: '6px 0' },
  empty: { padding: '28px 20px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 },
  preComp: { padding: '34px 20px', textAlign: 'center' },
  preLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: MONO, letterSpacing: '0.08em' },
  preDate: { fontSize: 15, color: '#F5F8FF', fontWeight: 500, margin: '10px 0 4px' },
  preCountdown: { fontSize: 13, color: BLUE, fontFamily: MONO },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' },
  rank: { width: 20, fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: MONO, flexShrink: 0, display: 'flex', alignItems: 'center' },
  name: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: '#F5F8FF', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  prize: { fontSize: 11, fontFamily: MONO, fontWeight: 500, padding: '2px 8px', borderRadius: 6, border: '1px solid transparent', flexShrink: 0 },
  points: { fontSize: 13, color: BLUE, fontFamily: MONO, flexShrink: 0, minWidth: 56, textAlign: 'right' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 },
}
