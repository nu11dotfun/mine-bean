'use client'

import React, { useState, useEffect } from "react"
import BeanLogo from "./BeanLogo"
import { apiFetch } from '../lib/api'

// Display interface (for table rendering)
interface BuybackEntry {
    time: string
    spent: number
    burned: number
    yieldGenerated: number
}

// API response interfaces
interface BuybackFromAPI {
    bnbSpent: string
    bnbSpentFormatted: string
    beanReceived: string
    beanReceivedFormatted: string
    beanBurned: string
    beanBurnedFormatted: string
    beanToStakers: string
    beanToStakersFormatted: string
    txHash: string
    blockNumber: number
    timestamp: string
}

interface BuybacksResponse {
    buybacks: BuybackFromAPI[]
    pagination: {
        page: number
        limit: number
        total: number
        pages: number
    }
}

// Helper functions
const getRelativeTime = (timestamp: string): string => {
    const timeMs = new Date(timestamp).getTime()
    const seconds = Math.floor((Date.now() - timeMs) / 1000)
    if (seconds < 0) return 'just now'
    if (seconds < 60) return `${seconds} sec ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
}

const transformBuyback = (b: BuybackFromAPI): BuybackEntry => ({
    time: getRelativeTime(b.timestamp),
    spent: parseFloat(b.bnbSpentFormatted),
    burned: parseFloat(b.beanBurnedFormatted),
    yieldGenerated: parseFloat(b.beanToStakersFormatted)
})

// Pagination icons
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

// SVG Icons
const BnbIcon = () => (
    <img
        src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"
        alt="BNB"
        style={{ width: 16, height: 16, objectFit: "contain" as const }}
    />
)

export default function RevenueTable() {
    const [buybacks, setBuybacks] = useState<BuybackEntry[]>([])
    const [currentPage, setCurrentPage] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isMobile, setIsMobile] = useState(false)
    const [mounted, setMounted] = useState(false)
    const rowsPerPage = 12

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

        const fetchBuybacks = async () => {
            setLoading(true)
            setError(null)
            try {
                const response = await apiFetch<BuybacksResponse>(
                    `/api/treasury/buybacks?page=${currentPage + 1}&limit=${rowsPerPage}`
                )
                setBuybacks(response.buybacks.map(transformBuyback))
                setTotalPages(response.pagination.pages)
            } catch (err) {
                console.error('Failed to fetch buybacks:', err)
                setError('Failed to load buybacks')
            } finally {
                setLoading(false)
            }
        }
        fetchBuybacks()
    }, [currentPage, mounted])

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

    // Return null until mounted to prevent hydration mismatch
    if (!mounted) {
        return null
    }

    if (loading && buybacks.length === 0) {
        return <div style={styles.container}>Loading...</div>
    }

    if (error && buybacks.length === 0) {
        return <div style={styles.container}>{error}</div>
    }

    return (
        <div style={isMobile ? styles.containerMobile : styles.container}>
            <h2 style={isMobile ? styles.titleMobile : styles.title}>Revenue</h2>

            {/* Description */}
            <p style={isMobile ? styles.descriptionMobile : styles.description}>
                Transactions where protocol revenue was used to buy back BEANS from the spot market.
            </p>

            {/* Table */}
            <div style={styles.tableWrapper}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Time</th>
                            <th style={styles.thRight}>Spent</th>
                            <th style={styles.thRight}>Burned</th>
                            <th style={styles.thRight}>Yield Generated</th>
                        </tr>
                    </thead>
                    <tbody>
                        {buybacks.map((entry, index) => (
                            <tr key={index} style={styles.tr}>
                                <td style={styles.td}>{entry.time}</td>
                                <td style={styles.tdRight}>
                                    <span style={styles.valueWithIcon}>
                                        <BnbIcon />
                                        {entry.spent.toFixed(4)}
                                    </span>
                                </td>
                                <td style={styles.tdRight}>
                                    <span style={styles.valueWithIcon}>
                                        <BeanLogo size={16} />
                                        {entry.burned.toFixed(4)}
                                    </span>
                                </td>
                                <td style={styles.tdRight}>
                                    <span style={styles.valueWithIcon}>
                                        <BeanLogo size={16} />
                                        {entry.yieldGenerated.toFixed(4)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
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
    description: {
        fontSize: "14px",
        color: "#666",
        margin: 0,
        marginBottom: "24px",
    },
    descriptionMobile: {
        fontSize: "12px",
        color: "#666",
        margin: 0,
        marginBottom: "16px",
    },
    tableWrapper: {
        overflowX: "auto",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        minWidth: "400px",
    },
    th: {
        textAlign: "left" as const,
        padding: "12px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#666",
        borderBottom: "1px solid #1a1a1a",
        whiteSpace: "nowrap" as const,
    },
    thRight: {
        textAlign: "right" as const,
        padding: "12px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#666",
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
