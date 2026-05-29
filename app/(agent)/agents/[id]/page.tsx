'use client'

import React, { useState, useEffect } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWalletClient, useSendTransaction } from 'wagmi'
import { base } from 'wagmi/chains'
import { useQueryClient } from '@tanstack/react-query'
import { parseEther, formatEther, formatUnits } from 'viem'
import AgentHeader from '@/components/AgentHeader'
import AgentBottomNav from '@/components/AgentBottomNav'
import { AGENTS, PRE_BURN_PER_AGENT } from '@/lib/agents'
import { AgentStats, RoundData, fetchAgentRounds, relativeTime } from '@/lib/agentData'
import { apiFetch } from '@/lib/api'
import { CONTRACTS } from '@/lib/contracts'
import { useIsOnBase } from '@/lib/useIsOnBase'
import InvestModal, { DepositStep, X402Step } from '@/components/InvestModal'
import {
  payAndFetchDecision,
  assertSafeStrategyDecision,
  withBuilderCodeSuffix,
  gridStalenessSeconds,
  X402ClientError,
  type StrategyDecision,
} from '@/lib/x402Client'
import type { StrategyId } from '@/lib/x402/config'

// USDC on Base mainnet. ERC-20, 6 decimals. Used to read the user's USDC
// balance for the x402 pre-flight check.
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
const ERC20_BALANCE_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const
import VaultStatsModal from '@/components/VaultStatsModal'
import AgentConfigDrawer from '@/components/AgentConfigDrawer'

function StatusDot({ status }: { status: 'active' | 'paused' | 'new' }) {
  const color = status === 'active' ? '#00C853' : status === 'new' ? '#0052FF' : 'rgba(255,255,255,0.25)'
  const label = status === 'active' ? 'ONLINE' : status === 'new' ? 'DEPLOYING' : 'STANDBY'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color, fontWeight: 700, fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0, ...(status !== 'paused' ? { animation: 'pulse-glow 2s ease-in-out infinite' } : {}) }} />
      {label}
    </span>
  )
}

function NeonCard({ children, style, fillHeight }: { children: React.ReactNode; style?: React.CSSProperties; fillHeight?: boolean }) {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(180deg, rgba(0,40,120,0.12) 0%, rgba(0,15,50,0.06) 100%)',
      border: '1px solid rgba(0,120,255,0.7)',
      borderRadius: 16, padding: 14,
      boxShadow: '0 0 8px rgba(0,120,255,0.7), 0 0 20px rgba(0,100,255,0.4), 0 0 45px rgba(0,80,255,0.2), 0 0 80px rgba(0,60,255,0.08), inset 0 0 20px rgba(0,100,255,0.08), inset 0 1px 0 rgba(150,200,255,0.12)',
      ...(fillHeight ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const } : {}),
      ...style,
    }}>
      {children}
    </div>
  )
}

const ROWS_PER_PAGE = 12

