'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAccount, useBalance, useReadContract } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { base } from 'wagmi/chains'
import AgentHeader from '@/components/AgentHeader'
import AgentBottomNav from '@/components/AgentBottomNav'
import { CONTRACTS } from '@/lib/contracts'
import { apiFetch } from '@/lib/api'

const HERMES_LOGO = 'https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/d8efab4d-e560-40f9-6203-f94ce0822100/public'

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

export default function HermesIntegrationPage() {
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

  // Read pending rewards STRAIGHT from the GridMining contract via wagmi.
  // This is the same source `/api/user/:address/rewards` reads on the backend —
  // skipping the backend entirely sidesteps any CORS, subdomain, env-var, or
  // rate-limit issue between agent.minebean.com and api.minebean.com.
  const pendingRewardsRead = useReadContract({
    address: CONTRACTS.GridMining.address,
    abi: CONTRACTS.GridMining.abi,
    functionName: 'getTotalPendingRewards',
    args: address ? [address] : undefined,
    chainId: base.id,
    query: {
      enabled: !!address,
      refetchInterval: 30_000,
      staleTime: 20_000,
    },
  })

  const rewardsTuple = pendingRewardsRead.data as readonly [bigint, bigint, bigint, bigint] | undefined
  const unroastedBeanRaw = rewardsTuple?.[1] ?? BigInt(0)
  const roastedBeanRaw = rewardsTuple?.[2] ?? BigInt(0)
  const unroastedBean = parseFloat(formatUnits(unroastedBeanRaw, 18))
  const roastedBean = parseFloat(formatUnits(roastedBeanRaw, 18))

  // Rounds mined — same-origin proxy at /api/user/[address]/rounds-count.
  // Reads canonical totals.roundsPlayed (matches main-site profile page).
  const lowerAddress = address?.toLowerCase()
  const roundsRouteQuery = useQuery({
    queryKey: ['integrations-hermes-rounds-count', lowerAddress],
    queryFn: async () => {
      const res = await fetch(`/api/user/${lowerAddress}/rounds-count`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`rounds count: ${res.status}`)
      const data = await res.json() as { roundsPlayed?: number }
      return data.roundsPlayed ?? 0
    },
    enabled: !!lowerAddress,
    refetchInterval: 60_000,
    staleTime: 45_000,
    retry: 2,
  })
  const roundsPlayed = roundsRouteQuery.data ?? 0

  const pendingLoading = isConnected && pendingRewardsRead.isPending && !pendingRewardsRead.isError
  const roundsLoading = roundsRouteQuery.isPending && !roundsRouteQuery.isError

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
  // Total earned = wallet balance + everything pending in the contract (unroasted + roasted)
  const totalBeanMined = beanInWallet + unroastedBean + roastedBean

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
            <img src={HERMES_LOGO} alt="Hermes logo" style={s.heroLogo} />
            <h1 style={isMobile ? { ...s.heroTitle, fontSize: 40 } : s.heroTitle}>Hermes</h1>
          </div>
          <p style={s.heroSub}>
            Hermes is the execution runtime for MineBean agents. It runs the autonomous mining loop:
            polls round state every 60s, applies a chosen strategy preset, and broadcasts ETH deploys directly to the GridMining contract.
            LLM reasoning is provider-agnostic, so you can route it through Venice, Anthropic, OpenAI, or any other endpoint.
          </p>
        </section>

        {/* Mining stats — wallet-scoped, LLM provider agnostic */}
        {!isConnected && (
          <section style={s.emptyState}>
            <span style={s.emptyTitle}>Connect your wallet</span>
            <span style={s.emptySub}>
              Once connected, your BEAN mining stats appear here. The wallet is the source of truth — your LLM provider (Venice, Anthropic, DeepSeek, anything) doesn&apos;t change what shows up.
            </span>
          </section>
        )}

        {isConnected && (
          <section style={s.section}>
            <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Your mining stats</h2>
            <p style={s.sectionSub}>
              Tracked by wallet address. Whichever LLM provider you route Hermes through, the on-chain mining stats stay the same.
            </p>

            <div style={isMobile ? s.gridMobile : s.gridThree}>
              <Card
                label="TOTAL BEAN EARNED"
                value={totalBeanMined > 0 ? totalBeanMined.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '0'}
                usd={beanPriceUsd && totalBeanMined > 0 ? (totalBeanMined * beanPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null}
                sub="In wallet + pending"
                loading={beanBal.isLoading || pendingLoading}
              />
              <Card
                label="UNROASTED BEAN"
                value={unroastedBean > 0 ? unroastedBean.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '0'}
                usd={beanPriceUsd && unroastedBean > 0 ? (unroastedBean * beanPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null}
                sub="Pending in rewards contract"
                loading={pendingLoading}
                accent={unroastedBean > 0}
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
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Get the plugin</h2>
          <div style={isMobile ? s.actionsGridMobile : s.actionsGrid}>
            <ExternalAction
              title="Install via pip"
              description="hermes-mine-bean is published on PyPI. One command to install into any Python environment."
              href="https://pypi.org/project/hermes-mine-bean/"
            />
            <ExternalAction
              title="Source on GitHub"
              description="Strategies, CLI, MCP server, and the deploy logic are all open. Audit the code, fork, contribute."
              href="https://github.com/damo-nu11/hermes-mine-bean"
            />
            <ExternalAction
              title="Nous Research"
              description="Hermes is built by Nous Research. The host agent framework hermes-mine-bean plugs into."
              href="https://nousresearch.com"
            />
          </div>
        </section>

        {/* How to mine */}
        <section style={s.section}>
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>How to mine BEAN with Hermes</h2>
          <p style={s.sectionSub}>
            Six steps from zero to an autonomous agent mining BEAN every 60 seconds. LLM provider is your choice.
          </p>
          <div style={s.stepsList}>
            <Step
              number={1}
              title="Install the plugin"
              description="Open a Python 3.11+ environment (a fresh venv is cleanest) and install hermes-mine-bean from PyPI."
              code="pip install hermes-mine-bean"
            />
            <Step
              number={2}
              title="Generate or import a deploy wallet"
              description="Hermes broadcasts on-chain deploys, so it needs a wallet with an ETH balance. Create a fresh wallet dedicated to mining or import an existing one you control."
            />
            <Step
              number={3}
              title="Configure your env file"
              description="Set the deployer key, miner address, and a Base RPC URL in ~/.hermes/.env. Use an Alchemy or QuickNode RPC for reliable broadcasts."
              code="MINEBEAN_DEPLOYER_KEY=0x...&#10;MINEBEAN_MINER_ADDRESS=0x...&#10;BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/..."
            />
            <Step
              number={4}
              title="Pick an LLM provider"
              description="Hermes is provider-agnostic. Use Venice (self-funded through your DIEM allowance), Anthropic, OpenAI, or any other endpoint. Set the matching API key in the env. The Venice integration page covers the full Venice setup."
              code="ANTHROPIC_API_KEY=sk-ant-...  # or VENICE_API_KEY=... etc."
            />
            <Step
              number={5}
              title="Choose a strategy preset"
              description="Five built-in strategies: anti-winner (every round, beanpot eligibility), nostradamus (predictive EV), anti-loser (cold-block aversion), sniper (late-round timing), beanpot-hunter (jackpot-only). Anti-winner is the highest-cadence default."
            />
            <Step
              number={6}
              title="Start the autonomous loop"
              description="Run the deploy command in a 60-second loop. The agent will read the current grid, apply your chosen strategy, and broadcast the deploy directly to GridMining."
              code={`hermes-minebean-deploy --profile anti-winner --no-dry-run`}
              isLast
            />
          </div>
        </section>
      </main>

      {isMobile && <AgentBottomNav currentPage="integrations" />}
    </div>
  )
}

// ── Subcomponents (mirrored from Venice page) ────────────────────────────

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

  emptyState: {
    border: '1px dashed rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: '52px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    textAlign: 'center',
    background: 'rgba(255,255,255,0.01)',
  },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: '#fff' },
  emptySub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', maxWidth: 460, lineHeight: 1.55 },

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
