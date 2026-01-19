'use client'

import Header from '@/components/Header'
import AboutPage from '@/components/AboutPage'
import BottomNav from '@/components/BottomNav'
import { useState, useEffect } from 'react'

export default function About() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: isMobile ? '80px' : '0' }}>
      <Header currentPage="about" isMobile={isMobile} />
      <AboutPage isMobile={isMobile} />
      {isMobile && <BottomNav currentPage="about" />}
    </div>
  )
}
