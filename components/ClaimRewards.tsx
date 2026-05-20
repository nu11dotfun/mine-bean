'use client'
import BeanLogo from './BeanLogo'

import React from "react"
import { useUserData } from '@/lib/UserDataContext'
import { useIsOnBase } from '@/lib/useIsOnBase'

interface ClaimRewardsProps {
  userAddress?: string
  onClaimETH: () => void
  onClaimBEAN: () => void
}

const EthLogo = ({ size = 16 }: { size?: number }) => (
  <img
    src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/f9461cf2-aacc-4c59-8b9d-59ade3c46c00/public"
    alt="ETH"
    style={{ width: size, height: size, objectFit: "contain" as const }}
  />
)


export default function ClaimRewards({ userAddress, onClaimETH, onClaimBEAN }: ClaimRewardsProps) {
  // Shared rewards data from context (no local fetching)
  const { rewards } = useUserData()
  const { isOnBase, isSwitching, switchToBase } = useIsOnBase()

  if (!userAddress || !rewards) return null

  const hasETH = rewards.pendingETH !== "0"
  const hasBEAN = rewards.pendingBEAN.gross !== "0"
  if (!hasETH && !hasBEAN) return null

  const hasUnroasted = rewards.pendingBEAN.unroasted !== "0"
  const hasRoasted = rewards.pendingBEAN.roasted !== "0"

  return (
    <div style={styles.card}>
      <div style={styles.header}>Rewards</div>

      <div style={styles.rows}>
        <div style={styles.row}>
          <div style={styles.rowLabel}>
            <EthLogo size={16} />
            <span>ETH Rewards</span>
          </div>
          <div style={{ ...styles.rowValue, color: hasETH ? "#fff" : "#555" }}>
            {parseFloat(rewards.pendingETHFormatted).toFixed(6)} ETH
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.rowLabel}>
            <BeanLogo size={16} />
            <span>Unroasted BEAN</span>
          </div>
          <div style={{ ...styles.rowValue, color: hasUnroasted ? "#fff" : "#555" }}>
            {parseFloat(rewards.pendingBEAN.unroastedFormatted).toFixed(4)} BEAN
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.rowLabel}>
            <BeanLogo size={16} />
            <span>Roasted BEAN</span>
          </div>
          <div style={{ ...styles.rowValue, color: hasRoasted ? "#fff" : "#555" }}>
            {parseFloat(rewards.pendingBEAN.roastedFormatted).toFixed(4)} BEAN
          </div>
        </div>
      </div>

      <div style={styles.buttons}>
        {!isOnBase ? (
          <button
            style={{ ...styles.btnActive, ...styles.btnSwitchChain, gridColumn: '1 / span 2' }}
            onClick={switchToBase}
            disabled={isSwitching}
          >
            {isSwitching ? "Switching…" : "Switch to Base to Claim"}
          </button>
        ) : (
          <>
            <button
              style={hasBEAN ? styles.btnActive : styles.btnDisabled}
              disabled={!hasBEAN}
              onClick={onClaimBEAN}
            >
              Claim BEAN
            </button>
            <button
              style={hasETH ? styles.btnActive : styles.btnDisabled}
              disabled={!hasETH}
              onClick={onClaimETH}
            >
              Claim ETH
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    background: "rgba(255, 255, 255, 0.04)", backdropFilter: "blur(20px)",
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
    background: "#0052FF",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnSwitchChain: {
    background: "#ff4d4d",
  },
  btnDisabled: {
    flex: 1,
    padding: "10px 0",
    background: "rgba(255, 255, 255, 0.06)",
    color: "#555",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "default",
  },
}
