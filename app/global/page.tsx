'use client'

import Header from '@/components/Header'
import GlobalStats from '@/components/GlobalStats'
import MiningTable from '@/components/MiningTable'
import RevenueTable from '@/components/RevenueTable'
import LeaderboardTable from '@/components/LeaderboardTable'
import BottomNav from '@/components/BottomNav'
import { useState, useEffect } from 'react'

export default function Global() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: isMobile ? '80px' : '0' }}>
      <Header currentPage="global" isMobile={isMobile} />
      
      <div style={isMobile ? styles.mobileContainer : styles.container}>
        <GlobalStats isMobile={isMobile} />
        <MiningTable />
        <RevenueTable />
        <LeaderboardTable />
      </div>
      
      {isMobile && <BottomNav currentPage="global" />}
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 40px 60px',
  },
  mobileContainer: {
    padding: '16px',
    overflowX: 'hidden',
  },
}
