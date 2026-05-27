'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import AgentHeader from '@/components/AgentHeader'
import AgentBottomNav from '@/components/AgentBottomNav'

// ── Integration metadata ──────────────────────────────────────────────────

interface Integration {
  id: string
  name: string
  tagline: string
  status: 'live' | 'soon'
  href?: string
  logoUrl: string
  activeBadge?: boolean // show the "ACTIVELY MINING" green chip
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'vvv',
    name: 'Venice',
    tagline: 'AI compute layer. Agents stake VVV, receive sVVV, then mint DIEM to fund their own daily Venice inference budget.',
    status: 'live',
    href: '/integrations/venice',
    logoUrl: 'https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/e9b02db4-2d71-466f-1094-d85c7fd10300/public',
  },
  {
    id: 'hermes',
    name: 'Hermes',
    tagline: 'Autonomous mining plugin for Hermes agents. Provider-agnostic LLM routing, five strategy presets.',
    status: 'live',
    href: '/integrations/hermes',
    logoUrl: 'https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/d8efab4d-e560-40f9-6203-f94ce0822100/public',
  },
  {
    id: 'aeon',
    name: 'AEON',
    tagline: 'AEON skill. Mine BEAN autonomously from any AEON fork. Runs on GitHub Actions, zero infrastructure.',
    status: 'live',
    href: '/integrations/aeon',
    logoUrl: 'https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/57ecc07e-4344-4f40-42ce-f31583f90800/public',
  },
]

// MineBean's own strategy agents mining outside of BEAN
const OUTBOUND: Integration[] = [
  {
    id: 'litcoin',
    name: 'Litcoin',
    tagline: 'MineBean strategy agents deployed against Litcoin. Nostradamus is live, the other four agents are queued for rollout.',
    status: 'live',
    href: '/integrations/litcoin',
    logoUrl: 'https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/4a8aa286-ccea-4e03-085e-e26ffb452400/public',
  },
  {
    id: 'nook',
    name: 'Nookplot',
    tagline: 'Nostradamus running daily challenge submissions on Nookplot. Twelve per day at the current cap, with a supply-side mining bonus stacked on top.',
    status: 'live',
    href: '/integrations/nook',
    logoUrl: 'https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/bdd3d3ce-60db-4acd-0cb5-1a577ff86400/public',
  },
]

// ── Status badge ──────────────────────────────────────────────────────────

function StatusDot({ status, activeBadge }: { status: 'live' | 'soon'; activeBadge?: boolean }) {
  if (status === 'live' && !activeBadge) return null
  const color = status === 'live' ? '#00C853' : 'rgba(255,255,255,0.25)'
  const label = status === 'live' ? 'ACTIVELY MINING' : 'COMING SOON'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 10,
      color,
      fontWeight: 700,
      fontFamily: "'Space Mono', monospace",
      letterSpacing: '0.1em',
    }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        flexShrink: 0,
        ...(status === 'live'
          ? { animation: 'pulse-glow 2s ease-in-out infinite', boxShadow: `0 0 10px ${color}` }
          : {}),
      }} />
      {label}
    </span>
  )
}

// ── Integration card ──────────────────────────────────────────────────────

