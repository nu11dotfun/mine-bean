'use client'

import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

interface RoundTimerContextValue {
  timeRemaining: number
  endTime: number
  roundId: string
}

const RoundTimerContext = createContext<RoundTimerContextValue | null>(null)

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
})

export function RoundTimerProvider({ children }: { children: ReactNode }) {
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [roundId, setRoundId] = useState('')

  const anchorRef = useRef<{ wallTime: number; chainRemaining: number } | null>(null)
  const lastCalibratedEndTimeRef = useRef(0)

  const calibrate = useCallback(async (newEndTime: number, newRoundId: string) => {
    if (newEndTime === lastCalibratedEndTimeRef.current) return
    lastCalibratedEndTimeRef.current = newEndTime

    setEndTime(newEndTime)
    setRoundId(newRoundId)

    if (newEndTime <= 0) {
      anchorRef.current = null
      setTimeRemaining(0)
      return
    }

    try {
      const block = await publicClient.getBlock({ blockTag: 'latest' })
      const blockTimestamp = Number(block.timestamp)
      const chainRemaining = newEndTime - blockTimestamp
      const wallTime = Date.now() / 1000

      anchorRef.current = { wallTime, chainRemaining }
      setTimeRemaining(Math.max(0, Math.ceil(chainRemaining)))
    } catch (err) {
      console.warn('[RoundTimer] RPC failed, falling back to wall clock:', err)
      const wallRemaining = newEndTime - Date.now() / 1000
      const wallTime = Date.now() / 1000

      anchorRef.current = { wallTime, chainRemaining: wallRemaining }
      setTimeRemaining(Math.max(0, Math.ceil(wallRemaining)))
    }
  }, [])

  useEffect(() => {
    const handleRoundData = (event: CustomEvent) => {
      const d = event.detail
      const newEndTime = typeof d.endTime === 'number' ? d.endTime : 0
      const newRoundId = d.roundId ? String(d.roundId) : ''
      if (newEndTime > 0) {
        calibrate(newEndTime, newRoundId)
      }
    }

    window.addEventListener('roundData' as any, handleRoundData)
    return () => window.removeEventListener('roundData' as any, handleRoundData)
  }, [calibrate])

  useEffect(() => {
    const tick = () => {
      if (!anchorRef.current) return
      const { wallTime, chainRemaining } = anchorRef.current
      const elapsed = Date.now() / 1000 - wallTime
      const remaining = Math.max(0, Math.ceil(chainRemaining - elapsed))
      setTimeRemaining(remaining)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <RoundTimerContext.Provider value={{ timeRemaining, endTime, roundId }}>
      {children}
    </RoundTimerContext.Provider>
  )
}

export function useRoundTimer() {
  const context = useContext(RoundTimerContext)
  if (!context) throw new Error('useRoundTimer must be used within RoundTimerProvider')
  return context
}
