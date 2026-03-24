/**
 * src/actions/projetos.js
 * Server Actions para gerenciamento de Projetos/Tenants (superadmin).
 *
 * Mapeamento de endpoints:
 *   GET    /api/projetos            → getProjetos()
 *   POST   /api/projetos (upsert)  → upsertProjeto(data)
 *   DELETE /api/projetos           → deleteProjeto(projetoId)
 *   GET    /api/projetos/stats     → getProjetosStats()
 *   POST   /api/limpar_projeto     → limparProjeto(projetoId)
 */

'use server'

import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { Projeto } from '@/models/Projeto'
import { User } from '@/models/User'
import { CTO } from '@/models/CTO'
import { CaixaEmendaCDO } from '@/models/CaixaEmendaCDO'
import { Rota } from '@/models/Rota'
import { Poste } from '@/models/Poste'
import { OLT } from '@/models/OLT'
import { Movimentacao } from '@/models/Movimentacao'
import { Topologia } from '@/models/Topologia'

const SUPERADMIN_ONLY = ['superadmin']
import { WRITE_ROLES, FIELD_ROLES, ALL_ROLES } from '@/lib/auth'

// ---------------------------------------------------------------------------
// GET /api/projetos → getProjetos
// ---------------------------------------------------------------------------

/**
 * Lista todos os projetos/tenants.
 * Requer: superadmin.
 *
 * @returns {Promise<Array>}
 */
export async function getProjetos() {
  await requireActiveEmpresa(SUPERADMIN_ONLY)
  await connectDB()

  const projetos = await Projeto.find().lean()
  return projetos.map((p) => ({ ...p, _id: p._id.toString() }))
}

// ---------------------------------------------------------------------------
// POST /api/projetos → upsertProjeto
// ---------------------------------------------------------------------------

/**
 * Cria ou atualiza um projeto/tenant.
 * Requer: superadmin.
 *
 * @param {Object} data
 * @param {string} data.projeto_id     — identificador único, slug (obrigatório)
 * @param {string} data.nome           — nome legível (obrigatório)
 * @param {string} [data.descricao]
 * @param {boolean} [data.is_active]
 * @param {Object} [data.configuracoes] — JSON livre de configurações do tenant
 * @returns {Promise<Object>}
 */
export async function upsertProjeto(data) {
  await requireActiveEmpresa(SUPERADMIN_ONLY)

  const { projeto_id, nome, descricao, is_active, configuracoes } = data ?? {}

  if (!projeto_id?.trim()) throw new Error('projeto_id é obrigatório')
  if (!nome?.trim())       throw new Error('nome é obrigatório')

  // projeto_id deve ser slug válido
  if (!/^[a-z0-9_-]+$/i.test(projeto_id)) {
    throw new Error('projeto_id deve conter apenas letras, números, _ e -')
  }

  await connectDB()

  const update = {
    nome:      nome.trim(),
    descricao: descricao?.trim() ?? null,
    ativo:     is_active ?? true,
  }

  const projeto = await Projeto.findOneAndUpdate(
    { projeto_id: projeto_id.trim().toLowerCase() },
    { $set: update },
    { upsert: true, new: true, runValidators: true }
  ).lean()

  revalidatePath('/superadmin/projetos')

  return { ...projeto, _id: projeto._id.toString() }
}

// ---------------------------------------------------------------------------
// DELETE /api/projetos → deleteProjeto
// ---------------------------------------------------------------------------

/**
 * Remove um projeto E todos os dados associados (CTOs, rotas, etc.).
 * Operação destrutiva irreversível. Requer: superadmin.
 *
 * @param {string} projetoId
 * @returns {Promise<{ deleted: boolean, colecoesLimpas: string[] }>}
 */
export async function deleteProjeto(projetoId) {
  await requireActiveEmpresa(SUPERADMIN_ONLY)

  if (!projetoId) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const colecoesLimpas = []

  // Remove todos os dados do tenant em paralelo
  const resultados = await Promise.allSettled([
    CTO.deleteMany({ projeto_id: projetoId }),
    CaixaEmendaCDO.deleteMany({ projeto_id: projetoId }),
    Rota.deleteMany({ projeto_id: projetoId }),
    Poste.deleteMany({ projeto_id: projetoId }),
    OLT.deleteMany({ projeto_id: projetoId }),
    Movimentacao.deleteMany({ projeto_id: projetoId }),
    Topologia.deleteMany({ projeto_id: projetoId }),
    User.deleteMany({ projeto_id: projetoId }),
  ])

  const nomes = ['ctos', 'caixas', 'rotas', 'postes', 'olts', 'movimentacoes', 'topologia', 'users']
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') colecoesLimpas.push(nomes[i])
  })

  const { deletedCount } = await Projeto.deleteOne({ projeto_id: projetoId })

  revalidatePath('/superadmin/projetos')

  return { deleted: deletedCount > 0, colecoesLimpas }
}

// ---------------------------------------------------------------------------
// GET /api/projetos/stats → getProjetosStats
// ---------------------------------------------------------------------------

/**
 * Retorna estatísticas agregadas por projeto.
 * Requer: superadmin.
 *
 * @returns {Promise<Array<{ projeto_id, nome, ctos, caixas, rotas, postes, olts, usuarios, movimentacoes }>>}
 */
