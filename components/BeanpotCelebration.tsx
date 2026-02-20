'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import confetti from 'canvas-confetti'

function playCelebrationSound() {
  if (localStorage.getItem('bean_muted') === 'true') return
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const t = ctx.currentTime

    const sub = ctx.createOscillator()
    const subGain = ctx.createGain()
    sub.connect(subGain)
    subGain.connect(ctx.destination)
    sub.type = 'sine'
    sub.frequency.setValueAtTime(50, t)
    sub.frequency.exponentialRampToValueAtTime(20, t + 0.3)
    subGain.gain.setValueAtTime(0.5, t)
    subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4)
    sub.start(t)
    sub.stop(t + 0.4)

    const crackBuf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate)
    const crackData = crackBuf.getChannelData(0)
    for (let i = 0; i < crackData.length; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackData.length, 6)
    }
    const crack = ctx.createBufferSource()
    crack.buffer = crackBuf
    const crackGain = ctx.createGain()
    crack.connect(crackGain)
    crackGain.connect(ctx.destination)
    crackGain.gain.setValueAtTime(0.3, t)
    crack.start(t)

    const rise = ctx.createOscillator()
    const riseGain = ctx.createGain()
    rise.connect(riseGain)
    riseGain.connect(ctx.destination)
    rise.type = 'sawtooth'
    rise.frequency.setValueAtTime(200, t + 0.05)
    rise.frequency.exponentialRampToValueAtTime(800, t + 0.4)
    riseGain.gain.setValueAtTime(0.12, t + 0.05)
    riseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5)
    rise.start(t + 0.05)
    rise.stop(t + 0.5)

    const hornNotes = [261, 329, 392, 523]
    hornNotes.forEach((freq) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, t + 0.15)
      gain.gain.setValueAtTime(0.12, t + 0.15)
      gain.gain.setValueAtTime(0.14, t + 0.2)
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8)
      osc.start(t + 0.15)
      osc.stop(t + 0.8)
    })

    const celebNotes = [523, 659, 784, 1047, 1319, 1568, 2093]
    celebNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, t + 0.4 + i * 0.05)
      gain.gain.setValueAtTime(0.08, t + 0.4 + i * 0.05)
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.7 + i * 0.05)
      osc.start(t + 0.4 + i * 0.05)
      osc.stop(t + 0.7 + i * 0.05)
    })

    const crowdBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const crowdData = crowdBuf.getChannelData(0)
    for (let i = 0; i < crowdData.length; i++) {
      const env = Math.sin(Math.PI * i / crowdData.length)
      crowdData[i] = (Math.random() * 2 - 1) * env * 0.4
    }
    const crowd = ctx.createBufferSource()
    crowd.buffer = crowdBuf
    const crowdFilter = ctx.createBiquadFilter()
    crowdFilter.type = 'bandpass'
    crowdFilter.frequency.value = 2000
    crowdFilter.Q.value = 0.5
    const crowdGain = ctx.createGain()
    crowd.connect(crowdFilter)
    crowdFilter.connect(crowdGain)
    crowdGain.connect(ctx.destination)
    crowdGain.gain.setValueAtTime(0.01, t + 0.3)
    crowdGain.gain.linearRampToValueAtTime(0.15, t + 0.8)
    crowdGain.gain.linearRampToValueAtTime(0.08, t + 1.5)
    crowdGain.gain.exponentialRampToValueAtTime(0.01, t + 2.5)
    crowd.start(t + 0.3)

    const fanfare = [[1047, 0.8], [1319, 0.95], [1568, 1.1], [2093, 1.3]] as [number, number][]
    fanfare.forEach(([freq, time]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t + time)
      gain.gain.setValueAtTime(0.2, t + time)
      gain.gain.exponentialRampToValueAtTime(0.01, t + time + 1.2)
      osc.start(t + time)
      osc.stop(t + time + 1.2)
    })

    const finalChord = [523, 659, 784, 1047]
    finalChord.forEach((freq) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t + 1.5)
      gain.gain.setValueAtTime(0.1, t + 1.5)
      gain.gain.exponentialRampToValueAtTime(0.01, t + 3.5)
      osc.start(t + 1.5)
      osc.stop(t + 3.5)
    })
  } catch (e) {}
}

