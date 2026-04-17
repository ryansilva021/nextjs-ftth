import { NextResponse }    from 'next/server'
import { connectDB }       from '@/lib/db'
import { TimeSettings }    from '@/models/TimeSettings'
import { PushSubscription } from '@/models/PushSubscription'
import { sendPushToUser }  from '@/lib/webpush'

export const runtime = 'nodejs'

const ALERTS = [
  { field: 'entrada',       alertToggle: 'alerta_entrada',       msg: '⏰ Hora de iniciar sua jornada!' },
  { field: 'almoco_inicio', alertToggle: 'alerta_almoco_inicio',  msg: '🍽 Hora de ir para o almoço!' },
  { field: 'almoco_fim',    alertToggle: 'alerta_almoco_fim',     msg: '▶ Hora de retornar do almoço!' },
  { field: 'saida',         alertToggle: 'alerta_saida',          msg: '🔴 Hora de encerrar seu expediente!' },
]

export async function GET(req) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  await connectDB()

  const now    = new Date()
  const padded = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const allSettings = await TimeSettings.find({}).lean()
  const sent = []

  for (const settings of allSettings) {
    for (const alert of ALERTS) {
      if (!settings[alert.alertToggle]) continue
      if (settings[alert.field] !== padded) continue

      const subs = await PushSubscription.find({ projeto_id: settings.projeto_id }).distinct('username')
      await Promise.allSettled(
        subs.map(u =>
          sendPushToUser(u, {
            title: 'Lembrete de Ponto · FiberOps',
            body:  alert.msg,
            url:   '/ponto',
            tag:   'fiberops-ponto',
          })
        )
      )
      sent.push({ projeto_id: settings.projeto_id, alert: alert.field, users: subs.length })
    }
  }

  return NextResponse.json({ ok: true, time: padded, sent })
}
