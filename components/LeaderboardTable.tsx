'use client'

import React, { useState, useEffect, useMemo } from "react"
import BeanLogo from "./BeanLogo"
import { apiFetch } from '../lib/api'
import { useProfileResolver } from '../lib/useProfileResolver'

// Display interface
interface LeaderboardEntry {
    rank: number
    address: string
    rawAddress: string
    value: number
}

// API response interfaces
interface DeployerFromAPI {
    address: string
    totalDeployed: string
    totalDeployedFormatted: string
    roundsPlayed: number
}

interface EarnerFromAPI {
    address: string
    unclaimed: string
    unclaimedFormatted: string
}

interface MinersResponse {
    period: string
    deployers: DeployerFromAPI[]
}

interface EarnersResponse {
    earners: EarnerFromAPI[]
    pagination: { page: number; limit: number; total: number; pages: number }
}

interface StakerFromAPI {
    address: string
    stakedBalance: string
    stakedBalanceFormatted: string
}

interface StakersResponse {
    stakers: StakerFromAPI[]
}

// Helper functions
const formatAddress = (addr: string): string => {
    if (!addr || addr.length < 10) return addr
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const transformDeployer = (d: DeployerFromAPI, i: number): LeaderboardEntry => ({
    rank: i + 1,
    address: formatAddress(d.address),
    rawAddress: d.address,
    value: parseFloat(d.totalDeployedFormatted)
})

const transformEarner = (e: EarnerFromAPI, i: number): LeaderboardEntry => ({
    rank: i + 1,
    address: formatAddress(e.address),
    rawAddress: e.address,
    value: parseFloat(e.unclaimedFormatted)
})

const transformStaker = (s: StakerFromAPI, i: number): LeaderboardEntry => ({
    rank: i + 1,
    address: formatAddress(s.address),
    rawAddress: s.address,
    value: parseFloat(s.stakedBalanceFormatted)
})

// SVG Icons
const BnbIcon = () => (
    <img
        src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/f9461cf2-aacc-4c59-8b9d-59ade3c46c00/public"
        alt="ETH"
        style={{ width: 16, height: 16, objectFit: "contain" as const }}
    />
)

export default function LeaderboardTable() {
    const [activeTab, setActiveTab] = useState<"miners" | "stakers" | "unrefined">("miners")
    const [miners, setMiners] = useState<LeaderboardEntry[]>([])
    const [stakers, setStakers] = useState<LeaderboardEntry[]>([])
    const [unrefined, setUnrefined] = useState<LeaderboardEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [isMobile, setIsMobile] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [hoveredRow, setHoveredRow] = useState<number | null>(null)

    // Resolve addresses to usernames via batch profile lookup
    const allAddresses = useMemo(() =>
        [...miners, ...stakers, ...unrefined].map(e => e.rawAddress),
        [miners, stakers, unrefined]
    )
    const { profiles, resolve } = useProfileResolver(allAddresses)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        if (!mounted) return

        const fetchData = async () => {
            setLoading(true)
            try {
                const [minersRes, stakersRes, earnersRes] = await Promise.all([
                    apiFetch<MinersResponse>('/api/leaderboard/miners?period=all&limit=12'),
                    apiFetch<StakersResponse>('/api/leaderboard/stakers?limit=12'),
                    apiFetch<EarnersResponse>('/api/leaderboard/earners?limit=12')
                ])
                setMiners(minersRes.deployers.map(transformDeployer))
                setStakers(stakersRes.stakers.map(transformStaker))
                setUnrefined(earnersRes.earners.map(transformEarner))
            } catch (err) {
                console.error('Failed to fetch leaderboard:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [mounted])

    const tabs = [
        {
            id: "miners",
            label: "Miners",
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
                </svg>
            ),
        },
        {
            id: "stakers",
            label: "Stakers",
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
                </svg>
            ),
        },
        {
            id: "unrefined",
            label: "Unrefined",
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zm-4.44-6.19l-2.35 3.02-1.56-1.88c-.2-.25-.58-.24-.78.01l-1.74 2.23c-.26.33-.02.81.39.81h8.98c.41 0 .65-.47.4-.8l-2.55-3.39c-.19-.26-.59-.26-.79 0z" />
                </svg>
            ),
        },
    ]

    const getDescription = () => {
        switch (activeTab) {
            case "miners":
                return "Top miners by total ETH deployed over their lifetime."
            case "stakers":
                return "Top stakers by amount of BEANS staked."
            case "unrefined":
                return "Top miners by amount of unrefined BEANS."
        }
    }

    const getColumnHeader = () => {
        switch (activeTab) {
            case "miners":
                return "Total Deployed"
            case "stakers":
                return "Staked"
            case "unrefined":
                return "Unrefined"
        }
    }

    const getData = (): LeaderboardEntry[] => {
        switch (activeTab) {
            case "miners":
                return miners
            case "stakers":
                return stakers
            case "unrefined":
                return unrefined
        }
    }

    const getValueIcon = () => {
        switch (activeTab) {
            case "miners":
                return "eth"
            case "stakers":
                return "beans"
            case "unrefined":
                return "beans"
        }
    }

    // Return null until mounted to prevent hydration mismatch
    if (!mounted) {
        return null
    }

    return (
        <div style={isMobile ? styles.containerMobile : styles.container}>
            <h2 style={isMobile ? styles.titleMobile : styles.title}>Leaderboard</h2>

            {/* Tabs */}
            <div style={isMobile ? styles.tabsMobile : styles.tabs}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        style={{
                            ...(isMobile ? styles.tabMobile : styles.tab),
                            ...(activeTab === tab.id ? styles.tabActive : {}),
                        }}
                        onClick={() => setActiveTab(tab.id as any)}
                    >
                        
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Description */}
            <p style={isMobile ? styles.descriptionMobile : styles.description}>{getDescription()}</p>

            {/* Table or Empty State */}
            {loading && getData().length === 0 ? (
                <div style={styles.emptyState}>
                    <p style={styles.emptyText}>Loading...</p>
                </div>
            ) : getData().length === 0 ? (
                <div style={styles.emptyState}>
                    <p style={styles.emptyText}>No data available</p>
                </div>
            ) : (
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Rank</th>
                                <th style={styles.th}>Address</th>
                                <th style={styles.thRight}>{getColumnHeader()}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {getData().map((entry, index) => (
                                <tr
                                    key={index}
                                    style={{
                                        ...styles.tr,
                                        cursor: 'pointer',
                                        background: hoveredRow === index ? '#1a1a1a' : 'transparent',
                                        transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={() => setHoveredRow(index)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                    onClick={() => window.open(`https://basescan.org/address/${entry.rawAddress}`, '_blank')}
                                >
                                    <td style={styles.td}>#{entry.rank}</td>
                                    <td style={styles.td}>
                                        <span style={styles.addressCell}>
                                            {(() => {
                                                const info = profiles.get(entry.rawAddress.toLowerCase())
                                                if (info?.pfpUrl) {
                                                    return <img src={info.pfpUrl} alt="" style={styles.addressPfp} />
                                                }
                                                return null
                                            })()}
                                            <span>{resolve(entry.rawAddress)}</span>
                                        </span>
                                    </td>
                                    <td style={styles.tdRight}>
                                        {getValueIcon() === "eth" ? (
                                            <span style={styles.valueWithIcon}>
                                                <BnbIcon />
                                                {entry.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                            </span>
                                        ) : (
                                            <span style={styles.valueWithIcon}>
                                                <BeanLogo size={16} />
                                                {entry.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        marginBottom: "48px",
    },
    containerMobile: {
        marginBottom: "32px",
    },
    title: {
        fontSize: "24px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
        marginBottom: "20px",
    },
    titleMobile: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
        marginBottom: "12px",
    },
    tabs: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "8px",
        marginBottom: "16px",
    },
    tabsMobile: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "6px",
        marginBottom: "12px",
    },
    tab: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        background: "transparent",
        border: "none",
        borderRadius: "8px",
        padding: "12px 24px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#999",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    tabMobile: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "5px",
        background: "transparent",
        border: "none",
        borderRadius: "8px",
        padding: "10px 8px",
        fontSize: "12px",
        fontWeight: 500,
        color: "#999",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    tabActive: {
        background: "rgba(255, 255, 255, 0.08)",
        color: "#fff",
    },
    description: {
        fontSize: "14px",
        color: "#999",
        margin: 0,
        marginBottom: "24px",
    },
    descriptionMobile: {
        fontSize: "12px",
        color: "#999",
        margin: 0,
        marginBottom: "16px",
    },
    tableWrapper: {
        overflowX: "auto",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        minWidth: "350px",
    },
    th: {
        textAlign: "left" as const,
        padding: "12px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#999",
        borderBottom: "1px solid #1a1a1a",
        whiteSpace: "nowrap" as const,
    },
    thRight: {
        textAlign: "right" as const,
        padding: "12px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#999",
        borderBottom: "1px solid #1a1a1a",
        whiteSpace: "nowrap" as const,
    },
    tr: {
        borderBottom: "1px solid #111",
    },
    td: {
        padding: "14px 16px",
        fontSize: "14px",
        color: "#fff",
        whiteSpace: "nowrap" as const,
    },
    tdRight: {
        padding: "14px 16px",
        fontSize: "14px",
        color: "#fff",
        textAlign: "right" as const,
        whiteSpace: "nowrap" as const,
    },
    valueWithIcon: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "6px",
    },
    addressCell: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
    },
    addressPfp: {
        width: 20,
        height: 20,
        borderRadius: "50%",
        objectFit: "cover" as const,
        flexShrink: 0,
    },
    emptyState: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        background: "rgba(255, 255, 255, 0.04)",
        borderRadius: "8px",
    },
    emptyText: {
        fontSize: "14px",
        color: "#999",
        margin: 0,
    },
}
