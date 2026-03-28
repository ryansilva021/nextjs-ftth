/**
 * src/lib/auth.js
 *
 * Configuração NextAuth v5 (auth.js) para o FiberOps/FTTH.
 *
 * Funcionalidades implementadas:
 *   - Credentials provider com suporte a PBKDF2 e SHA-256 legado
 *   - Rate limiting por IP (5 falhas / 5 min → bloqueio 15 min)
 *   - Rate limiting por username (10 falhas / 10 min → bloqueio 30 min)
 *   - Single-session enforcement (login invalida sessão anterior via sessionToken)
 *   - Verificação de status da Empresa no login e a cada 5 min na renovação do token
 *   - JWT com campos: id, username, role, projeto_id, projeto_nome, sessionToken,
 *                     empresa_id, empresa_slug, empresa_nome, empresa_status
 *   - Callbacks session e jwt que expõem todos os campos customizados
 *   - Página de login em /login
 *
 * Variáveis de ambiente necessárias:
 *   AUTH_SECRET (ou NEXTAUTH_SECRET) — mínimo 32 chars aleatórios
 *   MONGODB_URI=mongodb+srv://...
 */

import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import crypto from 'crypto'
import { connectDB } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { User } from '@/models/User'
import { Projeto } from '@/models/Projeto'
import { LoginAttempt } from '@/models/LoginAttempt'
import { authConfig } from '@/lib/auth.config'

// ---------------------------------------------------------------------------
// Constantes de rate limiting — espelham o worker.js legado
// ---------------------------------------------------------------------------

const RL = {
  IP:   { maxFails: 5,  windowMs: 5  * 60 * 1000, lockoutMs: 15 * 60 * 1000 },
  USER: { maxFails: 10, windowMs: 10 * 60 * 1000, lockoutMs: 30 * 60 * 1000 },
}

// ---------------------------------------------------------------------------
// Constantes de roles
// ---------------------------------------------------------------------------

export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN:      'admin',
  TECNICO:    'tecnico',
  NOC:        'noc',
  RECEPCAO:   'recepcao',
  USER:       'user',
}

export const WRITE_ROLES  = [ROLES.SUPERADMIN, ROLES.ADMIN]
export const FIELD_ROLES  = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.TECNICO]
export const NOC_ROLES    = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.NOC]
// ALL_ROLES inclui todos os roles ativos do sistema
export const ALL_ROLES    = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.TECNICO, ROLES.NOC, ROLES.RECEPCAO, ROLES.USER]
// Roles que podem criar/executar Ordens de Serviço
export const OS_ROLES     = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.TECNICO, ROLES.NOC, ROLES.RECEPCAO]

// ---------------------------------------------------------------------------
// Hierarquia de roles para comparação numérica
// ---------------------------------------------------------------------------

const ROLE_RANK = {
  superadmin: 4,
  admin:      3,
  tecnico:    2,
  noc:        2,
  recepcao:   1,
  user:       1,
}

/**
 * Retorna true se `role` tem peso maior ou igual ao `minimum`.
 *
 * @param {string} role
 * @param {string} minimum
 * @returns {boolean}
 */
export function hasMinRole(role, minimum) {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[minimum] ?? 99)
}

// ---------------------------------------------------------------------------
// Rate limiting (MongoDB)
// ---------------------------------------------------------------------------

/**
 * Verifica se uma chave (IP ou user) está bloqueada.
 *
 * @param {string} key   — "ip:<addr>" ou "user:<name>"
 * @param {'ip'|'user'} kind
 * @returns {Promise<{ blocked: boolean, retryAfterMs?: number, count: number }>}
 */
async function rlCheck(key, kind) {
  const cfg    = kind === 'ip' ? RL.IP : RL.USER
  const since  = new Date(Date.now() - cfg.windowMs)

  const count = await LoginAttempt.countDocuments({
    key,
    kind,
    attempted_at: { $gte: since },
  })

  if (count >= cfg.maxFails) {
    // Busca a tentativa mais recente para calcular tempo restante
    const latest = await LoginAttempt.findOne(
      { key, kind, attempted_at: { $gte: since } },
      'attempted_at'
    ).sort({ attempted_at: -1 }).lean()

    const lockoutEndsAt  = (latest?.attempted_at?.getTime() ?? Date.now()) + cfg.lockoutMs
    const retryAfterMs   = Math.max(0, lockoutEndsAt - Date.now())
    return { blocked: true, retryAfterMs, count }
  }

  return { blocked: false, count }
}

/**
 * Registra uma tentativa de login falha.
 *
 * @param {string} key
 * @param {'ip'|'user'} kind
 * @param {string|null} username
 */
async function rlRecord(key, kind, username = null) {
  const cfg       = kind === 'ip' ? RL.IP : RL.USER
  const expiresAt = new Date(Date.now() + cfg.lockoutMs + cfg.windowMs)

  await LoginAttempt.create({
    key,
    kind,
    username,
    attempted_at: new Date(),
    expiresAt,
  })
}

