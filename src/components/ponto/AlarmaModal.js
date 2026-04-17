'use client'

import { useEffect, useRef } from 'react'
import { T } from './pontoTheme'

function startAlarmLoop() {
  if (typeof window === 'undefined') return () => {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    let active = true

    async function cycle() {
      while (active) {
        for (let i = 0; i < 3; i++) {
          if (!active) break
          const osc  = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.type = 'sine'
          osc.frequency.setValueAtTime(1100, ctx.currentTime)
          osc.frequency.setValueAtTime(880,  ctx.currentTime + 0.08)
          gain.gain.setValueAtTime(0.38, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
          osc.start(ctx.currentTime)
          osc.stop(ctx.currentTime + 0.22)
          await new Promise(r => setTimeout(r, 300))
        }
        await new Promise(r => setTimeout(r, 950))
      }
    }

    cycle()
    return () => { active = false; setTimeout(() => ctx.close(), 600) }
  } catch (_) {
    return () => {}
  }
}

function startVibrationLoop() {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return () => {}
  // Pattern: 400ms on, 200ms off — re-fired every 650ms to keep it continuous
  navigator.vibrate([400, 200])
  const id = setInterval(() => navigator.vibrate([400, 200]), 650)
  return () => { clearInterval(id); navigator.vibrate(0) }
}

export default function AlarmaModal({ alarma, onBaterPonto, onCancelar, pending }) {
  const stopRef = useRef(null)

  useEffect(() => {
    const stopSound   = startAlarmLoop()
    const stopVibrate = startVibrationLoop()
    stopRef.current = () => { stopSound(); stopVibrate() }
    return () => stopRef.current?.()
  }, [])

  function dismiss(fn) {
    stopRef.current?.()
    fn()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(10,8,5,0.96)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: T.ff,
    }}>
      <style>{`
        @keyframes alarma-pulse {
          0%,100% { transform: scale(1);    box-shadow: 0 0 0 0   rgba(212,98,43,0.7); }
          50%      { transform: scale(1.07); box-shadow: 0 0 0 20px rgba(212,98,43,0);  }
        }
        @keyframes alarma-ring {
          0%,100% { transform: rotate(-10deg); }
          50%     { transform: rotate(10deg);  }
        }
      `}</style>

      {/* Pulsing icon */}
      <div style={{
        width: 108, height: 108, borderRadius: '50%',
        background: `${T.accent}1a`, border: `3px solid ${T.accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 52, marginBottom: 30,
        animation: 'alarma-pulse 1s ease-in-out infinite',
      }}>
        <span style={{ animation: 'alarma-ring 0.5s ease-in-out infinite', display: 'inline-block' }}>⏰</span>
      </div>

      <div style={{ fontSize: 11, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
        Despertador
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 4 }}>
        {alarma.icon} {alarma.label}
      </div>
      <div style={{ fontSize: 48, fontWeight: 900, color: T.accent, fontVariantNumeric: 'tabular-nums', marginBottom: 44 }}>
        {alarma.time}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
        <button
          onClick={() => dismiss(() => onBaterPonto(alarma.key))}
          disabled={pending}
          style={{
            padding: '18px 20px', borderRadius: 16, border: 'none',
            background: pending ? '#374151' : T.accent,
            color: '#fff', fontSize: 17, fontWeight: 800,
            cursor: pending ? 'not-allowed' : 'pointer',
            fontFamily: T.ff,
            boxShadow: pending ? 'none' : `0 6px 24px rgba(212,98,43,0.45)`,
            letterSpacing: '0.02em',
          }}
        >
          {pending ? 'Registrando…' : '⏰  Bater Ponto'}
        </button>
        <button
          onClick={() => dismiss(onCancelar)}
          disabled={pending}
          style={{
            padding: '16px 20px', borderRadius: 16,
            background: 'transparent', border: `1px solid ${T.border}`,
            color: T.muted, fontSize: 15, fontWeight: 600,
            cursor: pending ? 'not-allowed' : 'pointer',
            fontFamily: T.ff,
          }}
        >
          ✕  Cancelar
        </button>
      </div>
    </div>
  )
}
