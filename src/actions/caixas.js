/**
 * src/actions/caixas.js
 * Server Actions para Caixas de Emenda / CDO.
 *
 * Mapeamento de endpoints:
 *   GET    /api/caixas_emenda_cdo          → getCaixas(projetoId)
 *   POST   /api/caixas_emenda_cdo (upsert) → upsertCaixa(data)
 *   DELETE /api/caixas_emenda_cdo          → deleteCaixa(caixaId, projetoId)
 *   GET    /api/diagrama?id=               → getDiagramaCaixa(caixaId, projetoId)
 *   POST   /api/diagrama (CE/CDO)          → saveDiagramaCaixa(data)
 */

'use server'

import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/db'
import { WRITE_ROLES, ALL_ROLES } from '@/lib/auth'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { CaixaEmendaCDO } from '@/models/CaixaEmendaCDO'
import { CTO } from '@/models/CTO'

// ---------------------------------------------------------------------------
// GET /api/caixas_emenda_cdo → getCaixas
// ---------------------------------------------------------------------------

/**
 * Lista todas as CE/CDOs do projeto.
 * Requer: qualquer usuário autenticado com empresa ativa.
 *
 * @param {string} projetoId
 * @returns {Promise<Array>}
 */
export async function getCaixas(projetoId) {
  const session = await requireActiveEmpresa(ALL_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const caixas = await CaixaEmendaCDO.find({ projeto_id: targetProjeto }).lean()
  return caixas.map((c) => ({ ...c, _id: c._id.toString() }))
}

// ---------------------------------------------------------------------------
// POST /api/caixas_emenda_cdo → upsertCaixa
// ---------------------------------------------------------------------------

/**
 * Cria ou atualiza uma CE/CDO.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.ce_id        — identificador único (obrigatório, armazenado no campo 'id' do modelo)
 * @param {string} data.projeto_id
 * @param {number} data.lat          — obrigatório
 * @param {number} data.lng          — obrigatório
 * @param {string} [data.nome]
 * @param {string} [data.tipo]       — "CE" | "CDO"
 * @param {number} [data.capacidade]
 * @param {string} [data.olt_id]
 * @param {number} [data.porta_olt]
 * @param {string} [data.splitter_cdo] — configuração do splitter (ex: "1:8", "1:16")
 * @param {string} [data.rua]
 * @param {string} [data.bairro]
 * @param {string} [data.obs]
 * @returns {Promise<Object>}
 */
export async function upsertCaixa(data) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  const {
    ce_id, projeto_id, lat, lng,
    nome, tipo, olt_id, porta_olt,
    cdo_pai_id, porta_cdo_pai,
    splitter_cdo, rua, bairro, obs,
  } = data ?? {}

  if (!ce_id?.trim()) throw new Error('ce_id é obrigatório')
  if (lat == null)    throw new Error('lat é obrigatório')
  if (lng == null)    throw new Error('lng é obrigatório')

  // Prevenir loop: CDO não pode ser pai de si mesma
  if (cdo_pai_id?.trim() && cdo_pai_id.trim() === ce_id.trim()) {
    throw new Error('Uma CDO/CE não pode ser pai de si mesma')
  }

  const targetProjeto = role === 'superadmin' ? projeto_id : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  // Só sobrescreve campos de topologia se foram explicitamente enviados no payload
  const hasOltId      = 'olt_id'      in (data ?? {})
  const hasPortaOlt   = 'porta_olt'   in (data ?? {})
  const hasCdoPaiId   = 'cdo_pai_id'  in (data ?? {})
  const hasPortaCdo   = 'porta_cdo_pai' in (data ?? {})

  const update = {
    lat:          Number(lat),
    lng:          Number(lng),
    nome:         nome?.trim()         ?? null,
    tipo:         tipo?.trim()         ?? 'CDO',
    splitter_cdo: splitter_cdo?.trim() ?? null,
    rua:          rua?.trim()          ?? null,
    bairro:       bairro?.trim()       ?? null,
    obs:          obs?.trim()          ?? null,
    ...(hasOltId    ? { olt_id:    olt_id    ?? null }                                    : {}),
    ...(hasPortaOlt ? { porta_olt: porta_olt != null ? Number(porta_olt) : null }         : {}),
    ...(hasCdoPaiId ? { cdo_pai_id: cdo_pai_id?.trim() || null }                          : {}),
    ...(hasPortaCdo ? { porta_cdo_pai: porta_cdo_pai != null ? Number(porta_cdo_pai) : null } : {}),
  }

  // O modelo CaixaEmendaCDO usa 'id' como campo identificador (não 'ce_id')
  const caixa = await CaixaEmendaCDO.findOneAndUpdate(
    { projeto_id: targetProjeto, id: ce_id.trim() },
    { $set: { ...update, id: ce_id.trim() } },
    { upsert: true, new: true, runValidators: true }
  ).lean()

  revalidatePath('/')
  revalidatePath('/admin/caixas')

  return { ...caixa, _id: caixa._id.toString() }
}

