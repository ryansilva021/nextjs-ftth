/**
 * GET  /api/mobile/os/[id]  — detalhe completo de uma OS
 * PATCH /api/mobile/os/[id] — atualiza status e/ou obs_tecnico
 */

import { connectDB }                            from '@/lib/db'
import { ServiceOrder }                         from '@/models/ServiceOrder'
import { ONU }                                  from '@/models/ONU'
import { verifyMobileToken, extractBearerToken } from '@/lib/mobile-jwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_ROLES = ['superadmin', 'admin', 'noc']

async function resolveUser(req) {
  const token = extractBearerToken(req)
  if (!token) return null
  try { return await verifyMobileToken(token) } catch { return null }
}

function serializeOS(o, onu) {
  const olt_status = onu
    ? (onu.status === 'active' ? 'ONLINE' : 'OFFLINE')
    : (o.conexao?.status ?? null)

  const now = Date.now()
  const isAtrasada = o.data_agendamento && new Date(o.data_agendamento).getTime() < now
    && !['concluida', 'cancelada'].includes(o.status)

  return {
    _id:              o._id.toString(),
    os_id:            o.os_id,
    tipo:             o.tipo,
    status:           o.status,
    prioridade:       o.prioridade,
    cliente_nome:     o.cliente_nome     ?? null,
    cliente_contato:  o.cliente_contato  ?? null,
    cliente_endereco: o.cliente_endereco ?? null,
    cliente_contrato: o.cliente_contrato ?? null,
    contrato_status:  o.contrato_status  ?? null,
    tecnico_nome:     o.tecnico_nome     ?? null,
    auxiliar_nome:    o.auxiliar_nome    ?? null,
    onu_serial:       o.onu_serial       ?? null,
    olt_status,
    signal_quality:   onu?.signal_quality ?? null,
    rx_power:         onu?.rx_power       ?? null,
    conexao: {
      login:     o.conexao?.login     ?? null,
      ip:        o.conexao?.ip        ?? null,
      mac:       o.conexao?.mac       ?? null,
      onu_id:    o.conexao?.onu_id    ?? null,
      pon_porta: o.conexao?.pon_porta ?? null,
      slot:      o.conexao?.slot      ?? null,
    },
    plano: {
      nome:     o.plano?.nome     ?? null,
      download: o.plano?.download ?? null,
      upload:   o.plano?.upload   ?? null,
    },
    descricao:        o.descricao        ?? null,
    obs_tecnico:      o.obs_tecnico      ?? null,
    resultado:        o.resultado        ?? null,
    data_agendamento: o.data_agendamento ? o.data_agendamento.toISOString() : null,
    data_abertura:    o.data_abertura    ? o.data_abertura.toISOString()    : null,
    data_execucao:    o.data_execucao    ? o.data_execucao.toISOString()    : null,
    data_fechamento:  o.data_fechamento  ? o.data_fechamento.toISOString()  : null,
    created_at:       o.created_at       ? o.created_at.toISOString()       : null,
    is_atrasada:      isAtrasada,
    localizacao:      o.localizacao?.lat != null ? o.localizacao : null,
    historico: (o.historico ?? []).map(h => ({
      usuario_nome: h.usuario_nome,
      acao:         h.acao,
      timestamp:    h.timestamp ? h.timestamp.toISOString() : null,
    })),
    materiais: (o.materiais ?? []).map(m => ({
      _id:        m._id?.toString(),
      nome:       m.nome,
      quantidade: m.quantidade,
      tipo:       m.tipo,
      valor:      m.valor,
    })),
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req, { params }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  await connectDB()

  const o = await ServiceOrder.findById(params.id).lean()
  if (!o || o.projeto_id !== user.projeto_id) {
    return Response.json({ error: 'OS não encontrada' }, { status: 404 })
  }

  // Only technician assigned to this OS or admins can view it
  if (!ADMIN_ROLES.includes(user.role) && o.tecnico_id !== user.sub) {
    return Response.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const onu = o.onu_serial
    ? await ONU.findOne({ projeto_id: user.projeto_id, serial: o.onu_serial })
        .select('status signal_quality rx_power').lean()
    : null

  return Response.json(serializeOS(o, onu))
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS = {
  aberta:       ['agendada', 'em_andamento', 'cancelada'],
  agendada:     ['em_andamento', 'cancelada'],
  em_andamento: ['concluida', 'cancelada'],
}

export async function PATCH(req, { params }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  let body
  try { body = await req.json() } catch { body = {} }

  await connectDB()

  const o = await ServiceOrder.findById(params.id)
  if (!o || o.projeto_id !== user.projeto_id) {
    return Response.json({ error: 'OS não encontrada' }, { status: 404 })
  }

  if (!ADMIN_ROLES.includes(user.role) && o.tecnico_id !== user.sub) {
    return Response.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const updates = {}

  // Status transition
  if (body.status && body.status !== o.status) {
    const allowed = ALLOWED_TRANSITIONS[o.status] ?? []
    if (!allowed.includes(body.status)) {
      return Response.json({ error: `Transição inválida: ${o.status} → ${body.status}` }, { status: 422 })
    }
    updates.status = body.status
    if (body.status === 'em_andamento') updates.data_execucao   = new Date()
    if (body.status === 'concluida')    updates.data_fechamento = new Date()
    if (body.status === 'cancelada')    updates.data_fechamento = new Date()

    o.historico.push({
      usuario_nome: user.name ?? user.username,
      acao:         `Status alterado para "${body.status}"`,
      timestamp:    new Date(),
    })
  }

  // Technician notes
  if (body.obs_tecnico !== undefined) updates.obs_tecnico = body.obs_tecnico
  if (body.resultado   !== undefined) updates.resultado   = body.resultado
  if (body.rx_power    !== undefined) updates.rx_power    = body.rx_power
  if (body.tx_power    !== undefined) updates.tx_power    = body.tx_power

  Object.assign(o, updates)
  await o.save()

  const onu = o.onu_serial
    ? await ONU.findOne({ projeto_id: user.projeto_id, serial: o.onu_serial })
        .select('status signal_quality rx_power').lean()
    : null

  return Response.json(serializeOS(o.toObject(), onu))
}
