'use client'

import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import StakePage from '@/components/StakePage'
import { useAccount, useBalance } from 'wagmi'
import { useState, useEffect } from 'react'

export default function Stake() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const userBalance = balance ? parseFloat(balance.formatted) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: isMobile ? '80px' : '0' }}>
      <Header currentPage="stake" isMobile={isMobile} />
      <StakePage
        isConnected={isConnected}
        userBalance={userBalance}
        isMobile={isMobile}
      />
      {isMobile && <BottomNav currentPage="stake" />}
    </div>
  )
}
