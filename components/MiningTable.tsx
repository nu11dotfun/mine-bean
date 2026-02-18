'use client'

import React, { useState, useEffect, useMemo } from "react"
import BeanLogo from './BeanLogo'
import { apiFetch } from '../lib/api'
import { useProfileResolver } from '@/lib/useProfileResolver'

// Display interface (for table rendering)
interface Round {
    round: number
    block: number
    winner: string
    rawWinner: string | null  // original address for profile lookup (null if split)
    winners: number
    deployed: number
    vaulted: number
    winnings: number
    goldenBean: number | null
    time: string
    txHash: string  // fulfilment transaction hash
}

// API response interfaces
interface RoundFromAPI {
    roundId: number
    winningBlock: number
    beanWinner: string | null  // address that won BEAN reward (null if split round)
    isSplit: boolean
    winnerCount: number
    totalDeployed: string
    vaultedAmount: string
    totalWinnings: string
    beanpotAmount: string
    endTime: number | string    // Unix timestamp or ISO date string
    settledAt?: number | string // Unix timestamp or ISO date string
    txHash: string              // fulfilment transaction hash
}

interface RoundsResponse {
    rounds: RoundFromAPI[]
    pagination: {
        page: number
        limit: number
        total: number
        pages: number
    }
}

const EthIcon = () => (
    <img
        src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/f9461cf2-aacc-4c59-8b9d-59ade3c46c00/public"
        alt="ETH"
        style={{ width: 16, height: 16, objectFit: "contain" as const }}
    />
)

const ChevronLeft = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
)

const ChevronRight = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
    </svg>
)

// Helper functions
const formatWei = (wei: string): number => {
    if (!wei) return 0
    return parseFloat(wei) / 1e18
}

