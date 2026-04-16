/**
 * hooks/usePushNotification.js
 *
 * Registra o Service Worker, pede permissão de notificação ao usuário e
 * envia a subscription ao servidor para que o backend possa fazer push.
 *
 * Uso:
 *   const { status, subscribe, unsubscribe } = usePushNotification()
 *
 * status: 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading'
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { savePushSubscription, removePushSubscription } from '@/actions/push'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/** Converte base64url → Uint8Array (necessário para applicationServerKey) */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePushNotification() {
  const [status, setStatus] = useState('loading')
  const [swReg,  setSwReg]  = useState(null)

  // ── Registra o SW e lê o estado inicial ─────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (!VAPID_PUBLIC) {
      setStatus('unsupported')
      return
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(async (reg) => {
        setSwReg(reg)

        const perm = Notification.permission
        if (perm === 'denied') { setStatus('denied'); return }

        const existing = await reg.pushManager.getSubscription()
        setStatus(existing ? 'subscribed' : 'unsubscribed')
      })
      .catch(() => setStatus('unsupported'))
  }, [])

  // ── Subscrever ───────────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!swReg) return
    setStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setStatus('denied'); return }

      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })

      // Serializa e envia ao backend via Server Action (sem problema de sessão)
      const subJson = sub.toJSON()
      await savePushSubscription(subJson)

      setStatus('subscribed')
    } catch (e) {
      console.error('[push] subscribe error', e)
      setStatus('unsubscribed')
    }
  }, [swReg])

  // ── Desinscrever ─────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!swReg) return
    setStatus('loading')
    try {
      const sub = await swReg.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setStatus('unsubscribed')
    } catch (e) {
      console.error('[push] unsubscribe error', e)
      setStatus('subscribed')
    }
  }, [swReg])

  return { status, subscribe, unsubscribe }
}
