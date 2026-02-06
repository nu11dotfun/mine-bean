'use client'

import React, { useState, useEffect } from "react"
import BeanLogo from './BeanLogo'
import { apiFetch } from '../lib/api'

// Display interface (for table rendering)
interface Round {
    round: number
    block: number
    winner: string
    winners: number
    deployed: number
    vaulted: number
    winnings: number
    goldenBean: number | null
    time: string
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
    motherlodeAmount: string
    endTime: number | string    // Unix timestamp or ISO date string
    settledAt?: number | string // Unix timestamp or ISO date string
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

const BnbIcon = () => (
    <img
        src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"
        alt="BNB"
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
    winners: r.winnerCount || 0,
    deployed: formatWei(r.totalDeployed),
    vaulted: formatWei(r.vaultedAmount),
    winnings: formatWei(r.totalWinnings),
    goldenBean: r.motherlodeAmount && parseFloat(r.motherlodeAmount) > 0
        ? formatWei(r.motherlodeAmount)
        : null,
    time: getRelativeTime(r.settledAt || r.endTime)
})

export default function MiningTable() {
    const [activeTab, setActiveTab] = useState<"rounds" | "goldenbeans">("rounds")
    const [currentPage, setCurrentPage] = useState(0)
    const [rounds, setRounds] = useState<Round[]>([])
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const rowsPerPage = 12

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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
                    </svg>
                    Rounds
                </button>
                <button
                    style={{
                        ...styles.tab,
                        ...(activeTab === "goldenbeans" ? styles.tabActive : {}),
                    }}
                    onClick={() => handleTabChange("goldenbeans")}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
                    </svg>
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
                            <tr key={round.round || index} style={styles.tr}>
                                <td style={styles.td}>#{round.round.toLocaleString()}</td>
                                <td style={styles.td}>#{round.block}</td>
                                <td style={styles.td}>
                                    {round.winner === "Split" ? (
                                        <span style={styles.splitBadge}>Split</span>
                                    ) : (
                                        <span>{round.winner}</span>
                                    )}
                                </td>
                                <td style={styles.tdCenter}>{round.winners}</td>
                                <td style={styles.tdRight}>
                                    <span style={styles.valueWithIcon}>
                                        <BnbIcon />
                                        {round.deployed.toFixed(4)}
                                    </span>
                                </td>
                                <td style={styles.tdRight}>
                                    <span style={styles.valueWithIcon}>
                                        <BnbIcon />
                                        {round.vaulted.toFixed(4)}
                                    </span>
                                </td>
                                <td style={styles.tdRight}>
                                    <span style={styles.valueWithIcon}>
                                        <BnbIcon />
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
        color: "#666",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    tabActive: {
        background: "#222",
        color: "#fff",
    },
    description: {
        fontSize: "14px",
        color: "#666",
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
        color: "#666",
        borderBottom: "1px solid #1a1a1a",
    },
    thCenter: {
        textAlign: "center" as const,
        padding: "12px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#666",
        borderBottom: "1px solid #1a1a1a",
    },
    thRight: {
        textAlign: "right" as const,
        padding: "12px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#666",
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
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: "6px",
        padding: "4px 10px",
        fontSize: "12px",
        color: "#888",
    },
    valueWithIcon: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "6px",
    },
    dash: {
        color: "#444",
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
        border: "1px solid #333",
        borderRadius: "8px",
        color: "#888",
        cursor: "pointer",
        transition: "all 0.15s",
    },
    pageBtnDisabled: {
        opacity: 0.3,
        cursor: "not-allowed",
    },
}
