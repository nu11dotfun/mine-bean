'use client'

import { useRef, useEffect } from 'react'
import { useRoundTimer } from '@/lib/RoundTimerContext'

let audioCtx: AudioContext | null = null

function playTick(num: number) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const ctx = audioCtx
    const t = ctx.currentTime
    const freq = 400 + (5 - num) * 100
    const vol = 0.12 + (5 - num) * 0.04

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15)
    osc.start(t)
    osc.stop(t + 0.15)
  } catch (e) {}
}

export default function CountdownCelebration() {
  const { timeRemaining } = useRoundTimer()
  const lastTickRef = useRef(0)

  useEffect(() => {
    if (timeRemaining >= 1 && timeRemaining <= 5 && lastTickRef.current !== timeRemaining) {
      lastTickRef.current = timeRemaining
      playTick(timeRemaining)
    }
    if (timeRemaining > 5) lastTickRef.current = 0
  }, [timeRemaining])

  return null
}