// ---------------------------------------------------------------------------
// DELETE /api/caixas_emenda_cdo → deleteCaixa
// ---------------------------------------------------------------------------

/**
 * Remove uma CE/CDO pelo ce_id.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {string} caixaId
 * @param {string} projetoId
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteCaixa(caixaId, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  if (!caixaId) throw new Error('ce_id é obrigatório')

  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const result = await CaixaEmendaCDO.deleteOne({ projeto_id: targetProjeto, id: caixaId })

  revalidatePath('/')
  revalidatePath('/admin/caixas')

  return { deleted: result.deletedCount > 0 }
}

// ---------------------------------------------------------------------------
// GET /api/diagrama?id= (CE/CDO) → getDiagramaCaixa
// ---------------------------------------------------------------------------

/**
 * Retorna o JSON do diagrama interno de uma CE/CDO.
 * Requer: qualquer usuário autenticado com empresa ativa.
 *
 * @param {string} caixaId
 * @param {string} projetoId
 * @returns {Promise<Object | null>}
 */
export async function getDiagramaCaixa(caixaId, projetoId) {
  const session = await requireActiveEmpresa(ALL_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const caixa = await CaixaEmendaCDO.findOne(
    { projeto_id: targetProjeto, id: caixaId },
    'id nome tipo diagrama'
  ).lean()

  if (!caixa) return null
  return { ...caixa, _id: caixa._id.toString() }
}

// ---------------------------------------------------------------------------
// POST /api/diagrama (CE/CDO) → saveDiagramaCaixa
// ---------------------------------------------------------------------------

/**
 * Salva (substitui) o JSON do diagrama de uma CE/CDO.
 * Requer: admin, tecnico ou superior com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.ce_id
 * @param {string} data.projeto_id
 * @param {Object} data.diagrama
 * @returns {Promise<{ saved: boolean }>}
 */
export async function saveDiagramaCaixa(data) {
  const session = await requireActiveEmpresa(['superadmin', 'admin', 'tecnico'])
  const { role, projeto_id: userProjeto } = session.user

  const { ce_id, projeto_id, diagrama } = data ?? {}

  if (!ce_id)    throw new Error('ce_id é obrigatório')
  if (!diagrama) throw new Error('diagrama é obrigatório')

  const targetProjeto = role === 'superadmin' ? projeto_id : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  // Propaga vínculos de topologia — só sobrescreve se o campo vier preenchido,
  // evitando apagar o olt_id ao salvar fusões sem re-preencher a aba PON/OLT
  const topologiaUpdate = {}
  if (diagrama.entrada?.olt_id?.trim()) {
    topologiaUpdate.olt_id = diagrama.entrada.olt_id.trim()
  }
  if (diagrama.entrada?.porta_olt != null) {
    topologiaUpdate.porta_olt = Number(diagrama.entrada.porta_olt) || null
  }

  const result = await CaixaEmendaCDO.updateOne(
    { projeto_id: targetProjeto, id: ce_id },
    { $set: { diagrama, ...topologiaUpdate } }
  )

  revalidatePath('/')
  revalidatePath('/admin/diagramas')

  return { saved: result.modifiedCount > 0 }
}

// ---------------------------------------------------------------------------
// addCaboToItem — adiciona um cabo ao diagrama.cabos[] de uma CTO ou CDO/CE
// ---------------------------------------------------------------------------

/**
 * Adiciona atomicamente um cabo ao array diagrama.cabos de uma CTO ou CDO/CE.
 * Chamado automaticamente ao salvar uma rota que snapa em um item de mapa.
 *
 * @param {Object} data
 * @param {'cto'|'caixa'} data.itemType  — tipo do item alvo
 * @param {string} data.itemId           — cto_id ou ce_id do item alvo
 * @param {string} data.projetoId
 * @param {Object} data.cabo             — { id, nome, tipo, fibras, obs }
 * @returns {Promise<{ added: boolean }>}
 */
export async function addCaboToItem({ itemType, itemId, projetoId, cabo }) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  if (!itemType || !itemId || !cabo?.id) throw new Error('itemType, itemId e cabo.id são obrigatórios')

  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto
  if (!targetProjeto) throw new Error('projetoId é obrigatório')

  await connectDB()

  let result
  if (itemType === 'cto') {
    result = await CTO.updateOne(
      { projeto_id: targetProjeto, cto_id: itemId },
      { $push: { 'diagrama.cabos': cabo } }
    )
  } else {
    result = await CaixaEmendaCDO.updateOne(
      { projeto_id: targetProjeto, id: itemId },
      { $push: { 'diagrama.cabos': cabo } }
    )
  }

  revalidatePath('/admin/diagramas')

  return { added: result.modifiedCount > 0 }
}
