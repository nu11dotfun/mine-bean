'use client'

import React, { useState, useEffect, useRef } from "react"
import { useConnectModal } from '@rainbow-me/rainbowkit'
import BeanLogo from './BeanLogo'
import { apiFetch, sseSubscribe } from '@/lib/api'
import { MIN_DEPLOY_PER_BLOCK, EXECUTOR_FEE_BPS } from '@/lib/contracts'
import { parseEther } from 'viem'

const BnbLogo = ({ size = 18 }: { size?: number }) => (
    <img
        src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"
        alt="BNB"
        style={{ width: size, height: size, objectFit: "contain" as const }}
    />
)

const WalletIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#666">
        <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
    </svg>
)

const BlocksIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#888">
        <circle cx="7" cy="7" r="2.5" />
        <circle cx="17" cy="7" r="2.5" />
        <circle cx="7" cy="17" r="2.5" />
        <circle cx="17" cy="17" r="2.5" />
    </svg>
)

const RoundsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
)

interface AutoMinerState {
    active: boolean
    strategyId: number
    numBlocks: number
    amountPerBlockFormatted: string
    numRounds: number
    roundsExecuted: number
    depositAmountFormatted: string
    costPerRoundFormatted: string
    roundsRemaining: number
    totalRefundableFormatted: string
}

interface SidebarControlsProps {
    userBalance?: number
    isConnected?: boolean
    userAddress?: string
    onDeploy?: (amount: number, blockIds: number[]) => void
    onAutoActivate?: (strategyId: number, numRounds: number, numBlocks: number, depositAmount: bigint) => void
    onAutoStop?: () => void
}

