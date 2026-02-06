'use client'

import React, { useState, useEffect, useRef, useCallback } from "react"
import { apiFetch } from "@/lib/api"

interface Miner {
    address: string
    bnbRewardFormatted: string
    beanRewardFormatted: string
    deployedFormatted: string
}

interface MinersResponse {
    roundId: number
    winningBlock: number
    miners: Miner[]
}

function truncateAddress(address: string): string {
    if (address.length <= 13) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export default function MinersPanel() {
    const [isOpen, setIsOpen] = useState(false)
    const [isHoveringTab, setIsHoveringTab] = useState(false)
    const [miners, setMiners] = useState<Miner[]>([])
    const [roundId, setRoundId] = useState<number | null>(null)
    const [winningBlock, setWinningBlock] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)

    // Store settled roundId so we can fetch miners after animation completes
    const settledRoundIdRef = useRef<string | null>(null)

    const fetchMiners = useCallback((id: string) => {
        setLoading(true)
        apiFetch<MinersResponse>(`/api/round/${id}/miners`)
            .then((data) => {
                if (data.miners.length > 0) {
                    setMiners(data.miners)
                    setRoundId(data.roundId)
                    setWinningBlock(data.winningBlock)
                    setIsOpen(true)
                }
                // If no miners (empty round), keep showing previous round's data
                // but don't open the panel — it stays as-is
            })
            .catch((err) => console.error('Failed to fetch miners:', err))
            .finally(() => setLoading(false))
    }, [])

    // Listen for roundSettled → store the settled roundId (consumed once by settlementComplete)
    useEffect(() => {
        const handleRoundSettled = (event: CustomEvent) => {
            const { roundId: settledId } = event.detail
            settledRoundIdRef.current = settledId
        }

        window.addEventListener("roundSettled" as any, handleRoundSettled)
        return () => window.removeEventListener("roundSettled" as any, handleRoundSettled)
    }, [])

    // Listen for settlementComplete → fetch miners for the settled round
    useEffect(() => {
        const handleSettlementComplete = () => {
            if (settledRoundIdRef.current) {
                fetchMiners(settledRoundIdRef.current)
                settledRoundIdRef.current = null
            }
        }

        window.addEventListener("settlementComplete", handleSettlementComplete)
        return () => window.removeEventListener("settlementComplete", handleSettlementComplete)
    }, [fetchMiners])

    // Don't show tab if no miners data yet
    const hasData = miners.length > 0

    return (
        <>
            {/* Collapsed Tab - Attached to left edge */}
            {!isOpen && hasData && (
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
                    <span style={styles.panelTitle}>Winners</span>
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
                        Round #{roundId}{winningBlock !== null ? ` · Block #${winningBlock + 1}` : ''}
                    </span>
                    <span style={styles.minerCount}>
                        {miners.length} winner{miners.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Miners List */}
                <div style={styles.minersList}>
                    {loading ? (
                        <div style={styles.emptyState}>Loading...</div>
                    ) : miners.length === 0 ? (
                        <div style={styles.emptyState}>No miners data</div>
                    ) : (
                        miners.map((miner, index) => (
                            <div key={index} style={styles.minerRow}>
                                <span style={styles.minerAddress}>
                                    {truncateAddress(miner.address)}
                                </span>
                                <div style={styles.minerAmounts}>
                                    <span style={styles.bnbAmount}>
                                        <img src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public" alt="BNB" style={{width: 14, height: 14, marginRight: 4}} />
                                        {parseFloat(miner.bnbRewardFormatted).toFixed(6)}
                                    </span>
                                    {parseFloat(miner.beanRewardFormatted) > 0 && (
                                        <>
                                            <span style={styles.plusSign}>+</span>
                                            <span style={styles.beansAmount}>
                                                🫘 {parseFloat(miner.beanRewardFormatted).toFixed(4)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
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
        display: "flex",
        alignItems: "center",
    },
    emptyState: {
        padding: "40px 20px",
        textAlign: "center",
        color: "#555",
        fontSize: "13px",
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
