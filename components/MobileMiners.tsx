'use client'

import React, { useState, useEffect } from "react"

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

export default function MobileMiners() {
    const [isExpanded, setIsExpanded] = useState(false)
    const [currentRound, setCurrentRound] = useState(122168)
    const [showMiners, setShowMiners] = useState(false)

    useEffect(() => {
        const handlePhaseChange = (event: CustomEvent) => {
            const { phase, round } = event.detail
            if (phase === "miners") {
                setCurrentRound(round)
                setShowMiners(true)
                setIsExpanded(true)
            }
        }

        window.addEventListener("phaseChange" as any, handlePhaseChange)
        return () => window.removeEventListener("phaseChange" as any, handlePhaseChange)
    }, [])

    if (!showMiners) return null

    return (
        <div style={styles.container}>
            <button 
                style={styles.header}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div style={styles.headerLeft}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#F0B90B">
                        <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
                    </svg>
                    <span style={styles.title}>Miners</span>
                    <span style={styles.roundLabel}>Round #{currentRound - 1}</span>
                </div>
                <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="#666"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                </svg>
            </button>

            {isExpanded && (
                <div style={styles.minersList}>
                    {mockMiners.map((miner, index) => (
                        <div key={index} style={styles.minerRow}>
                            <span style={styles.minerAddress}>{miner.address}</span>
                            <div style={styles.minerAmounts}>
                                <span style={styles.beansAmount}><BeanLogo size={14} /> {miner.beansAmount.toFixed(4)}</span>
                                <span style={styles.bnbAmount}>+ ⛓️ {miner.bnbAmount.toFixed(4)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        background: '#111',
        border: '1px solid #222',
        borderRadius: '12px',
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, sans-serif",
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'transparent',
        border: 'none',
        width: '100%',
        cursor: 'pointer',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    title: {
        fontSize: '15px',
        fontWeight: 600,
        color: '#fff',
    },
    roundLabel: {
        fontSize: '12px',
        color: '#666',
    },
    minersList: {
        borderTop: '1px solid #222',
        maxHeight: '300px',
        overflowY: 'auto',
    },
    minerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #1a1a1a',
    },
    minerAddress: {
        fontSize: '13px',
        color: '#fff',
        fontFamily: 'monospace',
    },
    minerAmounts: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    beansAmount: {
        fontSize: '12px',
        color: '#F0B90B',
    },
    bnbAmount: {
        fontSize: '12px',
        color: '#666',
    },
}
