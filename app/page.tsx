'use client'

import Header from '@/components/Header'
import MinersPanel from '@/components/MinersPanel'
import MiningGrid from '@/components/MiningGrid'
import SidebarControls from '@/components/SidebarControls'
import MobileStatsBar from '@/components/MobileStatsBar'
import MobileControls from '@/components/MobileControls'
import BottomNav from '@/components/BottomNav'
import LandingPage from '@/components/LandingPage'
import { useAccount, useBalance } from 'wagmi'
import { useState, useEffect } from 'react'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })
  const [isMobile, setIsMobile] = useState(false)
  const [showMining, setShowMining] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const userBalance = balance ? parseFloat(balance.formatted) : 0

  if (!showMining) {
    return <LandingPage onStartMining={() => setShowMining(true)} />
  }

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: '80px' }}>
        <Header currentPage="home" isMobile={true} />
        <div style={styles.mobileContainer}>
          <MobileStatsBar />
          <MiningGrid />
          <MobileControls isConnected={isConnected} userBalance={userBalance} />
        </div>
        <BottomNav currentPage="mine" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <Header currentPage="home" />
      <div style={styles.container}>
        <MinersPanel />
        <div style={styles.gridSection}>
          <MiningGrid />
        </div>
        <div style={styles.controlsSection}>
          <SidebarControls isConnected={isConnected} userBalance={userBalance} />
        </div>
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    gap: '24px',
    padding: '24px 40px',
    paddingRight: '120px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  mobileContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '12px',
  },
  gridSection: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  controlsSection: {
    width: '340px',
    flexShrink: 0,
  },
}
