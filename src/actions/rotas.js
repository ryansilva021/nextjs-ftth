/**
 * src/actions/rotas.js
 * Server Actions para Rotas de Fibra.
 *
 * Mapeamento de endpoints:
 *   GET    /api/rotas_fibras          → getRotas(projetoId)
 *   POST   /api/rotas_fibras (upsert) → upsertRota(data)
 *   DELETE /api/rotas_fibras          → deleteRota(rotaId, projetoId)
 */

'use server'

import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/db'
import { WRITE_ROLES, ALL_ROLES } from '@/lib/auth'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { Rota } from '@/models/Rota'

// ---------------------------------------------------------------------------
// GET /api/rotas_fibras → getRotas
// ---------------------------------------------------------------------------

/**
 * Retorna todas as rotas de fibra do projeto como GeoJSON FeatureCollection.
 * Requer: qualquer usuário autenticado com empresa ativa.
 *
 * @param {string} projetoId
 * @returns {Promise<{ type: 'FeatureCollection', features: Array }>}
 */
export async function getRotas(projetoId) {
  const session = await requireActiveEmpresa(ALL_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const rotas = await Rota.find({ projeto_id: targetProjeto }).lean()

  // Formata como GeoJSON FeatureCollection
  const features = rotas.map((rota) => ({
    type: 'Feature',
    id:   rota.rota_id,
    geometry: {
      type:        rota.geojson?.type        ?? 'LineString',
      coordinates: rota.geojson?.coordinates ?? [],
    },
    properties: {
      rota_id:     rota.rota_id,
      nome:        rota.nome,
      tipo:        rota.tipo,
      obs:         rota.obs,
      snap_ids:    rota.snap_ids ?? [],
      origemId:    rota.origemId    ?? null,
      origemTipo:  rota.origemTipo  ?? null,
      destinoId:   rota.destinoId   ?? null,
      destinoTipo: rota.destinoTipo ?? null,
      projeto_id:  rota.projeto_id,
      _id:         rota._id.toString(),
    },
  }))

  return { type: 'FeatureCollection', features }
}

// ---------------------------------------------------------------------------
// POST /api/rotas_fibras → upsertRota
// ---------------------------------------------------------------------------

/**
 * Cria ou atualiza uma rota de fibra.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.rota_id         — identificador único (obrigatório)
 * @param {string} data.projeto_id
 * @param {Array}  data.coordinates     — array de [lng, lat] (obrigatório)
 * @param {string} [data.geometry_type] — padrão 'LineString'
 * @param {string} [data.nome]
 * @param {string} [data.tipo]          — BACKBONE | RAMAL | DROP
 * @param {string} [data.obs]           — observações
 * @returns {Promise<Object>}
 */
export async function upsertRota(data) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  const { rota_id, projeto_id, coordinates, geometry_type, nome, tipo, obs, snap_ids,
          origemId, origemTipo, destinoId, destinoTipo } = data ?? {}

  if (!rota_id?.trim())           throw new Error('rota_id é obrigatório')
  if (!Array.isArray(coordinates) || coordinates.length < 2)
    throw new Error('coordinates deve ser um array com ao menos 2 pontos')

  const targetProjeto = role === 'superadmin' ? projeto_id : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const update = {
    geojson: {
      type:        geometry_type ?? 'LineString',
      coordinates,
    },
    nome:        nome?.trim()       ?? null,
    tipo:        tipo?.trim()       ?? null,
    obs:         obs?.trim()        ?? null,
    snap_ids:    Array.isArray(snap_ids) ? snap_ids.filter(Boolean) : [],
    origemId:    origemId           ?? null,
    origemTipo:  origemTipo         ?? null,
    destinoId:   destinoId          ?? null,
    destinoTipo: destinoTipo        ?? null,
  }

  const rota = await Rota.findOneAndUpdate(
    { projeto_id: targetProjeto, rota_id: rota_id.trim() },
    { $set: update },
    { upsert: true, new: true, runValidators: true }
  ).lean()

  revalidatePath('/')
  revalidatePath('/admin/rotas')

  // Registrar evento
  try {
    const { logEvento } = await import('@/actions/eventos')
    const isNew = rota.__v === 0
    await logEvento({
      tipo_acao: isNew ? 'criou' : 'editou',
      entidade: 'rota',
      item_id: rota.rota_id,
      item_nome: rota.nome ?? rota.rota_id,
      projeto_id: targetProjeto,
    })
  } catch (_) {}

  // Retorna em formato compatível com o que getRotas espera e o que o cliente usa
  return {
    ...rota,
    _id:           rota._id.toString(),
    rota_id:       rota.rota_id,
    nome:          rota.nome,
    tipo:          rota.tipo,
    geometry_type: rota.geojson?.type ?? 'LineString',
    coordinates:   rota.geojson?.coordinates ?? [],
    projeto_id:    rota.projeto_id,
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/rotas_fibras → deleteRota
// ---------------------------------------------------------------------------

/**
 * Remove uma rota de fibra pelo rota_id.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {string} rotaId
 * @param {string} projetoId
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteRota(rotaId, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  if (!rotaId) throw new Error('rota_id é obrigatório')

  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const result = await Rota.deleteOne({ projeto_id: targetProjeto, rota_id: rotaId })

  revalidatePath('/')
  revalidatePath('/admin/rotas')

  // Registrar evento
  try {
    const { logEvento } = await import('@/actions/eventos')
    await logEvento({
      tipo_acao: 'excluiu',
      entidade: 'rota',
      item_id: rotaId,
      item_nome: rotaId,
      projeto_id: targetProjeto,
    })
  } catch (_) {}

  return { deleted: result.deletedCount > 0 }
}
