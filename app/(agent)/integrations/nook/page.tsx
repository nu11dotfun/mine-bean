'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBalance } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { base } from 'wagmi/chains'
import { formatUnits } from 'viem'
import AgentHeader from '@/components/AgentHeader'
import AgentBottomNav from '@/components/AgentBottomNav'

const NOOK_LOGO = 'https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/bdd3d3ce-60db-4acd-0cb5-1a577ff86400/public'

// Nostradamus is the active agent on Nookplot (same wallet as on Litcoin).
const NOSTRADAMUS_WALLET = '0x6f2FD3919C058fa0Ece5c76E6C10c9dAee655f4E' as const
const NOSTRADAMUS_WALLET_SHORT = '0x6f2F…5f4E'

// NOOK token on Base. Confirmed by the founder against Nookplot's own
// references (and via the CLI's constants.ts). The earlier 0x8605... address
// turned out to be a staking-related variant, not the canonical NOOK token.
const NOOK_TOKEN = '0xb233BDFFD437E60fA451F62c6c09D3804d285Ba3' as const

// MineBean agents. Same five as on Litcoin. Live numbers wire when
// we have the NOOK RewardPool address + a public stats endpoint from Nookplot.
interface AgentEntry {
  id: string
  name: string
  status: 'active' | 'queued'
  walletShort: string | null
  walletFull?: string
}

const AGENTS: AgentEntry[] = [
  { id: 'nostradamus', name: 'Nostradamus', status: 'active', walletShort: NOSTRADAMUS_WALLET_SHORT, walletFull: NOSTRADAMUS_WALLET },
  { id: 'anti-winner', name: 'Anti-Winner', status: 'queued', walletShort: null },
  { id: 'anti-loser', name: 'Anti-Loser', status: 'queued', walletShort: null },
  { id: 'sniper', name: 'Sniper', status: 'queued', walletShort: null },
  { id: 'beanpot-hunter', name: 'Beanpot Hunter', status: 'queued', walletShort: null },
]