function IntegrationCard({ integration }: { integration: Integration }) {
  const [hovered, setHovered] = useState(false)
  const isLive = integration.status === 'live'
  const isClickable = !!integration.href

  const card = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...s.integrationCard,
        borderColor: isLive
          ? (hovered ? 'rgba(0,82,255,0.55)' : 'rgba(0,82,255,0.28)')
          : (hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'),
        background: isLive
          ? (hovered
              ? 'linear-gradient(180deg, rgba(0,82,255,0.1) 0%, rgba(0,82,255,0.02) 100%)'
              : 'linear-gradient(180deg, rgba(0,82,255,0.06) 0%, rgba(0,82,255,0.01) 100%)')
          : (hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)'),
        opacity: isLive ? 1 : 0.85,
        cursor: isClickable ? 'pointer' : 'default',
        transform: hovered && isClickable ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: isLive && hovered
          ? '0 12px 40px rgba(0,82,255,0.18), inset 0 1px 0 rgba(150,200,255,0.08)'
          : isLive
            ? 'inset 0 1px 0 rgba(150,200,255,0.05)'
            : 'none',
      }}
    >
      <div style={s.integrationCardTop}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={integration.logoUrl}
          alt={`${integration.name} logo`}
          style={{
            ...s.logoImage,
            opacity: isLive ? 1 : 0.7,
            filter: isLive ? 'none' : 'saturate(0.8)',
          }}
        />
        <StatusDot status={integration.status} activeBadge={integration.activeBadge} />
      </div>
      <div style={s.integrationName}>{integration.name}</div>
      <div style={s.integrationTagline}>{integration.tagline}</div>
      {isClickable && (
        <div style={{
          ...s.integrationCardCta,
          color: hovered ? '#fff' : 'rgba(255,255,255,0.4)',
        }}>
          {isLive ? 'View dashboard' : 'Preview integration'}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      )}
    </div>
  )

  if (integration.href) {
    return (
      <Link
        href={integration.href}
        style={{ textDecoration: 'none', color: 'inherit', display: 'flex', height: '100%' }}
      >
        {card}
      </Link>
    )
  }
  return card
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!mounted) return null

  return (
    <div style={s.page}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <AgentHeader currentPage="integrations" isMobile={isMobile} />

      <main style={isMobile ? s.mainMobile : s.main}>
        {/* Hero */}
        <section style={s.hero}>
          <h1 style={isMobile ? { ...s.heroTitle, fontSize: 32 } : s.heroTitle}>
            MineBean agents across the ecosystem
          </h1>
          <p style={isMobile ? { ...s.heroSub, fontSize: 14 } : s.heroSub}>
            Frameworks, runtimes, and protocols that plug into MineBean. Click any integration to see your position and parallel mining activity.
          </p>
        </section>

        {/* Section 1: Frameworks for mining BEAN */}
        <section style={s.section}>
          <h2 style={s.sectionLabel}>Frameworks</h2>
          <p style={s.sectionSub}>Runtimes and infra that let anyone mine BEAN.</p>
          <div style={isMobile ? s.integrationsGridMobile : s.integrationsGrid}>
            {INTEGRATIONS.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </section>

        {/* Premium divider — bean centerpiece */}
        <div style={s.dividerWrap} aria-hidden="true">
          <div style={s.dividerGlow} />
          <div style={s.dividerLineLeft} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/b2af3765-f7ce-4727-063f-01b23ac8a500/public"
            alt=""
            style={s.dividerBean}
          />
          <div style={s.dividerLineRight} />
        </div>

        {/* Section 2: MineBean agents mining other protocols */}
        <section style={s.section}>
          <h2 style={s.sectionLabel}>MineBean agents abroad</h2>
          <p style={s.sectionSub}>Our own strategy agents deployed against other protocols.</p>
          <div style={isMobile ? s.integrationsGridMobile : s.integrationsGrid}>
            {OUTBOUND.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </section>
      </main>

      {isMobile && <AgentBottomNav currentPage="integrations" />}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const s: { [key: string]: React.CSSProperties } = {
  page: {
    fontFamily: "'Inter', -apple-system, sans-serif",
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'transparent',
  },

  main: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '56px 60px 80px',
    flex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 40,
  },

  mainMobile: {
    padding: '28px 16px 120px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },

  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    maxWidth: 760,
    margin: '20px auto 56px',
    textAlign: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 46,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.1,
    margin: 0,
    letterSpacing: '-0.025em',
  },
  heroSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.6,
    margin: 0,
    maxWidth: 620,
  },

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },

  integrationsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 18,
  },
  integrationsGridMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
  },
  integrationCard: {
    border: '1px solid',
    borderRadius: 20,
    padding: 28,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    transition: 'all 0.25s ease',
    minHeight: 220,
    width: '100%',
    flex: 1,
  },
  integrationCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  integrationName: {
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.01em',
    lineHeight: 1.1,
  },
  integrationTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.6,
    flex: 1,
  },
  integrationCardCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    transition: 'color 0.2s ease',
    marginTop: 4,
  },

  // Logo image
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    objectFit: 'cover',
    flexShrink: 0,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },

  // Section labels
  sectionLabel: {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    letterSpacing: '-0.015em',
  },
  sectionSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.55,
    margin: '2px 0 14px 0',
    maxWidth: 620,
  },

  // Premium divider: hairline + center diamond + tight center glow
  dividerWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'min(640px, 72%)',
    margin: '44px auto 28px',
    gap: 10,
  },
  dividerGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 220,
    height: 60,
    background: 'radial-gradient(ellipse at center, rgba(56,128,255,0.28) 0%, rgba(56,128,255,0.12) 35%, rgba(56,128,255,0) 70%)',
    pointerEvents: 'none',
    filter: 'blur(2px)',
  },
  dividerLineLeft: {
    flex: 1,
    height: 1,
    background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(120,160,255,0.18) 35%, rgba(120,160,255,0.55) 100%)',
    borderRadius: 999,
  },
  dividerLineRight: {
    flex: 1,
    height: 1,
    background: 'linear-gradient(90deg, rgba(120,160,255,0.55) 0%, rgba(120,160,255,0.18) 65%, rgba(255,255,255,0) 100%)',
    borderRadius: 999,
  },
  dividerBean: {
    position: 'relative',
    width: 28,
    height: 28,
    objectFit: 'contain',
    flexShrink: 0,
    filter: 'drop-shadow(0 0 10px rgba(56,128,255,0.55)) drop-shadow(0 0 22px rgba(56,128,255,0.32))',
  },
}
