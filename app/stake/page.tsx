'use client'

import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import StakePage from '@/components/StakePage'
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useState, useEffect, useCallback } from 'react'
import { maxUint256 } from 'viem'
import { CONTRACTS } from '@/lib/contracts'

export default function Stake() {
  const { address, isConnected } = useAccount()
  const { data: beanBalance, refetch: refetchBalance } = useBalance({
    address,
    token: CONTRACTS.Bean.address,
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.Bean.address,
    abi: CONTRACTS.Bean.abi,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.Staking.address] : undefined,
  })
  const [isMobile, setIsMobile] = useState(false)
  const [pendingApprovalAmount, setPendingApprovalAmount] = useState<bigint | undefined>()
  const [pendingCompoundFee, setPendingCompoundFee] = useState<bigint | undefined>()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const { writeContract, data: txHash } = useWriteContract()
  const { writeContract: writeContract2 } = useWriteContract()

  const { isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  // After approval confirms, send the deposit tx
  useEffect(() => {
    if (approvalConfirmed && pendingApprovalAmount !== undefined) {
      writeContract2({
        address: CONTRACTS.Staking.address,
        abi: CONTRACTS.Staking.abi,
        functionName: 'deposit',
        args: [pendingApprovalAmount],
        value: pendingCompoundFee ?? BigInt(0),
      })
      setPendingApprovalAmount(undefined)
      setPendingCompoundFee(undefined)
      refetchAllowance()
    }
  }, [approvalConfirmed, pendingApprovalAmount, pendingCompoundFee, writeContract2, refetchAllowance])

  const userBeanBalance = beanBalance ? parseFloat(beanBalance.formatted) : 0

  const handleDeposit = useCallback((amount: bigint, compoundFeeBnb?: bigint) => {
    if (!isConnected) return
    // Check if allowance is already sufficient — skip approve if so
    const currentAllowance = typeof allowance === 'bigint' ? allowance : BigInt(0)
    if (currentAllowance >= amount) {
      // Allowance sufficient — deposit directly
      writeContract2({
        address: CONTRACTS.Staking.address,
        abi: CONTRACTS.Staking.abi,
        functionName: 'deposit',
        args: [amount],
        value: compoundFeeBnb ?? BigInt(0),
      })
    } else {
      // Need approval first — store for the approval->deposit chain
      setPendingApprovalAmount(amount)
      setPendingCompoundFee(compoundFeeBnb)
      writeContract({
        address: CONTRACTS.Bean.address,
        abi: CONTRACTS.Bean.abi,
        functionName: 'approve',
        args: [CONTRACTS.Staking.address, maxUint256],
      })
    }
  }, [isConnected, allowance, writeContract, writeContract2])

  const handleWithdraw = useCallback((amount: bigint) => {
    if (!isConnected) return
    writeContract2({
      address: CONTRACTS.Staking.address,
      abi: CONTRACTS.Staking.abi,
      functionName: 'withdraw',
      args: [amount],
    })
  }, [isConnected, writeContract2])

  const handleClaimYield = useCallback(() => {
    if (!isConnected) return
    writeContract2({
      address: CONTRACTS.Staking.address,
      abi: CONTRACTS.Staking.abi,
      functionName: 'claimYield',
      args: [],
    })
  }, [isConnected, writeContract2])

  const handleCompound = useCallback(() => {
    if (!isConnected) return
    writeContract2({
      address: CONTRACTS.Staking.address,
      abi: CONTRACTS.Staking.abi,
      functionName: 'compound',
      args: [],
    })
  }, [isConnected, writeContract2])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: isMobile ? '80px' : '0' }}>
      <Header currentPage="stake" isMobile={isMobile} />
      <StakePage
        isConnected={isConnected}
        userAddress={address}
        userBalance={userBeanBalance}
        isMobile={isMobile}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
        onClaimYield={handleClaimYield}
        onCompound={handleCompound}
        onRefetchBalance={refetchBalance}
      />
      {isMobile && <BottomNav currentPage="stake" />}
    </div>
  )
}
