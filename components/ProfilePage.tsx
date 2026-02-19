'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAccount, useBalance, useReadContract, useSignMessage } from 'wagmi'
import BeanLogo from './BeanLogo'
import { CONTRACTS } from '@/lib/contracts'
import { useUserData } from '@/lib/UserDataContext'
import { apiMutate } from '@/lib/api'

// ── Image resize utility ─────────────────────────────────────────────

const resizeImage = (file: File, maxSize: number = 200): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = maxSize
      canvas.height = maxSize
      const ctx = canvas.getContext('2d')!
      // Center-crop: use the smaller dimension as source square
      const min = Math.min(img.width, img.height)
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// ── Component ─────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { address, isConnected, isReconnecting, isConnecting } = useAccount()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { signMessageAsync } = useSignMessage()

  // Shared user data from context
  const { rewards, stakeInfo, profile: profileData, refetchProfile } = useUserData()

  // Local edit state
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [pfpUrl, setPfpUrl] = useState<string | null>(null)
  const [discordConnected, setDiscordConnected] = useState(false)
  const [discordUsername, setDiscordUsername] = useState<string | null>(null)
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [isEditingBio, setIsEditingBio] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Pre-populate fields from context when profile loads
  const profileLoadedRef = useRef(false)
  useEffect(() => {
    if (profileData && !profileLoadedRef.current) {
      profileLoadedRef.current = true
      if (profileData.username) setUsername(profileData.username)
      if (profileData.bio) setBio(profileData.bio)
      if (profileData.pfpUrl) setPfpUrl(profileData.pfpUrl)
      if (profileData.discord) {
        setDiscordConnected(true)
        setDiscordUsername(profileData.discord)
      }
    }
  }, [profileData])

  // Reset loaded ref when address changes
  useEffect(() => {
    profileLoadedRef.current = false
  }, [address])

  const { data: ethBalance } = useBalance({
    address: address as `0x${string}` | undefined,
  })

  const { data: beansBalanceRaw } = useReadContract({
    address: CONTRACTS.Bean.address,
    abi: CONTRACTS.Bean.abi,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
  })

  const beansBalance = beansBalanceRaw ? Number(beansBalanceRaw) / 1e18 : 0

  // Real portfolio data from shared context
  const stakedBalance = stakeInfo ? parseFloat(stakeInfo.balanceFormatted) : 0
  const roastedBalance = rewards ? parseFloat(rewards.pendingBEAN.roastedFormatted) : 0
  const unroastedBalance = rewards ? parseFloat(rewards.pendingBEAN.unroastedFormatted) : 0

  const portfolio = {
    wallet: beansBalance,
    staked: stakedBalance,
    roasted: roastedBalance,
    unroasted: unroastedBalance,
  }

  const total = portfolio.wallet + portfolio.staked + portfolio.roasted + portfolio.unroasted

  // ── Save profile with wallet signature ──────────────────────────────

  const saveProfile = useCallback(async (fields: { username?: string; bio?: string; pfpUrl?: string | null }) => {
    if (!address) return
    setSaving(true)
    setSaveError(null)
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const message = `BEAN Protocol Profile Update\nAddress: ${address.toLowerCase()}\nTimestamp: ${timestamp}`
      const signature = await signMessageAsync({ message })
      await apiMutate(`/api/user/${address.toLowerCase()}/profile`, 'PUT', {
        ...fields,
        signature,
        message,
        timestamp,
      })
      refetchProfile()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save'
      setSaveError(errorMessage)
    } finally {
      setSaving(false)
    }
  }, [address, signMessageAsync, refetchProfile])

  // ── Handlers ────────────────────────────────────────────────────────

  const handlePfpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await resizeImage(file, 200)
      setPfpUrl(base64)
      saveProfile({ pfpUrl: base64 })
    } catch {
      setSaveError('Failed to process image')
    }
  }

  const handleRemovePfp = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPfpUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    saveProfile({ pfpUrl: null })
  }

  const handleSaveUsername = () => {
    setIsEditingUsername(false)
    saveProfile({ username: username || '' })
  }

  const handleSaveBio = () => {
    setIsEditingBio(false)
    saveProfile({ bio: bio || '' })
  }

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Show loading state while wagmi rehydrates wallet from localStorage
  if (isReconnecting || isConnecting) {
    return (
      <div style={styles.container}>
        <div style={styles.notConnected}>
          <p style={styles.notConnectedText}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isConnected || !address) {
    return (
      <div style={styles.container}>
        <div style={styles.notConnected}>
          <div style={styles.notConnectedIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={styles.notConnectedTitle}>Connect Your Wallet</h2>
          <p style={styles.notConnectedText}>Connect a wallet to view and edit your profile.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.page}>
        {/* Save Error Banner */}
        {saveError && (
          <div style={styles.errorBanner}>
            <span>{saveError}</span>
            <button onClick={() => setSaveError(null)} style={styles.errorClose}>✕</button>
          </div>
        )}

        {/* Profile Card */}
        <div style={styles.card}>
          {/* PFP Section */}
          <div style={styles.pfpSection}>
            <div style={{ position: 'relative' as const, display: 'inline-block' }}>
              <div
                style={styles.pfpContainer}
                onClick={() => fileInputRef.current?.click()}
              >
                {pfpUrl ? (
                  <img src={pfpUrl} alt="Profile" style={styles.pfpImage} />
                ) : (
                  <div style={styles.pfpPlaceholder}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="#666" stroke="none">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                    </svg>
                  </div>
                )}
                <div style={styles.pfpOverlay}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePfpUpload}
                  style={{ display: 'none' }}
                />
              </div>
              {pfpUrl && (
                <button
                  onClick={handleRemovePfp}
                  style={styles.pfpRemoveButton}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Username */}
          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>Username</label>
            {isEditingUsername ? (
              <div style={styles.editRow}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  maxLength={20}
                  style={styles.textInput}
                  autoFocus
                />
                <button
                  onClick={handleSaveUsername}
                  style={{
                    ...styles.saveButton,
                    ...(saving ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                  disabled={saving}
                >
                  {saving ? '...' : 'Save'}
                </button>
              </div>
            ) : (
              <div style={styles.displayRow}>
                <span style={styles.fieldValue}>
                  {username || 'Not set'}
                </span>
                <button
                  onClick={() => setIsEditingUsername(true)}
                  style={styles.editButton}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Bio */}
          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>Bio</label>
            {isEditingBio ? (
              <div style={styles.editRow}>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell the world about yourself"
                  maxLength={160}
                  rows={3}
                  style={{ ...styles.textInput, resize: 'none' as const, minHeight: '72px' }}
                  autoFocus
                />
                <button
                  onClick={handleSaveBio}
                  style={{
                    ...styles.saveButton,
                    ...(saving ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                  disabled={saving}
                >
                  {saving ? '...' : 'Save'}
                </button>
              </div>
            ) : (
              <div style={styles.displayRow}>
                <span style={{ ...styles.fieldValue, ...(bio ? {} : { fontStyle: 'italic' }) }}>
                  {bio || 'Not set'}
                </span>
                <button
                  onClick={() => setIsEditingBio(true)}
                  style={styles.editButton}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Address */}
          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>Address</label>
            <div style={styles.displayRow}>
              <span style={{ ...styles.fieldValue, fontFamily: 'monospace' }}>
                {truncateAddress(address)}
              </span>
              <button
                onClick={handleCopyAddress}
                style={styles.editButton}
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0052FF" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Discord */}
          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>Discord</label>
            <div style={styles.displayRow}>
              {discordConnected ? (
                <span style={styles.fieldValue}>{discordUsername}</span>
              ) : (
                <button
                  onClick={() => {
                    // Discord OAuth will be implemented later
                    console.log('Discord connect clicked')
                  }}
                  style={styles.discordButton}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                  Connect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Portfolio</h3>

          <div style={styles.ethRow}>
            <span style={styles.ethRowLabel}>ETH Balance</span>
            <span style={styles.ethRowValue}>
              <img
                src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/f9461cf2-aacc-4c59-8b9d-59ade3c46c00/public"
                alt="ETH"
                style={{ width: 16, height: 16 }}
              />
              {ethBalance ? parseFloat(ethBalance.formatted).toFixed(4) : '0.0000'}
            </span>
          </div>

          <div style={styles.divider} />

          <div style={styles.portfolioGrid}>
            {[
              { label: 'Wallet', value: portfolio.wallet },
              { label: 'Staked', value: portfolio.staked },
              { label: 'Roasted', value: portfolio.roasted },
              { label: 'Unroasted', value: portfolio.unroasted },
            ].map((item) => (
              <div key={item.label} style={styles.portfolioItem}>
                <span style={styles.portfolioItemLabel}>{item.label}</span>
                <span style={styles.portfolioItemValue}>
                  <BeanLogo size={16} /> {item.value.toFixed(4)}
                </span>
              </div>
            ))}
          </div>

          <div style={styles.divider} />

          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Total</span>
            <span style={styles.totalValue}>
              <BeanLogo size={18} /> {total.toFixed(4)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: 'transparent',
    padding: '40px 20px 80px',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  page: {
    maxWidth: '480px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  notConnected: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '16px',
  },
  notConnectedIcon: {
    marginBottom: '8px',
  },
  notConnectedTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#fff',
    margin: 0,
  },
  notConnectedText: {
    fontSize: '14px',
    color: '#999',
    margin: 0,
  },
  errorBanner: {
    background: '#2a1515',
    border: '1px solid #4a2020',
    borderRadius: '10px',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#ff6b6b',
    fontSize: '13px',
  },
  errorClose: {
    background: 'transparent',
    border: 'none',
    color: '#ff6b6b',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 4px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    backdropFilter: 'blur(20px)',
    padding: '24px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    margin: '0 0 20px 0',
  },
  pfpSection: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  pfpContainer: {
    position: 'relative',
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  pfpImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    borderRadius: '50%',
  },
  pfpPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '2px solid rgba(255,255,255,0.08)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pfpOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '32px',
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pfpRemoveButton: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#444',
    border: '2px solid #0a0a0a',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 10,
  },
  fieldGroup: {
    marginBottom: '20px',
  },
  fieldLabel: {
    fontSize: '12px',
    color: '#999',
    display: 'block',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  displayRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldValue: {
    fontSize: '15px',
    color: '#fff',
  },
  editRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  textInput: {
    flex: 1,
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  editButton: {
    background: 'transparent',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.2s',
  },
  saveButton: {
    background: '#0052FF',
    border: 'none',
    color: '#000',
    fontWeight: 600,
    padding: '10px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap' as const,
  },
  discordButton: {
    background: '#5865F2',
    border: 'none',
    color: '#fff',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  ethRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
  },
  ethRowLabel: {
    fontSize: '14px',
    color: '#bbb',
  },
  ethRowValue: {
    fontSize: '14px',
    color: '#fff',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.04)',
    margin: '4px 0',
  },
  portfolioGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  portfolioItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #151515',
  },
  portfolioItemLabel: {
    fontSize: '14px',
    color: '#bbb',
  },
  portfolioItemValue: {
    fontSize: '14px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 0 0 0',
  },
  totalLabel: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#fff',
  },
  totalValue: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
}
