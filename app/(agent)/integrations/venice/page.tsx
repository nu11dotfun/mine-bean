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

// ── Token addresses on Base ───────────────────────────────────────────────

const VVV_ADDRESS = '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf' as const
const SVVV_ADDRESS = '0x321b7ff75154472B18EDb199033fF4D116F340Ff' as const
const DIEM_ADDRESS = '0xf4d97f2da56e8c3098f3a8d538db630a2606a024' as const

// ── Helpers ───────────────────────────────────────────────────────────────

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

function formatUsd(tokenAmount: bigint | undefined, priceUsd: number | null, decimals = 18): string | null {
  if (!tokenAmount || tokenAmount === BigInt(0) || !priceUsd) return null
  const tokens = parseFloat(formatUnits(tokenAmount, decimals))
  const usd = tokens * priceUsd
  if (usd < 0.01) return '<0.01'
  return usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function VeniceIntegrationPage() {
  const { address, isConnected } = useAccount()
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [vvvPriceUsd, setVvvPriceUsd] = useState<number | null>(null)
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
  const vvvBal = useBalance({
    address,
    token: VVV_ADDRESS,
    chainId: base.id,
    query: { enabled: !!address, refetchInterval: 30_000, staleTime: 30_000 },
  })
  const svvvBal = useBalance({
    address,
    token: SVVV_ADDRESS,
    chainId: base.id,
    query: { enabled: !!address, refetchInterval: 30_000, staleTime: 30_000 },
  })
  const diemBal = useBalance({
    address,
    token: DIEM_ADDRESS,
    chainId: base.id,
    query: { enabled: !!address, refetchInterval: 30_000, staleTime: 30_000 },
  })

  // Read pending rewards STRAIGHT from the GridMining contract via wagmi.
  // This is the same source `/api/user/:address/rewards` reads on the backend  - 
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

  // Returns: (pendingETH, pendingUnroastedBEAN, pendingRoastedBEAN, uncheckpointedRound)
  const rewardsTuple = pendingRewardsRead.data as readonly [bigint, bigint, bigint, bigint] | undefined
  const unroastedBeanRaw = rewardsTuple?.[1] ?? BigInt(0)
  const roastedBeanRaw = rewardsTuple?.[2] ?? BigInt(0)
  const unroastedBean = parseFloat(formatUnits(unroastedBeanRaw, 18))
  const roastedBean = parseFloat(formatUnits(roastedBeanRaw, 18))

  // Rounds mined - same-origin proxy at /api/user/[address]/rounds-count.
  // Reads canonical totals.roundsPlayed from the backend (same source as
  // the main-site ProfilePage). Single backend call, no per-round loops,
  // no 100-round cap, no settlement filter - true lifetime count.
  const lowerAddress = address?.toLowerCase()
  const roundsRouteQuery = useQuery({
    queryKey: ['integrations-venice-rounds-count', lowerAddress],
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

  // Prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const [vvvRes, beanRes] = await Promise.all([
          fetch(`https://api.dexscreener.com/latest/dex/tokens/${VVV_ADDRESS}`, { cache: 'no-store' }),
          fetch(`https://api.dexscreener.com/latest/dex/tokens/${CONTRACTS.Bean.address}`, { cache: 'no-store' }),
        ])
        const vvvData = await vvvRes.json()
        const beanData = await beanRes.json()
        const pickBest = (data: { pairs?: Array<{ priceUsd: string; liquidity?: { usd: number } }> }) => {
          const pairs = data.pairs ?? []
          const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
          return best?.priceUsd ? parseFloat(best.priceUsd) : null
        }
        setVvvPriceUsd(pickBest(vvvData))
        setBeanPriceUsd(pickBest(beanData))
      } catch {
        // silent
      }
    }
    fetchPrices()
    const interval = setInterval(fetchPrices, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) return null

  const vvvValue = vvvBal.data?.value
  const svvvValue = svvvBal.data?.value
  const diemValue = diemBal.data?.value
  const beanValue = beanBal.data?.value

  const totalVvvHeld = (vvvValue ?? BigInt(0)) + (svvvValue ?? BigInt(0))
  const totalUsd = formatUsd(totalVvvHeld, vvvPriceUsd)
  const diemDailyUsd = diemValue && diemValue > BigInt(0)
    ? parseFloat(formatUnits(diemValue, 18))
    : 0
  const beanInWallet = beanValue ? parseFloat(formatUnits(beanValue, 18)) : 0
  // Total earned = wallet balance + everything pending in the contract (unroasted + roasted)
  const totalBeanMinedRaw = beanInWallet + unroastedBean + roastedBean

  // Gate the BEAN cards by whether this wallet has actually used Venice infrastructure.
  // sVVV staked or DIEM minted are the on-chain signals that the wallet is part of
  // the Venice mining loop. Without either, we don't claim the wallet's BEAN was
  // "earned through Venice" - we just show zeros. Proper provider-tracking is on
  // tomorrow's roadmap (Hermes plugin reports LLM provider on each deploy).
  const isVeniceActive =
    !!(svvvValue && svvvValue > BigInt(0)) ||
    !!(diemValue && diemValue > BigInt(0))

  const totalBeanMined = isVeniceActive ? totalBeanMinedRaw : 0
  const unroastedBeanGated = isVeniceActive ? unroastedBean : 0
  const roundsPlayedGated = isVeniceActive ? roundsPlayed : 0

  return (
    <div style={s.page}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <AgentHeader currentPage="integrations" isMobile={isMobile} />

      <main style={isMobile ? s.mainMobile : s.main}>
        {/* Back link */}
        <Link href="/integrations" style={s.backLink}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All integrations
        </Link>

        {/* Hero - logo + title centered as a group, subtitle centered below */}
        <section style={s.hero}>
          <div style={s.heroTitleRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/e9b02db4-2d71-466f-1094-d85c7fd10300/public"
              alt="Venice logo"
              style={s.heroLogo}
            />
            <h1 style={isMobile ? { ...s.heroTitle, fontSize: 40 } : s.heroTitle}>Venice</h1>
          </div>
          <p style={s.heroSub}>
            Venice is the inference layer powering MineBean&apos;s autonomous strategy agents.
            Agents stake VVV to receive sVVV, then lock a portion to mint DIEM, which redeems for daily Venice API credits.
            This setup lets the agent fund its own compute while it mines.
          </p>
        </section>

        {/* Powered by Dolphin */}
        <section style={{ marginTop: 8 }}>
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Powered by Dolphin</h2>
          <p style={s.sectionSub}>The model behind Venice is Dolphin, built by @dphnAI.</p>
          <div
            style={{
              marginTop: 16,
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(0,82,255,0.25)',
              borderRadius: 16,
              padding: isMobile ? '20px' : '28px 32px',
              boxShadow: '0 0 40px rgba(0,82,255,0.08)',
            }}
          >
            <p style={{ fontSize: isMobile ? 15 : 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.78)', margin: 0 }}>
              Venice&apos;s uncensored inference runs on Dolphin Mistral 24B Venice Edition, the open-source model from{' '}
              <a href="https://x.com/dphnAI" target="_blank" rel="noopener noreferrer" style={{ color: '#9DC2FF', textDecoration: 'none' }}>@dphnAI</a>{' '}
              (5M+ downloads a month). So MineBean&apos;s Venice-powered agents already reason through Dolphin.
            </p>
            <p style={{ fontSize: isMobile ? 15 : 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.78)', marginTop: 16, marginBottom: 0 }}>
              We took it a step further. <strong style={{ color: '#fff', fontWeight: 600 }}>Dolphin</strong> is a dedicated mining agent that reasons directly through Dolphin&apos;s model every round. The EV math drives the deploy, Dolphin drives the reasoning. Live and on-chain.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
              <Link href="/agents/agent6" style={{ background: '#0052FF', color: '#fff', fontSize: 14, fontWeight: 600, padding: '11px 18px', borderRadius: 10, textDecoration: 'none' }}>
                Watch Dolphin mine
              </Link>
              <a href="https://dphn.ai" target="_blank" rel="noopener noreferrer" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: '#9DC2FF', fontSize: 14, fontWeight: 500, padding: '11px 18px', borderRadius: 10, textDecoration: 'none' }}>
                Visit dphn.ai
              </a>
            </div>
          </div>
        </section>

        {/* Headline metric panel */}
        {isConnected && (
          <section style={s.heroPanel}>
            <div style={s.heroPanelInner}>
              <div style={s.heroPanelLeft}>
                <span style={s.heroPanelLabel}>YOUR VENICE POSITION</span>
                <div style={s.heroPanelValue}>
                  {totalUsd ? `$${totalUsd}` : '$0.00'}
                </div>
                <div style={s.heroPanelMeta}>
                  {formatTokenAmount(totalVvvHeld)} VVV total (liquid + staked)
                </div>
              </div>
              <div style={s.heroPanelDivider} />
              <div style={s.heroPanelRight}>
                <span style={s.heroPanelLabel}>DAILY VENICE COMPUTE</span>
                <div style={s.heroPanelValue}>
                  ${diemDailyUsd.toLocaleString('en-US', { maximumFractionDigits: 4 })}<span style={s.heroPanelUnit}>/day</span>
                </div>
                <div style={s.heroPanelMeta}>
                  From {formatTokenAmount(diemValue)} DIEM minted
                </div>
              </div>
            </div>
          </section>
        )}

        {!isConnected && (
          <section style={s.emptyState}>
            <span style={s.emptyTitle}>Connect your wallet</span>
            <span style={s.emptySub}>
              Once connected, your Venice position and parallel BEAN mining activity will appear here.
            </span>
          </section>
        )}

        {/* Two-column layout: Venice position (left) + BEAN mining alongside (right) */}
        {isConnected && (
          <section style={isMobile ? s.splitColMobile : s.splitCol}>
            <div style={s.splitColInner}>
              <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Venice position</h2>
              <p style={s.sectionSub}>Your stake on Venice. Funds the agent&apos;s daily inference through DIEM.</p>
              <div style={s.stackedCards}>
                <Card
                  label="VVV LIQUID"
                  value={formatTokenAmount(vvvValue)}
                  usd={formatUsd(vvvValue, vvvPriceUsd)}
                  sub="Available to stake or trade"
                  loading={vvvBal.isLoading}
                />
                <Card
                  label="sVVV STAKED"
                  value={formatTokenAmount(svvvValue)}
                  usd={formatUsd(svvvValue, vvvPriceUsd)}
                  sub="Earning Venice yield · 7d unstake cooldown"
                  loading={svvvBal.isLoading}
                  accent
                />
                <Card
                  label="DIEM MINTED"
                  value={formatTokenAmount(diemValue)}
                  usd={
                    diemDailyUsd > 0
                      ? `${diemDailyUsd.toLocaleString('en-US', { maximumFractionDigits: 4 })} /day`
                      : null
                  }
                  usdPrefix="≈ $"
                  sub="Backed by locked sVVV"
                  loading={diemBal.isLoading}
                />
              </div>
            </div>

            <div style={s.splitColInner}>
              <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Earned through Venice</h2>
              <p style={s.sectionSub}>BEAN this wallet has mined while routing its inference through Venice.</p>
              <div style={s.stackedCards}>
                <Card
                  label="TOTAL BEAN EARNED"
                  value={
                    totalBeanMined > 0
                      ? totalBeanMined.toLocaleString('en-US', { maximumFractionDigits: 4 })
                      : '0'
                  }
                  usd={beanPriceUsd && totalBeanMined > 0 ? (totalBeanMined * beanPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null}
                  sub="In wallet + pending"
                  loading={beanBal.isLoading || pendingLoading}
                />
                <Card
                  label="UNROASTED BEAN"
                  value={
                    unroastedBeanGated > 0
                      ? unroastedBeanGated.toLocaleString('en-US', { maximumFractionDigits: 4 })
                      : '0'
                  }
                  usd={beanPriceUsd && unroastedBeanGated > 0 ? (unroastedBeanGated * beanPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null}
                  sub="Pending in rewards contract"
                  loading={pendingLoading}
                  accent={unroastedBeanGated > 0}
                />
                <Card
                  label="ROUNDS MINED"
                  value={roundsPlayedGated.toLocaleString('en-US')}
                  sub="Lifetime deploys by this wallet"
                  loading={roundsLoading}
                />
              </div>
            </div>
          </section>
        )}

        {/* External actions */}
        <section style={s.section}>
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Manage your position</h2>
          <div style={isMobile ? s.actionsGridMobile : s.actionsGrid}>
            <ExternalAction
              title="Stake VVV"
              description="Convert VVV to sVVV to start earning Venice yield."
              href="https://venice.ai/token"
            />
            <ExternalAction
              title="Mint DIEM"
              description="Lock sVVV to mint DIEM and unlock daily Venice compute credits."
              href="https://venice.ai/token"
            />
            <ExternalAction
              title="Visit Venice"
              description="Use your Venice API credits to run inference with sVVV and DIEM."
              href="https://venice.ai"
            />
          </div>
        </section>

        {/* How to mine */}
        <section style={s.section}>
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>How to mine BEAN with Venice</h2>
          <p style={s.sectionSub}>
            The full loop for running an autonomous mining agent that funds its own inference budget through Venice.
          </p>
          <div style={s.stepsList}>
            <Step
              number={1}
              title="Acquire VVV"
              description="Buy VVV on Aerodrome or Uniswap and hold it in the wallet you plan to mine with."
            />
            <Step
              number={2}
              title="Stake VVV → sVVV"
              description="Stake your VVV on venice.ai/token. You receive sVVV 1:1 and start earning Venice yield (current APR shown on the Venice dashboard)."
            />
            <Step
              number={3}
              title="Lock sVVV to mint DIEM"
              description="On the same Venice dashboard, lock a portion of your sVVV to mint DIEM. Each DIEM gives you $1/day of Venice API credit, refreshing every 24 hours. Burn DIEM any time to release the underlying sVVV."
            />
            <Step
              number={4}
              title="Install the Hermes mining plugin"
              description="Open a terminal and install the MineBean plugin into your Hermes environment."
              code="pip install hermes-mine-bean"
            />
            <Step
              number={5}
              title="Configure your agent"
              description="Set your MineBean deployer key, Base RPC URL, and Venice API key in ~/.hermes/.env. The Venice key authenticates your agent against your DIEM allowance."
            />
            <Step
              number={6}
              title="Start the mining loop"
              description="Pick a strategy preset and start the cron. The agent deploys ETH to the GridMining contract every 60 seconds and routes its reasoning through Venice."
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
        boxShadow: hovered
          ? '0 10px 32px rgba(0,82,255,0.15), inset 0 1px 0 rgba(150,200,255,0.08)'
          : 'none',
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
        {code && (
          <code style={s.stepCode}>{code}</code>
        )}
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
  page: {
    fontFamily: "'Inter', -apple-system, sans-serif",
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'transparent',
  },
  main: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '40px 60px 80px',
    flex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 40,
  },
  mainMobile: {
    padding: '20px 16px 120px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },

  // Back link
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textDecoration: 'none',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontWeight: 600,
    transition: 'color 0.15s ease',
    width: 'fit-content',
  },

  // Hero - logo + title row centered as a group, subtitle centered below
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 18,
    maxWidth: 760,
    margin: '0 auto',
  },
  heroTitleRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },

  // Two-column layout for Venice position vs BEAN mining alongside
  splitCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
    alignItems: 'start',
  },
  splitColMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 28,
  },
  splitColInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    minWidth: 0,
  },
  stackedCards: {
    display: 'grid',
    gridAutoRows: '1fr',
    gap: 12,
  },
  heroLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    objectFit: 'cover',
    flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  heroStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 10,
    color: '#00C853',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.18em',
    fontWeight: 700,
  },
  heroStatusDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#00C853',
    display: 'inline-block',
    boxShadow: '0 0 10px #00C853',
    animation: 'pulse-glow 2s ease-in-out infinite',
  },
  heroTitle: {
    fontSize: 56,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.05,
    margin: 0,
    letterSpacing: '-0.025em',
  },
  heroSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.65,
    margin: 0,
    maxWidth: 680,
    textAlign: 'center',
  },

  // Hero panel
  heroPanel: {
    background: 'linear-gradient(180deg, rgba(0,82,255,0.08) 0%, rgba(0,82,255,0.02) 100%)',
    border: '1px solid rgba(0,82,255,0.18)',
    borderRadius: 24,
    padding: 0,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: 'inset 0 1px 0 rgba(150,200,255,0.08)',
  },
  heroPanelInner: {
    display: 'flex',
    alignItems: 'stretch',
    padding: 32,
    gap: 32,
  },
  heroPanelLeft: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  heroPanelRight: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  heroPanelDivider: {
    width: 1,
    background: 'rgba(255,255,255,0.08)',
  },
  heroPanelLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.16em',
    fontWeight: 700,
  },
  heroPanelValue: {
    fontSize: 38,
    fontWeight: 700,
    color: '#fff',
    fontFamily: "'Space Mono', monospace",
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
  },
  heroPanelUnit: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 500,
    marginLeft: 4,
  },
  heroPanelMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.04em',
  },

  // Empty state
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
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
  },
  emptySub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    maxWidth: 380,
    lineHeight: 1.55,
  },

  // Section
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    letterSpacing: '-0.015em',
  },
  sectionSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.55,
    margin: 0,
    maxWidth: 620,
  },

  // Grids
  gridThree: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 14,
  },
  gridMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 10,
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 14,
  },
  actionsGridMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 10,
  },

  // Card
  card: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 22,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minHeight: 175,
    height: '100%',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.14em',
    marginBottom: 10,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    fontFamily: "'Space Mono', monospace",
    lineHeight: 1.1,
    wordBreak: 'break-all',
  },
  cardUsd: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: "'Space Mono', monospace",
    marginTop: 2,
  },
  cardSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.32)',
    marginTop: 'auto',
    paddingTop: 12,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },

  // External action
  action: {
    border: '1px solid',
    borderRadius: 16,
    padding: 22,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.25s ease',
    cursor: 'pointer',
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: '#fff',
  },
  actionDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.55,
  },

  // Wallet badge
  walletBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.1em',
    padding: '6px 12px',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  walletBadgeAddr: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: "'Space Mono', monospace",
  },

  // Skeleton
  skeleton: {
    borderRadius: 4,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },

  // Steps
  stepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 20,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.02)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 22,
    padding: '24px 28px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  stepNumber: {
    flexShrink: 0,
    fontSize: 18,
    fontWeight: 700,
    color: 'rgba(0,82,255,0.7)',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.04em',
    width: 36,
    lineHeight: 1.2,
    paddingTop: 2,
  },
  stepBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    lineHeight: 1.3,
  },
  stepDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.6,
  },
  stepCode: {
    display: 'inline-block',
    marginTop: 8,
    padding: '10px 14px',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    fontFamily: "'Space Mono', monospace",
    fontSize: 12,
    color: 'rgba(180,210,255,0.85)',
    letterSpacing: '0.02em',
    width: 'fit-content',
    maxWidth: '100%',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
  },
}
