'use server'

import { connectDB } from '@/lib/db'
import { OLT } from '@/models/OLT'
import { CaixaEmendaCDO } from '@/models/CaixaEmendaCDO'
import { CTO } from '@/models/CTO'
import { Poste } from '@/models/Poste'
import { LogEvento } from '@/models/LogEvento'
import { ONU } from '@/models/ONU'
import { ProvisionEvent } from '@/models/ProvisionEvent'
import { requireActiveEmpresa } from '@/lib/tenant-guard'

const NOC_ALLOWED = ['superadmin', 'admin', 'noc']

export async function getNOCStats(projetoId) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { role, projeto_id: userProjeto } = session.user
  const pid = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const [olts, totalCDOs, totalCTOs, totalPostes, eventos, onuDocs, pendingCount, ctos] = await Promise.all([
    OLT.find({ projeto_id: pid }, 'id nome ip modelo status capacidade').lean(),
    CaixaEmendaCDO.countDocuments({ projeto_id: pid }),
    CTO.countDocuments({ projeto_id: pid }),
    Poste.countDocuments({ projeto_id: pid }),
    LogEvento.find({ projeto_id: pid }).sort({ ts: -1 }).limit(50).lean(),
    ONU.find({ projeto_id: pid, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).limit(200).lean(),
    ProvisionEvent.countDocuments({ projeto_id: pid, status: { $in: ['pending', 'processing'] } }),
    CTO.find({ projeto_id: pid }, 'cto_id nome cdo_id diagrama').limit(100).lean(),
  ])

  const oltStats = {
    total:      olts.length,
    ativos:     olts.filter((o) => o.status === 'ativo' || !o.status).length,
    inativos:   olts.filter((o) => o.status === 'inativo').length,
    manutencao: olts.filter((o) => o.status === 'em_manutencao').length,
  }

  const onuStats = {
    total:        onuDocs.length,
    active:       onuDocs.filter((o) => o.status === 'active').length,
    offline:      onuDocs.filter((o) => o.status === 'offline').length,
    cancelled:    0,
    provisioning: onuDocs.filter((o) => o.status === 'provisioning').length,
  }



  const ctosWithOccupancy = ctos.map((cto) => {
    const splitters  = cto.diagrama?.splitters ?? []
    const capacidade = splitters.reduce((acc, s) => acc + (s.saidas?.length ?? 0), 0)
    const ocupacao   = splitters.reduce(
      (acc, s) => acc + (s.saidas ?? []).filter((p) => p?.cliente?.trim()).length,
      0
    )
    return {
      cto_id:    cto.cto_id,
      nome:      cto.nome ?? cto.cto_id,
      cdo_id:    cto.cdo_id ?? null,
      capacidade,
      ocupacao,
    }
  })

  const onus = onuDocs.map((o) => ({
    _id:            o._id.toString(),
    serial:         o.serial,
    cliente:        o.cliente ?? null,
    status:         o.status,
    olt_id:         o.olt_id ?? null,
    pon_port:       o.pon_port ?? null,
    cto_id:         o.cto_id ?? null,
    cto_port:       o.cto_port ?? null,
    rx_power:       o.rx_power ?? null,
    tx_power:       o.tx_power ?? null,
    signal_quality: o.signal_quality ?? null,
    provisioned_at: o.provisioned_at ? o.provisioned_at.toISOString() : null,
    createdAt:      o.createdAt ? o.createdAt.toISOString() : null,
  }))

  const alertas = [
    ...onus.filter((o) => o.status === 'offline').map((o) => ({
      tipo: 'onu_offline', serial: o.serial, cliente: o.cliente, cto_id: o.cto_id,
    })),
    ...onus.filter((o) => o.signal_quality === 'critico').map((o) => ({
      tipo: 'sinal_critico', serial: o.serial, cliente: o.cliente, rx_power: o.rx_power,
    })),
    ...ctosWithOccupancy.filter((c) => c.capacidade > 0 && c.ocupacao / c.capacidade >= 0.9).map((c) => ({
      tipo: 'cto_cheia', cto_id: c.cto_id, nome: c.nome, pct: Math.round((c.ocupacao / c.capacidade) * 100),
    })),
  ]

  return {
    olts: olts.map((o) => ({ ...o, _id: o._id?.toString() ?? null })),
    oltStats,
    totalCDOs,
    totalCTOs,
    totalPostes,
    eventos: eventos.map((e) => ({
      _id:       e._id.toString(),
      ts:        e.ts?.toISOString() ?? null,
      user:      e.user,
      role:      e.role,
      action:    e.action,
      entity:    e.entity,
      entity_id: e.entity_id,
      nivel:     e.nivel,
      details:   e.details,
    })),
    onuStats,
    pendingEvents: pendingCount,
    ctos: ctosWithOccupancy,
    onus,
    alertas,
  }
}
