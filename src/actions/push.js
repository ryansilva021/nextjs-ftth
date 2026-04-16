'use server'

import { auth }             from '@/lib/auth'
import { connectDB }        from '@/lib/db'
import { PushSubscription } from '@/models/PushSubscription'
import { sendPushToUser }   from '@/lib/webpush'

/**
 * Envia uma notificação push de teste para o usuário logado.
 * Retorna { ok, subscriptions } ou { error }.
 */
export async function testPushNotification() {
  const session = await auth()
  if (!session?.user) return { error: 'Não autenticado' }

  const { username } = session.user

  await connectDB()

  const count = await PushSubscription.countDocuments({ username })
  if (count === 0) {
    return { error: 'Nenhuma subscription encontrada. Ative as notificações primeiro.' }
  }

  try {
    await sendPushToUser(username, {
      title: '🔔 FiberOps — Teste',
      body:  'Notificação push funcionando corretamente!',
      url:   '/admin/os',
    })
    return { ok: true, subscriptions: count }
  } catch (err) {
    console.error('[push/test] erro:', err)
    return { error: String(err?.message ?? err) }
  }
}

/**
 * Salva subscription push do usuário logado no banco.
 */
export async function savePushSubscription(subJson) {
  const session = await auth()
  if (!session?.user) return { error: 'Não autenticado' }

  const { username, projeto_id } = session.user
  const { endpoint, expirationTime, keys } = subJson ?? {}

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return { error: 'Subscription inválida' }
  }

  await connectDB()

  await PushSubscription.findOneAndUpdate(
    { 'subscription.endpoint': endpoint },
    { username, projeto_id, subscription: { endpoint, expirationTime: expirationTime ?? null, keys } },
    { upsert: true, new: true }
  )

  return { ok: true }
}

/**
 * Remove subscription push do usuário logado.
 */
export async function removePushSubscription(endpoint) {
  const session = await auth()
  if (!session?.user) return { error: 'Não autenticado' }

  if (!endpoint) return { error: 'endpoint obrigatório' }

  await connectDB()
  await PushSubscription.deleteOne({ 'subscription.endpoint': endpoint })

  return { ok: true }
}
