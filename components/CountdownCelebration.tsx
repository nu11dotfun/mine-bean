'use client'

import { useState, useRef, useEffect } from 'react'
import { useRoundTimer } from '@/lib/RoundTimerContext'

function playTick(num: number) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const t = ctx.currentTime
    const baseFreq = 400 + (5 - num) * 100
    const volume = 0.12 + (5 - num) * 0.04

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(baseFreq, t)
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15)
    osc.start(t)
    osc.stop(t + 0.15)

    const click = ctx.createOscillator()
    const clickGain = ctx.createGain()
    click.connect(clickGain)
    clickGain.connect(ctx.destination)
    click.type = 'square'
    click.frequency.setValueAtTime(baseFreq * 3, t)
    clickGain.gain.setValueAtTime(volume * 0.3, t)
    clickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05)
    click.start(t)
    click.stop(t + 0.05)

    if (num === 1) {
      const sub = ctx.createOscillator()
      const subGain = ctx.createGain()
      sub.connect(subGain)
      subGain.connect(ctx.destination)
      sub.type = 'sine'
      sub.frequency.setValueAtTime(120, t)
      sub.frequency.exponentialRampToValueAtTime(60, t + 0.2)
      subGain.gain.setValueAtTime(0.25, t)
      subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3)
      sub.start(t)
      sub.stop(t + 0.3)
    }
  } catch (e) {}
}

export default function CountdownCelebration() {
  const [count, setCount] = useState<number | null>(null)
  const { timeRemaining } = useRoundTimer()
  const lastShownRef = useRef(0)

  useEffect(() => {
    const handleRoundSettled = () => {
      lastShownRef.current = 0
      setCount(null)
    }
    window.addEventListener('roundSettled', handleRoundSettled)
    return () => window.removeEventListener('roundSettled', handleRoundSettled)
  }, [])

  useEffect(() => {
    if (timeRemaining >= 1 && timeRemaining <= 5 && lastShownRef.current !== timeRemaining) {
      lastShownRef.current = timeRemaining
      setCount(timeRemaining)
      playTick(timeRemaining)
      setTimeout(() => {
        setCount(prev => prev === timeRemaining ? null : prev)
      }, 800)
    }

    // Reset tracker when timer goes above 5 (new round)
    if (timeRemaining > 5) {
      lastShownRef.current = 0
    }
  }, [timeRemaining])

  const getColor = (n: number) => {
    if (n >= 4) return 'rgba(255,255,255,0.5)'
    if (n === 3) return 'rgba(255,255,255,0.7)'
    if (n === 2) return '#FFD700'
    return '#FF4444'
  }
  const getGlow = (n: number) => {
    if (n >= 4) return 'rgba(255,255,255,0.08)'
    if (n === 3) return 'rgba(255,255,255,0.12)'
    if (n === 2) return 'rgba(255,215,0,0.2)'
    return 'rgba(255,68,68,0.25)'
  }
  const getSize = (n: number) => {
    if (n >= 4) return 'clamp(80px, 14vw, 130px)'
    if (n === 3) return 'clamp(90px, 16vw, 150px)'
    if (n === 2) return 'clamp(100px, 18vw, 170px)'
    return 'clamp(110px, 20vw, 190px)'
  }

  return (
    <>
      {count !== null && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1999, pointerEvents: 'none' }}>
          <div key={`ring-${count}`} style={{
            position: 'absolute', width: 180, height: 180, borderRadius: '50%',
            border: `2px solid ${getColor(count)}`, opacity: 0.3,
            animation: 'cdPulseRing 1s ease-out forwards',
          }} />
          <div style={{
            position: 'absolute', width: 220, height: 220, borderRadius: '50%',
            background: `radial-gradient(circle, ${getGlow(count)} 0%, transparent 70%)`,
            filter: 'blur(20px)',
          }} />
          <div key={`num-${count}`} style={{
            fontSize: getSize(count), fontWeight: 900,
            fontFamily: "'Inter', -apple-system, sans-serif",
            color: getColor(count),
            textShadow: `0 0 30px ${getGlow(count)}, 0 0 60px ${getGlow(count)}, 0 4px 6px rgba(0,0,0,0.4)`,
            lineHeight: 1,
            animation: 'cdNumberIn 0.25s cubic-bezier(0.16, 1, 0.3, 1), cdNumberOut 0.25s ease-in 0.65s forwards',
            position: 'relative', zIndex: 1,
          }}>
            {count}
          </div>
        </div>
      )}
      <style>{`
        @keyframes cdNumberIn { 0% { transform: scale(2.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes cdNumberOut { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.7); } }
        @keyframes cdPulseRing { 0% { transform: scale(0.5); opacity: 0.5; } 100% { transform: scale(3); opacity: 0; } }
      `}</style>
    </>
  )
}
