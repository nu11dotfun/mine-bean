'use client'

import React, { useState, useEffect } from "react"
import BeanLogo from './BeanLogo'
import { apiFetch } from '../lib/api'

// API response interfaces
interface StatsResponse {
    totalSupply: string
    totalSupplyFormatted: string
}

interface TreasuryStatsResponse {
    totalVaulted: string
    totalVaultedFormatted: string
    totalBurned: string
    totalBurnedFormatted: string
}

// Contract constant
const MAX_SUPPLY = 3_000_000

interface GlobalStatsProps {
    isMobile?: boolean
}

export default function GlobalStats({
    isMobile = false,
}: GlobalStatsProps) {
    const [mounted, setMounted] = useState(false)
    const [data, setData] = useState<{
        circulatingSupply: number
        burned: number
        protocolRevenue: number
    } | null>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return

        const fetchStats = async () => {
            try {
                const [statsRes, treasuryRes] = await Promise.all([
                    apiFetch<StatsResponse>('/api/stats'),
                    apiFetch<TreasuryStatsResponse>('/api/treasury/stats')
                ])
                setData({
                    circulatingSupply: parseFloat(statsRes.totalSupplyFormatted),
                    burned: parseFloat(treasuryRes.totalBurnedFormatted),
                    protocolRevenue: parseFloat(treasuryRes.totalVaultedFormatted)
                })
            } catch (err) {
                console.error('Failed to fetch stats:', err)
            }
        }
        fetchStats()
    }, [mounted])

    const stats = [
        {
            value: MAX_SUPPLY.toLocaleString(),
            label: "Max Supply",
            iconType: "beans",
        },
        {
            value: data?.circulatingSupply != null
                ? Math.floor(data.circulatingSupply).toLocaleString()
                : "—",
            label: "Circulating Supply",
            iconType: "beans",
        },
        {
            value: data?.burned != null
                ? Math.floor(data.burned).toLocaleString()
                : "—",
            label: "Burned",
            iconType: "beans",
        },
        {
            value: data?.protocolRevenue != null
                ? data.protocolRevenue.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                : "—",
            label: "Protocol Revenue",
            iconType: "bnb",
        },
    ]

    // Return null until mounted to prevent hydration mismatch
    if (!mounted) {
        return null
    }

    if (isMobile) {
        return (
            <div style={styles.mobileWrapper}>
                <div style={styles.mobileHeader}>
                    <h1 style={styles.mobileTitle}>Global</h1>
                    <p style={styles.mobileSubtitle}>Review protocol stats and activity.</p>
                </div>

                <div style={styles.mobileGrid}>
                    {stats.map((stat, index) => (
                        <div key={index} style={styles.mobileStatBox}>
                            <div style={styles.mobileStatValue}>
                                {stat.iconType === "beans" && <BeanLogo size={14} />}
                                {stat.iconType === "bnb" && (
                                    <img
                                        src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"
                                        alt="BNB"
                                        style={styles.mobileIcon}
                                    />
                                )}
                                <span>{stat.value}</span>
                            </div>
                            <div style={styles.mobileStatLabel}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div style={styles.wrapper}>
            <div style={styles.header}>
                <h1 style={styles.title}>Global</h1>
                <p style={styles.subtitle}>
                    Review protocol stats and activity.
                </p>
            </div>

            <div style={styles.container}>
                {stats.map((stat, index) => (
                    <div key={index} style={styles.statBox}>
                        <div style={styles.statValue}>
                            {stat.iconType === "beans" && <BeanLogo size={20} />}
                            {stat.iconType === "bnb" && (
                                <img
                                    src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"
                                    alt="BNB"
                                    style={styles.bnbIcon}
                                />
                            )}
                            <span>{stat.value}</span>
                        </div>
                        <div style={styles.statLabel}>{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    wrapper: {
        paddingTop: "40px",
        paddingBottom: "20px",
    },
    header: {
        marginBottom: "32px",
    },
    title: {
        fontSize: "36px",
        fontWeight: 700,
        color: "#fff",
        margin: 0,
        marginBottom: "8px",
    },
    subtitle: {
        fontSize: "16px",
        color: "#666",
        margin: 0,
    },
    container: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px",
        marginBottom: "40px",
    },
    statBox: {
        background: "transparent",
        border: "1px solid #222",
        borderRadius: "12px",
        padding: "24px 20px",
        textAlign: "center" as const,
    },
    statValue: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontSize: "22px",
        fontWeight: 600,
        color: "#fff",
        marginBottom: "10px",
    },
    bnbIcon: {
        width: "22px",
        height: "22px",
        objectFit: "contain" as const,
    },
    statLabel: {
        fontSize: "14px",
        color: "#666",
    },
    mobileWrapper: {
        paddingBottom: "16px",
    },
    mobileHeader: {
        marginBottom: "12px",
    },
    mobileTitle: {
        fontSize: "20px",
        fontWeight: 700,
        color: "#fff",
        margin: 0,
        marginBottom: "4px",
    },
    mobileSubtitle: {
        fontSize: "12px",
        color: "#666",
        margin: 0,
    },
    mobileGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
    },
    mobileStatBox: {
        background: "transparent",
        border: "1px solid #222",
        borderRadius: "10px",
        padding: "12px 10px",
        textAlign: "center" as const,
    },
    mobileStatValue: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "5px",
        fontSize: "15px",
        fontWeight: 600,
        color: "#fff",
        marginBottom: "4px",
    },
    mobileIcon: {
        width: "14px",
        height: "14px",
        objectFit: "contain" as const,
    },
    mobileStatLabel: {
        fontSize: "10px",
        color: "#666",
    },
}
