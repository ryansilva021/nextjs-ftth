'use server'

/**
 * time-request.js — Server Actions para solicitações de ponto.
 */

import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { TimeRequest } from '@/models/TimeRequest'
import { TimeRecord } from '@/models/TimeRecord'

const PONTO_ROLES = ['admin', 'tecnico', 'noc', 'recepcao']

function ser(doc) {
  if (!doc) return null
  return JSON.parse(JSON.stringify(doc))
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

/** Lista as solicitações do usuário logado, ordenadas por data desc. */
export async function getMinhasSolicitacoes({ limit = 40 } = {}) {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const items = await TimeRequest.find({ userId: username, projeto_id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return ser(items)
}

/** Retorna o TimeRecord de uma data específica (para aba "Ajustar"). */
export async function getPontoByDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Data inválida.' }
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const record = await TimeRecord.findOne({ userId: username, projeto_id, date }).lean()
  return ser(record)
}

// ─── Criação ──────────────────────────────────────────────────────────────────

/**
 * Cria uma solicitação de inclusão manual de marcação.
 * Não altera o TimeRecord oficial — fica pendente para admin aprovar.
 */
export async function criarInclusao({ data, tipoMarcacao, horaSolicitada, motivo }) {
  if (!data || !tipoMarcacao || !horaSolicitada || !motivo?.trim()) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { error: 'Data inválida.' }
  if (!/^\d{2}:\d{2}$/.test(horaSolicitada)) return { error: 'Hora inválida.' }

  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const req = await TimeRequest.create({
    userId: username,
    projeto_id,
    type: 'inclusao',
    data,
    tipoMarcacao,
    horaSolicitada,
    motivo: motivo.trim(),
  })

  return { ok: true, request: ser(req) }
}

/**
 * Cria solicitação de ajuste de uma marcação existente.
 * Captura snapshot dos dados originais automaticamente.
 */
export async function criarAjuste({ data, tipoMarcacao, horaSolicitada, motivo }) {
  if (!data || !tipoMarcacao || !horaSolicitada || !motivo?.trim()) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  // Captura snapshot do registro original
  const original = await TimeRecord.findOne({ userId: username, projeto_id, date: data }).lean()
  if (!original) return { error: 'Nenhum registro encontrado para esta data.' }

  // Verifica se o campo que quer ajustar existe
  const campoMap = { entrada: 'entrada', pausa_inicio: 'pausaInicio', pausa_fim: 'pausaFim', saida: 'saida' }
  const campo = campoMap[tipoMarcacao]
  if (!original[campo]) return { error: `Não há marcação de "${tipoMarcacao.replace('_', ' ')}" neste dia.` }

  const req = await TimeRequest.create({
    userId: username,
    projeto_id,
    type: 'ajuste',
    data,
    tipoMarcacao,
    horaSolicitada,
    motivo: motivo.trim(),
    dadosOriginais: {
      entrada:     original.entrada,
      pausaInicio: original.pausaInicio,
      pausaFim:    original.pausaFim,
      saida:       original.saida,
    },
  })

  return { ok: true, request: ser(req) }
}

/**
 * Cria solicitação de justificativa de ausência.
 */
export async function criarAusencia({ data, dataFim, tipoAusencia, motivo }) {
  if (!data || !tipoAusencia || !motivo?.trim()) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const req = await TimeRequest.create({
    userId: username,
    projeto_id,
    type: 'ausencia',
    data,
    dataFim: dataFim || null,
    tipoAusencia,
    motivo: motivo.trim(),
  })

  return { ok: true, request: ser(req) }
}
