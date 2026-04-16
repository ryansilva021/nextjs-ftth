/**
 * lib/webpush.js
 * Singleton para envio de Web Push Notifications via VAPID.
 */

import webpush from 'web-push'
import { connectDB } from '@/lib/db'
import { PushSubscription } from '@/models/PushSubscription'

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const MAILTO        = process.env.RESEND_FROM?.match(/<(.+?)>/)?.[1]
                      ?? 'mailto:admin@fiberops.com.br'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    MAILTO.startsWith('mailto:') ? MAILTO : `mailto:${MAILTO}`,
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  )
}

/**
 * Envia push notification para todos os dispositivos subscritos de um usuário.
 * Silencia erros de subscription expirada (410) removendo-as do banco.
 *
 * @param {string} username  - username do destinatário
 * @param {{ title: string, body: string, url?: string, icon?: string }} payload
 */
export async function sendPushToUser(username, payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return
  if (!username) return

  await connectDB()

  const subs = await PushSubscription.find({ username }).lean()
  if (!subs.length) return

  const message = JSON.stringify({
    title: payload.title ?? 'FiberOps',
    body:  payload.body  ?? '',
    url:   payload.url   ?? '/admin/os',
    icon:  payload.icon  ?? '/short-logo.svg',
    badge: '/short-logo.svg',
  })

  const results = await Promise.allSettled(
    subs.map(s => webpush.sendNotification(s.subscription, message))
  )

  // Remove subscrições inválidas / expiradas; loga erros para debug
  const toDelete = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'rejected') {
      const status = r.reason?.statusCode
      console.error(`[webpush] falha ao enviar para ${username} (sub ${i}): status=${status}`, r.reason?.body ?? r.reason?.message)
      if (status === 410 || status === 404) toDelete.push(subs[i]._id)
    } else {
      console.log(`[webpush] push enviado com sucesso para ${username} (sub ${i}): status=${r.value?.statusCode}`)
    }
  }
  if (toDelete.length) {
    await PushSubscription.deleteMany({ _id: { $in: toDelete } })
    console.log(`[webpush] ${toDelete.length} subscrição(ões) expirada(s) removida(s) para ${username}`)
  }
}
