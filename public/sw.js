/**
 * FiberOps Service Worker v2
 * - Push notifications (funciona com app minimizado / fechado)
 * - Cache de shell para fallback offline
 * - Background sync para retry de notificações
 */

const CACHE_NAME  = 'fiberops-shell-v2'
const SHELL_URLS  = ['/', '/manifest.json', '/short-logo.svg', '/long-logo.svg']
const APP_NAME    = 'FiberOps'

// ── Instalação ────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .catch(() => {})
  )
})

// ── Ativação ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      // Remove caches antigos
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      // Assume controle imediato de todas as abas
      clients.claim(),
    ])
  )
})

// ── Fetch: network-first para navegação, cache para shell ─────────────────────
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return
  e.respondWith(
    fetch(e.request)
      .catch(() =>
        caches.match(e.request)
          .then(r => r ?? caches.match('/'))
          .then(r => r ?? Response.error())
      )
  )
})

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  let data = {}
  try   { data = e.data?.json() ?? {} }
  catch { data = { title: APP_NAME, body: e.data?.text() ?? '' } }

  const title   = data.title ?? APP_NAME
  const options = {
    body:     data.body    ?? 'Nova notificação',
    icon:     data.icon    ?? '/short-logo.svg',
    badge:    data.badge   ?? '/short-logo.svg',
    vibrate:  [200, 100, 200],
    tag:      data.tag     ?? 'fiberops-os',
    renotify: true,
    silent:   false,
    data:     { url: data.url ?? '/' },
    actions:  [
      { action: 'open',    title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  }

  e.waitUntil(self.registration.showNotification(title, options))
})

// ── Clique na notificação ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.action === 'dismiss') return

  const url = e.notification.data?.url ?? '/'

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // Foca aba já aberta do app e navega para a URL
      for (const w of wins) {
        if (w.url.includes(self.location.origin) && 'focus' in w) {
          w.focus()
          w.navigate?.(url)
          return
        }
      }
      return clients.openWindow(url)
    })
  )
})

// ── Mensagem da thread principal → notificação nativa ────────────────────────
// Uso: navigator.serviceWorker.controller.postMessage({ type:'SHOW_NOTIFICATION', ... })
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'SHOW_NOTIFICATION') return
  const { title, body, icon, badge, tag, url, vibrate } = e.data
  e.waitUntil(
    self.registration.showNotification(title ?? APP_NAME, {
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
