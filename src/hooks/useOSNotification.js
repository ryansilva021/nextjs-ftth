/**
 * hooks/useOSNotification.js
 *
 * Conecta ao endpoint SSE /api/os-events e dispara callbacks quando uma
 * nova OS é criada para o usuário logado.
 *
 * Uso:
 *   const { latestOS } = useOSNotification({
 *     onNova: (event) => showToast(event),
 *   })
 */

'use client'

import { useEffect, useRef, useState } from 'react'

const RECONNECT_DELAY = 5_000   // 5 s antes de reconectar
const MAX_RECONNECTS  = 10      // desiste após 10 tentativas

export function useOSNotification({ onNova } = {}) {
  const [latestOS, setLatestOS] = useState(null)
  const esRef          = useRef(null)
  const reconnectsRef  = useRef(0)
  const unmountedRef   = useRef(false)

  useEffect(() => {
    unmountedRef.current = false

    function connect() {
      if (unmountedRef.current) return
      if (reconnectsRef.current >= MAX_RECONNECTS) return

      const es = new EventSource('/api/os-events')
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          setLatestOS(data)
          onNova?.(data)
          reconnectsRef.current = 0 // reset ao receber dado com sucesso
        } catch (_) {}
      }

      es.onerror = () => {
        es.close()
        esRef.current = null
        if (!unmountedRef.current) {
          reconnectsRef.current += 1
          setTimeout(connect, RECONNECT_DELAY)
        }
      }
    }

    connect()

    return () => {
      unmountedRef.current = true
      esRef.current?.close()
      esRef.current = null
    }
  }, [onNova])

  return { latestOS }
}
