'use client'
/**
 * nativeNotif.js
 * Exibe notificação nativa via Service Worker (funciona com app minimizado).
 * Fallback: new Notification() quando SW não está disponível.
 *
 * Usa reg.showNotification() — único método que dispara em background.
 */

let _swReg = null

/** Obtém o registro do SW, com cache em memória para evitar re-chamadas. */
async function getSwReg() {
  if (_swReg) return _swReg
  if (!('serviceWorker' in navigator)) return null
  try {
    // Aguarda até 3s pelo SW ativo — suficiente em qualquer dispositivo
    _swReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('sw_timeout')), 3000)),
    ])
    return _swReg
  } catch (_) {
    return null
  }
}

/**
 * Exibe uma notificação nativa.
 * @param {{ title: string, body: string, tag?: string, url?: string, icon?: string }} opts
 */
export async function showNativeNotif({ title, body, tag, url, icon } = {}) {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return

  // Solicita permissão se ainda não foi decidida
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
  if (Notification.permission !== 'granted') return

  const options = {
    body:     body    ?? '',
    icon:     icon    ?? '/short-logo.svg',
    badge:    '/short-logo.svg',
    tag:      tag     ?? 'fiberops',
    renotify: true,
    vibrate:  [150, 75, 150],
    data:     { url: url ?? '/' },
  }

  // Preferência: SW → notificação funciona em background / minimizado
  const reg = await getSwReg()
  if (reg) {
    try {
      await reg.showNotification(title ?? 'FiberOps', options)
      return
    } catch (_) {}
  }

  // Fallback: apenas funciona com app em primeiro plano
  try {
    new Notification(title ?? 'FiberOps', options)
  } catch (_) {}
}

/**
 * Solicita permissão para notificações e registra o SW se necessário.
 * Chamar uma vez na inicialização do app (layout ou componente raiz).
 */
export async function requestNotifPermission() {
  if (typeof window === 'undefined') return 'unavailable'
  if (!('Notification' in window)) return 'unavailable'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied')  return 'denied'
  const result = await Notification.requestPermission()
  return result
}
