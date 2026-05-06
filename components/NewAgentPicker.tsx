'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CustomAgent } from '@/lib/customAgents'

// Centered modal that lets the user pick a base strategy before opening the
// drawer. Required because AgentConfigDrawer needs an `agentId` on mount and
// has no blank mode (plan v3 fix #2).
//
// Rendered via React portal to document.body so parent stacking contexts
// (transforms, filters, position:relative cards) can't trap the modal behind
// surrounding UI.

interface NewAgentPickerProps {
  isOpen: boolean
  onClose: () => void
  onPick: (baseAgent: CustomAgent['baseAgent']) => void
}

const OPTIONS: Array<{ id: CustomAgent['baseAgent']; name: string; tagline: string }> = [
  { id: 'sniper',         name: 'Sniper',         tagline: 'Fires late in the round when ROI is above your target.' },
  { id: 'anti-winner',    name: 'Anti-Winner',    tagline: 'Skips recent winning blocks, deploys after grid develops.' },
  { id: 'beanpot-hunter', name: 'Beanpot Hunter', tagline: 'Only fires when the beanpot has built up past your threshold.' },
]

export default function NewAgentPicker({ isOpen, onClose, onPick }: NewAgentPickerProps) {
  const [hovered, setHovered] = useState<CustomAgent['baseAgent'] | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Esc closes the modal.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Reset hover state on close so reopening doesn't show a stale highlight
  // (the component doesn't unmount, so useState would otherwise persist).
  useEffect(() => {
    if (!isOpen) setHovered(null)
  }, [isOpen])

  // Lock body scroll while open so the page underneath doesn't jump.
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0,
        zIndex: 2147483000, // sit above any app-level stacking context
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(8, 10, 18, 0.72)',
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        }}
      />

      {/* Modal card — glassmorphism to match site language */}
      <div
        role="dialog"
        aria-label="Pick a base strategy"
        style={{
          position: 'relative',
          width: 'min(440px, 100%)',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          background:
            'linear-gradient(180deg, rgba(28, 32, 50, 0.78) 0%, rgba(18, 20, 32, 0.82) 100%)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow:
            '0 24px 48px rgba(0, 0, 0, 0.5),' +
            ' 0 0 0 1px rgba(255, 255, 255, 0.04) inset,' +
            ' 0 1px 0 rgba(255, 255, 255, 0.06) inset',
          fontFamily: "'Space Mono', monospace",
        }}
      >
        <div style={{
          padding: '20px 22px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <div style={{
              fontSize: 10, color: 'rgba(0, 82, 255, 0.95)',
              letterSpacing: '0.14em', fontWeight: 700, marginBottom: 6,
            }}>
              NEW AGENT
            </div>
            <div style={{
              fontSize: 16, color: '#fff', fontWeight: 700, letterSpacing: '0.01em',
              lineHeight: 1.3,
            }}>
              Pick a base strategy
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30, height: 30,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.65)',
              fontSize: 13, fontFamily: "'Space Mono', monospace",
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
          >✕</button>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPTIONS.map((opt) => {
            const isHover = hovered === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => onPick(opt.id)}
                onMouseEnter={() => setHovered(opt.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  textAlign: 'left' as const,
                  background: isHover
                    ? 'rgba(0, 82, 255, 0.1)'
                    : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${isHover ? 'rgba(0, 82, 255, 0.5)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12,
                  color: '#fff',
                  fontFamily: "'Space Mono', monospace",
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  boxShadow: isHover
                    ? '0 0 0 1px rgba(0, 82, 255, 0.18), 0 8px 24px rgba(0, 82, 255, 0.12)'
                    : 'none',
                }}
              >
                <div style={{
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
                  marginBottom: 4,
                  color: isHover ? '#4a9fff' : '#fff',
                  transition: 'color 0.15s ease',
                }}>
                  {opt.name}
                </div>
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.55)',
                  letterSpacing: '0.02em', lineHeight: 1.4,
                }}>
                  {opt.tagline}
                </div>
              </button>
            )
          })}
        </div>

        <div style={{
          padding: '8px 22px 18px',
          fontSize: 10, color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.04em', lineHeight: 1.5,
        }}>
          You can tune all parameters and save it as a named agent on the next screen.
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
