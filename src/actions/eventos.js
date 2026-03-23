'use server'

import { connectDB } from '@/lib/db'
import { auth } from '@/lib/auth'
import { EventLog } from '@/models/EventLog'

/**
 * Registra um evento no log. Chamada interna — não lança erro.
 */
export async function logEvento({ tipo_acao, entidade, item_id, item_nome = '', projeto_id }) {
  try {
    const session = await auth()
    if (!session?.user) return
    await connectDB()
    await EventLog.create({
      tipo_acao,
      entidade,
      item_id: String(item_id),
      item_nome: String(item_nome ?? ''),
      user_id: String(session.user.id ?? session.user.email ?? ''),
      username: String(session.user.username ?? session.user.name ?? ''),
      projeto_id: String(projeto_id ?? session.user.projeto_id ?? ''),
    })
  } catch (_) {
    // Log é não-bloqueante — ignorar erros
  }
}

/**
 * Lista eventos do projeto (mais recentes primeiro).
 */
export async function getEventos({ projeto_id, limite = 100, busca = '' }) {
  const session = await auth()
  if (!session?.user) return []
  await connectDB()

  const query = { projeto_id }
  if (busca.trim()) {
    const re = new RegExp(busca.trim(), 'i')
    query.$or = [{ item_nome: re }, { item_id: re }, { username: re }, { entidade: re }]
  }

  const docs = await EventLog.find(query)
    .sort({ timestamp: -1 })
    .limit(limite)
    .lean()

  return docs.map(d => ({
    id: String(d._id),
    tipo_acao: d.tipo_acao,
    entidade: d.entidade,
    item_id: d.item_id,
    item_nome: d.item_nome,
    username: d.username,
    projeto_id: d.projeto_id,
    timestamp: d.timestamp?.toISOString() ?? '',
  }))
}
