/**
 * lib/notifSound.js
 * Toca um som de notificação usando a Web Audio API (sem arquivo externo).
 * Seguro para chamar no cliente; silencia erros silenciosamente.
 */

let audioCtx = null

function getCtx() {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioCtx
  } catch { return null }
}

/**
 * Toca um "ding" duplo suave — agradável e não intrusivo.
 * @param {number} [volume=0.35]  0.0 a 1.0
 */
export function playNotifSound(volume = 0.35) {
  const ctx = getCtx()
  if (!ctx) return

  // Resumir contexto suspenso (política autoplay do Chrome)
  const play = () => {
    const now = ctx.currentTime

    function ding(startTime, freq) {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startTime)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.75, startTime + 0.25)

      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.01)   // attack
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4) // decay

      osc.start(startTime)
      osc.stop(startTime + 0.4)
    }

    ding(now,        880)   // primeiro ding  — Lá5
    ding(now + 0.18, 1100)  // segundo ding   — Dó#6 (acorde ascendente = positivo)
  }

  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {})
  } else {
    play()
  }
}
