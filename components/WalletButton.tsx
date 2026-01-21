'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useState, useRef, useEffect } from 'react'
import { useBalance, useReadContract, useDisconnect } from 'wagmi'

const BEANS_ADDRESS = '0x000Ae314E2A2172a039B26378814C252734f556A'

const erc20Abi = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export default function WalletButton() {
  const [isOpen, setIsOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const { disconnect } = useDisconnect()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openConnectModal,
        openChainModal,
        mounted,
      }) => {
        const ready = mounted
        const connected = ready && account && chain

        const { data: bnbBalance } = useBalance({
          address: account?.address as `0x${string}` | undefined,
        })

        const { data: beansBalanceRaw } = useReadContract({
          address: BEANS_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: account?.address ? [account.address as `0x${string}`] : undefined,
        })

        const beansBalance = beansBalanceRaw ? Number(beansBalanceRaw) / 1e18 : 0

        const portfolio = {
          wallet: beansBalance,
          staked: 0,
          rewards: 0,
        }

        return (
          <div ref={popupRef} style={{ position: 'relative' }}>
            {(() => {
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
                    {account.displayName}
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
                    <div style={styles.popup}>
                      <div style={styles.popupHeader}>
                        <span style={styles.popupTitle}>Account</span>
                        <button onClick={() => setIsOpen(false)} style={styles.closeButton}>
                          ✕
                        </button>
                      </div>

                      <div style={styles.addressSection}>
                        <span style={styles.label}>Wallet Address</span>
                        <div style={styles.addressRow}>
                          <span style={styles.address}>{account.displayName}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(account.address)}
                            style={styles.copyButton}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div style={styles.addressSection}>
                        <span style={styles.label}>BNB Balance</span>
                        <div style={styles.addressRow}>
                          <span style={styles.address}>
                            <img 
                              src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public" 
                              alt="BNB" 
                              style={{ width: 16, height: 16, marginRight: 6 }} 
                            />
                            {bnbBalance ? parseFloat(bnbBalance.formatted).toFixed(4) : '0.0000'} BNB
                          </span>
                        </div>
                      </div>

                      <div style={styles.portfolioSection}>
                        <span style={styles.sectionTitle}>Portfolio</span>
                        
                        <div style={styles.portfolioRow}>
                          <span style={styles.portfolioLabel}>Wallet</span>
                          <span style={styles.portfolioValue}>
                            <span style={styles.beansIcon}>🫘</span> {portfolio.wallet.toFixed(4)}
                          </span>
                        </div>
                        
                        <div style={styles.portfolioRow}>
                          <span style={styles.portfolioLabel}>Staked</span>
                          <span style={styles.portfolioValue}>
                            <span style={styles.beansIcon}>🫘</span> {portfolio.staked.toFixed(4)}
                          </span>
                        </div>
                        
                        <div style={styles.portfolioRow}>
                          <span style={styles.portfolioLabel}>Rewards</span>
                          <span style={styles.portfolioValue}>
                            <span style={styles.beansIcon}>🫘</span> {portfolio.rewards.toFixed(4)}
                          </span>
                        </div>

                        <div style={styles.portfolioRowTotal}>
                          <span style={styles.portfolioLabel}>Total</span>
                          <span style={styles.portfolioValue}>
                            <span style={styles.beansIcon}>🫘</span> {(portfolio.wallet + portfolio.staked + portfolio.rewards).toFixed(4)}
                          </span>
                        </div>
                      </div>

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
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  connectButton: {
    background: 'transparent',
    border: '1px solid #333',
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
    border: '1px solid #333',
    color: '#fff',
    fontWeight: 500,
    padding: '8px 14px',
    borderRadius: '50px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  popup: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    width: '300px',
    background: '#0a0a0a',
    border: '1px solid #222',
    borderRadius: '12px',
    padding: '16px',
    zIndex: 1000,
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
  },
  popupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  popupTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#666',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
  },
  addressSection: {
    marginBottom: '20px',
  },
  label: {
    fontSize: '12px',
    color: '#666',
    display: 'block',
    marginBottom: '6px',
  },
  addressRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  address: {
    fontSize: '14px',
    color: '#fff',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center',
  },
  copyButton: {
    background: 'transparent',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.2s',
  },
  portfolioSection: {
    marginBottom: '20px',
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
    borderBottom: '1px solid #1a1a1a',
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
    color: '#888',
  },
  portfolioValue: {
    fontSize: '13px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  beansIcon: {
    fontSize: '12px',
  },
  disconnectButton: {
    width: '100%',
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#888',
    fontWeight: 500,
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },
}
