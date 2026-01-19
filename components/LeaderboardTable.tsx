'use client'

import React, { useState, useEffect } from "react"

interface LeaderboardEntry {
    rank: number
    address: string
    value: number
    hasAvatar?: boolean
}

interface LeaderboardTableProps {
    miners?: LeaderboardEntry[]
    stakers?: LeaderboardEntry[]
    unrefined?: LeaderboardEntry[]
}

// Generate mock data
const generateLeaderboard = (
    count: number,
    maxValue: number
): LeaderboardEntry[] => {
    const names = [
        "supercar2",
        "blastoise",
        "ap",
        "radr",
        "kin0",
        "505",
        "DC#",
        "DC4",
        "Tirith",
        "FormerlyBean",
    ]

    return Array.from({ length: count }, (_, i) => {
        const useCustomName = Math.random() > 0.6 && i < names.length
        return {
            rank: i + 1,
            address: useCustomName
                ? names[i % names.length]
                : `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
            value: maxValue * Math.pow(0.85, i) * (0.9 + Math.random() * 0.2),
            hasAvatar: useCustomName && Math.random() > 0.5,
        }
    })
}

// SVG Icons
const BnbIcon = () => (
    <img
        src="https://imagedelivery.net/GyRgSdgDhHz2WNR4fvaN-Q/6ef1a5d5-3193-4f29-1af0-48bf41735000/public"
        alt="BNB"
        style={{ width: 16, height: 16, objectFit: "contain" as const }}
    />
)

const BeansIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#888">
        <ellipse cx="9" cy="12" rx="5" ry="7" />
        <ellipse cx="15" cy="12" rx="5" ry="7" />
    </svg>
)

export default function LeaderboardTable({
    miners = generateLeaderboard(12, 9886),
    stakers = generateLeaderboard(12, 36656),
    unrefined = generateLeaderboard(12, 1903),
}: LeaderboardTableProps) {
    const [activeTab, setActiveTab] = useState<"miners" | "stakers" | "unrefined">("miners")
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

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
                return "Top miners by total BNB deployed over their lifetime."
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

    const getData = () => {
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
                return "bnb"
            case "stakers":
                return "beans"
            case "unrefined":
                return "beans"
        }
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
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Description */}
            <p style={isMobile ? styles.descriptionMobile : styles.description}>{getDescription()}</p>

            {/* Table - horizontally scrollable */}
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
                            <tr key={index} style={styles.tr}>
                                <td style={styles.td}>#{entry.rank}</td>
                                <td style={styles.td}>
                                    <div style={styles.addressCell}>
                                        {entry.hasAvatar && (
                                            <div style={styles.avatar}>
                                                {entry.address.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span>{entry.address}</span>
                                    </div>
                                </td>
                                <td style={styles.tdRight}>
                                    {getValueIcon() === "bnb" ? (
                                        <span style={styles.valueWithIcon}>
                                            <BnbIcon />
                                            {entry.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                        </span>
                                    ) : (
                                        <span style={styles.valueWithIcon}>
                                            <BeansIcon />
                                            {entry.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination hint */}
            <div style={styles.pagination}>
                <span style={styles.paginationArrow}>›</span>
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
        color: "#666",
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
        minWidth: "350px",
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
    addressCell: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    avatar: {
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #F0B90B 0%, #8B6914 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        fontWeight: 600,
        color: "#000",
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
        marginTop: "16px",
    },
    paginationArrow: {
        fontSize: "24px",
        color: "#444",
        cursor: "pointer",
    },
}
