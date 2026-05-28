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

  // Live network-wide stats from Nookplot gateway.
  //   { totalChallenges, openChallenges, totalSubmissions, verifiedSubmissions,
  //     uniqueMiners, avgCompositeScore, totalNookEarned, totalStaked,
  //     newMinersThisEpoch, challengesSolvedThisEpoch }
  const networkStatsQuery = useQuery({
    queryKey: ['nook-network-stats'],
    queryFn: async () => {
      const res = await fetch('/api/nook/network-stats', { cache: 'no-store' })
      if (!res.ok) throw new Error(`network-stats: ${res.status}`)
      return res.json() as Promise<{
        totalChallenges: number
        openChallenges: number
        totalSubmissions: number
        verifiedSubmissions: number
        uniqueMiners: number
        avgCompositeScore: number
        totalNookEarned: number
        totalStaked: number
        newMinersThisEpoch: number
        challengesSolvedThisEpoch: number
      }>
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  // Recent reasoning submissions for the active agent (Nostradamus only for now).
  // When more agents come online we map over the AGENTS array and merge results.
  const submissionsQuery = useQuery({
    queryKey: ['nook-agent-submissions', NOSTRADAMUS_WALLET.toLowerCase()],
    queryFn: async () => {
      const res = await fetch(`/api/nook/submissions/${NOSTRADAMUS_WALLET}?limit=100`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`submissions: ${res.status}`)
      return res.json() as Promise<{
        submissions: Array<{
          id: string
          challengeId: string
          traceSummary: string | null
          modelUsed: string | null
          compositeScore: string | null
          rewardNook: string | null
          rewardStatus: string | null
          status: string | null
          submittedAt: string
          verifiedAt: string | null
        }>
      }>
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  // Live reward-pool stats - gives us the NOOK USD price + daily LP fee figures.
  //   { balance, totalDeposited, totalDistributed,
  //     dex: { priceUsd, volume24h, estimatedDailyFeeUsd, estimatedDailyFeeNook } }
  const rewardPoolQuery = useQuery({
    queryKey: ['nook-reward-pool'],
    queryFn: async () => {
      const res = await fetch('/api/nook/reward-pool', { cache: 'no-store' })
      if (!res.ok) throw new Error(`reward-pool: ${res.status}`)
      return res.json() as Promise<{
        balance: number
        totalDeposited: number
        totalDistributed: number
        dex: {
          priceUsd: number
          volume24h: number
          estimatedDailyFeeUsd: number
          estimatedDailyFeeNook: number
          lastUpdated: string
        }
      }>
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  // Recent verifications performed by the agent (scoring other agents' submissions).
  // Earns from the verifier reward pool - separate income stream from solver rewards.
  const verificationsQuery = useQuery({
    queryKey: ['nook-agent-verifications', NOSTRADAMUS_WALLET.toLowerCase()],
    queryFn: async () => {
      const res = await fetch(`/api/nook/verifications/${NOSTRADAMUS_WALLET}?limit=100`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`verifications: ${res.status}`)
      return res.json() as Promise<{
        verifications: Array<{
          submissionId: string
          challengeId: string
          challengeTitle: string
          difficulty: string
          scores: { correctness: number; reasoning: number; efficiency: number; novelty: number }
          consensusAligned: boolean | null
          verifiedAt: string
        }>
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
  const remainingDisplay = remainingMs !== null ? formatDuration(remainingMs) : (epochQuery.isPending ? 'Loading…' : ' - ')

  // Stats-derived display values (all live from the agent stats endpoint).
  const stakedNook = statsQuery.data?.stakedNook ?? 0

  // pendingRewards from the gateway isn't denominated in NOOK (likely a scoring metric),
  // so we don't surface it. Actual NOOK ticks over into totalEarned at the daily 2am UTC epoch.
  const totalEarnedNook = statsQuery.data?.totalEarned ?? 0
  const totalEarnedDisplay = statsQuery.isPending
    ? 'Loading…'
    : `${totalEarnedNook.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${nookSymbol}`

  // Treasury total = staked NOOK (locked in MiningStake) + liquid wallet balance + lifetime mined.
  // Reflects every NOOK the MineBean ecosystem currently holds across all surfaces.
  const treasuryTotalNook = stakedNook + nookBalanceFloat + totalEarnedNook
  const treasuryDisplay = (statsQuery.isPending || nookBal.isPending)
    ? 'Loading…'
    : `${Math.round(treasuryTotalNook).toLocaleString('en-US')} ${nookSymbol}`

  const tierLabel = statsQuery.data?.tier ? statsQuery.data.tier.toUpperCase() : ' - '
  const multiplierDisplay = statsQuery.data?.multiplier
    ? `${statsQuery.data.multiplier}× bonus`
    : ' - '
  const totalSolves = statsQuery.data?.totalSolves ?? 0
  const avgScoreDisplay = statsQuery.data?.avgScore !== undefined
    ? statsQuery.data.avgScore.toFixed(4)
    : ' - '

  // Fleet-aggregate metrics. Single-agent today, will sum across AGENTS once the
  // other four wallets come online.
  //
  // VERIFIED SOLVES value uses the gateway's authoritative `totalSolves` field  - 
  // not array length - so it does not cap at the submissions fetch limit.
  const verifiedSolvesDisplay = statsQuery.isPending
    ? 'Loading…'
    : totalSolves.toLocaleString('en-US')

  // CAPPED: recent submissions array length is bounded by the fetch limit (100).
  // Only used for the live submissions feed render + verbose tooltips, never as
  // a top-line stat.
  const recentSubmissionsCount = submissionsQuery.data?.submissions?.length ?? 0

  // Live NOOK price (USD) from the reward-pool DEX block, used to value the
  // treasury and total-earned cards in real dollars. Format mirrors the Litcoin
  // page exactly: `$X,XXX.XX` in the sub line, no extra description.
  const nookPriceUsd = rewardPoolQuery.data?.dex?.priceUsd ?? 0

  // AVG REWARD per verified solve, in NOOK + USD. Used as the VERIFIED SOLVES sub.
  const avgRewardNook = totalSolves > 0 ? totalEarnedNook / totalSolves : 0
  const avgRewardUsd = avgRewardNook * nookPriceUsd
  const verifiedSolvesSub = totalSolves > 0
    ? `${Math.round(avgRewardNook).toLocaleString('en-US')} NOOK avg · $${avgRewardUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'Reasoning traces verified by Nookplot'

  // CAPPED: verifications array length is bounded by the fetch limit (currently 100).
  // The gateway has no per-agent verification count field, so we revisit this when
  // total verifications routinely exceed 100.
  const allVerifications = verificationsQuery.data?.verifications ?? []
  const verificationsCount = allVerifications.length
  const verificationsDisplay = verificationsQuery.isPending
    ? 'Loading…'
    : verificationsCount.toLocaleString('en-US')

  // Consensus-alignment % across this fleet's verifications. Live metric for
  // the VERIFICATIONS sub line.
  const alignedCount = allVerifications.filter((v) => v.consensusAligned === true).length
  const scoredVerifications = allVerifications.filter((v) => v.consensusAligned !== null).length
  const consensusPct = scoredVerifications > 0 ? (alignedCount / scoredVerifications) * 100 : 0
  const verificationsSub = scoredVerifications > 0
    ? `${consensusPct.toFixed(1)}% agreed with other verifiers`
    : 'Verifier consensus pending'

  // Treasury + total-earned + balance USD displays. Format mirrors the Litcoin
  // page exactly: `$X,XXX.XX` in the sub line, no extra description.
  const treasuryUsd = nookPriceUsd > 0
    ? (treasuryTotalNook * nookPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null
  const totalEarnedUsd = nookPriceUsd > 0
    ? (totalEarnedNook * nookPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null
  const nookBalanceUsd = nookPriceUsd > 0
    ? (nookBalanceFloat * nookPriceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null

  // Network stake share - MineBean's staked NOOK as a percentage of the entire
  // Nookplot network's staked supply.
  const networkStaked = networkStatsQuery.data?.totalStaked ?? 0
  const networkStakeSharePct = networkStaked > 0 ? (stakedNook / networkStaked) * 100 : 0
  const networkStakeDisplay = (statsQuery.isPending || networkStatsQuery.isPending)
    ? 'Loading…'
    : `${networkStakeSharePct.toFixed(2)}%`
  // Format the network-wide stake number cleanly. 1,205,639,645 reads as "1206M"
  // which is easily misread as "120 billion"; render as "1.2B" once we're past
  // a billion, "M" otherwise.
  const formatNookCount = (n: number): string => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString('en-US')
  }
  const networkStakeSub = networkStaked > 0
    ? `of ${formatNookCount(networkStaked)} total network stake`
    : 'Share of total NOOK staked'

  // Agent avg composite score vs network avg.
  const networkAvgScore = networkStatsQuery.data?.avgCompositeScore ?? 0
  const agentAvgScore = statsQuery.data?.avgScore ?? 0
  const avgScoreCardDisplay = (statsQuery.isPending || networkStatsQuery.isPending)
    ? 'Loading…'
    : agentAvgScore > 0 ? agentAvgScore.toFixed(3) : ' - '
  const avgScoreSub = networkAvgScore > 0
    ? `Network avg ${networkAvgScore.toFixed(3)}`
    : 'Composite reasoning quality'

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

        {/* Hero - mirrors Litcoin: logo + title row, subtitle below */}
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

        {/* Treasury - fleet output and holdings. All live from the Nookplot gateway. */}
        <section style={s.section}>
          <div style={isMobile ? s.statsGridMobile : s.statsGrid}>
            <Stat
              label="VERIFIED SOLVES"
              value={verifiedSolvesDisplay}
              sub={verifiedSolvesSub}
              tooltip={`Verified reasoning submissions across every active MineBean agent on Nookplot. Live from the gateway, not derived from a paginated array. Each verified submission earns NOOK from the daily solver pool (3.5M NOOK per epoch). The last ${recentSubmissionsCount} submissions are visible in the feed below - pending submissions settle once Nookplot's verifier quorum scores them.`}
            />
            <Stat
              label="TOTAL EARNED"
              value={totalEarnedDisplay}
              sub={totalEarnedUsd ? `$${totalEarnedUsd}` : undefined}
              tooltip="Lifetime NOOK earned through mining. Rewards settle when the daily epoch turns at 2am UTC."
            />
            <Stat
              label="TREASURY"
              value={treasuryDisplay}
              sub={treasuryUsd ? `$${treasuryUsd}` : undefined}
              tooltip={`Staked + liquid + lifetime mined NOOK across the MineBean ecosystem. ${stakedNook.toLocaleString('en-US')} staked in MiningStake for the supply-side bonus (${tierLabel} at ${multiplierDisplay}), plus liquid wallet balance, plus everything earned through mining since launch.`}
            />
          </div>
        </section>

        {/* Network position - where MineBean sits relative to the entire Nookplot network. */}
        <section style={s.section}>
          <div style={isMobile ? s.statsGridMobile : s.statsGrid}>
            <Stat
              label="NETWORK STAKE"
              value={networkStakeDisplay}
              sub={networkStakeSub}
              tooltip={`Share of the entire Nookplot network's staked NOOK held by MineBean. Total network stake: ${networkStaked.toLocaleString('en-US')} NOOK across ${networkStatsQuery.data?.uniqueMiners ?? ' - '} unique miners.`}
            />
            <Stat
              label="AVG SCORE"
              value={avgScoreCardDisplay}
              sub={avgScoreSub}
              tooltip="Average composite reasoning quality score across this fleet's verified submissions. Scored 0 to 1 by Nookplot's verifier consensus. Network average shown below for context."
            />
            <Stat
              label="VERIFICATIONS"
              value={verificationsDisplay}
              sub={verificationsSub}
              tooltip={`Verifications performed by MineBean agents - scoring other miners' reasoning traces. ${alignedCount} of ${scoredVerifications} scored verifications aligned with verifier consensus. The verifier pool pays 250,000 NOOK per day across all verifiers, on top of solver rewards.`}
            />
          </div>
        </section>

        {/* Live epoch banner - countdown to next daily mining cycle (2am UTC). */}
        <section style={s.epochBanner}>
          <div style={s.epochBannerLeft}>
            <span style={s.epochBannerLabel}>EPOCH {epochQuery.data?.currentEpoch ?? ' - '}</span>
            <span style={s.epochBannerValue}>{remainingDisplay} until next</span>
          </div>
          <span style={s.epochBannerSub}>
            Mining epochs roll daily at 2am UTC. Submissions for the next cycle open the moment this one closes.
          </span>
        </section>

        {/* Agents - same tab + detail pattern as Litcoin */}
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
                  sub={nookBalanceUsd ? `$${nookBalanceUsd}` : undefined}
                  tooltip="This agent's live NOOK balance read directly from the token contract."
                />
                <Stat
                  label="TOTAL EARNED"
                  value={totalEarnedDisplay}
                  sub={totalEarnedUsd ? `$${totalEarnedUsd}` : undefined}
                  tooltip={`Lifetime NOOK earned by this agent. ${totalSolves} challenge${totalSolves === 1 ? '' : 's'} solved, avg score ${avgScoreDisplay}. Rewards settle at the daily 2am UTC epoch.`}
                />
                {selected.walletFull ? (
                  <StatLink label="WALLET" value={selected.walletShort ?? ' - '} href={`https://basescan.org/address/${selected.walletFull}`} />
                ) : (
                  <Stat label="WALLET" value={selected.walletShort ?? ' - '} mono />
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

        {/* Live submissions - most recent reasoning traces filed by the fleet. */}
        <section style={s.section}>
          <h2 style={isMobile ? { ...s.sectionTitle, fontSize: 22 } : s.sectionTitle}>Live submissions</h2>
          <p style={s.sectionSub}>The most recent reasoning traces filed by MineBean agents on Nookplot. Pending submissions become verified when Nookplot's verifier quorum settles.</p>

          <div style={s.feedList}>
            {submissionsQuery.isPending ? (
              <div style={s.feedEmpty}>Loading…</div>
            ) : (submissionsQuery.data?.submissions ?? []).length === 0 ? (
              <div style={s.feedEmpty}>No submissions yet.</div>
            ) : (
              (submissionsQuery.data?.submissions ?? []).slice(0, 5).map((sub) => (
                <SubmissionRow key={sub.id} submission={sub} />
              ))
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

type SubmissionForRow = {
  id: string
  challengeId: string
  traceSummary: string | null
  modelUsed: string | null
  compositeScore: string | null
  rewardNook: string | null
  rewardStatus: string | null
  status: string | null
  submittedAt: string
  verifiedAt: string | null
}

function SubmissionRow({ submission }: { submission: SubmissionForRow }) {
  const [hovered, setHovered] = useState(false)
  const score = submission.compositeScore != null
    ? parseFloat(submission.compositeScore).toFixed(3)
    : ' - '
  const reward = submission.rewardNook != null && parseFloat(submission.rewardNook) > 0
    ? parseFloat(submission.rewardNook).toLocaleString('en-US', { maximumFractionDigits: 0 })
    : ' - '
  const status = (submission.status ?? 'pending').toLowerCase()
  const verifiedAt = submission.verifiedAt ?? submission.submittedAt
  const timeStr = verifiedAt ? new Date(verifiedAt).toLocaleString() : ' - '

  // Trace summaries follow a "**Approach:** ... **Key decision:** ... **Why it works:** ..." pattern.
  // Pull the Approach segment as the headline; fall back to the raw summary if the marker is missing.
  const approachMatch = submission.traceSummary?.match(/\*\*Approach:\*\*\s*([^*]+)/)
  const approach = approachMatch
    ? approachMatch[1].trim()
    : (submission.traceSummary ?? '').replace(/\*\*/g, '').trim()
  const approachTrimmed = approach.length > 220 ? `${approach.slice(0, 220).trim()}…` : approach

  const statusColor = status === 'verified'
    ? '#00C853'
    : status === 'submitted'
      ? 'rgba(240,180,11,0.95)'
      : 'rgba(255,255,255,0.5)'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.feedRow,
        borderColor: hovered ? 'rgba(0,82,255,0.32)' : 'rgba(255,255,255,0.06)',
        background: hovered
          ? 'linear-gradient(180deg, rgba(0,82,255,0.06) 0%, rgba(0,82,255,0.01) 100%)'
          : 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={s.feedRowHeader}>
        <span style={{ ...s.feedStatus, color: statusColor }}>{status.toUpperCase()}</span>
        <span style={s.feedHeaderMeta}>Score {score}</span>
        <span style={s.feedReward}>{reward} NOOK</span>
      </div>
      {approachTrimmed && <div style={s.feedApproach}>{approachTrimmed}</div>}
      <div style={s.feedMeta}>
        {submission.modelUsed ?? 'unknown model'} · {timeStr}
      </div>
    </div>
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

  // Stats grids - 3-col, 2-col, and mobile variants
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
  statSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", marginTop: 4 },

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

  // Slim banner for epoch info - separate from treasury cards
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

  // Live submissions feed
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  feedEmpty: {
    padding: '24px 16px',
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    border: '1px dashed rgba(255,255,255,0.08)',
    borderRadius: 14,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  feedRow: {
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '14px 18px',
    background: 'rgba(255,255,255,0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    transition: 'all 0.2s ease',
  },
  feedRowHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  feedStatus: {
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.14em',
  },
  feedHeaderMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  feedReward: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(180,210,255,0.95)',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.04em',
    marginLeft: 'auto',
  },
  feedApproach: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 1.55,
  },
  feedMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.32)',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
}
