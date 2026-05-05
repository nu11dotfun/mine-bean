'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSignMessage } from 'wagmi'
import { parseEther } from 'viem'
import { apiFetch, API_BASE } from '@/lib/api'
import { useSSE } from '@/lib/SSEContext'
import { CONTRACTS } from '@/lib/contracts'

// ── Types ─────────────────────────────────────────────────────────────────

export type AgentId = 'sniper' | 'anti-winner' | 'beanpot-hunter'

interface AgentConfigDrawerProps {
  isOpen: boolean
  onClose: () => void
  agentId: string
  agentName: string
  agentLabel: string  // e.g. "AGENT_003"
}

interface RoundFeed {
  totalDeployedEth: number
  beanpotBean: number       // BEAN units
  beanPriceEth: number      // BEAN→ETH price
  fetchedAt: number
}

interface HistoricalRound {
  totalDeployedEth: number
  beanpotBean: number       // BEAN units, only > 0 when pot was won that round
  beanpotWon: boolean
}

// ── Constants (per AGENT_CONFIG_API.md) ──────────────────────────────────

const PROTOCOL_VAULT_FEE = 0.105   // 10.5% protocol take in EV math
const POLL_MS = 8_000
// FE-only floor for the agent-config flow. Independent of lib/contracts.ts
// (contracts.ts mirrors the on-chain AutoMiner minimum and is dev-owned).
const MIN_PER_BLOCK = 0.00001

const SUPPORTED: Record<AgentId, true> = {
  'sniper': true,
  'anti-winner': true,
  'beanpot-hunter': true,
}

const SNIPER_DEFAULTS = { timingOffsetSec: 5, minRoiPct: 0 }
const ANTI_WINNER_DEFAULTS = { gridFillWaitSec: 35, excludeLastN: 1, minRoiPct: 0 }
const HUNTER_DEFAULTS = { gridFillWaitSec: 35, beanpotThreshold: 62.2 }

// BEAN coefficient B in EV formula
const SNIPER_B = 1.0
const ANTI_WINNER_B = 1.1

// Hunter rounds-since-last-hit ⇄ BEAN threshold conversion.
// Beanpot hits roughly every 1/777 rounds on average. Default fires at
// 622 rounds (~20% below avg, slightly aggressive baseline).
// Pot grows ~0.1 BEAN per round → 622 × 0.1 = 62.2 BEAN at default.
const BEAN_PER_ROUND = 0.1
const beanToRounds = (bean: number) => Math.round(bean / BEAN_PER_ROUND)
const roundsToBean = (rounds: number) => rounds * BEAN_PER_ROUND

// ── Component ────────────────────────────────────────────────────────────

