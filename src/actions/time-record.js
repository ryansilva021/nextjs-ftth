'use server'

/**
 * time-record.js — Server Actions para controle de ponto.
 * Todas as ações validam sessão e isolam por projeto_id.
 */

import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { TimeRecord } from '@/models/TimeRecord'

const PONTO_ROLES = ['admin', 'tecnico', 'noc', 'recepcao']

/** Retorna a data de hoje no formato 'YYYY-MM-DD' no fuso local do servidor */
function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Serializa um documento Mongoose para objeto plain */
function ser(doc) {
  if (!doc) return null
  return JSON.parse(JSON.stringify(doc))
}

// ─────────────────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna o registro de ponto do dia atual do usuário logado. */
export async function getPontoHoje() {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const record = await TimeRecord.findOne({
    userId:     username,
    projeto_id,
    date:       todayStr(),
  }).lean()

  return ser(record)
}

/** Retorna os últimos N registros do usuário (histórico). */
export async function getHistoricoPonto({ limit = 30 } = {}) {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const records = await TimeRecord.find({ userId: username, projeto_id })
    .sort({ date: -1 })
    .limit(limit)
    .lean()

  return ser(records)
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutações
// ─────────────────────────────────────────────────────────────────────────────

/** Registra a entrada (início de jornada). Impede duplicata no mesmo dia. */
export async function registrarEntrada({ location } = {}) {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const date = todayStr()
  const existing = await TimeRecord.findOne({ userId: username, projeto_id, date })
  if (existing) {
    return { error: 'Você já registrou entrada hoje.' }
  }

  const record = await TimeRecord.create({
    userId:          username,
    projeto_id,
    date,
    entrada:         new Date(),
    entradaLocation: location ?? null,
    status:          'trabalhando',
  })

  return { ok: true, record: ser(record) }
}

/** Inicia pausa. Requer status "trabalhando". */
export async function registrarPausaInicio() {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const record = await TimeRecord.findOne({ userId: username, projeto_id, date: todayStr() })
  if (!record)                        return { error: 'Nenhuma entrada registrada hoje.' }
  if (record.status !== 'trabalhando') return { error: 'Não é possível iniciar pausa agora.' }
  if (record.pausaInicio)              return { error: 'Pausa já foi iniciada hoje.' }

  record.pausaInicio = new Date()
  record.status = 'em_pausa'
  await record.save()

  return { ok: true, record: ser(record) }
}

/** Encerra pausa. Requer status "em_pausa". */
export async function registrarPausaFim() {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const record = await TimeRecord.findOne({ userId: username, projeto_id, date: todayStr() })
  if (!record)                      return { error: 'Nenhuma entrada registrada hoje.' }
  if (record.status !== 'em_pausa') return { error: 'Não há pausa ativa para encerrar.' }

  record.pausaFim = new Date()
  record.status = 'trabalhando'
  await record.save()

  return { ok: true, record: ser(record) }
}

/** Registra saída (encerra jornada). Impede saída com pausa ativa. */
export async function registrarSaida({ location } = {}) {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const record = await TimeRecord.findOne({ userId: username, projeto_id, date: todayStr() })
  if (!record)                         return { error: 'Nenhuma entrada registrada hoje.' }
  if (record.status === 'finalizado')  return { error: 'Jornada já foi finalizada.' }
  if (record.status === 'em_pausa')    return { error: 'Encerre a pausa antes de registrar saída.' }

  record.saida = new Date()
  record.saidaLocation = location ?? null
  record.status = 'finalizado'
  await record.save()

  return { ok: true, record: ser(record) }
}
