'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAccount, useBalance, useReadContract, useSignMessage } from 'wagmi'
import BeanLogo from './BeanLogo'
import { apiFetch } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { CONTRACTS } from '@/lib/contracts'
import { useUserData } from '@/lib/UserDataContext'

// ── Types ─────────────────────────────────────────────────

interface DeployEntry {
  roundId: number
  totalAmount: string
  blockMask: string
  txHash: string
  isAutoMine: boolean
  timestamp: string
  roundResult: {
    settled: boolean
    wonWinningBlock: boolean
    beanpotHit: boolean
    winningBlock: number
    ethWon: string
    ethWonFormatted: string
    beanWon: string
    beanWonFormatted: string
    pnl: string
  }
}

interface HistoryTotals {
  totalETHWonFormatted: string
  totalBEANWonFormatted: string
  totalETHDeployedFormatted: string
  totalPNL: string
  beanPriceEth: string
  roundsPlayed: number
  roundsWon: number
}

interface Round {
  id: number; block: number; yourBlocks: number[]; deployed: number; won: number;
  netPnl: number; pctChange: number; beansEarned: number; beanpotAmount: number | null;
  isWin: boolean; isBeanpot: boolean; timestamp: string;
}

interface ProfileData {
  username: string | null; bio: string | null; pfpUrl: string | null; bannerUrl: string | null;
}

interface RewardsData {
  pendingETH: string
  pendingETHFormatted: string
  pendingBEAN: {
    unroasted: string; unroastedFormatted: string
    roasted: string; roastedFormatted: string
    gross: string; grossFormatted: string
    fee: string; feeFormatted: string
    net: string; netFormatted: string
  }
  uncheckpointedRound: string
}

interface StakeInfo {
  balance: string
  balanceFormatted: string
  pendingRewards: string
  pendingRewardsFormatted: string
}


const ROWS_PER_PAGE = 8

