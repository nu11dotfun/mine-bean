'use client'

import React, { useState, useEffect } from "react"

interface CellData {
    participants: number
    amount: number
}

interface MiningGridProps {
    roundNumber?: number
    selectedBlocks?: number[]
    onBlocksChange?: (blocks: number[]) => void
}

export default function MiningGrid({
    roundNumber = 20529,
    selectedBlocks: externalSelectedBlocks,
    onBlocksChange,
}: MiningGridProps) {
    const [internalSelectedBlocks, setInternalSelectedBlocks] = useState<number[]>([])
    const [hoveredBlock, setHoveredBlock] = useState<number | null>(null)
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

    const [cells, setCells] = useState<CellData[]>(() => generateCells())

    function generateCells(): CellData[] {
        return Array.from({ length: 25 }, () => ({
            participants: Math.floor(Math.random() * 20) + 125,
            amount: parseFloat((Math.random() * 0.05 + 0.38).toFixed(4)),
        }))
    }

    useEffect(() => {
        const handlePhaseChange = (event: CustomEvent) => {
            const { phase: newPhase } = event.detail
            setPhase(newPhase)

            if (newPhase === "eliminating") {
                const winner = Math.floor(Math.random() * 25)
                setWinningBlock(winner)

                const toEliminate = Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== winner)
                toEliminate.sort(() => Math.random() - 0.5)

                const intervalTime = 5000 / toEliminate.length
                let eliminated: number[] = []

                toEliminate.forEach((blockIndex, i) => {
                    setTimeout(() => {
                        eliminated = [...eliminated, blockIndex]
                        setEliminatedBlocks([...eliminated])
                    }, intervalTime * (i + 1))
                })
            } else if (newPhase === "counting") {
                setEliminatedBlocks([])
                setWinningBlock(null)
                setSelectedBlocks([])
                setCells(generateCells())
            }
        }

        window.addEventListener("phaseChange" as any, handlePhaseChange)
        return () => window.removeEventListener("phaseChange" as any, handlePhaseChange)
    }, [])

    useEffect(() => {
        const handleSelectAll = (event: CustomEvent) => {
            const { selectAll } = event.detail
            if (selectAll) {
                const allBlocks = Array.from({ length: 25 }, (_, i) => i)
                setSelectedBlocks(allBlocks)
                window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: allBlocks, count: 25 } }))
            } else {
                setSelectedBlocks([])
                window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: [], count: 0 } }))
            }
        }

        window.addEventListener("selectAllBlocks" as any, handleSelectAll)
        return () => window.removeEventListener("selectAllBlocks" as any, handleSelectAll)
    }, [])

    const handleBlockClick = (index: number) => {
        if (phase !== "counting") return
        const newSelection = selectedBlocks.includes(index)
            ? selectedBlocks.filter((i) => i !== index)
            : [...selectedBlocks, index]
        setSelectedBlocks(newSelection)
        window.dispatchEvent(new CustomEvent("blocksChanged", { detail: { blocks: newSelection, count: newSelection.length } }))
    }

    return (
        <div className="mining-grid-container" style={styles.container}>
            <div className="mining-grid" style={styles.grid}>
                {cells.map((cell, index) => {
                    const isSelected = selectedBlocks.includes(index)
                    const isWinner = winningBlock === index
                    const isEliminated = eliminatedBlocks.includes(index)

                    return (
                        <button
                            key={index}
                            className="mining-cell"
                            style={{
                                ...styles.cell,
                                ...(isSelected && !isEliminated ? styles.cellSelected : {}),
                                ...(isEliminated ? styles.cellEliminated : {}),
                                ...(isWinner && phase === "winner" ? styles.cellWinner : {}),
                            }}
                            onClick={() => handleBlockClick(index)}
                            disabled={phase !== "counting"}
                        >
                            {!isEliminated && (
                                <>
                                    <div className="cell-header" style={styles.cellHeader}>
                                        <span className="cell-id" style={styles.cellId}>#{index + 1}</span>
                                    </div>
                                    <div className="cell-amount" style={styles.cellAmount}>{cell.amount.toFixed(4)}</div>
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
    cellEliminated: {
        opacity: 0.2,
        transform: "scale(0.95)",
        border: "2px solid #222",
    },
    cellWinner: {
        border: "2px solid #F0B90B",
        boxShadow: "0 0 20px rgba(240, 185, 11, 0.3)",
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
    cellAmount: {
        fontSize: "14px",
        fontWeight: 700,
        color: "#fff",
        textAlign: "right",
    },
}
