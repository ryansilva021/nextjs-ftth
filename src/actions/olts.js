/**
 * src/actions/olts.js
 * Server Actions para OLTs (Optical Line Terminals).
 *
 * Mapeamento de endpoints:
 *   GET    /api/olts                    → getOLTs(projetoId)
 *   POST   /api/olts (upsert)          → upsertOLT(data)
 *   POST   /api/olts (delete)          → deleteOLT(oltId, projetoId)
 *   GET    /api/topologia              → getTopologia(projetoId)
 *   POST   /api/link_topologia         → linkTopologia(data)
 */

'use server'

import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/db'
import { WRITE_ROLES, ALL_ROLES } from '@/lib/auth'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { OLT } from '@/models/OLT'
import { Topologia } from '@/models/Topologia'
import { CaixaEmendaCDO } from '@/models/CaixaEmendaCDO'
import { CTO } from '@/models/CTO'

// ---------------------------------------------------------------------------
// GET /api/olts → getOLTs
// ---------------------------------------------------------------------------

/**
 * Lista todas as OLTs do projeto.
 * Requer: qualquer usuário autenticado com empresa ativa.
 *
 * @param {string} projetoId
 * @returns {Promise<Array>}
 */
export async function getOLTs(projetoId) {
  const session = await requireActiveEmpresa(ALL_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const olts = await OLT.find({ projeto_id: targetProjeto }).lean()
  return olts.map((o) => ({ ...o, _id: o._id.toString() }))
}

// ---------------------------------------------------------------------------
// POST /api/olts (upsert) → upsertOLT
// ---------------------------------------------------------------------------

/**
 * Cria ou atualiza uma OLT.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.olt_id        — identificador único (obrigatório)
 * @param {string} data.projeto_id
 * @param {number} data.lat           — obrigatório
 * @param {number} data.lng           — obrigatório
 * @param {string} [data.nome]
 * @param {string} [data.modelo]
 * @param {number} [data.portas_pon]  — número de portas PON
 * @param {string} [data.ip]
 * @returns {Promise<Object>}
 */
export async function upsertOLT(data) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  const { olt_id, projeto_id, lat, lng, nome, modelo, portas_pon, ip, status } = data ?? {}

  if (!olt_id?.trim()) throw new Error('olt_id é obrigatório')
  if (!nome?.trim())   throw new Error('nome é obrigatório')

  const targetProjeto = role === 'superadmin' ? projeto_id : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const update = {
    nome:       nome.trim(),
    lat:        lat != null ? Number(lat) : null,
    lng:        lng != null ? Number(lng) : null,
    modelo:     modelo?.trim()  ?? null,
    capacidade: portas_pon != null ? Number(portas_pon) : (data?.capacidade != null ? Number(data.capacidade) : 16),
    ip:         ip?.trim()      ?? null,
    status:     status          ?? 'ativo',
  }

  const olt = await OLT.findOneAndUpdate(
    { projeto_id: targetProjeto, id: olt_id.trim() },
    { $set: { ...update, id: olt_id.trim() } },
    { upsert: true, new: true }
  ).lean()

  revalidatePath('/')
  revalidatePath('/admin/olts')
  revalidatePath('/admin/campo')
  revalidatePath('/admin/diagramas')

  return { ...olt, _id: olt._id.toString() }
}

// ---------------------------------------------------------------------------
// POST /api/olts (delete) → deleteOLT
// ---------------------------------------------------------------------------

/**
 * Remove uma OLT pelo olt_id.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {string} oltId
 * @param {string} projetoId
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteOLT(oltId, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  if (!oltId) throw new Error('olt_id é obrigatório')

  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const result = await OLT.deleteOne({ projeto_id: targetProjeto, id: oltId })

  revalidatePath('/')
  revalidatePath('/admin/olts')
  revalidatePath('/admin/campo')
  revalidatePath('/admin/diagramas')

  return { deleted: result.deletedCount > 0 }
}

// ---------------------------------------------------------------------------
// POST /api/olts (dio) → saveOLTDio
// ---------------------------------------------------------------------------

/**
 * Salva o mapa DIO de uma OLT (dio_config: { total, mapa }).
 *
 * @param {string} oltId
 * @param {string} projetoId
 * @param {Object} dioConfig  — { total: number, mapa: [{porta, pon, local}] }
 * @returns {Promise<{ saved: boolean }>}
 */
export async function saveOLTDio(oltId, projetoId, dioConfig) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  if (!oltId) throw new Error('olt_id é obrigatório')

  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const result = await OLT.updateOne(
    { projeto_id: targetProjeto, id: oltId },
    { $set: { dio_config: dioConfig } }
  )

  revalidatePath('/admin/diagramas')
  revalidatePath('/admin/topologia')
  revalidatePath('/admin/calculos')

  return { saved: result.modifiedCount > 0, matched: result.matchedCount > 0 }
}

// ---------------------------------------------------------------------------
// GET /api/topologia → getTopologia
// ---------------------------------------------------------------------------

/**
 * Retorna a árvore de topologia: OLT → CE/CDO → CTOs.
 * Requer: qualquer usuário autenticado com empresa ativa.
 *
 * @param {string} projetoId
 * @returns {Promise<Array>}  — array de OLTs com filhos aninhados
 */
