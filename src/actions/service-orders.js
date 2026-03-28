/**
 * src/actions/service-orders.js
 * Server Actions para Ordens de Serviço (OS).
 *
 * RBAC:
 *   superadmin / admin  → CRUD completo
 *   noc                 → leitura
 *   tecnico             → criar, atualizar status/campos, concluir
 *   comercial           → criar
 */

'use server'

import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { ALL_ROLES, WRITE_ROLES } from '@/lib/auth'
import { ServiceOrder } from '@/models/ServiceOrder'

// Pode executar/atualizar OS (técnicos de campo)
const TECNICO_UP   = ['superadmin', 'admin', 'tecnico']
// Pode criar OS (técnicos + recepção)
const COMERCIAL_UP = ['superadmin', 'admin', 'tecnico', 'recepcao']
// Pode ver OS (todos os roles com view_service_orders)
const OS_VIEW      = ['superadmin', 'admin', 'tecnico', 'noc', 'recepcao']

// ---------------------------------------------------------------------------
// listOS
// ---------------------------------------------------------------------------

export async function listOS({ status, tipo, tecnico_id, limit = 100, skip = 0 } = {}) {
  const session = await requireActiveEmpresa(OS_VIEW)
  const { role, projeto_id: userProjeto } = session.user

  await connectDB()

  const filter = { projeto_id: userProjeto }
  if (status) filter.status = status
  if (tipo)   filter.tipo = tipo
  if (tecnico_id) filter.tecnico_id = tecnico_id

  const [items, total] = await Promise.all([
    ServiceOrder.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ServiceOrder.countDocuments(filter),
  ])

  return {
    items: items.map(s => ({ ...s, _id: s._id.toString() })),
    total,
  }
}

// ---------------------------------------------------------------------------
// getOS
// ---------------------------------------------------------------------------