export default function AgentProfilePage({ params }: { params: { id: string } }) {
  const { id } = params
  const agent = AGENTS.find(a => a.id === id)

  const [isMobile, setIsMobile] = useState(false)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [showInvestModal, setShowInvestModal] = useState(false)
  const [showVaultStats, setShowVaultStats] = useState(false)
  const [showAgentConfig, setShowAgentConfig] = useState(false)
  const [vaultApiData, setVaultApiData] = useState<any>(null)
  const [depositStep, setDepositStep] = useState<DepositStep>('idle')
  const [withdrawPending, setWithdrawPending] = useState(false)
  const [claimBeanPending, setClaimBeanPending] = useState(false)
  const [rounds, setRounds] = useState<RoundData[]>([])
  const HISTORY_PAGES = 4

  // ── x402 paid mining state ──
  // Step machine drives the X402Tab UI through the call → decision → deploy
  // flow. Round info is refreshed when the modal opens so pre-flight checks
  // are fresh (timing, already-deployed) without depending on MiningGrid SSE.
  // x402Decision captures the response from dev's strategy endpoint so the
  // UI can show ROI / reason / fire:false handling on the recommendation.
  const [x402Step, setX402Step] = useState<X402Step>('idle')
  const [x402RoundInfo, setX402RoundInfo] = useState<{ roundId: string; endTime: number; userDeployedFormatted: string } | null>(null)
  const [x402TimeRemaining, setX402TimeRemaining] = useState(60)
  const [x402Decision, setX402Decision] = useState<StrategyDecision | null>(null)
  const [x402TxHash, setX402TxHash] = useState<`0x${string}` | null>(null)

  // ── Wallet + vault contract reads ──
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()
  const vaultAddress = agent?.vaultAddress
  const vaultAbi = CONTRACTS.AgentVault.abi

  // User balances
  const { data: ethBalanceData } = useBalance({ address })
  const { data: beanBalanceData } = useBalance({ address, token: CONTRACTS.Bean.address })
  const userEthBalance = ethBalanceData ? parseFloat(formatEther(ethBalanceData.value)) : 0
  const userBeanBalance = beanBalanceData ? parseFloat(formatEther(beanBalanceData.value)) : 0

  // USDC balance for the x402 paid mining pre-flight. 6 decimals.
  const { data: usdcBalanceRaw, refetch: refetchUsdc } = useReadContract({
    address: USDC_BASE, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [address!],
    query: { enabled: !!address },
  })
  const userUsdcBalance = usdcBalanceRaw ? parseFloat(formatUnits(usdcBalanceRaw as bigint, 6)) : 0

  // Vault reads (only when vault exists and wallet connected)
  const vaultReadEnabled = !!vaultAddress && !!address
  const { data: beanLockAmountRaw } = useReadContract({
    address: vaultAddress, abi: vaultAbi, functionName: 'beanLockAmount',
    query: { enabled: !!vaultAddress },
  })
  const beanLockAmount = beanLockAmountRaw ? formatEther(beanLockAmountRaw as bigint) : '10'

  const { data: hasLockedRaw } = useReadContract({
    address: vaultAddress, abi: vaultAbi, functionName: 'hasLockedBEAN', args: [address!],
    query: { enabled: vaultReadEnabled },
  })
  const hasLockedBEAN = !!hasLockedRaw

  const { data: userETHBalRaw, refetch: refetchUserETH } = useReadContract({
    address: vaultAddress, abi: vaultAbi, functionName: 'userETHBalance', args: [address!],
    query: { enabled: vaultReadEnabled },
  })
  const { data: userBEANBalRaw, refetch: refetchUserBEAN } = useReadContract({
    address: vaultAddress, abi: vaultAbi, functionName: 'userBEANBalance', args: [address!],
    query: { enabled: vaultReadEnabled },
  })
  const { data: userSharesRaw, refetch: refetchShares } = useReadContract({
    address: vaultAddress, abi: vaultAbi, functionName: 'shares', args: [address!],
    query: { enabled: vaultReadEnabled },
  })
  const { data: totalSharesRaw } = useReadContract({
    address: vaultAddress, abi: vaultAbi, functionName: 'totalShares',
    query: { enabled: !!vaultAddress },
  })
  const { data: totalETHAssetsRaw } = useReadContract({
    address: vaultAddress, abi: vaultAbi, functionName: 'totalETHAssets',
    query: { enabled: !!vaultAddress },
  })
  const { data: pendingWithdrawalRaw, refetch: refetchPending } = useReadContract({
    address: vaultAddress, abi: vaultAbi, functionName: 'userPendingWithdrawal', args: [address!],
    query: { enabled: vaultReadEnabled },
  })
  const { data: pendingDepositRaw } = useReadContract({
    address: vaultAddress, abi: vaultAbi, functionName: 'pendingDeposit', args: [address!],
    query: { enabled: vaultReadEnabled },
  })

  // BEAN allowance for vault
  const { data: beanAllowanceRaw } = useReadContract({
    address: CONTRACTS.Bean.address, abi: CONTRACTS.Bean.abi, functionName: 'allowance',
    args: [address!, vaultAddress!],
    query: { enabled: vaultReadEnabled },
  })
  const beanAllowanceSufficient = beanAllowanceRaw
    ? (beanAllowanceRaw as bigint) >= (beanLockAmountRaw as bigint || BigInt(0))
    : false

  // Compute vault stats
  const userShares = userSharesRaw ? (userSharesRaw as bigint) : BigInt(0)
  const totalShares = totalSharesRaw ? (totalSharesRaw as bigint) : BigInt(0)
  const userSharePct = totalShares > BigInt(0) ? Number(userShares * BigInt(10000) / totalShares) / 100 : 0
  const userETHInVault = userETHBalRaw ? formatEther(userETHBalRaw as bigint) : '0'
  const userBEANInVault = userBEANBalRaw ? formatEther(userBEANBalRaw as bigint) : '0'
  const totalPooled = totalETHAssetsRaw ? formatEther(totalETHAssetsRaw as bigint) : '0'
  const pendingDep = pendingDepositRaw ? formatEther(pendingDepositRaw as bigint) : '0'

  // ── Old vault reads (legacy withdrawal support) ──
  const oldVaultAddress = agent?.oldVaultAddress
  const oldVaultAbi = CONTRACTS.AgentVaultV1.abi
  const oldVaultReadEnabled = !!oldVaultAddress && !!address

  const { data: oldUserETHRaw } = useReadContract({
    address: oldVaultAddress, abi: oldVaultAbi, functionName: 'userETHBalance', args: [address!],
    query: { enabled: oldVaultReadEnabled },
  })
  const { data: oldUserBEANRaw } = useReadContract({
    address: oldVaultAddress, abi: oldVaultAbi, functionName: 'userBEANBalance', args: [address!],
    query: { enabled: oldVaultReadEnabled },
  })
  const { data: oldHasLockedRaw } = useReadContract({
    address: oldVaultAddress, abi: oldVaultAbi, functionName: 'hasLockedBEAN', args: [address!],
    query: { enabled: oldVaultReadEnabled },
  })
  const { data: oldPendingWithdrawalRaw } = useReadContract({
    address: oldVaultAddress, abi: oldVaultAbi, functionName: 'userPendingWithdrawal', args: [address!],
    query: { enabled: oldVaultReadEnabled },
  })

  const oldUserETH = oldUserETHRaw ? parseFloat(formatEther(oldUserETHRaw as bigint)) : 0
  const oldUserBEAN = oldUserBEANRaw ? parseFloat(formatEther(oldUserBEANRaw as bigint)) : 0
  const oldHasLockedBEAN = !!oldHasLockedRaw
  const oldPendingWithdrawal = oldPendingWithdrawalRaw as [bigint, bigint, boolean] | undefined
  const oldPendingETH = oldPendingWithdrawal ? parseFloat(formatEther(oldPendingWithdrawal[0])) : 0
  const oldPendingResolved = oldPendingWithdrawal ? oldPendingWithdrawal[2] : false
  const hasOldVaultBalance = oldUserETH > 0 || oldUserBEAN > 0 || oldHasLockedBEAN || oldPendingETH > 0

  // Pending withdrawal
  const pendingWithdrawal = pendingWithdrawalRaw as [bigint, bigint, boolean] | undefined
  const pendingETHAmount = pendingWithdrawal ? formatEther(pendingWithdrawal[0]) : '0'
  const pendingBEANAmount = pendingWithdrawal ? formatEther(pendingWithdrawal[1]) : '0'
  const pendingResolved = pendingWithdrawal ? pendingWithdrawal[2] : false
  const hasPendingWithdrawal = pendingWithdrawal ? pendingWithdrawal[0] > BigInt(0) : false

  const vaultStats = {
    userDeposited: userETHInVault,
    userSharePct,
    availableToWithdraw: userETHInVault,
    pendingAllocation: pendingDep,
    lockedBean: hasLockedBEAN ? beanLockAmount : '0',
    totalPooled,
    beanEarned: userBEANInVault,
  }

  // Layer 2 wrong-network gate - every tx handler diverts to switchToBase() when wallet is off-chain.
  const { isOnBase, switchToBase } = useIsOnBase()

  // ── Write contracts ──
  const { writeContract: writeApprove, data: approveTxHash } = useWriteContract({ mutation: { onError: () => setDepositStep('idle') } })
  const { writeContract: writeLock, data: lockTxHash } = useWriteContract({ mutation: { onError: () => setDepositStep('idle') } })
  const { writeContract: writeDeposit, data: depositTxHash } = useWriteContract({ mutation: { onError: () => setDepositStep('idle') } })
  const { writeContractAsync: writeWithdrawETHAsync, data: withdrawETHTxHash } = useWriteContract()
  const { writeContractAsync: writeClaimBEANAsync, data: claimBEANTxHash } = useWriteContract()
  const { writeContract: writeClaimPending, data: claimPendingTxHash } = useWriteContract()

  // Transaction receipts
  const { isSuccess: approveConfirmed, isError: approveReverted } = useWaitForTransactionReceipt({ hash: approveTxHash })
  const { isSuccess: lockConfirmed, isError: lockReverted } = useWaitForTransactionReceipt({ hash: lockTxHash })
  const { isSuccess: depositConfirmed, isError: depositReverted } = useWaitForTransactionReceipt({ hash: depositTxHash })
  const { isSuccess: withdrawETHConfirmed, isError: withdrawReverted } = useWaitForTransactionReceipt({ hash: withdrawETHTxHash })
  const { isSuccess: claimBEANConfirmed, isError: claimBEANReverted } = useWaitForTransactionReceipt({ hash: claimBEANTxHash })
  const { isSuccess: claimPendingConfirmed, isError: claimPendingReverted } = useWaitForTransactionReceipt({ hash: claimPendingTxHash })

  // Approve confirmed → reset step (UI will auto-show lock button since allowance is now sufficient)
  useEffect(() => {
    if (approveConfirmed && depositStep === 'approving') {
      setDepositStep('idle')
    }
  }, [approveConfirmed])

  // Lock confirmed → reset step (UI will auto-show deposit form since hasLockedBEAN is now true)
  useEffect(() => {
    if (lockConfirmed && depositStep === 'locking') {
      setDepositStep('idle')
    }
  }, [lockConfirmed])

  // Deposit confirmed
  useEffect(() => {
    if (depositConfirmed && depositStep === 'depositing') {
      setDepositStep('done')
      queryClient.invalidateQueries()
      setTimeout(() => setDepositStep('idle'), 3000)
    }
  }, [depositConfirmed])

  // On-chain revert handling - reset UI when tx submits but reverts
  useEffect(() => { if (approveReverted) setDepositStep('idle') }, [approveReverted])
  useEffect(() => { if (lockReverted) setDepositStep('idle') }, [lockReverted])
  useEffect(() => { if (depositReverted) setDepositStep('idle') }, [depositReverted])
  useEffect(() => { if (withdrawReverted) setWithdrawPending(false) }, [withdrawReverted])

  // Withdraw confirmed - invalidate all queries to force fresh contract reads
  useEffect(() => {
    if (withdrawETHConfirmed || withdrawReverted) {
      setWithdrawPending(false)
      queryClient.invalidateQueries()
    }
  }, [withdrawETHConfirmed, withdrawReverted])

  // Claim BEAN confirmed
  useEffect(() => {
    if (claimBEANConfirmed || claimBEANReverted) { setClaimBeanPending(false); queryClient.invalidateQueries() }
  }, [claimBEANConfirmed, claimBEANReverted])

  // Claim pending withdrawal confirmed
  useEffect(() => {
    if (claimPendingConfirmed) {
      queryClient.invalidateQueries()
    }
  }, [claimPendingConfirmed])

  // Refetch vault data periodically
  useEffect(() => {
    if (!vaultReadEnabled) return
    const interval = setInterval(() => {
      refetchUserETH(); refetchShares(); refetchUserBEAN(); refetchPending()
    }, 30_000)
    return () => clearInterval(interval)
  }, [vaultReadEnabled])

  // ── Handlers ──
  const handleInvestClick = () => {
    const disclaimerKey = `vault_disclaimer_${agent?.id}`
    if (typeof window !== 'undefined' && localStorage.getItem(disclaimerKey)) {
      setShowInvestModal(true)
    } else {
      setShowDisclaimer(true)
    }
  }

  const handleDisclaimerAccept = () => {
    const disclaimerKey = `vault_disclaimer_${agent?.id}`
    if (typeof window !== 'undefined') localStorage.setItem(disclaimerKey, '1')
    setShowDisclaimer(false)
    setShowInvestModal(true)
  }

  const handleApproveBEAN = () => {
    if (!vaultAddress) return
    if (!isOnBase) { switchToBase(); return }
    setDepositStep('approving')
    writeApprove({
      chainId: base.id,
      address: CONTRACTS.Bean.address,
      abi: CONTRACTS.Bean.abi,
      functionName: 'approve',
      args: [vaultAddress, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')], // infinite approval
    })
  }

  const handleLockBEAN = () => {
    if (!vaultAddress) return
    if (!isOnBase) { switchToBase(); return }
    setDepositStep('locking')
    writeLock({ chainId: base.id, address: vaultAddress, abi: vaultAbi, functionName: 'lockBEAN' })
  }

  const handleDepositETH = (amount: string) => {
    if (!vaultAddress || !hasLockedBEAN) return
    if (!isOnBase) { switchToBase(); return }
    setDepositStep('depositing')
    writeDeposit({ chainId: base.id, address: vaultAddress, abi: vaultAbi, functionName: 'deposit', value: parseEther(amount) })
  }

  const handleWithdrawETH = async () => {
    if (!vaultAddress || userShares === BigInt(0)) return
    if (!isOnBase) { switchToBase(); return }
    setWithdrawPending(true)
    try {
      await writeWithdrawETHAsync({ chainId: base.id, address: vaultAddress, abi: vaultAbi, functionName: 'withdrawETH' })
      setTimeout(() => { setWithdrawPending(false); queryClient.invalidateQueries() }, 3000)
    } catch { setWithdrawPending(false) }
  }

  const handleWithdrawBEAN = async () => {
    // unlockBEAN returns locked BEAN after withdrawing ETH
    if (!vaultAddress) return
    if (!isOnBase) { switchToBase(); return }
    setWithdrawPending(true)
    try {
      await writeWithdrawETHAsync({ chainId: base.id, address: vaultAddress, abi: vaultAbi, functionName: 'unlockBEAN' })
      setTimeout(() => { setWithdrawPending(false); queryClient.invalidateQueries() }, 3000)
    } catch { setWithdrawPending(false) }
  }

  const handleClaimBEAN = async () => {
    if (!vaultAddress) return
    if (!isOnBase) { switchToBase(); return }
    setClaimBeanPending(true)
    try {
      await writeClaimBEANAsync({ chainId: base.id, address: vaultAddress, abi: vaultAbi, functionName: 'claimBEAN' })
      setTimeout(() => { setClaimBeanPending(false); queryClient.invalidateQueries() }, 3000)
    } catch { setClaimBeanPending(false) }
  }

  const handleClaimPendingETH = () => {
    if (!vaultAddress) return
    if (!isOnBase) { switchToBase(); return }
    writeClaimPending({ chainId: base.id, address: vaultAddress, abi: vaultAbi, functionName: 'claimPendingWithdrawal' })
  }

  // ── x402 paid mining handler + round info plumbing ──
  // Lightweight: only runs when the x402 tab is actually visible (modal open
  // AND the agent has x402Enabled). Keeps an API call out of every page load.
  const { data: walletClient } = useWalletClient()
  const { sendTransactionAsync } = useSendTransaction()

  useEffect(() => {
    if (!showInvestModal || !agent?.x402Enabled) return
    let cancelled = false
    const fetchRound = async () => {
      try {
        const qs = address ? `?user=${address}` : ''
        const data = await apiFetch<{ roundId: string; endTime: number; userDeployedFormatted?: string }>(`/api/round/current${qs}`)
        if (cancelled) return
        setX402RoundInfo({
          roundId: data.roundId,
          endTime: data.endTime,
          userDeployedFormatted: data.userDeployedFormatted ?? '0',
        })
      } catch (e) {
        console.error('[x402] round fetch failed', e)
      }
    }
    fetchRound()
    return () => { cancelled = true }
  }, [showInvestModal, agent?.x402Enabled, address])

  // 1Hz tick for the X402Tab timer-based pre-flight check (round-ending guard).
  useEffect(() => {
    if (!showInvestModal || !x402RoundInfo) return
    const tick = () => {
      const remaining = Math.max(0, x402RoundInfo.endTime - Math.floor(Date.now() / 1000))
      setX402TimeRemaining(remaining)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [showInvestModal, x402RoundInfo])

  // x402 single-flight + cancel-on-close. The flight ref guards against
  // rapid double-clicks before React re-renders the disabled button. The abort
  // ref is set true on modal close so any in-flight await bails before
  // prompting the next wallet signature on a closed modal.
  const x402InFlightRef = React.useRef(false)
  const x402AbortRef = React.useRef(false)

  const handleX402Mine = async () => {
    if (x402InFlightRef.current) {
      console.warn('[x402] already in-flight, ignoring re-entrant call')
      return
    }
    if (!walletClient || !address || !agent) {
      // Pre-flight failure: no payment has occurred yet, so do NOT set 'error'
      // (which would surface the "fee consumed" banner). Leave step at 'idle'
      // and bail silently — the UI's button pre-flight should have blocked
      // the click in the first place.
      console.warn('[x402] wallet not ready — handler called before pre-flight settled')
      return
    }
    if (!isOnBase) { switchToBase(); return }
    x402InFlightRef.current = true
    x402AbortRef.current = false
    setX402Decision(null)
    setX402TxHash(null)
    try {
      setX402Step('signing-payment')
      // The dev's endpoint resolves apiAgentId-style strings to strategy ids.
      // agents.ts uses 'antiwinner' (no hyphen) for the contract-side id; the
      // x402 spec wants 'anti-winner' (hyphenated). Map here so we don't need
      // to touch agents.ts (which feeds other surfaces). beanpot-hunter is
      // intentionally NOT exposed via x402 — its tab is gated upstream by
      // agent.x402Enabled === false in lib/agents.ts.
      const strategy = mapAgentIdToStrategy(agent.apiAgentId)
      const decision = await payAndFetchDecision({ walletClient, strategy })
      if (x402AbortRef.current) {
        console.warn('[x402] aborted after payment — USDC settled but no deploy will broadcast')
        return
      }
      setX402Decision(decision)

      // fire:false → recommendation is "skip this round". Show it via the
      // 'done' step so the X402Tab can render the reason + ROI without
      // prompting a deploy signature. No broadcast happens.
      if (!decision.fire) {
        setX402Step('done')
        return
      }

      // Re-check chain before prompting the deploy signature. User may have
      // switched networks between signing USDC and now; if so, sendTransaction
      // would throw ChainMismatchError and the USDC fee is lost with no
      // clear user feedback.
      if (!isOnBase) {
        console.error('[x402] chain switched after payment — bailing')
        setX402Step('error')
        return
      }
      // Client-side safety net. Throws X402ClientError on mismatch which the
      // catch handles. Validates to/selector/value/blocks (suffix is checked
      // separately via withBuilderCodeSuffix below).
      assertSafeStrategyDecision(decision)
      // ensure ERC-8021 attribution lands regardless of whether dev's server
      // already appended the suffix. Idempotent — no-ops if suffix is present.
      const dataWithSuffix = withBuilderCodeSuffix(decision.tx!.data)

      setX402Step('signing-deploy')
      const txHash = await sendTransactionAsync({
        chainId: base.id,
        to: decision.tx!.to,
        data: dataWithSuffix,
        value: BigInt(decision.tx!.value),
      })
      if (x402AbortRef.current) {
        console.warn('[x402] aborted after broadcast')
        return
      }
      setX402Step('broadcasting')
      setX402TxHash(txHash)
      console.log('[x402] deploy tx submitted', txHash)
      // Optimistic deploy lock — see ratchet comment below.
      setX402RoundInfo(prev => prev ? { ...prev, userDeployedFormatted: decision.amountFormatted } : prev)
      setX402Step('done')
      refetchUsdc()
      // Refresh round info. Ratchet on userDeployedFormatted: the backend
      // indexer may lag behind tx submission and report '0' for several
      // seconds. Never let the server overwrite our optimistic lock with a
      // smaller value — that would momentarily re-enable the MINE button.
      const qs = address ? `?user=${address}` : ''
      apiFetch<{ roundId: string; endTime: number; userDeployedFormatted?: string }>(`/api/round/current${qs}`)
        .then(data => {
          if (x402AbortRef.current) return
          setX402RoundInfo(prev => {
            // Coerce both sides through Number.isFinite — a malicious or
            // malformed server response could return non-numeric strings
            // ('NaN', '1e308', 'abc') which would otherwise NaN-poison the
            // Math.max and unstick the optimistic lock.
            const rawOptimistic = parseFloat(prev?.userDeployedFormatted ?? '0')
            const rawServer = parseFloat(data.userDeployedFormatted ?? '0')
            const optimistic = Number.isFinite(rawOptimistic) ? rawOptimistic : 0
            const serverVal = Number.isFinite(rawServer) ? rawServer : 0
            const merged = Math.max(optimistic, serverVal)
            return {
              roundId: data.roundId,
              endTime: data.endTime,
              userDeployedFormatted: merged > 0 ? merged.toString() : '0',
            }
          })
        })
        .catch(() => { /* non-fatal */ })
    } catch (e) {
      if (e instanceof X402ClientError) {
        console.error('[x402] client error', e.code, e.message, e.details)
      } else {
        console.error('[x402] unexpected error', e)
      }
      if (!x402AbortRef.current) setX402Step('error')
    } finally {
      x402InFlightRef.current = false
    }
  }

  // Maps lib/agents.ts apiAgentId values to the strategy ids the dev's x402
  // endpoint accepts. agents.ts uses contract-side ids (antiwinner, hunter);
  // the API spec uses hyphenated form. Kept local because it's only used here.
  function mapAgentIdToStrategy(apiAgentId: string): StrategyId {
    switch (apiAgentId) {
      case 'antiwinner': return 'anti-winner'
      case 'anti-loser': return 'anti-loser'
      case 'sniper': return 'sniper'
      case 'nostradamus': return 'nostradamus'
      default:
        // Should never hit because agent.x402Enabled gates the UI, but fail
        // loud rather than send a request that will 400.
        throw new X402ClientError('UNSUPPORTED_STRATEGY', `Agent ${apiAgentId} is not exposed via x402`)
    }
  }

  // ── Old vault handlers ──
  const [oldVaultPending, setOldVaultPending] = useState(false)

  const handleOldVaultWithdraw = async () => {
    if (!oldVaultAddress) return
    if (!isOnBase) { switchToBase(); return }
    setOldVaultPending(true)
    try {
      await writeWithdrawETHAsync({ chainId: base.id, address: oldVaultAddress, abi: oldVaultAbi, functionName: 'unlockBEAN' })
      setTimeout(() => { setOldVaultPending(false); queryClient.invalidateQueries() }, 3000)
    } catch { setOldVaultPending(false) }
  }

  const handleOldVaultClaimBEAN = async () => {
    if (!oldVaultAddress) return
    if (!isOnBase) { switchToBase(); return }
    setOldVaultPending(true)
    try {
      await writeClaimBEANAsync({ chainId: base.id, address: oldVaultAddress, abi: oldVaultAbi, functionName: 'claimBEAN' })
      setTimeout(() => { setOldVaultPending(false); queryClient.invalidateQueries() }, 3000)
    } catch { setOldVaultPending(false) }
  }

  const handleOldVaultClaimPending = async () => {
    if (!oldVaultAddress) return
    if (!isOnBase) { switchToBase(); return }
    setOldVaultPending(true)
    try {
      await writeWithdrawETHAsync({ chainId: base.id, address: oldVaultAddress, abi: oldVaultAbi, functionName: 'claimPendingWithdrawal' })
      setTimeout(() => { setOldVaultPending(false); queryClient.invalidateQueries() }, 3000)
    } catch { setOldVaultPending(false) }
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Fetch pre-calculated stats + round history, auto-refresh every 120s
  useEffect(() => {
    if (!agent) return
    function fetchData() {
      apiFetch<{ agents: Record<string, AgentStats> }>('/api/agents/stats')
        .then(res => {
          const agentStats = res.agents[agent!.apiAgentId]
          if (!agentStats) return
          setStats(agentStats)
          // Fetch round history using the vault address from backend
          return fetchAgentRounds(agentStats.address, HISTORY_PAGES, agentStats.beanPriceEth, agent!.oldVaultAddress)
            .then(setRounds)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
    fetchData()
    const interval = setInterval(fetchData, 120_000)
    return () => clearInterval(interval)
  }, [agent?.apiAgentId])

  // Fetch vault stats from API
  useEffect(() => {
    if (!agent) return
    apiFetch<{ vaults: Record<string, any> }>('/api/agents/vaults')
      .then(res => {
        const v = res.vaults?.[agent.apiAgentId]
        if (v) setVaultApiData(v)
      })
      .catch(() => {})
  }, [agent?.apiAgentId])

  if (!agent) notFound()

  // Loading state
  if (loading || !stats) {
    return (
      <div style={s.page}>
        <AgentHeader currentPage="agents" />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'Space Mono', monospace", fontSize: 13 }}>
            Loading agent data...
          </span>
        </main>
      </div>
    )
  }

  const isPositive = stats.netPnl >= 0
  const agentNum = String(parseInt(agent.id.replace('agent', ''))).padStart(3, '0')

  // Sparkline chart
  const sparkData = stats.sparkline
  const sparkMin = Math.min(...sparkData)
  const sparkMax = Math.max(...sparkData)
  const sparkRange = sparkMax - sparkMin || 1
  const chartW = 400, chartH = 80
  const sparkPoints = sparkData.map((v, i) => {
    const x = (i / (sparkData.length - 1)) * chartW
    const y = chartH - ((v - sparkMin) / sparkRange) * (chartH - 4) - 2
    return `${x},${y}`
  }).join(' ')

  // Derived stats from rounds
  const settledRounds = rounds.filter(r => r.settled)
  const avgPosition = stats.roundsPlayed > 0 ? stats.totalDeployed / stats.roundsPlayed : 0
  const bestRound = settledRounds.length > 0 ? Math.max(...settledRounds.map(r => r.truePnl)) : 0
  const worstRound = settledRounds.length > 0 ? Math.min(...settledRounds.map(r => r.truePnl)) : 0
  const wins = stats.roundsPlayed > 0 ? Math.round(stats.winRate * stats.roundsPlayed / 100) : 0
  const losses = stats.roundsPlayed - wins

  // Pagination
  const totalPages = Math.ceil(rounds.length / ROWS_PER_PAGE)
  const pagedRounds = rounds.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)

  return (
    <div className="agent-page" style={s.page}>
      <style>{`
        @media (max-width: 768px) {
          .agent-page { height: auto !important; min-height: 100vh !important; overflow: auto !important; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
        .back-link:hover { color: rgba(255,255,255,0.7) !important; }
        .rounds-scroll::-webkit-scrollbar { width: 4px; }
        .rounds-scroll::-webkit-scrollbar-track { background: transparent; }
        .rounds-scroll::-webkit-scrollbar-thumb { background: rgba(0,82,255,0.3); border-radius: 2px; }
        .left-sidebar::-webkit-scrollbar { display: none; }
        .left-sidebar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <AgentHeader currentPage="agents" />

      <main style={{
        flex: isMobile ? undefined : 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? '12px 16px 100px' : '10px 40px 10px',
      }}>

        {/* Back */}
        <div style={{ maxWidth: 1400, width: '100%', margin: '0 auto', paddingBottom: 10, flexShrink: 0, position: 'relative', zIndex: 2 }}>
          <Link href="/agents" className="back-link" style={s.back}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            ALL AGENTS
          </Link>
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'flex',
          gap: 28,
          flexDirection: isMobile ? 'column' : 'row',
          flex: 1,
          minHeight: 0,
          maxWidth: 1400,
          width: '100%',
          margin: '0 auto',
        }}>

          {/* ── Left sidebar ── */}
          <div className="left-sidebar" style={{
            width: isMobile ? '100%' : 340,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflowY: isMobile ? undefined : 'auto',
            padding: isMobile ? 0 : 30,
            margin: isMobile ? 0 : -30,
          }}>
            <NeonCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Top */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={s.agentId}>AGENT_{agentNum}</span>
                  <StatusDot status={agent.status} />
                </div>

                {/* Name */}
                <h1 style={s.title}>{agent.name}</h1>

                {/* Strategy detail */}
                <p style={s.strategyDetail}>{agent.strategyDetail}</p>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

                {/* Stats grid */}
                <div style={s.statsGrid}>
                  <div style={s.gridStat}>
                    <span style={s.gridStatVal}>{stats.winRate}%</span>
                    <span style={s.gridStatLabel}>WIN RATE</span>
                  </div>
                  <div style={s.gridStat}>
                    <span style={s.gridStatVal}>
                      {isPositive ? '+' : ''}{stats.roi}%
                    </span>
                    <span style={s.gridStatLabel}>NET ROI</span>
                  </div>
                  <div style={s.gridStat}>
                    <span style={s.gridStatVal}>{stats.roundsPlayed}</span>
                    <span style={s.gridStatLabel}>ROUNDS</span>
                  </div>
                  <div style={s.gridStat}>
                    <span style={s.gridStatVal}>{stats.totalDeployed.toFixed(2)}</span>
                    <span style={s.gridStatLabel}>DEPLOYED</span>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

                {/* Detail rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['TOTAL DEPLOYED', `${(stats.totalDeployed7d ?? stats.totalDeployed).toFixed(4)} ETH`],
                    ['ETH WON', `${stats.totalWon.toFixed(4)} ETH`],
                    ['ETH P&L', `${stats.ethPnl >= 0 ? '+' : ''}${stats.ethPnl.toFixed(4)} ETH`],
                    ['BEAN EARNED', `${stats.totalBeanEarned > 1000 ? `${(stats.totalBeanEarned / 1000).toFixed(1)}k` : stats.totalBeanEarned < 1 ? stats.totalBeanEarned.toFixed(4) : stats.totalBeanEarned.toFixed(1)}`],
                    ['BEAN VALUE', `+${stats.totalBeanEarnedEth.toFixed(4)} ETH`],
                    ['TRUE P&L', `${isPositive ? '+' : ''}${stats.netPnl.toFixed(4)} ETH`],
                    ['LAST ACTIVE', stats.lastActive],
                  ].map(([label, val], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={s.detailLabel}>{label}</span>
                      <span style={s.detailVal}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* Invest button - coming soon for agents without vaults */}
                {!agent.vaultAddress && (
                  <>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <button
                      disabled
                      style={{
                        width: '100%', padding: '14px 0',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.02)',
                        color: 'rgba(255,255,255,0.25)',
                        fontSize: 14, fontWeight: 700,
                        fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
                        cursor: 'not-allowed',
                        opacity: 0.6,
                      }}
                    >
                      INVEST - COMING SOON
                    </button>
                  </>
                )}

                {/* Invest button - only for agents with vaults */}
                {agent.vaultAddress && (
                  <>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <button
                      onClick={handleInvestClick}
                      style={{
                        width: '100%', padding: '14px 0',
                        border: '1px solid rgba(0,82,255,0.5)',
                        borderRadius: 10,
                        background: 'rgba(0,82,255,0.15)',
                        color: '#fff',
                        fontSize: 14, fontWeight: 700,
                        fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
                        cursor: 'pointer',
                        boxShadow: '0 0 15px rgba(0,82,255,0.15), 0 0 30px rgba(0,82,255,0.08), inset 0 0 15px rgba(0,82,255,0.06)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      INVEST
                    </button>

                    {/* Custom Params - opens config drawer with custom params + backtest */}
                    <button
                      onClick={() => setShowAgentConfig(true)}
                      style={{
                        marginTop: 8,
                        width: '100%', padding: '14px 0',
                        border: '1px solid rgba(0,82,255,0.3)',
                        borderRadius: 10,
                        background: 'rgba(0,82,255,0.06)',
                        color: '#fff',
                        fontSize: 14, fontWeight: 700,
                        fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
                        cursor: 'pointer',
                        boxShadow: '0 0 10px rgba(0,82,255,0.08), inset 0 0 10px rgba(0,82,255,0.04)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0,82,255,0.5)'
                        e.currentTarget.style.background = 'rgba(0,82,255,0.12)'
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(0,82,255,0.15), 0 0 30px rgba(0,82,255,0.08), inset 0 0 15px rgba(0,82,255,0.06)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0,82,255,0.3)'
                        e.currentTarget.style.background = 'rgba(0,82,255,0.06)'
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(0,82,255,0.08), inset 0 0 10px rgba(0,82,255,0.04)'
                      }}
                    >
                      CUSTOM INVEST
                    </button>

                    {/* Pending vault claim - shows when user has resolved ETH from mid-round withdrawal */}
                    {hasPendingWithdrawal && pendingResolved && parseFloat(pendingETHAmount) > 0 && (
                      <div style={{
                        marginTop: 8,
                        padding: '10px 14px',
                        background: 'rgba(0,82,255,0.06)',
                        border: '1px solid rgba(0,82,255,0.15)',
                        borderRadius: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <div>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block' }}>PENDING VAULT CLAIM</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'Space Mono', monospace" }}>{parseFloat(pendingETHAmount).toFixed(6)} ETH</span>
                        </div>
                        <button
                          onClick={isOnBase ? handleClaimPendingETH : switchToBase}
                          style={{
                            padding: '6px 14px',
                            background: isOnBase ? 'rgba(0,82,255,0.15)' : 'rgba(255,77,77,0.18)',
                            border: `1px solid ${isOnBase ? 'rgba(0,82,255,0.3)' : 'rgba(255,77,77,0.5)'}`,
                            borderRadius: 8,
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: "'Space Mono', monospace",
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {isOnBase ? 'CLAIM ETH' : 'SWITCH TO BASE'}
                        </button>
                      </div>
                    )}

                    {/* Legacy vault - shows when user has balance in old vault contract */}
                    {hasOldVaultBalance && isConnected && (
                      <div style={{
                        marginTop: 8,
                        padding: '12px 14px',
                        background: 'rgba(0,200,100,0.04)',
                        border: '1px solid rgba(0,200,100,0.15)',
                        borderRadius: 10,
                      }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>CLAIMABLE BALANCE</span>
                        {oldUserETH > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: '#fff', fontFamily: "'Space Mono', monospace" }}>{oldUserETH.toFixed(4)} ETH</span>
                          </div>
                        )}
                        {oldUserBEAN > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: '#fff', fontFamily: "'Space Mono', monospace" }}>{oldUserBEAN.toFixed(4)} BEAN</span>
                          </div>
                        )}
                        {oldHasLockedBEAN && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: "'Space Mono', monospace" }}>BEAN locked</span>
                          </div>
                        )}
                        {oldPendingETH > 0 && oldPendingResolved && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: '#fff', fontFamily: "'Space Mono', monospace" }}>{oldPendingETH.toFixed(4)} ETH (pending)</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          {!isOnBase ? (
                            <button
                              onClick={switchToBase}
                              style={{
                                flex: 1, padding: '8px 0',
                                background: 'rgba(255,77,77,0.18)',
                                border: '1px solid rgba(255,77,77,0.5)',
                                borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700,
                                fontFamily: "'Space Mono', monospace", cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              SWITCH TO BASE
                            </button>
                          ) : (<>
                          {(oldUserETH > 0 || oldHasLockedBEAN) && (
                            <button
                              onClick={handleOldVaultWithdraw}
                              disabled={oldVaultPending}
                              style={{
                                flex: 1, padding: '8px 0',
                                background: 'rgba(0,200,100,0.1)',
                                border: '1px solid rgba(0,200,100,0.25)',
                                borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700,
                                fontFamily: "'Space Mono', monospace", cursor: oldVaultPending ? 'not-allowed' : 'pointer',
                                opacity: oldVaultPending ? 0.5 : 1, transition: 'all 0.2s ease',
                              }}
                            >
                              {oldVaultPending ? 'PROCESSING...' : 'WITHDRAW'}
                            </button>
                          )}
                          {oldUserBEAN > 0 && !oldHasLockedBEAN && (
                            <button
                              onClick={handleOldVaultClaimBEAN}
                              disabled={oldVaultPending}
                              style={{
                                flex: 1, padding: '8px 0',
                                background: 'rgba(0,200,100,0.1)',
                                border: '1px solid rgba(0,200,100,0.25)',
                                borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700,
                                fontFamily: "'Space Mono', monospace", cursor: oldVaultPending ? 'not-allowed' : 'pointer',
                                opacity: oldVaultPending ? 0.5 : 1, transition: 'all 0.2s ease',
                              }}
                            >
                              {oldVaultPending ? 'PROCESSING...' : 'CLAIM BEAN'}
                            </button>
                          )}
                          {oldPendingETH > 0 && oldPendingResolved && (
                            <button
                              onClick={handleOldVaultClaimPending}
                              disabled={oldVaultPending}
                              style={{
                                flex: 1, padding: '8px 0',
                                background: 'rgba(0,200,100,0.1)',
                                border: '1px solid rgba(0,200,100,0.25)',
                                borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700,
                                fontFamily: "'Space Mono', monospace", cursor: oldVaultPending ? 'not-allowed' : 'pointer',
                                opacity: oldVaultPending ? 0.5 : 1, transition: 'all 0.2s ease',
                              }}
                            >
                              {oldVaultPending ? 'PROCESSING...' : 'CLAIM ETH'}
                            </button>
                          )}
                          </>)}
                        </div>
                      </div>
                    )}

                    {/* Vault Stats button */}
                    <button
                      onClick={() => setShowVaultStats(true)}
                      style={{
                        width: '100%', padding: '12px 0', marginTop: 8,
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10,
                        background: 'transparent',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 11, fontWeight: 700,
                        fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
                        e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                        e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                      }}
                    >
                      VAULT STATS
                    </button>

                  </>
                )}
              </div>
            </NeonCard>

          </div>

          {/* ── Right content ── */}
          <div style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 0,
          }}>

            {/* Analytics row */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
              {[
                { label: 'AVG POSITION', val: `${avgPosition.toFixed(4)}`, sub: 'ETH / round' },
                { label: 'BEST ROUND', val: `+${bestRound.toFixed(4)}`, sub: 'ETH' },
                { label: 'WORST ROUND', val: `${worstRound.toFixed(4)}`, sub: 'ETH' },
                { label: 'W / L', val: `${wins} / ${losses}`, sub: `${stats.winRate}% win rate` },
              ].map((item, i) => (
                <div key={i} style={s.analyticCard}>
                  <span style={s.analyticLabel}>{item.label}</span>
                  <span style={s.analyticVal}>{item.val}</span>
                  <span style={s.analyticSub}>{item.sub}</span>
                </div>
              ))}
            </div>

            {/* Performance chart */}
            <NeonCard style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={s.sectionLabel}>{'// PERFORMANCE - 7D'}</span>
                <span style={{
                  fontSize: 16, fontWeight: 700,
                  color: '#fff',
                  fontFamily: "'Space Mono', monospace",
                }}>
                  {isPositive ? '+' : ''}{stats.netPnl.toFixed(4)} ETH
                </span>
              </div>

              <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0052FF" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#0052FF" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {sparkMin < 0 && (
                  <line
                    x1="0" y1={chartH - ((-sparkMin) / sparkRange) * (chartH - 4) - 2}
                    x2={chartW} y2={chartH - ((-sparkMin) / sparkRange) * (chartH - 4) - 2}
                    stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4,4"
                  />
                )}
                <polygon points={`0,${chartH} ${sparkPoints} ${chartW},${chartH}`} fill="url(#chart-fill)" />
                <polyline points={sparkPoints} fill="none" stroke="#0052FF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              </svg>

            </NeonCard>

            {/* Round history */}
            <NeonCard fillHeight>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
                <span style={s.sectionLabel}>{'// ROUND HISTORY - 7D'}</span>
                <div style={{ display: 'flex', gap: 10, fontSize: 13, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{wins}W</span>
                  <span style={{ color: 'rgba(255,255,255,0.12)' }}>/</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{losses}L</span>
                </div>
              </div>

              {/* Table header */}
              <div style={{ ...s.tableRow, gridTemplateColumns: isMobile ? '70px 35px 1fr 1fr' : '80px 45px 1fr 1fr 1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8, marginBottom: 4, flexShrink: 0 }}>
                <span style={s.tableHeader}>ROUND</span>
                <span style={{ ...s.tableHeader, textAlign: 'center' }}>BLOCKS</span>
                <span style={{ ...s.tableHeader, textAlign: 'right' }}>DEPLOYED</span>
                {!isMobile && <span style={{ ...s.tableHeader, textAlign: 'right' }}>WON</span>}
                {!isMobile && <span style={{ ...s.tableHeader, textAlign: 'right' }}>BEAN</span>}
                <span style={{ ...s.tableHeader, textAlign: 'right' }}>P&L</span>
              </div>

              {/* Scrollable rows */}
              <div className="rounds-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {pagedRounds.map(r => (
                  <div key={r.id} style={{
                    ...s.tableRow,
                    gridTemplateColumns: isMobile ? '70px 35px 1fr 1fr' : '80px 45px 1fr 1fr 1fr 1fr',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: "'Space Mono', monospace" }}>#{r.id}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{relativeTime(r.timestamp)}</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={s.blockBadge}>{r.blocksCount}</span>
                    </div>
                    <span style={{ ...s.numCell, textAlign: 'right' }}>{r.deployed.toFixed(4)}</span>
                    {!isMobile && (
                      <span style={{ ...s.numCell, textAlign: 'right' }}>
                        {!r.settled ? ' - ' : r.won.toFixed(4)}
                      </span>
                    )}
                    {!isMobile && (
                      <span style={{ ...s.numCell, textAlign: 'right', color: r.beansEarned > 0 ? '#FFD700' : 'rgba(255,255,255,0.5)' }}>
                        {!r.settled ? ' - ' : r.beansEarned > 0 ? r.beansEarned.toFixed(4) : '0'}
                      </span>
                    )}
                    <div style={{ textAlign: 'right' }}>
                      {r.settled ? (
                        <>
                          <div style={{
                            fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                            color: '#fff',
                          }}>
                            {r.truePnl >= 0 ? '+' : ''}{r.truePnl.toFixed(4)}
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: "'Space Mono', monospace" }}>
                            {r.pctChange >= 0 ? '+' : ''}{r.pctChange}%
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: 10, color: 'rgba(0,82,255,0.5)', fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>PENDING</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination controls - always visible */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, paddingTop: 10, flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{
                    ...s.pageBtn,
                    opacity: page === 0 ? 0.2 : 1,
                    cursor: page === 0 ? 'default' : 'pointer',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: 'rgba(255,255,255,0.4)' }}>
                  {page + 1} / {totalPages}{' '}<span style={{ color: 'rgba(255,255,255,0.2)' }}>({rounds.length} rounds)</span>
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  style={{
                    ...s.pageBtn,
                    opacity: page === totalPages - 1 ? 0.2 : 1,
                    cursor: page === totalPages - 1 ? 'default' : 'pointer',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 6 15 12 9 18" /></svg>
                </button>
              </div>
            </NeonCard>

          </div>
        </div>
      </main>

      {isMobile && <AgentBottomNav currentPage="agents" />}

      {/* Disclaimer modal */}
      {showDisclaimer && (
        <div
          onClick={() => setShowDisclaimer(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0a0e1a',
              border: '1px solid rgba(0,120,255,0.5)',
              borderRadius: 16, padding: 28, maxWidth: 480, width: '100%',
              boxShadow: '0 0 30px rgba(0,82,255,0.3)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,82,255,0.5)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.08em', marginBottom: 12 }}>
              {'// DISCLAIMER'}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>
              Before you invest
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>
                This agent is powered by <strong style={{ color: '#fff' }}>autonomous AI</strong>. Its strategy is executed algorithmically with no human oversight on individual trades.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: '#fff' }}>Past performance is not indicative of future results.</strong> All statistics shown are computed from on-chain history and reflect real outcomes, but market conditions change.
              </p>
              <p style={{ margin: 0 }}>
                By investing, you acknowledge that you may <strong style={{ color: '#fff' }}>lose some or all of your deposited ETH</strong>. MineBean and its contributors are not liable for any losses incurred.
              </p>
              <p style={{ margin: 0 }}>
                This is <strong style={{ color: '#fff' }}>experimental technology</strong>. Only invest what you can afford to lose. Do your own research.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setShowDisclaimer(false)}
                style={{
                  flex: 1, padding: '12px 0', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, background: 'transparent', color: 'rgba(255,255,255,0.5)',
                  fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleDisclaimerAccept}
                style={{
                  flex: 1, padding: '12px 0', border: 'none',
                  borderRadius: 8, background: '#0052FF', color: '#fff',
                  fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                  cursor: 'pointer',
                }}
              >
                I UNDERSTAND, CONTINUE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invest modal */}
      <InvestModal
        isOpen={showInvestModal}
        onClose={() => {
          // Abort any in-flight x402 promise so it cannot prompt a wallet
          // signature on a closed modal. State is reset to idle for next open.
          x402AbortRef.current = true
          setShowInvestModal(false)
          setDepositStep('idle')
          setWithdrawPending(false)
          setClaimBeanPending(false)
          setX402Step('idle')
          setX402Decision(null)
          setX402TxHash(null)
        }}
        agentName={agent.name}
        isMobile={isMobile}
        isConnected={isConnected}
        userBeanBalance={userBeanBalance}
        userEthBalance={userEthBalance}
        vaultStats={vaultStats}
        beanAllowanceSufficient={beanAllowanceSufficient}
        hasLockedBEAN={hasLockedBEAN}
        beanLockAmount={beanLockAmount}
        onApproveBEAN={handleApproveBEAN}
        onLockBEAN={handleLockBEAN}
        onDepositETH={handleDepositETH}
        onWithdrawETH={handleWithdrawETH}
        onWithdrawBEAN={handleWithdrawBEAN}
        onClaimBEAN={handleClaimBEAN}
        onClaimPendingWithdrawal={handleClaimPendingETH}
        pendingWithdrawalETH={pendingETHAmount}
        pendingWithdrawalBEAN={pendingBEANAmount}
        pendingWithdrawalResolved={pendingResolved}
        hasPendingWithdrawal={hasPendingWithdrawal}
        depositStep={depositStep}
        withdrawPending={withdrawPending}
        claimBeanPending={claimBeanPending}
        depositsPaused={agent.status === 'paused'}
        agentX402Enabled={agent.x402Enabled}
        x402Step={x402Step}
        onX402Mine={handleX402Mine}
        userUsdcBalance={userUsdcBalance}
        roundTimeRemaining={x402TimeRemaining}
        hasDeployedThisRound={parseFloat(x402RoundInfo?.userDeployedFormatted ?? '0') > 0}
        x402Decision={x402Decision}
        x402TxHash={x402TxHash}
        x402StalenessSec={x402Decision ? gridStalenessSeconds(x402Decision) : null}
      />

      <VaultStatsModal
        isOpen={showVaultStats}
        onClose={() => setShowVaultStats(false)}
        agentName={agent.name}
        isMobile={isMobile}
        vaultData={vaultApiData ? { ...vaultApiData, address: agent.vaultAddress } : null}
        roundsPlayed={stats?.roundsPlayed}
        beanPriceEth={stats?.beanPriceEth}
      />

      {/* Agent strategy customization drawer */}
      <AgentConfigDrawer
        isOpen={showAgentConfig}
        onClose={() => setShowAgentConfig(false)}
        agentId={
          // Map FE apiAgentId → backend agentId per AGENT_CONFIG_API.md
          agent.apiAgentId === 'antiwinner' ? 'anti-winner'
          : agent.apiAgentId === 'hunter' ? 'beanpot-hunter'
          : agent.apiAgentId
        }
        agentName={agent.name}
        agentLabel={`AGENT_${String(parseInt(agent.id.replace('agent', ''))).padStart(3, '0')}`}
      />
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const s: { [key: string]: React.CSSProperties } = {
  page: { fontFamily: "'Inter', -apple-system, sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent' },

  back: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,82,255,0.5)', textDecoration: 'none', fontFamily: "'Space Mono', monospace", transition: 'color 0.15s' },

  agentId: { fontSize: 11, fontWeight: 700, color: 'rgba(0,82,255,0.5)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.08em' },
  title: { fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.02em' },
  strategyDetail: { fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.5 },

  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  gridStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 0' },
  gridStatVal: { fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: "'Space Mono', monospace" },
  gridStatLabel: { fontSize: 8, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Space Mono', monospace" },

  detailLabel: { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em' },
  detailVal: { fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: "'Space Mono', monospace" },

  analyticCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    background: 'linear-gradient(180deg, rgba(0,40,120,0.12) 0%, rgba(0,15,50,0.06) 100%)',
    border: '1px solid rgba(0,120,255,0.7)',
    borderRadius: 12, padding: '12px 8px',
    boxShadow: '0 0 8px rgba(0,120,255,0.7), 0 0 20px rgba(0,100,255,0.4), 0 0 45px rgba(0,80,255,0.2), 0 0 80px rgba(0,60,255,0.08), inset 0 0 20px rgba(0,100,255,0.08)',
  },
  analyticLabel: { fontSize: 8, color: 'rgba(255,255,255,0.25)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' },
  analyticVal: { fontSize: 14, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: '#fff' },
  analyticSub: { fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: "'Space Mono', monospace" },

  sectionLabel: { fontSize: 11, fontWeight: 700, color: 'rgba(0,82,255,0.5)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em' },
  chartLabel: { fontSize: 10, color: 'rgba(255,255,255,0.15)', fontFamily: "'Space Mono', monospace" },

  tableRow: { display: 'grid', alignItems: 'center', gap: 8 },
  tableHeader: { fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em' },
  blockBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 22, borderRadius: 5, fontSize: 11, fontWeight: 700, fontFamily: "'Space Mono', monospace", background: 'rgba(255,255,255,0.05)', color: '#fff' },
  numCell: { fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: "'Space Mono', monospace" },

  pageBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 6,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.5)',
    transition: 'background 0.15s',
  },
}