export async function getTopologia(projetoId) {
  const session = await requireActiveEmpresa(ALL_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  // Busca todos os elementos em paralelo
  const [olts, caixas, ctos] = await Promise.all([
    OLT.find({ projeto_id: targetProjeto }).lean(),
    CaixaEmendaCDO.find({ projeto_id: targetProjeto }).lean(),
    CTO.find({ projeto_id: targetProjeto }, 'cto_id nome cdo_id porta_cdo splitter_cto capacidade diagrama').lean(),
  ])

  // Calcula ocupação para cada CTO (novo formato ou legado)
  function calcOcupacaoCTO(cto) {
    if (cto.diagrama?.splitters?.length) {
      return cto.diagrama.splitters.reduce((s, sp) =>
        s + (sp.saidas ?? []).filter(sd => sd?.cliente?.trim()).length, 0)
    }
    if (cto.diagrama?.portas) {
      return Object.values(cto.diagrama.portas).filter(p => p?.cliente).length
    }
    return 0
  }

  // Monta a árvore em memória
  // cto.cdo_id deve ser igual a caixa.id (CDO usa campo "id")
  const ctosPorCaixa = {}
  for (const cto of ctos) {
    if (cto.cdo_id) {
      ctosPorCaixa[cto.cdo_id] = ctosPorCaixa[cto.cdo_id] ?? []
      ctosPorCaixa[cto.cdo_id].push({
        ...cto,
        _id:     cto._id.toString(),
        ocupacao: calcOcupacaoCTO(cto),
      })
    }
  }

  // caixa.olt_id deve ser igual a olt.id (OLT usa campo "id")
  const caixasPorOLT = {}
  for (const caixa of caixas) {
    if (caixa.olt_id) {
      caixasPorOLT[caixa.olt_id] = caixasPorOLT[caixa.olt_id] ?? []
      caixasPorOLT[caixa.olt_id].push({
        ...caixa,
        _id:  caixa._id.toString(),
        ctos: ctosPorCaixa[caixa.id] ?? [],   // caixa.id = identificador único do CDO
      })
    }
  }

  // Flat list of ALL caixas for cascade CDO lookups (cdo_pai_id links)
  const allCaixasFlat = caixas.map(c => ({
    ...c,
    _id:  c._id.toString(),
    ctos: ctosPorCaixa[c.id] ?? [],
  }))

  // Flat list of ALL CTOs for cascade CTO lookups
  const allCTOsFlat = ctos.map(c => ({
    ...c,
    _id:     c._id.toString(),
    ocupacao: calcOcupacaoCTO(c),
  }))

  // olt.id = identificador único da OLT (campo "id" do schema, não olt_id virtual)
  return olts.map((olt, i) => ({
    ...olt,
    _id:    olt._id.toString(),
    caixas: caixasPorOLT[olt.id] ?? [],
    // Attach full caixa/cto lists to first OLT only (for cascade lookups in buildGraphData)
    ...(i === 0 ? { _allCaixas: allCaixasFlat, _allCTOs: allCTOsFlat } : {}),
  }))
}

// ---------------------------------------------------------------------------
// POST /api/link_topologia → linkTopologia
// ---------------------------------------------------------------------------

/**
 * Vincula dois elementos da topologia (ex: CDO → OLT, CTO → CDO).
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.projeto_id
 * @param {string} data.tipo_origem   — 'cto' | 'cdo' | 'ce'
 * @param {string} data.id_origem     — ID do elemento filho
 * @param {string} data.tipo_destino  — 'cdo' | 'ce' | 'olt'
 * @param {string} data.id_destino    — ID do elemento pai
 * @param {number} [data.porta]       — porta no elemento pai
 * @returns {Promise<{ linked: boolean }>}
 */
export async function linkTopologia(data) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  const { projeto_id, tipo_origem, id_origem, tipo_destino, id_destino, porta } = data ?? {}

  if (!tipo_origem || !id_origem || !tipo_destino || !id_destino) {
    throw new Error('tipo_origem, id_origem, tipo_destino e id_destino são obrigatórios')
  }

  const targetProjeto = role === 'superadmin' ? projeto_id : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  // Aplica o vínculo no modelo correto
  if (tipo_origem === 'cto') {
    await CTO.updateOne(
      { projeto_id: targetProjeto, cto_id: id_origem },
      { $set: { cdo_id: id_destino, porta_cdo: porta ?? null } }
    )
  } else if (tipo_origem === 'cdo' || tipo_origem === 'ce') {
    await CaixaEmendaCDO.updateOne(
      { projeto_id: targetProjeto, ce_id: id_origem },
      { $set: { olt_id: id_destino, porta_olt: porta ?? null } }
    )
  } else {
    throw new Error(`tipo_origem inválido: ${tipo_origem}`)
  }

  // Registra o link na coleção de topologia para histórico
  await Topologia.findOneAndUpdate(
    { projeto_id: targetProjeto, tipo_origem, id_origem },
    { $set: { tipo_destino, id_destino, porta, updated_at: new Date() } },
    { upsert: true }
  )

  revalidatePath('/')
  revalidatePath('/admin/topologia')

  return { linked: true }
}
