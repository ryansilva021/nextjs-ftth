/**
 * FiberOps Service Worker — Web Push Notifications
 * Arquivo em /public/sw.js → servido em /sw.js (raiz do site)
 */

const APP_NAME = 'FiberOps'

// ── Recebe push do servidor ───────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch (_) {
    data = { title: APP_NAME, body: event.data?.text() ?? '' }
  }

  const title   = data.title ?? APP_NAME
  const options = {
    body:    data.body  ?? 'Nova notificação',
    icon:    data.icon  ?? '/short-logo.svg',
    badge:   data.badge ?? '/short-logo.svg',
    vibrate: [200, 100, 200],
    tag:     data.tag   ?? 'fiberops-os',        // agrupa notificações do mesmo tipo
    renotify: true,                               // vibra mesmo se a tag já existe
    data: {
      url: data.url ?? '/admin/os',
    },
    actions: [
      { action: 'open',    title: 'Ver OS' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// ── Clique na notificação ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = event.notification.data?.url ?? '/admin/os'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já há uma aba aberta com o app, foca nela e navega
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus()
          client.navigate?.(url)
          return
        }
      }
      // Caso contrário abre uma nova aba
      return clients.openWindow(url)
    })
  )
})

// ── Mensagem da thread principal → mostra notificação nativa ─────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SHOW_NOTIFICATION') return
  const { title, body, icon, badge, tag, url, vibrate } = event.data
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     icon    ?? '/short-logo.svg',
      badge:    badge   ?? '/short-logo.svg',
      tag:      tag     ?? 'fiberops',
      renotify: true,
      vibrate:  vibrate ?? [150, 75, 150],
      data:     { url: url ?? '/' },
    })
  )
})

// ── Instalação / ativação (sem cache offline por enquanto) ────────────────────
self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))
