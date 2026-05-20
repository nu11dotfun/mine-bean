'use client'

import React, { useState } from 'react'
import { useIsOnBase } from '@/lib/useIsOnBase'

// ── Types ──

export interface VaultStats {
  userDeposited: string
  userSharePct: number
  availableToWithdraw: string
  pendingAllocation: string
  lockedBean: string
  totalPooled: string
  beanEarned: string
}

export type DepositStep = 'idle' | 'approving' | 'locking' | 'depositing' | 'done' | 'error'

interface Props {
  isOpen: boolean
  onClose: () => void
  agentName: string
  isMobile: boolean
  isConnected: boolean
  userBeanBalance: number
  userEthBalance: number
  vaultStats: VaultStats | null
  beanAllowanceSufficient: boolean
  hasLockedBEAN: boolean
  beanLockAmount: string
  onApproveBEAN: () => void
  onLockBEAN: () => void
  onDepositETH: (amount: string) => void
  onWithdrawETH: () => void
  onWithdrawBEAN: () => void
  onClaimBEAN: () => void
  onClaimPendingWithdrawal: () => void
  pendingWithdrawalETH: string
  pendingWithdrawalBEAN: string
  pendingWithdrawalResolved: boolean
  hasPendingWithdrawal: boolean
  depositStep: DepositStep
  withdrawPending: boolean
  claimBeanPending: boolean
  depositsPaused?: boolean
}

// ── Component ──

