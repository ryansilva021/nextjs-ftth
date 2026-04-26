/**
 * GET /api/mobile/os
 * Lista OS do técnico autenticado, com paginação e filtros.
 * Inclui status de conexão da ONU (online/offline) via ONU.status.
 *
 * Query params:
 *   status  — filtra por status da OS (aberta, agendada, em_andamento, concluida, cancelada)
 *   tipo    — filtra por tipo (instalacao, manutencao, suporte, cancelamento)
 *   page    — página (default 1)
 *   limit   — itens por página (default 20, max 50)
 *   all     — "1" para incluir todas as OS do projeto (admin/noc)
 */

import { connectDB }                            from '@/lib/db'
import { ServiceOrder }                         from '@/models/ServiceOrder'
import { ONU }                                  from '@/models/ONU'
import { verifyMobileToken, extractBearerToken } from '@/lib/mobile-jwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_ROLES = ['superadmin', 'admin', 'noc']

export async function GET(req) {
  try {
    const token = extractBearerToken(req)
    if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 })

    const user = await verifyMobileToken(token)
    if (!user?.projeto_id) return Response.json({ error: 'Projeto não definido' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const status  = searchParams.get('status')  || null
    const tipo    = searchParams.get('tipo')    || null
    const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit   = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const showAll = searchParams.get('all') === '1' && ADMIN_ROLES.includes(user.role)

    await connectDB()

    const query = { projeto_id: user.projeto_id }

    // Técnicos só vêem suas próprias OS; admins podem ver todas
    if (!showAll && !ADMIN_ROLES.includes(user.role)) {
      query.tecnico_id = user.sub
    }

    if (status) query.status = status
    if (tipo)   query.tipo   = tipo

    const total = await ServiceOrder.countDocuments(query)
    const pages = Math.ceil(total / limit)

    const orders = await ServiceOrder.find(query)
      .sort({ data_agendamento: 1, created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select([
        'os_id', 'tipo', 'status', 'prioridade',
        'cliente_nome', 'cliente_contato', 'cliente_endereco',
        'cliente_contrato', 'contrato_status',
        'tecnico_nome', 'tecnico_id',
        'onu_serial', 'conexao',
        'descricao', 'data_agendamento', 'data_abertura',
        'created_at', 'localizacao',
      ])
      .lean()

    // Enrich with ONU online/offline status from OLT
    const serials = orders.map(o => o.onu_serial).filter(Boolean)
    const onus    = serials.length
      ? await ONU.find({ projeto_id: user.projeto_id, serial: { $in: serials } })
          .select('serial status signal_quality rx_power')
          .lean()
      : []

    const onuMap = Object.fromEntries(onus.map(o => [o.serial, o]))

    const now = Date.now()
    const data = orders.map(o => {
      const onu = o.onu_serial ? onuMap[o.onu_serial] : null

      // Online/offline: prefer live ONU status, fallback to conexao.status
      const olt_status = onu
        ? (onu.status === 'active' ? 'ONLINE' : 'OFFLINE')
        : (o.conexao?.status ?? null)

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
        onu_serial:       o.onu_serial       ?? null,
        olt_status,
        signal_quality:   onu?.signal_quality ?? null,
        rx_power:         onu?.rx_power       ?? null,
        descricao:        o.descricao         ?? null,
        data_agendamento: o.data_agendamento  ? o.data_agendamento.toISOString() : null,
        data_abertura:    o.data_abertura     ? o.data_abertura.toISOString()    : null,
        created_at:       o.created_at        ? o.created_at.toISOString()       : null,
        is_atrasada:      isAtrasada,
        localizacao:      o.localizacao?.lat != null ? o.localizacao : null,
      }
    })

    return Response.json({ data, meta: { total, pages, page, limit } })
  } catch (err) {
    console.error('[mobile/os GET]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
