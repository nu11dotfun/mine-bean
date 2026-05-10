'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  listCustomAgents,
  removeCustomAgent,
  type CustomAgent,
  MAX_CUSTOM_AGENTS_PER_WALLET,
} from '@/lib/customAgents'

// Keep in sync with AgentConfigDrawer.tsx:MIN_PER_BLOCK (FE-only floor for the
// agent-config flow, independent of lib/contracts.ts).
const MIN_PER_BLOCK = 0.00001

// Window event that lets MyAgentsList stay in sync with saves/deletes from
// anywhere in the app. Save handlers in AgentConfigDrawer dispatch this too.
const REFRESH_EVENT = 'bean_custom_agents_changed'

interface MyAgentsListProps {
  walletAddress: string | undefined
  onUse: (preset: CustomAgent) => void
  onEdit: (preset: CustomAgent) => void
  onCreateNew: () => void
}

export default function MyAgentsList({ walletAddress, onUse, onEdit, onCreateNew }: MyAgentsListProps) {
  const [agents, setAgents] = useState<CustomAgent[]>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!walletAddress) { setAgents([]); return }
    setAgents(listCustomAgents(walletAddress))
  }, [walletAddress])

  // Initial load + react to wallet switch
  useEffect(() => { refresh() }, [refresh])

  // Cross-component refresh: when a preset is saved/deleted elsewhere, re-read.
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener(REFRESH_EVENT, handler)
    // Cross-tab sync via the standard storage event (fired in OTHER tabs only).
    const storageHandler = (e: StorageEvent) => {
      if (e.key && walletAddress && e.key === `bean_custom_agents_${walletAddress.toLowerCase()}`) refresh()
    }
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener(REFRESH_EVENT, handler)
      window.removeEventListener('storage', storageHandler)
    }
  }, [refresh, walletAddress])

  const handleDelete = (id: string) => {
    if (!walletAddress) return
    removeCustomAgent(walletAddress, id)
    setConfirmingId(null)
    refresh()
    window.dispatchEvent(new Event(REFRESH_EVENT))
  }

  // Empty / disconnected states
  if (!walletAddress) {
    return (
      <div style={containerStyle}>
        <Header count={0} />
        <div style={emptyStateStyle}>Connect wallet to see your saved agents.</div>
        <CreateButton onClick={onCreateNew} disabled />
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div style={containerStyle}>
        <Header count={0} />
        <div style={emptyStateStyle}>No saved agents yet. Configure one and save it for next time.</div>
        <CreateButton onClick={onCreateNew} />
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <Header count={agents.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            confirming={confirmingId === agent.id}
            onUse={() => onUse(agent)}
            onEdit={() => onEdit(agent)}
            onAskDelete={() => setConfirmingId(agent.id)}
            onCancelDelete={() => setConfirmingId(null)}
            onConfirmDelete={() => handleDelete(agent.id)}
          />
        ))}
      </div>
      <CreateButton onClick={onCreateNew} disabled={agents.length >= MAX_CUSTOM_AGENTS_PER_WALLET} />
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────

function Header({ count }: { count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 11, fontWeight: 700,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: "'Space Mono', monospace",
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      marginBottom: 12,
    }}>
      <span>MY AGENTS</span>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
        {count}/{MAX_CUSTOM_AGENTS_PER_WALLET}
      </span>
    </div>
  )
}

function IconBtn({ children, onClick, ariaLabel, title, danger }: {
  children: React.ReactNode
  onClick: () => void
  ariaLabel: string
  title: string
  danger?: boolean
}) {
  const [hover, setHover] = React.useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={ariaLabel}
      title={title}
      style={{
        width: 28, height: 28,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: hover
          ? (danger ? 'rgba(255,107,107,0.12)' : 'rgba(255,255,255,0.06)')
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hover ? (danger ? 'rgba(255,107,107,0.35)' : 'rgba(255,255,255,0.14)') : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 7,
        color: hover ? (danger ? '#ff8a8a' : '#fff') : 'rgba(255,255,255,0.55)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
      }}
    >
      {children}
    </button>
  )
}

const PencilIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)
const TrashIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
)

