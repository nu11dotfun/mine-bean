'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useState, useRef, useEffect } from 'react'
import { useBalance, useReadContract, useDisconnect } from 'wagmi'
import BeanLogo from './BeanLogo'
import { CONTRACTS } from '@/lib/contracts'
import { useUserData } from '@/lib/UserDataContext'

interface WalletContentProps {
  account: { address: string; displayName: string }
  chain: { unsupported?: boolean }
  openConnectModal: () => void
  openChainModal: () => void
  mounted: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  disconnect: () => void
  popupRef: React.RefObject<HTMLDivElement>
  profile: { username: string | null; pfp: string | null }
}

function WalletContent({
  account,
  chain,
  openConnectModal,
  openChainModal,
  mounted,
  isOpen,
  setIsOpen,
  disconnect,
  popupRef,
  profile,
}: WalletContentProps) {
  const ready = mounted
  const connected = ready && account && chain

  const { data: ethBalance } = useBalance({
    address: account?.address as `0x${string}` | undefined,
  })

  const { data: beansBalanceRaw } = useReadContract({
    address: CONTRACTS.Bean.address,
    abi: CONTRACTS.Bean.abi,
    functionName: 'balanceOf',
    args: account?.address ? [account.address as `0x${string}`] : undefined,
  })

  const beansBalance = beansBalanceRaw ? Number(beansBalanceRaw) / 1e18 : 0

  // Shared user data from context (no local fetching)
  const { rewards, stakeInfo } = useUserData()

  const stakedBalance = stakeInfo ? parseFloat(stakeInfo.balanceFormatted) : 0
  const refinedBalance = rewards ? parseFloat(rewards.pendingBEAN.refinedFormatted) : 0
  const unrefinedBalance = rewards ? parseFloat(rewards.pendingBEAN.unrefinedFormatted) : 0

  const portfolio = {
    wallet: beansBalance,
    staked: stakedBalance,
    refined: refinedBalance,
    unrefined: unrefinedBalance,
    total: beansBalance + stakedBalance + refinedBalance + unrefinedBalance,
  }

  if (!connected) {
    return (
      <button onClick={openConnectModal} style={styles.connectButton}>
        Connect Wallet
      </button>
    )
  }

  if (chain.unsupported) {
    return (
      <button onClick={openChainModal} style={styles.wrongNetwork}>
        Wrong network
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.accountButton}
      >
        {profile.pfp ? (
          <img src={profile.pfp} alt="" style={styles.headerPfp} />
        ) : (
          <div style={styles.headerPfpPlaceholder}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#999" stroke="none">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
        )}
        {profile.username || account.displayName}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            marginLeft: '6px',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div style={styles.popup} ref={popupRef}>
          {/* Profile Header */}
          <div style={styles.profileHeader}>
            <div style={styles.profileLeft}>
              {profile.pfp ? (
                <img src={profile.pfp} alt="" style={styles.popupPfp} />
              ) : (
                <div style={styles.popupPfpPlaceholder}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#999" stroke="none">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                </div>
              )}
              <div style={styles.profileInfo}>
                <span style={styles.profileName}>
                  {profile.username || 'Anonymous Miner'}
                </span>
                <span style={styles.profileAddress}>{account.displayName}</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={styles.closeButton}>
              ✕
            </button>
          </div>

          {/* ETH Balance */}
          <div style={styles.ethSection}>
            <span style={styles.ethLabel}>ETH Balance</span>
            <span style={styles.ethValue}>
              {ethBalance ? parseFloat(ethBalance.formatted).toFixed(4) : '0.0000'} ETH
            </span>
          </div>

          {/* Portfolio */}
          <div style={styles.portfolioSection}>
            <span style={styles.sectionTitle}>Portfolio</span>

            <div style={styles.portfolioRow}>
              <span style={styles.portfolioLabel}>Wallet</span>
              <span style={styles.portfolioValue}>
                <BeanLogo size={14} /> {portfolio.wallet.toFixed(4)}
              </span>
            </div>

            <div style={styles.portfolioRow}>
              <span style={styles.portfolioLabel}>Staked</span>
              <span style={styles.portfolioValue}>
                <BeanLogo size={14} /> {portfolio.staked.toFixed(4)}
              </span>
            </div>

            <div style={styles.portfolioRow}>
              <span style={styles.portfolioLabel}>Refined</span>
              <span style={styles.portfolioValue}>
                <BeanLogo size={14} /> {portfolio.refined.toFixed(4)}
              </span>
            </div>

            <div style={styles.portfolioRow}>
              <span style={styles.portfolioLabel}>Unrefined</span>
              <span style={styles.portfolioValue}>
                <BeanLogo size={14} /> {portfolio.unrefined.toFixed(4)}
              </span>
            </div>

            <div style={styles.portfolioRowTotal}>
              <span style={styles.portfolioLabelTotal}>Total</span>
              <span style={styles.portfolioValue}>
                <BeanLogo size={14} /> {portfolio.total.toFixed(4)}
              </span>
            </div>
          </div>

          {/* View Profile Link */}
          <a
            href="/profile"
            style={styles.viewProfileButton}
          >
            View Profile
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>

          <button
            onClick={() => {
              setIsOpen(false)
              disconnect()
            }}
            style={styles.disconnectButton}
          >
            Disconnect
          </button>
        </div>
      )}
    </>
  )
}

