'use client'
/**
 * Exibe uma notificação nativa do SO via o registro do service worker.
 * Usar reg.showNotification() (e não new Notification()) garante que a
 * notificação dispare mesmo quando a aba do browser está em segundo plano
 * ou minimizada.
 * Faz fallback para new Notification() se o SW não estiver pronto em 800ms.
 */
export async function showNativeNotif({ title, body, tag, url, icon }) {
  if (typeof window === 'undefined') return
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(() => rej(), 800)),
      ])
      await reg.showNotification(title, {
        body,
        icon:     icon ?? '/short-logo.svg',
        badge:    '/short-logo.svg',
        tag:      tag  ?? 'fiberops',
        renotify: true,
        vibrate:  [150, 75, 150],
        data:     { url: url ?? '/' },
      })
      return
    } catch (_) {}
  }

  new Notification(title, { body, icon: icon ?? '/short-logo.svg', tag: tag ?? 'fiberops' })
}