export default function AgentConfigDrawer({ isOpen, onClose, agentId, agentName, agentLabel }: AgentConfigDrawerProps) {
  const [isMobile, setIsMobile] = useState(false)
  const { subscribeGlobal, subscribeUser } = useSSE()

  // Per-agent param state (we keep them all, render only the relevant ones)
  // Sniper
  const [timingOffsetSec, setTimingOffsetSec] = useState(SNIPER_DEFAULTS.timingOffsetSec)
  const [sniperMinRoiPct, setSniperMinRoiPct] = useState(SNIPER_DEFAULTS.minRoiPct)
  // Anti-Winner
  const [awGridFillWaitSec, setAwGridFillWaitSec] = useState(ANTI_WINNER_DEFAULTS.gridFillWaitSec)
  const [excludeLastN, setExcludeLastN] = useState(ANTI_WINNER_DEFAULTS.excludeLastN)
  const [awMinRoiPct, setAwMinRoiPct] = useState(ANTI_WINNER_DEFAULTS.minRoiPct)
  // Beanpot Hunter
  const [hunterGridFillWaitSec, setHunterGridFillWaitSec] = useState(HUNTER_DEFAULTS.gridFillWaitSec)
  const [beanpotThreshold, setBeanpotThreshold] = useState(HUNTER_DEFAULTS.beanpotThreshold)
  // String buffer for the Hunter rounds input — same free-typing pattern as deposit/backtest.
  const [hunterRoundsInput, setHunterRoundsInput] = useState(String(beanToRounds(HUNTER_DEFAULTS.beanpotThreshold)))
  // Sync buffer when threshold changes externally (defaults load, preset, reset, slider).
  // Skips when the typed value already matches, preserving in-progress typing.
  useEffect(() => {
    const expected = beanToRounds(beanpotThreshold)
    if (Number(hunterRoundsInput) !== expected) setHunterRoundsInput(String(expected))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beanpotThreshold])

  // Deposit (shared) — string buffers allow free typing (clear field, partial values).
  // Derived numeric values clamp to a sane minimum at use-time.
  const [perBlockInput, setPerBlockInput] = useState('0.00001')
  const [numRoundsInput, setNumRoundsInput] = useState('100')
  const perBlock = Math.max(0, Number(perBlockInput)) || 0
  const numRounds = Math.max(1, Math.floor(Number(numRoundsInput)) || 1)

  // Backtest sample size (independent from deposit numRounds)
  // Cap at 1000 — backend has limited settled history and 20 paginated requests
  // (1000 / 50) stays well within rate limits, so the returned count reliably
  // matches the requested target.
  const [backtestRoundsInput, setBacktestRoundsInput] = useState('200')
  const backtestRounds = Math.min(1000, Math.max(50, Math.floor(Number(backtestRoundsInput)) || 200))

  // Live feed
  const [feed, setFeed] = useState<RoundFeed | null>(null)
  const [feedError, setFeedError] = useState<string | null>(null)

  // Historical sample for "would have fired in X / Y of last rounds" calibration
  const [historical, setHistorical] = useState<HistoricalRound[]>([])
  const [historicalLoaded, setHistoricalLoaded] = useState(false)

  // Existing user config (loaded on open) — drives "Active" state + prefill
  type ExistingConfig = {
    agentId: string
    enabled: boolean
    params: Record<string, number>
    updatedAt?: string
  } | null
  const [existingConfig, setExistingConfig] = useState<ExistingConfig>(null)
  const [existingConfigChecked, setExistingConfigChecked] = useState(false)
  const prefillAppliedRef = useRef(false)

  // API-provided defaults (override hardcoded if present)
  type ApiStrategies = Record<string, Record<string, number>>
  const [apiDefaults, setApiDefaults] = useState<ApiStrategies>({})
  const apiDefaultsAppliedRef = useRef(false)

  // Last autoMineExecuted event for this agent
  type LastFire = { roundId: string; totalDeployedEth: number; agentId?: string; at: number }
  const [lastFire, setLastFire] = useState<LastFire | null>(null)

  // Live projection toggle (collapsed by default — backtest is the headline)
  const [showLiveProjection, setShowLiveProjection] = useState(false)

  // ── Activate flow state machine (sign-first per AGENT_CONFIG_API v2) ──
  // Order: idle → fetching-nonce → signing → posting → sending-tx → tx-pending → success.
  // If on-chain AutoMiner is already active and compatible, the on-chain steps are skipped.
  type ActivateStep = 'idle' | 'fetching-nonce' | 'signing' | 'posting' | 'sending-tx' | 'tx-pending' | 'success' | 'error'
  const [activateStep, setActivateStep] = useState<ActivateStep>('idle')
  const [activateError, setActivateError] = useState<string | null>(null)
  const [agentConfigExpiresAt, setAgentConfigExpiresAt] = useState<string | null>(null)

  // On-chain AutoMiner state (for M3 pre-check + skip-tx-when-compatible).
  type AutoMinerState = { active: boolean; strategyId: number; numBlocks: number; numRounds: number; roundsExecuted: number } | null
  const [autoMinerState, setAutoMinerState] = useState<AutoMinerState>(null)
  const [autoMinerChecked, setAutoMinerChecked] = useState(false)

  // M4: ticker for the awaitingActivation 5-min expiry countdown. Only ticks
  // while we're between POSTing the agent-config and the on-chain tx confirming.
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (!agentConfigExpiresAt) return
    if (activateStep !== 'sending-tx' && activateStep !== 'tx-pending') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [agentConfigExpiresAt, activateStep])
  const secondsRemaining = agentConfigExpiresAt
    ? Math.max(0, Math.floor((Date.parse(agentConfigExpiresAt) - now) / 1000))
    : null
  const expiryLabel = secondsRemaining === null
    ? null
    : `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`

  // Auto-error if the signature TTL passes while we're still waiting on-chain.
  // Backend will have dropped the awaitingActivation record, so this signature
  // is no longer redeemable — force the user to re-sign.
  useEffect(() => {
    if (secondsRemaining !== 0) return
    if (activateStep !== 'sending-tx' && activateStep !== 'tx-pending') return
    setActivateError('Signature expired — please try again')
    setActivateStep('error')
  }, [secondsRemaining, activateStep])

  // Wagmi hooks
  const { address: walletAddress, isConnected } = useAccount()
  const { writeContract: writeSetConfig, data: setConfigTxHash, reset: resetSetConfig } = useWriteContract({
    mutation: {
      onError: (err) => {
        setActivateError(err?.message?.split('\n')[0] || 'Transaction rejected')
        setActivateStep('error')
      },
    },
  })
  const { isSuccess: setConfigConfirmed, isError: setConfigReverted } = useWaitForTransactionReceipt({ hash: setConfigTxHash })
  const { signMessageAsync } = useSignMessage()

  // M6: AutoMiner.stop() write for the in-drawer STOP button.
  const [stopStep, setStopStep] = useState<'idle' | 'confirming' | 'pending' | 'done' | 'error'>('idle')
  const [stopError, setStopError] = useState<string | null>(null)
  const { writeContract: writeStop, data: stopTxHash, reset: resetStop } = useWriteContract({
    mutation: {
      onError: (err) => {
        setStopError(err?.message?.split('\n')[0] || 'Transaction rejected')
        setStopStep('error')
      },
    },
  })
  const { isSuccess: stopConfirmed } = useWaitForTransactionReceipt({ hash: stopTxHash })
  useEffect(() => {
    if (stopTxHash && stopStep === 'confirming') setStopStep('pending')
  }, [stopTxHash, stopStep])
  // After stop tx confirms, listen for the backend's `stopped` SSE event
  // (emitted once the webhook fires and disables the agent config). When it
  // arrives, clear local state so the gate disappears with no API roundtrip.
  // Single delayed GET as a fallback if SSE drops — keeps us under the 5 req/min
  // strict rate limit on user endpoints.
  useEffect(() => {
    if (!stopConfirmed || stopStep !== 'pending' || !walletAddress) return
    let cancelled = false
    const clearGate = () => {
      if (cancelled) return
      setExistingConfig(null)
      setAutoMinerState(null)
      setStopStep('done')
    }
    const unsub = subscribeUser('stopped', () => clearGate())
    const fallback = setTimeout(async () => {
      if (cancelled) return
      try {
        const lower = walletAddress.toLowerCase()
        const res = await apiFetch<any>(`/api/user/${lower}/agent-config`)
        if (!res?.config?.enabled) clearGate()
        else if (!cancelled) setStopStep('done')
      } catch {
        if (!cancelled) setStopStep('done')
      }
    }, 5000)
    return () => { cancelled = true; unsub(); clearTimeout(fallback) }
  }, [stopConfirmed, stopStep, walletAddress, subscribeUser])
  const handleStopAutoMiner = () => {
    if (!walletAddress) return
    setStopError(null)
    setStopStep('confirming')
    try {
      writeStop({
        address: CONTRACTS.AutoMiner.address,
        abi: CONTRACTS.AutoMiner.abi,
        functionName: 'stop',
        args: [],
      } as any)
    } catch (err: any) {
      setStopError(err?.message?.split('\n')[0] || 'Failed to send stop tx')
      setStopStep('error')
    }
  }
  const isStopping = stopStep === 'confirming' || stopStep === 'pending'

  const isSupported = (agentId in SUPPORTED) as boolean
  const isUnsupported = !isSupported

  const isSniper = agentId === 'sniper'
  const isAntiWinner = agentId === 'anti-winner'
  const isHunter = agentId === 'beanpot-hunter'

  // Resize
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [isOpen])

  // Esc to close
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Live feed
  const refreshFeed = useCallback(async () => {
    try {
      const [round, stats] = await Promise.all([
        apiFetch<any>('/api/round/current'),
        apiFetch<any>('/api/stats'),
      ])
      const totalDeployedEth = parseFloat(round?.totalDeployedFormatted ?? '0') || 0
      const beanpotBean = parseFloat(round?.beanpotPoolFormatted ?? stats?.beanpotPoolFormatted ?? '0') || 0
      const priceNative = stats?.bean?.priceNative ?? stats?.prices?.bean?.priceNative ?? '0'
      const beanPriceEth = parseFloat(priceNative) || 0
      setFeed({ totalDeployedEth, beanpotBean, beanPriceEth, fetchedAt: Date.now() })
      setFeedError(null)
    } catch (err: any) {
      setFeedError(err?.message ?? 'Could not fetch live round data')
    }
  }, [])

  useEffect(() => {
    if (!isOpen || isUnsupported) return
    refreshFeed()
    const id = setInterval(refreshFeed, POLL_MS)
    return () => clearInterval(id)
  }, [isOpen, isUnsupported, refreshFeed])

  useEffect(() => {
    if (!isOpen || isUnsupported) return
    const a = subscribeGlobal('deployed', refreshFeed)
    const b = subscribeGlobal('gameStarted', refreshFeed)
    const c = subscribeGlobal('roundSettled', refreshFeed)
    return () => { a(); b(); c() }
  }, [isOpen, isUnsupported, subscribeGlobal, refreshFeed])

  // Historical sample — backtest window is independent from the deposit
  // numRounds. Backend caps /api/rounds at 50/page, so we paginate. Capped
  // at 2000 rounds (40 pages) to bound API load. Debounced 400ms to avoid
  // firing on every keystroke while user types.
  useEffect(() => {
    if (!isOpen || isUnsupported) return
    const target = backtestRounds
    const PAGES = Math.ceil(target / 50)
    const timeout = setTimeout(() => {
      const requests = Array.from({ length: PAGES }, (_, i) =>
        apiFetch<{ rounds: any[] }>(`/api/rounds?settled=true&limit=50&page=${i + 1}`)
          .catch(() => ({ rounds: [] as any[] }))
      )
      Promise.all(requests)
        .then(results => {
          const rounds: HistoricalRound[] = []
          for (const res of results) {
            for (const r of res?.rounds ?? []) {
              const totalDeployedEth = parseFloat(r.totalDeployed ?? '0') / 1e18 || 0
              const potWei = parseFloat(r.beanpotAmount ?? '0') || 0
              const beanpotBean = potWei / 1e18
              rounds.push({ totalDeployedEth, beanpotBean, beanpotWon: beanpotBean > 0 })
            }
          }
          // Don't blow away existing data on a failed/empty refetch — keeps the
          // backtest visible even if the API rate-limits us during typing.
          if (rounds.length > 0) {
            setHistorical(rounds.slice(0, target))
          }
          setHistoricalLoaded(true)
        })
        .catch(() => setHistoricalLoaded(true))
    }, 400)
    return () => clearTimeout(timeout)
  }, [isOpen, isUnsupported, backtestRounds])

  // Fetch API defaults from /api/agent-strategies (once, on first open)
  useEffect(() => {
    if (!isOpen || isUnsupported || apiDefaultsAppliedRef.current) return
    apiDefaultsAppliedRef.current = true
    apiFetch<{ strategies: Array<{ agentId: string; defaultParams: Record<string, number> }> }>('/api/agent-strategies')
      .then(res => {
        const map: ApiStrategies = {}
        for (const s of res?.strategies ?? []) map[s.agentId] = s.defaultParams ?? {}
        setApiDefaults(map)
      })
      .catch(() => { /* fall back to hardcoded */ })
  }, [isOpen, isUnsupported])

  // Apply API defaults for the current agent, but only on initial render (don't clobber user edits)
  useEffect(() => {
    if (!isOpen || existingConfigChecked) return
    const d = apiDefaults[agentId]
    if (!d) return
    if (isSniper) {
      if (typeof d.timingOffsetSec === 'number') setTimingOffsetSec(d.timingOffsetSec)
      if (typeof d.minRoiPct === 'number') setSniperMinRoiPct(d.minRoiPct)
    } else if (isAntiWinner) {
      if (typeof d.gridFillWaitSec === 'number') setAwGridFillWaitSec(d.gridFillWaitSec)
      if (typeof d.excludeLastN === 'number') setExcludeLastN(d.excludeLastN)
      if (typeof d.minRoiPct === 'number') setAwMinRoiPct(d.minRoiPct)
    } else if (isHunter) {
      if (typeof d.gridFillWaitSec === 'number') setHunterGridFillWaitSec(d.gridFillWaitSec)
      if (typeof d.beanpotThreshold === 'number') setBeanpotThreshold(d.beanpotThreshold)
    }
  }, [isOpen, apiDefaults, agentId, existingConfigChecked, isSniper, isAntiWinner, isHunter])

  // Fetch the user's existing agent-config + on-chain AutoMiner state on open.
  useEffect(() => {
    if (!isOpen || isUnsupported || !walletAddress) {
      if (!walletAddress) {
        setExistingConfig(null); setExistingConfigChecked(false); prefillAppliedRef.current = false
        setAutoMinerState(null); setAutoMinerChecked(false)
      }
      return
    }
    if (existingConfigChecked && autoMinerChecked) return

    const lower = walletAddress.toLowerCase()
    if (!existingConfigChecked) {
      apiFetch<any>(`/api/user/${lower}/agent-config`)
        .then(res => {
          const cfg = res?.config
          if (cfg && cfg.agentId && cfg.params) {
            setExistingConfig({
              agentId: cfg.agentId,
              enabled: !!cfg.enabled,
              params: cfg.params,
              updatedAt: cfg.updatedAt,
            })
          } else {
            setExistingConfig(null)
          }
        })
        .catch(() => setExistingConfig(null))
        .finally(() => setExistingConfigChecked(true))
    }
    if (!autoMinerChecked) {
      apiFetch<any>(`/api/automine/${lower}`)
        .then(res => {
          const c = res?.config
          if (c && typeof c.active === 'boolean') {
            setAutoMinerState({
              active: c.active,
              strategyId: Number(c.strategyId) || 0,
              numBlocks: Number(c.numBlocks) || 0,
              numRounds: Number(c.numRounds) || 0,
              roundsExecuted: Number(c.roundsExecuted) || 0,
            })
          } else {
            setAutoMinerState(null)
          }
        })
        .catch(() => setAutoMinerState(null))
        .finally(() => setAutoMinerChecked(true))
    }
  }, [isOpen, isUnsupported, walletAddress, existingConfigChecked, autoMinerChecked])

  // Re-fetch existing config after a successful activate so we move to "Active" state
  useEffect(() => {
    if (activateStep === 'success' && walletAddress) {
      const lower = walletAddress.toLowerCase()
      apiFetch<any>(`/api/user/${lower}/agent-config`)
        .then(res => {
          const cfg = res?.config
          if (cfg) setExistingConfig({ agentId: cfg.agentId, enabled: !!cfg.enabled, params: cfg.params, updatedAt: cfg.updatedAt })
        })
        .catch(() => {})
    }
  }, [activateStep, walletAddress])

  // Prefill params from existing config (matches this agent + enabled)
  useEffect(() => {
    if (!isOpen || !existingConfigChecked || prefillAppliedRef.current) return
    if (!existingConfig || !existingConfig.enabled || existingConfig.agentId !== agentId) return
    prefillAppliedRef.current = true
    const p = existingConfig.params || {}
    if (isSniper) {
      if (typeof p.timingOffsetSec === 'number') setTimingOffsetSec(p.timingOffsetSec)
      if (typeof p.minRoiPct === 'number') setSniperMinRoiPct(p.minRoiPct)
    } else if (isAntiWinner) {
      if (typeof p.gridFillWaitSec === 'number') setAwGridFillWaitSec(p.gridFillWaitSec)
      if (typeof p.excludeLastN === 'number') setExcludeLastN(p.excludeLastN)
      if (typeof p.minRoiPct === 'number') setAwMinRoiPct(p.minRoiPct)
    } else if (isHunter) {
      if (typeof p.gridFillWaitSec === 'number') setHunterGridFillWaitSec(p.gridFillWaitSec)
      if (typeof p.beanpotThreshold === 'number') setBeanpotThreshold(p.beanpotThreshold)
    }
  }, [isOpen, existingConfig, existingConfigChecked, agentId, isSniper, isAntiWinner, isHunter])

  // Reset checked flags when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setExistingConfigChecked(false)
      prefillAppliedRef.current = false
      apiDefaultsAppliedRef.current = false
      setLastFire(null)
    }
  }, [isOpen])

  // Subscribe to user's autoMineExecuted SSE — show "last fire" indicator if this agent
  useEffect(() => {
    if (!isOpen || isUnsupported || !walletAddress) return
    const unsub = subscribeUser('autoMineExecuted', (data: any) => {
      const totalDeployedEth = parseFloat(data?.totalDeployed ?? '0') / 1e18 || 0
      setLastFire({
        roundId: String(data?.roundId ?? ''),
        totalDeployedEth,
        agentId: data?.agentId,
        at: Date.now(),
      })
    })
    return () => unsub()
  }, [isOpen, isUnsupported, walletAddress, subscribeUser])

  // ── Derived: deposit math ──
  const numBlocks = isAntiWinner ? Math.max(1, 25 - excludeLastN) : 25
  const X = perBlock * numBlocks
  const T = feed?.totalDeployedEth ?? 0
  const P = feed?.beanPriceEth ?? 0
  const beanpotNow = feed?.beanpotBean ?? 0

  // ── Derived: live projection per agent ──
  let projection: { kind: 'roi'; value: number; willFire: boolean } | { kind: 'beanpot'; potNow: number; threshold: number; willFire: boolean } | null = null

  if (feed) {
    if (isSniper) {
      const roi = X > 0 ? (((X / (X + T)) * SNIPER_B * P) - PROTOCOL_VAULT_FEE * X) / X * 100 : 0
      projection = { kind: 'roi', value: roi, willFire: roi >= sniperMinRoiPct }
    } else if (isAntiWinner) {
      const roi = X > 0 ? (((X / (X + T)) * ANTI_WINNER_B * P) - PROTOCOL_VAULT_FEE * X) / X * 100 : 0
      projection = { kind: 'roi', value: roi, willFire: roi >= awMinRoiPct }
    } else if (isHunter) {
      projection = { kind: 'beanpot', potNow: beanpotNow, threshold: beanpotThreshold, willFire: beanpotNow >= beanpotThreshold }
    }
  }

  // Historical "would have fired in X / N" sample
  // - Sniper / Anti-Winner: replay ROI formula against historical totalDeployed (using current BEAN price as approx)
  // - Hunter: replay rounds-since-last-hit gate; PnL = sum of pot wins during fired rounds minus protocol fees on misses
  // Keep the backtest panel mounted as soon as history loads. If X or P aren't
  // ready (transient feed gap, empty inputs), we still render the section with
  // zeroed PnL stats — it never disappears mid-typing.
  let historicalSample: { fired: number; total: number; sumPnl: number; potWins?: number } | null =
    historical.length > 0 ? { fired: 0, total: historical.length, sumPnl: 0, potWins: 0 } : null
  if (historical.length > 0 && X > 0 && P > 0) {
    if (isSniper || isAntiWinner) {
      const B = isSniper ? SNIPER_B : ANTI_WINNER_B
      const minRoi = isSniper ? sniperMinRoiPct : awMinRoiPct
      let fired = 0
      let sumPnl = 0
      for (const r of historical) {
        const tEth = r.totalDeployedEth
        const ev = ((X / (X + tEth)) * B * P) - PROTOCOL_VAULT_FEE * X
        const roi = ev / X * 100
        if (roi >= minRoi) {
          fired++
          sumPnl += ev
        }
      }
      historicalSample = { fired, total: historical.length, sumPnl }
    } else if (isHunter) {
      // Iterate oldest → newest. Track rounds-since-last-hit. Fire when counter ≥ threshold rounds.
      const thresholdRounds = beanToRounds(beanpotThreshold)
      const oldestFirst = [...historical].reverse()
      let roundsSinceLastHit = 0
      let fired = 0
      let sumPnl = 0
      let potWins = 0
      for (const r of oldestFirst) {
        roundsSinceLastHit += 1
        const wouldFire = roundsSinceLastHit >= thresholdRounds
        if (wouldFire) {
          fired++
          if (r.beanpotWon) {
            // Agent caught the pot. Proportional share in ETH minus protocol fee.
            const share = (X / (X + r.totalDeployedEth)) * r.beanpotBean * P
            sumPnl += share - PROTOCOL_VAULT_FEE * X
            potWins++
          } else {
            // Fired but pot didn't hit. Lose protocol fee.
            sumPnl -= PROTOCOL_VAULT_FEE * X
          }
        }
        if (r.beanpotWon) roundsSinceLastHit = 0
      }
      historicalSample = { fired, total: historical.length, sumPnl, potWins }
    }
  }
  const historicalFiredPct = historicalSample ? (historicalSample.fired / historicalSample.total) * 100 : null

  // Validation (Anti-Winner has constraint)
  const numBlocksConstraintBroken = isAntiWinner && excludeLastN > 24
  // Per-block must meet on-chain AutoMiner minimum or setConfig will revert.
  const perBlockBelowMin = perBlock < MIN_PER_BLOCK

  // M3: on-chain AutoMiner ↔ agent compatibility check.
  // null = no on-chain config (no conflict, fresh setup).
  // true = active and matches selected agent (skip on-chain step, sign+POST only).
  // false = active but conflicts (block setup, prompt user to stop).
  const onChainCompat: null | true | false = (() => {
    if (!autoMinerState || !autoMinerState.active) return null
    if (isSniper || isHunter) return autoMinerState.strategyId === 1
    if (isAntiWinner) {
      const expected = Math.max(1, 25 - excludeLastN)
      return autoMinerState.strategyId === 0 && autoMinerState.numBlocks === expected
    }
    return false
  })()
  const autoMinerActiveIncompatible = onChainCompat === false
  const autoMinerActiveCompatible = onChainCompat === true

  // Active config flags
  const hasActiveConfig = !!existingConfig?.enabled
  const isThisAgentActive = hasActiveConfig && existingConfig?.agentId === agentId
  const isOtherAgentActive = hasActiveConfig && existingConfig?.agentId !== agentId
  const otherAgentName = isOtherAgentActive
    ? ((existingConfig?.agentId === 'sniper' && 'Sniper') ||
       (existingConfig?.agentId === 'anti-winner' && 'Anti-Winner') ||
       (existingConfig?.agentId === 'beanpot-hunter' && 'Beanpot Hunter') ||
       existingConfig?.agentId)
    : null

  // M6: any state that requires stopping the existing AutoMiner before proceeding.
  const showStopGate = isThisAgentActive || isOtherAgentActive || autoMinerActiveIncompatible

  // Deposit total (mirrors AutoMiner +1% padding)
  const depositTotal = X * numRounds * 1.01

  const handleReset = () => {
    if (isSniper) {
      setTimingOffsetSec(SNIPER_DEFAULTS.timingOffsetSec)
      setSniperMinRoiPct(SNIPER_DEFAULTS.minRoiPct)
    } else if (isAntiWinner) {
      setAwGridFillWaitSec(ANTI_WINNER_DEFAULTS.gridFillWaitSec)
      setExcludeLastN(ANTI_WINNER_DEFAULTS.excludeLastN)
      setAwMinRoiPct(ANTI_WINNER_DEFAULTS.minRoiPct)
    } else if (isHunter) {
      setHunterGridFillWaitSec(HUNTER_DEFAULTS.gridFillWaitSec)
      setBeanpotThreshold(HUNTER_DEFAULTS.beanpotThreshold)
    }
    setPerBlockInput('0.00001')
    setNumRoundsInput('100')
  }

  // Build the agent params object for POST + signature
  const buildAgentParams = useCallback((): Record<string, number> => {
    if (isSniper) return { timingOffsetSec, minRoiPct: sniperMinRoiPct }
    if (isAntiWinner) return { gridFillWaitSec: awGridFillWaitSec, excludeLastN, minRoiPct: awMinRoiPct }
    if (isHunter) return { gridFillWaitSec: hunterGridFillWaitSec, beanpotThreshold }
    return {}
  }, [isSniper, isAntiWinner, isHunter, timingOffsetSec, sniperMinRoiPct, awGridFillWaitSec, excludeLastN, awMinRoiPct, hunterGridFillWaitSec, beanpotThreshold])

  // On-chain setConfig args per agent (per AGENT_CONFIG_API.md)
  const setConfigArgs = (() => {
    if (isSniper) return { strategyId: 1, numBlocksOnChain: 0, blockMask: 0 }            // All
    if (isAntiWinner) return { strategyId: 0, numBlocksOnChain: numBlocks, blockMask: 0 } // Random
    if (isHunter) return { strategyId: 1, numBlocksOnChain: 0, blockMask: 0 }             // All
    return null
  })()

  // Sign-first activation flow (per AGENT_CONFIG_API v2).
  // 1. GET nonce
  // 2. Sign canonical message (off-chain)
  // 3. POST to /agent-config — backend stores status="awaitingActivation" with 5-min TTL
  // 4. If on-chain AutoMiner already active+compatible: done (status flips to "enabled" server-side).
  //    Otherwise: fire writeSetConfig and wait for receipt.
  const handleActivate = async () => {
    if (!walletAddress || !setConfigArgs) {
      setActivateError('Wallet not connected')
      setActivateStep('error')
      return
    }
    setActivateError(null)
    setAgentConfigExpiresAt(null)

    try {
      const lower = walletAddress.toLowerCase()

      setActivateStep('fetching-nonce')
      const cfg = await apiFetch<any>(`/api/user/${lower}/agent-config`)
      const nonce = cfg?.nextSignableMessageHint?.nextNonce ?? 1
      const timestamp = Date.now()
      const params = buildAgentParams()
      const payload = { agentId, params }
      const message = [
        'BEAN AutoMiner Agent Config v1',
        'Action: set',
        `Address: ${lower}`,
        `Nonce: ${nonce}`,
        `Timestamp: ${timestamp}`,
        `Payload: ${JSON.stringify(payload)}`,
      ].join('\n')

      setActivateStep('signing')
      const signature = await signMessageAsync({ message })

      setActivateStep('posting')
      const res = await fetch(`${API_BASE}/api/user/${lower}/agent-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, params, nonce, timestamp, signature }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `POST failed (${res.status})`)
      }
      const result = await res.json().catch(() => null)
      const status = result?.config?.status as string | undefined
      setAgentConfigExpiresAt(result?.config?.expiresAt ?? null)

      // If backend already activated (on-chain AutoMiner exists and is compatible)
      // the on-chain step is unnecessary — config is live for the next round.
      if (status === 'enabled' || autoMinerActiveCompatible) {
        setActivateStep('success')
        return
      }

      setActivateStep('sending-tx')
      writeSetConfig({
        address: CONTRACTS.AutoMiner.address,
        abi: CONTRACTS.AutoMiner.abi,
        functionName: 'setConfig',
        args: [setConfigArgs.strategyId, numRounds, setConfigArgs.numBlocksOnChain, setConfigArgs.blockMask],
        value: parseEther(depositTotal.toFixed(18)),
      } as any)
    } catch (err: any) {
      const msg = err?.message?.split('\n')[0] || 'Failed to set up agent'
      setActivateError(msg)
      setActivateStep('error')
    }
  }

  // Move to tx-pending once we have a hash
  useEffect(() => {
    if (setConfigTxHash && activateStep === 'sending-tx') setActivateStep('tx-pending')
  }, [setConfigTxHash, activateStep])

  // tx revert handling
  useEffect(() => {
    if (setConfigReverted && activateStep === 'tx-pending') {
      setActivateError('Transaction reverted on-chain')
      setActivateStep('error')
    }
  }, [setConfigReverted, activateStep])

  // tx confirmed → success. Backend auto-activates the awaitingActivation record
  // within ~1 round once it sees the on-chain config.
  useEffect(() => {
    if (setConfigConfirmed && activateStep === 'tx-pending') setActivateStep('success')
  }, [setConfigConfirmed, activateStep])

  // Reset state when drawer closes or agent changes
  useEffect(() => {
    if (!isOpen) {
      setActivateStep('idle')
      setActivateError(null)
      setAgentConfigExpiresAt(null)
      // Re-fetch on-chain state next open in case it changed in the background.
      setAutoMinerChecked(false)
      resetSetConfig()
    }
  }, [isOpen, resetSetConfig])

  if (!isOpen) return null

  return (
    <>
      <style>{`
        @keyframes acd-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes acd-slide-right { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes acd-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes acd-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.55 } }
        .acd-slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 5px;
          background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 100%);
          border-radius: 999px; outline: none;
          box-shadow: inset 0 1px 1px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.04);
        }
        .acd-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px;
          background: radial-gradient(circle at 30% 30%, #4d8aff 0%, #0052FF 55%, #003ac4 100%);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.4),
            inset 0 -1px 0 rgba(0,0,0,0.3),
            0 0 0 1px rgba(0,82,255,0.45),
            0 2px 8px rgba(0,82,255,0.5),
            0 0 18px rgba(0,82,255,0.35);
          transition: box-shadow 0.18s ease, transform 0.12s ease;
        }
        .acd-slider::-webkit-slider-thumb:hover {
          transform: scale(1.08);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.5),
            inset 0 -1px 0 rgba(0,0,0,0.3),
            0 0 0 1px rgba(0,140,255,0.6),
            0 2px 12px rgba(0,82,255,0.7),
            0 0 28px rgba(0,82,255,0.5);
        }
        .acd-slider::-webkit-slider-thumb:active {
          transform: scale(1.05);
        }
        .acd-slider::-moz-range-thumb {
          width: 18px; height: 18px;
          background: radial-gradient(circle at 30% 30%, #4d8aff 0%, #0052FF 55%, #003ac4 100%);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.4),
            0 0 0 1px rgba(0,82,255,0.45),
            0 2px 8px rgba(0,82,255,0.5),
            0 0 18px rgba(0,82,255,0.35);
        }
        .acd-input:focus {
          border-color: rgba(0,82,255,0.5) !important;
          background: rgba(0,82,255,0.04) !important;
        }
        .acd-input[type="number"]::-webkit-outer-spin-button,
        .acd-input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .acd-input[type="number"] { -moz-appearance: textfield; }
        .acd-activate:hover:not(:disabled) {
          background: rgba(0,82,255,0.25) !important;
          box-shadow: 0 0 22px rgba(0,82,255,0.35), 0 0 50px rgba(0,82,255,0.15) !important;
        }
        .acd-secondary:hover { color: #fff !important; }
      `}</style>

      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 9998,
          animation: 'acd-fade-in 0.2s ease',
        }}
      />

      <div
        style={{
          position: 'fixed',
          ...(isMobile
            ? { left: 0, right: 0, bottom: 0, top: 0, animation: 'acd-slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }
            : { top: 0, right: 0, bottom: 0, width: 460, animation: 'acd-slide-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }
          ),
          background: 'linear-gradient(180deg, #0d111c 0%, #08090f 100%)',
          borderLeft: isMobile ? 'none' : '1px solid rgba(0,82,255,0.18)',
          zIndex: 9999,
          display: 'flex', flexDirection: 'column',
          fontFamily: "'Inter', -apple-system, sans-serif",
          color: '#fff',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(10,12,20,0.75)', backdropFilter: 'blur(8px)',
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(0,82,255,0.7)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.08em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{agentLabel} · {isThisAgentActive ? 'ACTIVE' : 'CONFIGURE'}</span>
              {isThisAgentActive && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(0,200,131,0.12)',
                  border: '1px solid rgba(0,200,131,0.4)',
                  color: '#00C853',
                  fontSize: 9, letterSpacing: '0.06em',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00C853', animation: 'acd-pulse 2s ease-in-out infinite' }} />
                  RUNNING
                </span>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{agentName}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>

          {isUnsupported && (
            <div style={{
              padding: '14px 16px',
              background: 'rgba(255,180,0,0.05)',
              border: '1px solid rgba(255,180,0,0.2)',
              borderRadius: 10,
              fontSize: 12,
              color: 'rgba(255,200,80,0.85)',
              lineHeight: 1.55,
            }}>
              Custom strategy parameters for <strong>{agentName}</strong> aren&apos;t available yet.
            </div>
          )}

          {isSupported && (<>
            {/* Different agent currently running — block activation */}
            {isOtherAgentActive && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(255,180,0,0.06)',
                border: '1px solid rgba(255,180,0,0.25)',
                borderRadius: 10,
                fontSize: 11.5,
                color: 'rgba(255,210,120,0.95)',
                lineHeight: 1.55,
                marginBottom: 14,
              }}>
                You&apos;re currently running <strong style={{ color: '#fff' }}>{otherAgentName}</strong>. Stop it from the AutoMiner panel before configuring {agentName}.
              </div>
            )}

            {/* This agent is the active one — informational */}
            {isThisAgentActive && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(0,200,131,0.06)',
                border: '1px solid rgba(0,200,131,0.25)',
                borderRadius: 10,
                fontSize: 11.5,
                color: 'rgba(150,240,200,0.95)',
                lineHeight: 1.55,
                marginBottom: 14,
              }}>
                <strong style={{ color: '#fff' }}>{agentName} is running for you.</strong> Params below are the live ones. To change settings, stop in the AutoMiner panel and reactivate.
                {lastFire && lastFire.totalDeployedEth > 0 && (
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em' }}>
                    LAST FIRE · ROUND #{lastFire.roundId} · {lastFire.totalDeployedEth.toFixed(5)} ETH
                  </div>
                )}
              </div>
            )}

            {/* M3: on-chain AutoMiner active but incompatible with selected agent */}
            {!isThisAgentActive && !isOtherAgentActive && autoMinerActiveIncompatible && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(255,107,107,0.06)',
                border: '1px solid rgba(255,107,107,0.3)',
                borderRadius: 10,
                fontSize: 11.5,
                color: 'rgba(255,180,180,0.95)',
                lineHeight: 1.55,
                marginBottom: 14,
              }}>
                <strong style={{ color: '#fff' }}>You have an active AutoMiner that conflicts with {agentName}.</strong> Stop it from the AutoMiner panel first ({autoMinerState?.numRounds ? `${autoMinerState.numRounds - autoMinerState.roundsExecuted} rounds remaining` : 'unspent rounds will be refunded'}), then come back to set up {agentName}.
              </div>
            )}

            {/* M3: on-chain AutoMiner active and compatible — sign-only flow */}
            {!isThisAgentActive && !isOtherAgentActive && autoMinerActiveCompatible && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(0,82,255,0.05)',
                border: '1px solid rgba(0,82,255,0.25)',
                borderRadius: 10,
                fontSize: 11.5,
                color: 'rgba(180,210,255,0.95)',
                lineHeight: 1.55,
                marginBottom: 14,
              }}>
                <strong style={{ color: '#fff' }}>Your AutoMiner is already running and compatible with {agentName}.</strong> Saving these params will apply them to your existing deposit — no new transaction needed.
              </div>
            )}

            <SectionHeader>Strategy parameters</SectionHeader>

            {/* ── Sniper params ── */}
            {isSniper && (<>
              <ParamRow
                label="Timing offset"
                value={`${timingOffsetSec}s before round end`}
                help="How many seconds before round end the agent fires. Higher = fires earlier in the round (lower tx risk, less grid info). Lower = fires later (more grid info for the EV call). Below ~3s risks missing the round due to block time and RPC delays."
              >
                <input type="range" className="acd-slider" min={1} max={50} step={1}
                  value={timingOffsetSec} onChange={(e) => setTimingOffsetSec(Number(e.target.value))} />
                <Ticks left="1s" mid="25s" right="50s" />
              </ParamRow>
              <RoiSlider
                value={sniperMinRoiPct}
                onChange={setSniperMinRoiPct}
                help="Skip the round unless predicted ROI is at least this percentage. 0% fires on any positive EV. Higher = more conservative (only fires when the projected return is above your target)."
              />
            </>)}

            {/* ── Anti-Winner params ── */}
            {isAntiWinner && (<>
              <ParamRow
                label="Grid fill wait"
                value={`${awGridFillWaitSec}s after round start`}
                help="How many seconds after round start the agent fires. Lets the grid fill so the EV math is meaningful. Higher = waits longer, lower = fires sooner with less info."
              >
                <input type="range" className="acd-slider" min={0} max={55} step={1}
                  value={awGridFillWaitSec} onChange={(e) => setAwGridFillWaitSec(Number(e.target.value))} />
                <Ticks left="0s" mid="27s" right="55s" />
              </ParamRow>
              <ParamRow
                label="Exclude last N winners"
                value={`Lookback: ${excludeLastN} round${excludeLastN === 1 ? '' : 's'}`}
                help="Looks at the last N settled rounds and excludes those winning blocks from your deploy. Default of 1 = skip the most recent winner. Higher means deploy to fewer blocks but with stronger 'avoid the winner' bias."
              >
                <input type="range" className="acd-slider" min={0} max={24} step={1}
                  value={excludeLastN} onChange={(e) => setExcludeLastN(Number(e.target.value))} />
                <Ticks left="0" mid="12" right="24" />
              </ParamRow>
              <RoiSlider
                value={awMinRoiPct}
                onChange={setAwMinRoiPct}
                help="Skip the round unless predicted ROI is at least this percentage. 0% fires on any positive EV. Higher = more conservative (only fires when the projected return is above your target). Anti-Winner uses a slightly higher BEAN payout assumption to account for average beanpot contribution."
              />
            </>)}

            {/* ── Hunter params ── */}
            {/* Note: gridFillWaitSec is hidden — pure execution timing, not a strategy lever.
                Stays at the default (35) internally and is sent in the API payload. */}
            {isHunter && (<>
              <ParamRow
                label="Fire after"
                value={`${beanToRounds(beanpotThreshold)} rounds since last hit`}
                help="Beanpot hits roughly every 1 in 777 rounds on average. Default 622 fires ~20% before the average — slightly aggressive baseline. Lower = chase the pot earlier (more shots, smaller pots). Higher = hold out for fatter pots (fewer shots, bigger pots when they land)."
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="range" className="acd-slider"
                      min={0} max={2000} step={10}
                      value={Math.max(0, Math.min(2000, beanToRounds(beanpotThreshold)))}
                      onChange={(e) => setBeanpotThreshold(roundsToBean(Number(e.target.value)))}
                      style={{ width: '100%' }}
                    />
                    {/* Absolutely-positioned labels with thumb-radius compensation
                        so each tick lines up with the slider thumb at that value.
                        Thumb is 18px → radius 9px → offset = (0.5 - pct) * 18px. */}
                    <div style={{ position: 'relative', height: 14, marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em' }}>
                      {[0, 500, 1000, 1500, 2000].map((v) => {
                        const pct = v / 2000
                        return (
                          <span key={v} style={{
                            position: 'absolute',
                            left: `calc(${pct * 100}% + ${(0.5 - pct) * 18}px)`,
                            transform: 'translateX(-50%)',
                            whiteSpace: 'nowrap',
                          }}>
                            {v}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="acd-input"
                    value={hunterRoundsInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '')
                      const capped = digits === '' ? '' : String(Math.min(2000, Number(digits) || 0))
                      setHunterRoundsInput(capped)
                      if (capped !== '') setBeanpotThreshold(roundsToBean(Number(capped)))
                    }}
                    onBlur={() => {
                      if (hunterRoundsInput === '') setHunterRoundsInput(String(beanToRounds(beanpotThreshold)))
                    }}
                    style={{ ...inputStyle, width: 90, padding: '6px 8px', fontSize: 11, textAlign: 'right' }}
                  />
                </div>
                <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em', textAlign: 'right' as const }}>
                  ≈ {beanpotThreshold.toFixed(2)} BEAN
                </div>
              </ParamRow>
            </>)}

            {/* Deposit — hidden when reusing a compatible existing AutoMiner (no new deposit needed). */}
            {!autoMinerActiveCompatible && (<>
            <SectionHeader style={{ marginTop: 28 }}>Deposit</SectionHeader>

            <ParamRow label="Per block" value={`${perBlock.toFixed(6)} ETH`} help={`ETH deployed to each of the ${numBlocks} blocks every time the agent fires. Minimum ${MIN_PER_BLOCK} ETH per block (AutoMiner contract floor).`}>
              <input
                type="number" className="acd-input"
                step={0.000001} min={0}
                value={perBlockInput}
                onChange={(e) => {
                  // Strip negatives live so the input never displays a value
                  // that diverges from the clamped derived `perBlock`.
                  const v = e.target.value
                  setPerBlockInput(v.startsWith('-') ? v.slice(1) : v)
                }}
                onBlur={() => { if (perBlockInput.trim() === '' || Number(perBlockInput) <= 0) setPerBlockInput(String(MIN_PER_BLOCK)) }}
                style={inputStyle}
              />
            </ParamRow>

            <ParamRow label="Number of rounds" value={`${numRounds}`} help="Maximum rounds the agent is funded for. AutoMiner refunds the unspent balance when you stop.">
              <input
                type="number" className="acd-input"
                step={1} min={1}
                value={numRoundsInput}
                onChange={(e) => {
                  // Strip negatives + decimals live so the input matches
                  // the clamped derived `numRounds` (integer >= 1).
                  const v = e.target.value
                  setNumRoundsInput(v.replace(/[^0-9]/g, ''))
                }}
                onBlur={() => { if (numRoundsInput.trim() === '' || Number(numRoundsInput) < 1) setNumRoundsInput('1') }}
                style={inputStyle}
              />
            </ParamRow>

            <div style={{
              marginTop: 12,
              padding: '12px 14px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em' }}>
                TOTAL DEPOSIT
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>
                {depositTotal.toFixed(6)} ETH
              </span>
            </div>
            {isAntiWinner && (
              <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: "'Space Mono', monospace", textAlign: 'right' as const, letterSpacing: '0.04em' }}>
                {numBlocks} BLOCKS × {numRounds} ROUNDS · 25 − {excludeLastN} EXCLUDED
              </div>
            )}
            </>)}

            {/* Backtest — Sniper / Anti-Winner only — primary headline */}
            {historicalSample && historicalFiredPct !== null && (<>
              <SectionHeader style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  Backtest
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: "'Space Mono', monospace", fontWeight: 400, letterSpacing: '0.06em' }}>
                    · LAST {historicalSample.total}
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                  ROUNDS TO TEST
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>(MAX 1000)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={backtestRoundsInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '')
                      // Live-clamp to the system cap so the input never shows a
                      // value larger than we'll actually fetch.
                      if (digits === '') { setBacktestRoundsInput(''); return }
                      const n = Math.floor(Number(digits)) || 0
                      setBacktestRoundsInput(String(Math.min(1000, n)))
                    }}
                    onBlur={() => setBacktestRoundsInput(String(backtestRounds))}
                    style={{
                      width: 56, padding: '4px 8px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      color: '#fff', fontSize: 11, fontWeight: 700,
                      fontFamily: "'Space Mono', monospace",
                      textAlign: 'right' as const,
                      outline: 'none',
                    }}
                  />
                </span>
              </SectionHeader>

              <div style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
              }}>
                {/* Headline row: rounds fired + hypothetical PnL */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: '#fff', lineHeight: 1 }}>
                      {historicalSample.fired}<span style={{ color: 'rgba(255,255,255,0.3)' }}>/{historicalSample.total}</span>
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', marginTop: 4 }}>
                      ROUNDS WOULD&apos;VE DEPLOYED
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{
                      fontSize: 18, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                      color: historicalSample.sumPnl >= 0 ? '#00C853' : '#FF6B6B',
                      lineHeight: 1,
                    }}>
                      {historicalSample.sumPnl >= 0 ? '+' : ''}{historicalSample.sumPnl.toFixed(4)} ETH
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', marginTop: 4 }}>
                      HYPOTHETICAL P&L
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{
                    height: '100%',
                    width: `${historicalFiredPct}%`,
                    background: 'linear-gradient(90deg, #0052FF 0%, #4d8aff 100%)',
                    transition: 'width 0.3s ease',
                  }} />
                </div>

                {/* Stats row: Hunter shows pot wins; Sniper/AW show avg deploy + skipped */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  fontSize: 10, fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
                }}>
                  {isHunter ? (<>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                      POT WINS · <span style={{ color: '#00C853', fontWeight: 700 }}>{historicalSample.potWins ?? 0}</span>
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                      SKIPPED · <span style={{ color: '#fff', fontWeight: 700 }}>{historicalSample.total - historicalSample.fired}</span>
                    </span>
                  </>) : (<>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                      AVG DEPLOY · <span style={{ color: '#fff', fontWeight: 700 }}>{X.toFixed(5)} ETH</span>
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                      SKIPPED · <span style={{ color: '#fff', fontWeight: 700 }}>{historicalSample.total - historicalSample.fired}</span>
                    </span>
                  </>)}
                </div>

                {historicalFiredPct < 5 && (
                  <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,200,80,0.75)', fontFamily: "'Inter', -apple-system, sans-serif", lineHeight: 1.5 }}>
                    Heads up: under 5% of recent rounds would have fired with these settings. Most of your deposit may sit idle.
                  </div>
                )}

                <div style={{ marginTop: 10, fontSize: 9, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                  Approximation based on historical grid state and current BEAN price. Live results may differ.
                </div>
              </div>
            </>)}

            {/* Live projection — collapsible, click to expand */}
            <button
              type="button"
              onClick={() => setShowLiveProjection(v => !v)}
              style={{
                marginTop: 18, width: '100%',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'Space Mono', monospace",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,82,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(0,82,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                  Live projection
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 9,
                  color: feed ? 'rgba(0,200,131,0.85)' : 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.04em',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: feed ? '#00C853' : 'rgba(255,255,255,0.3)',
                    ...(feed ? { animation: 'acd-pulse 2s ease-in-out infinite' } : {}),
                  }} />
                  {feed ? 'LIVE' : feedError ? 'OFFLINE' : 'CONNECTING'}
                </span>
              </span>
              <span style={{
                fontSize: 11, color: 'rgba(255,255,255,0.4)',
                transform: showLiveProjection ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}>
                ▾
              </span>
            </button>

            {showLiveProjection && (
              <div style={{
                marginTop: 10,
                padding: '16px',
                background: 'linear-gradient(180deg, rgba(0,82,255,0.04) 0%, rgba(0,82,255,0.01) 100%)',
                border: '1px solid rgba(0,82,255,0.15)',
                borderRadius: 12,
              }}>
                {/* Headline */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
                  <div>
                    {projection?.kind === 'roi' && (<>
                      <div style={{
                        fontSize: 24, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                        color: projection.value >= 0 ? '#00C853' : '#FF6B6B',
                        lineHeight: 1,
                      }}>
                        {Math.abs(projection.value) > 999 ? (projection.value < 0 ? '<−999%' : '>999%') : `${projection.value >= 0 ? '+' : ''}${projection.value.toFixed(2)}%`}
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', marginTop: 4 }}>
                        EXPECTED ROI · CURRENT ROUND
                      </div>
                    </>)}
                    {projection?.kind === 'beanpot' && (<>
                      <div style={{
                        fontSize: 24, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                        color: '#fff', lineHeight: 1,
                      }}>
                        {beanToRounds(projection.potNow)}<span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}> / {beanToRounds(projection.threshold)} rounds</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', marginTop: 4 }}>
                        EQUIV ROUNDS · THRESHOLD
                      </div>
                    </>)}
                    {!projection && (
                      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>—</div>
                    )}
                  </div>
                  {projection && (
                    <div style={{
                      padding: '5px 10px',
                      background: projection.willFire ? 'rgba(0,200,131,0.12)' : 'rgba(255,107,107,0.1)',
                      border: `1px solid ${projection.willFire ? 'rgba(0,200,131,0.4)' : 'rgba(255,107,107,0.35)'}`,
                      borderRadius: 6,
                      fontSize: 10,
                      fontFamily: "'Space Mono', monospace", fontWeight: 700, letterSpacing: '0.06em',
                      color: projection.willFire ? '#00C853' : '#FF6B6B',
                    }}>
                      {projection.willFire ? 'WOULD FIRE' : 'WOULD SKIP'}
                    </div>
                  )}
                </div>

                {/* Inputs */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {isHunter ? (<>
                    <FeedStat label="BEANPOT" value={feed ? `${beanpotNow.toFixed(2)} BEAN` : '—'} />
                    <FeedStat label="GRID NOW" value={feed ? `${T.toFixed(4)} ETH` : '—'} />
                    <FeedStat label="YOUR DEPLOY" value={`${X.toFixed(5)} ETH`} />
                  </>) : (<>
                    <FeedStat label="GRID NOW" value={feed ? `${T.toFixed(4)} ETH` : '—'} />
                    <FeedStat label="YOUR DEPLOY" value={`${X.toFixed(5)} ETH`} />
                    <FeedStat label="BEAN/ETH" value={feed ? P.toFixed(7) : '—'} />
                  </>)}
                </div>

                {feedError && (
                  <div style={{ marginTop: 12, fontSize: 10, color: 'rgba(255,107,107,0.7)', fontFamily: "'Space Mono', monospace" }}>
                    {feedError}
                  </div>
                )}

                <div style={{ marginTop: 10, fontSize: 9, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                  {isSniper && `Updates every 8s. Fires at ${timingOffsetSec}s before round end.`}
                  {isAntiWinner && `Updates every 8s. Fires at ${awGridFillWaitSec}s after round start, skipping the last ${excludeLastN} winning block${excludeLastN === 1 ? '' : 's'}.`}
                  {isHunter && `Updates every 8s. Fires at ${hunterGridFillWaitSec}s after round start, only when the pool is at or above your threshold.`}
                </div>
              </div>
            )}

            {numBlocksConstraintBroken && (
              <div style={{
                marginTop: 14,
                padding: '10px 12px',
                background: 'rgba(255,107,107,0.06)',
                border: '1px solid rgba(255,107,107,0.25)',
                borderRadius: 8,
                fontSize: 11,
                color: 'rgba(255,107,107,0.85)',
              }}>
                Exclude can&apos;t exceed 24 — the agent needs at least 1 block to deploy to.
              </div>
            )}
          </>)}
        </div>

        {/* Activate progress / error banner (above footer) */}
        {(activateStep !== 'idle' && activateStep !== 'success') && (
          <div style={{
            padding: '12px 22px',
            background: activateStep === 'error' ? 'rgba(255,107,107,0.06)' : 'rgba(0,82,255,0.06)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 11,
            color: activateStep === 'error' ? 'rgba(255,140,140,0.95)' : 'rgba(255,255,255,0.75)',
            fontFamily: "'Space Mono', monospace",
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {activateStep === 'fetching-nonce' && <>SYNCING WITH BACKEND…</>}
            {activateStep === 'signing' && <>SIGN THE MESSAGE IN YOUR WALLET TO SAVE PARAMS…</>}
            {activateStep === 'posting' && <>SAVING AGENT CONFIG…</>}
            {activateStep === 'sending-tx' && <>CONFIRM THE DEPOSIT IN YOUR WALLET… {expiryLabel && <span style={{ opacity: 0.6 }}>· EXPIRES IN {expiryLabel}</span>}</>}
            {activateStep === 'tx-pending' && <>DEPOSIT TX SUBMITTED · WAITING FOR CONFIRMATION… {expiryLabel && <span style={{ opacity: 0.6 }}>· {expiryLabel}</span>}</>}
            {activateStep === 'error' && <>· {activateError}</>}
          </div>
        )}
        {activateStep === 'success' && (
          <div style={{
            padding: '12px 22px',
            background: 'rgba(0,200,131,0.08)',
            borderTop: '1px solid rgba(0,200,131,0.25)',
            fontSize: 11,
            color: 'rgba(150,240,200,0.95)',
            fontFamily: "'Space Mono', monospace",
            letterSpacing: '0.04em',
          }}>
            ✓ {autoMinerActiveCompatible ? 'AGENT CONFIG SAVED · DEPLOYS WILL FIRE PER YOUR PARAMS' : 'CONFIG SAVED · AGENT ACTIVATES NEXT ROUND'}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: 12, alignItems: 'center',
          background: 'rgba(10,12,20,0.85)', backdropFilter: 'blur(8px)',
        }}>
          <button
            onClick={handleReset}
            disabled={isUnsupported || activateStep !== 'idle'}
            className="acd-secondary"
            style={{
              background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 11, fontWeight: 700,
              fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
              cursor: (isUnsupported || activateStep !== 'idle') ? 'not-allowed' : 'pointer',
              padding: '10px 4px', transition: 'color 0.2s ease',
              opacity: (isUnsupported || activateStep !== 'idle') ? 0.4 : 1,
            }}
          >
            RESET
          </button>
          {activateStep === 'success' ? (
            <button
              onClick={onClose}
              className="acd-activate"
              style={{
                flex: 1, padding: '14px 0',
                border: '1px solid rgba(0,200,131,0.5)',
                borderRadius: 10,
                background: 'rgba(0,200,131,0.15)',
                color: '#fff',
                fontSize: 14, fontWeight: 700,
                fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: '0 0 15px rgba(0,200,131,0.2), 0 0 30px rgba(0,200,131,0.1)',
              }}
            >
              DONE
            </button>
          ) : showStopGate ? (
            <button
              onClick={handleStopAutoMiner}
              disabled={!isConnected || isStopping || stopStep === 'done'}
              style={{
                flex: 1, padding: '14px 0',
                border: '1px solid rgba(255,107,107,0.5)',
                borderRadius: 10,
                background: stopStep === 'done' ? 'rgba(0,200,131,0.15)' : 'rgba(255,107,107,0.12)',
                color: '#fff',
                fontSize: 14, fontWeight: 700,
                fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
                cursor: (!isConnected || isStopping || stopStep === 'done') ? 'not-allowed' : 'pointer',
                opacity: (!isConnected || isStopping) ? 0.7 : 1,
                boxShadow: stopStep === 'done' ? 'none' : '0 0 14px rgba(255,107,107,0.18)',
              }}
            >
              {!isConnected ? 'CONNECT WALLET'
                : stopStep === 'confirming' ? 'CONFIRM IN WALLET…'
                : stopStep === 'pending' ? 'STOPPING…'
                : stopStep === 'done' ? '✓ STOPPED · REOPEN TO CONTINUE'
                : isThisAgentActive ? `STOP ${agentName.toUpperCase()}`
                : isOtherAgentActive ? `STOP ${otherAgentName?.toUpperCase()}`
                : 'STOP AUTOMINER'}
            </button>
          ) : activateStep === 'error' ? (
            <button
              onClick={() => { setActivateStep('idle'); setActivateError(null); resetSetConfig() }}
              className="acd-activate"
              style={{
                flex: 1, padding: '14px 0',
                border: '1px solid rgba(0,82,255,0.5)',
                borderRadius: 10,
                background: 'rgba(0,82,255,0.15)',
                color: '#fff',
                fontSize: 14, fontWeight: 700,
                fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >
              TRY AGAIN
            </button>
          ) : (
            <button
              onClick={handleActivate}
              disabled={isUnsupported || numBlocksConstraintBroken || perBlockBelowMin || activateStep !== 'idle' || !isConnected || isThisAgentActive || isOtherAgentActive || autoMinerActiveIncompatible}
              className="acd-activate"
              style={{
                flex: 1,
                padding: '14px 0',
                border: '1px solid rgba(0,82,255,0.5)',
                borderRadius: 10,
                background: 'rgba(0,82,255,0.15)',
                color: '#fff',
                fontSize: 14, fontWeight: 700,
                fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
                cursor: (isUnsupported || numBlocksConstraintBroken || perBlockBelowMin || activateStep !== 'idle' || !isConnected || isThisAgentActive || isOtherAgentActive || autoMinerActiveIncompatible) ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 15px rgba(0,82,255,0.2), 0 0 30px rgba(0,82,255,0.1), inset 0 0 15px rgba(0,82,255,0.05)',
                transition: 'all 0.2s ease',
                opacity: (isUnsupported || numBlocksConstraintBroken || perBlockBelowMin || activateStep !== 'idle' || !isConnected || isThisAgentActive || isOtherAgentActive || autoMinerActiveIncompatible) ? 0.4 : 1,
              }}
            >
              {!isConnected ? 'CONNECT WALLET'
                : isThisAgentActive ? 'ALREADY ACTIVE'
                : isOtherAgentActive ? `STOP ${otherAgentName?.toUpperCase()} FIRST`
                : autoMinerActiveIncompatible ? 'STOP AUTOMINER FIRST'
                : perBlockBelowMin ? `MIN ${MIN_PER_BLOCK} ETH/BLOCK`
                : activateStep !== 'idle' ? 'WORKING…'
                : autoMinerActiveCompatible ? 'SAVE AGENT CONFIG'
                : 'DEPOSIT'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────

function SectionHeader({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: "'Space Mono', monospace",
      letterSpacing: '0.08em',
      marginBottom: 14,
      textTransform: 'uppercase' as const,
      display: 'flex', alignItems: 'center',
      ...style,
    }}>
      {children}
    </div>
  )
}

function FeedStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: "'Space Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function Ticks({ left, mid, right, labels }: { left?: string; mid?: string; right?: string; labels?: string[] }) {
  const items = labels ?? [left ?? '', mid ?? '', right ?? '']
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: 9, color: 'rgba(255,255,255,0.3)',
      fontFamily: "'Space Mono', monospace",
      marginTop: 6, letterSpacing: '0.04em',
    }}>
      {items.map((t, i) => <span key={i}>{t}</span>)}
    </div>
  )
}

function RoiSlider({ value, onChange, help }: { value: number; onChange: (n: number) => void; help: string }) {
  return (
    <ParamRow
      label="Minimum ROI"
      value={`${value >= 0 ? '+' : ''}${value}%`}
      help={help}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="range" className="acd-slider"
          min={0} max={100} step={1}
          value={Math.max(0, Math.min(100, value))}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <input
          type="number" className="acd-input"
          step={1} min={0} max={100} value={Math.max(0, value)}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          style={{ ...inputStyle, width: 70, padding: '6px 8px', fontSize: 11, textAlign: 'right' }}
        />
      </div>
      <Ticks left="0%" mid="50%" right="+100%" />
    </ParamRow>
  )
}

function ParamRow({
  label, value, help, children,
}: {
  label: string
  value?: string
  help?: string
  children: React.ReactNode
}) {
  const [showHelp, setShowHelp] = useState(false)
  const isOpen = showHelp && !!help
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
          {help && (
            <button
              type="button"
              aria-label={`${isOpen ? 'Hide' : 'Show'} help for ${label}`}
              aria-expanded={isOpen}
              onClick={() => setShowHelp(v => !v)}
              style={{
                width: 16, height: 16, padding: 0,
                borderRadius: '50%',
                border: `1px solid ${isOpen ? 'rgba(0,82,255,0.55)' : 'rgba(255,255,255,0.18)'}`,
                background: isOpen ? 'rgba(0,82,255,0.15)' : 'transparent',
                fontSize: 9.5,
                color: isOpen ? '#fff' : 'rgba(255,255,255,0.5)',
                fontFamily: "'Space Mono', monospace", fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', userSelect: 'none' as const,
                transition: 'all 0.18s ease', lineHeight: 1,
              }}
            >
              i
            </button>
          )}
        </div>
        {value && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: "'Space Mono', monospace", textAlign: 'right' as const }}>
            {value}
          </span>
        )}
      </div>
      {children}
      {help && (
        <div style={{
          overflow: 'hidden',
          maxHeight: isOpen ? 240 : 0,
          opacity: isOpen ? 1 : 0,
          transition: 'max-height 0.25s ease, opacity 0.2s ease, margin-top 0.25s ease',
          marginTop: isOpen ? 10 : 0,
        }}>
          <div style={{
            padding: '10px 12px',
            background: 'rgba(0,82,255,0.04)',
            border: '1px solid rgba(0,82,255,0.15)',
            borderRadius: 8,
            fontSize: 11, color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.55,
            fontFamily: "'Inter', -apple-system, sans-serif",
          }}>
            {help}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline styles ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 13,
  fontFamily: "'Space Mono', monospace",
  outline: 'none',
  transition: 'all 0.2s ease',
}
