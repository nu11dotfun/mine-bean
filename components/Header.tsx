'use client'

import React, { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import WalletButton from './WalletButton'
import BeanLogo, { BeansTextLogo } from './BeanLogo'
import Link from 'next/link'

interface HeaderProps {
  logoText?: string
  currentPage?: string
  isMobile?: boolean
}

export default function Header({
  logoText = 'BEANS',
  currentPage = 'home',
  isMobile: propIsMobile,
}: HeaderProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)
  const [bnbPrice, setBnbPrice] = useState<string>('--')
  const [beansPrice, setBeansPrice] = useState<string>('--')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(propIsMobile ?? window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [propIsMobile])

  useEffect(() => {
    const fetchBnbPrice = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
        const data = await response.json()
        if (data.price) setBnbPrice(parseFloat(data.price).toFixed(2))
      } catch (error) {
        setBnbPrice('580.00')
      }
    }
    fetchBnbPrice()
    const interval = setInterval(fetchBnbPrice, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchBeansPrice = async () => {
      try {
        const response = await fetch('https://api.dexscreener.com/latest/dex/pairs/bsc/0x7e58f160b5b77b8b24cd9900c09a3e730215ac47')
        const data = await response.json()
        if (data.pair?.priceUsd) setBeansPrice(parseFloat(data.pair.priceUsd).toFixed(4))
      } catch (error) {
        setBeansPrice('0.0264')
      }
    }
    fetchBeansPrice()
    const interval = setInterval(fetchBeansPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  const tabs = [
    { id: 'about', label: 'About', href: '/about' },
    { id: 'global', label: 'Global', href: '/global' },
    { id: 'stake', label: 'Stake', href: '/stake' },
  ]

  if (isMobile) {
    return (
      <header style={styles.mobileHeader}>
        <Link href="/" style={styles.logo}>
          <BeanLogo size={24} />
          <BeansTextLogo height={20} />
        </Link>
        
        <div style={styles.mobileRight}>
          <div style={styles.mobileSocials}>
            <a href="https://x.com/minebean_" style={styles.socialLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://github.com/nu11dotfun/mine-bean" style={styles.socialLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <a href="#" style={styles.socialLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>
          </div>

          <ConnectButton 
            chainStatus="none"
            showBalance={false}
            accountStatus="avatar"
          />
        </div>
      </header>
    )
  }

  return (
    <header style={styles.header}>
      <div style={styles.logoSection}>
        <Link href="/" style={styles.logo}>
          <BeanLogo size={24} />
          <BeansTextLogo height={22} />
        </Link>

        <nav style={styles.nav}>
          {tabs.map((tab) => {
            const isHovered = hoveredTab === tab.id
            const isActive = currentPage === tab.id
            return (
              <Link
                key={tab.id}
                href={tab.href}
                style={{
                  ...styles.navItem,
                  color: isHovered || isActive ? '#fff' : '#666',
                }}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                <span>{tab.label}</span>
                <div
                  style={{
                    ...styles.navUnderline,
                    opacity: isHovered || isActive ? 1 : 0,
                    boxShadow: isHovered || isActive ? '0 0 8px 2px rgba(240, 185, 11, 0.5)' : 'none',
                  }}
                />
              </Link>
            )
          })}
        </nav>
      </div>

      <div style={styles.headerRight}>
        <div style={styles.priceTag}>
          <BeanLogo size={18} />
          <span style={styles.priceSymbol}>BEANS</span>
          <span style={styles.priceValue}>${beansPrice}</span>
        </div>

        <div style={styles.priceTag}>
          <img
            src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"
            alt="BNB"
            style={styles.bnbLogo}
          />
          <span style={styles.priceSymbol}>BNB</span>
          <span style={styles.priceValue}>${bnbPrice}</span>
        </div>

        <div style={styles.socials}>
          <a href="https://x.com/minebean_" style={styles.socialLink} target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a href="https://github.com/nu11dotfun/mine-bean" style={styles.socialLink} target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
          <a href="#" style={styles.socialLink} target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </a>
        </div>

        <WalletButton />
      </div>
    </header>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  mobileHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #1a1a1a',
    background: '#0a0a0a',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  mobileRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  mobileSocials: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 40px',
    borderBottom: '1px solid #1a1a1a',
    background: '#0a0a0a',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '40px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textDecoration: 'none',
  },
  nav: {
    display: 'flex',
    gap: '8px',
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'color 0.2s',
    textDecoration: 'none',
    position: 'relative',
  },
  navUnderline: {
    width: '100%',
    height: '2px',
    background: '#F0B90B',
    borderRadius: '1px',
    transition: 'opacity 0.2s, box-shadow 0.2s',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  priceTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#fff',
  },
  bnbLogo: {
    width: '18px',
    height: '18px',
    objectFit: 'contain' as const,
  },
  priceSymbol: {
    color: '#666',
  },
  priceValue: {
    color: '#fff',
    fontWeight: 500,
  },
  socials: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  socialLink: {
    color: '#666',
    textDecoration: 'none',
    transition: 'color 0.15s',
    display: 'flex',
    alignItems: 'center',
  },
}
