'use server'

import { connectDB }            from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { UserAlarmSettings }    from '@/models/UserAlarmSettings'

const PONTO_ROLES = ['admin', 'tecnico', 'noc', 'recepcao']

/**
 * Retorna as preferências de despertador do usuário logado.
 * Retorna null se ainda não configurou.
 */
export async function getUserAlarms() {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username } = session.user

  await connectDB()

  const doc = await UserAlarmSettings.findOne({ username }).lean()
  return doc?.alarms ?? null
}

/**
 * Salva as preferências de despertador do usuário no banco.
 * Chamado sempre que o usuário altera um alarme na aba Despertadores.
 *
 * @param {{ entrada, almoco_inicio, almoco_fim, saida }} alarms
 */
export async function saveUserAlarms(alarms) {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user

  if (!alarms || typeof alarms !== 'object') return { error: 'Payload inválido' }

  // Normaliza — só persiste os campos conhecidos, ignora o resto
  const safe = {}
  for (const key of ['entrada', 'almoco_inicio', 'almoco_fim', 'saida']) {
    const v = alarms[key]
    if (!v) continue
    safe[key] = {
      enabled: Boolean(v.enabled),
      time:    typeof v.time === 'string' && /^\d{2}:\d{2}$/.test(v.time) ? v.time : '08:00',
    }
  }

  await connectDB()

  await UserAlarmSettings.findOneAndUpdate(
    { username },
    { $set: { username, projeto_id, alarms: safe } },
    { upsert: true, new: true }
  )

  return { ok: true }
}
