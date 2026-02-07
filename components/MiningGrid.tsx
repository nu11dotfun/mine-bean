'use client'

import React, { useState, useEffect, useCallback, useRef } from "react"
import { apiFetch } from "@/lib/api"
import { useSSE } from "@/lib/SSEContext"

interface BlockData {
    id: number
    deployed: string
    deployedFormatted: string
    minerCount: number
}

interface RoundResponse {
    roundId: string
    startTime: number
    endTime: number
    totalDeployed: string
    totalDeployedFormatted: string
    motherlodePool: string
    motherlodePoolFormatted: string
    settled: boolean
    blocks: BlockData[]
    userDeployed?: string
    userDeployedFormatted?: string
}

interface DeployedEvent {
    roundId: string
    user: string
    totalAmount: string
    isAutoMine: boolean
    totalDeployed: string
    totalDeployedFormatted: string
    userDeployed: string
    userDeployedFormatted: string
    blocks: BlockData[]
}

interface RoundSettledEvent {
    roundId: string
    winningBlock: string
    topMiner: string
    totalWinnings: string
    topMinerReward: string
    motherlodeAmount: string
    isSplit: boolean
}

interface GameStartedEvent {
    roundId: string
    startTime: number
    endTime: number
    motherlodePool: string
    motherlodePoolFormatted: string
}

interface CellData {
    minerCount: number
    amount: number
}

interface MiningGridProps {
    selectedBlocks?: number[]
    onBlocksChange?: (blocks: number[]) => void
    userAddress?: string
}

function decodeBlockMask(mask: string): number[] {
    const n = BigInt(mask)
    const blocks: number[] = []
    for (let i = 0; i < 25; i++) {
        if ((n >> BigInt(i)) & BigInt(1)) blocks.push(i)
    }
    return blocks
}

function blocksToGrid(blocks: BlockData[]): CellData[] {
    return Array.from({ length: 25 }, (_, i) => {
        const block = blocks.find((b) => b.id === i)
        return {
            minerCount: block?.minerCount ?? 0,
            amount: block ? parseFloat(block.deployedFormatted) : 0,
        }
    })
}