/**
 * Remove as tentativas de uma chave após login bem-sucedido.
 *
 * @param {string} key
 * @param {'ip'|'user'} kind
 */
async function rlReset(key, kind) {
  await LoginAttempt.deleteMany({ key, kind })
}

// ---------------------------------------------------------------------------
// Single-session enforcement
// ---------------------------------------------------------------------------

// Mapa em memória: username → sessionToken ativo
// Em produção multi-instância substitua por Redis; para um servidor único
// o Map em memória é suficiente e evita dependência extra.
const activeSessionMap = new Map()

/**
 * Registra o token de sessão atual para um usuário, invalidando o anterior.
 *
 * @param {string} username
 * @param {string} sessionToken
 */
function registerSession(username, sessionToken) {
  activeSessionMap.set(username, sessionToken)
}

/**
 * Verifica se o token de sessão ainda é o ativo para este usuário.
 *
 * @param {string} username
 * @param {string} sessionToken
 * @returns {boolean}
 */
function isSessionValid(username, sessionToken) {
  const current = activeSessionMap.get(username)
  // Se não há registro (ex: após restart do servidor), aceita a sessão
  if (!current) return true
  return current === sessionToken
}

// ---------------------------------------------------------------------------
// Configuração NextAuth v5
// ---------------------------------------------------------------------------

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // NextAuth v5 usa AUTH_SECRET automaticamente; fallback para NEXTAUTH_SECRET
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  providers: [
    Credentials({
      name: 'FiberOps',

      credentials: {
        username:   { label: 'Usuário',   type: 'text'     },
        password:   { label: 'Senha',     type: 'password' },
        clientIp:   { label: 'Client IP', type: 'text'     }, // injetado pelo login action
      },

      /**
       * Valida as credenciais e aplica rate limiting.
       * Retorna o objeto user (que vai para o callback jwt) ou null.
       *
       * Em NextAuth v5 lançar um CredentialsSignin permite mensagens de erro
       * customizadas sem expor detalhes de segurança ao cliente.
       */
      async authorize(credentials) {
        const username  = String(credentials?.username ?? '').toLowerCase().trim()
        const password  = String(credentials?.password ?? '')
        const clientIp  = String(credentials?.clientIp ?? '127.0.0.1')

        if (!username || !password) return null

        await connectDB()

        // ── Rate limiting ─────────────────────────────────────────────────
        const ipKey   = `ip:${clientIp}`
        const userKey = `user:${username}`

        const [ipCheck, userCheck] = await Promise.all([
          rlCheck(ipKey,   'ip'),
          rlCheck(userKey, 'user'),
        ])

        if (ipCheck.blocked) {
          const mins = Math.ceil(ipCheck.retryAfterMs / 60000)
          throw new Error(
            `rate_limited:ip:Muitas tentativas. Tente em ${mins} min.`
          )
        }

        if (userCheck.blocked) {
          const mins = Math.ceil(userCheck.retryAfterMs / 60000)
          throw new Error(
            `rate_limited:user:Conta bloqueada temporariamente. Tente em ${mins} min.`
          )
        }

        // ── Busca o usuário ───────────────────────────────────────────────
        // select('+password_hash') é necessário porque o campo tem select:false
        const user = await User
          .findOne({ username, is_active: true })
          .select('+password_hash username role projeto_id empresa_id must_change_password')
          .lean()

        if (!user) {
          // Registra falha por IP sem revelar existência do usuário
          await rlRecord(ipKey, 'ip', username)
          return null
        }

        // ── Verifica a senha ──────────────────────────────────────────────
        const valid = await verifyPassword(password, user.password_hash)

        if (!valid) {
          await Promise.allSettled([
            rlRecord(ipKey,   'ip',   username),
            rlRecord(userKey, 'user', username),
          ])
          return null
        }

        // ── Login bem-sucedido: limpa contadores ──────────────────────────
        await Promise.allSettled([
          rlReset(ipKey,   'ip'),
          rlReset(userKey, 'user'),
        ])

        // ── Verificar status da Empresa (não-superadmin) ──────────────────
        let empresa = null
        if (user.role !== 'superadmin' && user.empresa_id) {
          const { Empresa } = await import('@/models/Empresa')
          empresa = await Empresa.findById(
            user.empresa_id,
            'razao_social slug status_assinatura data_vencimento trial_expira_em motivo_bloqueio'
          ).lean()

          if (!empresa) {
            throw new Error('tenant_not_found:Empresa não encontrada.')
          }

          if (empresa.status_assinatura === 'bloqueado') {
            throw new Error(
              `tenant_blocked:${empresa.motivo_bloqueio || 'Acesso bloqueado. Contate o administrador.'}`
            )
          }
          if (empresa.status_assinatura === 'vencido') {
            throw new Error('tenant_expired:Assinatura vencida. Regularize o pagamento.')
          }
          if (
            empresa.status_assinatura === 'trial' &&
            empresa.trial_expira_em &&
            empresa.trial_expira_em < new Date()
          ) {
            throw new Error('tenant_trial_expired:Período de teste encerrado.')
          }
        }

        // ── Busca nome do projeto ─────────────────────────────────────────
        let projeto_nome = user.projeto_id
        try {
          const projeto = await Projeto.findOne(
            { projeto_id: user.projeto_id },
            'nome'
          ).lean()
          if (projeto?.nome) projeto_nome = projeto.nome
        } catch {
          // Não bloqueia o login se o projeto não for encontrado
        }

        // ── Gera token de sessão único (single-session enforcement) ───────
        const sessionToken = crypto.randomBytes(32).toString('hex')
        registerSession(username, sessionToken)

        // ── Atualiza last_login de forma não-bloqueante ───────────────────
        User.updateOne({ _id: user._id }, { last_login: new Date() }).exec()

        return {
          id:                   user._id.toString(),
          username:             user.username,
          role:                 user.role,
          projeto_id:           user.projeto_id,
          projeto_nome,
          must_change_password: user.must_change_password ?? false,
          sessionToken,
          empresa_id:           user.empresa_id?.toString()      || null,
          empresa_slug:         empresa?.slug                    || null,
          empresa_nome:         empresa?.razao_social            || null,
          empresa_status:       empresa?.status_assinatura       || null,
        }
      },
    }),
  ],

  callbacks: {
    /**
     * jwt callback — estende o callback do authConfig com single-session enforcement
     * e re-verificação periódica do status da empresa (a cada 5 min).
     */
    async jwt({ token, user }) {
      if (user) {
        // Login inicial — copia todos os campos do objeto user para o token
        token.id                   = user.id
        token.username             = user.username
        token.role                 = user.role
        token.projeto_id           = user.projeto_id
        token.projeto_nome         = user.projeto_nome
        token.must_change_password = user.must_change_password
        token.sessionToken         = user.sessionToken
        token.empresa_id           = user.empresa_id
        token.empresa_slug         = user.empresa_slug
        token.empresa_nome         = user.empresa_nome
        token.empresa_status       = user.empresa_status
      } else if (token.username && token.sessionToken) {
        // Renovações subsequentes: valida single-session
        if (!isSessionValid(token.username, token.sessionToken)) {
          return null
        }

        // Re-verifica status da empresa a cada 5 minutos
        if (token.empresa_id) {
          const now       = Date.now()
          const lastCheck = token._empresa_checked_at || 0
          if (now - lastCheck > 5 * 60 * 1000) {
            try {
              const { verificarStatusEmpresa } = await import('@/lib/tenant')
              const result = await verificarStatusEmpresa(token.empresa_id)
              token.empresa_status        = result.status
              token._empresa_checked_at   = now
            } catch {
              // Silencioso — não interrompe a sessão por falha de verificação
            }
          }
        }
      }
      return token
    },

    async session({ session, token }) {
      if (!token) return null
      session.user.id                   = token.id
      session.user.username             = token.username
      session.user.role                 = token.role
      session.user.projeto_id           = token.projeto_id
      session.user.projeto_nome         = token.projeto_nome
      session.user.must_change_password = token.must_change_password
      session.user.empresa_id           = token.empresa_id
      session.user.empresa_slug         = token.empresa_slug
      session.user.empresa_nome         = token.empresa_nome
      session.user.empresa_status       = token.empresa_status
      return session
    },
  },
})

// ---------------------------------------------------------------------------
// Helpers de autorização para Server Components e Server Actions
// ---------------------------------------------------------------------------

/**
 * Retorna a sessão autenticada ou lança erro.
 * Usar no início de Server Actions que requerem autenticação.
 *
 * @returns {Promise<import('next-auth').Session>}
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Não autenticado')
  }
  return session
}

/**
 * Verifica se o usuário possui ao menos um dos roles permitidos.
 * Lança erro se não autenticado ou sem permissão.
 *
 * @param {string[]} allowedRoles
 * @returns {Promise<import('next-auth').Session>}
 */
export async function requireRole(allowedRoles) {
  const session = await requireAuth()
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error('Permissão insuficiente para esta operação')
  }
  return session
}

/**
 * Verifica se o usuário tem role mínimo na hierarquia.
 * Ex: requireMinRole('admin') aceita admin e superadmin.
 *
 * @param {string} minimumRole
 * @returns {Promise<import('next-auth').Session>}
 */
export async function requireMinRole(minimumRole) {
  const session = await requireAuth()
  if (!hasMinRole(session.user.role, minimumRole)) {
    throw new Error('Permissão insuficiente para esta operação')
  }
  return session
}
