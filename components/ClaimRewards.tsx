'use client'

import React, { useState, useEffect, useCallback } from "react"
import { apiFetch } from '@/lib/api'
import { useSSE } from '@/lib/SSEContext'

interface RewardsData {
  pendingBNB: string
  pendingBNBFormatted: string
  pendingBEAN: {
    unrefined: string
    unrefinedFormatted: string
    refined: string
    refinedFormatted: string
    gross: string
    grossFormatted: string
    fee: string
    feeFormatted: string
    net: string
    netFormatted: string
  }
  uncheckpointedRound: string
}

interface ClaimRewardsProps {
  userAddress?: string
  onClaimBNB: () => void
  onClaimBEAN: () => void
}

const BnbLogo = ({ size = 16 }: { size?: number }) => (
  <img
    src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"
    alt="BNB"
    style={{ width: size, height: size, objectFit: "contain" as const }}
  />
)

const BeanIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#F0B90B">
    <ellipse cx="12" cy="12" rx="8" ry="10" />
  </svg>
)

export default function ClaimRewards({ userAddress, onClaimBNB, onClaimBEAN }: ClaimRewardsProps) {
  const [rewards, setRewards] = useState<RewardsData | null>(null)
  const { subscribeUser } = useSSE()

  const fetchRewards = useCallback(() => {
    if (!userAddress) return
    apiFetch<RewardsData>(`/api/user/${userAddress}/rewards`)
      .then(data => setRewards(data))
      .catch(() => {})
  }, [userAddress])

  // Fetch on mount and when address changes
  useEffect(() => {
    fetchRewards()
  }, [fetchRewards])

  // Re-fetch after settlement animation completes
  useEffect(() => {
    const handler = () => fetchRewards()
    window.addEventListener("settlementComplete", handler)
    return () => window.removeEventListener("settlementComplete", handler)
  }, [fetchRewards])

  // Subscribe to user SSE for claim confirmations
  useEffect(() => {
    const unsubBNB = subscribeUser('claimedBNB', () => fetchRewards())
    const unsubBEAN = subscribeUser('claimedBEAN', () => fetchRewards())
    return () => {
      unsubBNB()
      unsubBEAN()
    }
  }, [subscribeUser, fetchRewards])

  if (!userAddress || !rewards) return null

  const hasBNB = rewards.pendingBNB !== "0"
  const hasBEAN = rewards.pendingBEAN.gross !== "0"
  if (!hasBNB && !hasBEAN) return null

  const hasUnrefined = rewards.pendingBEAN.unrefined !== "0"
  const hasRefined = rewards.pendingBEAN.refined !== "0"

  return (
    <div style={styles.card}>
      <div style={styles.header}>Rewards</div>

      <div style={styles.rows}>
        <div style={styles.row}>
          <div style={styles.rowLabel}>
            <BnbLogo size={16} />
            <span>BNB Rewards</span>
          </div>
          <div style={{ ...styles.rowValue, color: hasBNB ? "#fff" : "#555" }}>
            {parseFloat(rewards.pendingBNBFormatted).toFixed(6)} BNB
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.rowLabel}>
            <BeanIcon size={16} />
            <span>Unrefined BEAN</span>
          </div>
          <div style={{ ...styles.rowValue, color: hasUnrefined ? "#fff" : "#555" }}>
            {parseFloat(rewards.pendingBEAN.unrefinedFormatted).toFixed(4)} BEAN
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.rowLabel}>
            <BeanIcon size={16} />
            <span>Refined BEAN</span>
          </div>
          <div style={{ ...styles.rowValue, color: hasRefined ? "#fff" : "#555" }}>
            {parseFloat(rewards.pendingBEAN.refinedFormatted).toFixed(4)} BEAN
          </div>
        </div>
      </div>

      <div style={styles.buttons}>
        <button
          style={hasBEAN ? styles.btnActive : styles.btnDisabled}
          disabled={!hasBEAN}
          onClick={onClaimBEAN}
        >
          Claim BEAN
        </button>
        <button
          style={hasBNB ? styles.btnActive : styles.btnDisabled}
          disabled={!hasBNB}
          onClick={onClaimBNB}
        >
          Claim BNB
        </button>
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  header: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    marginBottom: 12,
  },
  rows: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#888",
  },
  rowValue: {
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  buttons: {
    display: "flex",
    gap: 8,
    marginTop: 14,
  },
  btnActive: {
    flex: 1,
    padding: "10px 0",
    background: "#F0B90B",
    color: "#000",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnDisabled: {
    flex: 1,
    padding: "10px 0",
    background: "#222",
    color: "#555",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "default",
  },
}