export default function NookIntegrationPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [selectedId, setSelectedId] = useState<string>(AGENTS[0].id)

  // Live NOOK balance for Nostradamus.
  const nookBal = useBalance({
    address: NOSTRADAMUS_WALLET,
    token: NOOK_TOKEN,
    chainId: base.id,
    query: { refetchInterval: 30_000, staleTime: 30_000 },
  })
  const nookSymbol = nookBal.data?.symbol ?? 'NOOK'
  const nookDecimals = nookBal.data?.decimals ?? 18
  const nookBalanceWei = nookBal.data?.value
  const nookBalanceFloat = nookBalanceWei !== undefined
    ? parseFloat(formatUnits(nookBalanceWei, nookDecimals))
    : 0
  const nookBalanceDisplay = `${nookBalanceFloat.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${nookSymbol}`

  // Live mining epoch info from Nookplot gateway (via same-origin proxy).
  // Mining epoch rolls daily at 2am UTC. Returns:
  //   { nextEpochTime, timeUntilEpochSeconds, timeUntilEpochHuman, currentEpoch, epochCronSchedule, minIntervalHours }
  const epochQuery = useQuery({
    queryKey: ['nook-mining-epoch'],
    queryFn: async () => {
      const res = await fetch('/api/nook/epoch', { cache: 'no-store' })
      if (!res.ok) throw new Error(`epoch: ${res.status}`)
      return res.json() as Promise<{
        nextEpochTime: string
        timeUntilEpochSeconds: number
        timeUntilEpochHuman: string
        currentEpoch: number
        epochCronSchedule: string
        minIntervalHours: number
      }>
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  // Live agent mining stats from Nookplot gateway.
  // Returns the full per-agent shape:
  //   tier, stakedNook, multiplier, totalSolves, totalEarned, avgScore,
  //   claimableBalance, pendingRewards
  const statsQuery = useQuery({
    queryKey: ['nook-agent-stats', NOSTRADAMUS_WALLET.toLowerCase()],
    queryFn: async () => {
      const res = await fetch(`/api/nook/stats/${NOSTRADAMUS_WALLET}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`stats: ${res.status}`)
      return res.json() as Promise<{
        tier: string
        stakedNook: number
        multiplier: number
        totalSolves: number
        totalEarned: number
        avgScore: number
        claimableBalance: Record<string, unknown>
        pendingRewards: number
      }>
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  // Local 1s ticker for the epoch countdown so the time updates without
  // re-fetching the API every second. Anchors to the server's nextEpochTime.
  const [nowMs, setNowMs] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const nextEpochMs = epochQuery.data?.nextEpochTime ? new Date(epochQuery.data.nextEpochTime).getTime() : null
  const remainingMs = nextEpochMs !== null ? Math.max(0, nextEpochMs - nowMs) : null
  const remainingDisplay = remainingMs !== null ? formatDuration(remainingMs) : (epochQuery.isPending ? 'Loading…' : '—')

  // Stats-derived display values (all live from the agent stats endpoint).
  const stakedNook = statsQuery.data?.stakedNook ?? 0
  const stakedDisplay = statsQuery.isPending
    ? 'Loading…'
    : `${stakedNook.toLocaleString('en-US')} ${nookSymbol}`

  // pendingRewards from the gateway isn't denominated in NOOK (likely a scoring metric),
  // so we don't surface it. Actual NOOK ticks over into totalEarned at the daily 2am UTC epoch.
  const totalEarnedNook = statsQuery.data?.totalEarned ?? 0
  const totalEarnedDisplay = statsQuery.isPending
    ? 'Loading…'
    : `${totalEarnedNook.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${nookSymbol}`

  const tierLabel = statsQuery.data?.tier ? statsQuery.data.tier.toUpperCase() : '—'
  const multiplierDisplay = statsQuery.data?.multiplier
    ? `${statsQuery.data.multiplier}× bonus`
    : '—'
  const totalSolves = statsQuery.data?.totalSolves ?? 0
  const avgScoreDisplay = statsQuery.data?.avgScore !== undefined
    ? statsQuery.data.avgScore.toFixed(4)
    : '—'

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!mounted) return null

  const selected = AGENTS.find(a => a.id === selectedId) ?? AGENTS[0]
  const isActive = selected.status === 'active'

  return (
    <div style={s.page}>
      <style>{`
        @keyframes pulse-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <AgentHeader currentPage="integrations" isMobile={isMobile} />

      <main style={isMobile ? s.mainMobile : s.main}>
        <Link href="/integrations" style={s.backLink}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All integrations
        </Link>

        {/* Hero — mirrors Litcoin: logo + title row, subtitle below */}
        <section style={s.hero}>
          <div style={s.heroTitleRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={NOOK_LOGO} alt="Nookplot logo" style={s.heroLogo} />
            <h1 style={isMobile ? { ...s.heroTitle, fontSize: 40 } : s.heroTitle}>Nookplot</h1>
          </div>
          <p style={s.heroSub}>
            MineBean agents deployed against Nookplot. View the aggregate position across every active agent and dig into each one below.
          </p>
        </section>

        {/* Treasury — 3 cards. All live from the Nookplot gateway. */}
        <section style={s.section}>
          <div style={isMobile ? s.statsGridMobile : s.statsGrid}>
            <Stat
              label="NOOK BALANCE"
              value={nookBalanceDisplay}
              sub="Live liquid wallet balance"
              tooltip="Live NOOK sitting in the Nostradamus wallet. The liquid portion, separate from the supply we have staked for the mining bonus."
            />
            <Stat
              label="TOTAL EARNED"
              value={totalEarnedDisplay}
              sub={totalEarnedNook > 0 ? 'Lifetime mined' : 'Ticks over at next epoch'}
              tooltip="Lifetime NOOK earned through mining. Rewards settle when the daily epoch turns at 2am UTC. Lives on Nookplot's gateway, refreshes every 30s."
            />
            <Stat
              label="TREASURY"
              value={stakedDisplay}
              sub="Total NOOK held by MineBean ecosystem"
              tooltip={`NOOK staked in the MiningStake contract to activate the supply-side bonus. Currently ${tierLabel} at ${multiplierDisplay}.`}
            />
          </div>
        </section>

        {/* Live epoch banner — countdown to next daily mining cycle (2am UTC). */}
        <section style={s.epochBanner}>
          <div style={s.epochBannerLeft}>
            <span style={s.epochBannerLabel}>EPOCH {epochQuery.data?.currentEpoch ?? '—'}</span>
            <span style={s.epochBannerValue}>{remainingDisplay} until next</span>
          </div>
          <span style={s.epochBannerSub}>
            Mining epochs roll daily at 2am UTC. Submissions for the next cycle open the moment this one closes.
          </span>
        </section>

        {/* Agents — same tab + detail pattern as Litcoin */}
        <section style={s.section}>
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Agents</h2>
          <p style={s.sectionSub}>Click an agent to see its details below.</p>

          {/* Agent tab row */}
          <div style={isMobile ? s.agentTabsMobile : s.agentTabs}>
            {AGENTS.map((agent) => {
              const sel = agent.id === selectedId
              const active = agent.status === 'active'
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedId(agent.id)}
                  style={{
                    ...s.agentTab,
                    borderColor: sel ? 'rgba(0,82,255,0.55)' : 'rgba(255,255,255,0.06)',
                    background: sel
                      ? 'linear-gradient(180deg, rgba(0,82,255,0.1) 0%, rgba(0,82,255,0.02) 100%)'
                      : 'rgba(255,255,255,0.02)',
                    opacity: active ? 1 : 0.6,
                  }}
                >
                  <span style={{
                    ...s.tabDot,
                    background: active ? '#00C853' : 'rgba(255,255,255,0.25)',
                    boxShadow: active ? '0 0 8px #00C853' : 'none',
                    animation: active ? 'pulse-glow 2s ease-in-out infinite' : 'none',
                  }} />
                  <span style={s.tabName}>{agent.name}</span>
                </button>
              )
            })}
          </div>

          {/* Detail panel */}
          <div style={s.detail}>
            <div style={s.detailHeader}>
              <span style={s.detailName}>{selected.name}</span>
              <span style={{
                ...s.detailStatus,
                color: isActive ? '#00C853' : 'rgba(255,255,255,0.4)',
              }}>
                {isActive ? 'MINING' : 'NOT YET DEPLOYED'}
              </span>
            </div>

            {isActive ? (
              <div style={isMobile ? s.statsGridMobile : s.statsGrid}>
                <Stat
                  label="BALANCE"
                  value={nookBalanceDisplay}
                  sub="Live on-chain read"
                  tooltip="This agent's live NOOK balance read directly from the token contract."
                />
                <Stat
                  label="TOTAL EARNED"
                  value={totalEarnedDisplay}
                  sub={totalEarnedNook > 0 ? 'Lifetime mined' : 'Ticks over at next epoch'}
                  tooltip={`Lifetime NOOK earned by this agent. ${totalSolves} challenge${totalSolves === 1 ? '' : 's'} solved, avg score ${avgScoreDisplay}. Rewards settle at the daily 2am UTC epoch.`}
                />
                {selected.walletFull ? (
                  <StatLink label="WALLET" value={selected.walletShort ?? '—'} href={`https://basescan.org/address/${selected.walletFull}`} />
                ) : (
                  <Stat label="WALLET" value={selected.walletShort ?? '—'} mono />
                )}
              </div>
            ) : (
              <div style={s.detailEmpty}>
                <span style={s.detailEmptyTitle}>Queued for rollout</span>
                <span style={s.detailEmptySub}>This agent will be deployed against Nookplot as we extend the framework.</span>
              </div>
            )}
          </div>
        </section>

        {/* Links */}
        <section style={s.section}>
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Links</h2>
          <div style={isMobile ? s.linksGridMobile : s.linksGrid}>
            <LinkCard title="Website" href="https://nookplot.com" />
            <LinkCard title="X" href="https://x.com/nookplot" />
            <LinkCard title="GitHub" href="https://github.com/nookprotocol" />
          </div>
        </section>
      </main>

      {isMobile && <AgentBottomNav currentPage="integrations" />}
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function Stat({ label, value, sub, mono, tooltip }: { label: string; value: string; sub?: string; mono?: boolean; tooltip?: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.statCard,
        borderColor: hovered ? 'rgba(0,82,255,0.32)' : 'rgba(255,255,255,0.06)',
        background: hovered
          ? 'linear-gradient(180deg, rgba(0,82,255,0.06) 0%, rgba(0,82,255,0.01) 100%)'
          : 'rgba(255,255,255,0.02)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 24px rgba(0,82,255,0.12)' : 'none',
        transition: 'all 0.22s ease',
        position: 'relative',
      }}
    >
      <div style={s.statLabel}>{label}</div>
      <div style={mono ? { ...s.statValue, fontFamily: "'Space Mono', monospace", fontSize: 18 } : s.statValue}>
        {value}
      </div>
      {sub && <div style={s.statSub}>{sub}</div>}
      {tooltip && hovered && (
        <div style={s.statTooltip}>{tooltip}</div>
      )}
    </div>
  )
}

function StatLink({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...s.statCard, textDecoration: 'none', cursor: 'pointer' }}
    >
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, fontFamily: "'Space Mono', monospace", fontSize: 18, color: 'rgba(180,210,255,0.95)' }}>
        {value}
      </div>
    </a>
  )
}

function LinkCard({ title, href }: { title: string; href: string }) {
  const [hovered, setHovered] = useState(false)
  const display = href.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.linkCard,
        borderColor: hovered ? 'rgba(0,82,255,0.4)' : 'rgba(255,255,255,0.06)',
        background: hovered ? 'rgba(0,82,255,0.05)' : 'rgba(255,255,255,0.02)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={s.linkCardTitle}>{title}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={hovered ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </div>
      <div style={s.linkCardUrl}>{display}</div>
    </a>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function safeBigInt(s: string | null | undefined): bigint | null {
  if (s == null) return null
  try { return BigInt(s) } catch { return null }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

// ── Styles (mirrors Litcoin shape) ────────────────────────────────────────

const s: { [key: string]: React.CSSProperties } = {
  page: { fontFamily: "'Inter', -apple-system, sans-serif", minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent' },
  main: { maxWidth: 1280, margin: '0 auto', padding: '40px 60px 80px', flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 40 },
  mainMobile: { padding: '20px 16px 120px', flex: 1, display: 'flex', flexDirection: 'column', gap: 28 },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, transition: 'color 0.15s ease', width: 'fit-content' },

  // Hero
  hero: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 18, maxWidth: 760, margin: '0 auto' },
  heroTitleRow: { display: 'flex', alignItems: 'center', gap: 18 },
  heroLogo: { width: 64, height: 64, borderRadius: 16, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' },
  heroTitle: { fontSize: 56, fontWeight: 700, color: '#fff', lineHeight: 1.05, margin: 0, letterSpacing: '-0.025em' },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0, maxWidth: 680, textAlign: 'center' },

  // Section
  section: { display: 'flex', flexDirection: 'column', gap: 14 },
  sectionTitle: { fontSize: 26, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.015em' },
  sectionSub: { fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, margin: 0, maxWidth: 720 },

  // Stats grids — 3-col, 2-col, and mobile variants
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  statsGridTwo: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 },
  statsGridMobile: { display: 'grid', gridTemplateColumns: '1fr', gap: 10 },
  statsGridMobileTwo: { display: 'grid', gridTemplateColumns: '1fr', gap: 10 },
  statCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 22,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 130,
  },
  statLabel: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.14em', marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: "'Space Mono', monospace", lineHeight: 1.15, wordBreak: 'break-all' },
  statSub: { fontSize: 10, color: 'rgba(255,255,255,0.32)', marginTop: 'auto', paddingTop: 12, fontFamily: "'Space Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' },

  // Agent tabs
  agentTabs: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 },
  agentTabsMobile: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  agentTab: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    border: '1px solid',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  tabDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  tabName: { fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' },

  // Detail panel
  detail: {
    border: '1px solid rgba(0,82,255,0.22)',
    background: 'linear-gradient(180deg, rgba(0,82,255,0.06) 0%, rgba(0,82,255,0.01) 100%)',
    borderRadius: 20,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    minHeight: 200,
  },
  detailHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  detailName: { fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' },
  detailStatus: { fontSize: 10, fontWeight: 700, fontFamily: "'Space Mono', monospace", letterSpacing: '0.14em' },
  detailEmpty: { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', justifyContent: 'center', textAlign: 'center', flex: 1, padding: '24px 12px' },
  detailEmptyTitle: { fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.55)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase' },
  detailEmptySub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', maxWidth: 420, lineHeight: 1.55 },

  // Links
  linksGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  linksGridMobile: { display: 'grid', gridTemplateColumns: '1fr', gap: 10 },
  statTooltip: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    background: 'rgba(10,16,28,0.96)',
    border: '1px solid rgba(0,82,255,0.3)',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.5,
    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(8px)',
    zIndex: 10,
    pointerEvents: 'none',
  },

  // Slim banner for epoch info — separate from treasury cards
  epochBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    padding: '14px 22px',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.02)',
    flexWrap: 'wrap',
  },
  epochBannerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexShrink: 0,
  },
  epochBannerLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.14em',
  },
  epochBannerValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    fontFamily: "'Space Mono', monospace",
  },
  epochBannerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.55,
    flex: 1,
    minWidth: 240,
  },

  linkCard: {
    border: '1px solid',
    borderRadius: 16,
    padding: '18px 22px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.22s ease',
    cursor: 'pointer',
  },
  linkCardTitle: { fontSize: 15, fontWeight: 600, color: '#fff' },
  linkCardUrl: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.02em', wordBreak: 'break-all' },
}
