'use client'

import Header from '@/components/Header'
import MinersPanel from '@/components/MinersPanel'
import MiningGrid from '@/components/MiningGrid'
import SidebarControls from '@/components/SidebarControls'
import MobileStatsBar from '@/components/MobileStatsBar'
import MobileControls from '@/components/MobileControls'
import BottomNav from '@/components/BottomNav'
import LandingPage from '@/components/LandingPage'
import ClaimRewards from '@/components/ClaimRewards'
import { useAccount, useBalance, useWriteContract } from 'wagmi'
import { parseEther } from 'viem'
import { useState, useEffect, useCallback } from 'react'
import { CONTRACTS } from '@/lib/contracts'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })
  const [isMobile, setIsMobile] = useState(false)
  const [showMining, setShowMining] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const { writeContract } = useWriteContract()
  const userBalance = balance ? parseFloat(balance.formatted) : 0

  const handleDeploy = useCallback((amount: number, blockIds: number[]) => {
    if (!isConnected || blockIds.length === 0 || amount <= 0) return
    writeContract({
      address: CONTRACTS.GridMining.address,
      abi: CONTRACTS.GridMining.abi,
      functionName: 'deploy',
      args: [blockIds],
      value: parseEther(amount.toString()),
    }, {
      onSuccess: () => {
        window.dispatchEvent(new CustomEvent("userDeployed", {
          detail: { blockIds }
        }))
      }
    })
  }, [isConnected, writeContract])

  const handleClaimBNB = useCallback(() => {
    if (!isConnected) return
    writeContract({
      address: CONTRACTS.GridMining.address,
      abi: CONTRACTS.GridMining.abi,
      functionName: 'claimBNB',
      args: [],
    })
  }, [isConnected, writeContract])

  const handleClaimBEAN = useCallback(() => {
    if (!isConnected) return
    writeContract({
      address: CONTRACTS.GridMining.address,
      abi: CONTRACTS.GridMining.abi,
      functionName: 'claimBEAN',
      args: [],
    })
  }, [isConnected, writeContract])

  const handleAutoActivate = useCallback((strategyId: number, numRounds: number, numBlocks: number, depositAmount: bigint) => {
    if (!isConnected) return
    writeContract({
      address: CONTRACTS.AutoMiner.address,
      abi: CONTRACTS.AutoMiner.abi,
      functionName: 'setConfig',
      args: [strategyId, numRounds, numBlocks],
      value: depositAmount,
    }, {
      onSuccess: () => {
        window.dispatchEvent(new CustomEvent("autoMinerActivated"))
      }
    })
  }, [isConnected, writeContract])

  const handleAutoStop = useCallback(() => {
    if (!isConnected) return
    writeContract({
      address: CONTRACTS.AutoMiner.address,
      abi: CONTRACTS.AutoMiner.abi,
      functionName: 'stop',
      args: [],
    }, {
      onSuccess: () => {
        window.dispatchEvent(new CustomEvent("autoMinerStopped"))
      }
    })
  }, [isConnected, writeContract])

  if (!showMining) {
    return <LandingPage onStartMining={() => setShowMining(true)} />
  }

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: '80px' }}>
        <Header currentPage="home" isMobile={true} />
        <div style={styles.mobileContainer}>
          <MobileStatsBar userAddress={address} />
          <MiningGrid userAddress={address} />
          <MobileControls isConnected={isConnected} userBalance={userBalance} userAddress={address} onDeploy={handleDeploy} onAutoActivate={handleAutoActivate} onAutoStop={handleAutoStop} />
          <ClaimRewards userAddress={address} onClaimBNB={handleClaimBNB} onClaimBEAN={handleClaimBEAN} />
        </div>
        <BottomNav currentPage="mine" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <Header currentPage="home" />
      <div style={styles.container}>
        <MinersPanel />
        <div style={styles.gridSection}>
          <MiningGrid userAddress={address} />
        </div>
        <div style={styles.controlsSection}>
          <SidebarControls isConnected={isConnected} userBalance={userBalance} userAddress={address} onDeploy={handleDeploy} onAutoActivate={handleAutoActivate} onAutoStop={handleAutoStop} />
          <ClaimRewards userAddress={address} onClaimBNB={handleClaimBNB} onClaimBEAN={handleClaimBEAN} />
        </div>
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    gap: '24px',
    padding: '24px 40px',
    paddingRight: '120px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  mobileContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '12px',
  },
  gridSection: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  controlsSection: {
    width: '340px',
    flexShrink: 0,
  },
}
