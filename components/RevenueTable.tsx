'use client'

import React, { useState, useEffect } from "react"

interface BuybackEntry {
    time: string
    spent: number
    burned: number
    yieldGenerated: number
}

interface LiquidityEntry {
    time: string
    bnbDeposited: number
}

interface SupportEntry {
    time: string
    burned: number
    yieldGenerated: number
}

interface RevenueTableProps {
    buybacks?: BuybackEntry[]
    liquidity?: LiquidityEntry[]
    support?: SupportEntry[]
}

// Format time to short format (30m, 1h, 2d)
const formatTimeShort = (timeStr: string): string => {
    const match = timeStr.match(/(\d+)\s*(sec|min|hour|day)/i)
    if (!match) return timeStr
    
    const num = parseInt(match[1])
    const unit = match[2].toLowerCase()
    
    if (unit === 'sec') return `${num}s`
    if (unit === 'min') return `${num}m`
    if (unit === 'hour' || unit === 'hours') return `${num}h`
    if (unit === 'day' || unit === 'days') return `${num}d`
    
    return timeStr
}

// Generate mock data
const generateBuybacks = (count: number): BuybackEntry[] => {
    return Array.from({ length: count }, (_, i) => ({
        time: i < 3 ? `${(i + 1) * 30} min ago` : `${Math.floor(i / 2)} hours ago`,
        spent: 26 + Math.random() * 15,
        burned: 25 + Math.random() * 20,
        yieldGenerated: 2.5 + Math.random() * 2.5,
    }))
}

const generateLiquidity = (count: number): LiquidityEntry[] => {
    return Array.from({ length: count }, (_, i) => ({
        time: `${48 - Math.floor(i / 3)} days ago`,
        bnbDeposited: 25 + Math.random() * 10,
    }))
}

const generateSupport = (count: number): SupportEntry[] => {
    return Array.from({ length: count }, (_, i) => ({
        time: `${47 + Math.floor(i / 4)} days ago`,
        burned: 0.01 + Math.random() * 0.07,
        yieldGenerated: 0.001 + Math.random() * 0.008,
    }))
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

export default function RevenueTable({
    buybacks = generateBuybacks(12),
    liquidity = generateLiquidity(12),
    support = generateSupport(12),
}: RevenueTableProps) {
    const [activeTab, setActiveTab] = useState<"buybacks" | "liquidity" | "support">("buybacks")
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const tabs = [
        {
            id: "buybacks",
            label: "Buybacks",
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z" />
                </svg>
            ),
        },
        {
            id: "liquidity",
            label: "Liquidity",
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z" />
                </svg>
            ),
        },
        {
            id: "support",
            label: "Support",
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
            ),
        },
    ]

    const getDescription = () => {
        switch (activeTab) {
            case "buybacks":
                return "Transactions where protocol revenue was used to buy back BEANS from the spot market."
            case "liquidity":
                return "Transactions where protocol revenue was deposited into the protocol managed liquidity floor."
            case "support":
                return "Transactions where BEANS was withdrawn from the protocol managed liquidity position and burned."
        }
    }

    return (
        <div style={isMobile ? styles.containerMobile : styles.container}>
            <h2 style={isMobile ? styles.titleMobile : styles.title}>Revenue</h2>

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

            {/* Table */}
            <div style={styles.tableWrapper}>
                <table style={styles.table}>
                    {activeTab === "buybacks" && (
                        <>
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
                                        <td style={styles.td}>{isMobile ? formatTimeShort(entry.time) : entry.time}</td>
                                        <td style={styles.tdRight}>
                                            <span style={styles.valueWithIcon}>
                                                <BnbIcon />
                                                {entry.spent.toFixed(4)}
                                            </span>
                                        </td>
                                        <td style={styles.tdRight}>
                                            <span style={styles.valueWithIcon}>
                                                <BeansIcon />
                                                {entry.burned.toFixed(4)}
                                            </span>
                                        </td>
                                        <td style={styles.tdRight}>
                                            <span style={styles.valueWithIcon}>
                                                <BeansIcon />
                                                {entry.yieldGenerated.toFixed(4)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </>
                    )}

                    {activeTab === "liquidity" && (
                        <>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Time</th>
                                    <th style={styles.thRight}>BNB Deposited</th>
                                </tr>
                            </thead>
                            <tbody>
                                {liquidity.map((entry, index) => (
                                    <tr key={index} style={styles.tr}>
                                        <td style={styles.td}>{isMobile ? formatTimeShort(entry.time) : entry.time}</td>
                                        <td style={styles.tdRight}>
                                            <span style={styles.valueWithIcon}>
                                                <BnbIcon />
                                                {entry.bnbDeposited.toFixed(4)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </>
                    )}

                    {activeTab === "support" && (
                        <>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Time</th>
                                    <th style={styles.thRight}>Burned</th>
                                    <th style={styles.thRight}>Yield Generated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {support.map((entry, index) => (
                                    <tr key={index} style={styles.tr}>
                                        <td style={styles.td}>{isMobile ? formatTimeShort(entry.time) : entry.time}</td>
                                        <td style={styles.tdRight}>
                                            <span style={styles.valueWithIcon}>
                                                <BeansIcon />
                                                {entry.burned.toFixed(4)}
                                            </span>
                                        </td>
                                        <td style={styles.tdRight}>
                                            <span style={styles.valueWithIcon}>
                                                <BeansIcon />
                                                {entry.yieldGenerated.toFixed(4)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </>
                    )}
                </table>
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
}
