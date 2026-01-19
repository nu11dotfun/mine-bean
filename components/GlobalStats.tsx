'use client'

import React from "react"

interface GlobalStatsProps {
    maxSupply?: number
    circulatingSupply?: number
    burned7d?: number
    protocolRev7d?: number
    isMobile?: boolean
}

export default function GlobalStats({
    maxSupply = 3000000,
    circulatingSupply = 422154,
    burned7d = 7337,
    protocolRev7d = 10195,
    isMobile = false,
}: GlobalStatsProps) {
    const stats = [
        {
            value: maxSupply.toLocaleString(),
            label: "Max Supply",
            iconType: "beans",
        },
        {
            value: circulatingSupply.toLocaleString(),
            label: "Circulating Supply",
            iconType: "beans",
        },
        {
            value: burned7d.toLocaleString(),
            label: "Burned (7d)",
            iconType: "beans",
        },
        {
            value: protocolRev7d.toLocaleString(),
            label: "Protocol Rev (7d)",
            iconType: "bnb",
        },
    ]

    const BeansIcon = ({ size = 18 }: { size?: number }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#F0B90B">
            <ellipse cx="9" cy="12" rx="5" ry="7" />
            <ellipse cx="15" cy="12" rx="5" ry="7" />
        </svg>
    )

    if (isMobile) {
        return (
            <div style={styles.mobileWrapper}>
                {/* Header */}
                <div style={styles.mobileHeader}>
                    <h1 style={styles.mobileTitle}>Global</h1>
                    <p style={styles.mobileSubtitle}>Review protocol stats and activity.</p>
                </div>

                {/* 2x2 Grid */}
                <div style={styles.mobileGrid}>
                    {stats.map((stat, index) => (
                        <div key={index} style={styles.mobileStatBox}>
                            <div style={styles.mobileStatValue}>
                                {stat.iconType === "beans" && <BeansIcon size={14} />}
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
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>Global</h1>
                <p style={styles.subtitle}>
                    Review protocol stats and activity.
                </p>
            </div>

            {/* Stats Grid */}
            <div style={styles.container}>
                {stats.map((stat, index) => (
                    <div key={index} style={styles.statBox}>
                        <div style={styles.statValue}>
                            {stat.iconType === "beans" && <BeansIcon size={20} />}
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
    // Desktop styles
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

    // Mobile styles - 2x2 grid
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
