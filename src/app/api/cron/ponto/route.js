/**
 * GET /api/cron/ponto
 *
 * Dois tipos de alertas por execução:
 *   1. Lembretes de projeto (TimeSettings) → todos os usuários com push subscription
 *   2. Despertadores pessoais (UserAlarmSettings) → usuário específico
 *
 * CONFIGURAÇÃO RECOMENDADA:
 *   → cron-job.org a cada 1 minuto apontando para /api/cron/ponto
 *   → Header: Authorization: Bearer <CRON_SECRET>
 *
 * vercel.json (fallback para horários padrão):
 *   4 entradas cobrindo 08h, 12h, 13h, 18h BRT
 *
 * Timezone: Brasília (UTC-3). Adicionar campo tz no TimeSettings para multi-fuso.
 */

import { NextResponse }        from 'next/server'
import { connectDB }           from '@/lib/db'
import { TimeSettings }        from '@/models/TimeSettings'
import { PushSubscription }    from '@/models/PushSubscription'
import { UserAlarmSettings }   from '@/models/UserAlarmSettings'
import { sendPushToUser }      from '@/lib/webpush'

export const runtime = 'nodejs'

const ALARM_LABELS = {
  entrada:       '⏰ Hora de iniciar sua jornada!',
  almoco_inicio: '🍽 Hora de ir para o almoço!',
  almoco_fim:    '▶ Hora de retornar do almoço!',
  saida:         '🔴 Hora de encerrar seu expediente!',
}

const TZ_OFFSET_HOURS = -3

export async function GET(req) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  await connectDB()

  const utcNow = new Date()
  const brtNow = new Date(utcNow.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000)
  const padded = `${String(brtNow.getUTCHours()).padStart(2, '0')}:${String(brtNow.getUTCMinutes()).padStart(2, '0')}`

  const sent = []

  // ── 1. Lembretes de projeto ────────────────────────────────────────────────
  // Envia para todos os usuários com push subscription no projeto
  const allSettings = await TimeSettings.find({}).lean()

  // Rastreia usuários que já receberam push nesta execução (evita duplicar
  // caso o usuário também tenha despertador pessoal no mesmo horário)
  const alreadySentThisRun = new Set()

  for (const settings of allSettings) {
    for (const [key, msg] of Object.entries(ALARM_LABELS)) {
      const toggleKey = `alerta_${key}`
      if (!settings[toggleKey]) continue
      if (settings[key] !== padded) continue

      const usernames = await PushSubscription
        .find({ projeto_id: settings.projeto_id })
        .distinct('username')

      if (!usernames.length) continue

      await Promise.allSettled(
        usernames.map(u =>
          sendPushToUser(u, {
            title: 'Lembrete de Ponto · FiberOps',
            body:  msg,
            url:   '/ponto',
            tag:   `fiberops-ponto-${key}`,
          })
        )
      )

      usernames.forEach(u => alreadySentThisRun.add(`${u}:${key}`))
      sent.push({ type: 'project', projeto_id: settings.projeto_id, alert: key, users: usernames.length, time: padded })
    }
  }

  // ── 2. Despertadores pessoais ──────────────────────────────────────────────
  // Cada usuário pode ter horários diferentes do padrão do projeto
  const personalAlarms = await UserAlarmSettings.find({
    $or: [
      { 'alarms.entrada.enabled': true,       'alarms.entrada.time':       padded },
      { 'alarms.almoco_inicio.enabled': true,  'alarms.almoco_inicio.time': padded },
      { 'alarms.almoco_fim.enabled': true,     'alarms.almoco_fim.time':    padded },
      { 'alarms.saida.enabled': true,          'alarms.saida.time':         padded },
    ],
  }).lean()

  for (const doc of personalAlarms) {
    for (const key of ['entrada', 'almoco_inicio', 'almoco_fim', 'saida']) {
      const cfg = doc.alarms?.[key]
      if (!cfg?.enabled || cfg.time !== padded) continue

      // Pula se o lembrete de projeto já enviou para este usuário+tipo nesta rodada
      if (alreadySentThisRun.has(`${doc.username}:${key}`)) continue

      // Verifica se o usuário tem push subscription
      const hasSub = await PushSubscription.exists({ username: doc.username })
      if (!hasSub) continue

      await sendPushToUser(doc.username, {
        title: 'Despertador · FiberOps',
        body:  ALARM_LABELS[key],
        url:   '/ponto',
        tag:   `fiberops-ponto-${key}`,
      })

      sent.push({ type: 'personal', username: doc.username, alert: key, time: padded })
    }
  }

  return NextResponse.json({
    ok:       true,
    brt_time: padded,
    utc_time: utcNow.toISOString(),
    sent,
  })
}
