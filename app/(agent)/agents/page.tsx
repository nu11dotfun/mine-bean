'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import AgentHeader from '@/components/AgentHeader'
import AgentBottomNav from '@/components/AgentBottomNav'
import { AGENTS } from '@/lib/agents'

export default function AgentsPage() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={s.page}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes agentGlowPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        .agent-row { position: relative; transition: transform 0.35s cubic-bezier(0.4,0,0.2,1), background 0.35s ease, box-shadow 0.35s ease; }
        .agent-row::before {
          content: ''; position: absolute; left: 0; top: 14px; bottom: 14px; width: 2px;
          background: linear-gradient(180deg, transparent, #0052FF 50%, transparent);
          box-shadow: 0 0 8px rgba(0,82,255,0.9), 0 0 18px rgba(0,82,255,0.5);
          opacity: 0; transition: opacity 0.35s ease;
        }
        .agent-row:hover {
          transform: translateX(12px);
          background: linear-gradient(90deg, rgba(0,82,255,0.12) 0%, rgba(0,82,255,0.03) 45%, transparent 80%);
          box-shadow: inset 0 0 40px rgba(0,82,255,0.06);
        }
        .agent-row:hover::before { opacity: 1; }
        .agent-row:hover .agent-row-arrow { transform: translateX(6px); color: #4D9BFF; }
        .agent-row:hover .agent-row-num { color: #3D8BFF; }
        .agent-row:hover .agent-row-title { text-shadow: 0 0 24px rgba(0,82,255,0.45); }
        .agent-row-arrow, .agent-row-num, .agent-row-title { transition: transform 0.35s ease, color 0.35s ease, text-shadow 0.35s ease; }
      ` }} />

      {/* Ambient blue glow. Clipped to the viewport edges (not the content column) so there is no visible seam. */}
      <div style={s.glowLayer} aria-hidden="true">
        <div style={s.glow1} />
        <div style={s.glow2} />
      </div>

      <AgentHeader currentPage="agents" />

      <main style={isMobile ? s.mainMobile : s.main}>
        <div style={s.intro}>
          <h1 style={isMobile ? { ...s.h1, fontSize: 30 } : s.h1}>Agents</h1>
          <p style={s.sub}>Autonomous mining agents, each running its own strategy live on-chain.</p>
        </div>

        <div style={s.list}>
          {AGENTS.map((a, i) => {
            const num = String(i + 1).padStart(2, '0')
            const isDolphin = a.apiAgentId === 'dolphin-nostradamus'
            return (
              <Link key={a.id} href={`/agents/${a.id}`} className="agent-row" style={isMobile ? s.rowMobile : s.row}>
                <span className="agent-row-num" style={s.num}>{num}</span>
                <div style={s.rowMain}>
                  <div style={s.titleWrap}>
                    <span className="agent-row-title" style={isMobile ? { ...s.title, fontSize: 22 } : s.title}>{a.name}</span>
                    {isDolphin && <span style={s.badge}>powered by @dphnAI</span>}
                  </div>
                  <p style={s.desc}>{a.strategy}</p>
                </div>
                <span className="agent-row-arrow" style={s.arrow} aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </Link>
            )
          })}
        </div>
      </main>

      {isMobile && <AgentBottomNav currentPage="agents" />}
    </div>
  )
}

const s: { [key: string]: React.CSSProperties } = {
  page: { fontFamily: "'Inter', -apple-system, sans-serif", minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent', position: 'relative', zIndex: 0 },

  glowLayer: { position: 'absolute', inset: 0, overflow: 'hidden', zIndex: -1, pointerEvents: 'none' },
  glow1: { position: 'absolute', top: 30, left: 'calc(50% - 660px)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,82,255,0.16) 0%, rgba(0,82,255,0.05) 40%, transparent 70%)', filter: 'blur(30px)', animation: 'agentGlowPulse 7s ease-in-out infinite' },
  glow2: { position: 'absolute', top: 480, left: 'calc(50% + 160px)', width: 540, height: 540, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,82,255,0.10) 0%, transparent 65%)', filter: 'blur(40px)', animation: 'agentGlowPulse 9s ease-in-out infinite' },

  main: { maxWidth: 1100, margin: '0 auto', padding: '40px 60px 60px', flex: 1, width: '100%' },
  mainMobile: { padding: '24px 16px 90px', flex: 1, width: '100%' },

  intro: { marginBottom: 28 },
  h1: { fontSize: 40, fontWeight: 700, color: '#fff', margin: 0 },
  sub: { fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 8 },

  list: { display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.08)' },

  row: { display: 'flex', alignItems: 'center', gap: 28, padding: '30px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none', cursor: 'pointer', willChange: 'transform' },
  rowMobile: { display: 'flex', alignItems: 'center', gap: 14, padding: '22px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none', cursor: 'pointer', willChange: 'transform' },

  num: { fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: "'Space Mono', monospace", flexShrink: 0, width: 26 },

  rowMain: { flex: 1, minWidth: 0 },
  titleWrap: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 30, fontWeight: 700, color: '#fff' },
  desc: { fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginTop: 8, maxWidth: 560 },

  badge: { fontSize: 11, color: '#9DC2FF', fontFamily: 'ui-monospace, monospace', letterSpacing: 0.5, padding: '3px 9px', borderRadius: 6, background: 'rgba(0,82,255,0.12)', border: '1px solid rgba(0,82,255,0.35)' },

  arrow: { color: 'rgba(255,255,255,0.3)', flexShrink: 0, display: 'flex', alignItems: 'center' },
}
