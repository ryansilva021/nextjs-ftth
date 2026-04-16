/**
 * POST /api/push/test — envia push de teste para o usuário logado
 */
import { auth }             from '@/lib/auth'
import { connectDB }        from '@/lib/db'
import { PushSubscription } from '@/models/PushSubscription'
import { sendPushToUser }   from '@/lib/webpush'

export const runtime = 'nodejs'

export async function POST() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { username } = session.user

  await connectDB()

  // Conta quantas subscriptions o usuário tem
  const count = await PushSubscription.countDocuments({ username })
  if (count === 0) {
    return Response.json({ error: 'Nenhuma subscription encontrada para este usuário. Ative as notificações primeiro.' }, { status: 404 })
  }

  try {
    await sendPushToUser(username, {
      title: '🔔 FiberOps — Teste',
      body:  'Notificação push funcionando corretamente!',
      url:   '/admin/os',
    })
    return Response.json({ ok: true, subscriptions: count })
  } catch (err) {
    console.error('[push/test] erro:', err)
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}
