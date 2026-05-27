'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBalance } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { base } from 'wagmi/chains'
import AgentHeader from '@/components/AgentHeader'
import AgentBottomNav from '@/components/AgentBottomNav'

const LITCOIN_LOGO = 'https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/4a8aa286-ccea-4e03-085e-e26ffb452400/public'

// Litcoin token + claims + Nostradamus wallet (on Base)
const LITCOIN_TOKEN = '0x316ffb9c875f900AdCF04889E415cC86b564EBa3' as const
const LITCOIN_CLAIMS = '0xF703DcF2E88C0673F776870fdb12A453927C6A5e' as const
const NOSTRADAMUS_WALLET = '0x6f2FD3919C058fa0Ece5c76E6C10c9dAee655f4E' as const

// MineBean agents. Stats below are TBD until the Litcoin indexer is wired.
interface AgentEntry {
  id: string
  name: string
  status: 'active' | 'queued'
  liquid: string | null      // e.g. "0.42 LTC"
  miningSince: string | null // e.g. "May 18, 2026"
  walletShort: string | null // e.g. "0x518f…da1A"
  walletFull?: string         // full address for explorer link
}

const AGENTS: AgentEntry[] = [
  { id: 'nostradamus', name: 'Nostradamus', status: 'active', liquid: null, miningSince: null, walletShort: '0x6f2F…5f4E', walletFull: '0x6f2FD3919C058fa0Ece5c76E6C10c9dAee655f4E' },
  { id: 'anti-winner', name: 'Anti-Winner', status: 'queued', liquid: null, miningSince: null, walletShort: null },
  { id: 'anti-loser', name: 'Anti-Loser', status: 'queued', liquid: null, miningSince: null, walletShort: null },
  { id: 'sniper', name: 'Sniper', status: 'queued', liquid: null, miningSince: null, walletShort: null },
  { id: 'beanpot-hunter', name: 'Beanpot Hunter', status: 'queued', liquid: null, miningSince: null, walletShort: null },
]

// ── Page ──────────────────────────────────────────────────────────────────

