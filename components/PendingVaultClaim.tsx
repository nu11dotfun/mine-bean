'use client'

import React from 'react'

interface Props {
  claimableETH: string
  onClaim: () => void
  claiming: boolean
}

export default function PendingVaultClaim({ claimableETH, onClaim, claiming }: Props) {
  const amount = parseFloat(claimableETH)
  if (amount <= 0) return null

  return (
    <div style={s.wrap}>
      <div style={s.row}>
        <div>
          <span style={s.label}>Pending Vault Claim</span>
          <span style={s.value}>{amount.toFixed(6)} ETH</span>
        </div>
        <button
          onClick={onClaim}
          disabled={claiming}
          style={{
            ...s.claimBtn,
            opacity: claiming ? 0.4 : 1,
            cursor: claiming ? 'not-allowed' : 'pointer',
          }}
        >
          {claiming ? 'CLAIMING...' : 'CLAIM'}
        </button>
      </div>
      <span style={s.note}>ETH allocated from a round that settled after your withdrawal.</span>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    padding: '10px 12px',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 8,
    marginTop: 8,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    display: 'block',
    fontSize: 9,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: "'Space Mono', monospace",
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 2,
  },
  value: {
    display: 'block',
    fontSize: 14,
    fontWeight: 700,
    color: '#22c55e',
    fontFamily: "'Space Mono', monospace",
  },
  claimBtn: {
    padding: '8px 16px',
    border: '1px solid rgba(34,197,94,0.4)',
    borderRadius: 6,
    background: 'rgba(34,197,94,0.1)',
    color: '#22c55e',
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.04em',
    transition: 'all 0.2s ease',
  },
  note: {
    display: 'block',
    fontSize: 9,
    color: 'rgba(255,255,255,0.2)',
    fontFamily: "'Space Mono', monospace",
    marginTop: 6,
  },
}