export default function InvestModal({
  isOpen, onClose, agentName, isMobile, isConnected,
  userBeanBalance, userEthBalance,
  vaultStats, beanAllowanceSufficient, hasLockedBEAN, beanLockAmount,
  onApproveBEAN, onLockBEAN, onDepositETH, onWithdrawETH, onWithdrawBEAN, onClaimBEAN, onClaimPendingWithdrawal,
  pendingWithdrawalETH, pendingWithdrawalBEAN, pendingWithdrawalResolved, hasPendingWithdrawal,
  depositStep, withdrawPending, claimBeanPending, depositsPaused,
}: Props) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(depositsPaused ? 'withdraw' : 'deposit')
  const [ethAmount, setEthAmount] = useState('')
  const [claimBeanChecked, setClaimBeanChecked] = useState(false)

  if (!isOpen) return null

  const stats = vaultStats ?? {
    userDeposited: '0.0000',
    userSharePct: 0,
    availableToWithdraw: '0.0000',
    pendingAllocation: '0.0000',
    lockedBean: '0',
    totalPooled: '0.0000',
    beanEarned: '0',
  }

  const hasBeanToClaim = parseFloat(stats.beanEarned) > 0
  const hasPosition = parseFloat(stats.userDeposited) > 0 || hasLockedBEAN || hasPendingWithdrawal || hasBeanToClaim

  // Deposit button logic — no chaining, separate steps
  const isDepositBusy = ['approving', 'locking', 'depositing'].includes(depositStep)
  const ethVal = parseFloat(ethAmount) || 0
  const canDeposit = isConnected && hasLockedBEAN && ethVal > 0 && ethVal <= userEthBalance && !isDepositBusy

  const getDepositButtonText = () => {
    if (!isConnected) return 'CONNECT WALLET'
    if (depositStep === 'depositing') return 'DEPOSITING ETH...'
    if (depositStep === 'done') return 'DEPOSITED'
    return 'DEPOSIT'
  }

  const handleDeposit = () => {
    if (!isConnected || !hasLockedBEAN) return
    if (ethVal > 0) onDepositETH(ethAmount)
  }

  const handleMaxEth = () => {
    const max = Math.max(0, userEthBalance - 0.001) // leave gas buffer
    setEthAmount(max > 0 ? max.toFixed(6) : '0')
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: isMobile ? '95vw' : 620 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <span style={s.headerTitle}>Invest in {agentName}</span>
          <button onClick={onClose} style={s.closeBtn}>&times;</button>
        </div>

        {/* Stats cards */}
        <div style={s.statsGrid}>
          <StatCard label="ETH Deposited" value={`${parseFloat(stats.userDeposited).toFixed(4)} ETH`} />
          <StatCard label="Share" value={`${stats.userSharePct.toFixed(2)}%`} />
          <StatCard label="Available" value={`${parseFloat(stats.availableToWithdraw).toFixed(4)} ETH`} />
          <StatCard label="BEAN Earned" value={`${parseFloat(stats.beanEarned).toFixed(4)} BEAN`} />
        </div>

        {/* Tabs */}
        <div style={s.tabRow}>
          <button
            onClick={() => !depositsPaused && setActiveTab('deposit')}
            disabled={depositsPaused}
            style={{ ...s.tab, ...(activeTab === 'deposit' ? s.tabActive : {}), ...(depositsPaused ? { opacity: 0.3, cursor: 'not-allowed' } : {}) }}
          >
            DEPOSIT
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            style={{ ...s.tab, ...(activeTab === 'withdraw' ? s.tabActive : {}) }}
          >
            WITHDRAW
          </button>
        </div>

        {/* Tab content */}
        <div style={s.tabContent}>
          {activeTab === 'deposit' ? (
            <DepositTab
              ethAmount={ethAmount}
              setEthAmount={setEthAmount}
              userEthBalance={userEthBalance}
              userBeanBalance={userBeanBalance}
              beanLockAmount={beanLockAmount}
              beanAllowanceSufficient={beanAllowanceSufficient}
              hasLockedBEAN={hasLockedBEAN}
              onMax={handleMaxEth}
              onDeposit={handleDeposit}
              onApproveBEAN={onApproveBEAN}
              onLockBEAN={onLockBEAN}
              canDeposit={canDeposit}
              buttonText={getDepositButtonText()}
              isDepositBusy={isDepositBusy}
              depositStep={depositStep}
              isConnected={isConnected}
            />
          ) : (
            <WithdrawTab
              stats={stats}
              hasPosition={hasPosition}
              hasLockedBEAN={hasLockedBEAN}
              hasETHDeposited={parseFloat(stats.userDeposited) > 0}
              onWithdrawETH={onWithdrawETH}
              onWithdrawBEAN={onWithdrawBEAN}
              onClaimBEAN={onClaimBEAN}
              onClaimPendingWithdrawal={onClaimPendingWithdrawal}
              pendingWithdrawalETH={pendingWithdrawalETH}
              pendingWithdrawalResolved={pendingWithdrawalResolved}
              hasPendingWithdrawal={hasPendingWithdrawal}
              claimBeanChecked={claimBeanChecked}
              setClaimBeanChecked={setClaimBeanChecked}
              claimBeanPending={claimBeanPending}
              withdrawPending={withdrawPending}
              isConnected={isConnected}
              beanLockAmount={beanLockAmount}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={s.statCard}>
      <span style={s.statLabel}>{label}</span>
      <span style={{ ...s.statValue, ...(color ? { color } : {}) }}>{value}</span>
    </div>
  )
}

function DepositTab({
  ethAmount, setEthAmount, userEthBalance, userBeanBalance, beanLockAmount,
  beanAllowanceSufficient, hasLockedBEAN,
  onMax, onDeposit, onApproveBEAN, onLockBEAN,
  canDeposit, buttonText, isDepositBusy, depositStep, isConnected,
}: {
  ethAmount: string; setEthAmount: (v: string) => void
  userEthBalance: number; userBeanBalance: number; beanLockAmount: string
  beanAllowanceSufficient: boolean; hasLockedBEAN: boolean
  onMax: () => void; onDeposit: () => void; onApproveBEAN: () => void; onLockBEAN: () => void
  canDeposit: boolean; buttonText: string; isDepositBusy: boolean
  depositStep: DepositStep; isConnected: boolean
}) {
  const lockAmt = parseFloat(beanLockAmount)
  const hasEnoughBean = userBeanBalance >= lockAmt
  // Wrong-chain gate — replaces the staged action button with "Switch to Base"
  // when connected but on the wrong network.
  const { isOnBase, isSwitching, switchToBase } = useIsOnBase()
  const wrongChain = isConnected && !isOnBase
  const switchBtn = (
    <button
      onClick={switchToBase}
      disabled={isSwitching}
      style={{
        ...s.actionBtn,
        background: '#ff4d4d',
        opacity: isSwitching ? 0.6 : 1,
        cursor: isSwitching ? 'not-allowed' : 'pointer',
      }}
    >
      {isSwitching ? 'SWITCHING…' : 'SWITCH TO BASE'}
    </button>
  )

  // Step 1: Need to approve BEAN
  if (!hasLockedBEAN && !beanAllowanceSufficient) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={s.infoBanner}>
          <div>
            <span style={s.infoTitle}>STEP 1: APPROVE BEAN</span>
            <span style={s.infoText}>
              Approve the vault to use your BEAN tokens. This is a one-time transaction.
              {!hasEnoughBean && isConnected && (
                <span style={{ color: '#ef4444' }}> Insufficient BEAN balance ({lockAmt} BEAN required).</span>
              )}
            </span>
          </div>
        </div>
        {wrongChain ? switchBtn : (
          <button
            onClick={onApproveBEAN}
            disabled={!isConnected || !hasEnoughBean || depositStep === 'approving'}
            style={{
              ...s.actionBtn,
              opacity: (!isConnected || !hasEnoughBean || depositStep === 'approving') ? 0.4 : 1,
              cursor: (!isConnected || !hasEnoughBean || depositStep === 'approving') ? 'not-allowed' : 'pointer',
            }}
          >
            {depositStep === 'approving' ? 'APPROVING...' : 'APPROVE BEAN'}
          </button>
        )}
      </div>
    )
  }

  // Step 2: Need to lock BEAN
  if (!hasLockedBEAN && beanAllowanceSufficient) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={s.infoBanner}>
          <div>
            <span style={s.infoTitle}>STEP 2: LOCK {beanLockAmount} BEAN</span>
            <span style={s.infoText}>
              Lock {beanLockAmount} BEAN to unlock vault access. Your BEAN will be returned when you fully withdraw.
            </span>
          </div>
        </div>
        {wrongChain ? switchBtn : (
          <button
            onClick={onLockBEAN}
            disabled={!isConnected || depositStep === 'locking'}
            style={{
              ...s.actionBtn,
              opacity: (!isConnected || depositStep === 'locking') ? 0.4 : 1,
              cursor: (!isConnected || depositStep === 'locking') ? 'not-allowed' : 'pointer',
            }}
          >
            {depositStep === 'locking' ? 'LOCKING BEAN...' : `LOCK ${beanLockAmount} BEAN`}
          </button>
        )}
      </div>
    )
  }

  // Step 3: BEAN is locked — show ETH deposit
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ETH input */}
      <div>
        <div style={s.inputHeader}>
          <span style={s.inputLabel}>Deposit Amount</span>
          <span style={s.inputBalance}>Balance: {userEthBalance.toFixed(4)} ETH</span>
        </div>
        <div style={s.inputWrap}>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={ethAmount}
            onChange={e => {
              const v = e.target.value
              if (/^\d*\.?\d*$/.test(v)) setEthAmount(v)
            }}
            style={s.input}
          />
          <div style={s.inputRight}>
            <button onClick={onMax} style={s.maxBtn}>MAX</button>
            <span style={s.inputUnit}>ETH</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      {parseFloat(ethAmount) > 0 && (
        <div style={s.summaryRow}>
          <span style={s.summaryText}>You deposit <strong>{ethAmount} ETH</strong></span>
        </div>
      )}

      {/* Deposit button */}
      {wrongChain ? switchBtn : (
        <button
          onClick={onDeposit}
          disabled={!canDeposit && isConnected}
          style={{
            ...s.actionBtn,
            opacity: (!canDeposit && isConnected) ? 0.4 : 1,
            cursor: (!canDeposit && isConnected) ? 'not-allowed' : 'pointer',
          }}
        >
          {buttonText}
        </button>
      )}
    </div>
  )
}

