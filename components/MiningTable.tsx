'use client'

import React, { useState, useEffect } from "react"
import BeanLogo from './BeanLogo'

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

interface MiningTableProps {
    rounds?: Round[]
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

// Seeded random number generator for consistent values
const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
}

const generateMockRounds = (count: number, goldenBeanOnly: boolean = false): Round[] => {
    const rounds: Round[] = []
    const baseRound = 122346

    for (let i = 0; i < count; i++) {
        const seed = baseRound - i
        const hasGoldenBean = goldenBeanOnly ? true : seededRandom(seed * 7) < 0.01
        
        const round: Round = {
            round: baseRound - i,
            block: Math.floor(seededRandom(seed * 1) * 25) + 1,
            winner: seededRandom(seed * 2) > 0.15
                ? `0x${(seed * 1234).toString(16).slice(0, 4)}...${(seed * 5678).toString(16).slice(0, 4)}`
                : "Split",
            winners: Math.floor(seededRandom(seed * 3) * 50) + 130,
            deployed: 8 + seededRandom(seed * 4) * 5,
            vaulted: 0.8 + seededRandom(seed * 5) * 0.5,
            winnings: 7 + seededRandom(seed * 6) * 4,
            goldenBean: hasGoldenBean ? Math.floor(seededRandom(seed * 8) * 200) + 10 : null,
            time: i === 0 ? "39 sec ago" : i < 10 ? `${i} min ago` : `${Math.floor(i / 6)} hours ago`,
        }

        if (!goldenBeanOnly || hasGoldenBean) {
            rounds.push(round)
        }
    }

    return goldenBeanOnly ? rounds.slice(0, 50) : rounds
}

export default function MiningTable({ rounds: propRounds }: MiningTableProps) {
    const [activeTab, setActiveTab] = useState<"rounds" | "goldenbeans">("rounds")
    const [currentPage, setCurrentPage] = useState(0)
    const [rounds, setRounds] = useState<Round[]>([])
    const [goldenBeanRounds, setGoldenBeanRounds] = useState<Round[]>([])
    const rowsPerPage = 12

    useEffect(() => {
        setRounds(propRounds || generateMockRounds(50))
        setGoldenBeanRounds(generateMockRounds(100, true))
    }, [propRounds])

    const allRounds = activeTab === "rounds" ? rounds : goldenBeanRounds
    const totalPages = Math.ceil(allRounds.length / rowsPerPage)
    
    const displayRounds = allRounds.slice(
        currentPage * rowsPerPage,
        (currentPage + 1) * rowsPerPage
    )

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

    if (rounds.length === 0 || typeof window === "undefined") {
        return <div style={styles.container}>Loading...</div>
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
                            <th style={styles.th}>BEANS Winner</th>
                            <th style={styles.thCenter}>Winners</th>
                            <th style={styles.thRight}>Deployed</th>
                            <th style={styles.thRight}>Vaulted</th>
                            <th style={styles.thRight}>Winnings</th>
                            <th style={styles.thRight}>Beanpot</th>
                            <th style={styles.thRight}>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRounds.map((round, index) => (
                            <tr key={index} style={styles.tr}>
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
                                            {round.goldenBean}
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
