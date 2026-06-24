'use client'

import React, { useState, useEffect } from "react"
import BeanLogo from './BeanLogo'
import { apiFetch } from '../lib/api'
import AnalyticsChart, { ChartLine } from './analytics/AnalyticsChart'
import { fetchNetEmissions, NetEmissionsResponse } from '../lib/analyticsData'

// API response interfaces
interface PeriodEmission {
    rounds: number
    minted: number
}

interface BeanEmissions {
    '1d'?: PeriodEmission
    '7d'?: PeriodEmission
    '14d'?: PeriodEmission
    '30d'?: PeriodEmission
}

interface PeriodBurn {
    burnt: number
    events: number
}

interface BeanBurns {
    '1d'?: PeriodBurn
    '7d'?: PeriodBurn
    '14d'?: PeriodBurn
    '30d'?: PeriodBurn
}

interface StatsResponse {
    totalSupply: string
    totalSupplyFormatted: string
    totalMinted: string
    totalMintedFormatted: string
    beanEmissions?: BeanEmissions
    beanBurns?: BeanBurns
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
        burnedTotal: number
        protocolRevenue: number
        totalMinted: number
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
                    apiFetch<TreasuryStatsResponse>('/api/treasury/stats'),
                ])
                setData({
                    circulatingSupply: parseFloat(statsRes.totalSupplyFormatted),
                    burnedTotal: parseFloat(treasuryRes.totalBurnedFormatted),
                    protocolRevenue: parseFloat(treasuryRes.totalVaultedFormatted),
                    totalMinted: parseFloat(statsRes.totalMintedFormatted),
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
                : " - ",
            label: "Circulating Supply",
            iconType: "beans",
        },
        {
            value: data?.burnedTotal != null
                ? Math.floor(data.burnedTotal).toLocaleString()
                : " - ",
            label: "Burned",
            iconType: "beans",
        },
        {
            value: data?.protocolRevenue != null
                ? data.protocolRevenue.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                : " - ",
            label: "Protocol Revenue",
            iconType: "eth",
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
                                {stat.iconType === "eth" && (
                                    <img
                                        src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/f9461cf2-aacc-4c59-8b9d-59ade3c46c00/public"
                                        alt="ETH"
                                        style={styles.mobileIcon}
                                    />
                                )}
                                <span>{stat.value}</span>
                            </div>
                            <div style={styles.mobileStatLabel}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Net emissions per round */}
                <div style={{ marginTop: 16 }}>
                    <NetEmissionsCard isMobile={true} />
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
                            {stat.iconType === "eth" && (
                                <img
                                    src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/f9461cf2-aacc-4c59-8b9d-59ade3c46c00/public"
                                    alt="ETH"
                                    style={styles.ethIcon}
                                />
                            )}
                            <span>{stat.value}</span>
                        </div>
                        <div style={styles.statLabel}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Net emissions per round */}
            <div style={styles.trackerSection}>
                <NetEmissionsCard isMobile={false} />
            </div>
        </div>
    )
}

// ── Helpers ──

function NetEmissionsCard({ isMobile }: { isMobile: boolean }) {
    const [net, setNet] = useState<NetEmissionsResponse | null>(null)
    const [state, setState] = useState<'loading' | 'live' | 'empty'>('loading')

    useEffect(() => {
        fetchNetEmissions().then((r) => {
            if (r && r.points && r.points.length) {
                setNet(r)
                setState('live')
            } else {
                setState('empty')
            }
        })
    }, [])

    const pts = net?.points ?? []
    const lines: ChartLine[] = [
        { values: pts.map((p) => p.ma20), color: '#0052FF', width: 2, fill: true, name: '20-round average' },
        { values: pts.map((p) => p.ma100), color: '#ffffff', width: 2.5, name: '100-round average' },
    ]
    const latestMa100 = [...pts].reverse().find((p) => p.ma100 != null)?.ma100 ?? null

    return (
        <AnalyticsChart
            title="Net BEAN emissions per round"
            headline={latestMa100 != null ? `${latestMa100 >= 0 ? '+' : ''}${latestMa100.toFixed(2)} BEAN/round` : undefined}
            lines={lines}
            pointLabels={pts.map((p) => `Round ${p.roundId.toLocaleString()}`)}
            valueFormat={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
            zeroLine
            height={isMobile ? 200 : 260}
            loading={state === 'loading'}
            empty={state === 'empty'}
            emptyText="No data yet"
            legend={[
                { color: '#0052FF', label: '20-round average' },
                { color: '#ffffff', label: '100-round average' },
            ]}
            footnote="BEAN emitted per round minus buyback potential from protocol fees. Below zero is deflationary."
        />
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
        color: "#999",
        margin: 0,
    },
    container: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px",
        marginBottom: "40px",
    },
    statBox: {
        background: "rgba(255, 255, 255, 0.04)", backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
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
    ethIcon: {
        width: "22px",
        height: "22px",
        objectFit: "contain" as const,
    },
    statLabel: {
        fontSize: "14px",
        color: "#999",
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
        color: "#999",
        margin: 0,
    },
    mobileGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
    },
    mobileStatBox: {
        background: "rgba(255, 255, 255, 0.04)", backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
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
        color: "#999",
    },
    trackerSection: {
        marginBottom: "40px",
    },
    trackerHeader: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "16px",
    },
    trackerTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
    },
    trackerBadge: {
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        padding: "4px 10px",
        borderRadius: "6px",
        fontFamily: "'Space Mono', monospace",
    },
    trackerGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px",
    },
}
