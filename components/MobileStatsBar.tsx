'use client'

import React, { useState, useEffect } from "react"

// Move icons OUTSIDE component to prevent re-creation on each render
const BeanIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#F0B90B">
        <ellipse cx="12" cy="10" rx="7" ry="5" />
        <ellipse cx="12" cy="14" rx="7" ry="5" />
    </svg>
)

const BNB_LOGO_URL = "https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"

export default function MobileStatsBar() {
    const [timer, setTimer] = useState(60)
    const [beanpotAmount] = useState(235.4)
    const [totalDeployed] = useState(9.8563)
    const [userDeployed] = useState(0)

    // Listen for timer updates from MobileControls
    useEffect(() => {
        const handleTimerUpdate = (event: CustomEvent) => {
            setTimer(event.detail.timer)
        }
        window.addEventListener('timerUpdate' as any, handleTimerUpdate)
        return () => window.removeEventListener('timerUpdate' as any, handleTimerUpdate)
    }, [])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }

    return (
        <div style={styles.container}>
            <div style={styles.row}>
                <div style={styles.stat}>
                    <div style={styles.valueRow}>
                        <BeanIcon />
                        <span style={styles.value}>{beanpotAmount.toFixed(1)}</span>
                    </div>
                    <span style={styles.label}>Beanpot</span>
                </div>
                <div style={styles.stat}>
                    <div style={styles.valueRow}>
                        <span style={styles.value}>{formatTime(timer)}</span>
                    </div>
                    <span style={styles.label}>Time remaining</span>
                </div>
            </div>
            <div style={styles.row}>
                <div style={styles.stat}>
                    <div style={styles.valueRow}>
                        <img src={BNB_LOGO_URL} alt="BNB" style={styles.bnbLogo} />
                        <span style={styles.value}>{totalDeployed.toFixed(4)}</span>
                    </div>
                    <span style={styles.label}>Total deployed</span>
                </div>
                <div style={styles.stat}>
                    <div style={styles.valueRow}>
                        <img src={BNB_LOGO_URL} alt="BNB" style={styles.bnbLogo} />
                        <span style={styles.value}>{userDeployed}</span>
                    </div>
                    <span style={styles.label}>You deployed</span>
                </div>
            </div>
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        fontFamily: "'Inter', -apple-system, sans-serif",
    },
    row: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
    },
    stat: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        background: '#111',
        border: '1px solid #222',
        borderRadius: '12px',
        padding: '16px 10px',
    },
    valueRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    value: {
        fontSize: '22px',
        fontWeight: 700,
        color: '#fff',
    },
    label: {
        fontSize: '13px',
        color: '#666',
        fontWeight: 500,
    },
    bnbLogo: {
        width: 20,
        height: 20,
        objectFit: 'contain' as const,
    },
}
