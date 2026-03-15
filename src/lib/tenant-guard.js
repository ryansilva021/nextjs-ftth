/**
 * src/lib/tenant-guard.js
 *
 * Guard de autorização multi-tenant para Server Actions.
 *
 * Substitui requireRole() nas Server Actions adicionando verificação
 * do status da Empresa antes de liberar o acesso.
 *
 * Fluxo:
 *   1. Verifica autenticação (sessão ativa)
 *   2. Superadmin: pula verificação de empresa, verifica apenas o role
 *   3. Demais roles: verifica empresa_id e consulta status atual no MongoDB
 *   4. Verifica se o role do usuário está na lista de roles permitidos
 *
 * Uso nas Server Actions:
 *   import { requireActiveEmpresa } from '@/lib/tenant-guard'
 *
 *   export async function minhaAction(data) {
 *     const session = await requireActiveEmpresa(['admin', 'superadmin'])
 *     // ... lógica da action
 *   }
 */

'use server'

import { auth } from '@/lib/auth'
import { verificarStatusEmpresa } from '@/lib/tenant'
import { connectDB } from '@/lib/db'

// Mensagens de erro por status de empresa
const MENSAGENS_STATUS = {
  bloqueado:      (motivo) => `Acesso bloqueado. ${motivo || 'Contate o suporte.'}`,
  vencido:        ()       => 'Assinatura vencida. Regularize o pagamento.',
  trial_expirado: ()       => 'Período de teste encerrado. Escolha um plano.',
  inexistente:    ()       => 'Empresa não encontrada.',
}

/**
 * Verifica autenticação, status da empresa e role do usuário.
 * Lança erro descritivo em qualquer violação.
 *
 * @param {string[]|null} allowedRoles  — array de roles permitidos, ou null para qualquer role
 * @returns {Promise<import('next-auth').Session>}  — sessão validada
 * @throws {Error}  — mensagem descritiva do motivo da negação
 */
export async function requireActiveEmpresa(allowedRoles = null) {
  const session = await auth()
  if (!session?.user) throw new Error('Não autenticado')

  const { role, empresa_id } = session.user

  // Superadmin é isento da verificação de empresa
  if (role === 'superadmin') {
    if (allowedRoles && !allowedRoles.includes(role)) {
      throw new Error('Permissão insuficiente')
    }
    return session
  }

  // Se não há empresa_id no token, tenta resolver via projeto_id (usuários criados antes da migração)
  let resolvedEmpresaId = empresa_id
  if (!resolvedEmpresaId && session.user.projeto_id) {
    try {
      await connectDB()
      const { Empresa } = await import('@/models/Empresa')
      const empresa = await Empresa.findOne(
        { projetos: session.user.projeto_id, is_active: true },
        '_id'
      ).lean()
      if (empresa) resolvedEmpresaId = empresa._id.toString()
    } catch {
      // Não bloqueia — segue sem empresa_id
    }
  }

  // Usuário sem empresa associada não pode operar
  if (!resolvedEmpresaId) throw new Error('Usuário sem empresa associada. Contate o administrador.')

  // Consulta status atual da empresa no MongoDB
  const status = await verificarStatusEmpresa(resolvedEmpresaId)

  if (!status.ativa) {
    const msgFn = MENSAGENS_STATUS[status.status]
    const mensagem = msgFn ? msgFn(status.motivo) : 'Acesso negado.'
    throw new Error(mensagem)
  }

  // Verifica role
  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new Error('Permissão insuficiente')
  }

  return session
}
