/**
 * src/actions/imports.js
 * Server Actions para importação em massa de dados geográficos.
 *
 * Mapeamento de endpoints:
 *   POST /api/import_ctos     → importCTOs(rows, projetoId)
 *   POST /api/import_caixas   → importCaixas(rows, projetoId)
 *   POST /api/import_rotas    → importRotas(features, projetoId)
 *   POST /api/import_postes   → importPostes(rows, projetoId)
 */

'use server'

import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/db'
import { WRITE_ROLES } from '@/lib/auth'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { CTO } from '@/models/CTO'
import { CaixaEmendaCDO } from '@/models/CaixaEmendaCDO'
import { Rota } from '@/models/Rota'
import { Poste } from '@/models/Poste'

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Executa upsert em lote usando bulkWrite para melhor performance.
 *
 * @param {import('mongoose').Model} Model
 * @param {string} idField       — campo de identificação único (ex: 'cto_id')
 * @param {string} targetProjeto
 * @param {Array}  docs
 * @returns {Promise<{ inserted: number, modified: number, errors: Array }>}
 */
async function bulkUpsert(Model, idField, targetProjeto, docs) {
  if (docs.length === 0) return { inserted: 0, modified: 0, errors: [] }

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { projeto_id: targetProjeto, [idField]: doc[idField] },
      update: { $set: { ...doc, projeto_id: targetProjeto } },
      upsert: true,
    },
  }))

  const result = await Model.bulkWrite(ops, { ordered: false })

  return {
    inserted: result.upsertedCount,
    modified: result.modifiedCount,
    errors:   [],
  }
}

// ---------------------------------------------------------------------------
// POST /api/import_ctos → importCTOs
// ---------------------------------------------------------------------------

/**
 * Importa CTOs em lote via upsert.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Array}  rows         — array de objetos com campos da CTO
 * @param {string} [projetoId]  — usado pelo superadmin; admin usa o próprio
 * @returns {Promise<{ inserted: number, modified: number, errors: Array }>}
 */
export async function importCTOs(rows, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  if (!targetProjeto) throw new Error('projeto_id é obrigatório')
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows deve ser array não-vazio')

  await connectDB()

  const errors = []
  const docs = []

  for (const [i, row] of rows.entries()) {
    if (!row.cto_id) {
      errors.push({ linha: i + 2, erro: 'cto_id é obrigatório' })
      continue
    }
    if (row.lat == null || row.lng == null) {
      errors.push({ linha: i + 2, erro: 'lat e lng são obrigatórios' })
      continue
    }
    docs.push({
      cto_id:      String(row.cto_id).trim(),
      lat:         Number(row.lat),
      lng:         Number(row.lng),
      nome:        row.nome        ? String(row.nome).trim()        : null,
      rua:         row.rua         ? String(row.rua).trim()         : null,
      bairro:      row.bairro      ? String(row.bairro).trim()      : null,
      capacidade:  row.capacidade  ? Number(row.capacidade)         : 0,
      cdo_id:      row.cdo_id      ? String(row.cdo_id).trim()      : null,
      porta_cdo:   row.porta_cdo   ? Number(row.porta_cdo)          : null,
      splitter_cto: row.splitter_cto ? String(row.splitter_cto).trim() : null,
    })
  }

  const result = await bulkUpsert(CTO, 'cto_id', targetProjeto, docs)
  result.errors.push(...errors)

  revalidatePath('/')

  return result
}

// ---------------------------------------------------------------------------
// POST /api/import_caixas → importCaixas
// ---------------------------------------------------------------------------

/**
 * Importa CE/CDOs em lote.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Array}  rows
 * @param {string} [projetoId]
 * @returns {Promise<{ inserted: number, modified: number, errors: Array }>}
 */
export async function importCaixas(rows, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  if (!targetProjeto) throw new Error('projeto_id é obrigatório')
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows deve ser array não-vazio')

  await connectDB()

  const errors = []
  const docs = []

  for (const [i, row] of rows.entries()) {
    if (!row.ce_id) {
      errors.push({ linha: i + 2, erro: 'ce_id é obrigatório' })
      continue
    }
    if (row.lat == null || row.lng == null) {
      errors.push({ linha: i + 2, erro: 'lat e lng são obrigatórios' })
      continue
    }
    docs.push({
      ce_id:      String(row.ce_id).trim(),
      lat:        Number(row.lat),
      lng:        Number(row.lng),
      nome:       row.nome   ? String(row.nome).trim()  : null,
      tipo:       row.tipo   ? String(row.tipo).trim()  : 'cdo',
      capacidade: row.capacidade ? Number(row.capacidade) : 0,
      olt_id:     row.olt_id ? String(row.olt_id).trim() : null,
      porta_olt:  row.porta_olt  ? Number(row.porta_olt)  : null,
    })
  }

  const result = await bulkUpsert(CaixaEmendaCDO, 'ce_id', targetProjeto, docs)
  result.errors.push(...errors)

  revalidatePath('/')

  return result
}

