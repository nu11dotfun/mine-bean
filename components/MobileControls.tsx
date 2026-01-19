'use client'

import React, { useState, useEffect, useRef } from "react"
import { useConnectModal } from '@rainbow-me/rainbowkit'

interface MobileControlsProps {
    userBalance?: number
    isConnected?: boolean
    onDeploy?: (amount: number, blocks: number) => void
}

interface Miner {
    address: string
    beansAmount: number
    bnbAmount: number
}

const mockMiners: Miner[] = [
    { address: "0x8Q4M...KJdZ", beansAmount: 0.1291, bnbAmount: 1.418094471 },
    { address: "0x6qJ6...6ZcE", beansAmount: 0.1076, bnbAmount: 1.181745392 },
    { address: "0x2NG3...LtBY", beansAmount: 0.0886, bnbAmount: 0.973758203 },
    { address: "0x9Upy...zqsu", beansAmount: 0.086, bnbAmount: 0.945396314 },
    { address: "0xGHxi...496n", beansAmount: 0.086, bnbAmount: 0.945396314 },
    { address: "0x86tD...4TPE", beansAmount: 0.0658, bnbAmount: 0.723431346 },
    { address: "0x4odE...P47z", beansAmount: 0.0538, bnbAmount: 0.590872696 },
    { address: "0xDiE1...d23v", beansAmount: 0.0516, bnbAmount: 0.567237788 },
]

const BNB_LOGO_URL = "https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"

