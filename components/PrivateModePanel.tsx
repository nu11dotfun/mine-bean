'use client'

/**
 * BEAN Private Deploys — private account panel (desktop)
 *
 * Rendered inside SidebarControls while private mode is on. Shows the
 * subaccount, the private balance, the pooled note status, a deposit form
 * (main → pool, the only public step), funding progress, the private cash-out
 * (subaccount → pool → main, deposit + ZK withdrawal), and the honest privacy
 * disclosure.
 */

import React, { useState } from 'react'
import { parseEther } from 'viem'
import { usePrivacy } from '@/lib/privacy/PrivacyContext'

const applyFee = (eth: number, bps: number) => eth * (1 - bps / 10000)

// Small ETH headroom (covers a cashout deposit's gas) below which the ETH
// balance is treated as "nothing to withdraw".
const ETH_GAS_DUST = 0.0005

export default function PrivateModePanel() {
    const privacy = usePrivacy()
    const [depositInput, setDepositInput] = useState('')
    const [copied, setCopied] = useState(false)
    const [confirming, setConfirming] = useState<'eth' | 'bean' | null>(null)
    const [exportDownloaded, setExportDownloaded] = useState(false)
    const [showDisclosure, setShowDisclosure] = useState(false)

    const sub = privacy.subaccountAddress
    const truncated = sub ? `${sub.slice(0, 6)}…${sub.slice(-4)}` : ''
    const subEth = Number(privacy.subBalance) / 1e18
    const subBean = Number(privacy.subBeanBalance) / 1e18
    const note = privacy.unspentNote
    const noteEth = note ? parseFloat(note.value) / 1e18 : 0
    const feeBps = privacy.vettingFeeBps
    const feePct = (feeBps / 100).toFixed(2)
    // Must back up the key before any funds enter.
    const needsExport = !privacy.hasExported

    const busy = ['deriving', 'depositing', 'awaiting-approval', 'proving', 'relaying'].includes(
        privacy.status
    )
    const cashingOut = ['approving', 'depositing', 'awaiting-approval', 'proving', 'relaying'].includes(
        privacy.cashoutStatus
    )

    const depositEth = parseFloat(depositInput) || 0
    const minDepositEth = Number(privacy.minDepositWei) / 1e18
    const belowMin = depositEth > 0 && depositEth < minDepositEth
    const canDeposit = !note && !needsExport && depositEth >= minDepositEth && !busy && !cashingOut
    // Net ETH that actually enters the pool after the deposit vetting fee.
    const depositNet = applyFee(depositEth, feeBps)

    // ETH cashout: deposit balance minus a gas headroom, then minus the fee.
    const cashoutGross = Math.max(0, subEth - ETH_GAS_DUST)
    const cashoutNet = applyFee(cashoutGross, feeBps)
    const canCashOutEth = !cashingOut && (privacy.ethCashoutInFlight || subEth > ETH_GAS_DUST)
    // BEAN cashout: full BEAN balance (zero pool fee), needs ETH for gas.
    const BEAN_MIN = 0.001
    const canCashOutBean =
        !cashingOut &&
        (privacy.beanCashoutInFlight || (subBean >= BEAN_MIN && subEth > ETH_GAS_DUST))
    // Withdrawing ETH drains the subaccount to dust → strands any held BEAN.
    const wouldStrandBean = privacy.subBeanBalance > 0n

    const copyAddress = () => {
        if (!sub) return
        navigator.clipboard?.writeText(sub).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
    }

    const handleDeposit = () => {
        if (!canDeposit) return
        privacy.depositToPool(parseEther(depositInput)).then(() => setDepositInput('')).catch(() => {})
    }

    const startCashOut = (asset: 'eth' | 'bean') => {
        setConfirming(null)
        privacy.cashOut(asset).catch(() => {})
    }

    const downloadKey = () => {
        try {
            const { fileName, content } = privacy.exportPrivateKey()
            const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            a.click()
            URL.revokeObjectURL(url)
            setExportDownloaded(true)
        } catch {
            // surfaced via privacy.error if the action throws
        }
    }

    const [rescanning, setRescanning] = useState(false)
    const handleRescan = () => {
        if (rescanning) return
        setRescanning(true)
        privacy.rescan().catch(() => {}).finally(() => setRescanning(false))
    }

    const dl = privacy.artifactProgress
    const downloading = dl && dl.totalBytes > 0 && dl.loadedBytes < dl.totalBytes

    return (
        <div style={styles.panel} data-testid="private-mode-panel">
            {/* Subaccount row */}
            <div style={styles.row}>
                <span style={styles.label}>Private account</span>
                <span style={styles.addr} onClick={copyAddress} title="Copy address">
                    {copied ? 'Copied ✓' : truncated}
                </span>
            </div>
            <div style={styles.row}>
                <span style={styles.label}>Private balance</span>
                <span style={styles.value}>Ξ {subEth.toFixed(5)}</span>
            </div>
            <div style={styles.row}>
                <span style={styles.label}>Private BEAN</span>
                <span style={styles.value} data-testid="private-bean-balance">{subBean.toFixed(4)} BEAN</span>
            </div>
            <div style={styles.row}>
                <span style={styles.label}>In pool</span>
                <span style={styles.value}>
                    {note ? (
                        <>
                            Ξ {noteEth.toFixed(5)}{' '}
                            <span style={{ color: privacy.proofState === 'ready' ? '#3fb950' : '#888', fontSize: 10 }}>
                                {privacy.status === 'awaiting-approval'
                                    ? 'awaiting approval'
                                    : privacy.proofState === 'ready'
                                      ? ''
                                      : 'preparing…'}
                            </span>
                        </>
                    ) : (
                        <span style={{ color: '#666' }}>none</span>
                    )}
                </span>
            </div>

            {/* Key-backup gate — required before any funds enter */}
            {needsExport && (
                <div style={styles.backupBox} data-testid="private-export-prompt">
                    <div style={styles.backupTitle}>⚠ Back up your private account key</div>
                    <div style={styles.backupText}>
                        Save this key before adding funds. It is the ONLY way to recover your
                        private account on another device or wallet. Anyone with it controls your
                        private funds — keep the file secret.
                    </div>
                    <div style={styles.confirmRow}>
                        <button style={styles.depositBtn} onClick={downloadKey} data-testid="private-export-download">
                            Download key file
                        </button>
                        <button
                            style={{
                                ...styles.confirmGo,
                                ...(exportDownloaded ? {} : styles.btnDisabled),
                            }}
                            onClick={privacy.confirmExported}
                            disabled={!exportDownloaded}
                            data-testid="private-export-done"
                        >
                            I&apos;ve saved it
                        </button>
                    </div>
                </div>
            )}

            {/* One-time artifact download progress */}
            {downloading && (
                <div style={styles.progressWrap}>
                    <div style={styles.progressLabel}>
                        Preparing private setup… (one-time download{' '}
                        {Math.round((dl.loadedBytes / dl.totalBytes) * 100)}%)
                    </div>
                    <div style={styles.progressTrack}>
                        <div
                            style={{
                                ...styles.progressFill,
                                width: `${Math.min(100, (dl.loadedBytes / dl.totalBytes) * 100)}%`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Funding status strip */}
            {busy && privacy.statusDetail && (
                <div style={styles.statusStrip}>
                    <span style={styles.spinner} />
                    {privacy.statusDetail}
                </div>
            )}
            {/* Cashout progress strip */}
            {cashingOut && privacy.cashoutDetail && (
                <div style={styles.statusStrip}>
                    <span style={styles.spinner} />
                    {privacy.cashoutDetail}
                </div>
            )}
            {privacy.cashoutStatus === 'done' && (
                <div style={{ ...styles.statusStrip, color: '#3fb950', borderColor: 'rgba(63,185,80,0.3)' }}>
                    {privacy.cashoutAsset === 'bean' ? 'BEAN' : 'ETH'} withdrawal successful
                </div>
            )}
            {(privacy.ethCashoutInFlight || privacy.beanCashoutInFlight) && !cashingOut && privacy.cashoutStatus !== 'done' && (
                <div style={{ ...styles.statusStrip, color: '#d29922', borderColor: 'rgba(210,153,34,0.3)' }}>
                    Your {privacy.beanCashoutInFlight ? 'BEAN' : 'ETH'} is safe in the pool — retry to finish the withdrawal.
                </div>
            )}

            {/* Error + retry */}
            {privacy.error && (
                <div style={styles.errorBox}>
                    <div style={styles.errorText}>{privacy.error}</div>
                    <button style={styles.retryBtn} onClick={privacy.retry}>
                        Dismiss
                    </button>
                </div>
            )}

            {/* Deposit form — only when no live note */}
            {!note && (
                <>
                    <div style={styles.depositRow}>
                        <input
                            type="text"
                            placeholder="ETH amount"
                            value={depositInput}
                            onChange={(e) => {
                                const val = e.target.value
                                if (val === '' || /^\d{0,2}\.?\d{0,7}$/.test(val)) setDepositInput(val)
                            }}
                            style={styles.depositInput}
                            data-testid="private-deposit-input"
                        />
                        <button
                            style={{
                                ...styles.depositBtn,
                                ...(canDeposit ? {} : styles.btnDisabled),
                            }}
                            onClick={handleDeposit}
                            disabled={!canDeposit}
                            data-testid="private-deposit-btn"
                        >
                            Deposit to Pool
                        </button>
                    </div>
                    {belowMin ? (
                        <div style={{ ...styles.feeLine, color: '#d29922' }}>
                            Minimum deposit is Ξ {minDepositEth} (pool requirement)
                        </div>
                    ) : (
                        depositEth > 0 && feeBps > 0 && (
                            <div style={styles.feeLine}>
                                {feePct}% pool fee → ~Ξ {depositNet.toFixed(5)} will be playable
                            </div>
                        )
                    )}
                </>
            )}

            {/* Cash out — private (subaccount → pool → main), per asset */}
            {confirming === null && (
                <div style={styles.cashoutRow}>
                    <button
                        style={{ ...styles.cashOutBtn, ...(canCashOutEth ? {} : styles.btnDisabled) }}
                        onClick={() => setConfirming('eth')}
                        disabled={!canCashOutEth}
                        data-testid="private-cashout-eth-btn"
                    >
                        {cashingOut && privacy.cashoutAsset === 'eth'
                            ? 'Withdrawing…'
                            : privacy.ethCashoutInFlight
                              ? 'Resume ETH'
                              : 'Withdraw ETH'}
                    </button>
                    <button
                        style={{ ...styles.cashOutBtn, ...(canCashOutBean ? {} : styles.btnDisabled) }}
                        onClick={() => setConfirming('bean')}
                        disabled={!canCashOutBean}
                        data-testid="private-cashout-bean-btn"
                    >
                        {cashingOut && privacy.cashoutAsset === 'bean'
                            ? 'Withdrawing…'
                            : privacy.beanCashoutInFlight
                              ? 'Resume BEAN'
                              : 'Withdraw BEAN'}
                    </button>
                </div>
            )}

            {confirming === 'eth' && (
                <div style={styles.confirmBox}>
                    <div style={styles.confirmText}>
                        Withdraw ~Ξ {cashoutGross.toFixed(5)} to main? Deposits to the pool
                        {feeBps > 0 ? ` (${feePct}% fee)` : ''}, then privately withdraws
                        {' '}~Ξ {cashoutNet.toFixed(5)} — takes ~1 min.
                    </div>
                    {wouldStrandBean && (
                        <div style={styles.strandWarn} data-testid="private-strand-warning">
                            ⚠ This leaves your private account with no ETH to later withdraw your{' '}
                            {subBean.toFixed(4)} BEAN. Withdraw BEAN first, or proceed anyway.
                        </div>
                    )}
                    <div style={styles.confirmRow}>
                        <button style={styles.confirmCancel} onClick={() => setConfirming(null)}>
                            Cancel
                        </button>
                        <button style={styles.confirmGo} onClick={() => startCashOut('eth')} data-testid="private-cashout-eth-confirm">
                            Withdraw ETH
                        </button>
                    </div>
                </div>
            )}

            {confirming === 'bean' && (
                <div style={styles.confirmBox}>
                    <div style={styles.confirmText}>
                        Withdraw {subBean.toFixed(4)} BEAN to main? Deposits to the BEAN pool
                        (no fee), then privately withdraws to your main wallet — ~1 min. Uses
                        ETH from your private account for gas.
                    </div>
                    <div style={styles.confirmRow}>
                        <button style={styles.confirmCancel} onClick={() => setConfirming(null)}>
                            Cancel
                        </button>
                        <button style={styles.confirmGo} onClick={() => startCashOut('bean')} data-testid="private-cashout-bean-confirm">
                            Withdraw BEAN
                        </button>
                    </div>
                </div>
            )}

            {privacy.determinismWarning && (
                <div style={styles.warnText}>
                    ⚠ Your wallet may not re-derive this account deterministically. Do not clear
                    browser data while funds are at the private account.
                </div>
            )}

            <div style={styles.disclosure}>
                <span
                    style={styles.infoTrigger}
                    onClick={() => setShowDisclosure((v) => !v)}
                    data-testid="private-disclosure-toggle"
                >
                    ⓘ How privacy works
                </span>
                {' · '}
                <span style={styles.rescanLink} onClick={handleRescan} data-testid="private-rescan">
                    {rescanning ? 'Rescanning…' : 'Rescan deposits'}
                </span>
                {!needsExport && (
                    <>
                        {' · '}
                        <span style={styles.rescanLink} onClick={downloadKey} data-testid="private-reexport">
                            Export key
                        </span>
                    </>
                )}
                {showDisclosure && (
                    <div style={styles.disclosurePopover} data-testid="private-disclosure-text">
                        The deposit and the final withdrawal both route through the pool, so there
                        is no direct main-to-private link. Amounts and timing still correlate in a
                        small anonymity set, so privacy grows with pool usage.
                    </div>
                )}
            </div>
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    panel: {
        background: 'rgba(240,185,11,0.04)',
        border: '1px solid rgba(240,185,11,0.25)',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.45)',
    },
    value: {
        fontSize: 12,
        color: '#fff',
        fontFamily: "'Space Mono', monospace",
    },
    addr: {
        fontSize: 12,
        color: '#F0B90B',
        fontFamily: "'Space Mono', monospace",
        cursor: 'pointer',
    },
    progressWrap: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    progressLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.45)',
    },
    progressTrack: {
        height: 4,
        borderRadius: 2,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: '#F0B90B',
        transition: 'width 0.3s ease',
    },
    statusStrip: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        color: '#F0B90B',
        border: '1px solid rgba(240,185,11,0.3)',
        borderRadius: 8,
        padding: '8px 10px',
    },
    spinner: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        border: '2px solid rgba(240,185,11,0.25)',
        borderTopColor: '#F0B90B',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0,
    },
    errorBox: {
        border: '1px solid rgba(248,81,73,0.4)',
        background: 'rgba(248,81,73,0.08)',
        borderRadius: 8,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    errorText: {
        fontSize: 11,
        color: '#f85149',
        wordBreak: 'break-word',
    },
    retryBtn: {
        alignSelf: 'flex-end',
        background: 'transparent',
        border: '1px solid rgba(248,81,73,0.4)',
        color: '#f85149',
        borderRadius: 6,
        padding: '3px 10px',
        fontSize: 11,
        cursor: 'pointer',
    },
    depositRow: {
        display: 'flex',
        gap: 6,
    },
    depositInput: {
        flex: 1,
        minWidth: 0,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
        color: '#fff',
        outline: 'none',
        fontFamily: "'Space Mono', monospace",
    },
    depositBtn: {
        background: '#F0B90B',
        color: '#0a0a0a',
        border: 'none',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    feeLine: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        marginTop: -4,
    },
    backupBox: {
        border: '1px solid rgba(248,81,73,0.45)',
        background: 'rgba(248,81,73,0.08)',
        borderRadius: 8,
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    backupTitle: {
        fontSize: 12,
        fontWeight: 600,
        color: '#f85149',
    },
    backupText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.75)',
        lineHeight: 1.4,
    },
    cashoutRow: {
        display: 'flex',
        gap: 6,
    },
    cashOutBtn: {
        flex: 1,
        background: 'rgba(255,255,255,0.06)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        cursor: 'pointer',
    },
    strandWarn: {
        fontSize: 11,
        color: '#d29922',
        lineHeight: 1.4,
        border: '1px solid rgba(210,153,34,0.3)',
        borderRadius: 6,
        padding: '6px 8px',
    },
    confirmBox: {
        border: '1px solid rgba(240,185,11,0.3)',
        background: 'rgba(240,185,11,0.05)',
        borderRadius: 8,
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    confirmText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 1.4,
    },
    confirmRow: {
        display: 'flex',
        gap: 6,
    },
    confirmCancel: {
        flex: 1,
        background: 'rgba(255,255,255,0.06)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        padding: '7px 12px',
        fontSize: 12,
        cursor: 'pointer',
    },
    confirmGo: {
        flex: 1,
        background: '#F0B90B',
        color: '#0a0a0a',
        border: 'none',
        borderRadius: 8,
        padding: '7px 12px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
    },
    btnDisabled: {
        opacity: 0.4,
        cursor: 'not-allowed',
    },
    warnText: {
        fontSize: 10,
        color: '#d29922',
        lineHeight: 1.4,
    },
    disclosure: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
        lineHeight: 1.4,
    },
    rescanLink: {
        color: 'rgba(240,185,11,0.7)',
        cursor: 'pointer',
        textDecoration: 'underline',
    },
    infoTrigger: {
        color: 'rgba(240,185,11,0.7)',
        cursor: 'pointer',
    },
    disclosurePopover: {
        marginTop: 6,
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 10,
        color: 'rgba(255,255,255,0.55)',
        lineHeight: 1.5,
    },
}
