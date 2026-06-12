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
import RoastingAprBanner from '@/components/RoastingAprBanner'
import { useAccount, useBalance, useWriteContract } from 'wagmi'
import { base } from 'wagmi/chains'
import { parseEther, type Abi } from 'viem'
import { useState, useEffect, useCallback, useRef } from 'react'
import { CONTRACTS, BUILDER_CODE_SUFFIX } from '@/lib/contracts'
import { usePrivacy } from '@/lib/privacy/PrivacyContext'
import { useRoundTimer } from '@/lib/RoundTimerContext'
import BeanpotCelebration from '@/components/BeanpotCelebration'
import CountdownCelebration from '@/components/CountdownCelebration'
import AgentConfigDrawer from '@/components/AgentConfigDrawer'
import type { CustomAgent } from '@/lib/customAgents'

export default function Home() {
  const { address, isConnected } = useAccount()
  const privacy = usePrivacy()
  // In private mode the subaccount is the app's identity: balance, grid data,
  // rewards, and deploys all follow it instead of the connected wallet.
  const effectiveAddress = privacy.effectiveAddress ?? address
  const { data: balance } = useBalance({ address: effectiveAddress })
  const { roundId } = useRoundTimer()
  const roundIdRef = useRef(roundId)
  useEffect(() => {
    roundIdRef.current = roundId
  }, [roundId])
  const [isMobile, setIsMobile] = useState(false)
  const [showMining, setShowMining] = useState(false)
  const [mounted, setMounted] = useState(false)

  // AgentConfigDrawer state - opened via the AGENT tab in Sidebar/Mobile Controls
  // via a window CustomEvent. Single shared instance for USE / EDIT / CREATE NEW.
  type AgentDrawerState = {
    open: boolean
    preset?: CustomAgent
    agentId?: CustomAgent['baseAgent']
  }
  const [agentDrawer, setAgentDrawer] = useState<AgentDrawerState>({ open: false })
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      setAgentDrawer({ open: true, preset: detail.preset, agentId: detail.agentId })
    }
    window.addEventListener('openAgentDrawer', handler)
    return () => window.removeEventListener('openAgentDrawer', handler)
  }, [])

  // Effective agent metadata for the drawer. Uses preset's baseAgent if set,
  // otherwise the picked agentId.
  const effectiveAgentId = agentDrawer.preset?.baseAgent ?? agentDrawer.agentId ?? 'sniper'
  const agentLabelMap: Record<CustomAgent['baseAgent'], { name: string; label: string }> = {
    'sniper': { name: 'Sniper', label: 'AGENT_001' },
    'anti-winner': { name: 'Anti-Winner', label: 'AGENT_003' },
    'beanpot-hunter': { name: 'Beanpot Hunter', label: 'AGENT_002' },
    'anti-loser': { name: 'Anti-Loser', label: 'AGENT_004' },
    'nostradamus': { name: 'Nostradamus', label: 'AGENT_005' },
  }
  const agentMeta = agentLabelMap[effectiveAgentId]

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
useEffect(() => {
  setShowMining(localStorage.getItem('bean_visited') === 'true')
  setMounted(true)
}, [])
  const { writeContract } = useWriteContract()
  const userBalance = balance ? parseFloat(balance.formatted) : 0

  const handleDeploy = useCallback((amount: number, blockIds: number[]) => {
    if (!isConnected || blockIds.length === 0 || amount <= 0) return
    if (privacy.enabled) {
      // Private path: top up the subaccount from the pool if needed (relay of
      // the pre-generated proof), then deploy signed by the subaccount.
      const value = parseEther(amount.toString())
      const startRound = roundIdRef.current
      void (async () => {
        try {
          await privacy.ensureFunded(value)
          if (roundIdRef.current !== startRound) {
            // Round rolled over while funding — funds are at the subaccount
            // now; the user re-deploys instantly. Never auto-deploy into a
            // round the user didn't aim at.
            return
          }
          await privacy.sendPrivateTx({
            address: CONTRACTS.GridMining.address,
            abi: CONTRACTS.GridMining.abi as Abi,
            functionName: 'deploy',
            args: [blockIds],
            value,
          })
          window.dispatchEvent(new CustomEvent("userDeployed", {
            detail: { blockIds }
          }))
        } catch {
          // Surfaced through privacy.error / status in the panel.
        }
      })()
      return
    }
    writeContract({
      chainId: base.id,
      address: CONTRACTS.GridMining.address,
      abi: CONTRACTS.GridMining.abi,
      functionName: 'deploy',
      args: [blockIds],
      value: parseEther(amount.toString()),
      dataSuffix: BUILDER_CODE_SUFFIX,
    }, {
      onSuccess: () => {
        window.dispatchEvent(new CustomEvent("userDeployed", {
          detail: { blockIds }
        }))
      }
    })
  }, [isConnected, writeContract, privacy])

  const handleClaimETH = useCallback(() => {
    if (!isConnected) return
    if (privacy.enabled) {
      void (async () => {
        try {
          // Claims are nonpayable — just make sure the subaccount can pay gas.
          await privacy.ensureFunded(0n)
          await privacy.sendPrivateTx({
            address: CONTRACTS.GridMining.address,
            abi: CONTRACTS.GridMining.abi as Abi,
            functionName: 'claimETH',
            args: [],
          })
        } catch {
          // Surfaced through privacy.error.
        }
      })()
      return
    }
    writeContract({
      chainId: base.id,
      address: CONTRACTS.GridMining.address,
      abi: CONTRACTS.GridMining.abi,
      functionName: 'claimETH',
      args: [],
      dataSuffix: BUILDER_CODE_SUFFIX,
    })
  }, [isConnected, writeContract, privacy])

  const handleClaimBEAN = useCallback(() => {
    if (!isConnected) return
    if (privacy.enabled) {
      void (async () => {
        try {
          await privacy.ensureFunded(0n)
          await privacy.sendPrivateTx({
            address: CONTRACTS.GridMining.address,
            abi: CONTRACTS.GridMining.abi as Abi,
            functionName: 'claimBEAN',
            args: [],
          })
        } catch {
          // Surfaced through privacy.error.
        }
      })()
      return
    }
    writeContract({
      chainId: base.id,
      address: CONTRACTS.GridMining.address,
      abi: CONTRACTS.GridMining.abi,
      functionName: 'claimBEAN',
      args: [],
      dataSuffix: BUILDER_CODE_SUFFIX,
    })
  }, [isConnected, writeContract, privacy])

  const handleAutoActivate = useCallback((strategyId: number, numRounds: number, numBlocks: number, depositAmount: bigint, blockMask: number) => {
    if (!isConnected) return
    writeContract({
      chainId: base.id,
      address: CONTRACTS.AutoMiner.address,
      abi: CONTRACTS.AutoMiner.abi,
      functionName: 'setConfig',
      args: [strategyId, numRounds, numBlocks, blockMask],
      value: depositAmount,
      dataSuffix: BUILDER_CODE_SUFFIX,
    }, {
      onSuccess: () => {
        window.dispatchEvent(new CustomEvent("autoMinerActivated"))
      }
    })
  }, [isConnected, writeContract])

  const handleAutoStop = useCallback(() => {
    if (!isConnected) return
    writeContract({
      chainId: base.id,
      address: CONTRACTS.AutoMiner.address,
      abi: CONTRACTS.AutoMiner.abi,
      functionName: 'stop',
      args: [],
      dataSuffix: BUILDER_CODE_SUFFIX,
    }, {
      onSuccess: () => {
        window.dispatchEvent(new CustomEvent("autoMinerStopped"))
      }
    })
  }, [isConnected, writeContract])

  if (!mounted) return null
