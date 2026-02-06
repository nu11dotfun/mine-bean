'use client'

import React, { useState, useEffect, useRef } from "react"

// Move icons OUTSIDE component to prevent re-creation on each render
const BeanIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#F0B90B">
        <ellipse cx="12" cy="10" rx="7" ry="5" />
        <ellipse cx="12" cy="14" rx="7" ry="5" />
    </svg>
)

const BNB_LOGO_URL = "https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"

interface MobileStatsBarProps {
    userAddress?: string
}

export default function MobileStatsBar({ userAddress }: MobileStatsBarProps) {
    const [timer, setTimer] = useState(0)
    const [motherlodePool, setMotherlodePool] = useState(0)
    const [totalDeployed, setTotalDeployed] = useState(0)
    const [userDeployed, setUserDeployed] = useState(0)
    const endTimeRef = useRef(0)

    // Listen for round data from MiningGrid
    useEffect(() => {
        const handleRoundData = (event: CustomEvent) => {
            const d = event.detail
            if (d.endTime) endTimeRef.current = typeof d.endTime === 'number' ? d.endTime : 0
            if (d.motherlodePoolFormatted) setMotherlodePool(parseFloat(d.motherlodePoolFormatted) || 0)
            if (d.totalDeployedFormatted !== undefined) setTotalDeployed(parseFloat(d.totalDeployedFormatted) || 0)
            if (d.userDeployedFormatted !== undefined) setUserDeployed(parseFloat(d.userDeployedFormatted) || 0)
        }

        const handleRoundDeployed = (event: CustomEvent) => {
            const d = event.detail
            if (d.totalDeployedFormatted) setTotalDeployed(parseFloat(d.totalDeployedFormatted) || 0)
            // Update user deployed if this deployment is from the connected user
            if (d.user && userAddress && d.user.toLowerCase() === userAddress.toLowerCase() && d.userDeployedFormatted) {
                setUserDeployed(parseFloat(d.userDeployedFormatted) || 0)
            }
        }

        window.addEventListener("roundData" as any, handleRoundData)
        window.addEventListener("roundDeployed" as any, handleRoundDeployed)
        return () => {
            window.removeEventListener("roundData" as any, handleRoundData)
            window.removeEventListener("roundDeployed" as any, handleRoundDeployed)
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

    return (
        <div style={styles.container}>
            <div style={styles.row}>
                <div style={styles.stat}>
                    <div style={styles.valueRow}>
                        <BeanIcon />
                        <span style={styles.value}>
                            {motherlodePool > 0 ? motherlodePool.toFixed(1) : '—'}
                        </span>
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
                        <span style={styles.value}>
                            {totalDeployed > 0 ? totalDeployed.toFixed(4) : '—'}
                        </span>
                    </div>
                    <span style={styles.label}>Total deployed</span>
                </div>
                <div style={styles.stat}>
                    <div style={styles.valueRow}>
                        <img src={BNB_LOGO_URL} alt="BNB" style={styles.bnbLogo} />
                        <span style={styles.value}>{userDeployed > 0 ? userDeployed.toFixed(4) : '—'}</span>
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
