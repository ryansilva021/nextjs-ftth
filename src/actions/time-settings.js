'use server'

import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { TimeSettings } from '@/models/TimeSettings'
import { revalidatePath } from 'next/cache'

const ADMIN_ROLES  = ['superadmin', 'admin']
const ALL_PONTO    = ['superadmin', 'admin', 'tecnico', 'noc', 'recepcao']

// ---------------------------------------------------------------------------
// getTimeSettings — qualquer usuário com acesso ao ponto pode buscar
// ---------------------------------------------------------------------------

export async function getTimeSettings() {
  const session = await requireActiveEmpresa(ALL_PONTO)
  const { projeto_id } = session.user

  await connectDB()

  const settings = await TimeSettings.findOne({ projeto_id }).lean()

  // Retorna defaults se não configurado ainda
  return settings
    ? {
        entrada:              settings.entrada,
        almoco_inicio:        settings.almoco_inicio,
        almoco_fim:           settings.almoco_fim,
        saida:                settings.saida,
        alerta_entrada:       settings.alerta_entrada,
        alerta_almoco_inicio: settings.alerta_almoco_inicio,
        alerta_almoco_fim:    settings.alerta_almoco_fim,
        alerta_saida:         settings.alerta_saida,
      }
    : {
        entrada:              '08:00',
        almoco_inicio:        '12:00',
        almoco_fim:           '13:00',
        saida:                '18:00',
        alerta_entrada:       true,
        alerta_almoco_inicio: true,
        alerta_almoco_fim:    true,
        alerta_saida:         true,
      }
}

// ---------------------------------------------------------------------------
// saveTimeSettings — somente admin
// ---------------------------------------------------------------------------

export async function saveTimeSettings(data) {
  const session = await requireActiveEmpresa(ADMIN_ROLES)
  const { projeto_id } = session.user

  const {
    entrada, almoco_inicio, almoco_fim, saida,
    alerta_entrada, alerta_almoco_inicio, alerta_almoco_fim, alerta_saida,
  } = data ?? {}

  // Valida formato HH:mm
  const timeRe = /^\d{2}:\d{2}$/
  for (const [key, val] of Object.entries({ entrada, almoco_inicio, almoco_fim, saida })) {
    if (val && !timeRe.test(val)) {
      return { error: `Horário inválido: ${key}` }
    }
  }

  await connectDB()

  await TimeSettings.findOneAndUpdate(
    { projeto_id },
    {
      $set: {
        projeto_id,
        entrada:              entrada       ?? '08:00',
        almoco_inicio:        almoco_inicio ?? '12:00',
        almoco_fim:           almoco_fim    ?? '13:00',
        saida:                saida         ?? '18:00',
        alerta_entrada:       alerta_entrada       ?? true,
        alerta_almoco_inicio: alerta_almoco_inicio ?? true,
        alerta_almoco_fim:    alerta_almoco_fim    ?? true,
        alerta_saida:         alerta_saida         ?? true,
      },
    },
    { upsert: true, new: true }
  )

  revalidatePath('/configuracoes/ponto')
  return { ok: true }
}