const formatAddress = (addr: string): string => {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const getRelativeTime = (timestamp: number | string): string => {
    // Handle ISO date string or Unix timestamp (seconds or milliseconds)
    let timeMs: number
    if (typeof timestamp === 'string') {
        timeMs = new Date(timestamp).getTime()
    } else if (timestamp > 1e12) {
        // Already in milliseconds
        timeMs = timestamp
    } else {
        // Unix seconds
        timeMs = timestamp * 1000
    }

    const seconds = Math.floor((Date.now() - timeMs) / 1000)
    if (seconds < 0) return 'just now'
    if (seconds < 60) return `${seconds} sec ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
}

const transformRound = (r: RoundFromAPI): Round => ({
    round: r.roundId,
    block: r.winningBlock,
    winner: r.isSplit ? "Split" : formatAddress(r.beanWinner || ''),
    rawWinner: r.isSplit ? null : (r.beanWinner || null),
    winners: r.winnerCount || 0,
    deployed: formatWei(r.totalDeployed),
    vaulted: formatWei(r.vaultedAmount),
    winnings: formatWei(r.totalWinnings),
    goldenBean: r.beanpotAmount && parseFloat(r.beanpotAmount) > 0
        ? formatWei(r.beanpotAmount)
        : null,
    time: getRelativeTime(r.settledAt || r.endTime),
    txHash: r.txHash
})

export default function MiningTable() {
    const [activeTab, setActiveTab] = useState<"rounds" | "goldenbeans">("rounds")
    const [currentPage, setCurrentPage] = useState(0)
    const [rounds, setRounds] = useState<Round[]>([])
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [hoveredRow, setHoveredRow] = useState<number | null>(null)
    const rowsPerPage = 12

    // Resolve winner addresses to profiles (username + pfp)
    const winnerAddresses = useMemo(() =>
        rounds.map(r => r.rawWinner).filter((a): a is string => a !== null),
        [rounds]
    )
    const { profiles, resolve } = useProfileResolver(winnerAddresses)

    // Prevent hydration mismatch by only rendering after mount
    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return

        const fetchRounds = async () => {
            setLoading(true)
            setError(null)
            try {
                const beanpotParam = activeTab === "goldenbeans" ? "&beanpot=true" : ""
                const response = await apiFetch<RoundsResponse>(
                    `/api/rounds?page=${currentPage + 1}&limit=${rowsPerPage}&settled=true${beanpotParam}`
                )
                setRounds(response.rounds.map(transformRound))
                setTotalPages(response.pagination.pages)
            } catch (err) {
                console.error('Failed to fetch rounds:', err)
                setError('Failed to load rounds')
            } finally {
                setLoading(false)
            }
        }
        fetchRounds()
    }, [currentPage, activeTab, mounted])

    const handlePrevPage = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1)
        }
    }

    const handleNextPage = () => {
        if (currentPage < totalPages - 1) {
            setCurrentPage(currentPage + 1)
        }
    }

    const handleTabChange = (tab: "rounds" | "goldenbeans") => {
        setActiveTab(tab)
        setCurrentPage(0)
    }

    // Return null until mounted to prevent hydration mismatch
    if (!mounted) {
        return null
    }

    if (loading && rounds.length === 0) {
        return <div style={styles.container}>Loading...</div>
    }

    if (error && rounds.length === 0) {
        return <div style={styles.container}>{error}</div>
    }

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Mining</h2>

            <div style={styles.tabs}>
                <button
                    style={{
                        ...styles.tab,
                        ...(activeTab === "rounds" ? styles.tabActive : {}),
                    }}
                    onClick={() => handleTabChange("rounds")}
                >
                    Rounds
                </button>
                <button
                    style={{
                        ...styles.tab,
                        ...(activeTab === "goldenbeans" ? styles.tabActive : {}),
                    }}
                    onClick={() => handleTabChange("goldenbeans")}
                >
                    Beanpot
                </button>
            </div>

            <p style={styles.description}>
                {activeTab === "rounds"
                    ? "Recent mining rounds and winners."
                    : "Recent mining rounds where the Beanpot was hit."}
            </p>

            <div style={styles.tableWrapper}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Round</th>
                            <th style={styles.th}>Block</th>
                            <th style={styles.th}>BEAN Winner</th>
                            <th style={styles.thCenter}>Winners</th>
                            <th style={styles.thRight}>Deployed</th>
                            <th style={styles.thRight}>Vaulted</th>
                            <th style={styles.thRight}>Winnings</th>
                            <th style={styles.thRight}>Beanpot</th>
                            <th style={styles.thRight}>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rounds.map((round, index) => (
                            <tr
                                key={round.round || index}
                                style={{
                                    ...styles.tr,
                                    cursor: 'pointer',
                                    background: hoveredRow === index ? '#1a1a1a' : 'transparent',
                                    transition: 'background 0.15s'
                                }}
                                onMouseEnter={() => setHoveredRow(index)}
                                onMouseLeave={() => setHoveredRow(null)}
                                onClick={() => window.open(`https://basescan.org/tx/${round.txHash}`, '_blank')}
                            >
                                <td style={styles.td}>#{round.round.toLocaleString()}</td>
                                <td style={styles.td}>#{round.block}</td>
                                <td style={styles.td}>
                                    {round.winner === "Split" ? (
                                        <span style={styles.splitBadge}>Split</span>
                                    ) : round.rawWinner ? (
                                        <span style={styles.winnerCell}>
                                            {(() => {
                                                const info = profiles.get(round.rawWinner.toLowerCase())
                                                if (info?.pfpUrl) {
                                                    return <img src={info.pfpUrl} alt="" style={styles.winnerPfp} />
                                                }
                                                return null
                                            })()}
                                            <span>{resolve(round.rawWinner)}</span>
                                        </span>
                                    ) : (
                                        <span>{round.winner}</span>
                                    )}
                                </td>
                                <td style={styles.tdCenter}>{round.winners}</td>
                                <td style={styles.tdRight}>
                                    <span style={styles.valueWithIcon}>
                                        <EthIcon />
                                        {round.deployed.toFixed(4)}
                                    </span>
                                </td>
                                <td style={styles.tdRight}>
                                    <span style={styles.valueWithIcon}>
                                        <EthIcon />
                                        {round.vaulted.toFixed(4)}
                                    </span>
                                </td>
                                <td style={styles.tdRight}>
                                    <span style={styles.valueWithIcon}>
                                        <EthIcon />
                                        {round.winnings.toFixed(4)}
                                    </span>
                                </td>
                                <td style={styles.tdRight}>
                                    {round.goldenBean ? (
                                        <span style={styles.valueWithIcon}>
                                            <BeanLogo size={16} />
                                            {round.goldenBean.toFixed(2)}
                                        </span>
                                    ) : (
                                        <span style={styles.dash}>–</span>
                                    )}
                                </td>
                                <td style={styles.tdRight}>{round.time}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={styles.pagination}>
                <button
                    style={{
                        ...styles.pageBtn,
                        ...(currentPage === 0 ? styles.pageBtnDisabled : {}),
                    }}
                    onClick={handlePrevPage}
                    disabled={currentPage === 0}
                >
                    <ChevronLeft />
                </button>
                <button
                    style={{
                        ...styles.pageBtn,
                        ...(currentPage >= totalPages - 1 ? styles.pageBtnDisabled : {}),
                    }}
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages - 1}
                >
                    <ChevronRight />
                </button>
            </div>
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        marginBottom: "48px",
    },
    title: {
        fontSize: "24px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
        marginBottom: "20px",
    },
    tabs: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        marginBottom: "16px",
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
    tableWrapper: {
        overflowX: "auto",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
    },
    th: {
        textAlign: "left" as const,
        padding: "12px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#999",
        borderBottom: "1px solid #1a1a1a",
    },
    thCenter: {
        textAlign: "center" as const,
        padding: "12px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#999",
        borderBottom: "1px solid #1a1a1a",
    },
    thRight: {
        textAlign: "right" as const,
        padding: "12px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#999",
        borderBottom: "1px solid #1a1a1a",
    },
    tr: {
        borderBottom: "1px solid #111",
    },
    td: {
        padding: "14px 16px",
        fontSize: "14px",
        color: "#fff",
        textAlign: "left" as const,
    },
    tdCenter: {
        padding: "14px 16px",
        fontSize: "14px",
        color: "#fff",
        textAlign: "center" as const,
    },
    tdRight: {
        padding: "14px 16px",
        fontSize: "14px",
        color: "#fff",
        textAlign: "right" as const,
    },
    splitBadge: {
        display: "inline-block",
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid #444",
        borderRadius: "6px",
        padding: "4px 10px",
        fontSize: "12px",
        color: "#bbb",
    },
    winnerCell: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
    },
    winnerPfp: {
        width: 20,
        height: 20,
        borderRadius: "50%",
        objectFit: "cover" as const,
        flexShrink: 0,
    },
    valueWithIcon: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "6px",
    },
    dash: {
        color: "#666",
    },
    pagination: {
        display: "flex",
        justifyContent: "flex-end",
        gap: "8px",
        marginTop: "16px",
    },
    pageBtn: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "36px",
        background: "transparent",
        border: "1px solid #444",
        borderRadius: "8px",
        color: "#bbb",
        cursor: "pointer",
        transition: "all 0.15s",
    },
    pageBtnDisabled: {
        opacity: 0.3,
        cursor: "not-allowed",
    },
}