function AgentCard({ agent, confirming, onUse, onEdit, onAskDelete, onCancelDelete, onConfirmDelete }: {
  agent: CustomAgent
  confirming: boolean
  onUse: () => void
  onEdit: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) {
  const belowMin = agent.perBlock < MIN_PER_BLOCK
  const [useHover, setUseHover] = React.useState(false)

  return (
    <div style={{
      padding: '14px 14px 12px',
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${belowMin ? 'rgba(255,180,80,0.3)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 12,
      display: 'flex', flexDirection: 'column', gap: 8,
      fontFamily: "'Space Mono', monospace",
      transition: 'border-color 0.15s ease, background 0.15s ease',
    }}>
      {/* Top row: name + action cluster (edit / trash / USE) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, letterSpacing: '0.01em' }}>
          {agent.name}
        </div>
        {confirming ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,107,107,0.85)', letterSpacing: '0.04em', marginRight: 4 }}>Delete?</span>
            <button
              onClick={onConfirmDelete}
              style={{
                padding: '5px 12px',
                background: 'rgba(255,107,107,0.18)',
                border: '1px solid rgba(255,107,107,0.45)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                fontFamily: "'Space Mono', monospace",
                cursor: 'pointer',
              }}
            >YES</button>
            <button
              onClick={onCancelDelete}
              style={{
                padding: '5px 12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 6,
                color: 'rgba(255,255,255,0.65)',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                fontFamily: "'Space Mono', monospace",
                cursor: 'pointer',
              }}
            >NO</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <IconBtn onClick={onEdit} ariaLabel="Edit agent" title="Edit">{PencilIcon}</IconBtn>
            <IconBtn onClick={onAskDelete} ariaLabel="Delete agent" title="Delete" danger>{TrashIcon}</IconBtn>
            <button
              onClick={onUse}
              disabled={belowMin}
              onMouseEnter={() => setUseHover(true)}
              onMouseLeave={() => setUseHover(false)}
              style={{
                padding: '7px 16px',
                marginLeft: 4,
                background: belowMin
                  ? 'rgba(255,255,255,0.04)'
                  : (useHover ? '#0061ff' : '#0052FF'),
                border: 'none',
                borderRadius: 7,
                color: belowMin ? 'rgba(255,255,255,0.3)' : '#fff',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                fontFamily: "'Space Mono', monospace",
                cursor: belowMin ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease, transform 0.1s ease',
                transform: useHover && !belowMin ? 'translateY(-1px)' : 'none',
                boxShadow: belowMin ? 'none' : '0 2px 8px rgba(0,82,255,0.25)',
              }}
            >
              USE
            </button>
          </div>
        )}
      </div>

      {/* Summary lines */}
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
        {baseAgentLabel(agent.baseAgent)} · {paramSummary(agent)}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.04em' }}>
        {agent.perBlock} ETH/block · {agent.numRounds} rounds
      </div>

      {belowMin && (
        <div style={{ fontSize: 10, color: 'rgba(255,180,80,0.85)', letterSpacing: '0.04em', marginTop: 2 }}>
          Below current minimum ({MIN_PER_BLOCK} ETH/block). Edit to fix.
        </div>
      )}
    </div>
  )
}

function CreateButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        marginTop: 10,
        width: '100%',
        padding: '10px 0',
        background: 'transparent',
        border: '1px dashed rgba(255,255,255,0.18)',
        borderRadius: 8,
        color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.65)',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        fontFamily: "'Space Mono', monospace",
        cursor: disabled ? 'not-allowed' : 'pointer',
        textTransform: 'uppercase' as const,
      }}
    >
      {disabled ? `LIMIT REACHED (${MAX_CUSTOM_AGENTS_PER_WALLET} MAX)` : '+ CREATE NEW AGENT'}
    </button>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function baseAgentLabel(id: CustomAgent['baseAgent']): string {
  if (id === 'sniper') return 'Sniper'
  if (id === 'anti-winner') return 'Anti-Winner'
  if (id === 'beanpot-hunter') return 'Beanpot Hunter'
  if (id === 'anti-loser') return 'Anti-Loser'
  if (id === 'nostradamus') return 'Nostradamus'
  return id
}

function paramSummary(agent: CustomAgent): string {
  const p = agent.params || {}
  if (agent.baseAgent === 'sniper') {
    const offset = numOrDash(p.timingOffsetSec, 's offset')
    const roi = numOrDash(p.minRoiPct, '% min ROI')
    return [offset, roi].filter(Boolean).join(' · ')
  }
  if (agent.baseAgent === 'anti-winner') {
    const wait = numOrDash(p.gridFillWaitSec, 's wait')
    const lookback = numOrDash(p.excludeLastN, ' lookback')
    const roi = numOrDash(p.minRoiPct, '% min ROI')
    return [wait, lookback, roi].filter(Boolean).join(' · ')
  }
  if (agent.baseAgent === 'beanpot-hunter') {
    const rounds = typeof p.beanpotThreshold === 'number' ? `fire after ${Math.round(p.beanpotThreshold / 0.1)} rounds` : ''
    return rounds
  }
  if (agent.baseAgent === 'anti-loser') {
    const offset = numOrDash(p.timingOffsetSec, 's offset')
    const lookback = numOrDash(p.historyLookbackRounds, 'r lookback')
    const cold = typeof p.excludeColdN === 'number' ? `skip ${p.excludeColdN} cold` : ''
    const roi = numOrDash(p.minRoiPct, '% min ROI')
    return [offset, lookback, cold, roi].filter(Boolean).join(' · ')
  }
  if (agent.baseAgent === 'nostradamus') {
    const wait = numOrDash(p.gridFillWaitSec, 's wait')
    const lookback = numOrDash(p.predictionLookbackRounds, 'r lookback')
    const roi = numOrDash(p.minRoiPct, '% min ROI')
    return [wait, lookback, roi].filter(Boolean).join(' · ')
  }
  return ''
}

function numOrDash(value: unknown, suffix: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return `${value}${suffix}`
}

const containerStyle: React.CSSProperties = {
  padding: '14px 0',
  fontFamily: "'Space Mono', monospace",
}

const emptyStateStyle: React.CSSProperties = {
  padding: '20px 14px',
  textAlign: 'center' as const,
  fontSize: 11,
  color: 'rgba(255,255,255,0.4)',
  letterSpacing: '0.04em',
  border: '1px dashed rgba(255,255,255,0.1)',
  borderRadius: 10,
  marginBottom: 4,
}