export default function WalletButton() {
  const [isOpen, setIsOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)
  const { disconnect } = useDisconnect()

  // Profile from shared context (fetched once on wallet connect, cached in sessionStorage)
  const { rewards, stakeInfo, profile: profileData } = useUserData()
  const profile = {
    username: profileData?.username || null,
    pfp: profileData?.pfpUrl || null,
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mouseup', handleClickOutside)
    return () => document.removeEventListener('mouseup', handleClickOutside)
  }, [])

  return (
    <div style={{ position: 'relative', zIndex: 9999 }} ref={buttonRef}>
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openConnectModal,
          openChainModal,
          mounted,
        }) => (
          <WalletContent
            account={account as { address: string; displayName: string }}
            chain={chain as { unsupported?: boolean }}
            openConnectModal={openConnectModal}
            openChainModal={openChainModal}
            mounted={mounted}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            disconnect={disconnect}
            popupRef={popupRef}
            profile={profile}
          />
        )}
      </ConnectButton.Custom>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  connectButton: {
    background: 'transparent',
    border: '1px solid #444',
    color: '#fff',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '50px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },
  wrongNetwork: {
    background: '#ff4444',
    border: 'none',
    color: '#fff',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '50px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  accountButton: {
    background: '#1a1a1a',
    border: '1px solid #444',
    color: '#fff',
    fontWeight: 500,
    padding: '6px 14px 6px 8px',
    borderRadius: '50px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
  },
  headerPfp: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
  },
  headerPfpPlaceholder: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: '#222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popup: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    width: '320px',
    background: '#0a0a0a',
    border: '1px solid #222',
    borderRadius: '16px',
    padding: '20px',
    zIndex: 1000,
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
  },
  profileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  profileLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  popupPfp: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    border: '2px solid #222',
  },
  popupPfpPlaceholder: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: '#1a1a1a',
    border: '2px solid #222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  profileName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#fff',
  },
  profileAddress: {
    fontSize: '12px',
    color: '#999',
    fontFamily: 'monospace',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#999',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
  },
  ethSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    background: '#111',
    borderRadius: '10px',
    marginBottom: '20px',
  },
  ethLabel: {
    fontSize: '13px',
    color: '#bbb',
  },
  ethValue: {
    fontSize: '13px',
    color: '#fff',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  portfolioSection: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    display: 'block',
    marginBottom: '12px',
  },
  portfolioRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #151515',
  },
  portfolioRowTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0 0 0',
    marginTop: '4px',
  },
  portfolioLabel: {
    fontSize: '13px',
    color: '#bbb',
  },
  portfolioLabelTotal: {
    fontSize: '13px',
    color: '#fff',
    fontWeight: 600,
  },
  portfolioValue: {
    fontSize: '13px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  viewProfileButton: {
    width: '100%',
    background: 'transparent',
    border: '1px solid #0052FF',
    color: '#0052FF',
    fontWeight: 500,
    padding: '10px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '8px',
    textDecoration: 'none',
  },
  disconnectButton: {
    width: '100%',
    background: '#111',
    border: '1px solid #222',
    color: '#999',
    fontWeight: 500,
    padding: '10px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s ease',
  },
}
