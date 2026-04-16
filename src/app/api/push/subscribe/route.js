/**
 * POST /api/push/subscribe   — salva ou atualiza subscrição push do usuário logado
 * DELETE /api/push/subscribe — remove subscrição (unsubscribe)
 */

import { auth }               from '@/lib/auth'
import { connectDB }          from '@/lib/db'
import { PushSubscription }   from '@/models/PushSubscription'

export const runtime = 'nodejs'

export async function POST(request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { username, projeto_id } = session.user

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { endpoint, expirationTime, keys } = body ?? {}
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: 'Subscription inválida' }, { status: 400 })
  }

  await connectDB()

  await PushSubscription.findOneAndUpdate(
    { 'subscription.endpoint': endpoint },
    {
      username,
      projeto_id,
      subscription: { endpoint, expirationTime: expirationTime ?? null, keys },
    },
    { upsert: true, new: true }
  )

  return Response.json({ ok: true })
}

export async function DELETE(request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { body = {} }

  const { endpoint } = body ?? {}
  if (!endpoint) return Response.json({ error: 'endpoint obrigatório' }, { status: 400 })

  await connectDB()
  await PushSubscription.deleteOne({ 'subscription.endpoint': endpoint })

  return Response.json({ ok: true })
}