export default function BeanpotCelebration() {
  const [showText, setShowText] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout[]>([])

  const triggerCelebration = useCallback(() => {
    timeoutRef.current.forEach(t => clearTimeout(t))
    timeoutRef.current = []
    setShowText(true)
    playCelebrationSound()

    const gold = ['#FFD700', '#FFA500', '#FFE066', '#ffffff']
    const blue = ['#0052FF', '#3B7BFF', '#6aa3ff', '#ffffff']
    const mix = [...gold, ...blue]

    for (let i = 0; i < 10; i++) {
      confetti({ particleCount: 30, angle: 50 + Math.random() * 80, spread: 25 + Math.random() * 20, origin: { x: i / 10 + 0.05, y: 1.1 }, colors: mix, startVelocity: 50 + Math.random() * 30, gravity: 0.5, ticks: 500, scalar: 1.2 + Math.random() * 0.5, shapes: ['circle', 'square'] })
    }

    setTimeout(() => {
      confetti({ particleCount: 150, angle: 55, spread: 50, origin: { x: -0.05, y: 0.7 }, colors: gold, startVelocity: 70, gravity: 0.5, ticks: 450, scalar: 1.3 })
      confetti({ particleCount: 150, angle: 125, spread: 50, origin: { x: 1.05, y: 0.7 }, colors: gold, startVelocity: 70, gravity: 0.5, ticks: 450, scalar: 1.3 })
    }, 200)

    setTimeout(() => {
      confetti({ particleCount: 300, spread: 160, origin: { y: 0.5, x: 0.5 }, colors: mix, startVelocity: 60, gravity: 0.4, ticks: 500, scalar: 1.5 })
    }, 500)

    setTimeout(() => {
      for (let i = 0; i < 8; i++) {
        confetti({ particleCount: 25, angle: 60 + Math.random() * 60, spread: 20, origin: { x: Math.random(), y: 1.1 }, colors: gold, startVelocity: 55 + Math.random() * 25, gravity: 0.5, ticks: 400, scalar: 1.0 })
      }
    }, 800)

    setTimeout(() => {
      confetti({ particleCount: 100, angle: 45, spread: 35, origin: { x: 0, y: 0.85 }, colors: blue, startVelocity: 60, gravity: 0.6, ticks: 400, scalar: 1.2 })
      confetti({ particleCount: 100, angle: 135, spread: 35, origin: { x: 1, y: 0.85 }, colors: blue, startVelocity: 60, gravity: 0.6, ticks: 400, scalar: 1.2 })
    }, 1000)

    setTimeout(() => {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          confetti({ particleCount: 30, spread: 40, origin: { y: -0.1, x: 0.1 + Math.random() * 0.8 }, colors: gold, startVelocity: 8 + Math.random() * 12, gravity: 0.7, ticks: 400, shapes: ['circle'], scalar: 0.7 })
        }, i * 120)
      }
    }, 1300)

    setTimeout(() => {
      confetti({ particleCount: 200, spread: 140, origin: { y: 0.45, x: 0.5 }, colors: mix, startVelocity: 50, gravity: 0.35, ticks: 500, scalar: 1.4 })
    }, 1800)

    setTimeout(() => {
      for (let i = 0; i < 6; i++) {
        confetti({ particleCount: 35, angle: 55 + Math.random() * 70, spread: 30, origin: { x: Math.random(), y: 1.1 }, colors: mix, startVelocity: 45 + Math.random() * 25, gravity: 0.5, ticks: 400, scalar: 1.1 })
      }
    }, 2200)

    setTimeout(() => {
      confetti({ particleCount: 60, angle: 45, spread: 30, origin: { x: 0, y: 1 }, colors: gold, startVelocity: 55, gravity: 0.6, ticks: 350 })
      confetti({ particleCount: 60, angle: 135, spread: 30, origin: { x: 1, y: 1 }, colors: gold, startVelocity: 55, gravity: 0.6, ticks: 350 })
      confetti({ particleCount: 60, angle: 315, spread: 30, origin: { x: 0, y: 0 }, colors: blue, startVelocity: 55, gravity: 0.6, ticks: 350 })
      confetti({ particleCount: 60, angle: 225, spread: 30, origin: { x: 1, y: 0 }, colors: blue, startVelocity: 55, gravity: 0.6, ticks: 350 })
    }, 2600)

    setTimeout(() => {
      confetti({ particleCount: 250, spread: 180, origin: { y: 0.5, x: 0.5 }, colors: mix, startVelocity: 45, gravity: 0.3, ticks: 600, scalar: 1.6 })
    }, 3200)

    setTimeout(() => {
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          confetti({ particleCount: 15, spread: 20, origin: { y: -0.05, x: Math.random() }, colors: ['#FFD700', '#ffffff'], startVelocity: 5, gravity: 0.5, ticks: 500, shapes: ['circle'], scalar: 0.5 })
        }, i * 150)
      }
    }, 3800)

    timeoutRef.current.push(setTimeout(() => setShowText(false), 6000))
  }, [])

  // Listen for real beanpot hits from the roundSettled window event
  useEffect(() => {
    const handleRoundSettled = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (!detail) return
      // Only trigger when beanpot is actually won (paid out), not just accumulated
      const amount = detail.motherlodeAmount || detail.beanpotAmount || '0'
      const amountNum = parseFloat(amount)
      if (amountNum > 1e15) {
        triggerCelebration()
      }
    }
    window.addEventListener('roundSettled', handleRoundSettled)
    return () => window.removeEventListener('roundSettled', handleRoundSettled)
  }, [triggerCelebration])

  return (
    <>

      {showText && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: 'clamp(350px, 60vw, 750px)', height: 'clamp(80px, 12vh, 160px)', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)', borderRadius: '50%', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', width: 'clamp(300px, 50vw, 600px)', height: 'clamp(60px, 10vh, 120px)', background: 'radial-gradient(ellipse at center, rgba(255,200,50,0.1) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(20px)' }} />
          <div style={{
            fontSize: 'clamp(48px, 8vw, 96px)', fontWeight: 800, fontFamily: "'Inter', -apple-system, sans-serif",
            background: 'linear-gradient(180deg, #FFE8A0 0%, #FFD700 25%, #E8A800 50%, #CC8800 75%, #FFD700 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5)) drop-shadow(0 0 30px rgba(255,200,50,0.3))',
            letterSpacing: -1, lineHeight: 1, textAlign: 'center', position: 'relative', zIndex: 1,
            animation: 'bpTextReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            BEANPOT HIT
          </div>
        </div>
      )}

      <style>{`
        @keyframes bpTextReveal { 0% { transform: scale(0.8) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
      `}</style>
    </>
  )
}