// ---------------------------------------------------------------------------
// POST /api/import_rotas → importRotas
// ---------------------------------------------------------------------------

/**
 * Importa rotas de fibra a partir de features GeoJSON ou array de objetos.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Array}  features  — array de GeoJSON Feature ou objetos com {rota_id, coordinates}
 * @param {string} [projetoId]
 * @returns {Promise<{ inserted: number, modified: number, errors: Array }>}
 */
export async function importRotas(features, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  if (!targetProjeto) throw new Error('projeto_id é obrigatório')
  if (!Array.isArray(features) || features.length === 0) throw new Error('features deve ser array não-vazio')

  await connectDB()

  const errors = []
  const docs = []

  for (const [i, feat] of features.entries()) {
    // Suporta GeoJSON Feature e objeto plano
    const props  = feat.properties ?? feat
    const geom   = feat.geometry   ?? feat
    const coords = geom.coordinates ?? feat.coordinates

    const rota_id = props.rota_id ?? feat.id
    if (!rota_id) {
      errors.push({ linha: i + 1, erro: 'rota_id é obrigatório' })
      continue
    }
    if (!Array.isArray(coords) || coords.length < 2) {
      errors.push({ linha: i + 1, erro: 'coordinates inválido' })
      continue
    }
    docs.push({
      rota_id: String(rota_id).trim(),
      geojson: { type: 'LineString', coordinates: coords },
      nome:    props.nome  ? String(props.nome).trim()  : null,
      tipo:    props.tipo  ? String(props.tipo).trim()  : null,
      cabo:    props.cabo  ? String(props.cabo).trim()  : null,
      fibras:  props.fibras ? Number(props.fibras)       : null,
    })
  }

  const result = await bulkUpsert(Rota, 'rota_id', targetProjeto, docs)
  result.errors.push(...errors)

  revalidatePath('/')

  return result
}

// ---------------------------------------------------------------------------
// POST /api/import_postes → importPostes
// ---------------------------------------------------------------------------

/**
 * Importa postes em lote.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Array}  rows
 * @param {string} [projetoId]
 * @returns {Promise<{ inserted: number, modified: number, errors: Array }>}
 */
export async function importPostes(rows, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  if (!targetProjeto) throw new Error('projeto_id é obrigatório')
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows deve ser array não-vazio')

  await connectDB()

  const errors = []
  const docs = []

  for (const [i, row] of rows.entries()) {
    if (!row.poste_id) {
      errors.push({ linha: i + 2, erro: 'poste_id é obrigatório' })
      continue
    }
    if (row.lat == null || row.lng == null) {
      errors.push({ linha: i + 2, erro: 'lat e lng são obrigatórios' })
      continue
    }
    docs.push({
      poste_id: String(row.poste_id).trim(),
      lat:      Number(row.lat),
      lng:      Number(row.lng),
      codigo:   row.codigo ? String(row.codigo).trim() : null,
      tipo:     row.tipo   ? String(row.tipo).trim()   : null,
      obs:      row.obs    ? String(row.obs).trim()    : null,
    })
  }

  const result = await bulkUpsert(Poste, 'poste_id', targetProjeto, docs)
  result.errors.push(...errors)

  revalidatePath('/')

  return result
}

// ---------------------------------------------------------------------------
// POST /api/limpar_dados_projeto → limparDadosProjeto
// ---------------------------------------------------------------------------

/**
 * Remove todos os dados de campo de um projeto (CTOs, CDOs, Rotas, Postes).
 * Mantém usuários, OLTs e o próprio projeto.
 * Requer: admin ou superadmin.
 *
 * @param {string} projetoId
 * @returns {Promise<{ limpado: boolean, totais: object }>}
 */
export async function limparDadosProjeto(projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)

  if (!projetoId) throw new Error('projeto_id é obrigatório')

  await connectDB()

  // superadmin pode limpar qualquer projeto; admin só pode limpar o próprio
  const targetProjeto = session.user.role === 'superadmin'
    ? projetoId
    : session.user.projeto_id

  const [ctos, caixas, rotas, postes] = await Promise.all([
    CTO.deleteMany({ projeto_id: targetProjeto }),
    CaixaEmendaCDO.deleteMany({ projeto_id: targetProjeto }),
    Rota.deleteMany({ projeto_id: targetProjeto }),
    Poste.deleteMany({ projeto_id: targetProjeto }),
  ])

  revalidatePath('/admin/campo')
  revalidatePath('/admin/mapa')
  revalidatePath('/admin/importar')

  return {
    limpado: true,
    totais: {
      ctos:   ctos.deletedCount,
      caixas: caixas.deletedCount,
      rotas:  rotas.deletedCount,
      postes: postes.deletedCount,
    },
  }
}
