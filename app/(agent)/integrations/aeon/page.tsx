'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAccount, useBalance } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { base } from 'wagmi/chains'
import AgentHeader from '@/components/AgentHeader'
import AgentBottomNav from '@/components/AgentBottomNav'
import { CONTRACTS } from '@/lib/contracts'
import { apiFetch } from '@/lib/api'

const AEON_LOGO = 'https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/57ecc07e-4344-4f40-42ce-f31583f90800/public'

function formatTokenAmount(value: bigint | undefined, decimals = 18, displayDecimals = 4): string {
  if (value === undefined || value === null) return '0'
  const formatted = formatUnits(value, decimals)
  const num = parseFloat(formatted)
  if (num === 0) return '0'
  if (num < 0.0001) return num.toExponential(2)
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals,
  })
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AeonIntegrationPage() {
  const { address, isConnected } = useAccount()
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [beanPriceUsd, setBeanPriceUsd] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const beanBal = useBalance({
    address,
    token: CONTRACTS.Bean.address,
    chainId: base.id,
    query: { enabled: !!address, refetchInterval: 30_000, staleTime: 30_000 },
  })

  const lowerAddress = address?.toLowerCase()

  const rewardsQuery = useQuery({
    queryKey: ['integrations-aeon-rewards', lowerAddress],
    queryFn: () => apiFetch<{ pendingBEAN?: { netFormatted?: string } }>(`/api/user/${lowerAddress}/rewards`),
    enabled: !!lowerAddress,
    refetchInterval: 60_000,
    staleTime: 45_000,
    retry: 1,
  })

  const historyQuery = useQuery({
    queryKey: ['integrations-aeon-history', lowerAddress],
    queryFn: () => apiFetch<{ pagination?: { total?: number } }>(`/api/user/${lowerAddress}/history?type=deploy&limit=1`),
    enabled: !!lowerAddress,
    refetchInterval: 60_000,
    staleTime: 45_000,
    retry: 1,
  })

  const pendingBean = rewardsQuery.data?.pendingBEAN?.netFormatted ? parseFloat(rewardsQuery.data.pendingBEAN.netFormatted) : 0
  const roundsPlayed = historyQuery.data?.pagination?.total ?? 0
  const pendingLoading = rewardsQuery.isPending && !rewardsQuery.isError
  const roundsLoading = historyQuery.isPending && !historyQuery.isError

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CONTRACTS.Bean.address}`, { cache: 'no-store' })
        const data = await res.json()
        const pairs = data.pairs ?? []
        const best = pairs.sort((a: { liquidity?: { usd: number } }, b: { liquidity?: { usd: number } }) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
        if (best?.priceUsd) setBeanPriceUsd(parseFloat(best.priceUsd))
      } catch {
        // silent
      }
    }
    fetchPrice()
    const interval = setInterval(fetchPrice, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) return null

  const beanValue = beanBal.data?.value
  const beanInWallet = beanValue ? parseFloat(formatUnits(beanValue, 18)) : 0
  const totalBeanMined = beanInWallet + pendingBean

  return (
    <div style={s.page}>
      <style>{`
        @keyframes pulse-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
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
            <img src={AEON_LOGO} alt="AEON logo" style={s.heroLogo} />
            <h1 style={isMobile ? { ...s.heroTitle, fontSize: 40 } : s.heroTitle}>AEON</h1>
          </div>
          <p style={s.heroSub}>
            AEON is an autonomous agent framework that runs entirely on GitHub Actions with zero ongoing infrastructure.
            The MineBean skill drops straight into any AEON fork: fund a wallet, add the skill, and your AEON instance mines BEAN on schedule.
            Auto-claims when rewards cross your threshold. MIT-licensed, fully open.
          </p>
        </section>

        {/* Mining stats */}
        {isConnected && (
          <section style={s.section}>
            <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Your mining stats</h2>

            <div style={isMobile ? s.gridMobile : s.gridThree}>
              <Card
                label="TOTAL BEAN EARNED"
                value={totalBeanMined > 0 ? totalBeanMined.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '0'}
                usd={beanPriceUsd && totalBeanMined > 0 ? (totalBeanMined * beanPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null}
                sub="In wallet + pending"
                loading={beanBal.isLoading || pendingLoading}
              />
              <Card
                label="UNCLAIMED BEAN"
                value={pendingBean > 0 ? pendingBean.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '0'}
                usd={beanPriceUsd && pendingBean > 0 ? (pendingBean * beanPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null}
                sub="Auto-claims when over threshold"
                loading={pendingLoading}
                accent={pendingBean > 0}
              />
              <Card
                label="ROUNDS MINED"
                value={roundsPlayed.toLocaleString('en-US')}
                sub="Lifetime deploys by this wallet"
                loading={roundsLoading}
              />
            </div>
          </section>
        )}

        {/* External actions */}
        <section style={s.section}>
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Get the skill</h2>
          <div style={isMobile ? s.actionsGridMobile : s.actionsGrid}>
            <ExternalAction
              title="minebean-skills on GitHub"
              description="Source for the AEON skill. MIT-licensed. Fork, audit, drop into your AEON instance."
              href="https://github.com/damo-nu11/minebean-skills"
            />
            <ExternalAction
              title="AEON framework"
              description="The autonomous agent framework that hosts the skill. GitHub Actions runtime, zero infrastructure."
              href="https://x.com/aeonframework"
            />

          </div>
        </section>

        {/* How to mine */}
        <section style={s.section}>
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>How to mine BEAN with AEON</h2>
          <p style={s.sectionSub}>
            Set it up once. Runs forever on your fork, your wallet, your keys.
          </p>
          <div style={s.stepsList}>
            <Step
              number={1}
              title="Fork the AEON framework"
              description="Start from the AEON template. Same fork you'd use for any AEON deployment — the skill plugs in alongside whatever else you run."
            />
            <Step
              number={2}
              title="Install the MineBean skill"
              description="Clone or vendor the skill from the open-source repo into your AEON fork's skills directory."
              code="git clone https://github.com/damo-nu11/minebean-skills"
            />
            <Step
              number={3}
              title="Configure GitHub Actions secrets"
              description="In your AEON fork's repo settings, add the deploy wallet key, Base RPC URL, and auto-claim threshold as Actions secrets."
              code="AGENT_DEPLOYER_KEY=0x...&#10;BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/...&#10;AGENT_CLAIM_THRESHOLD_BEAN=10"
            />
            <Step
              number={4}
              title="Schedule the workflow"
              description="AEON workflows fire on external dispatch. Point any scheduler at your fork's workflow_dispatch endpoint at your chosen cadence."
            />
            <Step
              number={5}
              title="Activate the skill"
              description="Enable the MineBean skill in your AEON config. The skill broadcasts a deploy to the GridMining contract on each tick using your chosen strategy."
            />
            <Step
              number={6}
              title="Let it run"
              description="The skill auto-claims BEAN once your pending rewards cross the threshold. Mine forever, no babysitting."
              isLast
            />
          </div>
        </section>
      </main>

      {isMobile && <AgentBottomNav currentPage="integrations" />}
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function Card({
  label,
  value,
  usd,
  usdPrefix = '$',
  sub,
  loading,
  accent,
}: {
  label: string
  value: string
  usd?: string | null
  usdPrefix?: string
  sub?: string
  loading?: boolean
  accent?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.card,
        borderColor: hovered
          ? 'rgba(0,82,255,0.45)'
          : (accent ? 'rgba(0,82,255,0.2)' : 'rgba(255,255,255,0.06)'),
        background: hovered
          ? 'linear-gradient(180deg, rgba(0,82,255,0.1) 0%, rgba(0,82,255,0.02) 100%)'
          : (accent
              ? 'linear-gradient(180deg, rgba(0,82,255,0.06) 0%, rgba(0,82,255,0.01) 100%)'
              : 'rgba(255,255,255,0.02)'),
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 10px 32px rgba(0,82,255,0.15), inset 0 1px 0 rgba(150,200,255,0.08)' : 'none',
        transition: 'all 0.22s ease',
      }}
    >
      <div style={s.cardLabel}>{label}</div>
      {loading ? (
        <div style={{ ...s.skeleton, width: '60%', height: 30, marginTop: 4, marginBottom: 4 }} />
      ) : (
        <div style={s.cardValue}>{value}</div>
      )}
      {usd && !loading && <div style={s.cardUsd}>{usdPrefix}{usd}</div>}
      {sub && <div style={s.cardSub}>{sub}</div>}
    </div>
  )
}