export async function getOS(osId) {
  const session = await requireActiveEmpresa(OS_VIEW)
  const { projeto_id } = session.user

  await connectDB()

  const os = await ServiceOrder.findOne({ projeto_id, os_id: osId }).lean()
  if (!os) throw new Error('OS não encontrada')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// createOS
// ---------------------------------------------------------------------------

export async function createOS(data) {
  const session = await requireActiveEmpresa(COMERCIAL_UP)
  const { projeto_id, name } = session.user

  if (!data?.tipo) throw new Error('tipo é obrigatório')
  if (!data?.cliente_nome?.trim()) throw new Error('cliente_nome é obrigatório')

  await connectDB()

  const os = await ServiceOrder.create({
    projeto_id,
    tipo:             data.tipo,
    status:           'aberta',
    prioridade:       data.prioridade ?? 'normal',
    cliente_nome:     data.cliente_nome?.trim(),
    cliente_contato:  data.cliente_contato?.trim() ?? null,
    cliente_endereco: data.cliente_endereco?.trim() ?? null,
    tecnico_nome:     data.tecnico_nome?.trim() ?? null,
    tecnico_id:       data.tecnico_id?.trim() ?? null,
    auxiliar_nome:    data.auxiliar_nome?.trim() ?? null,
    auxiliar_id:      data.auxiliar_id?.trim() ?? null,
    olt_id:           data.olt_id ?? null,
    pon:              data.pon ?? null,
    cto_id:           data.cto_id ?? null,
    porta_cto:        data.porta_cto != null ? Number(data.porta_cto) : null,
    onu_serial:       data.onu_serial?.trim() ?? null,
    descricao:        data.descricao?.trim() ?? null,
    data_agendamento: data.data_agendamento ? new Date(data.data_agendamento) : null,
    criado_por:       name ?? session.user.email ?? null,
  })

  revalidatePath('/admin/os')
  return { ...os.toObject(), _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// updateOSStatus
// ---------------------------------------------------------------------------

export async function updateOSStatus(osId, novoStatus, obs = null) {
  const session = await requireActiveEmpresa(TECNICO_UP)
  const { projeto_id } = session.user

  const VALID = ['aberta', 'agendada', 'em_andamento', 'concluida', 'cancelada']
  if (!VALID.includes(novoStatus)) throw new Error('Status inválido')

  await connectDB()

  const update = { status: novoStatus }
  if (obs) update.obs_tecnico = obs
  if (novoStatus === 'em_andamento') update.data_execucao = new Date()
  if (novoStatus === 'concluida' || novoStatus === 'cancelada') update.data_fechamento = new Date()

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    { $set: update },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// updateOSFields
// ---------------------------------------------------------------------------

export async function updateOSFields(osId, fields) {
  const session = await requireActiveEmpresa(TECNICO_UP)
  const { projeto_id } = session.user

  const allowed = [
    'tecnico_nome', 'tecnico_id', 'auxiliar_nome', 'auxiliar_id',
    'olt_id', 'pon', 'cto_id', 'porta_cto',
    'onu_serial', 'descricao', 'obs_tecnico', 'resultado',
    'rx_power', 'tx_power', 'data_agendamento', 'prioridade',
    'cliente_nome', 'cliente_contato', 'cliente_endereco',
  ]

  const safe = {}
  for (const k of allowed) {
    if (k in fields) safe[k] = fields[k]
  }

  if (Object.keys(safe).length === 0) throw new Error('Nenhum campo válido para atualizar')

  await connectDB()

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    { $set: safe },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// concludeInstallation — conclui + provisiona ONU automaticamente
// ---------------------------------------------------------------------------

export async function concludeInstallation(osId, { serial, cliente, oltId, ponPort, ctoId, rx_power, tx_power, obs_tecnico }) {
  const session = await requireActiveEmpresa(TECNICO_UP)
  const { projeto_id } = session.user

  if (!serial?.trim()) throw new Error('serial da ONU é obrigatório')

  await connectDB()

  // Provisiona a ONU
  let provResult = null
  try {
    const { manualProvision } = await import('@/actions/provisioning')
    provResult = await manualProvision({
      serial: serial.trim(),
      cliente,
      oltId,
      ponPort,
      ctoId,
    })
  } catch (e) {
    throw new Error(`Falha ao provisionar ONU: ${e.message}`)
  }

  // Conclui a OS
  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    {
      $set: {
        status:         'concluida',
        data_fechamento: new Date(),
        data_execucao:  new Date(),
        onu_serial:     serial.trim(),
        olt_id:         oltId ?? null,
        pon:            ponPort ?? null,
        cto_id:         ctoId ?? null,
        rx_power:       rx_power != null ? Number(rx_power) : null,
        tx_power:       tx_power != null ? Number(tx_power) : null,
        obs_tecnico:    obs_tecnico?.trim() ?? null,
        resultado:      'ONU provisionada com sucesso',
      },
    },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  revalidatePath('/admin/noc')
  return { os: { ...os, _id: os._id.toString() }, provResult }
}

// ---------------------------------------------------------------------------
// deleteOS
// ---------------------------------------------------------------------------

export async function deleteOS(osId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { projeto_id } = session.user

  await connectDB()

  const result = await ServiceOrder.deleteOne({ projeto_id, os_id: osId })
  revalidatePath('/admin/os')
  return { deleted: result.deletedCount > 0 }
}

// ---------------------------------------------------------------------------
// getOSStats — dashboard KPIs
// ---------------------------------------------------------------------------

export async function getOSStats() {
  const session = await requireActiveEmpresa(OS_VIEW)
  const { projeto_id } = session.user

  await connectDB()

  const [total, abertas, agendadas, em_andamento, concluidas, canceladas] = await Promise.all([
    ServiceOrder.countDocuments({ projeto_id }),
    ServiceOrder.countDocuments({ projeto_id, status: 'aberta' }),
    ServiceOrder.countDocuments({ projeto_id, status: 'agendada' }),
    ServiceOrder.countDocuments({ projeto_id, status: 'em_andamento' }),
    ServiceOrder.countDocuments({ projeto_id, status: 'concluida' }),
    ServiceOrder.countDocuments({ projeto_id, status: 'cancelada' }),
  ])

  // Count by tipo
  const byTipo = await ServiceOrder.aggregate([
    { $match: { projeto_id } },
    { $group: { _id: '$tipo', count: { $sum: 1 } } },
  ])

  return { total, abertas, agendadas, em_andamento, concluidas, canceladas, byTipo }
}