function getRelativeTime(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function decodeBlockMask(mask: string): number[] {
  const n = BigInt(mask)
  const blocks: number[] = []
  for (let i = 0; i < 25; i++) {
    if ((n >> BigInt(i)) & BigInt(1)) blocks.push(i)
  }
  return blocks
}

function entryToRound(entry: DeployEntry, beanPriceEth: number): Round {
  const deployed = parseFloat(entry.totalAmount) / 1e18
  const ethPnl = parseFloat(entry.roundResult.pnl) || 0
  const beansEarned = parseFloat(entry.roundResult.beanWonFormatted) || 0
  const beanValueEth = beansEarned * beanPriceEth
  const truePnl = ethPnl + beanValueEth
  const pctChange = deployed > 0 ? Math.round((truePnl / deployed) * 10000) / 100 : 0
  return {
    id: entry.roundId,
    block: entry.roundResult.winningBlock + 1,
    yourBlocks: decodeBlockMask(entry.blockMask).map(b => b + 1),
    deployed,
    won: parseFloat(entry.roundResult.ethWonFormatted) || 0,
    netPnl: truePnl,
    pctChange,
    beansEarned,
    beanpotAmount: entry.roundResult.beanpotHit ? beansEarned : null,
    isWin: decodeBlockMask(entry.blockMask).includes(entry.roundResult.winningBlock),
    isBeanpot: entry.roundResult.beanpotHit,
    timestamp: getRelativeTime(entry.timestamp),
  }
}

// ── Icons ─────────────────────────────────────────────────

const XIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)
const DiscordIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
    <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963a.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
  </svg>
)
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)
const CheckIcon = ({ color = 'currentColor' }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

// ── PnL Card Modal ────────────────────────────────────────

function PnlCard({ round, pfpUrl, username, onClose, ethPriceUsd }: { round: Round; pfpUrl: string | null; username: string; onClose: () => void; ethPriceUsd: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const ct = round.isBeanpot ? 'beanpot' : round.isWin ? 'win' : 'loss'
  const color = round.isBeanpot ? '#FFD700' : round.isWin ? '#00C853' : '#FF4444'
  const glow = round.isBeanpot ? 'rgba(255,215,0,0.3)' : round.isWin ? 'rgba(0,200,83,0.15)' : 'rgba(255,50,50,0.08)'
  const sub = round.isBeanpot ? 'rgba(255,215,0,0.7)' : round.isWin ? 'rgba(0,200,83,0.7)' : 'rgba(255,68,68,0.6)'
  const bgs: Record<string, string> = {
    win: 'radial-gradient(ellipse 70% 60% at 75% 15%, rgba(0,200,83,0.2), transparent), radial-gradient(ellipse 50% 40% at 20% 85%, rgba(0,200,83,0.06), transparent), #050810',
    loss: 'radial-gradient(ellipse 60% 50% at 75% 20%, rgba(255,50,50,0.1), transparent), radial-gradient(ellipse 40% 30% at 20% 80%, rgba(255,50,50,0.04), transparent), #050810',
    beanpot: 'radial-gradient(ellipse 80% 70% at 70% 10%, rgba(255,180,0,0.25), transparent), radial-gradient(ellipse 50% 40% at 20% 90%, rgba(255,215,0,0.12), transparent), #050810',
  }
  const heroText = round.isBeanpot ? `+${round.beanpotAmount?.toFixed(3)}` : `${round.pctChange >= 0 ? '+' : ''}${round.pctChange}%`

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: null, logging: false })
      const link = document.createElement('a')
      link.download = `bean-round-${round.id}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) { console.error(err) }
    setDownloading(false)
  }

  const handleShare = async () => {
    const text = round.isBeanpot
      ? `Just hit the BEANPOT for ${round.beanpotAmount?.toFixed(3)} $BEAN on @minebean_`
      : round.isWin
      ? `${round.pctChange >= 0 ? '+' : ''}${round.pctChange}% on Round #${round.id} - @minebean_ is live on Base`
      : `Round #${round.id} on @minebean_ - the grind continues`
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://minebean.com')}`
    // Copy card image to clipboard so user can paste it into the tweet
    if (cardRef.current) {
      try {
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: null, logging: false })
        canvas.toBlob(async blob => {
          if (blob) {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            } catch {}
          }
        }, 'image/png')
      } catch {}
    }
    window.open(tweetUrl, '_blank')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: '100%' }}>

        {/* Card */}
        <div ref={cardRef} style={{ width: 1200, maxWidth: '100%', aspectRatio: '1200/630', borderRadius: 24, position: 'relative', overflow: 'hidden', display: 'flex', background: bgs[ct], border: ct === 'beanpot' ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.06)', boxShadow: `0 0 100px ${glow}, 0 0 40px ${glow}` }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.018, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '80px 80px', zIndex: 0 }} />
          <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', padding: '48px 56px', gap: 48, fontFamily: "'Inter', -apple-system, sans-serif" }}>

            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg,#0052FF,#3B7BFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(0,82,255,0.3)', overflow: 'hidden', flexShrink: 0 }}>
                    {pfpUrl ? <img src={pfpUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <BeanLogo size={28} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em' }}>
                      <span style={{ color: '#fff' }}>BE</span><span style={{ color: '#0052FF' }}>AN</span><span style={{ color: '#fff' }}>.</span>
                    </span>
                    {username && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace" }}>@{username}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 2, padding: '8px 20px', borderRadius: 50, background: ct === 'beanpot' ? 'rgba(255,215,0,0.1)' : ct === 'win' ? 'rgba(0,200,83,0.1)' : 'rgba(255,68,68,0.08)', border: `1px solid ${ct === 'beanpot' ? 'rgba(255,215,0,0.25)' : ct === 'win' ? 'rgba(0,200,83,0.2)' : 'rgba(255,68,68,0.15)'}`, color }}>
                  {round.isBeanpot ? '☕ BEANPOT' : round.isWin ? '↑ WIN' : '↓ LOSS'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: 2 }}>Round #{round.id} · Block #{round.block}</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 'clamp(56px,8vw,96px)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em', color, textShadow: `0 0 80px ${glow}, 0 0 40px ${glow}` }}>
                  {heroText}{round.isBeanpot && <span style={{ fontSize: 'clamp(28px,4vw,48px)', marginLeft: 12, opacity: 0.8 }}>BEAN</span>}
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: sub }}>
                  {round.isBeanpot ? `+${round.netPnl.toFixed(4)} ETH profit` : `${round.netPnl >= 0 ? '+' : ''}${round.netPnl.toFixed(4)} ETH`}
                </div>
                {ethPriceUsd > 0 && (
                  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: "'Space Mono', monospace", color: 'rgba(255,255,255,0.35)' }}>
                    {round.netPnl >= 0 ? '+' : ''}{`$${(round.netPnl * ethPriceUsd).toFixed(2)} USD`}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 36 }}>
                  {([
                    ['Deployed', `Ξ ${round.deployed.toFixed(4)}`, '#fff'],
                    ['Won', `Ξ ${round.won.toFixed(4)}`, round.isWin ? '#00C853' : '#FF4444'],
                    ...(round.beansEarned > 0 ? [[round.isBeanpot ? 'Beanpot' : 'BEAN', `${round.beansEarned.toFixed(3)}`, round.isBeanpot ? '#FFD700' : '#3B7BFF']] : []),
                  ] as [string, string, string][]).map(([label, val, c], i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: 1 }}>{label}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: c, fontFamily: "'Space Mono', monospace" }}>{val}</span>
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', fontWeight: 600 }}>minebean.com</span>
              </div>
            </div>

            {/* Right: glass stats panel */}
            <div style={{ width: 300, flexShrink: 0, background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: '28px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 8 }}>Round Details</div>
              {([
                ['Round', `#${round.id}`],
                ['Winner', `Block #${round.block}`],
                ['Deployed', `Ξ ${round.deployed.toFixed(4)}`],
                ['Won', `Ξ ${round.won.toFixed(4)}`],
                ...(round.beansEarned > 0 ? [[round.isBeanpot ? 'Beanpot' : 'BEAN', `${round.beansEarned.toFixed(3)}`]] : []),
              ] as [string, string][]).map(([label, value], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: label === 'Won' ? (round.isWin ? '#00C853' : '#FF4444') : label === 'Beanpot' ? '#FFD700' : label === 'BEAN' ? '#3B7BFF' : '#fff' }}>{value}</span>
                </div>
              ))}
              {/* Your Picks - stacked with wrapping chips */}
              <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 8 }}>Your Picks</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {round.yourBlocks.map(b => (
                    <span key={b} style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: b === round.block ? '#00C853' : 'rgba(255,255,255,0.6)', background: b === round.block ? 'rgba(0,200,83,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${b === round.block ? 'rgba(0,200,83,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 5, padding: '2px 6px' }}>#{b}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleDownload} disabled={downloading} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 50, padding: '14px 28px', fontSize: 14, fontWeight: 700, cursor: downloading ? 'wait' : 'pointer', opacity: downloading ? 0.6 : 1, fontFamily: "'Inter', sans-serif" }}>
            <DownloadIcon /> {downloading ? 'Saving...' : 'Save Image'}
          </button>
          <button onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', color: '#000', border: 'none', borderRadius: 50, padding: '14px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
            <XIcon size={14} /> Share to X
          </button>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 50, padding: '14px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export default function ProfilePage() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { patchProfile } = useUserData()

  // Profile state
  const [username, setUsername] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [bio, setBio] = useState('')
  const [bioInput, setBioInput] = useState('')
  const [pfpUrl, setPfpUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [isEditingBio, setIsEditingBio] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerFileInputRef = useRef<HTMLInputElement>(null)
  const [cropState, setCropState] = useState<{ src: string; type: 'pfp' | 'banner'; scale: number; ox: number; oy: number } | null>(null)
  const [pfpHovered, setPfpHovered] = useState(false)
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)
  const cropDragging = useRef(false)
  const cropDragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })

  // Social connections state
  const [discordUsername, setDiscordUsername] = useState<string | null>(null)
  const [twitterHandle, setTwitterHandle] = useState<string | null>(null)
  const [socialToast, setSocialToast] = useState<string | null>(null)

  // Round history state
  const [deployHistory, setDeployHistory] = useState<DeployEntry[]>([])
  const [historyTotals, setHistoryTotals] = useState<HistoryTotals | null>(null)
  const [expandedRound, setExpandedRound] = useState<Round | null>(null)
  const [page, setPage] = useState(0)

  // Portfolio state (from API)
  const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null)
  const [rewards, setRewards] = useState<RewardsData | null>(null)

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ETH price for USD display on PnL cards
  const [ethPriceUsd, setEthPriceUsd] = useState(0)
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT')
        const data = await res.json()
        if (data.price) setEthPriceUsd(parseFloat(data.price))
      } catch {}
    }
    fetchEthPrice()
    const interval = setInterval(fetchEthPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  // On-chain balances
  const { data: ethBalance } = useBalance({ address })
  const { data: beansBalanceRaw } = useReadContract({
    address: CONTRACTS.Bean.address,
    abi: CONTRACTS.Bean.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })
  const beansBalance = beansBalanceRaw ? Number(beansBalanceRaw) / 1e18 : 0

  // Track address for profile load (prevent re-loading on same address)
  const profileLoadedForRef = useRef<string | undefined>(undefined)

  // Fetch profile + portfolio data when address changes
  useEffect(() => {
    if (!address || profileLoadedForRef.current === address) return
    profileLoadedForRef.current = address
    const addr = address.toLowerCase()

    fetch(`/api/user/${addr}/profile`)
      .then(r => r.json())
      .then((data: ProfileData) => {
        if (data.username) { setUsername(data.username); setUsernameInput(data.username) }
        if (data.bio) { setBio(data.bio); setBioInput(data.bio) }
        // Use Supabase value if present, otherwise fall back to localStorage cache
        const pfp = data.pfpUrl || localStorage.getItem(`pfp_${addr}`)
        if (pfp) setPfpUrl(pfp)
        const banner = data.bannerUrl || localStorage.getItem(`banner_${addr}`)
        if (banner) setBannerUrl(banner)
      })
      .catch(() => {
        const pfp = localStorage.getItem(`pfp_${addr}`)
        if (pfp) setPfpUrl(pfp)
        const banner = localStorage.getItem(`banner_${addr}`)
        if (banner) setBannerUrl(banner)
      })

    apiFetch<StakeInfo>(`/api/staking/${addr}`)
      .then(data => setStakeInfo(data))
      .catch(() => {})

    apiFetch<RewardsData>(`/api/user/${addr}/rewards`)
      .then(data => setRewards(data))
      .catch(() => {})

  }, [address])

  // Fetch deploy history with round results
  useEffect(() => {
    if (!address) return
    const addr = address.toLowerCase()
    apiFetch<{ history: DeployEntry[]; totals: HistoryTotals }>(`/api/user/${addr}/history?type=deploy&limit=500`)
      .then(data => {
        if (Array.isArray(data.history)) setDeployHistory(data.history)
        if (data.totals) setHistoryTotals(data.totals)
      })
      .catch(() => {})
  }, [address])

  // Fetch social connections from Supabase
  const fetchSocial = useCallback(async (addr: string) => {
    const { data } = await supabase
      .from('social_connections')
      .select('discord_username, twitter_handle')
      .eq('wallet_address', addr.toLowerCase())
      .single()
    if (data) {
      setDiscordUsername(data.discord_username)
      setTwitterHandle(data.twitter_handle)
    }
  }, [])

  useEffect(() => {
    if (address) fetchSocial(address)
  }, [address, fetchSocial])

  // Handle OAuth redirect params (?discord=connected, ?twitter=connected, etc.)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const discord = params.get('discord')
    const twitter = params.get('twitter')
    if (discord === 'connected') {
      setSocialToast('Discord connected!')
      if (address) fetchSocial(address)
    } else if (discord === 'error') {
      setSocialToast('Discord connection failed - try again')
    }
    if (twitter === 'connected') {
      setSocialToast('X connected!')
      if (address) fetchSocial(address)
    } else if (twitter === 'error') {
      setSocialToast('X connection failed - try again')
    }
    if (discord || twitter) {
      window.history.replaceState({}, '', '/profile')
      setTimeout(() => setSocialToast(null), 4000)
    }
  }, [address, fetchSocial])

  // Clear state when wallet disconnects
  useEffect(() => {
    if (!address) {
      profileLoadedForRef.current = undefined
      setUsername(''); setUsernameInput('')
      setBio(''); setBioInput('')
      setPfpUrl(null); setBannerUrl(null)
      setStakeInfo(null); setRewards(null)
      setDeployHistory([]); setHistoryTotals(null)
      setDiscordUsername(null); setTwitterHandle(null)
    }
  }, [address])

  // Redraw crop canvas when cropState changes
  useEffect(() => {
    if (!cropState || !cropCanvasRef.current) return
    const isPfp = cropState.type === 'pfp'
    const CW = isPfp ? 280 : 420, CH = isPfp ? 280 : 140
    const canvas = cropCanvasRef.current
    canvas.width = CW; canvas.height = CH
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, CW, CH)
      const fit = Math.max(CW / img.naturalWidth, CH / img.naturalHeight)
      const ts = fit * cropState.scale
      const w = img.naturalWidth * ts, h = img.naturalHeight * ts
      ctx.drawImage(img, CW/2 - w/2 + cropState.ox, CH/2 - h/2 + cropState.oy, w, h)
      if (isPfp) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.beginPath()
        ctx.rect(0, 0, CW, CH)
        ctx.arc(CW/2, CH/2, CW/2 - 1, 0, Math.PI * 2, true)
        ctx.fill('evenodd')
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(CW/2, CH/2, CW/2 - 1, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    img.src = cropState.src
  }, [cropState])

  // Save profile to API with wallet signature
  const saveProfile = useCallback(async (fields: { username?: string; bio?: string; pfpUrl?: string | null; bannerUrl?: string | null }) => {
    if (!address) return
    setSaving(true); setSaveError(null)
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const message = `BEAN Protocol Profile Update\nAddress: ${address.toLowerCase()}\nTimestamp: ${timestamp}`
      const signature = await signMessageAsync({ message })
      const res = await fetch(`/api/user/${address.toLowerCase()}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, signature, timestamp }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to save' }))
        throw new Error(err.error || 'Failed to save')
      }
      // Patch context so WalletButton updates immediately
      const profilePatch: { username?: string; bio?: string; pfpUrl?: string | null } = {}
      if (fields.username !== undefined) profilePatch.username = fields.username
      if (fields.bio !== undefined) profilePatch.bio = fields.bio
      if (fields.pfpUrl !== undefined) profilePatch.pfpUrl = fields.pfpUrl
      patchProfile(profilePatch)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [address, signMessageAsync, patchProfile])

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { if (ev.target?.result) setCropState({ src: ev.target.result as string, type: 'banner', scale: 1, ox: 0, oy: 0 }) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handlePfpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { if (ev.target?.result) setCropState({ src: ev.target.result as string, type: 'pfp', scale: 1, ox: 0, oy: 0 }) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const confirmCrop = useCallback(() => {
    if (!cropState) return
    const isPfp = cropState.type === 'pfp'
    const CW = isPfp ? 280 : 420, CH = isPfp ? 280 : 140
    const OUT_W = isPfp ? 400 : 1500, OUT_H = isPfp ? 400 : 500
    const img = new Image()
    img.onload = () => {
      const fit = Math.max(CW / img.naturalWidth, CH / img.naturalHeight)
      const ts = fit * cropState.scale
      const dx = CW/2 - (img.naturalWidth * ts)/2 + cropState.ox
      const dy = CH/2 - (img.naturalHeight * ts)/2 + cropState.oy
      const canvas = document.createElement('canvas')
      canvas.width = OUT_W; canvas.height = OUT_H
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, -dx/ts, -dy/ts, CW/ts, CH/ts, 0, 0, OUT_W, OUT_H)
      const url = canvas.toDataURL('image/jpeg', 0.92)
      const addr = address?.toLowerCase()
      if (isPfp) {
        setPfpUrl(url)
        if (addr) localStorage.setItem(`pfp_${addr}`, url)
        saveProfile({ pfpUrl: url })
      } else {
        setBannerUrl(url)
        if (addr) localStorage.setItem(`banner_${addr}`, url)
        saveProfile({ bannerUrl: url })
      }
      setCropState(null)
    }
    img.src = cropState.src
  }, [cropState, saveProfile, address])

  const handleCropMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    cropDragging.current = true
    cropDragStart.current = { x: e.clientX, y: e.clientY, ox: cropState?.ox ?? 0, oy: cropState?.oy ?? 0 }
    e.preventDefault()
  }
  const handleCropMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropDragging.current) return
    const dx = e.clientX - cropDragStart.current.x
    const dy = e.clientY - cropDragStart.current.y
    setCropState(s => s ? { ...s, ox: cropDragStart.current.ox + dx, oy: cropDragStart.current.oy + dy } : s)
  }
  const handleCropMouseUp = () => { cropDragging.current = false }

  const handleSaveUsername = () => {
    setUsername(usernameInput)
    setIsEditingUsername(false)
    saveProfile({ username: usernameInput })
  }

  const handleSaveBio = () => {
    setBio(bioInput)
    setIsEditingBio(false)
    saveProfile({ bio: bioInput })
  }

  // Portfolio calculations
  const stakedBalance = stakeInfo ? parseFloat(stakeInfo.balanceFormatted) : 0
  const roastedBalance = rewards ? parseFloat(rewards.pendingBEAN.roastedFormatted) : 0
  const unroastedBalance = rewards ? parseFloat(rewards.pendingBEAN.unroastedFormatted) : 0
  const portfolio = { wallet: beansBalance, staked: stakedBalance, roasted: roastedBalance, unroasted: unroastedBalance }
  const total = portfolio.wallet + portfolio.staked + portfolio.roasted + portfolio.unroasted

  // Round history stats (from backend totals)
  const beanPriceEth = historyTotals ? parseFloat(historyTotals.beanPriceEth) || 0 : 0
  const rounds = deployHistory.map(e => entryToRound(e, beanPriceEth))
  const totalPnl = historyTotals ? parseFloat(historyTotals.totalPNL) || 0 : 0
  const totalBean = historyTotals ? parseFloat(historyTotals.totalBEANWonFormatted) || 0 : 0
  const winRate = historyTotals && historyTotals.roundsPlayed > 0
    ? Math.round((historyTotals.roundsWon / historyTotals.roundsPlayed) * 100) : 0
  const totalPages = Math.ceil(rounds.length / ROWS_PER_PAGE)
  const pageRounds = rounds.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)

  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''

  const s = {
    card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: 24 } as React.CSSProperties,
    label: { fontSize: 11, color: '#999', display: 'block', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
    fieldVal: { fontSize: 15, color: '#fff' } as React.CSSProperties,
    editBtn: { background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } as React.CSSProperties,
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties,
    input: { flex: 1, background: 'transparent', border: '1px solid #444', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none' } as React.CSSProperties,
    saveBtn: { background: '#0052FF', border: 'none', color: '#fff', fontWeight: 600, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' as const } as React.CSSProperties,
    divider: { height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0' } as React.CSSProperties,
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {saveError && (
        <div style={{ margin: isMobile ? '16px 16px 0' : '16px 40px 0', background: '#2a1515', border: '1px solid #4a2020', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ff6b6b', fontSize: 13 }}>
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
        </div>
      )}

      {socialToast && (() => {
        const isErr = socialToast.includes('failed')
        return (
          <div style={{ margin: isMobile ? '16px 16px 0' : '16px 40px 0', background: isErr ? '#2a1515' : '#0d1f0d', border: `1px solid ${isErr ? '#4a2020' : '#1a3a1a'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: isErr ? '#ff6b6b' : '#4ade80', fontSize: 13 }}>
            <span>{socialToast}</span>
            <button onClick={() => setSocialToast(null)} style={{ background: 'transparent', border: 'none', color: isErr ? '#ff6b6b' : '#4ade80', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
          </div>
        )
      })()}

      {!isConnected ? (
        /* ── Not connected ─────────────────────────────────────── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: '48px 56px', maxWidth: 380, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,82,255,0.1)', border: '1px solid rgba(0,82,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(0,82,255,0.15)' }}>
              <BeanLogo size={32} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>Connect Your Wallet</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.6 }}>Connect a wallet to view your BEAN profile and round history.</p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Connected ─────────────────────────────────────────── */
        <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 32, padding: isMobile ? '16px 16px 100px' : '28px 40px 32px', width: '100%', alignItems: 'flex-start' }}>

          {/* ── Left: Profile + Portfolio ── */}
          <div style={{ width: isMobile ? '100%' : 480, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Profile Card */}
            <div style={{ ...s.card, padding: 0 }}>
              <div
                onClick={() => bannerFileInputRef.current?.click()}
                onMouseEnter={e => { const ov = (e.currentTarget as HTMLDivElement).querySelector('.banner-ov') as HTMLElement; if (ov) ov.style.opacity = '1' }}
                onMouseLeave={e => { const ov = (e.currentTarget as HTMLDivElement).querySelector('.banner-ov') as HTMLElement; if (ov) ov.style.opacity = '0' }}
                style={{ height: 110, borderRadius: '20px 20px 0 0', borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
              >
                {bannerUrl
                  ? <img src={bannerUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(0,82,255,0.18) 0%, rgba(59,123,255,0.05) 60%, rgba(0,0,0,0) 100%)' }} />
                }
                <div className="banner-ov" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s', pointerEvents: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Upload Banner
                  </div>
                </div>
                <input ref={bannerFileInputRef} type="file" accept="image/*" hidden onChange={handleBannerUpload} />
              </div>
              <div style={{ padding: '0 24px 14px' }}>
              {/* PFP */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: -28, marginBottom: 6 }}>
                <div
                  onMouseEnter={() => setPfpHovered(true)}
                  onMouseLeave={() => setPfpHovered(false)}
                  style={{ position: 'relative', width: 76, height: 76 }}
                >
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{ position: 'relative', width: 76, height: 76, borderRadius: '50%', cursor: 'pointer', overflow: 'hidden', border: '3px solid #080910', boxShadow: '0 0 0 1px rgba(0,82,255,0.3), 0 8px 24px rgba(0,0,0,0.5)' }}
                  >
                    {pfpUrl
                      ? <img src={pfpUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </div>
                    }
                    {pfpUrl && pfpHovered && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handlePfpUpload} />
                  </div>
                  {pfpUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (saving) return
                        setPfpUrl(null)
                        const addr = address?.toLowerCase()
                        if (addr) localStorage.removeItem(`pfp_${addr}`)
                        saveProfile({ pfpUrl: null })
                      }}
                      title="Remove profile picture"
                      aria-label="Remove profile picture"
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.88)',
                        border: '1.5px solid #fff',
                        color: '#fff',
                        fontSize: 12,
                        lineHeight: 1,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        zIndex: 2,
                        opacity: saving ? 0.5 : 1,
                        fontFamily: 'inherit',
                    }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Username */}
              <div style={{ marginBottom: 8 }}>
                <label style={s.label}>Username</label>
                {isEditingUsername ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={usernameInput} onChange={e => setUsernameInput(e.target.value)} autoFocus style={s.input} maxLength={20} />
                    <button onClick={handleSaveUsername} disabled={saving} style={{ ...s.saveBtn, ...(saving ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}>{saving ? '...' : 'Save'}</button>
                  </div>
                ) : (
                  <div style={s.row}>
                    <span style={s.fieldVal}>{username || 'Not set'}</span>
                    <button onClick={() => setIsEditingUsername(true)} style={s.editBtn}><EditIcon /></button>
                  </div>
                )}
              </div>

              {/* Bio */}
              <div style={{ marginBottom: 8 }}>
                <label style={s.label}>Bio</label>
                {isEditingBio ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <textarea value={bioInput} onChange={e => setBioInput(e.target.value)} autoFocus maxLength={160} rows={3} style={{ ...s.input, resize: 'none', minHeight: 72 }} />
                    <button onClick={handleSaveBio} disabled={saving} style={{ ...s.saveBtn, ...(saving ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}>{saving ? '...' : 'Save'}</button>
                  </div>
                ) : (
                  <div style={s.row}>
                    <span style={{ ...s.fieldVal, ...(!bio ? { fontStyle: 'italic', color: '#666' } : {}) }}>{bio || 'Not set'}</span>
                    <button onClick={() => setIsEditingBio(true)} style={s.editBtn}><EditIcon /></button>
                  </div>
                )}
              </div>

              {/* Address */}
              <div>
                <label style={s.label}>Address</label>
                <div style={s.row}>
                  <span style={{ ...s.fieldVal, fontFamily: 'monospace' }}>{truncatedAddress}</span>
                  <button onClick={() => { navigator.clipboard.writeText(address!); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={s.editBtn}>
                    {copied ? <CheckIcon color="#0052FF" /> : <CopyIcon />}
                  </button>
                </div>
              </div>

              <div style={s.divider} />

              {/* Socials */}
              <div style={{ marginTop: 2 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {discordUsername ? (
                    <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(88,101,242,0.1)', border: '1px solid rgba(88,101,242,0.2)', borderRadius: 10 }}>
                      <DiscordIcon size={16} />
                      <span style={{ fontSize: 14, color: '#fff' }}>@{discordUsername}</span>
                      <button onClick={async () => {
                        await fetch('/api/auth/discord/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: address }) })
                        setDiscordUsername(null)
                        setSocialToast('Discord disconnected')
                      }} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  ) : (
                    <a href={`/api/auth/discord?wallet=${address}`} style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(88,101,242,0.08)', border: '1px solid rgba(88,101,242,0.15)', borderRadius: 10, textDecoration: 'none', color: '#fff', fontSize: 14, fontWeight: 500 }}>
                      <DiscordIcon size={16} />
                      Connect Discord
                    </a>
                  )}

                  {twitterHandle ? (
                    <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}>
                      <XIcon size={16} />
                      <span style={{ fontSize: 14, color: '#fff' }}>@{twitterHandle}</span>
                      <button onClick={async () => {
                        await fetch('/api/auth/twitter/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: address }) })
                        setTwitterHandle(null)
                        setSocialToast('X disconnected')
                      }} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  ) : (
                    <a href={`/api/auth/twitter?wallet=${address}`} style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, textDecoration: 'none', color: '#fff', fontSize: 14, fontWeight: 500 }}>
                      <XIcon size={16} />
                      Connect X
                    </a>
                  )}
                </div>
              </div>
              </div>
            </div>

            {/* Portfolio Card */}
            <div style={{ ...s.card, padding: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 10px' }}>Portfolio</h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
                <span style={{ fontSize: 14, color: '#bbb' }}>ETH Balance</span>
                <span style={{ fontSize: 14, color: '#fff', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/f9461cf2-aacc-4c59-8b9d-59ade3c46c00/public" alt="ETH" style={{ width: 16, height: 16 }} />
                  {ethBalance ? (Number(ethBalance.value) / 10 ** ethBalance.decimals).toFixed(4) : '0.0000'}
                </span>
              </div>

              <div style={s.divider} />

              {([['Wallet', portfolio.wallet], ['Staked', portfolio.staked], ['Roasted', portfolio.roasted], ['Unroasted', portfolio.unroasted]] as [string, number][]).map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 14, color: '#bbb' }}>{label}</span>
                  <span style={{ fontSize: 14, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><BeanLogo size={16} />{val.toFixed(4)}</span>
                </div>
              ))}

              <div style={s.divider} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 0' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Total</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><BeanLogo size={18} />{total.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* ── Right: Round History ── */}
          <div style={{ ...s.card, flex: 1, width: isMobile ? '100%' : undefined, display: 'flex', flexDirection: 'column', overflow: 'hidden', alignSelf: 'flex-start', padding: 0, maxHeight: isMobile ? 'none' : 'calc(100vh - 132px)' }}>

            {/* Header */}
            <div style={{ padding: isMobile ? '20px 16px 0' : '28px 32px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Round History</h2>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', margin: 0 }}>{historyTotals?.roundsPlayed ?? rounds.length} rounds played</p>
                </div>
                <div style={{ display: 'flex', gap: isMobile ? 16 : 28 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Win Rate</div>
                    <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 700, color: '#fff' }}>{winRate}%</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Total BEAN</div>
                    <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 700, color: '#fff' }}>{totalBean.toFixed(2)}</div>
                  </div>
                  {!isMobile && <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Total P&amp;L</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(4)} ETH</div>
                  </div>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 80px 100px' : '1fr 130px 110px 110px 130px', padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {(isMobile ? ['Round', 'BEAN', 'P&L'] : ['Round', 'Deployed', 'Won', 'BEAN', 'P&L']).map(h => (
                  <span key={h} style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.35)', textAlign: h === 'Round' ? 'left' : 'right' }}>{h}</span>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '0 8px' : '0 32px' }}>
              {rounds.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 0', textAlign: 'center' }}>
                  <BeanLogo size={36} />
                  <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.5)', margin: 0 }}>You haven&apos;t participated in any rounds yet</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', margin: 0 }}>Start mining to see your stats here</p>
                </div>
              )}
              {pageRounds.map(round => (
                <div key={round.id} onClick={() => setExpandedRound(round)}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = round.isBeanpot ? 'rgba(255,200,0,0.06)' : 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = round.isBeanpot ? 'rgba(255,180,0,0.03)' : 'transparent' }}
                  style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 80px 100px' : '1fr 130px 110px 110px 130px', alignItems: 'center', padding: '14px 12px', cursor: 'pointer', transition: 'background 0.15s', background: round.isBeanpot ? 'rgba(255,180,0,0.03)' : 'transparent', borderBottom: round.isBeanpot ? '1px solid rgba(255,180,0,0.15)' : '1px solid rgba(255,255,255,0.05)', borderLeft: round.isBeanpot ? '2px solid rgba(255,200,0,0.6)' : '2px solid transparent', paddingLeft: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: round.isBeanpot ? '#FFD700' : '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                        #{round.id}
                        {round.isBeanpot && <span style={{ fontSize: 9, fontWeight: 700, color: '#FFD700', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', padding: '1px 6px', borderRadius: 50, letterSpacing: 0.5 }}>BEANPOT</span>}
                      </div>
                      <div style={{ fontSize: 11, color: round.isBeanpot ? 'rgba(255,215,0,0.45)' : 'rgba(255,255,255,0.25)', marginTop: 2 }}>{round.timestamp}</div>
                    </div>
                  </div>
                  {!isMobile && <div style={{ textAlign: 'right', fontSize: 14, color: '#fff' }}>Ξ {round.deployed.toFixed(4)}</div>}
                  {!isMobile && <div style={{ textAlign: 'right', fontSize: 14, color: round.won > 0 ? '#fff' : 'rgba(255,255,255,0.2)' }}>{round.won > 0 ? `Ξ ${round.won.toFixed(4)}` : '–'}</div>}
                  <div style={{ textAlign: 'right', fontSize: 14, color: round.beansEarned > 0 ? '#fff' : 'rgba(255,255,255,0.2)' }}>{round.beansEarned > 0 ? round.beansEarned.toFixed(3) : '–'}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{round.netPnl >= 0 ? '+' : ''}{round.netPnl.toFixed(4)}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{round.pctChange >= 0 ? '+' : ''}{round.pctChange}%</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {rounds.length > 0 && <div style={{ padding: '16px 32px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: page === 0 ? 'transparent' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: page === 0 ? 'default' : 'pointer', color: page === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: "'Space Mono', monospace", minWidth: 48, textAlign: 'center' }}>{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: page >= totalPages - 1 ? 'transparent' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: page >= totalPages - 1 ? 'default' : 'pointer', color: page >= totalPages - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>}
          </div>

        </div>
      )}

      {expandedRound && (
        <PnlCard
          round={expandedRound}
          pfpUrl={pfpUrl}
          username={username}
          onClose={() => setExpandedRound(null)}
          ethPriceUsd={ethPriceUsd}
        />
      )}

      {/* Crop Modal */}
      {cropState && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, width: cropState.type === 'pfp' ? 340 : 480 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>
              {cropState.type === 'pfp' ? 'Adjust profile photo' : 'Adjust banner'}
            </h3>
            <canvas
              ref={cropCanvasRef}
              style={{ display: 'block', margin: '0 auto', borderRadius: cropState.type === 'pfp' ? '50%' : 10, cursor: cropDragging.current ? 'grabbing' : 'grab', userSelect: 'none' }}
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onMouseLeave={handleCropMouseUp}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', minWidth: 34 }}>Zoom</span>
              <input
                type="range" min="1" max="4" step="0.01"
                value={cropState.scale}
                onChange={e => setCropState(s => s ? { ...s, scale: parseFloat(e.target.value) } : s)}
                style={{ flex: 1, accentColor: '#0052FF' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setCropState(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={confirmCrop} style={{ background: '#0052FF', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
