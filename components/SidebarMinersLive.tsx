'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useProfileResolver } from '@/lib/useProfileResolver'
import SidebarMinersLeaderboard, { SidebarMiner } from './SidebarMinersLeaderboard'

interface ApiMiner {
  address: string
  ethRewardFormatted: string
  beanRewardFormatted: string
  deployedFormatted: string
  blockMask?: number   // present once the miners endpoint returns it — lights up the tiles + hover grid
}

interface MinersResponse {
  roundId: number
  winningBlock: number
  miners: ApiMiner[]
}

interface RoundSummary {
  roundId: number
  winnerCount: number
}

interface RoundsResponse {
  rounds: RoundSummary[]
}

function decodeMask(mask: number): number[] {
  const out: number[] = []
  for (let i = 0; i < 25; i++) if (mask & (1 << i)) out.push(i)
  return out
}

// Docked, always-present winners list for the PREVIOUS (just-settled) round. Pulls the
// same feed the old Winners panel used (/api/round/:id/miners) on each settlement, so it
// shows each winner's ETH won and who took the BEAN (or a split). Presentational rendering
// lives in SidebarMinersLeaderboard; this only sources the data.
export default function SidebarMinersLive() {
  const [round, setRound] = useState<{ id: number | null; winningBlock: number | null; miners: ApiMiner[] }>({ id: null, winningBlock: null, miners: [] })
  const [ethUsd, setEthUsd] = useState(0)
  const settledRoundIdRef = useRef<string | null>(null)

  const addresses = useMemo(() => round.miners.map(m => m.address), [round])
  const { resolve } = useProfileResolver(addresses)

  const fetchMiners = useCallback((id: string) => {
    apiFetch<MinersResponse>(`/api/round/${id}/miners`)
      .then(data => { if (data.miners.length > 0) setRound({ id: data.roundId, winningBlock: data.winningBlock, miners: data.miners }) })
      .catch(err => console.error('Failed to fetch sidebar winners:', err))
  }, [])

  // Capture the settled round id (consume-once), fetch after the settlement animation
  // completes — same pattern as MinersPanel.
  useEffect(() => {
    const handleRoundSettled = (event: CustomEvent) => {
      const settledId = event.detail?.roundId
      if (settledId != null) settledRoundIdRef.current = String(settledId)
    }
    window.addEventListener('roundSettled' as any, handleRoundSettled)
    return () => window.removeEventListener('roundSettled' as any, handleRoundSettled)
  }, [])

  useEffect(() => {
    const handleSettlementComplete = () => {
      if (settledRoundIdRef.current) {
        fetchMiners(settledRoundIdRef.current)
        settledRoundIdRef.current = null
      }
    }
    window.addEventListener('settlementComplete', handleSettlementComplete)
    return () => window.removeEventListener('settlementComplete', handleSettlementComplete)
  }, [fetchMiners])

  // Seed on mount from the most recent already-settled round that had winners, so a
  // fresh reload shows results immediately instead of waiting for the next settlement.
  useEffect(() => {
    apiFetch<RoundsResponse>('/api/rounds?page=1&limit=8&settled=true')
      .then(data => {
        const latest = [...data.rounds]
          .filter(r => (r.winnerCount ?? 0) > 0)
          .sort((a, b) => Number(b.roundId) - Number(a.roundId))[0]
        if (latest) fetchMiners(String(latest.roundId))
      })
      .catch(err => console.error('Failed to seed sidebar winners:', err))
  }, [fetchMiners])

  // ETH price for the hover-to-USD figure (Binance, same source as SidebarControls).
  useEffect(() => {
    let cancelled = false
    const load = () => fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT')
      .then(r => r.json())
      .then(d => { if (!cancelled && d.price) setEthUsd(parseFloat(d.price) || 0) })
      .catch(() => {})
    load()
    const id = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const miners: SidebarMiner[] = useMemo(
    () => round.miners.map(m => ({
      address: m.address,
      displayName: resolve(m.address),
      eth: parseFloat(m.ethRewardFormatted) || 0,
      beanWon: parseFloat(m.beanRewardFormatted) || 0,
      blocks: typeof m.blockMask === 'number' ? decodeMask(m.blockMask) : undefined,
    })),
    [round, resolve],
  )

  const beanWinners = miners.filter(m => (m.beanWon ?? 0) > 0).length
  const subtitle = round.id != null
    ? `Round #${round.id}${beanWinners > 1 ? ' · Split' : ''}`
    : 'Last round'

  return (
    <SidebarMinersLeaderboard
      miners={miners}
      title="Winners"
      subtitle={subtitle}
      emptyText="Waiting for round results…"
      ethUsd={ethUsd}
      winningBlock={round.winningBlock ?? undefined}
    />
  )
}