if (!showMining) {
    return <LandingPage onStartMining={() => { localStorage.setItem('bean_visited', 'true'); sessionStorage.setItem('bean_visited', 'true'); setShowMining(true) }} />
  }

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: '80px' }}>
        <Header currentPage="mine" isMobile={true} />
        <div style={styles.mobileContainer}>
          <MobileStatsBar userAddress={address} />
          <MiningGrid userAddress={address} />
          <MobileControls isConnected={isConnected} userBalance={userBalance} userAddress={address} onDeploy={handleDeploy} onAutoActivate={handleAutoActivate} onAutoStop={handleAutoStop} />
          <RoastingAprBanner userAddress={address} />
          <ClaimRewards userAddress={address} onClaimETH={handleClaimETH} onClaimBEAN={handleClaimBEAN} />
        </div>
        <BottomNav currentPage="mine" />
        <AgentConfigDrawer
          isOpen={agentDrawer.open}
          onClose={() => setAgentDrawer({ open: false })}
          agentId={effectiveAgentId}
          agentName={agentMeta.name}
          agentLabel={agentMeta.label}
          initialPreset={agentDrawer.preset}
          variant="main"
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <Header currentPage="mine" />
      <BeanpotCelebration />
      <CountdownCelebration />
      <div style={styles.container}>
        <MinersPanel />
        <div style={styles.gridSection}>
          <MiningGrid userAddress={effectiveAddress} />
        </div>
        <div style={styles.controlsSection}>
          <SidebarControls isConnected={isConnected} userBalance={userBalance} userAddress={effectiveAddress} onDeploy={handleDeploy} onAutoActivate={handleAutoActivate} onAutoStop={handleAutoStop} />
          <RoastingAprBanner userAddress={effectiveAddress} />
          <ClaimRewards userAddress={effectiveAddress} onClaimETH={handleClaimETH} onClaimBEAN={handleClaimBEAN} />
        </div>
      </div>
      <AgentConfigDrawer
        isOpen={agentDrawer.open}
        onClose={() => setAgentDrawer({ open: false })}
        agentId={effectiveAgentId}
        agentName={agentMeta.name}
        agentLabel={agentMeta.label}
        initialPreset={agentDrawer.preset}
        variant="main"
      />
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
