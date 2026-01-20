'use client'

import React, { useState, useEffect } from "react"

interface Miner {
    address: string
    beansAmount: number
    bnbAmount: number
}

interface MinersPanelProps {
    roundNumber?: number
}

// Mock miners data for demo
const mockMiners: Miner[] = [
    { address: "0x8Q4M...KJdZ", beansAmount: 0.1291, bnbAmount: 1.418094471 },
    { address: "0x6qJ6...6ZcE", beansAmount: 0.1076, bnbAmount: 1.181745392 },
    { address: "0x2NG3...LtBY", beansAmount: 0.0886, bnbAmount: 0.973758203 },
    { address: "0x9Upy...zqsu", beansAmount: 0.086, bnbAmount: 0.945396314 },
    { address: "0xGHxi...496n", beansAmount: 0.086, bnbAmount: 0.945396314 },
    { address: "0x86tD...4TPE", beansAmount: 0.0658, bnbAmount: 0.723431346 },
    { address: "0x4odE...P47z", beansAmount: 0.0538, bnbAmount: 0.590872696 },
    { address: "0xDiE1...d23v", beansAmount: 0.0516, bnbAmount: 0.567237788 },
    { address: "0xB5aV...LN8W", beansAmount: 0.043, bnbAmount: 0.472698157 },
    { address: "0x5X7B...eupM", beansAmount: 0.0335, bnbAmount: 0.368704562 },
    { address: "0xEgg1...WVLV", beansAmount: 0.0253, bnbAmount: 0.277832927 },
    { address: "0xHTA4...Ucgb", beansAmount: 0.0229, bnbAmount: 0.252089927 },
    { address: "0xJC9F...wVCh", beansAmount: 0.0215, bnbAmount: 0.236349078 },
    { address: "0x52KM...93YH", beansAmount: 0.0215, bnbAmount: 0.236349078 },
    { address: "0xFwny...9LA6", beansAmount: 0.0174, bnbAmount: 0.191442753 },
]

export default function MinersPanel({
    roundNumber = 122168,
}: MinersPanelProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [currentRound, setCurrentRound] = useState(roundNumber)
    const [isHoveringTab, setIsHoveringTab] = useState(false)

    // Listen for phase change events
    useEffect(() => {
        const handlePhaseChange = (event: CustomEvent) => {
            const { phase, round } = event.detail

            if (phase === "miners") {
                setCurrentRound(round)
                setIsOpen(true)
            } else if (phase === "counting") {
                setIsOpen(false)
            }
        }

        window.addEventListener("phaseChange" as any, handlePhaseChange)
        return () =>
            window.removeEventListener("phaseChange" as any, handlePhaseChange)
    }, [])

    return (
        <>
            {/* Collapsed Tab - Attached to left edge */}
            {!isOpen && (
                <div
                    style={{
                        ...styles.tab,
                        borderWidth: isHoveringTab ? "2px" : "1px",
                    }}
                    onClick={() => setIsOpen(true)}
                    onMouseEnter={() => setIsHoveringTab(true)}
                    onMouseLeave={() => setIsHoveringTab(false)}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#666">
                        <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
                    </svg>
                </div>
            )}

            {/* Expanded Panel */}
            <div
                style={{
                    ...styles.panel,
                    ...(isOpen ? styles.panelOpen : styles.panelClosed),
                }}
            >
                {/* Panel Header */}
                <div style={styles.panelHeader}>
                    <span style={styles.panelTitle}>Miners</span>
                    <button
                        style={styles.closeBtn}
                        onClick={() => setIsOpen(false)}
                    >
                        ✕
                    </button>
                </div>

                {/* Round Info */}
                <div style={styles.roundInfo}>
                    <span style={styles.roundLabel}>
                        Round: #{currentRound - 1} (Previous)
                    </span>
                    <span style={styles.minerCount}>
                        👤 {mockMiners.length}
                    </span>
                </div>

                {/* Miners List */}
                <div style={styles.minersList}>
                    {mockMiners.map((miner, index) => (
                        <div key={index} style={styles.minerRow}>
                            <span style={styles.minerAddress}>
                                {miner.address}
                            </span>
                            <div style={styles.minerAmounts}>
                                <span style={styles.beansAmount}>
                                    🫘 {miner.beansAmount.toFixed(4)}
                                </span>
                                <span style={styles.plusSign}>+</span>
                                <span style={styles.bnbAmount}>
                                    <img src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public" alt="BNB" style={{width: 14, height: 14, marginRight: 4}} /> {miner.bnbAmount.toFixed(4)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Overlay to close when clicking outside */}
            {isOpen && (
                <div style={styles.overlay} onClick={() => setIsOpen(false)} />
            )}
        </>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    // Collapsed Tab - Attached to left edge
    tab: {
        position: "fixed",
        left: 0,
        top: "100px",
        background: "#111",
        borderRadius: "0 8px 8px 0",
        padding: "14px 12px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        transition: "border-width 0.15s ease",
        border: "1px solid #F0B90B",
        borderLeft: "none",
    },

    // Expanded Panel
    panel: {
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: "360px",
        background: "#0a0a0a",
        borderRight: "1px solid #222",
        display: "flex",
        flexDirection: "column",
        zIndex: 101,
        transition: "transform 0.3s ease",
        fontFamily: "'Inter', -apple-system, sans-serif",
    },
    panelOpen: {
        transform: "translateX(0)",
    },
    panelClosed: {
        transform: "translateX(-100%)",
    },

    // Panel Header
    panelHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px",
        borderBottom: "1px solid #222",
    },
    panelTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
    },
    closeBtn: {
        background: "transparent",
        border: "none",
        color: "#666",
        fontSize: "18px",
        cursor: "pointer",
        padding: "4px 8px",
        borderRadius: "4px",
        transition: "color 0.15s",
    },

    // Round Info
    roundInfo: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
        borderBottom: "1px solid #1a1a1a",
    },
    roundLabel: {
        fontSize: "13px",
        color: "#666",
    },
    minerCount: {
        fontSize: "13px",
        color: "#666",
    },

    // Miners List
    minersList: {
        flex: 1,
        overflowY: "auto",
        padding: "8px 0",
    },
    minerRow: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "12px 20px",
        borderBottom: "1px solid #111",
    },
    minerAddress: {
        fontSize: "14px",
        color: "#fff",
        fontFamily: "monospace",
    },
    minerAmounts: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    beansAmount: {
        fontSize: "13px",
        color: "#F0B90B",
        fontWeight: 500,
    },
    plusSign: {
        fontSize: "11px",
        color: "#444",
    },
    bnbAmount: {
        fontSize: "13px",
        color: "#888",
    },

    // Overlay
    overlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 100,
    },
}
