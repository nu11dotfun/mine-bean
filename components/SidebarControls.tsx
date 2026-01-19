'use client'

import React, { useState, useEffect } from "react"
import { useConnectModal } from '@rainbow-me/rainbowkit'

interface SidebarControlsProps {
    beanpotAmount?: number
    timeRemaining?: number
    totalDeployed?: number
    userDeployed?: number
    userBalance?: number
    isConnected?: boolean
    roundNumber?: number
    onDeploy?: (amount: number, blocks: number) => void
}

export default function SidebarControls({
    beanpotAmount = 235.4,
    timeRemaining = 30,
    totalDeployed = 9.8563,
    userDeployed = 0,
    userBalance = 0,
    isConnected = false,
    roundNumber = 122168,
    onDeploy,
}: SidebarControlsProps) {
    const { openConnectModal } = useConnectModal()
    const [mode, setMode] = useState<"manual" | "auto">("manual")
    const [hoveredMode, setHoveredMode] = useState<string | null>(null)
    const [amount, setAmount] = useState("0")

    // Block selection state (synced with grid)
    const [selectedBlockCount, setSelectedBlockCount] = useState(0)

    // Auto mode state
    const [autoBlocks, setAutoBlocks] = useState(1)
    const [autoRounds, setAutoRounds] = useState(1)
    const [autoReload, setAutoReload] = useState(false)
    const [blockSelection, setBlockSelection] = useState<"all" | "random">("all")

    // Timer state
    const [timer, setTimer] = useState(60)
    const [currentRound, setCurrentRound] = useState(122168)
    const [phase, setPhase] = useState<"counting" | "eliminating" | "winner" | "miners">("counting")

    // Hover states
    const [isHoveringTimer, setIsHoveringTimer] = useState(false)
    const [isHoveringBeanpot, setIsHoveringBeanpot] = useState(false)
    const [isHoveringTotalDeployed, setIsHoveringTotalDeployed] = useState(false)
    const [isHoveringYouDeployed, setIsHoveringYouDeployed] = useState(false)

    // Prices
    const [bnbPrice, setBnbPrice] = useState<number>(580)
    const [beansPrice, setBeansPrice] = useState<number>(0.0264)

    // Listen for block changes from grid
    useEffect(() => {
        const handleBlocksChanged = (event: CustomEvent) => {
            const { count } = event.detail
            setSelectedBlockCount(count)
            if (mode === "auto" && blockSelection === "all") {
                setAutoBlocks(count || 25)
            }
        }

        window.addEventListener("blocksChanged" as any, handleBlocksChanged)
        return () => window.removeEventListener("blocksChanged" as any, handleBlocksChanged)
    }, [mode, blockSelection])

    // Fetch live BNB price from Binance API
    useEffect(() => {
        const fetchBnbPrice = async () => {
            try {
                const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT")
                const data = await response.json()
                if (data.price) {
                    setBnbPrice(parseFloat(data.price))
                }
            } catch (error) {
                console.error("Failed to fetch BNB price:", error)
            }
        }

        fetchBnbPrice()
        const interval = setInterval(fetchBnbPrice, 10000)
        return () => clearInterval(interval)
    }, [])

    // Fetch BEANS price from DexScreener
    useEffect(() => {
        const fetchBeansPrice = async () => {
            try {
                const response = await fetch("https://api.dexscreener.com/latest/dex/pairs/bsc/0x7e58f160b5b77b8b24cd9900c09a3e730215ac47")
                const data = await response.json()
                if (data.pair?.priceUsd) {
                    setBeansPrice(parseFloat(data.pair.priceUsd))
                }
            } catch (error) {
                console.error("Failed to fetch BEANS price:", error)
            }
        }

        fetchBeansPrice()
        const interval = setInterval(fetchBeansPrice, 30000)
        return () => clearInterval(interval)
    }, [])

    // Main game loop
    useEffect(() => {
        let interval: NodeJS.Timeout

        if (phase === "counting") {
            interval = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        setPhase("eliminating")
                        window.dispatchEvent(
                            new CustomEvent("phaseChange", {
                                detail: { phase: "eliminating", round: currentRound },
                            })
                        )
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        } else if (phase === "eliminating") {
            setTimeout(() => {
                setPhase("winner")
                window.dispatchEvent(
                    new CustomEvent("phaseChange", {
                        detail: { phase: "winner", round: currentRound },
                    })
                )
            }, 5000)
        } else if (phase === "winner") {
            setTimeout(() => {
                setPhase("miners")
                const newRound = currentRound + 1
                setCurrentRound(newRound)
                window.dispatchEvent(
                    new CustomEvent("phaseChange", {
                        detail: { phase: "miners", round: newRound },
                    })
                )
            }, 1000)
        } else if (phase === "miners") {
            setTimeout(() => {
                setPhase("counting")
                setTimer(60)
                setSelectedBlockCount(0)
                window.dispatchEvent(
                    new CustomEvent("phaseChange", {
                        detail: { phase: "counting", round: currentRound },
                    })
                )
            }, 4000)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [phase, currentRound])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }

    const handleQuickAmount = (value: number) => {
        const current = parseFloat(amount) || 0
        setAmount((current + value).toFixed(2))
    }

    // Handle "All" button click - toggle select all 25 blocks
    const handleAllClick = () => {
        if (blockSelection === "all") {
            setBlockSelection("random")
            window.dispatchEvent(
                new CustomEvent("selectAllBlocks", { detail: { selectAll: false } })
            )
        } else {
            setBlockSelection("all")
            setAutoBlocks(25)
            window.dispatchEvent(
                new CustomEvent("selectAllBlocks", { detail: { selectAll: true } })
            )
        }
    }

    // Calculate totals
    const baseAmount = parseFloat(amount) || 0
    const effectiveBlocks = mode === "auto"
        ? blockSelection === "all" ? autoBlocks : autoBlocks
        : selectedBlockCount
    const totalPerRound = baseAmount * effectiveBlocks
    const totalAmount = mode === "auto" ? totalPerRound * autoRounds : totalPerRound

    // BNB Logo component
    const BnbLogo = ({ size = 18 }: { size?: number }) => (
        <img
            src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"
            alt="BNB"
            style={{ width: size, height: size, objectFit: "contain" as const }}
        />
    )

    // Icons
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

    const ReloadIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#888">
            <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
        </svg>
    )

    // Bean Icon SVG
    const BeanIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#F0B90B">
            <ellipse cx="12" cy="10" rx="7" ry="5" />
            <ellipse cx="12" cy="14" rx="7" ry="5" />
        </svg>
    )

    return (
        <div style={styles.container}>
            {/* Section 1: Stats Grid */}
            <div style={styles.statsGrid}>
                {/* Beanpot */}
                <div
                    style={{ ...styles.statBox, ...styles.beanpotBox }}
                    onMouseEnter={() => setIsHoveringBeanpot(true)}
                    onMouseLeave={() => setIsHoveringBeanpot(false)}
                >
                    <div style={styles.statValue}>
                        <BeanIcon />
                        <span style={styles.beanpotValue}>
                            {beanpotAmount.toFixed(1)}
                        </span>
                    </div>
                    <div style={styles.statLabel}>
                        {isHoveringBeanpot
                            ? `≈$${(beanpotAmount * beansPrice).toFixed(2)}`
                            : "Beanpot"}
                    </div>
                </div>

                {/* Time Remaining */}
                <div
                    style={styles.statBox}
                    onMouseEnter={() => setIsHoveringTimer(true)}
                    onMouseLeave={() => setIsHoveringTimer(false)}
                >
                    <div style={styles.statValue}>
                        <span style={styles.timerValue}>{formatTime(timer)}</span>
                    </div>
                    <div style={styles.statLabel}>
                        {isHoveringTimer ? `Round #${currentRound}` : "Time remaining"}
                    </div>
                </div>

                {/* Total Deployed */}
                <div
                    style={styles.statBox}
                    onMouseEnter={() => setIsHoveringTotalDeployed(true)}
                    onMouseLeave={() => setIsHoveringTotalDeployed(false)}
                >
                    <div style={styles.statValue}>
                        <BnbLogo size={20} />
                        <span style={styles.statValueText}>
                            {totalDeployed.toFixed(4)}
                        </span>
                    </div>
                    <div style={styles.statLabel}>
                        {isHoveringTotalDeployed
                            ? `≈$${(totalDeployed * bnbPrice).toFixed(2)}`
                            : "Total deployed"}
                    </div>
                </div>

                {/* You Deployed */}
                <div
                    style={styles.statBox}
                    onMouseEnter={() => setIsHoveringYouDeployed(true)}
                    onMouseLeave={() => setIsHoveringYouDeployed(false)}
                >
                    <div style={styles.statValue}>
                        <BnbLogo size={20} />
                        <span style={styles.statValueText}>{userDeployed}</span>
                    </div>
                    <div style={styles.statLabel}>
                        {isHoveringYouDeployed
                            ? `≈$${(userDeployed * bnbPrice).toFixed(2)}`
                            : "You deployed"}
                    </div>
                </div>
            </div>

            {/* Section 2: Controls Card */}
            <div style={styles.controlsCard}>
                {/* Mode Toggle */}
                <div style={styles.modeToggle}>
                    <button
                        style={{
                            ...styles.modeBtn,
                            ...(mode === "manual" ? styles.modeBtnActive : {}),
                            ...(hoveredMode === "manual" && mode !== "manual" ? styles.modeBtnHover : {}),
                        }}
                        onClick={() => setMode("manual")}
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
                        onClick={() => setMode("auto")}
                        onMouseEnter={() => setHoveredMode("auto")}
                        onMouseLeave={() => setHoveredMode(null)}
                    >
                        Auto
                    </button>
                </div>

                {/* Balance Row */}
                <div style={styles.balanceRow}>
                    <div style={styles.balanceLeft}>
                        <WalletIcon />
                        <span style={styles.balanceAmount}>{userBalance.toFixed(4)} BNB</span>
                    </div>
                    <div style={styles.quickAmounts}>
                        <button style={styles.quickBtn} onClick={() => handleQuickAmount(1)}>+1</button>
                        <button style={styles.quickBtn} onClick={() => handleQuickAmount(0.1)}>+0.1</button>
                        <button style={styles.quickBtn} onClick={() => handleQuickAmount(0.01)}>+0.01</button>
                    </div>
                </div>

                {/* Amount Input */}
                <div style={styles.inputRow}>
                    <div style={styles.inputLeft}>
                        <BnbLogo size={20} />
                        <span style={styles.inputLabel}>BNB</span>
                    </div>
                    <input
                        type="text"
                        style={{ ...styles.amountInput, color: "#fff" }}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </div>

                {/* Manual Mode Controls */}
                {mode === "manual" && (
                    <>
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
                            <span style={styles.totalValue}>{totalAmount.toFixed(2)} BNB</span>
                        </div>
                    </>
                )}

                {/* Auto Mode Controls */}
                {mode === "auto" && (
                    <>
                        {/* Blocks Input */}
                        <div style={styles.autoRow}>
                            <div style={styles.autoRowLeft}>
                                <BlocksIcon />
                                <span style={styles.autoRowLabel}>Blocks</span>
                            </div>
                            <input
                                type="number"
                                min="1"
                                max="25"
                                style={styles.autoInput}
                                value={autoBlocks}
                                onChange={(e) => setAutoBlocks(Math.max(1, Math.min(25, parseInt(e.target.value) || 1)))}
                            />
                        </div>

                        {/* Rounds Input */}
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
                                value={autoRounds}
                                onChange={(e) => setAutoRounds(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                            />
                        </div>

                        {/* Auto-reload Toggle */}
                        <div style={styles.autoRow}>
                            <div style={styles.autoRowLeft}>
                                <ReloadIcon />
                                <span style={styles.autoRowLabel}>Auto-reload</span>
                            </div>
                            <button
                                style={{
                                    ...styles.checkboxBtn,
                                    ...(autoReload ? styles.checkboxBtnActive : {}),
                                }}
                                onClick={() => setAutoReload(!autoReload)}
                            >
                                {autoReload && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#000">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* Block Selection */}
                        <div style={styles.row}>
                            <span style={styles.rowLabel}>Blocks</span>
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
                                <span style={styles.blockCount}>
                                    {blockSelection === "all" ? `x${autoBlocks}` : "Random"}
                                </span>
                            </div>
                        </div>

                        {/* Total Per Round */}
                        <div style={styles.row}>
                            <span style={styles.rowLabel}>Total per round</span>
                            <span style={styles.totalValue}>{totalPerRound.toFixed(2)} BNB</span>
                        </div>

                        {/* Total */}
                        <div style={styles.totalRow}>
                            <span style={styles.rowLabel}>Total</span>
                            <span style={styles.totalValue}>{totalAmount.toFixed(2)} BNB</span>
                        </div>
                    </>
                )}

                {/* Deploy Button */}
                {isConnected ? (
                    <button
                        style={{
                            ...styles.deployBtn,
                            ...(totalAmount <= 0 ? styles.deployBtnDisabled : {}),
                        }}
                        onClick={() => onDeploy?.(totalAmount, effectiveBlocks)}
                        disabled={totalAmount <= 0}
                    >
                        Deploy
                    </button>
                ) : (
                    <button style={styles.connectBtn} onClick={openConnectModal}>
                        Connect Wallet
                    </button>
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

    // Stats Grid
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

    // Controls Card
    controlsCard: {
        background: "#111",
        border: "1px solid #222",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
    },

    // Mode Toggle
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
    modeBtnAutoActive: {
        border: "1px solid #3b82f6",
    },
    modeBtnHover: {
        background: "#1a1a1a",
        color: "#888",
    },

    // Balance Row
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

    // Input Row
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

    // Auto Mode Rows
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

    // Checkbox Button
    checkboxBtn: {
        width: "24px",
        height: "24px",
        background: "transparent",
        border: "2px solid #444",
        borderRadius: "4px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
    },
    checkboxBtnActive: {
        background: "#fff",
        borderColor: "#fff",
    },

    // Generic Row
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

    // Block Selection Toggle (Auto)
    blockSelectionToggle: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    blockSelectionLabel: {
        fontSize: "14px",
        color: "#666",
        fontWeight: 500,
    },

    // Total Row
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

    // Buttons
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
}
