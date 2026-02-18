'use client'

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { parseEther } from 'viem'
import BeanLogo from './BeanLogo'
import { apiFetch } from '../lib/api'
import { useSSE } from '../lib/SSEContext'
import { useUserData } from '../lib/UserDataContext'

interface StakePageProps {
    userAddress?: string
    userBalance?: number
    isConnected?: boolean
    isMobile?: boolean
    onDeposit?: (amount: bigint, compoundFeeBnb?: bigint) => void
    onWithdraw?: (amount: bigint) => void
    onClaimYield?: () => void
    onCompound?: () => void
    onRefetchBalance?: () => void
}

interface StakingStats {
    totalStaked: string
    totalStakedFormatted: string
    apr: string
    tvlUsd: string
}

export default function StakePage({
    userAddress: _userAddress,
    userBalance = 0,
    isConnected = false,
    isMobile = false,
    onDeposit,
    onWithdraw,
    onClaimYield,
    onCompound,
    onRefetchBalance,
}: StakePageProps) {
    const { openConnectModal } = useConnectModal()
    const { subscribeGlobal, subscribeUser } = useSSE()

    const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit")
    const [amount, setAmount] = useState("")
    const [beansPrice, setBeansPrice] = useState<number>(0.0264)
    const [showCalculator, setShowCalculator] = useState(false)
    const [calcAmount, setCalcAmount] = useState("1000")

    // Auto-compound
    const [autoCompoundEnabled, setAutoCompoundEnabled] = useState(false)
    const [compoundFeeBnb, setCompoundFeeBnb] = useState("0.006")
    const [showAutoCompoundInfo, setShowAutoCompoundInfo] = useState(false)
    const autoCompoundInfoRef = useRef<HTMLDivElement>(null)

    // Tooltip state
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

    // Real data
    const [stakingStats, setStakingStats] = useState<StakingStats | null>(null)
    const { stakeInfo: userStakeInfo, refetchStakeInfo } = useUserData()

    // Fetch BEAN price
    useEffect(() => {
        const fetchBeansPrice = async () => {
            try {
                const response = await fetch(
                    "https://api.dexscreener.com/latest/dex/pairs/base/0x7e58f160b5b77b8b24cd9900c09a3e730215ac47"
                )
                const data = await response.json()
                if (data.pair?.priceUsd) {
                    setBeansPrice(parseFloat(data.pair.priceUsd))
                }
            } catch (error) {
                console.error("Failed to fetch BEAN price:", error)
            }
        }

        fetchBeansPrice()
        const interval = setInterval(fetchBeansPrice, 30000)
        return () => clearInterval(interval)
    }, [])

    // Fetch global staking stats
    const fetchStakingStats = useCallback(async () => {
        try {
            const stats = await apiFetch<StakingStats>('/api/staking/stats')
            setStakingStats(stats)
        } catch (err) {
            console.error('Failed to fetch staking stats:', err)
        }
    }, [])

    useEffect(() => {
        fetchStakingStats()
    }, [fetchStakingStats])

    // SSE: global yield distribution → refresh stats + user pending rewards
    useEffect(() => {
        const unsub = subscribeGlobal('yieldDistributed', () => {
            fetchStakingStats()
            refetchStakeInfo()
        })
        return () => unsub()
    }, [subscribeGlobal, fetchStakingStats, refetchStakeInfo])

    // SSE: user staking events → refresh stats (user stake info handled by UserDataContext)
    // Note: /api/staking/stats is cached (60s refresh) so we re-fetch immediately
    // and again after a delay to catch the next cache cycle
    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = []
        const refetchStatsWithDelay = () => {
            fetchStakingStats()
            const t = setTimeout(() => fetchStakingStats(), 10000)
            timers.push(t)
        }
        const unsub1 = subscribeUser('stakeDeposited', () => {
            // Staked balance update handled by UserDataContext via SSE
            // Refresh BEAN wallet balance via wagmi
            onRefetchBalance?.()
            refetchStatsWithDelay()
        })
        const unsub2 = subscribeUser('stakeWithdrawn', () => {
            // Staked balance update handled by UserDataContext via SSE
            // Refresh BEAN wallet balance via wagmi
            onRefetchBalance?.()
            refetchStatsWithDelay()
        })
        const unsub3 = subscribeUser('yieldCompounded', () => {
            // Staked balance + pendingRewards update handled by UserDataContext via SSE
            refetchStatsWithDelay()
        })
        return () => {
            unsub1(); unsub2(); unsub3()
            timers.forEach(t => clearTimeout(t))
        }
    }, [subscribeUser, fetchStakingStats, onRefetchBalance])

    // Close tooltip on outside click (mobile)
    useEffect(() => {
        if (!activeTooltip) return
        const handleClick = () => setActiveTooltip(null)
        const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
        return () => {
            clearTimeout(timer)
            document.removeEventListener('click', handleClick)
        }
    }, [activeTooltip])

    // Close auto-compound info on outside click
    useEffect(() => {
        if (!showAutoCompoundInfo) return
        const handleClick = (e: MouseEvent) => {
            if (autoCompoundInfoRef.current && !autoCompoundInfoRef.current.contains(e.target as Node)) {
                setShowAutoCompoundInfo(false)
            }
        }
        const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
        return () => {
            clearTimeout(timer)
            document.removeEventListener('click', handleClick)
        }
    }, [showAutoCompoundInfo])

    const userStakedBalance = userStakeInfo ? parseFloat(userStakeInfo.balanceFormatted) : 0
    const pendingRewards = userStakeInfo ? parseFloat(userStakeInfo.pendingRewardsFormatted) : 0
    const handleHalf = () => {
        const balance = activeTab === "deposit" ? userBalance : userStakedBalance
        setAmount((balance / 2).toFixed(4))
    }

    const handleAll = () => {
        const balance = activeTab === "deposit" ? userBalance : userStakedBalance
        setAmount(balance.toFixed(4))
    }

    const handleAction = () => {
        const value = parseFloat(amount) || 0
        if (value <= 0) return

        if (activeTab === "deposit") {
            const amountWei = parseEther(amount)
            const feeBnb = autoCompoundEnabled && parseFloat(compoundFeeBnb) > 0
                ? parseEther(compoundFeeBnb)
                : undefined
            onDeposit?.(amountWei, feeBnb)
        } else {
            onWithdraw?.(parseEther(amount))
        }
        setAmount("")
    }

    const currentBalance = activeTab === "deposit" ? userBalance : userStakedBalance
    const parsedAmount = parseFloat(amount) || 0

    // Deposit validation
    const canDeposit = parsedAmount > 0 && parsedAmount <= userBalance &&
        (!autoCompoundEnabled || parseFloat(compoundFeeBnb) > 0)
    // Withdraw validation
    const canWithdraw = parsedAmount > 0 && parsedAmount <= userStakedBalance
    const canAction = activeTab === "deposit" ? canDeposit : canWithdraw

    const apr = stakingStats ? parseFloat(stakingStats.apr) : 0
    const totalStaked = stakingStats ? parseFloat(stakingStats.totalStakedFormatted) : 0

    const calcBeansAmount = parseFloat(calcAmount) || 0
    const dailyRate = apr / 365
    const weeklyRate = apr / 52
    const monthlyRate = apr / 12
    const dailyEarnings = (calcBeansAmount * dailyRate) / 100
    const weeklyEarnings = (calcBeansAmount * weeklyRate) / 100
    const monthlyEarnings = (calcBeansAmount * monthlyRate) / 100

    const tooltipTexts: Record<string, string> = {
        totalDeposits: "Total BEAN tokens staked in the protocol by all users.",
        apr: "Annual Percentage Rate based on the last 7 days of yield distributions. Actual returns may vary.",
        tvl: "Total Value Locked — the USD value of all staked BEAN at current market price.",
    }

    const InfoIcon = ({ id, size = 12 }: { id: string, size?: number }) => (
        <div
            style={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === id ? null : id) }}
            onMouseEnter={() => { if (!isMobile) setActiveTooltip(id) }}
            onMouseLeave={() => { if (!isMobile) setActiveTooltip(null) }}
        >
            <svg width={size} height={size} viewBox="0 0 24 24" fill="#999">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            {activeTooltip === id && (
                <div style={isMobile ? styles.tooltipMobile : styles.tooltip}>
                    {tooltipTexts[id]}
                </div>
            )}
        </div>
    )

    return (
        <div style={isMobile ? styles.containerMobile : styles.container}>
            <div style={isMobile ? styles.contentMobile : styles.content}>
                {/* Header */}
                <div style={isMobile ? styles.headerMobile : styles.header}>
                    <h1 style={isMobile ? styles.titleMobile : styles.title}>Stake</h1>
                    <p style={isMobile ? styles.subtitleMobile : styles.subtitle}>
                        Earn a share of protocol revenue.
                    </p>
                </div>

                {/* Deposit / Withdraw Card */}
                <div style={isMobile ? styles.cardMobile : styles.card}>
                    <div style={isMobile ? styles.tabsMobile : styles.tabs}>
                        <button
                            style={{
                                ...(isMobile ? styles.tabMobile : styles.tab),
                                ...(activeTab === "deposit" ? styles.tabActive : {}),
                            }}
                            onClick={() => { setActiveTab("deposit"); setAmount("") }}
                        >
                            Deposit
                        </button>
                        <button
                            style={{
                                ...(isMobile ? styles.tabMobile : styles.tab),
                                ...(activeTab === "withdraw" ? styles.tabActive : {}),
                            }}
                            onClick={() => { setActiveTab("withdraw"); setAmount("") }}
                        >
                            Withdraw
                        </button>
                    </div>

                    <div style={isMobile ? styles.balanceRowMobile : styles.balanceRow}>
                        <div style={styles.balanceLeft}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#999">
                                <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                            </svg>
                            <span style={isMobile ? styles.balanceTextMobile : styles.balanceText}>
                                {currentBalance.toFixed(4)} BEAN
                            </span>
                        </div>
                        <div style={styles.quickBtns}>
                            <button style={isMobile ? styles.quickBtnMobile : styles.quickBtn} onClick={handleHalf}>
                                HALF
                            </button>
                            <button style={isMobile ? styles.quickBtnMobile : styles.quickBtn} onClick={handleAll}>
                                ALL
                            </button>
                        </div>
                    </div>

                    <div style={isMobile ? styles.inputRowMobile : styles.inputRow}>
                        <div style={styles.inputLeft}>
                            <BeanLogo size={isMobile ? 20 : 24} />
                            <span style={isMobile ? styles.inputLabelMobile : styles.inputLabel}>BEAN</span>
                        </div>
                        <input
                            type="text"
                            style={isMobile ? styles.amountInputMobile : styles.amountInput}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                        />
                    </div>

                    {/* Auto-compound section (deposit tab only, shown when amount > 0) */}
                    {activeTab === "deposit" && parsedAmount > 0 && (
                        <div style={styles.autoCompoundSection}>
                            <div style={styles.autoCompoundHeader}>
                                <div style={styles.autoCompoundLabelRow}>
                                    <span style={isMobile ? { fontSize: '13px', color: '#ccc' } : { fontSize: '14px', color: '#ccc' }}>
                                        Auto-compound
                                    </span>
                                    <div
                                        ref={autoCompoundInfoRef}
                                        style={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}
                                        onClick={(e) => { e.stopPropagation(); setShowAutoCompoundInfo(!showAutoCompoundInfo) }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#999">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                                        </svg>
                                        {showAutoCompoundInfo && (
                                            <div style={isMobile ? styles.tooltipMobile : styles.tooltipWide}>
                                                Auto-compounding automatically restakes your earned BEAN rewards daily. A small ETH reserve is needed to pay bots that trigger the compound transaction. Each compound costs 0.0002 ETH as a bounty. Unused ETH can be withdrawn at any time.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    style={{
                                        ...styles.toggle,
                                        ...(autoCompoundEnabled ? styles.toggleOn : styles.toggleOff),
                                    }}
                                    onClick={() => setAutoCompoundEnabled(!autoCompoundEnabled)}
                                >
                                    <div style={{
                                        ...styles.toggleKnob,
                                        ...(autoCompoundEnabled ? styles.toggleKnobOn : styles.toggleKnobOff),
                                    }} />
                                </button>
                            </div>
                            {autoCompoundEnabled && (
                                <div style={isMobile ? styles.compoundFeeInputRowMobile : styles.compoundFeeInputRow}>
                                    <div style={styles.inputLeft}>
                                        <img
                                            src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/f9461cf2-aacc-4c59-8b9d-59ade3c46c00/public"
                                            alt="ETH"
                                            style={{ width: isMobile ? 18 : 20, height: isMobile ? 18 : 20, objectFit: 'contain' as const }}
                                        />
                                        <span style={isMobile ? styles.inputLabelMobile : styles.inputLabel}>ETH</span>
                                    </div>
                                    <input
                                        type="text"
                                        style={isMobile ? styles.compoundFeeInputMobile : styles.compoundFeeInput}
                                        value={compoundFeeBnb}
                                        onChange={(e) => setCompoundFeeBnb(e.target.value)}
                                        placeholder="0.006"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {isConnected ? (
                        <button
                            style={{
                                ...(isMobile ? styles.actionBtnMobile : styles.actionBtn),
                                ...(canAction ? styles.actionBtnEnabled : styles.actionBtnDisabled),
                            }}
                            onClick={handleAction}
                            disabled={!canAction}
                        >
                            {activeTab === "deposit" ? "Deposit" : "Withdraw"}
                        </button>
                    ) : (
                        <button
                            style={{
                                ...(isMobile ? styles.actionBtnMobile : styles.actionBtn),
                                ...styles.actionBtnEnabled,
                            }}
                            onClick={openConnectModal}
                        >
                            Connect Wallet
                        </button>
                    )}
                </div>

                {/* User Position Card (only when staked > 0) */}
                {isConnected && userStakedBalance > 0 && (
                    <div style={isMobile ? styles.cardMobile : styles.card}>
                        <h2 style={isMobile ? { fontSize: '16px', fontWeight: 600, color: '#fff', margin: 0, marginBottom: '16px' } : { fontSize: '20px', fontWeight: 600, color: '#fff', margin: 0, marginBottom: '20px' }}>
                            Your Position
                        </h2>

                        <div style={isMobile ? styles.positionRowMobile : styles.positionRow}>
                            <span style={isMobile ? { fontSize: '13px', color: '#999' } : { fontSize: '14px', color: '#999' }}>Total Staked</span>
                            <div style={styles.positionValue}>
                                <BeanLogo size={14} />
                                <span style={isMobile ? { fontSize: '14px', fontWeight: 500, color: '#fff' } : { fontSize: '15px', fontWeight: 500, color: '#fff' }}>
                                    {parseFloat(userStakeInfo!.balanceFormatted).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                </span>
                            </div>
                        </div>

                        {pendingRewards > 0 && (
                            <>
                                <div style={{ ...isMobile ? styles.positionRowMobile : styles.positionRow, borderBottom: 'none' }}>
                                    <span style={isMobile ? { fontSize: '13px', color: '#0052FF' } : { fontSize: '14px', color: '#0052FF' }}>Pending Rewards</span>
                                    <div style={styles.positionValue}>
                                        <BeanLogo size={14} />
                                        <span style={isMobile ? { fontSize: '14px', fontWeight: 500, color: '#0052FF' } : { fontSize: '15px', fontWeight: 500, color: '#0052FF' }}>
                                            {pendingRewards.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                        </span>
                                    </div>
                                </div>

                                <div style={styles.rewardButtons}>
                                    <button
                                        style={isMobile ? styles.rewardBtnMobile : styles.rewardBtn}
                                        onClick={onClaimYield}
                                    >
                                        Claim
                                    </button>
                                    <button
                                        style={{
                                            ...(isMobile ? styles.rewardBtnMobile : styles.rewardBtn),
                                            ...styles.rewardBtnPrimary,
                                        }}
                                        onClick={onCompound}
                                    >
                                        Claim & Deposit
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Summary */}
                <div style={isMobile ? styles.summaryMobile : styles.summary}>
                    <h2 style={isMobile ? styles.summaryTitleMobile : styles.summaryTitle}>Summary</h2>

                    <div style={isMobile ? styles.summaryRowMobile : styles.summaryRow}>
                        <div style={styles.summaryLabel}>
                            <span style={isMobile ? { fontSize: '13px' } : {}}>Total deposits</span>
                            <InfoIcon id="totalDeposits" />
                        </div>
                        <div style={isMobile ? styles.summaryValueMobile : styles.summaryValue}>
                            <BeanLogo size={14} />
                            <span>{stakingStats ? Math.floor(totalStaked).toLocaleString() : '—'}</span>
                        </div>
                    </div>

                    <div style={isMobile ? styles.summaryRowMobile : styles.summaryRow}>
                        <div style={styles.summaryLabel}>
                            <span style={isMobile ? { fontSize: '13px' } : {}}>APR</span>
                            <InfoIcon id="apr" />
                        </div>
                        <span style={isMobile ? styles.summaryValueMobile : styles.summaryValue}>
                            {stakingStats ? `${parseFloat(stakingStats.apr).toFixed(2)}%` : '—'}
                        </span>
                    </div>

                    <div style={isMobile ? styles.summaryRowMobile : styles.summaryRow}>
                        <div style={styles.summaryLabel}>
                            <span style={isMobile ? { fontSize: '13px' } : {}}>TVL</span>
                            <InfoIcon id="tvl" />
                        </div>
                        <span style={isMobile ? styles.summaryValueMobile : styles.summaryValue}>
                            {stakingStats ? `$${parseFloat(stakingStats.tvlUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                        </span>
                    </div>
                </div>

                {/* APR Calculator Button */}
                <button
                    style={isMobile ? styles.calculatorBtnMobile : styles.calculatorBtn}
                    onClick={() => setShowCalculator(true)}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V18z" />
                    </svg>
                    APR Calculator
                </button>
            </div>

            {/* APR Calculator Modal */}
            {showCalculator && (
                <>
                    <div style={styles.overlay} onClick={() => setShowCalculator(false)} />
                    <div style={isMobile ? styles.modalMobile : styles.modal}>
                        <div style={styles.modalHeader}>
                            <h3 style={isMobile ? styles.modalTitleMobile : styles.modalTitle}>APR Calculator</h3>
                            <button style={styles.closeBtn} onClick={() => setShowCalculator(false)}>✕</button>
                        </div>

                        <div style={styles.calcInputRow}>
                            <span style={styles.calcLabel}>Stake Amount</span>
                            <div style={styles.calcInputWrapper}>
                                <BeanLogo size={18} />
                                <input
                                    type="text"
                                    style={styles.calcInput}
                                    value={calcAmount}
                                    onChange={(e) => setCalcAmount(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div style={styles.calcResults}>
                            <div style={styles.calcResultRow}>
                                <span style={styles.calcResultLabel}>Daily</span>
                                <div style={styles.calcResultValue}>
                                    <BeanLogo size={14} />
                                    <span>{dailyEarnings.toFixed(4)}</span>
                                    <span style={styles.calcUsd}>(${(dailyEarnings * beansPrice).toFixed(2)})</span>
                                </div>
                            </div>
                            <div style={styles.calcResultRow}>
                                <span style={styles.calcResultLabel}>Weekly</span>
                                <div style={styles.calcResultValue}>
                                    <BeanLogo size={14} />
                                    <span>{weeklyEarnings.toFixed(4)}</span>
                                    <span style={styles.calcUsd}>(${(weeklyEarnings * beansPrice).toFixed(2)})</span>
                                </div>
                            </div>
                            <div style={styles.calcResultRow}>
                                <span style={styles.calcResultLabel}>Monthly</span>
                                <div style={styles.calcResultValue}>
                                    <BeanLogo size={14} />
                                    <span>{monthlyEarnings.toFixed(4)}</span>
                                    <span style={styles.calcUsd}>(${(monthlyEarnings * beansPrice).toFixed(2)})</span>
                                </div>
                            </div>
                            <div style={styles.calcResultRow}>
                                <span style={styles.calcResultLabel}>Yearly</span>
                                <div style={styles.calcResultValue}>
                                    <BeanLogo size={14} />
                                    <span>{(monthlyEarnings * 12).toFixed(4)}</span>
                                    <span style={styles.calcUsd}>(${(monthlyEarnings * 12 * beansPrice).toFixed(2)})</span>
                                </div>
                            </div>
                        </div>

                        <p style={styles.calcNote}>Based on current APR of {apr.toFixed(2)}%. Actual returns may vary.</p>
                    </div>
                </>
            )}
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        background: "rgba(255, 255, 255, 0.02)",
        fontFamily: "'Inter', -apple-system, sans-serif",
        display: "flex",
        justifyContent: "center",
        paddingTop: "30px",
    },
    containerMobile: {
        background: "rgba(255, 255, 255, 0.02)",
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: "20px 16px 0 16px",
    },
    content: {
        width: "100%",
        maxWidth: "580px",
        padding: "0 20px",
    },
    contentMobile: {
        width: "100%",
    },
    header: {
        marginBottom: "24px",
    },
    headerMobile: {
        marginBottom: "16px",
    },
    title: {
        fontSize: "36px",
        fontWeight: 700,
        color: "#fff",
        margin: 0,
        marginBottom: "8px",
    },
    titleMobile: {
        fontSize: "24px",
        fontWeight: 700,
        color: "#fff",
        margin: 0,
        marginBottom: "4px",
    },
    subtitle: {
        fontSize: "16px",
        color: "#999",
        margin: 0,
    },
    subtitleMobile: {
        fontSize: "13px",
        color: "#999",
        margin: 0,
    },
    card: {
        background: "rgba(255, 255, 255, 0.04)", backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "16px",
        padding: "24px",
        marginBottom: "28px",
    },
    cardMobile: {
        background: "rgba(255, 255, 255, 0.04)", backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "20px",
    },
    tabs: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        background: "rgba(255, 255, 255, 0.03)",
        borderRadius: "12px",
        padding: "8px",
        marginBottom: "24px",
    },
    tabsMobile: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px",
        background: "rgba(255, 255, 255, 0.03)",
        borderRadius: "10px",
        padding: "6px",
        marginBottom: "16px",
    },
    tab: {
        background: "transparent",
        border: "none",
        borderRadius: "8px",
        padding: "14px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#999",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    tabMobile: {
        background: "transparent",
        border: "none",
        borderRadius: "8px",
        padding: "12px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#999",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    tabActive: {
        background: "rgba(255, 255, 255, 0.1)",
        color: "#fff",
    },
    balanceRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "16px",
    },
    balanceRowMobile: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
    },
    balanceLeft: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    balanceText: {
        fontSize: "14px",
        color: "#999",
    },
    balanceTextMobile: {
        fontSize: "12px",
        color: "#999",
    },
    quickBtns: {
        display: "flex",
        gap: "8px",
    },
    quickBtn: {
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid #444",
        borderRadius: "6px",
        padding: "8px 16px",
        fontSize: "12px",
        fontWeight: 600,
        color: "#bbb",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    quickBtnMobile: {
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid #444",
        borderRadius: "6px",
        padding: "6px 12px",
        fontSize: "11px",
        fontWeight: 600,
        color: "#bbb",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    inputRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "16px",
    },
    inputRowMobile: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        padding: "14px 16px",
        marginBottom: "12px",
    },
    inputLeft: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    inputLabel: {
        fontSize: "16px",
        fontWeight: 500,
        color: "#fff",
    },
    inputLabelMobile: {
        fontSize: "14px",
        fontWeight: 500,
        color: "#fff",
    },
    amountInput: {
        background: "transparent",
        border: "none",
        fontSize: "28px",
        fontWeight: 600,
        color: "#fff",
        textAlign: "right" as const,
        width: "150px",
        fontFamily: "inherit",
        outline: "none",
    },
    amountInputMobile: {
        background: "transparent",
        border: "none",
        fontSize: "24px",
        fontWeight: 600,
        color: "#fff",
        textAlign: "right" as const,
        width: "120px",
        fontFamily: "inherit",
        outline: "none",
    },
    // Auto-compound
    autoCompoundSection: {
        marginBottom: "16px",
    },
    autoCompoundHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
    },
    autoCompoundLabelRow: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    toggle: {
        width: "44px",
        height: "24px",
        borderRadius: "12px",
        border: "none",
        cursor: "pointer",
        position: "relative" as const,
        transition: "background 0.2s",
        padding: 0,
    },
    toggleOn: {
        background: "#0052FF",
    },
    toggleOff: {
        background: "rgba(255, 255, 255, 0.12)",
    },
    toggleKnob: {
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        background: "#fff",
        position: "absolute" as const,
        top: "2px",
        transition: "left 0.2s",
    },
    toggleKnobOn: {
        left: "22px",
    },
    toggleKnobOff: {
        left: "2px",
    },
    compoundFeeInputRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "12px",
        padding: "12px 16px",
    },
    compoundFeeInputRowMobile: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        padding: "10px 14px",
    },
    compoundFeeInput: {
        background: "transparent",
        border: "none",
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        textAlign: "right" as const,
        width: "120px",
        fontFamily: "inherit",
        outline: "none",
    },
    compoundFeeInputMobile: {
        background: "transparent",
        border: "none",
        fontSize: "16px",
        fontWeight: 600,
        color: "#fff",
        textAlign: "right" as const,
        width: "100px",
        fontFamily: "inherit",
        outline: "none",
    },
    // Action buttons
    actionBtn: {
        width: "100%",
        background: "rgba(255, 255, 255, 0.06)",
        border: "none",
        borderRadius: "12px",
        padding: "18px",
        fontSize: "16px",
        fontWeight: 500,
        color: "#999",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    actionBtnMobile: {
        width: "100%",
        background: "rgba(255, 255, 255, 0.06)",
        border: "none",
        borderRadius: "10px",
        padding: "14px",
        fontSize: "15px",
        fontWeight: 500,
        color: "#999",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    actionBtnEnabled: {
        background: "#0052FF",
        color: "#fff",
        fontWeight: 600,
    },
    actionBtnDisabled: {
        background: "rgba(255, 255, 255, 0.03)",
        color: "#666",
        cursor: "not-allowed",
    },
    // Position card
    positionRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 0",
        borderBottom: "1px solid #1a1a1a",
    },
    positionRowMobile: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid #1a1a1a",
    },
    positionValue: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    rewardButtons: {
        display: "flex",
        gap: "10px",
        marginTop: "16px",
    },
    rewardBtn: {
        flex: 1,
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid #444",
        borderRadius: "10px",
        padding: "14px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#ccc",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    rewardBtnMobile: {
        flex: 1,
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid #444",
        borderRadius: "8px",
        padding: "12px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#ccc",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    rewardBtnPrimary: {
        background: "#0052FF",
        border: "1px solid #0052FF",
        color: "#fff",
        fontWeight: 600,
    },
    // Summary
    summary: {
        marginBottom: "20px",
    },
    summaryMobile: {
        marginBottom: "16px",
    },
    summaryTitle: {
        fontSize: "24px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
        marginBottom: "16px",
    },
    summaryTitleMobile: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
        marginBottom: "12px",
    },
    summaryRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 0",
        borderBottom: "1px solid #1a1a1a",
    },
    summaryRowMobile: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid #1a1a1a",
    },
    summaryLabel: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "15px",
        color: "#999",
    },
    summaryValue: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "15px",
        fontWeight: 500,
        color: "#fff",
    },
    summaryValueMobile: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#fff",
    },
    // Tooltips
    tooltip: {
        position: "absolute" as const,
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid #444",
        borderRadius: "8px",
        padding: "10px 12px",
        fontSize: "12px",
        color: "#aaa",
        lineHeight: 1.5,
        width: "220px",
        zIndex: 100,
        pointerEvents: "none" as const,
    },
    tooltipMobile: {
        position: "absolute" as const,
        bottom: "calc(100% + 8px)",
        left: "0",
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid #444",
        borderRadius: "8px",
        padding: "10px 12px",
        fontSize: "11px",
        color: "#aaa",
        lineHeight: 1.5,
        width: "200px",
        zIndex: 100,
    },
    tooltipWide: {
        position: "absolute" as const,
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid #444",
        borderRadius: "8px",
        padding: "10px 12px",
        fontSize: "12px",
        color: "#aaa",
        lineHeight: 1.5,
        width: "280px",
        zIndex: 100,
    },
    // Calculator
    calculatorBtn: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        background: "transparent",
        border: "1px solid #444",
        borderRadius: "12px",
        padding: "16px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#bbb",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    calculatorBtnMobile: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        background: "transparent",
        border: "1px solid #444",
        borderRadius: "10px",
        padding: "12px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#bbb",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    overlay: {
        position: "fixed" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
    },
    modal: {
        position: "fixed" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(15, 15, 30, 0.85)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "16px",
        padding: "24px",
        width: "90%",
        maxWidth: "420px",
        zIndex: 1001,
    },
    modalMobile: {
        position: "fixed" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(15, 15, 30, 0.85)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px",
        padding: "20px",
        width: "90%",
        maxWidth: "360px",
        zIndex: 1001,
    },
    modalHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "20px",
    },
    modalTitle: {
        fontSize: "20px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
    },
    modalTitleMobile: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
    },
    closeBtn: {
        background: "transparent",
        border: "none",
        color: "#999",
        fontSize: "18px",
        cursor: "pointer",
        padding: "4px 8px",
    },
    calcInputRow: {
        marginBottom: "20px",
    },
    calcLabel: {
        display: "block",
        fontSize: "13px",
        color: "#999",
        marginBottom: "8px",
    },
    calcInputWrapper: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        padding: "12px 14px",
    },
    calcInput: {
        flex: 1,
        background: "transparent",
        border: "none",
        fontSize: "16px",
        fontWeight: 500,
        color: "#fff",
        fontFamily: "inherit",
        outline: "none",
    },
    calcResults: {
        background: "rgba(255, 255, 255, 0.02)",
        borderRadius: "10px",
        padding: "12px",
        marginBottom: "12px",
    },
    calcResultRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid #1a1a1a",
    },
    calcResultLabel: {
        fontSize: "13px",
        color: "#999",
    },
    calcResultValue: {
        display: "flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#fff",
    },
    calcUsd: {
        color: "#999",
        fontSize: "12px",
    },
    calcNote: {
        fontSize: "11px",
        color: "#555",
        textAlign: "center" as const,
        margin: 0,
    },
}