function Step({ number, title, description, code, isLast }: { number: number; title: string; description: string; code?: string; isLast?: boolean }) {
  return (
    <div style={{ ...s.stepRow, ...(isLast ? { borderBottom: 'none' } : {}) }}>
      <div style={s.stepNumber}>{String(number).padStart(2, '0')}</div>
      <div style={s.stepBody}>
        <div style={s.stepTitle}>{title}</div>
        <div style={s.stepDescription}>{description}</div>
        {code && <pre style={s.stepCode}><code>{code}</code></pre>}
      </div>
    </div>
  )
}

function ExternalAction({ title, description, href }: { title: string; description: string; href: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.action,
        borderColor: hovered ? 'rgba(0,82,255,0.4)' : 'rgba(255,255,255,0.06)',
        background: hovered ? 'rgba(0,82,255,0.05)' : 'rgba(255,255,255,0.02)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={s.actionTitle}>{title}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hovered ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </div>
      <div style={s.actionDescription}>{description}</div>
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

  walletBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 700,
    color: 'rgba(255,255,255,0.45)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em',
    padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  },
  walletBadgeAddr: { color: 'rgba(255,255,255,0.7)', fontFamily: "'Space Mono', monospace" },

  gridThree: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  gridMobile: { display: 'grid', gridTemplateColumns: '1fr', gap: 10 },
  actionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  actionsGridMobile: { display: 'grid', gridTemplateColumns: '1fr', gap: 10 },

  card: {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 22,
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', gap: 2, minHeight: 130,
  },
  cardLabel: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.14em', marginBottom: 10 },
  cardValue: { fontSize: 28, fontWeight: 700, color: '#fff', fontFamily: "'Space Mono', monospace", lineHeight: 1.1, wordBreak: 'break-all' },
  cardUsd: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: "'Space Mono', monospace", marginTop: 2 },
  cardSub: { fontSize: 10, color: 'rgba(255,255,255,0.32)', marginTop: 'auto', paddingTop: 12, fontFamily: "'Space Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' },

  action: {
    border: '1px solid', borderRadius: 16, padding: 22, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none', color: 'inherit', transition: 'all 0.25s ease', cursor: 'pointer',
  },
  actionTitle: { fontSize: 17, fontWeight: 600, color: '#fff' },
  actionDescription: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 },

  skeleton: {
    borderRadius: 4,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },

  stepsList: {
    display: 'flex', flexDirection: 'column', gap: 0,
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden',
    background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  },
  stepRow: {
    display: 'flex', alignItems: 'flex-start', gap: 22, padding: '24px 28px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  stepNumber: {
    flexShrink: 0, fontSize: 18, fontWeight: 700, color: 'rgba(0,82,255,0.7)',
    fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em', width: 36, lineHeight: 1.2, paddingTop: 2,
  },
  stepBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  stepTitle: { fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.3 },
  stepDescription: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 },
  stepCode: {
    display: 'block', marginTop: 8, padding: '12px 14px', background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
    fontFamily: "'Space Mono', monospace", fontSize: 12, color: 'rgba(180,210,255,0.85)',
    letterSpacing: '0.02em', maxWidth: '100%', overflowX: 'auto', whiteSpace: 'pre',
  },
}
