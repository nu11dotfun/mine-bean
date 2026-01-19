'use client'

import React, { useState, useEffect } from "react"
import { useConnectModal } from '@rainbow-me/rainbowkit'

interface StakePageProps {
    userBalance?: number
    userStaked?: number
    isConnected?: boolean
    isMobile?: boolean
    onDeposit?: (amount: number) => void
    onWithdraw?: (amount: number) => void
}

// Bean icon component - SVG version
const BeansIcon = ({ size = 18, color = "#F0B90B" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <ellipse cx="9" cy="12" rx="5" ry="7" />
        <ellipse cx="15" cy="12" rx="5" ry="7" />
    </svg>
)

export default function StakePage({
    userBalance = 0,
    userStaked = 0,
    isConnected = false,
    isMobile = false,
    onDeposit,
    onWithdraw,
}: StakePageProps) {
    const { openConnectModal } = useConnectModal()
    const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit")
    const [amount, setAmount] = useState("1.0")
    const [beansPrice, setBeansPrice] = useState<number>(0.0264)
    const [showCalculator, setShowCalculator] = useState(false)
    const [calcAmount, setCalcAmount] = useState("1000")

    // Stats
    const [totalDeposits] = useState(277606)
    const [apr] = useState(15.27)
    const [tvl] = useState(39213198)

    // Fetch BEANS price from DexScreener
    useEffect(() => {
        const fetchBeansPrice = async () => {
            try {
                const response = await fetch(
                    "https://api.dexscreener.com/latest/dex/pairs/bsc/0x7e58f160b5b77b8b24cd9900c09a3e730215ac47"
                )
                const data = await response.json()
                if (data.pair?.priceUsd) {
                    setBeansPrice(parseFloat(data.pair.priceUsd))
                }
            } catch (error) {
                console.error("Failed to fetch BEANS price:", error)
            }
        }

        fetchBeansPrice()
        const interval = setInterval(fetchBeansPrice, 30000)
        return () => clearInterval(interval)
    }, [])

    const handleHalf = () => {
        const balance = activeTab === "deposit" ? userBalance : userStaked
        setAmount((balance / 2).toFixed(4))
    }

    const handleAll = () => {
        const balance = activeTab === "deposit" ? userBalance : userStaked
        setAmount(balance.toFixed(4))
    }

    const handleAction = () => {
        const value = parseFloat(amount) || 0
        if (activeTab === "deposit") {
            onDeposit?.(value)
        } else {
            onWithdraw?.(value)
        }
    }

    const currentBalance = activeTab === "deposit" ? userBalance : userStaked

    // APR calculations
    const calcBeansAmount = parseFloat(calcAmount) || 0
    const dailyRate = apr / 365
    const weeklyRate = apr / 52
    const monthlyRate = apr / 12
    const dailyEarnings = (calcBeansAmount * dailyRate) / 100
    const weeklyEarnings = (calcBeansAmount * weeklyRate) / 100
    const monthlyEarnings = (calcBeansAmount * monthlyRate) / 100

    return (
        <div style={isMobile ? styles.containerMobile : styles.container}>
            <div style={isMobile ? styles.contentMobile : styles.content}>
                {/* Header */}
                <div style={isMobile ? styles.headerMobile : styles.header}>
                    <h1 style={isMobile ? styles.titleMobile : styles.title}>Stake</h1>
                    <p style={isMobile ? styles.subtitleMobile : styles.subtitle}>
                        Earn a share of protocol revenue.
                    </p>
                </div>

                {/* Stake Card */}
                <div style={isMobile ? styles.cardMobile : styles.card}>
                    {/* Tabs */}
                    <div style={isMobile ? styles.tabsMobile : styles.tabs}>
                        <button
                            style={{
                                ...(isMobile ? styles.tabMobile : styles.tab),
                                ...(activeTab === "deposit" ? styles.tabActive : {}),
                            }}
                            onClick={() => setActiveTab("deposit")}
                        >
                            Deposit
                        </button>
                        <button
                            style={{
                                ...(isMobile ? styles.tabMobile : styles.tab),
                                ...(activeTab === "withdraw" ? styles.tabActive : {}),
                            }}
                            onClick={() => setActiveTab("withdraw")}
                        >
                            Withdraw
                        </button>
                    </div>

                    {/* Balance Row */}
                    <div style={isMobile ? styles.balanceRowMobile : styles.balanceRow}>
                        <div style={styles.balanceLeft}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#666">
                                <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                            </svg>
                            <span style={isMobile ? styles.balanceTextMobile : styles.balanceText}>
                                {currentBalance.toFixed(4)} BEANS
                            </span>
                        </div>
                        <div style={styles.quickBtns}>
                            <button style={isMobile ? styles.quickBtnMobile : styles.quickBtn} onClick={handleHalf}>
                                HALF
                            </button>
                            <button style={isMobile ? styles.quickBtnMobile : styles.quickBtn} onClick={handleAll}>
                                ALL
                            </button>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div style={isMobile ? styles.inputRowMobile : styles.inputRow}>
                        <div style={styles.inputLeft}>
                            <BeansIcon size={isMobile ? 20 : 24} />
                            <span style={isMobile ? styles.inputLabelMobile : styles.inputLabel}>BEANS</span>
                        </div>
                        <input
                            type="text"
                            style={isMobile ? styles.amountInputMobile : styles.amountInput}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                        />
                    </div>

                    {/* Action Button */}
                    {isConnected ? (
                        <button
                            style={{
                                ...(isMobile ? styles.actionBtnMobile : styles.actionBtn),
                                ...(parseFloat(amount) <= 0 ? styles.actionBtnDisabled : styles.actionBtnEnabled),
                            }}
                            onClick={handleAction}
                            disabled={parseFloat(amount) <= 0}
                        >
                            {activeTab === "deposit" ? "Deposit" : "Withdraw"}
                        </button>
                    ) : (
                        <button 
                            style={{
                                ...(isMobile ? styles.actionBtnMobile : styles.actionBtn),
                                ...styles.actionBtnEnabled,
                            }} 
                            onClick={openConnectModal}
                        >
                            {activeTab === "deposit" ? "Deposit" : "Withdraw"}
                        </button>
                    )}
                </div>

                {/* Summary */}
                <div style={isMobile ? styles.summaryMobile : styles.summary}>
                    <h2 style={isMobile ? styles.summaryTitleMobile : styles.summaryTitle}>Summary</h2>

                    <div style={isMobile ? styles.summaryRowMobile : styles.summaryRow}>
                        <div style={styles.summaryLabel}>
                            <span style={isMobile ? { fontSize: '13px' } : {}}>Total deposits</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#666">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                            </svg>
                        </div>
                        <div style={isMobile ? styles.summaryValueMobile : styles.summaryValue}>
                            <BeansIcon size={14} />
                            <span>{totalDeposits.toLocaleString()}</span>
                        </div>
                    </div>

                    <div style={isMobile ? styles.summaryRowMobile : styles.summaryRow}>
                        <div style={styles.summaryLabel}>
                            <span style={isMobile ? { fontSize: '13px' } : {}}>APR</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#666">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                            </svg>
                        </div>
                        <span style={isMobile ? styles.summaryValueMobile : styles.summaryValue}>{apr}%</span>
                    </div>

                    <div style={isMobile ? styles.summaryRowMobile : styles.summaryRow}>
                        <div style={styles.summaryLabel}>
                            <span style={isMobile ? { fontSize: '13px' } : {}}>TVL</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#666">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                            </svg>
                        </div>
                        <span style={isMobile ? styles.summaryValueMobile : styles.summaryValue}>
                            ${tvl.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* APR Calculator Button */}
                <button
                    style={isMobile ? styles.calculatorBtnMobile : styles.calculatorBtn}
                    onClick={() => setShowCalculator(true)}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V18z" />
                    </svg>
                    APR Calculator
                </button>
            </div>

            {/* APR Calculator Modal */}
            {showCalculator && (
                <>
                    <div style={styles.overlay} onClick={() => setShowCalculator(false)} />
                    <div style={isMobile ? styles.modalMobile : styles.modal}>
                        <div style={styles.modalHeader}>
                            <h3 style={isMobile ? styles.modalTitleMobile : styles.modalTitle}>APR Calculator</h3>
                            <button style={styles.closeBtn} onClick={() => setShowCalculator(false)}>✕</button>
                        </div>

                        <div style={styles.calcInputRow}>
                            <span style={styles.calcLabel}>BEANS to stake</span>
                            <div style={styles.calcInputWrapper}>
                                <BeansIcon size={18} />
                                <input
                                    type="text"
                                    style={styles.calcInput}
                                    value={calcAmount}
                                    onChange={(e) => setCalcAmount(e.target.value)}
                                    placeholder="1000"
                                />
                            </div>
                        </div>

                        <div style={styles.calcResults}>
                            <div style={styles.calcResultRow}>
                                <span style={styles.calcResultLabel}>Daily</span>
                                <div style={styles.calcResultValue}>
                                    <BeansIcon size={14} />
                                    <span>{dailyEarnings.toFixed(4)}</span>
                                    <span style={styles.calcUsd}>(${(dailyEarnings * beansPrice).toFixed(2)})</span>
                                </div>
                            </div>
                            <div style={styles.calcResultRow}>
                                <span style={styles.calcResultLabel}>Weekly</span>
                                <div style={styles.calcResultValue}>
                                    <BeansIcon size={14} />
                                    <span>{weeklyEarnings.toFixed(4)}</span>
                                    <span style={styles.calcUsd}>(${(weeklyEarnings * beansPrice).toFixed(2)})</span>
                                </div>
                            </div>
                            <div style={styles.calcResultRow}>
                                <span style={styles.calcResultLabel}>Monthly</span>
                                <div style={styles.calcResultValue}>
                                    <BeansIcon size={14} />
                                    <span>{monthlyEarnings.toFixed(4)}</span>
                                    <span style={styles.calcUsd}>(${(monthlyEarnings * beansPrice).toFixed(2)})</span>
                                </div>
                            </div>
                            <div style={styles.calcResultRow}>
                                <span style={styles.calcResultLabel}>Yearly</span>
                                <div style={styles.calcResultValue}>
                                    <BeansIcon size={14} />
                                    <span>{(monthlyEarnings * 12).toFixed(4)}</span>
                                    <span style={styles.calcUsd}>(${(monthlyEarnings * 12 * beansPrice).toFixed(2)})</span>
                                </div>
                            </div>
                        </div>

                        <p style={styles.calcNote}>Based on current APR of {apr}%. Actual returns may vary.</p>
                    </div>
                </>
            )}
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        background: "#0a0a0a",
        fontFamily: "'Inter', -apple-system, sans-serif",
        display: "flex",
        justifyContent: "center",
        paddingTop: "30px",
    },
    containerMobile: {
        background: "#0a0a0a",
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: "0 16px",
    },
    content: {
        width: "100%",
        maxWidth: "580px",
        padding: "0 20px",
    },
    contentMobile: {
        width: "100%",
    },
    header: {
        marginBottom: "24px",
    },
    headerMobile: {
        marginBottom: "16px",
    },
    title: {
        fontSize: "36px",
        fontWeight: 700,
        color: "#fff",
        margin: 0,
        marginBottom: "8px",
    },
    titleMobile: {
        fontSize: "24px",
        fontWeight: 700,
        color: "#fff",
        margin: 0,
        marginBottom: "4px",
    },
    subtitle: {
        fontSize: "16px",
        color: "#666",
        margin: 0,
    },
    subtitleMobile: {
        fontSize: "13px",
        color: "#666",
        margin: 0,
    },
    card: {
        background: "#111",
        border: "1px solid #222",
        borderRadius: "16px",
        padding: "24px",
        marginBottom: "28px",
    },
    cardMobile: {
        background: "#111",
        border: "1px solid #222",
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "20px",
    },
    tabs: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        background: "#0a0a0a",
        borderRadius: "12px",
        padding: "8px",
        marginBottom: "24px",
    },
    tabsMobile: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px",
        background: "#0a0a0a",
        borderRadius: "10px",
        padding: "6px",
        marginBottom: "16px",
    },
    tab: {
        background: "transparent",
        border: "none",
        borderRadius: "8px",
        padding: "14px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#666",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
    },
    tabMobile: {
        background: "transparent",
        border: "none",
        borderRadius: "8px",
        padding: "12px",
        fontSize: "13px",
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
    balanceRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "16px",
    },
    balanceRowMobile: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
    },
    balanceLeft: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    balanceText: {
        fontSize: "14px",
        color: "#666",
    },
    balanceTextMobile: {
        fontSize: "12px",
        color: "#666",
    },
    quickBtns: {
        display: "flex",
        gap: "8px",
    },
    quickBtn: {
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: "6px",
        padding: "8px 16px",
        fontSize: "12px",
        fontWeight: 600,
        color: "#888",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    quickBtnMobile: {
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: "6px",
        padding: "6px 12px",
        fontSize: "11px",
        fontWeight: 600,
        color: "#888",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    inputRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0a0a0a",
        border: "1px solid #222",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "24px",
    },
    inputRowMobile: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0a0a0a",
        border: "1px solid #222",
        borderRadius: "10px",
        padding: "14px 16px",
        marginBottom: "16px",
    },
    inputLeft: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    inputLabel: {
        fontSize: "16px",
        fontWeight: 500,
        color: "#fff",
    },
    inputLabelMobile: {
        fontSize: "14px",
        fontWeight: 500,
        color: "#fff",
    },
    amountInput: {
        background: "transparent",
        border: "none",
        fontSize: "28px",
        fontWeight: 600,
        color: "#fff",
        textAlign: "right" as const,
        width: "150px",
        fontFamily: "inherit",
        outline: "none",
    },
    amountInputMobile: {
        background: "transparent",
        border: "none",
        fontSize: "24px",
        fontWeight: 600,
        color: "#fff",
        textAlign: "right" as const,
        width: "120px",
        fontFamily: "inherit",
        outline: "none",
    },
    actionBtn: {
        width: "100%",
        background: "#222",
        border: "none",
        borderRadius: "12px",
        padding: "18px",
        fontSize: "16px",
        fontWeight: 500,
        color: "#666",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    actionBtnMobile: {
        width: "100%",
        background: "#222",
        border: "none",
        borderRadius: "10px",
        padding: "14px",
        fontSize: "15px",
        fontWeight: 500,
        color: "#666",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    actionBtnEnabled: {
        background: "#F0B90B",
        color: "#000",
        fontWeight: 600,
    },
    actionBtnDisabled: {
        background: "#1a1a1a",
        color: "#444",
        cursor: "not-allowed",
    },
    summary: {
        marginBottom: "20px",
    },
    summaryMobile: {
        marginBottom: "16px",
    },
    summaryTitle: {
        fontSize: "24px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
        marginBottom: "16px",
    },
    summaryTitleMobile: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
        marginBottom: "12px",
    },
    summaryRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 0",
        borderBottom: "1px solid #1a1a1a",
    },
    summaryRowMobile: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid #1a1a1a",
    },
    summaryLabel: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "15px",
        color: "#666",
    },
    summaryValue: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "15px",
        fontWeight: 500,
        color: "#fff",
    },
    summaryValueMobile: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#fff",
    },
    calculatorBtn: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        background: "transparent",
        border: "1px solid #333",
        borderRadius: "12px",
        padding: "16px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#888",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    calculatorBtnMobile: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        background: "transparent",
        border: "1px solid #333",
        borderRadius: "10px",
        padding: "12px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#888",
        cursor: "pointer",
        fontFamily: "inherit",
    },
    overlay: {
        position: "fixed" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
    },
    modal: {
        position: "fixed" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "#111",
        border: "1px solid #222",
        borderRadius: "16px",
        padding: "24px",
        width: "90%",
        maxWidth: "420px",
        zIndex: 1001,
    },
    modalMobile: {
        position: "fixed" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "#111",
        border: "1px solid #222",
        borderRadius: "14px",
        padding: "20px",
        width: "90%",
        maxWidth: "360px",
        zIndex: 1001,
    },
    modalHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "20px",
    },
    modalTitle: {
        fontSize: "20px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
    },
    modalTitleMobile: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        margin: 0,
    },
    closeBtn: {
        background: "transparent",
        border: "none",
        color: "#666",
        fontSize: "18px",
        cursor: "pointer",
        padding: "4px 8px",
    },
    calcInputRow: {
        marginBottom: "20px",
    },
    calcLabel: {
        display: "block",
        fontSize: "13px",
        color: "#666",
        marginBottom: "8px",
    },
    calcInputWrapper: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "#0a0a0a",
        border: "1px solid #222",
        borderRadius: "10px",
        padding: "12px 14px",
    },
    calcInput: {
        flex: 1,
        background: "transparent",
        border: "none",
        fontSize: "16px",
        fontWeight: 500,
        color: "#fff",
        fontFamily: "inherit",
        outline: "none",
    },
    calcResults: {
        background: "#0a0a0a",
        borderRadius: "10px",
        padding: "12px",
        marginBottom: "12px",
    },
    calcResultRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid #1a1a1a",
    },
    calcResultLabel: {
        fontSize: "13px",
        color: "#666",
    },
    calcResultValue: {
        display: "flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "13px",
        fontWeight: 500,
        color: "#fff",
    },
    calcUsd: {
        color: "#666",
        fontSize: "12px",
    },
    calcNote: {
        fontSize: "11px",
        color: "#555",
        textAlign: "center" as const,
        margin: 0,
    },
}
