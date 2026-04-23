'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
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
    beanpotPool: string
    beanpotPoolFormatted: string
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
    beanpotAmount: string
    isSplit: boolean
}

interface GameStartedEvent {
    roundId: string
    startTime: number
    endTime: number
    beanpotPool: string
    beanpotPoolFormatted: string
}

interface RoundTransitionEvent {
    settled: RoundSettledEvent | null
    newRound: GameStartedEvent
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
    const [autoMode, setAutoMode] = useState<{ enabled: boolean, strategy: "all" | "random" | "select" | null }>({ enabled: false, strategy: null })
const [isAutoMinerActive, setIsAutoMinerActive] = useState(false)

    // Heat map state — toggle controlled by SidebarControls/MobileControls via heatmapToggle event
    const [heatmapEnabled, setHeatmapEnabled] = useState(false)
    const [heatmapCounts, setHeatmapCounts] = useState<number[]>(() => Array(25).fill(0))
    const [heatmapPayouts, setHeatmapPayouts] = useState<number[]>(() => Array(25).fill(0))
    const [heatmapTotal, setHeatmapTotal] = useState(0)
    const [heatmapHover, setHeatmapHover] = useState<number | null>(null)

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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedBlocks and other setters are stable
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedBlocks is stable, defined once per component
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedBlocks is stable, defined once per component
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

