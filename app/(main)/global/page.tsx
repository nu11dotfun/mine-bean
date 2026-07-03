'use client'

import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import GlobalTop from '@/components/analytics/GlobalTop'
import GlobalTabs, { GlobalTab } from '@/components/analytics/GlobalTabs'
import FinancialsSection from '@/components/analytics/sections/FinancialsSection'
import BuybackBurnSection from '@/components/analytics/sections/BuybackBurnSection'
import TokenSection from '@/components/analytics/sections/TokenSection'
import StakingSection from '@/components/analytics/sections/StakingSection'
import MiningSection from '@/components/analytics/sections/MiningSection'
import { useState, useEffect } from 'react'

const TABS: GlobalTab[] = [
  { id: 'financials', label: 'Revenue' },
  { id: 'buyback', label: 'Buyback & Burn' },
  { id: 'token', label: 'Token' },
  { id: 'staking', label: 'Staking' },
  { id: 'mining', label: 'Mining' },
]

export default function Global() {
  const [isMobile, setIsMobile] = useState(false)
  const [active, setActive] = useState('financials')
  // Sections mount lazily on first open and stay mounted (hidden) afterwards, so
  // switching tabs never refetches and each section's data loads at most once.
  const [visited, setVisited] = useState<Set<string>>(() => new Set(['financials']))

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const select = (id: string) => {
    setActive(id)
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }

  const renderSection = (id: string) => {
    switch (id) {
      case 'financials': return <FinancialsSection isMobile={isMobile} />
      case 'buyback': return <BuybackBurnSection isMobile={isMobile} />
      case 'token': return <TokenSection isMobile={isMobile} />
      case 'staking': return <StakingSection isMobile={isMobile} />
      case 'mining': return <MiningSection />
      default: return null
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: isMobile ? '80px' : '0' }}>
      <Header currentPage="global" isMobile={isMobile} />

      <div style={isMobile ? styles.mobileContainer : styles.container}>
        <div style={{ paddingTop: isMobile ? 24 : 40 }}>
          <GlobalTop isMobile={isMobile} />
        </div>

        <div style={{ marginTop: isMobile ? 28 : 40 }}>
          <GlobalTabs tabs={TABS} active={active} onChange={select} isMobile={isMobile} />
        </div>

        <div style={{ paddingTop: isMobile ? 22 : 30 }}>
          {TABS.filter((t) => visited.has(t.id)).map((t) => (
            <div key={t.id} style={{ display: t.id === active ? 'block' : 'none' }}>
              {renderSection(t.id)}
            </div>
          ))}
        </div>
      </div>

      {isMobile && <BottomNav currentPage="global" />}
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '0 40px 60px',
  },
  mobileContainer: {
    padding: '16px',
    overflowX: 'hidden',
  },
}
