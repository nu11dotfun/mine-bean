'use client'

import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useUserData } from '@/lib/UserDataContext'

interface RoastingStats {
  available: boolean
  apr: string
}

interface RoastingAprBannerProps {
  userAddress?: string
}

export default function RoastingAprBanner({ userAddress }: RoastingAprBannerProps) {
  const { rewards } = useUserData()
  const [stats, setStats] = useState<RoastingStats | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const data = await apiFetch<RoastingStats>('/api/roasting/stats')
        if (active) setStats(data)
      } catch {
        // endpoint unavailable: bar stays hidden
      }
    }
    load()
    const id = setInterval(load, 60000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  // Mirror the Rewards panel: only show when connected with claimable rewards
  if (!userAddress || !rewards) return null
  const hasETH = rewards.pendingETH !== '0'
  const hasBEAN = rewards.pendingBEAN.gross !== '0'
  if (!hasETH && !hasBEAN) return null

  if (!stats || !stats.available || !stats.apr) return null
  const apr = parseFloat(stats.apr)
  if (!isFinite(apr)) return null

  return (
    <div style={styles.bar}>
      <span style={styles.label}>Unroasted APR</span>
      <span style={styles.value}>{apr.toFixed(2)}%</span>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  bar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)',
    border: '1px solid #222',
    borderRadius: 12,
    padding: '12px 16px',
    marginTop: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#888',
  },
  value: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
}