        // Combined handler for round transitions (replaces separate roundSettled + gameStarted)
        const unsubTransition = subscribeGlobal('roundTransition', (data) => {
            const { settled, newRound } = data as RoundTransitionEvent

            // Buffer the new round data
            pendingResetRef.current = newRound

            if (settled) {
                // Round had deployments — run settlement animation
                const winner = parseInt(settled.winningBlock, 10)
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
                    new CustomEvent("roundSettled", { detail: settled })
                )
            } else {
                // Empty round — reset immediately (no settlement animation)
                resetForNewRound(newRound)
            }
        })

        return () => {
            unsubDeployed()
            unsubTransition()
            clearAnimationTimers()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedBlocks is stable, defined once per component
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- hasDeployedThisRound, userDeployedBlocks, and setSelectedBlocks are stable
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
            } else if (enabled && strategy === "select") {
                // Allow user to pick blocks on grid — clear previous selection
                setSelectedBlocks([])
                window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: [], count: 0 } }))
            } else {
                // Clear selection for random or manual mode
                setSelectedBlocks([])
                window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: [], count: 0 } }))
            }
        }

        window.addEventListener("autoMinerMode" as any, handleAutoMode)
        return () => window.removeEventListener("autoMinerMode" as any, handleAutoMode)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedBlocks is stable, defined once per component
    }, [userDeployedBlocks])
    useEffect(() => {
        const handleActivated = () => setIsAutoMinerActive(true)
        const handleStopped = () => setIsAutoMinerActive(false)
        window.addEventListener("autoMinerActivated", handleActivated)
        window.addEventListener("autoMinerStopped", handleStopped)
        return () => {
            window.removeEventListener("autoMinerActivated", handleActivated)
            window.removeEventListener("autoMinerStopped", handleStopped)
        }
    }, [])

    // ── HEAT MAP ──
    // Listen for toggle from sidebar/mobile controls
    useEffect(() => {
        const handleToggle = (e: Event) => {
            const detail = (e as CustomEvent<{ enabled: boolean }>).detail
            setHeatmapEnabled(!!detail?.enabled)
        }
        window.addEventListener("heatmapToggle" as any, handleToggle)
        return () => window.removeEventListener("heatmapToggle" as any, handleToggle)
    }, [])

    // Fetch 500 rounds of winning-block data when heat map is enabled
    useEffect(() => {
        if (!heatmapEnabled) return
        let cancelled = false

        const fetchHeatmap = async () => {
            try {
                // Backend caps limit at 50 — 10 pages of 50 in parallel = 500 total
                const pages = await Promise.all(
                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) =>
                        apiFetch<{ rounds: Array<{ winningBlock: number, totalWinnings?: string }> }>(
                            `/api/rounds?page=${p}&limit=50&settled=true`
                        ).catch(() => ({ rounds: [] as Array<{ winningBlock: number, totalWinnings?: string }> }))
                    )
                )
                if (cancelled) return
                const counts = Array(25).fill(0) as number[]
                const payouts = Array(25).fill(0) as number[]
                let total = 0
                for (const page of pages) {
                    for (const r of page.rounds || []) {
                        if (typeof r.winningBlock === "number" && r.winningBlock >= 0 && r.winningBlock < 25) {
                            counts[r.winningBlock]++
                            const winnings = parseFloat(r.totalWinnings || "0") / 1e18
                            if (!Number.isNaN(winnings)) {
                                payouts[r.winningBlock] += winnings
                            }
                            total++
                        }
                    }
                }
                setHeatmapCounts(counts)
                setHeatmapPayouts(payouts)
                setHeatmapTotal(total)
            } catch (err) {
                console.error("Heat map fetch failed:", err)
            }
        }

        fetchHeatmap()
        return () => { cancelled = true }
    }, [heatmapEnabled])

    // Live update: increment the winning block when a round settles (while enabled)
    useEffect(() => {
        if (!heatmapEnabled) return
        const unsub = subscribeGlobal("roundSettled", (data: any) => {
            const winner = typeof data?.winningBlock === "number"
                ? data.winningBlock
                : parseInt(String(data?.winningBlock ?? ""), 10)
            if (!Number.isNaN(winner) && winner >= 0 && winner < 25) {
                setHeatmapCounts((prev) => {
                    const next = [...prev]
                    next[winner] = (next[winner] || 0) + 1
                    return next
                })
                setHeatmapTotal((t) => t + 1)
                // Add this round's payout to the winning block's running total
                const rawWinnings = data?.totalWinnings
                const payoutEth = typeof rawWinnings === "string" && rawWinnings.startsWith("0x")
                    ? Number(BigInt(rawWinnings)) / 1e18
                    : parseFloat(rawWinnings ?? "0") / 1e18
                if (!Number.isNaN(payoutEth) && payoutEth > 0) {
                    setHeatmapPayouts((prev) => {
                        const next = [...prev]
                        next[winner] = (next[winner] || 0) + payoutEth
                        return next
                    })
                }
            }
        })
        return () => unsub()
    }, [heatmapEnabled, subscribeGlobal])

    // Rank cells into quintiles (0 = coldest, 4 = hottest) — 5 cells per bin.
    // Discrete bins scale better than continuous gradients on a 25-cell grid.
    const heatmapRanks = useMemo(() => {
        if (!heatmapEnabled || heatmapTotal === 0) return null
        const sorted = heatmapCounts
            .map((count, i) => ({ count, i }))
            .sort((a, b) => a.count - b.count)
        const ranks = new Array(25).fill(0)
        sorted.forEach((item, pos) => {
            ranks[item.i] = Math.min(4, Math.floor(pos / 5))
        })
        return ranks as number[]
    }, [heatmapEnabled, heatmapCounts, heatmapTotal])

    // Monochrome amber scale — single-hue discrete bins, dark-UI friendly.
    // Number on the cell does the primary work; color is ambient pattern signal.
    // Agent-card style: bright border is the main signal. Background stays dark & uniform-ish.
    // No big outer glows (they'd clash between adjacent cells). Inset glow gives the "lit from inside" feel.
    const HEAT_TIERS: Array<{ bg: string; text: string; border: string; glow: string }> = [
        {
            bg: "rgba(0,82,255,0.03)",
            text: "rgba(255,255,255,0.4)",
            border: "rgba(0,120,255,0.18)",
            glow: "none",
        }, // coldest
        {
            bg: "rgba(0,82,255,0.05)",
            text: "rgba(200,220,255,0.62)",
            border: "rgba(0,130,255,0.32)",
            glow: "none",
        },
        {
            bg: "rgba(0,82,255,0.08)",
            text: "rgba(220,235,255,0.88)",
            border: "rgba(0,140,255,0.5)",
            glow: "inset 0 0 6px rgba(0,120,255,0.12)",
        }, // neutral
        {
            bg: "rgba(0,82,255,0.12)",
            text: "rgba(240,248,255,1)",
            border: "rgba(80,170,255,0.7)",
            glow: "inset 0 0 8px rgba(0,130,255,0.18)",
        },
        {
            bg: "rgba(0,82,255,0.18)",
            text: "rgba(255,255,255,1)",
            border: "rgba(140,200,255,0.9)",
            glow: "inset 0 0 10px rgba(0,140,255,0.25)",
        }, // hottest
    ]

    const heatmapStyleFor = (index: number): React.CSSProperties | null => {
        if (!heatmapRanks) return null
        const tier = HEAT_TIERS[heatmapRanks[index]]
        return {
            background: tier.bg,
            border: `1px solid ${tier.border}`,
            boxShadow: tier.glow,
        }
    }

    const canInteract = useCallback((index: number) => {
        if (autoMode.enabled && autoMode.strategy !== "select") return false
        if (phase !== "counting") return false
        if (hasDeployedThisRound) return false
        if (isAutoMinerActive) return false
        if (userDeployedBlocks.has(index)) return false
        return true
    }, [autoMode.enabled, autoMode.strategy, phase, hasDeployedThisRound, isAutoMinerActive, userDeployedBlocks])

    // Keep latest selectedBlocks in a ref so drag handlers always see current state
    const selectedBlocksRef = useRef(selectedBlocks)
    selectedBlocksRef.current = selectedBlocks

    // Drag-to-select state (refs — avoid re-renders during a drag gesture)
    const isDraggingRef = useRef(false)
    const dragToggledRef = useRef<Set<number>>(new Set())
    const pendingDragOpRef = useRef<"add" | "remove" | null>(null)

    const applyToggle = useCallback((index: number, forceOp?: "add" | "remove") => {
        if (!canInteract(index)) return
        const current = selectedBlocksRef.current
        const isSelected = current.includes(index)
        const op = forceOp ?? (isSelected ? "remove" : "add")
        let next: number[]
        if (op === "add") {
            if (isSelected) return
            next = [...current, index]
        } else {
            if (!isSelected) return
            next = current.filter((i) => i !== index)
        }
        setSelectedBlocks(next)
        window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: next, count: next.length } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedBlocks is stable
    }, [canInteract])

    // Drag lifecycle: small movement threshold before we "commit" to a drag.
    // On touch: if the finger moves mostly vertically first, we let the browser scroll;
    // only a horizontal / sustained movement upgrades to drag mode.
    const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
    const dragCommittedRef = useRef(false)
    const DRAG_THRESHOLD = 8 // px

    const processMove = useCallback((clientX: number, clientY: number, isTouch: boolean, preventScroll: () => void) => {
        if (!isDraggingRef.current) return
        const start = dragStartPosRef.current
        if (!start) return

        const dx = clientX - start.x
        const dy = clientY - start.y
        const adx = Math.abs(dx)
        const ady = Math.abs(dy)

        // Not yet committed — decide between scroll (touch + mostly-vertical) and drag.
        if (!dragCommittedRef.current) {
            if (Math.max(adx, ady) < DRAG_THRESHOLD) return
            if (isTouch && ady > adx * 1.3) {
                // Finger is scrolling vertically — release so the browser handles it
                isDraggingRef.current = false
                dragStartPosRef.current = null
                return
            }
            dragCommittedRef.current = true
        }

        // Block scrolling while the drag is active (touchmove with {passive:false} allows this on iOS)
        preventScroll()

        const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
        if (!el) return
        const cellEl = el.closest('[data-block-id]') as HTMLElement | null
        if (!cellEl) return
        const blockIdAttr = cellEl.getAttribute('data-block-id')
        if (blockIdAttr === null) return
        const blockId = parseInt(blockIdAttr, 10)
        if (Number.isNaN(blockId)) return
        if (dragToggledRef.current.has(blockId)) return
        dragToggledRef.current.add(blockId)
        if (pendingDragOpRef.current) {
            applyToggle(blockId, pendingDragOpRef.current)
        }
    }, [applyToggle])

    const handleBlockPointerDown = (index: number, e: React.PointerEvent) => {
        if (!canInteract(index)) return
        isDraggingRef.current = true
        dragCommittedRef.current = false
        dragStartPosRef.current = { x: e.clientX, y: e.clientY }
        dragToggledRef.current = new Set([index])
        const willAdd = !selectedBlocksRef.current.includes(index)
        pendingDragOpRef.current = willAdd ? "add" : "remove"
        // Toggle the first block immediately so a simple tap still works like a click
        applyToggle(index, pendingDragOpRef.current)

        const pointerType = e.pointerType
        const resetDragState = () => {
            isDraggingRef.current = false
            dragCommittedRef.current = false
            dragToggledRef.current = new Set()
            pendingDragOpRef.current = null
            dragStartPosRef.current = null
        }

        if (pointerType === 'touch') {
            // Native touch path — preventDefault on touchmove actually works on iOS with {passive:false}
            const handleTouchMove = (ev: TouchEvent) => {
                if (ev.touches.length !== 1) return
                const t = ev.touches[0]
                processMove(t.clientX, t.clientY, true, () => {
                    if (dragCommittedRef.current && ev.cancelable) ev.preventDefault()
                })
            }
            const handleTouchEnd = () => {
                resetDragState()
                window.removeEventListener('touchmove', handleTouchMove)
                window.removeEventListener('touchend', handleTouchEnd)
                window.removeEventListener('touchcancel', handleTouchEnd)
            }
            window.addEventListener('touchmove', handleTouchMove, { passive: false })
            window.addEventListener('touchend', handleTouchEnd)
            window.addEventListener('touchcancel', handleTouchEnd)
        } else {
            // Mouse / pen path
            const handleMove = (ev: PointerEvent) => {
                processMove(ev.clientX, ev.clientY, false, () => {})
            }
            const handleUp = () => {
                resetDragState()
                window.removeEventListener('pointermove', handleMove)
                window.removeEventListener('pointerup', handleUp)
                window.removeEventListener('pointercancel', handleUp)
            }
            window.addEventListener('pointermove', handleMove)
            window.addEventListener('pointerup', handleUp)
            window.addEventListener('pointercancel', handleUp)
        }
    }

    // During animation, render from the frozen snapshot so resets don't wipe visible data
    const displayCells = snapshotCellsRef.current ?? cells

    return (
        <div className="mining-grid-container" style={styles.container}>
            <div
                className="mining-grid"
                style={styles.grid}
            >
                {displayCells.map((cell, index) => {
                    const isSelected = selectedBlocks.includes(index)
                    const isWinner = winningBlock === index
                    const isEliminated = eliminatedBlocks.includes(index)
                    const isDeployed = userDeployedBlocks.has(index)
                    const heatStyle = heatmapStyleFor(index)
                    const heatFreq = heatmapTotal > 0 ? ((heatmapCounts[index] || 0) / heatmapTotal) * 100 : 0
                    const heatCount = heatmapCounts[index] || 0
                    const applyHeat = heatStyle && !isEliminated && !isSelected && !isDeployed && !(isWinner && phase === "winner")

                    return (
                        <button
                            key={index}
                            className="mining-cell"
                            data-block-id={index}
                            style={{
                                ...styles.cell,
                                ...(isDeployed && !isEliminated ? styles.cellDeployed : {}),
                                ...(isSelected && !isEliminated && !isDeployed ? styles.cellSelected : {}),
                                ...(isEliminated ? styles.cellEliminated : {}),
                                ...(isWinner && phase === "winner" ? styles.cellWinner : {}),
...(isAutoMinerActive && !isDeployed ? styles.cellDisabled : {}),
                                ...(applyHeat ? heatStyle! : {}),
                                position: 'relative' as const,
                                touchAction: 'pan-y',
                            }}
                            onPointerDown={(e) => handleBlockPointerDown(index, e)}
                            onMouseEnter={() => heatmapEnabled && setHeatmapHover(index)}
                            onMouseLeave={() => heatmapEnabled && setHeatmapHover(null)}
disabled={phase !== "counting" || isDeployed || hasDeployedThisRound || isAutoMinerActive}                        >
                            {!isEliminated && (
                                <>
                                    <div className="cell-header" style={styles.cellHeader}>
                                        <span className="cell-id" style={styles.cellId}>#{index + 1}</span>
                                        {false && isDeployed ? (
                                            <span style={styles.deployedCheck}>✓</span>
                                        ) : cell.minerCount > 0 ? (
                                            <span style={styles.minerCount}>{cell.minerCount}</span>
                                        ) : null}
                                    </div>
                                    <div className="cell-amount" style={{
                                        ...styles.cellAmount,
                                        ...(applyHeat ? {
                                            color: HEAT_TIERS[heatmapRanks![index]].text,
                                            fontVariantNumeric: 'tabular-nums' as const,
                                        } : {}),
                                    }}>
                                        {applyHeat
                                            ? `${heatFreq.toFixed(1)}%`
                                            : (cell.amount > 0 ? cell.amount.toFixed(4) : '—')}
                                    </div>
                                    {heatmapEnabled && heatmapHover === index && heatmapTotal > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            marginBottom: 6,
                                            padding: '6px 10px',
                                            background: 'rgba(10,14,26,0.95)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 6,
                                            fontSize: 10,
                                            whiteSpace: 'nowrap' as const,
                                            color: '#fff',
                                            fontFamily: "'Space Mono', monospace",
                                            zIndex: 100,
                                            pointerEvents: 'none' as const,
                                        }}>
                                            Block #{index + 1} · Won {heatCount}× · {heatFreq.toFixed(1)}% · {(heatmapPayouts[index] || 0).toFixed(3)} ETH paid out
                                        </div>
                                    )}
                                </>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Heat map legend — shown only when enabled */}
            {heatmapEnabled && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    marginTop: 12,
                    padding: '8px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.5)',
                    fontFamily: "'Space Mono', monospace",
                    letterSpacing: '0.04em',
                }}>
                    <span>COLD</span>
                    <div style={{
                        width: 120,
                        height: 6,
                        borderRadius: 3,
                        background: 'linear-gradient(to right, #0f1420 0%, #0a2d5e 25%, #0f4a9e 50%, #1f6fd6 75%, #4a9fff 100%)',
                    }} />
                    <span>HOT</span>
                    {heatmapTotal > 0 && (
                        <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.3)' }}>
                            · {heatmapTotal} rounds
                        </span>
                    )}
                </div>
            )}

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
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
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
        border: "2px solid rgba(0, 82, 255, 0.7)", background: "rgba(0, 82, 255, 0.12)", boxShadow: "0 0 24px rgba(0, 82, 255, 0.25), inset 0 0 24px rgba(0, 82, 255, 0.08)",
    },
    cellDeployed: {
        background: "rgba(34, 197, 94, 0.10)",
        boxShadow: "0 0 24px rgba(34, 197, 94, 0.2), inset 0 0 24px rgba(34, 197, 94, 0.06)",
        border: "2px solid rgba(34, 197, 94, 0.6)",
        cursor: "default",
        transition: "all 0.3s ease",
        
    },
    deployedCheck: {
        fontSize: "12px",
        fontWeight: 700,
        color: "#4a9a4a",
    },
    cellEliminated: {
        opacity: 0.2,
        transform: "scale(0.95)",
        border: "1px solid rgba(255, 255, 255, 0.04)",
    },
    cellWinner: {
        border: "1.5px solid rgba(255, 215, 0, 0.7)", background: "rgba(255, 215, 0, 0.08)",
        boxShadow: "0 0 30px rgba(255, 215, 0, 0.25), inset 0 0 30px rgba(255, 215, 0, 0.08)",
    },
    cellDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    cellHeader: {
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    cellId: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#999",
    },
    minerCount: {
        marginLeft: "auto",
        fontSize: "10px",
        fontWeight: 600,
        color: "#aaa",
    },
    cellAmount: {
        fontSize: "14px",
        fontWeight: 700,
        color: "#fff",
        textAlign: "right",
    },
}
