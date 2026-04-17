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
import osEmitter from '@/lib/os-events'

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
  const { role, projeto_id: userProjeto, username } = session.user

  await connectDB()

  const filter = { projeto_id: userProjeto }
  if (status) filter.status = status
  if (tipo)   filter.tipo = tipo
  // Técnico de campo vê apenas suas próprias OS
  if (role === 'tecnico') {
    filter.tecnico_id = username
  } else if (tecnico_id) {
    filter.tecnico_id = tecnico_id
  }

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
// getMinhasOS — OS criadas pelo usuário logado (admin/recepcao/noc)
// ---------------------------------------------------------------------------

const ROLES_MINHAS_OS = ['admin', 'recepcao', 'noc']

export async function getMinhasOS({ filtro = 'todas' } = {}) {
  const session = await requireActiveEmpresa(ROLES_MINHAS_OS)
  const { projeto_id, name, username } = session.user

  await connectDB()

  const agora = new Date()
  const hoje  = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const amanha = new Date(hoje.getTime() + 86_400_000)

  // criado_por pode ser o name ou o username dependendo do cadastro
  const filter = {
    projeto_id,
    $or: [{ criado_por: name }, { criado_por: username }],
  }

  if (filtro === 'hoje') {
    filter.data_abertura = { $gte: hoje, $lt: amanha }
  } else if (filtro === 'atrasadas') {
    filter.data_agendamento = { $lt: agora }
    filter.status = { $nin: ['concluida', 'cancelada'] }
  } else if (filtro === 'finalizadas') {
    filter.status = { $in: ['concluida', 'cancelada'] }
  }

  const items = await ServiceOrder.find(filter)
    .sort({ created_at: -1 })
    .limit(50)
    .select('os_id tipo status prioridade cliente_nome tecnico_nome data_abertura data_agendamento')
    .lean()

  return items.map(s => ({ ...s, _id: s._id.toString() }))
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
    conexao: {
      login:     data.conexao_login?.trim()    ?? null,
      senha:     data.conexao_senha?.trim()    ?? null,
      ip:        data.conexao_ip?.trim()       ?? null,
      mac:       data.conexao_mac?.trim()      ?? null,
      onu_id:    data.conexao_onu_id?.trim()   ?? null,
      slot:      null,
      pon_porta: null,
      status:    null,
    },
    plano: {
      nome:     data.plano_nome?.trim()     ?? null,
      download: data.plano_download?.trim() ?? null,
      upload:   data.plano_upload?.trim()   ?? null,
    },
  })

  revalidatePath('/admin/os')

  // Broadcast real-time notification to SSE clients in the same project.
  // tecnico_id / auxiliar_id are included so the SSE route can filter
  // delivery per-technician (técnicos only receive their own OS).
  const osObj = os.toObject()

  const ssePayload = {
    projeto_id,
    os_id:            osObj.os_id,
    cliente_nome:     osObj.cliente_nome,
    cliente_endereco: osObj.cliente_endereco ?? null,
    tipo:             osObj.tipo,
    status:           osObj.status,
    tecnico_id:       osObj.tecnico_id ?? null,
    auxiliar_id:      osObj.auxiliar_id ?? null,
    criado_em:        osObj.data_abertura?.toISOString() ?? new Date().toISOString(),
  }
  osEmitter.emit('nova-os', ssePayload)

  // Web Push — notifica fora do app (dispositivos com SW registrado)
  const TIPO_LABEL = {
    instalacao: 'Instalação', manutencao: 'Manutenção',
    suporte: 'Suporte', cancelamento: 'Cancelamento',
  }
  const pushTitle = `Nova OS · ${TIPO_LABEL[osObj.tipo] ?? osObj.tipo}`
  const pushBody  = osObj.cliente_endereco
    ? `${osObj.cliente_nome} — ${osObj.cliente_endereco}`
    : osObj.cliente_nome
  const pushUrl   = `/admin/os`

  // Importação dinâmica para não impactar o bundle em ambientes sem Node crypto
  try {
    const { sendPushToUser } = await import('@/lib/webpush')
    const targets = [osObj.tecnico_id, osObj.auxiliar_id].filter(Boolean)
    console.log('[createOS] push targets:', targets)
    if (targets.length === 0) {
      console.log('[createOS] nenhum tecnico_id definido — push ignorado')
    }
    const results = await Promise.allSettled(
      targets.map(uid => sendPushToUser(uid, { title: pushTitle, body: pushBody, url: pushUrl }))
    )
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[createOS] push falhou para ${targets[i]}:`, r.reason)
    })
  } catch (err) {
    console.error('[createOS] erro no bloco push:', err)
  }

  return { ...osObj, _id: os._id.toString() }
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

// ---------------------------------------------------------------------------
// addMaterial
// ---------------------------------------------------------------------------

export async function addMaterial(osId, { nome, quantidade = 1, tipo = 'OS', valor = null, produto_id = null }) {
  const session = await requireActiveEmpresa(TECNICO_UP)
  const { projeto_id, name, id } = session.user

  if (!nome?.trim()) throw new Error('nome do material é obrigatório')

  await connectDB()

  const material = {
    produto_id: produto_id ?? null,
    nome:       nome.trim(),
    quantidade: Number(quantidade) || 1,
    tipo:       ['OS', 'COMODATO'].includes(tipo) ? tipo : 'OS',
    valor:      valor != null ? Number(valor) : null,
  }

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    {
      $push: {
        materiais: material,
        historico: {
          usuario_id:   id ?? null,
          usuario_nome: name ?? null,
          acao:         `Material adicionado: ${material.nome} (${material.quantidade}x)`,
          timestamp:    new Date(),
        },
      },
    },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// removeMaterial
// ---------------------------------------------------------------------------

export async function removeMaterial(osId, materialId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { projeto_id, name, id } = session.user

  await connectDB()

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    {
      $pull: { materiais: { _id: materialId } },
      $push: {
        historico: {
          usuario_id:   id ?? null,
          usuario_nome: name ?? null,
          acao:         'Material removido da OS',
          timestamp:    new Date(),
        },
      },
    },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// addHistorico — helper interno e exportado
// ---------------------------------------------------------------------------

export async function addHistorico(osId, acao) {
  const session = await requireActiveEmpresa(OS_VIEW)
  const { projeto_id, name, id } = session.user

  if (!acao?.trim()) throw new Error('ação é obrigatória')

  await connectDB()

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    {
      $push: {
        historico: {
          usuario_id:   id ?? null,
          usuario_nome: name ?? null,
          acao:         acao.trim(),
          timestamp:    new Date(),
        },
      },
    },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// updateConexao
// ---------------------------------------------------------------------------

export async function updateConexao(osId, conexaoFields) {
  const session = await requireActiveEmpresa(TECNICO_UP)
  const { projeto_id, name, id } = session.user

  const allowed = ['login', 'senha', 'ip', 'mac', 'onu_id', 'slot', 'pon_porta', 'status']
  const safe = {}

  for (const k of allowed) {
    if (k in conexaoFields) {
      safe[`conexao.${k}`] = conexaoFields[k]
    }
  }

  if (Object.keys(safe).length === 0) throw new Error('Nenhum campo de conexão válido')

  await connectDB()

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    {
      $set: safe,
      $push: {
        historico: {
          usuario_id:   id ?? null,
          usuario_nome: name ?? null,
          acao:         'Dados de conexão atualizados',
          timestamp:    new Date(),
        },
      },
    },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// updatePlano
// ---------------------------------------------------------------------------

export async function updatePlano(osId, planoFields) {
  const session = await requireActiveEmpresa(TECNICO_UP)
  const { projeto_id, name, id } = session.user

  const allowed = ['nome', 'download', 'upload']
  const safe = {}

  for (const k of allowed) {
    if (k in planoFields) {
      safe[`plano.${k}`] = planoFields[k]
    }
  }

  if (Object.keys(safe).length === 0) throw new Error('Nenhum campo de plano válido')

  await connectDB()

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    {
      $set: safe,
      $push: {
        historico: {
          usuario_id:   id ?? null,
          usuario_nome: name ?? null,
          acao:         'Dados do plano atualizados',
          timestamp:    new Date(),
        },
      },
    },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// updateLocalizacao
// ---------------------------------------------------------------------------

export async function updateLocalizacao(osId, { lat, lng }) {
  const session = await requireActiveEmpresa(TECNICO_UP)
  const { projeto_id, name, id } = session.user

  if (lat == null || lng == null) throw new Error('lat e lng são obrigatórios')

  await connectDB()

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    {
      $set: {
        'localizacao.lat': Number(lat),
        'localizacao.lng': Number(lng),
      },
      $push: {
        historico: {
          usuario_id:   id ?? null,
          usuario_nome: name ?? null,
          acao:         `Localização atualizada: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`,
          timestamp:    new Date(),
        },
      },
    },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// addFoto
// ---------------------------------------------------------------------------

export async function addFoto(osId, { nome, url, tamanho = null }) {
  const session = await requireActiveEmpresa(TECNICO_UP)
  const { projeto_id, name, id } = session.user

  if (!url) throw new Error('url da foto é obrigatória')

  await connectDB()

  const foto = {
    nome:      nome ?? 'foto',
    url,
    tamanho:   tamanho != null ? Number(tamanho) : null,
    criado_em: new Date(),
  }

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    {
      $push: {
        fotos: foto,
        historico: {
          usuario_id:   id ?? null,
          usuario_nome: name ?? null,
          acao:         `Foto adicionada: ${foto.nome}`,
          timestamp:    new Date(),
        },
      },
    },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// removeFoto
// ---------------------------------------------------------------------------

export async function removeFoto(osId, fotoId) {
  const session = await requireActiveEmpresa(TECNICO_UP)
  const { projeto_id, name, id } = session.user

  await connectDB()

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    {
      $pull: { fotos: { _id: fotoId } },
      $push: {
        historico: {
          usuario_id:   id ?? null,
          usuario_nome: name ?? null,
          acao:         'Foto removida da OS',
          timestamp:    new Date(),
        },
      },
    },
    { new: true }
  ).lean()

  if (!os) throw new Error('OS não encontrada')

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// simularStatusConexao — alterna conexao.status ONLINE/OFFLINE (demo)
// ---------------------------------------------------------------------------

export async function simularStatusConexao(osId) {
  const session = await requireActiveEmpresa(OS_VIEW)
  const { projeto_id } = session.user

  await connectDB()

  const current = await ServiceOrder.findOne({ projeto_id, os_id: osId }, 'conexao.status').lean()
  if (!current) throw new Error('OS não encontrada')

  const novoStatus = current.conexao?.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE'

  const os = await ServiceOrder.findOneAndUpdate(
    { projeto_id, os_id: osId },
    { $set: { 'conexao.status': novoStatus } },
    { new: true }
  ).lean()

  revalidatePath('/admin/os')
  return { ...os, _id: os._id.toString() }
}

// ---------------------------------------------------------------------------
// reagendarOS — técnico ou admin pode reagendar para data futura
// ---------------------------------------------------------------------------

const REAGENDAR_ROLES = ['superadmin', 'admin', 'tecnico', 'recepcao']

export async function reagendarOS(osId, novaData) {
  const session = await requireActiveEmpresa(REAGENDAR_ROLES)
  const { projeto_id, role, username } = session.user

  if (!novaData || !/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
    return { error: 'Data inválida.' }
  }

  // Não permite datas passadas
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const nova = new Date(novaData + 'T00:00:00')
  if (nova < hoje) return { error: 'Não é possível reagendar para uma data passada.' }

  await connectDB()

  const filter = { projeto_id, os_id: osId }
  if (role === 'tecnico') filter.tecnico_id = username

  const os = await ServiceOrder.findOneAndUpdate(
    filter,
    {
      $set:  { data_agendamento: nova, status: 'agendada' },
      $push: {
        historico: {
          usuario_id:   username,
          usuario_nome: username,
          acao:         `Reagendada para ${nova.toLocaleDateString('pt-BR')}`,
          timestamp:    new Date(),
        },
      },
    },
    { new: true }
  ).lean()

  if (!os) return { error: 'OS não encontrada ou sem permissão.' }

  revalidatePath('/admin/os')
  revalidatePath('/admin/os/minhas')
  return { ok: true, os: { ...os, _id: os._id.toString() } }
}