export default function SidebarControls({
    userBalance = 0,
    isConnected = false,
    userAddress,
    onDeploy,
    onAutoActivate,
    onAutoStop,
}: SidebarControlsProps) {
    const { openConnectModal } = useConnectModal()
    const [mode, setMode] = useState<"manual" | "auto">("manual")
    const [hoveredMode, setHoveredMode] = useState<string | null>(null)
    const [perBlock, setPerBlock] = useState("0")

    const [selectedBlockCount, setSelectedBlockCount] = useState(0)
    const [selectedBlockIds, setSelectedBlockIds] = useState<number[]>([])

    const [autoBlocks, setAutoBlocks] = useState(1)
    const [autoRounds, setAutoRounds] = useState(1)
    const [blockSelection, setBlockSelection] = useState<"all" | "random">("all")

    // AutoMiner state from backend
    const [autoMinerState, setAutoMinerState] = useState<AutoMinerState | null>(null)
    const autoMinerActive = autoMinerState?.active === true

    // Round data driven by MiningGrid events
    const [timer, setTimer] = useState(0)
    const [currentRound, setCurrentRound] = useState("")
    const [phase, setPhase] = useState<"counting" | "eliminating" | "winner">("counting")
    const endTimeRef = useRef(0)

    // Stats
    const [motherlodePool, setMotherlodePool] = useState(0)
    const [totalDeployed, setTotalDeployed] = useState(0)
    const [userDeployed, setUserDeployed] = useState(0)

    const [isHoveringTimer, setIsHoveringTimer] = useState(false)
    const [isHoveringBeanpot, setIsHoveringBeanpot] = useState(false)
    const [isHoveringTotalDeployed, setIsHoveringTotalDeployed] = useState(false)
    const [isHoveringYouDeployed, setIsHoveringYouDeployed] = useState(false)

    const [bnbPrice, setBnbPrice] = useState<number>(0)
    const [beansPrice, setBeansPrice] = useState<number>(0)

    // Fetch AutoMiner state from backend
    useEffect(() => {
        if (!userAddress) {
            setAutoMinerState(null)
            return
        }

        const fetchAutoState = () => {
            apiFetch<{
                config: {
                    strategyId: number
                    numBlocks: number
                    amountPerBlockFormatted: string
                    active: boolean
                    numRounds: number
                    roundsExecuted: number
                    depositAmountFormatted: string
                }
                costPerRoundFormatted: string
                roundsRemaining: number
                totalRefundableFormatted: string
            }>(`/api/automine/${userAddress}`)
                .then((data) => {
                    setAutoMinerState({
                        active: data.config.active,
                        strategyId: data.config.strategyId,
                        numBlocks: data.config.numBlocks,
                        amountPerBlockFormatted: data.config.amountPerBlockFormatted,
                        numRounds: data.config.numRounds,
                        roundsExecuted: data.config.roundsExecuted,
                        depositAmountFormatted: data.config.depositAmountFormatted,
                        costPerRoundFormatted: data.costPerRoundFormatted,
                        roundsRemaining: data.roundsRemaining,
                        totalRefundableFormatted: data.totalRefundableFormatted,
                    })
                    // Force auto mode if active
                    if (data.config.active) {
                        setMode("auto")
                    }
                })
                .catch(() => {})
        }

        fetchAutoState()

        const handleActivated = () => setTimeout(fetchAutoState, 2000)
        const handleStopped = () => setTimeout(fetchAutoState, 2000)
        window.addEventListener("autoMinerActivated", handleActivated)
        window.addEventListener("autoMinerStopped", handleStopped)
        return () => {
            window.removeEventListener("autoMinerActivated", handleActivated)
            window.removeEventListener("autoMinerStopped", handleStopped)
        }
    }, [userAddress])

    // Subscribe to user SSE for real-time AutoMiner updates
    useEffect(() => {
        if (!userAddress) return

        return sseSubscribe(
            `/api/user/${userAddress}/events`,
            (event) => {
                if (event === 'autoMineExecuted' || event === 'configDeactivated' || event === 'stopped') {
                    // Re-fetch AutoMiner state
                    apiFetch<{
                        config: {
                            strategyId: number
                            numBlocks: number
                            amountPerBlockFormatted: string
                            active: boolean
                            numRounds: number
                            roundsExecuted: number
                            depositAmountFormatted: string
                        }
                        costPerRoundFormatted: string
                        roundsRemaining: number
                        totalRefundableFormatted: string
                    }>(`/api/automine/${userAddress}`)
                        .then((data) => {
                            setAutoMinerState({
                                active: data.config.active,
                                strategyId: data.config.strategyId,
                                numBlocks: data.config.numBlocks,
                                amountPerBlockFormatted: data.config.amountPerBlockFormatted,
                                numRounds: data.config.numRounds,
                                roundsExecuted: data.config.roundsExecuted,
                                depositAmountFormatted: data.config.depositAmountFormatted,
                                costPerRoundFormatted: data.costPerRoundFormatted,
                                roundsRemaining: data.roundsRemaining,
                                totalRefundableFormatted: data.totalRefundableFormatted,
                            })
                            // If deactivated, switch back to allow manual mode
                            if (!data.config.active) {
                                setMode("manual")
                            }
                        })
                        .catch(() => {})
                }
            },
            ['autoMineExecuted', 'configDeactivated', 'stopped']
        )
    }, [userAddress])

    // Listen for block selection changes
    useEffect(() => {
        const handleBlocksChanged = (event: CustomEvent) => {
            const { blocks, count } = event.detail
            setSelectedBlockCount(count)
            setSelectedBlockIds(blocks || [])
        }

        window.addEventListener("blocksChanged" as any, handleBlocksChanged)
        return () => window.removeEventListener("blocksChanged" as any, handleBlocksChanged)
    }, [])

    // Fetch prices from backend
    useEffect(() => {
        const fetchPrices = () => {
            apiFetch<{ prices: { bean: { usd: string }, bnb: { usd: string } } }>('/api/stats')
                .then((data) => {
                    setBnbPrice(parseFloat(data.prices.bnb.usd) || 0)
                    setBeansPrice(parseFloat(data.prices.bean.usd) || 0)
                })
                .catch((err) => console.error('Failed to fetch prices:', err))
        }

        fetchPrices()
        const interval = setInterval(fetchPrices, 30000)
        return () => clearInterval(interval)
    }, [])

    // Listen for round data from MiningGrid
    useEffect(() => {
        const handleRoundData = (event: CustomEvent) => {
            const d = event.detail
            if (d.roundId) setCurrentRound(d.roundId)
            if (d.endTime) endTimeRef.current = typeof d.endTime === 'number' ? d.endTime : 0
            if (d.motherlodePoolFormatted) setMotherlodePool(parseFloat(d.motherlodePoolFormatted) || 0)
            if (d.totalDeployedFormatted !== undefined) setTotalDeployed(parseFloat(d.totalDeployedFormatted) || 0)
            if (d.userDeployedFormatted !== undefined) setUserDeployed(parseFloat(d.userDeployedFormatted) || 0)
            // New round data means we're back to counting
            setPhase("counting")
        }

        const handleRoundDeployed = (event: CustomEvent) => {
            const d = event.detail
            if (d.totalDeployedFormatted) setTotalDeployed(parseFloat(d.totalDeployedFormatted) || 0)
            // Update user deployed if this deployment is from the connected user
            if (d.user && userAddress && d.user.toLowerCase() === userAddress.toLowerCase() && d.userDeployedFormatted) {
                setUserDeployed(parseFloat(d.userDeployedFormatted) || 0)
            }
        }

        const handleRoundSettled = () => {
            setPhase("eliminating")
            setTimeout(() => setPhase("winner"), 5200)
        }

        window.addEventListener("roundData" as any, handleRoundData)
        window.addEventListener("roundDeployed" as any, handleRoundDeployed)
        window.addEventListener("roundSettled" as any, handleRoundSettled)
        return () => {
            window.removeEventListener("roundData" as any, handleRoundData)
            window.removeEventListener("roundDeployed" as any, handleRoundDeployed)
            window.removeEventListener("roundSettled" as any, handleRoundSettled)
        }
    }, [userAddress])

    // Countdown timer from real endTime
    useEffect(() => {
        const tick = () => {
            if (endTimeRef.current > 0) {
                const remaining = Math.max(0, Math.floor(endTimeRef.current - Date.now() / 1000))
                setTimer(remaining)
            }
        }
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }

    const handleQuickAmount = (value: number) => {
        const current = parseFloat(perBlock) || 0
        setPerBlock((current + value).toFixed(5))
    }

    const handleAllClick = () => {
        if (blockSelection === "all") {
            setBlockSelection("random")
            window.dispatchEvent(new CustomEvent("autoMinerMode", { detail: { enabled: true, strategy: "random" } }))
        } else {
            setBlockSelection("all")
            setAutoBlocks(25)
            window.dispatchEvent(new CustomEvent("autoMinerMode", { detail: { enabled: true, strategy: "all" } }))
        }
    }

    // Manual mode calculations
    const perBlockAmount = parseFloat(perBlock) || 0
    const manualTotal = perBlockAmount * selectedBlockCount
    const hasDeployed = userDeployed > 0
    const exceedsBalance = manualTotal > userBalance
    const canDeploy = perBlockAmount >= MIN_DEPLOY_PER_BLOCK && selectedBlockCount > 0 && !exceedsBalance && timer > 0 && phase === "counting" && !hasDeployed

    // Auto mode calculations
    const autoNumBlocks = blockSelection === "all" ? 25 : autoBlocks
    const autoTotalBlocks = autoNumBlocks * autoRounds
    // Invert the fee formula to get required deposit from desired per-block
    // Contract formula: effectivePerBlock = (deposit * 10000) / (totalBlocks * (10000 + feeBps))
    // Inverting: deposit = effectivePerBlock * totalBlocks * (10000 + feeBps) / 10000
    const autoTotalDeposit = (perBlockAmount * autoTotalBlocks * (10000 + EXECUTOR_FEE_BPS)) / 10000
    const autoPerRound = autoRounds > 0 ? autoTotalDeposit / autoRounds : 0
    const exceedsBalanceAuto = autoTotalDeposit > userBalance
    const canActivate = perBlockAmount >= MIN_DEPLOY_PER_BLOCK && autoRounds >= 1 && !exceedsBalanceAuto

    const handleAutoActivateClick = () => {
        if (!canActivate) return
        const strategyId = blockSelection === "all" ? 1 : 0
        const depositAmount = parseEther(autoTotalDeposit.toFixed(18))
        onAutoActivate?.(strategyId, autoRounds, autoNumBlocks, depositAmount)
    }

    return (
        <div style={styles.container}>
            <div style={styles.statsGrid}>
                <div
                    style={{ ...styles.statBox, ...styles.beanpotBox }}
                    onMouseEnter={() => setIsHoveringBeanpot(true)}
                    onMouseLeave={() => setIsHoveringBeanpot(false)}
                >
                    <div style={styles.statValue}>
                        <BeanLogo size={20} />
                        <span style={styles.beanpotValue}>
                            {motherlodePool > 0 ? motherlodePool.toFixed(1) : '—'}
                        </span>
                    </div>
                    <div style={styles.statLabel}>
                        {isHoveringBeanpot && motherlodePool > 0
                            ? `≈$${(motherlodePool * beansPrice).toFixed(2)}`
                            : "Beanpot"}
                    </div>
                </div>

                <div
                    style={styles.statBox}
                    onMouseEnter={() => setIsHoveringTimer(true)}
                    onMouseLeave={() => setIsHoveringTimer(false)}
                >
                    <div style={styles.statValue}>
                        <span style={styles.timerValue}>{formatTime(timer)}</span>
                    </div>
                    <div style={styles.statLabel}>
                        {isHoveringTimer && currentRound ? `Round #${currentRound}` : "Time remaining"}
                    </div>
                </div>

                <div
                    style={styles.statBox}
                    onMouseEnter={() => setIsHoveringTotalDeployed(true)}
                    onMouseLeave={() => setIsHoveringTotalDeployed(false)}
                >
                    <div style={styles.statValue}>
                        <BnbLogo size={20} />
                        <span style={styles.statValueText}>
                            {totalDeployed > 0 ? totalDeployed.toFixed(5) : '—'}
                        </span>
                    </div>
                    <div style={styles.statLabel}>
                        {isHoveringTotalDeployed && totalDeployed > 0
                            ? `≈$${(totalDeployed * bnbPrice).toFixed(2)}`
                            : "Total deployed"}
                    </div>
                </div>

                <div
                    style={styles.statBox}
                    onMouseEnter={() => setIsHoveringYouDeployed(true)}
                    onMouseLeave={() => setIsHoveringYouDeployed(false)}
                >
                    <div style={styles.statValue}>
                        <BnbLogo size={20} />
                        <span style={styles.statValueText}>{userDeployed > 0 ? userDeployed.toFixed(5) : '—'}</span>
                    </div>
                    <div style={styles.statLabel}>
                        {isHoveringYouDeployed && userDeployed > 0
                            ? `≈$${(userDeployed * bnbPrice).toFixed(2)}`
                            : "You deployed"}
                    </div>
                </div>
            </div>

            <div style={styles.controlsCard}>
                {/* Mode toggle — hidden when AutoMiner is active */}
                {!autoMinerActive && (
                    <div style={styles.modeToggle}>
                        <button
                            style={{
                                ...styles.modeBtn,
                                ...(mode === "manual" ? styles.modeBtnActive : {}),
                                ...(hoveredMode === "manual" && mode !== "manual" ? styles.modeBtnHover : {}),
                            }}
                            onClick={() => {
                                setMode("manual")
                                window.dispatchEvent(new CustomEvent("autoMinerMode", { detail: { enabled: false, strategy: null } }))
                            }}
                            onMouseEnter={() => setHoveredMode("manual")}
                            onMouseLeave={() => setHoveredMode(null)}
                        >
                            Manual
                        </button>
                        <button
                            style={{
                                ...styles.modeBtn,
                                ...(mode === "auto" ? styles.modeBtnActive : {}),
                                ...(hoveredMode === "auto" && mode !== "auto" ? styles.modeBtnHover : {}),
                            }}
                            onClick={() => {
                                setMode("auto")
                                window.dispatchEvent(new CustomEvent("autoMinerMode", { detail: { enabled: true, strategy: blockSelection } }))
                            }}
                            onMouseEnter={() => setHoveredMode("auto")}
                            onMouseLeave={() => setHoveredMode(null)}
                        >
                            Auto
                        </button>
                    </div>
                )}

                {/* ===== MANUAL MODE ===== */}
                {mode === "manual" && !autoMinerActive && (
                    <>
                        <div style={styles.balanceRow}>
                            <div style={styles.balanceLeft}>
                                <WalletIcon />
                                <span style={styles.balanceAmount}>{userBalance.toFixed(5)} BNB</span>
                            </div>
                            <div style={styles.quickAmounts}>
                                <button style={styles.quickBtn} onClick={() => handleQuickAmount(1)}>+1</button>
                                <button style={styles.quickBtn} onClick={() => handleQuickAmount(0.1)}>+0.1</button>
                                <button style={styles.quickBtn} onClick={() => handleQuickAmount(0.01)}>+0.01</button>
                            </div>
                        </div>

                        <div style={styles.inputRow}>
                            <div style={styles.inputLeft}>
                                <BnbLogo size={20} />
                                <span style={styles.inputLabel}>BNB</span>
                            </div>
                            <input
                                type="text"
                                style={{ ...styles.amountInput, color: "#fff" }}
                                value={perBlock}
                                onChange={(e) => setPerBlock(e.target.value)}
                                onFocus={() => { if (perBlock === "0") setPerBlock("") }}
                                onBlur={() => { if (perBlock === "") setPerBlock("0") }}
                            />
                        </div>

                        <div style={styles.row}>
                            <span style={styles.rowLabel}>Blocks</span>
                            <div style={styles.rowRight}>
                                <button
                                    style={{
                                        ...styles.allBtn,
                                        ...(selectedBlockCount === 25 ? styles.allBtnActive : {}),
                                    }}
                                    onClick={() => {
                                        window.dispatchEvent(
                                            new CustomEvent("selectAllBlocks", {
                                                detail: { selectAll: selectedBlockCount !== 25 },
                                            })
                                        )
                                    }}
                                >
                                    All
                                </button>
                                <span style={styles.blockCount}>
                                    {selectedBlockCount === 25 ? "x25" : "Random"}
                                </span>
                            </div>
                        </div>

                        <div style={styles.totalRow}>
                            <span style={styles.rowLabel}>Total</span>
                            <span style={styles.totalValue}>{manualTotal.toFixed(5)} BNB</span>
                        </div>

                        {isConnected ? (
                            <button
                                style={{
                                    ...styles.deployBtn,
                                    ...(canDeploy ? styles.deployBtnActive : styles.deployBtnDisabled),
                                }}
                                onClick={() => onDeploy?.(manualTotal, selectedBlockIds)}
                                disabled={!canDeploy}
                            >
                                {hasDeployed ? "✓ Deployed" : phase === "counting" ? "Deploy" : phase === "eliminating" ? "Settling..." : "Winner!"}
                            </button>
                        ) : (
                            <button style={styles.connectBtn} onClick={openConnectModal}>
                                Connect Wallet
                            </button>
                        )}
                    </>
                )}

                {/* ===== AUTO MODE — CONFIGURE VIEW ===== */}
                {mode === "auto" && !autoMinerActive && (
                    <>
                        <div style={styles.balanceRow}>
                            <div style={styles.balanceLeft}>
                                <WalletIcon />
                                <span style={styles.balanceAmount}>{userBalance.toFixed(5)} BNB</span>
                            </div>
                            <div style={styles.quickAmounts}>
                                <button style={styles.quickBtn} onClick={() => handleQuickAmount(1)}>+1</button>
                                <button style={styles.quickBtn} onClick={() => handleQuickAmount(0.1)}>+0.1</button>
                                <button style={styles.quickBtn} onClick={() => handleQuickAmount(0.01)}>+0.01</button>
                            </div>
                        </div>

                        <div style={styles.inputRow}>
                            <div style={styles.inputLeft}>
                                <BnbLogo size={20} />
                                <span style={styles.inputLabel}>BNB</span>
                            </div>
                            <input
                                type="text"
                                style={{ ...styles.amountInput, color: "#fff" }}
                                value={perBlock}
                                onChange={(e) => setPerBlock(e.target.value)}
                                onFocus={() => { if (perBlock === "0") setPerBlock("") }}
                                onBlur={() => { if (perBlock === "") setPerBlock("0") }}
                            />
                        </div>

                        <div style={styles.row}>
                            <span style={styles.rowLabel}>Strategy</span>
                            <div style={styles.blockSelectionToggle}>
                                <button
                                    style={{
                                        ...styles.allBtn,
                                        ...(blockSelection === "all" ? styles.allBtnActive : {}),
                                    }}
                                    onClick={handleAllClick}
                                >
                                    All
                                </button>
                                <span style={{ ...styles.blockCount, minWidth: "55px", textAlign: "right" }}>
                                    {blockSelection === "all" ? "x25" : "Random"}
                                </span>
                            </div>
                        </div>

                        <div style={{
                            ...styles.autoRow,
                            visibility: blockSelection === "random" ? "visible" : "hidden",
                            pointerEvents: blockSelection === "random" ? "auto" : "none",
                        }}>
                            <div style={styles.autoRowLeft}>
                                <BlocksIcon />
                                <span style={styles.autoRowLabel}>Blocks</span>
                            </div>
                            <input
                                type="number"
                                min="1"
                                max="25"
                                style={styles.autoInput}
                                value={autoBlocks === 0 ? "" : autoBlocks}
                                onChange={(e) => setAutoBlocks(Math.max(0, Math.min(25, parseInt(e.target.value) || 0)))}
                                onFocus={() => setAutoBlocks(0)}
                                onBlur={() => { if (autoBlocks === 0) setAutoBlocks(1) }}
                            />
                        </div>

                        <div style={styles.autoRow}>
                            <div style={styles.autoRowLeft}>
                                <RoundsIcon />
                                <span style={styles.autoRowLabel}>Rounds</span>
                            </div>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                style={styles.autoInput}
                                value={autoRounds === 0 ? "" : autoRounds}
                                onChange={(e) => setAutoRounds(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                                onFocus={() => setAutoRounds(0)}
                                onBlur={() => { if (autoRounds === 0) setAutoRounds(1) }}
                            />
                        </div>

                        <div style={styles.row}>
                            <span style={styles.rowLabel}>Per round</span>
                            <span style={styles.totalValue}>{autoPerRound.toFixed(5)} BNB</span>
                        </div>

                        <div style={styles.totalRow}>
                            <span style={styles.rowLabel}>Total deposit</span>
                            <span style={styles.totalValue}>{autoTotalDeposit.toFixed(5)} BNB</span>
                        </div>

                        {isConnected ? (
                            <button
                                style={{
                                    ...styles.deployBtn,
                                    ...(canActivate ? styles.deployBtnActive : styles.deployBtnDisabled),
                                }}
                                onClick={handleAutoActivateClick}
                                disabled={!canActivate}
                            >
                                Activate AutoMiner
                            </button>
                        ) : (
                            <button style={styles.connectBtn} onClick={openConnectModal}>
                                Connect Wallet
                            </button>
                        )}
                    </>
                )}

                {/* ===== AUTO MODE — ACTIVE VIEW ===== */}
                {autoMinerActive && autoMinerState && (
                    <>
                        <div style={styles.activeHeader}>
                            <span style={styles.activeDot} />
                            <span style={styles.activeTitle}>AutoMiner Active</span>
                        </div>

                        <div style={styles.activeRow}>
                            <span style={styles.rowLabel}>Balance</span>
                            <span style={styles.totalValue}>{parseFloat(autoMinerState.totalRefundableFormatted).toFixed(5)} BNB</span>
                        </div>

                        <div style={styles.activeRow}>
                            <span style={styles.rowLabel}>Strategy</span>
                            <span style={styles.totalValue}>
                                {autoMinerState.strategyId === 1 ? "All" : "Random"} x{autoMinerState.numBlocks}
                            </span>
                        </div>

                        <div style={styles.activeRow}>
                            <span style={styles.rowLabel}>Per round</span>
                            <span style={styles.totalValue}>{parseFloat(autoMinerState.costPerRoundFormatted).toFixed(5)} BNB</span>
                        </div>

                        <div style={styles.activeRow}>
                            <span style={styles.rowLabel}>Rounds</span>
                            <span style={styles.totalValue}>
                                {autoMinerState.roundsExecuted} / {autoMinerState.numRounds}
                            </span>
                        </div>

                        <div style={{ ...styles.totalRow, borderTop: "1px solid #222" }}>
                            <span style={styles.rowLabel}>Per block</span>
                            <span style={styles.totalValue}>{parseFloat(autoMinerState.amountPerBlockFormatted).toFixed(5)} BNB</span>
                        </div>

                        <button
                            style={styles.stopBtn}
                            onClick={() => onAutoStop?.()}
                        >
                            Stop AutoMiner
                        </button>
                        <div style={styles.stopHint}>Cancel and refund remaining BNB</div>
                    </>
                )}
            </div>
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        fontFamily: "'Inter', -apple-system, sans-serif",
        width: "100%",
    },
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
    },
    statBox: {
        background: "#111",
        border: "1px solid #222",
        borderRadius: "12px",
        padding: "14px 12px",
        textAlign: "center",
    },
    beanpotBox: {
        border: "1px solid #2a2a2a",
    },
    statValue: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        fontSize: "20px",
        fontWeight: 700,
        color: "#fff",
        marginBottom: "4px",
    },
    statValueText: {
        fontWeight: 700,
    },
    beanpotValue: {
        color: "#fff",
        fontWeight: 700,
    },
    timerValue: {
        color: "#fff",
        fontWeight: 700,
    },
    statLabel: {
        fontSize: "13px",
        color: "#666",
        fontWeight: 500,
    },
    controlsCard: {
        background: "#111",
        border: "1px solid #222",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
    },
    modeToggle: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        background: "#0a0a0a",
        borderRadius: "8px",
        padding: "4px",
    },
    modeBtn: {
        background: "transparent",
        border: "none",
        borderRadius: "6px",
        padding: "10px",
        fontSize: "14px",
        fontWeight: 600,
        color: "#666",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    modeBtnActive: {
        background: "#222",
        color: "#fff",
    },
    modeBtnHover: {
        background: "#1a1a1a",
        color: "#888",
    },
    balanceRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    balanceLeft: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "#666",
        fontSize: "14px",
        fontWeight: 500,
    },
    balanceAmount: {
        color: "#fff",
        fontWeight: 600,
    },
    quickAmounts: {
        display: "flex",
        gap: "8px",
    },
    quickBtn: {
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: "6px",
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 600,
        color: "#888",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    inputRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0a0a0a",
        border: "1px solid #222",
        borderRadius: "8px",
        padding: "10px 14px",
    },
    inputLeft: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "#fff",
        fontSize: "14px",
        fontWeight: 600,
    },
    inputLabel: {
        color: "#fff",
        fontWeight: 600,
    },
    amountInput: {
        background: "transparent",
        border: "none",
        fontSize: "24px",
        fontWeight: 700,
        textAlign: "right" as const,
        width: "100px",
        fontFamily: "inherit",
        outline: "none",
    },
    autoRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 0",
    },
    autoRowLeft: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    autoRowLabel: {
        fontSize: "15px",
        color: "#fff",
        fontWeight: 600,
    },
    autoInput: {
        background: "transparent",
        border: "none",
        fontSize: "24px",
        fontWeight: 700,
        color: "#666",
        textAlign: "right" as const,
        width: "60px",
        fontFamily: "inherit",
        outline: "none",
    },
    row: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 0",
    },
    rowLabel: {
        fontSize: "14px",
        color: "#666",
        fontWeight: 500,
    },
    rowRight: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    allBtn: {
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: "6px",
        padding: "6px 16px",
        fontSize: "13px",
        fontWeight: 600,
        color: "#666",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    allBtnActive: {
        background: "#444",
        color: "#fff",
        borderColor: "#666",
    },
    blockCount: {
        fontSize: "15px",
        fontWeight: 700,
        color: "#fff",
    },
    blockSelectionToggle: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    totalRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        borderTop: "1px solid #222",
    },
    totalValue: {
        fontSize: "15px",
        fontWeight: 700,
        color: "#fff",
    },
    deployBtn: {
        width: "100%",
        background: "#222",
        border: "none",
        borderRadius: "8px",
        padding: "14px",
        fontSize: "14px",
        fontWeight: 600,
        color: "#666",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    deployBtnActive: {
        background: "#F0B90B",
        color: "#000",
        cursor: "pointer",
    },
    deployBtnDisabled: {
        background: "#1a1a1a",
        color: "#444",
        cursor: "not-allowed",
    },
    connectBtn: {
        width: "100%",
        background: "#F0B90B",
        border: "none",
        borderRadius: "8px",
        padding: "14px",
        fontSize: "14px",
        fontWeight: 700,
        color: "#000",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    // Active AutoMiner styles
    activeHeader: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "4px 0",
    },
    activeDot: {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: "#4ade80",
    },
    activeTitle: {
        fontSize: "15px",
        fontWeight: 700,
        color: "#fff",
    },
    activeRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 0",
    },
    stopBtn: {
        width: "100%",
        background: "#2a1a1a",
        border: "1px solid #442222",
        borderRadius: "8px",
        padding: "14px",
        fontSize: "14px",
        fontWeight: 600,
        color: "#f87171",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    stopHint: {
        fontSize: "12px",
        color: "#666",
        textAlign: "center",
        marginTop: "-4px",
    },
}