function WithdrawTab({
  stats, hasPosition, hasLockedBEAN, hasETHDeposited, onWithdrawETH, onWithdrawBEAN, onClaimBEAN,
  onClaimPendingWithdrawal, pendingWithdrawalETH, pendingWithdrawalResolved, hasPendingWithdrawal,
  claimBeanChecked, setClaimBeanChecked, claimBeanPending, withdrawPending, isConnected, beanLockAmount,
}: {
  stats: VaultStats; hasPosition: boolean; hasLockedBEAN: boolean; hasETHDeposited: boolean
  onWithdrawETH: () => void; onWithdrawBEAN: () => void; onClaimBEAN: () => void
  onClaimPendingWithdrawal: () => void; pendingWithdrawalETH: string; pendingWithdrawalResolved: boolean; hasPendingWithdrawal: boolean
  claimBeanChecked: boolean; setClaimBeanChecked: (v: boolean) => void
  claimBeanPending: boolean; withdrawPending: boolean; isConnected: boolean; beanLockAmount: string
}) {
  // Wrong-chain gate — replaces any action button with "Switch to Base" when
  // connected but on the wrong network. Position info still renders so the user
  // can see what they own; they just can't act on it until they switch.
  const { isOnBase, isSwitching, switchToBase } = useIsOnBase()
  const wrongChain = isConnected && !isOnBase
  const switchBtn = (
    <button
      onClick={switchToBase}
      disabled={isSwitching}
      style={{
        ...s.actionBtn,
        background: '#ff4d4d',
        opacity: isSwitching ? 0.6 : 1,
        cursor: isSwitching ? 'not-allowed' : 'pointer',
      }}
    >
      {isSwitching ? 'SWITCHING…' : 'SWITCH TO BASE'}
    </button>
  )

  if (!hasPosition) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontFamily: "'Space Mono', monospace", fontSize: 13 }}>
        No active position to withdraw.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Current position - only show if there's something to display */}
      {(hasETHDeposited || hasLockedBEAN) && (
        <div style={s.positionRow}>
          {hasETHDeposited && (
            <>
              <div style={s.positionItem}>
                <span style={s.positionLabel}>ETH Deposited</span>
                <span style={s.positionValue}>{parseFloat(stats.userDeposited).toFixed(4)} ETH</span>
              </div>
              {hasLockedBEAN && <div style={s.positionDivider} />}
            </>
          )}
          {hasLockedBEAN && (
            <div style={s.positionItem}>
              <span style={s.positionLabel}>BEAN Locked</span>
              <span style={s.positionValue}>{beanLockAmount} BEAN</span>
            </div>
          )}
        </div>
      )}

      {/* Active round warning */}
      {parseFloat(stats.pendingAllocation) > 0 && (
        <div style={s.warningBanner}>
          <span style={s.warningIcon}>&#9888;</span>
          <span style={s.warningText}>
            Agent is in an active round. Withdrawing now will allocate you a small ETH amount claimable after the round settles.
          </span>
        </div>
      )}

      {/* Withdraw button - calls unlockBEAN() which returns ETH + locked BEAN in one tx */}
      {(hasETHDeposited || hasLockedBEAN) && !hasPendingWithdrawal && (
        wrongChain ? switchBtn : (
          <button
            onClick={onWithdrawBEAN}
            disabled={withdrawPending || !isConnected}
            style={{
              ...s.actionBtn,
              opacity: withdrawPending ? 0.4 : 1,
              cursor: withdrawPending ? 'not-allowed' : 'pointer',
            }}
          >
            {withdrawPending ? 'WITHDRAWING...' : 'WITHDRAW'}
          </button>
        )
      )}

      {/* Pending withdrawal from mid-round exit */}
      {hasPendingWithdrawal && (
        <>
          <div style={s.positionRow}>
            <div style={s.positionItem}>
              <span style={s.positionLabel}>Pending ETH</span>
              <span style={s.positionValue}>{parseFloat(pendingWithdrawalETH).toFixed(6)} ETH</span>
            </div>
          </div>
          {pendingWithdrawalResolved ? (
            wrongChain ? switchBtn : (
              <button
                onClick={onClaimPendingWithdrawal}
                disabled={withdrawPending || !isConnected}
                style={{
                  ...s.actionBtn,
                  opacity: withdrawPending ? 0.4 : 1,
                  cursor: withdrawPending ? 'not-allowed' : 'pointer',
                }}
              >
                {withdrawPending ? 'CLAIMING...' : 'CLAIM ETH'}
              </button>
            )
          ) : (
            <div style={s.infoBanner}>
              <div>
                <span style={s.infoTitle}>ROUND IN PROGRESS</span>
                <span style={s.infoText}>Your ETH from the active round will be claimable once the round settles.</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Claim BEAN section - show if user has any position */}
      {(hasETHDeposited || hasLockedBEAN || parseFloat(stats.beanEarned) > 0) && (
        <>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />

          <div style={s.warningBanner}>
            <span style={s.warningIcon}>&#9888;</span>
            <span style={s.warningText}>
              Claiming BEAN claims for ALL vault depositors and foregoes roasting rewards. This cannot be undone.
            </span>
          </div>

          <label style={s.checkboxRow}>
            <input
              type="checkbox"
              checked={claimBeanChecked}
              onChange={e => setClaimBeanChecked(e.target.checked)}
              style={s.checkbox}
            />
            <span style={s.checkboxLabel}>I understand this affects all depositors</span>
          </label>
        </>
      )}

      {wrongChain && (hasETHDeposited || hasLockedBEAN || parseFloat(stats.beanEarned) > 0) ? (
        <div style={{ display: 'flex' }}>{switchBtn}</div>
      ) : (
        <button
          onClick={onClaimBEAN}
          disabled={!claimBeanChecked || withdrawPending || claimBeanPending || !isConnected}
          style={{
            ...s.claimBeanBtn,
            display: (hasETHDeposited || hasLockedBEAN || parseFloat(stats.beanEarned) > 0) ? undefined : 'none',
            opacity: (!claimBeanChecked || withdrawPending || claimBeanPending) ? 0.3 : 1,
            cursor: (!claimBeanChecked || withdrawPending || claimBeanPending) ? 'not-allowed' : 'pointer',
          }}
        >
          {claimBeanPending ? 'CLAIMING...' : `CLAIM ${parseFloat(stats.beanEarned).toFixed(4)} BEAN`}
        </button>
      )}
    </div>
  )
}

// ── Styles ──

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
    overflowY: 'auto',
    boxShadow: '0 0 10px rgba(0,120,255,0.8), 0 0 25px rgba(0,100,255,0.5), 0 0 50px rgba(0,80,255,0.3), 0 0 100px rgba(0,60,255,0.15), 0 0 150px rgba(0,60,255,0.05), inset 0 0 25px rgba(0,100,255,0.1), inset 0 1px 0 rgba(150,200,255,0.15)',
    backdropFilter: 'blur(20px)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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

  // Stats grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    backdropFilter: 'blur(8px)',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: "'Space Mono', monospace",
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  statValue: {
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    fontFamily: "'Space Mono', monospace",
  },

  // Tabs
  tabRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 20,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: '11px 0',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: 'rgba(0,82,255,0.2)',
    border: '1px solid rgba(0,82,255,0.3)',
    color: '#fff',
  },
  tabContent: {
    minHeight: 200,
  },

  // Info banner (BEAN lock)
  infoBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    background: 'rgba(0,82,255,0.06)',
    border: '1px solid rgba(0,82,255,0.2)',
    borderRadius: 8,
  },
  infoTitle: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(0,120,255,0.8)',
    fontFamily: "'Space Mono', monospace",
    marginBottom: 2,
  },
  infoText: {
    display: 'block',
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 1.5,
  },

  // Input
  inputHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: "'Space Mono', monospace",
  },
  inputBalance: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: "'Space Mono', monospace",
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '0 14px',
    transition: 'border-color 0.2s ease',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    padding: '12px 0',
    width: '100%',
  },
  inputRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  maxBtn: {
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid rgba(0,82,255,0.4)',
    background: 'rgba(0,82,255,0.1)',
    color: 'rgba(0,82,255,0.8)',
    fontSize: 9,
    fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    cursor: 'pointer',
    letterSpacing: '0.04em',
  },
  inputUnit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
  },

  // Summary
  summaryRow: {
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.04)',
  },
  summaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: "'Space Mono', monospace",
  },

  // Stepper
  stepper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    padding: '8px 0',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    transition: 'all 0.3s ease',
  },
  stepLabel: {
    fontSize: 9,
    fontFamily: "'Space Mono', monospace",
    fontWeight: 600,
    letterSpacing: '0.04em',
    transition: 'color 0.3s ease',
  },

  // Action button
  actionBtn: {
    width: '100%',
    padding: '15px 0',
    border: '1px solid rgba(0,82,255,0.4)',
    borderRadius: 12,
    background: 'rgba(0,82,255,0.12)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.06em',
    transition: 'all 0.2s ease',
    boxShadow: '0 0 20px rgba(0,82,255,0.12)',
  },

  // Withdraw
  withdrawNote: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: "'Space Mono', monospace",
    textAlign: 'center' as const,
    marginTop: -6,
  },
  positionRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
  },
  positionItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  positionLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: "'Space Mono', monospace",
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  positionValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    fontFamily: "'Space Mono', monospace",
  },
  positionDivider: {
    width: 1,
    height: 32,
    background: 'rgba(255,255,255,0.06)',
    flexShrink: 0,
    margin: '0 12px',
  },

  // Warning
  warningBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 12px',
    background: 'rgba(255,165,0,0.06)',
    border: '1px solid rgba(255,165,0,0.2)',
    borderRadius: 8,
  },
  warningIcon: {
    fontSize: 14,
    flexShrink: 0,
    color: '#f59e0b',
  },
  warningText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.5,
  },

  // Claim BEAN
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: '#0052FF',
    cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: "'Space Mono', monospace",
  },
  claimBeanBtn: {
    width: '100%',
    padding: '12px 0',
    border: '1px solid rgba(255,165,0,0.3)',
    borderRadius: 10,
    background: 'rgba(255,165,0,0.08)',
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.04em',
    transition: 'all 0.2s ease',
  },
}
