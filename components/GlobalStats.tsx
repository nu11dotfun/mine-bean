'use client'

import React, { useState, useEffect } from "react"
import BeanLogo from './BeanLogo'
import { apiFetch } from '../lib/api'

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

type PeriodKey = '7D' | '14D'

interface GlobalStatsProps {
    isMobile?: boolean
}

export default function GlobalStats({
    isMobile = false,
}: GlobalStatsProps) {
    const [mounted, setMounted] = useState(false)
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('7D')
    const [data, setData] = useState<{
        circulatingSupply: number
        burnedTotal: number
        protocolRevenue: number
        totalMinted: number
        emissions: BeanEmissions
        burns: BeanBurns
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
                    emissions: statsRes.beanEmissions || {},
                    burns: statsRes.beanBurns || {},
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
            value: data?.burnedTotal != null
                ? Math.floor(data.burnedTotal).toLocaleString()
                : "—",
            label: "Burned",
            iconType: "beans",
        },
        {
            value: data?.protocolRevenue != null
                ? data.protocolRevenue.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                : "—",
            label: "Protocol Revenue",
            iconType: "eth",
        },
    ]

    // Return null until mounted to prevent hydration mismatch
    if (!mounted) {
        return null
    }

    // Compute period values from real API data
    const { periodBurned, periodMinted, periodNet, isDeflationary } = computePeriod(selectedPeriod, data)
    const periods: PeriodKey[] = ['7D', '14D']

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

                {/* Deflationary Tracker — Mobile */}
                <div style={{ marginTop: 16 }}>
                    <TrackerCard
                        periods={periods}
                        selectedPeriod={selectedPeriod}
                        setSelectedPeriod={setSelectedPeriod}
                        periodBurned={periodBurned}
                        periodMinted={periodMinted}
                        periodNet={periodNet}
                        isDeflationary={isDeflationary}
                        hasData={!!data}
                        isMobile={true}
                    />
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

            {/* Deflationary Tracker — Desktop */}
            <div style={styles.trackerSection}>
                <TrackerCard
                    periods={periods}
                    selectedPeriod={selectedPeriod}
                    setSelectedPeriod={setSelectedPeriod}
                    periodBurned={periodBurned}
                    periodMinted={periodMinted}
                    periodNet={periodNet}
                    isDeflationary={isDeflationary}
                    hasData={!!data}
                    isMobile={false}
                />
            </div>
        </div>
    )
}

// ── Helpers ──

function computePeriod(period: PeriodKey, data: { totalMinted: number; burnedTotal: number; circulatingSupply: number; emissions: BeanEmissions; burns: BeanBurns } | null) {
    if (!data) {
        return { periodBurned: 0, periodMinted: 0, periodNet: 0, isDeflationary: false }
    }

    const key = period.toLowerCase() as '7d' | '14d'
    const periodMinted = data.emissions[key]?.minted ?? 0
    const periodBurned = data.burns[key]?.burnt ?? 0

    // Sign convention: negative = deflationary (burns > emissions), positive = inflationary
    const periodNet = periodMinted - periodBurned
    const isDeflationary = periodNet < 0
    return { periodBurned, periodMinted, periodNet, isDeflationary }
}

function TrackerCard({ periods, selectedPeriod, setSelectedPeriod, periodBurned, periodMinted, periodNet, isDeflationary, hasData, isMobile }: {
    periods: PeriodKey[]
    selectedPeriod: PeriodKey
    setSelectedPeriod: (p: PeriodKey) => void
    periodBurned: number
    periodMinted: number
    periodNet: number
    isDeflationary: boolean
    hasData: boolean
    isMobile: boolean
}) {
    const boxStyle: React.CSSProperties = {
        background: 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: isMobile ? '12px 10px' : '24px 20px',
        textAlign: 'center' as const,
    }

    return (
        <div>
            {/* Period toggle row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, marginBottom: isMobile ? 12 : 16 }}>
                {periods.map(p => (
                    <button
                        key={p}
                        onClick={() => setSelectedPeriod(p)}
                        style={{
                            padding: isMobile ? '6px 12px' : '8px 16px',
                            borderRadius: 50,
                            border: selectedPeriod === p ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.06)',
                            fontSize: isMobile ? 12 : 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            background: selectedPeriod === p ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                            color: selectedPeriod === p ? '#fff' : 'rgba(255,255,255,0.35)',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {p}
                    </button>
                ))}
            </div>

            {/* Three stat boxes in a row — same style as the protocol stat boxes above */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? 8 : 16 }}>
                {/* Burned */}
                <div style={boxStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 5 : 8, fontSize: isMobile ? 15 : 22, fontWeight: 600, color: '#fff', marginBottom: isMobile ? 4 : 10 }}>
                        <BeanLogo size={isMobile ? 14 : 20} />
                        <span>{hasData ? Math.floor(periodBurned).toLocaleString() : '—'}</span>
                    </div>
                    <div style={{ fontSize: isMobile ? 10 : 14, color: '#999' }}>Burned</div>
                </div>

                {/* Emitted */}
                <div style={boxStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 5 : 8, fontSize: isMobile ? 15 : 22, fontWeight: 600, color: '#fff', marginBottom: isMobile ? 4 : 10 }}>
                        <BeanLogo size={isMobile ? 14 : 20} />
                        <span>{hasData ? Math.floor(periodMinted).toLocaleString() : '—'}</span>
                    </div>
                    <div style={{ fontSize: isMobile ? 10 : 14, color: '#999' }}>Emitted</div>
                </div>

                {/* Net */}
                <div style={boxStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 5 : 8, fontSize: isMobile ? 15 : 22, fontWeight: 600, color: '#fff', marginBottom: isMobile ? 4 : 10 }}>
                        <BeanLogo size={isMobile ? 14 : 20} />
                        <span>{hasData ? `${periodNet >= 0 ? '+' : '-'}${Math.floor(Math.abs(periodNet)).toLocaleString()}` : '—'}</span>
                    </div>
                    <div style={{ fontSize: isMobile ? 10 : 14, color: '#999' }}>Net Change</div>
                </div>
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