export default function MobileControls({
    userBalance = 0,
    isConnected = false,
    onDeploy,
}: MobileControlsProps) {
    const { openConnectModal } = useConnectModal()
    const [mode, setMode] = useState<"manual" | "auto">("manual")
    const [amount, setAmount] = useState("0")
    const [selectedBlockCount, setSelectedBlockCount] = useState(0)
    const minersRef = useRef<HTMLDivElement>(null)
    
    // Auto mode state
    const [autoBlocks, setAutoBlocks] = useState(1)
    const [autoRounds, setAutoRounds] = useState(1)
    const [autoReload, setAutoReload] = useState(false)
    const [blockSelection, setBlockSelection] = useState<"all" | "random">("random")
    
    // Game loop state
    const [timer, setTimer] = useState(60)
    const [currentRound, setCurrentRound] = useState(122168)
    const [phase, setPhase] = useState<"counting" | "eliminating" | "winner" | "miners">("counting")
    const [showMiners, setShowMiners] = useState(false)
    const [minersRound, setMinersRound] = useState(122167)

    useEffect(() => {
        const handleBlocksChanged = (event: CustomEvent) => {
            setSelectedBlockCount(event.detail.count)
        }
        window.addEventListener("blocksChanged" as any, handleBlocksChanged)
        return () => window.removeEventListener("blocksChanged" as any, handleBlocksChanged)
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
                        window.dispatchEvent(
                            new CustomEvent("timerUpdate", { detail: { timer: 0 } })
                        )
                        return 0
                    }
                    window.dispatchEvent(
                        new CustomEvent("timerUpdate", { detail: { timer: prev - 1 } })
                    )
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
                setMinersRound(currentRound)
                setShowMiners(true)
                const newRound = currentRound + 1
                setCurrentRound(newRound)
                window.dispatchEvent(
                    new CustomEvent("phaseChange", {
                        detail: { phase: "miners", round: newRound },
                    })
                )
                setTimeout(() => {
                    minersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 100)
            }, 1000)
        } else if (phase === "miners") {
            setTimeout(() => {
                setPhase("counting")
                setTimer(60)
                setSelectedBlockCount(0)
                setShowMiners(false)
                window.dispatchEvent(
                    new CustomEvent("phaseChange", {
                        detail: { phase: "counting", round: currentRound },
                    })
                )
                window.dispatchEvent(
                    new CustomEvent("timerUpdate", { detail: { timer: 60 } })
                )
            }, 4000)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [phase, currentRound])

    const handleQuickAmount = (value: number) => {
        const current = parseFloat(amount) || 0
        setAmount((current + value).toFixed(2))
    }

    const handleAllClick = () => {
        if (mode === "manual") {
            const newSelectAll = selectedBlockCount !== 25
            window.dispatchEvent(new CustomEvent("selectAllBlocks", { detail: { selectAll: newSelectAll } }))
        } else {
            if (blockSelection === "all") {
                setBlockSelection("random")
                window.dispatchEvent(new CustomEvent("selectAllBlocks", { detail: { selectAll: false } }))
            } else {
                setBlockSelection("all")
                setAutoBlocks(25)
                window.dispatchEvent(new CustomEvent("selectAllBlocks", { detail: { selectAll: true } }))
            }
        }
    }

    const baseAmount = parseFloat(amount) || 0
    const effectiveBlocks = mode === "auto" 
        ? (blockSelection === "all" ? 25 : autoBlocks)
        : selectedBlockCount
    const totalPerRound = baseAmount * effectiveBlocks
    const totalAmount = mode === "auto" ? totalPerRound * autoRounds : totalPerRound

    return (
        <>
            {/* Controls Card */}
            <div style={styles.container}>
                {/* Mode Toggle */}
                <div style={styles.modeToggle}>
                    <button
                        style={{...styles.modeBtn, ...(mode === "manual" ? styles.modeBtnActive : {})}}
                        onClick={() => setMode("manual")}
                    >
                        Manual
                    </button>
                    <button
                        style={{...styles.modeBtn, ...(mode === "auto" ? styles.modeBtnActive : {}), }}
                        onClick={() => setMode("auto")}
                    >
                        Auto
                    </button>
                </div>

                {/* Balance Row */}
                <div style={styles.balanceRow}>
                    <div style={styles.balanceLeft}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#666">
                            <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                        </svg>
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
                        <img src={BNB_LOGO_URL} alt="BNB" style={{ width: 18, height: 18, objectFit: "contain" }} />
                        <span style={styles.inputLabel}>BNB</span>
                    </div>
                    <input
                        type="text"
                        style={styles.amountInput}
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
                                    style={{...styles.allBtn, ...(selectedBlockCount === 25 ? styles.allBtnActive : {})}}
                                    onClick={handleAllClick}
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
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#888">
                                    <circle cx="7" cy="7" r="2.5" />
                                    <circle cx="17" cy="7" r="2.5" />
                                    <circle cx="7" cy="17" r="2.5" />
                                    <circle cx="17" cy="17" r="2.5" />
                                </svg>
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
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                                    <line x1="4" y1="6" x2="20" y2="6" />
                                    <line x1="4" y1="12" x2="20" y2="12" />
                                    <line x1="4" y1="18" x2="20" y2="18" />
                                </svg>
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
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#888">
                                    <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                                </svg>
                                <span style={styles.autoRowLabel}>Auto-reload</span>
                            </div>
                            <button
                                style={{...styles.checkboxBtn, ...(autoReload ? styles.checkboxBtnActive : {})}}
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
                            <span style={styles.rowLabel}>Selection</span>
                            <div style={styles.rowRight}>
                                <button
                                    style={{...styles.allBtn, ...(blockSelection === "all" ? styles.allBtnActive : {})}}
                                    onClick={handleAllClick}
                                >
                                    All
                                </button>
                                <span style={styles.blockCount}>
                                    {blockSelection === "all" ? "x25" : "Random"}
                                </span>
                            </div>
                        </div>

                        {/* Total Per Round */}
                        <div style={styles.row}>
                            <span style={styles.rowLabel}>Per round</span>
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
                        style={{...styles.deployBtn, ...(totalAmount <= 0 ? styles.deployBtnDisabled : {})}}
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

            {/* Miners Card - Only shows during miners phase */}
            {showMiners && (
                <div ref={minersRef} style={styles.minersCard}>
                    <div style={styles.minersHeader}>
                        <span style={styles.minersTitle}>Miners</span>
                        <span style={styles.minersRound}>Round #{minersRound}</span>
                    </div>
                    <div style={styles.minersList}>
                        {mockMiners.map((miner, index) => (
                            <div key={index} style={styles.minerRow}>
                                <span style={styles.minerAddress}>{miner.address}</span>
                                <div style={styles.minerAmounts}>
                                    <span style={styles.beansAmount}>🫘 {miner.beansAmount.toFixed(4)}</span>
                                    <span style={styles.bnbAmount}>+ {miner.bnbAmount.toFixed(4)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        fontFamily: "'Inter', -apple-system, sans-serif",
        background: "#111",
        border: "1px solid #222",
        borderRadius: "12px",
        padding: "14px",
    },
    modeToggle: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px",
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
    },
    modeBtnActive: {
        background: "#222",
        color: "#fff",
    },
    modeBtnAutoActive: {
        border: "1px solid #3b82f6",
    },
    balanceRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    balanceLeft: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
    },
    balanceAmount: {
        color: "#fff",
        fontWeight: 600,
    },
    quickAmounts: {
        display: "flex",
        gap: "6px",
    },
    quickBtn: {
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: "6px",
        padding: "5px 10px",
        fontSize: "11px",
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
        padding: "10px 12px",
    },
    inputLeft: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    inputLabel: {
        color: "#fff",
        fontSize: "14px",
        fontWeight: 600,
    },
    amountInput: {
        background: "transparent",
        border: "none",
        fontSize: "22px",
        fontWeight: 700,
        color: "#fff",
        textAlign: "right" as const,
        width: "100px",
        fontFamily: "inherit",
        outline: "none",
    },
    row: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    rowLabel: {
        fontSize: "13px",
        color: "#666",
        fontWeight: 500,
    },
    rowRight: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    allBtn: {
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: "6px",
        padding: "5px 14px",
        fontSize: "12px",
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
        fontSize: "14px",
        fontWeight: 700,
        color: "#fff",
    },
    totalRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: "8px",
        borderTop: "1px solid #222",
    },
    totalValue: {
        fontSize: "14px",
        fontWeight: 700,
        color: "#fff",
    },
    // Auto mode styles
    autoRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "2px 0",
    },
    autoRowLeft: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    autoRowLabel: {
        fontSize: "14px",
        color: "#fff",
        fontWeight: 600,
    },
    autoInput: {
        background: "transparent",
        border: "none",
        fontSize: "20px",
        fontWeight: 700,
        color: "#666",
        textAlign: "right" as const,
        width: "50px",
        fontFamily: "inherit",
        outline: "none",
    },
    checkboxBtn: {
        width: "22px",
        height: "22px",
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
    deployBtn: {
        width: "100%",
        background: "#222",
        border: "none",
        borderRadius: "8px",
        padding: "12px",
        fontSize: "14px",
        fontWeight: 600,
        color: "#666",
        cursor: "pointer",
        fontFamily: "inherit",
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
        padding: "12px",
        fontSize: "14px",
        fontWeight: 700,
        color: "#000",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    minersCard: {
        marginTop: "12px",
        background: "#111",
        border: "1px solid #222",
        borderRadius: "12px",
        padding: "14px",
        fontFamily: "'Inter', -apple-system, sans-serif",
    },
    minersHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "10px",
    },
    minersTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#fff",
    },
    minersRound: {
        fontSize: "12px",
        color: "#666",
    },
    minersList: {},
    minerRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #1a1a1a",
    },
    minerAddress: {
        fontSize: "12px",
        color: "#fff",
        fontFamily: "monospace",
    },
    minerAmounts: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    beansAmount: {
        fontSize: "11px",
        color: "#F0B90B",
    },
    bnbAmount: {
        fontSize: "11px",
        color: "#666",
    },
}
