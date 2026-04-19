/**
 * src/actions/config.js
 * Server Actions para configurações globais do sistema.
 */

'use server'

import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { SystemConfig, getOrCreateConfig, FIBER_COLOR_DEFAULTS } from '@/models/SystemConfig'

const ADMIN_ROLES = ['superadmin', 'admin']

// ─── Ler config ────────────────────────────────────────────────────────────────

export async function getSystemConfig() {
  const session = await requireActiveEmpresa(ADMIN_ROLES)
  const { projeto_id } = session.user
  await connectDB()
  const cfg = await getOrCreateConfig(projeto_id)
  return JSON.parse(JSON.stringify(cfg))
}

// ─── Atualizar config geral ────────────────────────────────────────────────────

export async function updateSystemConfig(fields) {
  const session = await requireActiveEmpresa(ADMIN_ROLES)
  const { projeto_id } = session.user

  // Campos permitidos (whitelist para evitar injeção de campos sensíveis)
  const allowed = [
    'nome_empresa', 'logo_url', 'timezone',
    'notif_nova_os', 'notif_status_os', 'notif_ponto',
    'os_prazo_horas', 'os_tipos_ativos',
    'mapa_lat_default', 'mapa_lng_default', 'mapa_zoom_default',
  ]

  const update = {}
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key]
  }

  await connectDB()
  await SystemConfig.findOneAndUpdate(
    { projeto_id },
    { $set: update },
    { upsert: true, new: true },
  )

  revalidatePath('/admin/configuracoes')
  return { ok: true }
}

// ─── Atualizar cores de fibra ──────────────────────────────────────────────────

export async function updateFiberColors({ padrao, cores }) {
  const session = await requireActiveEmpresa(ADMIN_ROLES)
  const { projeto_id } = session.user

  if (!['brasil', 'eua', 'personalizado'].includes(padrao)) {
    return { error: 'Padrão inválido.' }
  }

  // Ao trocar para padrão pré-definido, substitui pelas cores do padrão
  const coresFinais = padrao !== 'personalizado'
    ? FIBER_COLOR_DEFAULTS[padrao]
    : (cores ?? [])

  // Valida formato das cores personalizadas
  if (padrao === 'personalizado') {
    for (const c of coresFinais) {
      if (!c.posicao || !c.nome || !/^#[0-9a-fA-F]{6}$/.test(c.hex)) {
        return { error: `Cor inválida na posição ${c.posicao}: hex deve ser #RRGGBB.` }
      }
    }
  }

  await connectDB()
  await SystemConfig.findOneAndUpdate(
    { projeto_id },
    { $set: { padrao_fibra: padrao, cores_fibra: coresFinais } },
    { upsert: true, new: true },
  )

  revalidatePath('/admin/configuracoes')
  return { ok: true }
}

// ─── Ler cores de fibra (para mapa/topologia — sem auth de admin) ──────────────

export async function getFiberColors(projeto_id) {
  await connectDB()
  const cfg = await SystemConfig.findOne({ projeto_id }, 'cores_fibra padrao_fibra').lean()
  return cfg?.cores_fibra ?? FIBER_COLOR_DEFAULTS.brasil
}
