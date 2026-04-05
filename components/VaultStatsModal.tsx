'use client'

import React from 'react'

interface VaultData {
  investors: number
  ethBalance: string
  ethDeployed: string
  ethRewarded: string
  beanClaimed: string
  beanPending: string
  totalBean: string
  address?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  agentName: string
  isMobile: boolean
  vaultData: VaultData | null
  roundsPlayed?: number
  beanPriceEth?: number
}

export default function VaultStatsModal({ isOpen, onClose, agentName, isMobile, vaultData, roundsPlayed, beanPriceEth }: Props) {
  if (!isOpen || !vaultData) return null

  const ethBal = parseFloat(vaultData.ethBalance || '0')
  const ethDeployed = parseFloat(vaultData.ethDeployed || '0')
  const ethRewarded = parseFloat(vaultData.ethRewarded || '0')
  const totalBean = parseFloat(vaultData.totalBean || '0')
  const beanClaimed = parseFloat(vaultData.beanClaimed || '0')
  const beanPending = parseFloat(vaultData.beanPending || '0')
  const netEthCost = ethDeployed - ethRewarded
  const beanPrice = beanPriceEth || 0
  const ethCostInBean = beanPrice > 0 ? netEthCost / beanPrice : 0
  const netProfitBean = totalBean - ethCostInBean
  const addr = vaultData.address || ''
  const truncAddr = addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

  return (
    <div style={s.overlay} onClick={onClose}>
      <div
        style={{ ...s.modal, maxWidth: isMobile ? '95vw' : 500 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={s.header}>
          <span style={s.headerTitle}>{agentName} Vault</span>
          <button onClick={onClose} style={s.closeBtn}>&times;</button>
        </div>

        {/* Investors — full width card */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ ...s.statCard, textAlign: 'center' as const }}>
                <span style={s.statLabel}>INVESTORS</span>
                <span style={s.statValue}>{vaultData.investors}</span>
              </div>
            </div>

            {/* 4 cards in 2x2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 22 }}>
              <StatCard label="TVL" value={`${ethBal.toFixed(4)} ETH`} />
              <StatCard label="PROFIT" value={`${netProfitBean >= 0 ? '+' : ''}${netProfitBean.toFixed(2)} BEAN`} />
              <StatCard label="TOTAL VOLUME" value={`${ethDeployed.toFixed(4)} ETH`} />
              <StatCard label="ROUNDS PLAYED" value={roundsPlayed ? roundsPlayed.toLocaleString() : '—'} />
            </div>

            {/* Detail rows */}
            <div style={s.detailSection}>
              <DetailRow label="BEAN Earned" value={`${totalBean.toFixed(2)} BEAN`} />
              <DetailRow label="ETH Cost (in BEAN)" value={`${ethCostInBean.toFixed(2)} BEAN`} />
              <DetailRow label="ETH Cost (fees)" value={`-${netEthCost.toFixed(4)} ETH`} />
              <div style={s.divider} />
              {addr && (
                <DetailRow
                  label="Vault Address"
                  value={truncAddr}
                  href={`https://basescan.org/address/${addr}`}
                />
              )}
            </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div style={s.statCard}>
      <span style={s.statLabel}>{label}</span>
      <span style={{ ...s.statValue, ...(accent ? { color: 'rgba(0,200,100,0.9)' } : {}) }}>
        {value}
        {unit && <span style={{ ...s.statUnit, ...(accent ? { color: 'rgba(0,200,100,0.5)' } : {}) }}> {unit}</span>}
      </span>
    </div>
  )
}

function DetailRow({ label, value, accent, href }: { label: string; value: string; accent?: boolean; href?: string }) {
  return (
    <div style={s.detailRow}>
      <span style={s.detailLabel}>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...s.detailValue, color: 'rgba(0,150,255,0.8)', textDecoration: 'none' }}>
          {value} ↗
        </a>
      ) : (
        <span style={{ ...s.detailValue, ...(accent ? { color: 'rgba(0,200,100,0.8)' } : {}) }}>{value}</span>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: 'rgba(8,11,20,0.95)',
    border: '1.5px solid rgba(0,100,255,0.55)',
    borderRadius: 20,
    padding: '32px 36px',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    boxShadow: '0 0 10px rgba(0,120,255,0.8), 0 0 25px rgba(0,100,255,0.5), 0 0 50px rgba(0,80,255,0.3), 0 0 100px rgba(0,60,255,0.15), 0 0 150px rgba(0,60,255,0.05), inset 0 0 25px rgba(0,100,255,0.1), inset 0 1px 0 rgba(150,200,255,0.15)',
    backdropFilter: 'blur(20px)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
    fontFamily: "'Space Mono', monospace",
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    cursor: 'pointer',
    padding: '4px 10px',
    lineHeight: 1,
    borderRadius: 8,
    transition: 'all 0.2s ease',
  },
  tabRow: {
    display: 'flex',
    gap: 0,
    marginBottom: 20,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 3,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  tabBtn: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.04em',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: 'rgba(0,82,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(0,82,255,0.3)',
  },
  tabInactive: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.35)',
    border: '1px solid transparent',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    padding: '16px 18px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    backdropFilter: 'blur(8px)',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: "'Space Mono', monospace",
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  statValue: {
    fontSize: 17,
    fontWeight: 700,
    color: '#fff',
    fontFamily: "'Space Mono', monospace",
  },
  statUnit: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.35)',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: "'Space Mono', monospace",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: "'Space Mono', monospace",
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.06)',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: "'Space Mono', monospace",
    textAlign: 'center' as const,
  },
}