export default function LitcoinIntegrationPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [selectedId, setSelectedId] = useState<string>(AGENTS[0].id)
  const [litPriceUsd, setLitPriceUsd] = useState<number | null>(null)

  // Nostradamus's Litcoin balance on Base
  const litBal = useBalance({
    address: NOSTRADAMUS_WALLET,
    token: LITCOIN_TOKEN,
    chainId: base.id,
    query: { refetchInterval: 30_000, staleTime: 30_000 },
  })

  // Pending (unclaimed) Litcoin — Litcoin uses signature-based claims, so the
  // unclaimed amount lives on their backend, not on-chain. Their dashboard
  // calls /v1/claims/status?wallet={addr}; we proxy it through
  // /api/litcoin/balance/[addr] to stay same-origin from agent.minebean.com.
  // Response includes `claimable` (wei string) — the amount that can be claimed
  // right now — plus totalEarned / alreadyClaimed for full context.
  const unclaimedQuery = useQuery({
    queryKey: ['litcoin-claims-status', NOSTRADAMUS_WALLET.toLowerCase()],
    queryFn: async () => {
      const res = await fetch(`/api/litcoin/balance/${NOSTRADAMUS_WALLET.toLowerCase()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`litcoin claims status: ${res.status}`)
      const data = await res.json() as { claimable?: string }
      return data.claimable ? BigInt(data.claimable) : BigInt(0)
    },
    refetchInterval: 30_000,
    staleTime: 30_000,
    retry: 2,
  })

  // Live Litcoin USD price via DexScreener
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${LITCOIN_TOKEN}`, { cache: 'no-store' })
        const data = await res.json()
        const pairs = data.pairs ?? []
        const best = pairs.sort((a: { liquidity?: { usd: number } }, b: { liquidity?: { usd: number } }) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
        if (best?.priceUsd) setLitPriceUsd(parseFloat(best.priceUsd))
      } catch { /* silent */ }
    }
    fetchPrice()
    const interval = setInterval(fetchPrice, 60_000)
    return () => clearInterval(interval)
  }, [])

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

  // Decimals (default 18) and symbol from on-chain
  const litDecimals = litBal.data?.decimals ?? 18
  const litSymbol = litBal.data?.symbol ?? 'LIT'

  // Nostradamus's wallet balance (claimed / liquid)
  const nostraLiquidWei = litBal.data?.value
  const nostraLiquidFloat = nostraLiquidWei !== undefined ? parseFloat(formatUnits(nostraLiquidWei, litDecimals)) : null

  // Nostradamus's pending (unclaimed) from the Litcoin backend
  const nostraUnclaimedWei = unclaimedQuery.data as bigint | undefined
  const nostraUnclaimedFloat = nostraUnclaimedWei !== undefined ? parseFloat(formatUnits(nostraUnclaimedWei, litDecimals)) : null

  // Total mined = liquid + unclaimed (assumes the wallet hasn't spent received Litcoin elsewhere)
  const nostraTotalFloat = (nostraLiquidFloat ?? 0) + (nostraUnclaimedFloat ?? 0)

  // Aggregate totals across every MineBean agent on Litcoin
  // (right now Nostradamus is the only active wallet, so totals == Nostradamus's)
  const totalMinedFloat = nostraTotalFloat
  const totalMinedUsd = litPriceUsd ? (totalMinedFloat * litPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null
  const totalUnclaimedFloat = nostraUnclaimedFloat ?? 0
  const totalUnclaimedUsd = litPriceUsd ? (totalUnclaimedFloat * litPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null
  const totalClaimedFloat = nostraLiquidFloat ?? 0
  const totalClaimedUsd = litPriceUsd ? (totalClaimedFloat * litPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null

  // Selected-agent display (only Nostradamus is wired)
  const isNostradamus = selected.id === 'nostradamus'
  const liquidDisplay = isNostradamus && nostraLiquidFloat !== null
    ? `${nostraLiquidFloat.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${litSymbol}`
    : (isNostradamus ? (litBal.isLoading ? 'Loading…' : '—') : '—')
  const liquidUsd = isNostradamus && nostraLiquidFloat !== null && litPriceUsd
    ? (nostraLiquidFloat * litPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null
  const unclaimedDisplay = isNostradamus && nostraUnclaimedFloat !== null
    ? `${nostraUnclaimedFloat.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${litSymbol}`
    : (isNostradamus ? (unclaimedQuery.isPending ? 'Loading…' : '—') : '—')
  const unclaimedUsd = isNostradamus && nostraUnclaimedFloat !== null && litPriceUsd
    ? (nostraUnclaimedFloat * litPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null

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

        {/* Hero — logo + title centered as a group, subtitle centered below */}
        <section style={s.hero}>
          <div style={s.heroTitleRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LITCOIN_LOGO} alt="Litcoin logo" style={s.heroLogo} />
            <h1 style={isMobile ? { ...s.heroTitle, fontSize: 40 } : s.heroTitle}>Litcoin</h1>
          </div>
          <p style={s.heroSub}>
            MineBean agents deployed against Litcoin. View the aggregate position across every active strategy and dig into each one below.
          </p>
        </section>

        {/* Treasury aggregate cards — no heading, hero subtitle explains it */}
        <section style={s.section}>
          <div style={isMobile ? s.statsGridMobile : s.statsGrid}>
            <Stat
              label="TOTAL MINED"
              value={`${totalMinedFloat.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${litSymbol}`}
              sub={totalMinedUsd ? `$${totalMinedUsd}` : undefined}
              tooltip="Liquid + unclaimed across every active MineBean agent on Litcoin. The lifetime mining position."
            />
            <Stat
              label="UNCLAIMED"
              value={`${totalUnclaimedFloat.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${litSymbol}`}
              sub={totalUnclaimedUsd ? `$${totalUnclaimedUsd}` : undefined}
              tooltip="Pending Litcoin rewards waiting to be claimed via the coordinator-signed claim flow."
            />
            <Stat
              label="CLAIMED"
              value={`${totalClaimedFloat.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${litSymbol}`}
              sub={totalClaimedUsd ? `$${totalClaimedUsd}` : undefined}
              tooltip="Litcoin already pulled from the rewards contract into the deployer wallet."
            />
          </div>
        </section>

        {/* Agents */}
        <section style={s.section}>
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Agents</h2>
          <p style={s.sectionSub}>
            Click an agent to see its details below.
          </p>

          {/* Agent tab row */}
          <div style={isMobile ? s.agentTabsMobile : s.agentTabs}>
            {AGENTS.map((agent) => {
              const isSelected = agent.id === selectedId
              const active = agent.status === 'active'
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedId(agent.id)}
                  style={{
                    ...s.agentTab,
                    borderColor: isSelected
                      ? 'rgba(0,82,255,0.55)'
                      : 'rgba(255,255,255,0.06)',
                    background: isSelected
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
                <Stat label="LIQUID" value={liquidDisplay} sub={liquidUsd ? `$${liquidUsd}` : undefined} tooltip="Live Litcoin balance sitting in this agent's wallet, ready to spend or stake." />
                <Stat label="UNCLAIMED" value={unclaimedDisplay} sub={unclaimedUsd ? `$${unclaimedUsd}` : undefined} tooltip="Pending Litcoin rewards earned by this agent, waiting for the next claim transaction." />
                {selected.walletFull ? (
                  <StatLink label="WALLET" value={selected.walletShort ?? '—'} href={`https://basescan.org/address/${selected.walletFull}`} />
                ) : (
                  <Stat label="WALLET" value={selected.walletShort ?? '—'} mono />
                )}
              </div>
            ) : (
              <div style={s.detailEmpty}>
                <span style={s.detailEmptyTitle}>Queued for rollout</span>
                <span style={s.detailEmptySub}>This strategy will be deployed against Litcoin as we extend the framework.</span>
              </div>
            )}
          </div>
        </section>
      </main>

      {isMobile && <AgentBottomNav currentPage="integrations" />}
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────────────────

const s: { [key: string]: React.CSSProperties } = {
  page: { fontFamily: "'Inter', -apple-system, sans-serif", minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent' },
  main: { maxWidth: 1280, margin: '0 auto', padding: '40px 60px 80px', flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 40 },
  mainMobile: { padding: '20px 16px 120px', flex: 1, display: 'flex', flexDirection: 'column', gap: 28 },
  backLink: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)',
    textDecoration: 'none', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em',
    textTransform: 'uppercase', fontWeight: 600, transition: 'color 0.15s ease', width: 'fit-content',
  },

  hero: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 18, maxWidth: 760, margin: '0 auto' },
  heroTitleRow: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  heroLogo: { width: 64, height: 64, borderRadius: 16, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' },
  heroTitle: { fontSize: 56, fontWeight: 700, color: '#fff', lineHeight: 1.05, margin: 0, letterSpacing: '-0.025em' },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0, maxWidth: 680, textAlign: 'center' },

  section: { display: 'flex', flexDirection: 'column', gap: 14 },
  sectionTitle: { fontSize: 26, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.015em' },
  sectionSub: { fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, margin: 0, maxWidth: 620 },

  // Agent tabs
  agentTabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 10,
    marginTop: 6,
  },
  agentTabsMobile: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
    marginTop: 6,
  },
  agentTab: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid',
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
  },
  tabDot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
  },
  tabName: {
    fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2,
  },

  // Detail panel
  detail: {
    marginTop: 8,
    border: '1px solid rgba(0,82,255,0.18)',
    borderRadius: 20,
    padding: 28,
    background: 'linear-gradient(180deg, rgba(0,82,255,0.05) 0%, rgba(0,82,255,0.01) 100%)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  detailName: {
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.01em',
  },
  detailStatus: {
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.14em',
  },

  detailEmpty: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '12px 0',
  },
  detailEmptyTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
  },
  detailEmptySub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 1.55,
  },
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

  // Stats grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 14,
  },
  statsGridMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 10,
  },
  statCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.14em',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.2,
    wordBreak: 'break-all',
  },
  statSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: "'Space Mono', monospace",
    marginTop: 4,
  },
}