export default function MiningGrid({
    selectedBlocks: externalSelectedBlocks,
    onBlocksChange,
    userAddress,
}: MiningGridProps) {
    const [internalSelectedBlocks, setInternalSelectedBlocks] = useState<number[]>([])
    const [phase, setPhase] = useState<"counting" | "eliminating" | "winner" | "miners">("counting")
    const [eliminatedBlocks, setEliminatedBlocks] = useState<number[]>([])
    const [winningBlock, setWinningBlock] = useState<number | null>(null)

    const selectedBlocks = externalSelectedBlocks ?? internalSelectedBlocks
    const setSelectedBlocks = (blocks: number[] | ((prev: number[]) => number[])) => {
        const newBlocks = typeof blocks === "function" ? blocks(selectedBlocks) : blocks
        if (onBlocksChange) {
            onBlocksChange(newBlocks)
        } else {
            setInternalSelectedBlocks(newBlocks)
        }
    }

    const [cells, setCells] = useState<CellData[]>(() =>
        Array.from({ length: 25 }, () => ({ minerCount: 0, amount: 0 }))
    )
    const [currentRoundId, setCurrentRoundId] = useState<string>("")
    const [userDeployedBlocks, setUserDeployedBlocks] = useState<Set<number>>(new Set())
    const [hasDeployedThisRound, setHasDeployedThisRound] = useState(false)
    const [autoMode, setAutoMode] = useState<{ enabled: boolean, strategy: "all" | "random" | null }>({ enabled: false, strategy: null })

    // Animation state: snapshot freezes grid data so resets can't wipe it mid-animation
    const animatingRef = useRef(false)
    const snapshotCellsRef = useRef<CellData[] | null>(null)
    const pendingResetRef = useRef<GameStartedEvent | null>(null)
    const animationTimers = useRef<ReturnType<typeof setTimeout>[]>([])
    // Keep a mutable ref to cells so the SSE closure always reads the latest value
    const cellsRef = useRef(cells)
    cellsRef.current = cells
    // Keep a mutable ref to userAddress so callbacks always read the latest value
    const userAddressRef = useRef(userAddress)
    userAddressRef.current = userAddress

    const clearAnimationTimers = useCallback(() => {
        animationTimers.current.forEach(clearTimeout)
        animationTimers.current = []
    }, [])

    const resetForNewRound = useCallback((eventData?: GameStartedEvent | null) => {
        clearAnimationTimers()
        snapshotCellsRef.current = null
        setPhase("counting")
        setEliminatedBlocks([])
        setWinningBlock(null)
        setSelectedBlocks([])
        setCells(Array.from({ length: 25 }, () => ({ minerCount: 0, amount: 0 })))
        setUserDeployedBlocks(new Set())
        setHasDeployedThisRound(false)
        animatingRef.current = false
        pendingResetRef.current = null
        window.dispatchEvent(new CustomEvent("settlementComplete"))

        if (eventData) {
            setCurrentRoundId(eventData.roundId)
            window.dispatchEvent(
                new CustomEvent("roundData", { detail: eventData })
            )
        }

        // Re-fetch current round to pick up any deployments that arrived during the animation
        const fetchUrl = userAddressRef.current
            ? `/api/round/current?user=${userAddressRef.current}`
            : '/api/round/current'
        apiFetch<RoundResponse>(fetchUrl)
            .then((round) => {
                if (animatingRef.current) return
                setCells(blocksToGrid(round.blocks))
                window.dispatchEvent(
                    new CustomEvent("roundData", { detail: round })
                )
            })
            .catch((err) => console.error('Failed to refresh round after animation:', err))
    }, [clearAnimationTimers])

    // Fetch initial round state
    useEffect(() => {
        const url = userAddress
            ? `/api/round/current?user=${userAddress}`
            : '/api/round/current'
        apiFetch<RoundResponse>(url)
            .then((round) => {
                if (animatingRef.current) return
                setCells(blocksToGrid(round.blocks))
                setCurrentRoundId(round.roundId)
                window.dispatchEvent(
                    new CustomEvent("roundData", { detail: round })
                )
            })
            .catch((err) => console.error('Failed to load round:', err))
    }, [userAddress])

    // Fetch user's deployed blocks for the current round
    useEffect(() => {
        if (!userAddress || !currentRoundId) return
        apiFetch<{ history: Array<{ roundId: number, blockMask: string }> }>(
            `/api/user/${userAddress}/history?type=deploy&roundId=${currentRoundId}`
        ).then(data => {
            const blocks = new Set<number>()
            for (const entry of data.history) {
                for (const id of decodeBlockMask(entry.blockMask)) {
                    blocks.add(id)
                }
            }
            setUserDeployedBlocks(blocks)
            if (blocks.size > 0) setHasDeployedThisRound(true)
        }).catch(() => {})
    }, [userAddress, currentRoundId])

    // Listen for optimistic deploy updates from page.tsx
    useEffect(() => {
        const handleUserDeployed = (event: CustomEvent) => {
            const { blockIds } = event.detail as { blockIds: number[] }
            setUserDeployedBlocks(prev => {
                const next = new Set(prev)
                blockIds.forEach(id => next.add(id))
                return next
            })
            // One deploy per round — lock the grid after deploy
            setHasDeployedThisRound(true)
            setSelectedBlocks([])
            window.dispatchEvent(new CustomEvent("blocksChanged", {
                detail: { blocks: [], count: 0 }
            }))
        }
        window.addEventListener("userDeployed" as any, handleUserDeployed)
        return () => window.removeEventListener("userDeployed" as any, handleUserDeployed)
    }, [])

    // Subscribe to user SSE for AutoMiner deployments via centralized SSE context
    const { subscribeUser, subscribeGlobal } = useSSE()

    useEffect(() => {
        return subscribeUser('autoMineExecuted', (data) => {
            const d = data as { roundId: string; blocks?: number[]; roundsExecuted: number }
            // Mark these blocks as deployed by user (guard against undefined blocks)
            if (d.blocks && d.blocks.length > 0) {
                setUserDeployedBlocks(prev => {
                    const next = new Set(prev)
                    d.blocks!.forEach(id => next.add(id))
                    return next
                })
                setHasDeployedThisRound(true)
                // Clear selection and notify controls
                setSelectedBlocks([])
                window.dispatchEvent(new CustomEvent("blocksChanged", {
                    detail: { blocks: [], count: 0 }
                }))
            }
        })
    }, [subscribeUser])

    // Subscribe to global SSE events for live updates via centralized SSE context
    useEffect(() => {
        const unsubDeployed = subscribeGlobal('deployed', (data) => {
            if (animatingRef.current) return
            const d = data as DeployedEvent
            setCells(blocksToGrid(d.blocks))

            // If this is the connected user's AutoMiner deployment, fetch their blocks
            // This handles the race condition where user SSE may not be connected yet
            if (d.isAutoMine && userAddressRef.current &&
                d.user.toLowerCase() === userAddressRef.current.toLowerCase()) {
                apiFetch<{ history: Array<{ blockMask: string }> }>(
                    `/api/user/${userAddressRef.current}/history?type=deploy&roundId=${d.roundId}&limit=1`
                ).then((res) => {
                    if (res.history[0]?.blockMask) {
                        const blockIds = decodeBlockMask(res.history[0].blockMask)
                        if (blockIds.length > 0) {
                            setUserDeployedBlocks(prev => {
                                const next = new Set(prev)
                                blockIds.forEach(id => next.add(id))
                                return next
                            })
                            setHasDeployedThisRound(true)
                            setSelectedBlocks([])
                            window.dispatchEvent(new CustomEvent("blocksChanged", {
                                detail: { blocks: [], count: 0 }
                            }))
                        }
                    }
                }).catch(() => {})
            }

            window.dispatchEvent(new CustomEvent("roundDeployed", {
                detail: {
                    totalDeployed: d.totalDeployed,
                    totalDeployedFormatted: d.totalDeployedFormatted,
                    user: d.user,
                    userDeployedFormatted: d.userDeployedFormatted,
                }
            }))
        })

        const unsubSettled = subscribeGlobal('roundSettled', (data) => {
            const d = data as RoundSettledEvent
            const winner = parseInt(d.winningBlock, 10)
            clearAnimationTimers()

            // Freeze current grid data so it survives any resets
            snapshotCellsRef.current = [...cellsRef.current]
            animatingRef.current = true
            setPhase("eliminating")
            setWinningBlock(winner)

            // Eliminate blocks one by one over 5 seconds
            const toEliminate = Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== winner)
            toEliminate.sort(() => Math.random() - 0.5)

            const intervalTime = 5000 / toEliminate.length
            let eliminated: number[] = []

            toEliminate.forEach((blockIndex, i) => {
                const tid = setTimeout(() => {
                    eliminated = [...eliminated, blockIndex]
                    setEliminatedBlocks([...eliminated])
                }, intervalTime * (i + 1))
                animationTimers.current.push(tid)
            })

            // Show winner phase after elimination finishes (~5s)
            animationTimers.current.push(
                setTimeout(() => setPhase("winner"), 5200)
            )

            // After 3 more seconds of winner display (8s total), reset for the new round
            animationTimers.current.push(
                setTimeout(() => {
                    resetForNewRound(pendingResetRef.current)
                }, 8200)
            )

            window.dispatchEvent(
                new CustomEvent("roundSettled", { detail: d })
            )
        })

        const unsubGameStarted = subscribeGlobal('gameStarted', (data) => {
            const d = data as GameStartedEvent
            // Always buffer — never reset immediately.
            // If roundSettled already arrived, the animation timer handles the reset.
            // If roundSettled hasn't arrived yet (wrong order), wait 2s for it.
            pendingResetRef.current = d
            if (!animatingRef.current) {
                const fallbackId = setTimeout(() => {
                    if (!animatingRef.current) {
                        resetForNewRound(pendingResetRef.current)
                    }
                }, 2000)
                animationTimers.current.push(fallbackId)
            }
        })

        return () => {
            unsubDeployed()
            unsubSettled()
            unsubGameStarted()
            clearAnimationTimers()
        }
    }, [subscribeGlobal, resetForNewRound, clearAnimationTimers])

    // Listen for select-all from sidebar controls
    useEffect(() => {
        const handleSelectAll = (event: CustomEvent) => {
            if (hasDeployedThisRound) return
            const { selectAll } = event.detail
            if (selectAll) {
                const allBlocks = Array.from({ length: 25 }, (_, i) => i)
                    .filter(i => !userDeployedBlocks.has(i))
                setSelectedBlocks(allBlocks)
                window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: allBlocks, count: allBlocks.length } }))
            } else {
                setSelectedBlocks([])
                window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: [], count: 0 } }))
            }
        }

        window.addEventListener("selectAllBlocks" as any, handleSelectAll)
        return () => window.removeEventListener("selectAllBlocks" as any, handleSelectAll)
    }, [])

    // Listen for autoMinerMode from sidebar controls
    useEffect(() => {
        const handleAutoMode = (event: CustomEvent) => {
            const { enabled, strategy } = event.detail
            setAutoMode({ enabled, strategy })
            if (enabled && strategy === "all") {
                // Select all 25 blocks
                const allBlocks = Array.from({ length: 25 }, (_, i) => i).filter(i => !userDeployedBlocks.has(i))
                setSelectedBlocks(allBlocks)
                window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: allBlocks, count: allBlocks.length } }))
            } else {
                // Clear selection for random or manual mode
                setSelectedBlocks([])
                window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: [], count: 0 } }))
            }
        }

        window.addEventListener("autoMinerMode" as any, handleAutoMode)
        return () => window.removeEventListener("autoMinerMode" as any, handleAutoMode)
    }, [userDeployedBlocks])

    const handleBlockClick = (index: number) => {
        if (autoMode.enabled) return  // Disable clicks in any auto mode (both "all" and "random")
        if (phase !== "counting") return
        if (hasDeployedThisRound) return
        if (userDeployedBlocks.has(index)) return
        const newSelection = selectedBlocks.includes(index)
            ? selectedBlocks.filter((i) => i !== index)
            : [...selectedBlocks, index]
        setSelectedBlocks(newSelection)
        window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: newSelection, count: newSelection.length } }))
    }

    // During animation, render from the frozen snapshot so resets don't wipe visible data
    const displayCells = snapshotCellsRef.current ?? cells

    return (
        <div className="mining-grid-container" style={styles.container}>
            <div className="mining-grid" style={styles.grid}>
                {displayCells.map((cell, index) => {
                    const isSelected = selectedBlocks.includes(index)
                    const isWinner = winningBlock === index
                    const isEliminated = eliminatedBlocks.includes(index)
                    const isDeployed = userDeployedBlocks.has(index)

                    return (
                        <button
                            key={index}
                            className="mining-cell"
                            style={{
                                ...styles.cell,
                                ...(isDeployed && !isEliminated ? styles.cellDeployed : {}),
                                ...(isSelected && !isEliminated && !isDeployed ? styles.cellSelected : {}),
                                ...(isEliminated ? styles.cellEliminated : {}),
                                ...(isWinner && phase === "winner" ? styles.cellWinner : {}),
                                ...(autoMode.enabled && autoMode.strategy === "random" && !isDeployed ? styles.cellDisabled : {}),
                            }}
                            onClick={() => handleBlockClick(index)}
                            disabled={phase !== "counting" || isDeployed || hasDeployedThisRound || autoMode.enabled}
                        >
                            {!isEliminated && (
                                <>
                                    <div className="cell-header" style={styles.cellHeader}>
                                        <span className="cell-id" style={styles.cellId}>#{index + 1}</span>
                                        {isDeployed ? (
                                            <span style={styles.deployedCheck}>✓</span>
                                        ) : cell.minerCount > 0 ? (
                                            <span style={styles.minerCount}>{cell.minerCount}</span>
                                        ) : null}
                                    </div>
                                    <div className="cell-amount" style={styles.cellAmount}>
                                        {cell.amount > 0 ? cell.amount.toFixed(4) : '—'}
                                    </div>
                                </>
                            )}
                        </button>
                    )
                })}
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .mining-grid-container {
                        width: 100% !important;
                        overflow: hidden !important;
                        max-width: none !important;
                    }

                    .mining-grid {
                        grid-template-columns: repeat(5, 1fr) !important;
                        gap: 6px !important;
                        width: 100% !important;
                        max-width: none !important;
                    }

                    .mining-cell {
                        min-height: unset !important;
                        aspect-ratio: 1 !important;
                        padding: 6px !important;
                        border-radius: 8px !important;
                    }

                    .cell-id {
                        font-size: 10px !important;
                    }

                    .cell-amount {
                        font-size: 12px !important;
                    }
                }
            `}</style>
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        fontFamily: "'Inter', -apple-system, sans-serif",
        width: "100%",
        maxWidth: "710px",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "10px",
        width: "100%",
        maxWidth: "710px",
    },
    cell: {
        aspectRatio: "1",
        background: "transparent",
        border: "2px solid #333",
        borderRadius: "10px",
        padding: "14px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "inherit",
        position: "relative",
        transition: "border-color 0.15s",
        outline: "none",
    },
    cellSelected: {
        border: "2px solid #F0B90B",
    },
    cellDeployed: {
        border: "2px solid #2d5a2d",
        cursor: "default",
        opacity: 0.7,
    },
    deployedCheck: {
        fontSize: "12px",
        fontWeight: 700,
        color: "#4a9a4a",
    },
    cellEliminated: {
        opacity: 0.2,
        transform: "scale(0.95)",
        border: "2px solid #222",
    },
    cellWinner: {
        border: "2px solid #F0B90B",
        boxShadow: "0 0 20px rgba(240, 185, 11, 0.3)",
    },
    cellDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    cellHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    cellId: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#666",
    },
    minerCount: {
        fontSize: "10px",
        fontWeight: 600,
        color: "#888",
    },
    cellAmount: {
        fontSize: "14px",
        fontWeight: 700,
        color: "#fff",
        textAlign: "right",
    },
}
