/**
 * src/actions/postes.js
 * Server Actions para Postes.
 *
 * Mapeamento de endpoints:
 *   GET    /api/postes          → getPostes(projetoId)
 *   POST   /api/postes (upsert) → upsertPoste(data)
 *   DELETE /api/postes          → deletePoste(posteId, projetoId)
 */

'use server'

import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/db'
import { WRITE_ROLES, ALL_ROLES } from '@/lib/auth'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { Poste } from '@/models/Poste'

// ---------------------------------------------------------------------------
// GET /api/postes → getPostes
// ---------------------------------------------------------------------------

/**
 * Lista todos os postes do projeto.
 * Requer: qualquer usuário autenticado com empresa ativa.
 *
 * @param {string} projetoId
 * @returns {Promise<Array>}
 */
export async function getPostes(projetoId) {
  const session = await requireActiveEmpresa(ALL_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const postes = await Poste.find({ projeto_id: targetProjeto }).lean()
  return postes.map((p) => ({ ...p, _id: p._id.toString() }))
}

// ---------------------------------------------------------------------------
// POST /api/postes (upsert) → upsertPoste
// ---------------------------------------------------------------------------

/**
 * Cria ou atualiza um poste.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.poste_id       — identificador único (obrigatório)
 * @param {string} data.projeto_id
 * @param {number} data.lat            — obrigatório
 * @param {number} data.lng            — obrigatório
 * @param {string} [data.nome]         — nome/identificação do poste
 * @param {string} [data.tipo]         — tipo de poste (simples, transformador, ancoragem, etc.)
 * @param {string} [data.status]       — status operacional (ativo, inativo, em_manutencao, removido)
 * @param {string} [data.altura]       — altura do poste (ex: "11m")
 * @param {string} [data.material]     — material (concreto, madeira, ferro, fibra)
 * @param {string} [data.proprietario] — proprietário (CEMIG, proprio, etc.)
 * @param {string} [data.rua]          — logradouro
 * @param {string} [data.bairro]       — bairro
 * @param {string} [data.obs]          — observações
 * @returns {Promise<Object>}
 */
export async function upsertPoste(data) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  const {
    poste_id, projeto_id, lat, lng,
    nome, tipo, status, altura, material, proprietario, rua, bairro, obs,
  } = data ?? {}

  if (!poste_id?.trim()) throw new Error('poste_id é obrigatório')
  if (lat == null)       throw new Error('lat é obrigatório')
  if (lng == null)       throw new Error('lng é obrigatório')

  const targetProjeto = role === 'superadmin' ? projeto_id : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const update = {
    lat:          Number(lat),
    lng:          Number(lng),
    nome:         nome?.trim()         ?? null,
    tipo:         tipo?.trim()         ?? null,
    status:       status?.trim()       ?? 'ativo',
    altura:       altura?.trim()       ?? null,
    material:     material?.trim()     ?? null,
    proprietario: proprietario?.trim() ?? null,
    rua:          rua?.trim()          ?? null,
    bairro:       bairro?.trim()       ?? null,
    obs:          obs?.trim()          ?? null,
  }

  const poste = await Poste.findOneAndUpdate(
    { projeto_id: targetProjeto, poste_id: poste_id.trim() },
    { $set: update },
    { upsert: true, new: true, runValidators: true }
  ).lean()

  revalidatePath('/')
  revalidatePath('/admin/postes')

  // Registrar evento
  try {
    const { logEvento } = await import('@/actions/eventos')
    const isNew = poste.__v === 0
    await logEvento({
      tipo_acao: isNew ? 'criou' : 'editou',
      entidade: 'poste',
      item_id: poste.poste_id,
      item_nome: poste.nome ?? poste.poste_id,
      projeto_id: targetProjeto,
    })
  } catch (_) {}

  return { ...poste, _id: poste._id.toString() }
}

// ---------------------------------------------------------------------------
// DELETE /api/postes → deletePoste
// ---------------------------------------------------------------------------

/**
 * Remove um poste pelo poste_id.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {string} posteId
 * @param {string} projetoId
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deletePoste(posteId, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  if (!posteId) throw new Error('poste_id é obrigatório')

  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const result = await Poste.deleteOne({ projeto_id: targetProjeto, poste_id: posteId })

  revalidatePath('/')
  revalidatePath('/admin/postes')

  // Registrar evento
  try {
    const { logEvento } = await import('@/actions/eventos')
    await logEvento({
      tipo_acao: 'excluiu',
      entidade: 'poste',
      item_id: posteId,
      item_nome: posteId,
      projeto_id: targetProjeto,
    })
  } catch (_) {}

  return { deleted: result.deletedCount > 0 }
}
