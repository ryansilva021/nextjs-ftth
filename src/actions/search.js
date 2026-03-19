/**
 * src/actions/search.js
 * Server Action de busca global no projeto FTTH.
 *
 * Pesquisa simultânea em CTOs, CaixasEmendaCDO, Rotas e Postes
 * com filtro por projeto_id (multi-tenancy).
 */

'use server'

import { connectDB }       from '@/lib/db'
import { requireAuth }     from '@/lib/auth'
import { CTO }             from '@/models/CTO'
import { CaixaEmendaCDO }  from '@/models/CaixaEmendaCDO'
import { Rota }            from '@/models/Rota'
import { Poste }           from '@/models/Poste'

const MAX_PER_COLLECTION = 10

/**
 * Busca global por texto em todas as coleções do projeto.
 * Requer: qualquer usuário autenticado.
 *
 * @param {string} query      — termo de busca (mínimo 2 caracteres)
 * @param {string} projetoId  — tenant a pesquisar (superadmin pode informar qualquer um)
 * @returns {Promise<{
 *   ctos:    Array<{ _id: string, tipo: string, label: string }>,
 *   caixas:  Array<{ _id: string, tipo: string, label: string }>,
 *   rotas:   Array<{ _id: string, tipo: string, label: string }>,
 *   postes:  Array<{ _id: string, tipo: string, label: string }>,
 * }>}
 */
export async function searchGlobal(query, projetoId) {
  const session = await requireAuth()
  const { role, projeto_id: userProjeto } = session.user

  // Não-superadmin só pode pesquisar no próprio projeto
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  if (!targetProjeto) {
    return { ctos: [], caixas: [], rotas: [], postes: [] }
  }

  // Sanitiza e valida query mínima
  const term = String(query ?? '').trim()
  if (term.length < 2) {
    return { ctos: [], caixas: [], rotas: [], postes: [] }
  }

  // Regex case-insensitive para MongoDB — escapa caracteres especiais de regex
  const safePattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = { $regex: safePattern, $options: 'i' }

  await connectDB()

  // Executa as 4 buscas em paralelo para reduzir latência
  const [rawCtos, rawCaixas, rawRotas, rawPostes] = await Promise.all([
    // CTOs: busca por cto_id, rua (campo de endereço), bairro, nome
    CTO.find(
      {
        projeto_id: targetProjeto,
        $or: [
          { cto_id: regex },
          { rua:    regex },
          { bairro: regex },
          { nome:   regex },
        ],
      },
      'cto_id nome rua bairro'
    )
      .limit(MAX_PER_COLLECTION)
      .lean(),

    // CaixaEmendaCDO: busca por id (ce_id), rua, bairro, obs, nome
    CaixaEmendaCDO.find(
      {
        projeto_id: targetProjeto,
        $or: [
          { id:     regex },
          { nome:   regex },
          { rua:    regex },
          { bairro: regex },
          { obs:    regex },
        ],
      },
      'id nome rua bairro tipo'
    )
      .limit(MAX_PER_COLLECTION)
      .lean(),

    // Rotas: busca por rota_id e nome
    Rota.find(
      {
        projeto_id: targetProjeto,
        $or: [
          { rota_id: regex },
          { nome:    regex },
        ],
      },
      'rota_id nome tipo'
    )
      .limit(MAX_PER_COLLECTION)
      .lean(),

    // Postes: busca por poste_id, rua, bairro
    Poste.find(
      {
        projeto_id: targetProjeto,
        $or: [
          { poste_id: regex },
          { rua:      regex },
          { bairro:   regex },
          { nome:     regex },
        ],
      },
      'poste_id nome rua bairro tipo'
    )
      .limit(MAX_PER_COLLECTION)
      .lean(),
  ])

  // Serializa e constrói label legível para cada coleção

  const ctos = rawCtos.map((doc) => ({
    _id:  doc._id.toString(),
    tipo: 'cto',
    label: doc.cto_id + (doc.nome ? ` — ${doc.nome}` : '') +
           (doc.rua ? `, ${doc.rua}` : '') +
           (doc.bairro ? `, ${doc.bairro}` : ''),
  }))

  const caixas = rawCaixas.map((doc) => ({
    _id:  doc._id.toString(),
    tipo: 'caixa',
    label: doc.id + (doc.nome ? ` — ${doc.nome}` : '') +
           (doc.tipo ? ` (${doc.tipo})` : '') +
           (doc.rua ? `, ${doc.rua}` : '') +
           (doc.bairro ? `, ${doc.bairro}` : ''),
  }))

  const rotas = rawRotas.map((doc) => ({
    _id:  doc._id.toString(),
    tipo: 'rota',
    label: doc.rota_id + (doc.nome ? ` — ${doc.nome}` : '') +
           (doc.tipo ? ` (${doc.tipo})` : ''),
  }))

  const postes = rawPostes.map((doc) => ({
    _id:  doc._id.toString(),
    tipo: 'poste',
    label: doc.poste_id + (doc.nome ? ` — ${doc.nome}` : '') +
           (doc.rua ? `, ${doc.rua}` : '') +
           (doc.bairro ? `, ${doc.bairro}` : ''),
  }))

  return { ctos, caixas, rotas, postes }
}

// ---------------------------------------------------------------------------
// buscarClientes — busca clientes instalados em CTOs por nome
// ---------------------------------------------------------------------------

/**
 * Busca clientes ativos nas CTOs do projeto.
 * Retorna lista com nome do cliente, cto_id e coordenadas para fly-to.
 *
 * @param {string} query
 * @param {string} projetoId
 * @returns {Promise<Array<{ cliente: string, cto_id: string, porta: number|null, lat: number|null, lng: number|null }>>}
 */
export async function buscarClientes(query, projetoId) {
  const session = await requireAuth()
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  if (!targetProjeto) return []

  const term = String(query ?? '').trim()
  if (term.length < 2) return []

  await connectDB()

  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

  const ctos = await CTO.find(
    { projeto_id: targetProjeto },
    'cto_id lat lng diagrama'
  ).lean()

  const results = []
  const seen = new Set()

  for (const cto of ctos) {
    const portas = cto.diagrama?.portas ?? {}
    for (const [portaNum, portaInfo] of Object.entries(portas)) {
      const nome = portaInfo?.cliente
      if (!nome || !regex.test(nome)) continue
      if (seen.has(nome)) continue
      seen.add(nome)
      results.push({
        cliente: nome,
        cto_id: cto.cto_id,
        porta: Number(portaNum) || null,
        lat: cto.lat ?? null,
        lng: cto.lng ?? null,
      })
      if (results.length >= 10) return results
    }
  }

  return results
}