export async function getProjetosStats() {
  await requireActiveEmpresa(SUPERADMIN_ONLY)
  await connectDB()

  const projetos = await Projeto.find().lean()

  const stats = await Promise.all(
    projetos.map(async (p) => {
      const pid = p.projeto_id
      const [ctos, caixas, rotas, postes, olts, usuarios, movs] = await Promise.all([
        CTO.countDocuments({ projeto_id: pid }),
        CaixaEmendaCDO.countDocuments({ projeto_id: pid }),
        Rota.countDocuments({ projeto_id: pid }),
        Poste.countDocuments({ projeto_id: pid }),
        OLT.countDocuments({ projeto_id: pid }),
        User.countDocuments({ projeto_id: pid }),
        Movimentacao.countDocuments({ projeto_id: pid }),
      ])
      return {
        _id:           p._id.toString(),
        projeto_id:    pid,
        nome:          p.nome,
        is_active:     p.ativo ?? true,
        ctos,
        caixas,
        rotas,
        postes,
        olts,
        usuarios,
        movimentacoes: movs,
      }
    })
  )

  return stats
}

// ---------------------------------------------------------------------------
// POST /api/limpar_projeto → limparProjeto
// ---------------------------------------------------------------------------

/**
 * Remove todos os dados de campo de um projeto (mantém usuários e projeto).
 * Útil para resetar um ambiente de teste.
 * Requer: superadmin.
 *
 * @param {string} projetoId
 * @returns {Promise<{ limpado: boolean, colecoesLimpas: string[] }>}
 */
export async function limparProjeto(projetoId) {
  await requireActiveEmpresa(SUPERADMIN_ONLY)

  if (!projetoId) throw new Error('projeto_id é obrigatório')

  await connectDB()

  // Confirma que o projeto existe
  const existe = await Projeto.exists({ projeto_id: projetoId })
  if (!existe) throw new Error('Projeto não encontrado')

  const colecoesLimpas = []

  const resultados = await Promise.allSettled([
    CTO.deleteMany({ projeto_id: projetoId }),
    CaixaEmendaCDO.deleteMany({ projeto_id: projetoId }),
    Rota.deleteMany({ projeto_id: projetoId }),
    Poste.deleteMany({ projeto_id: projetoId }),
    OLT.deleteMany({ projeto_id: projetoId }),
    Movimentacao.deleteMany({ projeto_id: projetoId }),
    Topologia.deleteMany({ projeto_id: projetoId }),
  ])

  const nomes = ['ctos', 'caixas', 'rotas', 'postes', 'olts', 'movimentacoes', 'topologia']
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') colecoesLimpas.push(nomes[i])
  })

  revalidatePath('/superadmin/projetos')

  return { limpado: true, colecoesLimpas }
}

// ---------------------------------------------------------------------------
// POST /api/projetos/toggle → toggleProjetoAtivo
// ---------------------------------------------------------------------------

/**
 * Ativa ou desativa um projeto (toggle do campo `ativo`).
 * Requer: superadmin.
 *
 * @param {string} projetoId
 * @returns {Promise<{ projeto_id: string, ativo: boolean }>}
 */
// ---------------------------------------------------------------------------
// GET config do projeto atual → getProjetoConfig
// ---------------------------------------------------------------------------

/**
 * Retorna a configuração do projeto do usuário autenticado.
 * Requer: qualquer role autenticado com empresa ativa.
 *
 * @returns {Promise<{ fiberColorStandard: string }>}
 */
export async function getProjetoConfig() {
  const session = await requireActiveEmpresa(ALL_ROLES)
  const { role, projeto_id } = session.user

  await connectDB()

  const projeto = await Projeto.findOne(
    { projeto_id: role === 'superadmin' ? projeto_id : projeto_id },
    'config'
  ).lean()

  return {
    fiberColorStandard: projeto?.config?.fiberColorStandard ?? 'ABNT',
  }
}

// ---------------------------------------------------------------------------
// POST config do projeto atual → updateProjetoConfig
// ---------------------------------------------------------------------------

/**
 * Atualiza campos de configuração do projeto do usuário autenticado.
 * Requer: admin ou superadmin.
 *
 * @param {Object} data
 * @param {'ABNT'|'EIA_598_A'} [data.fiberColorStandard]
 * @returns {Promise<{ saved: boolean }>}
 */
export async function updateProjetoConfig(data) {
  const session = await requireActiveEmpresa(FIELD_ROLES)
  const { projeto_id } = session.user

  const { fiberColorStandard } = data ?? {}

  const validStandards = ['ABNT', 'EIA_598_A']
  if (fiberColorStandard && !validStandards.includes(fiberColorStandard)) {
    throw new Error('Padrão de cores inválido')
  }

  await connectDB()

  const update = {}
  if (fiberColorStandard) update['config.fiberColorStandard'] = fiberColorStandard

  const result = await Projeto.updateOne(
    { projeto_id },
    { $set: update }
  )

  revalidatePath('/configuracoes')

  return { saved: result.matchedCount > 0 }
}

// ---------------------------------------------------------------------------

export async function toggleProjetoAtivo(projetoId) {
  await requireActiveEmpresa(SUPERADMIN_ONLY)

  if (!projetoId) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const projeto = await Projeto.findOne({ projeto_id: projetoId })
  if (!projeto) throw new Error('Projeto não encontrado')

  projeto.ativo = !projeto.ativo
  await projeto.save()

  revalidatePath('/superadmin/projetos')

  return { projeto_id: projetoId, ativo: projeto.ativo }
}
