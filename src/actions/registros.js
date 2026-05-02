/**
 * src/actions/registros.js
 * Server Actions para auto-cadastro público e aprovação de registros.
 *
 * Mapeamento de endpoints:
 *   GET  /api/registro/check?login=   → checkLoginDisponivel(login)
 *   POST /api/registro                → criarRegistro(data)
 *   GET  /api/registros               → getRegistros()              [superadmin]
 *   POST /api/registros/aprovar       → aprovarRegistro(id, role?)
 *   POST /api/registros/rejeitar      → rejeitarRegistro(id, motivo?)
 */

'use server'

import { connectDB } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { RegistroPendente } from '@/models/RegistroPendente'
import { CheckoutPendente } from '@/models/CheckoutPendente'
import { User } from '@/models/User'
import { Projeto } from '@/models/Projeto'
import { Empresa } from '@/models/Empresa'

const SUPERADMIN_ONLY = ['superadmin']

// ---------------------------------------------------------------------------
// iniciarCheckoutPagamento — chamado pelo wizard antes da etapa de pagamento
// ---------------------------------------------------------------------------

const PLANO_CHECKOUT_MAP = {
  pro:        'pro',
  enterprise: 'enterprise',
}

/**
 * Cria/atualiza um CheckoutPendente com verified=true e credenciais preferidas.
 * Usado pelo wizard de cadastro para iniciar o fluxo de pagamento sem e-mail de verificação,
 * pois o e-mail já foi coletado e validado pelo wizard.
 *
 * @param {Object} p
 * @param {string} p.email
 * @param {string} p.empresa
 * @param {string} [p.cnpj]
 * @param {string} p.plano    — id interno: starter|pro|business|enterprise
 * @param {string} p.username — credencial desejada
 * @param {string} p.password — senha em texto plano (será hashada aqui)
 */
export async function iniciarCheckoutPagamento({ email, empresa, cnpj, plano, username, password }) {
  if (!email?.trim())    throw new Error('E-mail é obrigatório')
  if (!empresa?.trim())  throw new Error('Nome da empresa é obrigatório')
  if (!plano)            throw new Error('Plano é obrigatório')
  if (!username?.trim()) throw new Error('Usuário é obrigatório')
  if (!password)         throw new Error('Senha é obrigatória')

  const planoCheckout = PLANO_CHECKOUT_MAP[plano]
  if (!planoCheckout) throw new Error(`Plano "${plano}" não requer pagamento`)

  const normalizedUser = username.toLowerCase().trim()
  if (!/^[a-z0-9_.-]+$/.test(normalizedUser) || normalizedUser.length < 3) {
    throw new Error('Usuário inválido')
  }

  await connectDB()

  const preferred_password_hash = await hashPassword(password)

  await CheckoutPendente.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    {
      email:                   email.trim().toLowerCase(),
      empresa_nome:            empresa.trim(),
      cnpj:                    cnpj?.replace(/\D/g, '') || null,
      plano:                   planoCheckout,
      code:                    '000000',
      code_expires_at:         new Date(Date.now() + 60 * 60 * 1000),
      verified:                true,
      preferred_username:      normalizedUser,
      preferred_password_hash,
      asaas_customer_id:       null,
      asaas_subscription_id:   null,
      payment_id:              null,
      payment_method:          null,
      onboarding_completed:    false,
      expires_at:              new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
    { upsert: true, new: true }
  )

  return { ok: true }
}

// ---------------------------------------------------------------------------
// GET /api/registro/check?login= → checkLoginDisponivel
// ---------------------------------------------------------------------------

/**
 * Verifica se um username está disponível para cadastro.
 * Rota pública — não requer autenticação.
 *
 * @param {string} login
 * @returns {Promise<{ disponivel: boolean }>}
 */
export async function checkLoginDisponivel(login) {
  if (!login?.trim()) return { disponivel: false }

  const normalized = login.toLowerCase().trim()

  // Valida formato antes de consultar o banco
  if (!/^[a-z0-9_.-]+$/.test(normalized) || normalized.length < 3) {
    return { disponivel: false, motivo: 'login_invalido' }
  }

  await connectDB()

  const existeUser     = await User.exists({ username: normalized })
  const existeRegistro = await RegistroPendente.exists({ username: normalized, status: 'pendente' })

  return { disponivel: !existeUser && !existeRegistro }
}

// ---------------------------------------------------------------------------
// POST /api/registro → criarRegistro
// ---------------------------------------------------------------------------

/**
 * Cria um registro de auto-cadastro de empresa (aguarda aprovação do superadmin).
 * Rota pública — não requer autenticação.
 * Ao ser aprovado, cria automaticamente a Empresa, o Projeto (limite 500 CTOs)
 * e o usuário com role admin.
 *
 * @param {Object} data
 * @param {string} data.username       — obrigatório (admin da empresa)
 * @param {string} data.password       — obrigatório, mínimo 6 chars
 * @param {string} data.empresa        — nome da empresa (obrigatório)
 * @param {string} [data.email]
 * @param {string} [data.nome_completo]
 * @param {string} [data.telefone]
 * @returns {Promise<{ criado: boolean, mensagem: string }>}
 */
export async function criarRegistro(data) {
  const { username, password, email, nome_completo, telefone, empresa, plano } = data ?? {}

  if (!username?.trim()) throw new Error('username é obrigatório')
  if (!password)         throw new Error('password é obrigatório')
  if (!empresa?.trim())  throw new Error('nome da empresa é obrigatório')

  if (password.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres')

  const normalized = username.toLowerCase().trim()
  if (!/^[a-z0-9_.-]+$/.test(normalized)) {
    throw new Error('username deve conter apenas letras minúsculas, números, _ . e -')
  }

  const planoValido = ['free', 'pro', 'enterprise'].includes(plano) ? plano : 'pro'

  await connectDB()

  // Verifica disponibilidade do username
  const { disponivel } = await checkLoginDisponivel(normalized)
  if (!disponivel) throw new Error('Username já está em uso ou em análise')

  // Armazena senha hasheada (nunca em claro)
  const passwordHash = await hashPassword(password)

  await RegistroPendente.create({
    username:      normalized,
    password_hash: passwordHash,
    // projeto_id omitido — gerado pelo superadmin na aprovação
    email:         email?.trim()?.toLowerCase() ?? null,
    nome_completo: nome_completo?.trim()         ?? null,
    telefone:      telefone?.trim()              ?? null,
    empresa:       empresa.trim(),
    plano:         planoValido,
    status:        'pendente',
  })

  return {
    criado:   true,
    mensagem: 'Solicitação enviada. O superadmin irá analisar e aprovar seu cadastro.',
  }
}

// ---------------------------------------------------------------------------
// GET /api/registros → getRegistros
// ---------------------------------------------------------------------------

/**
 * Lista todos os registros pendentes/processados.
 * Requer: superadmin.
 *
 * @param {string} [status]  — 'pendente' | 'aprovado' | 'rejeitado' | undefined (todos)
 * @returns {Promise<Array>}
 */
export async function getRegistros(status) {
  await requireRole(SUPERADMIN_ONLY)
  await connectDB()

  const filter = {}
  if (status) filter.status = status

  const registros = await RegistroPendente.find(filter)
    .sort({ solicitado_em: -1 })
    .lean()

  return registros.map((r) => ({ ...r, _id: r._id.toString() }))
}

// ---------------------------------------------------------------------------
// POST /api/registros/aprovar → aprovarRegistro
// ---------------------------------------------------------------------------

/**
 * Gera um slug único a partir do nome da empresa.
 * Ex: "Fibra Rápida Telecom" → "fibra_rapida_telecom_a1b2"
 */
function gerarSlug(nomeEmpresa) {
  const base = nomeEmpresa
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  const sufixo = Math.random().toString(36).slice(2, 6)
  return `${base}_${sufixo}`
}

/**
 * Aprova um registro pendente, criando Empresa + Projeto (500 CTOs) + User admin.
 * Requer: superadmin.
 *
 * @param {string} registroId   — _id do RegistroPendente
 * @returns {Promise<{ aprovado: boolean, username: string, projeto_id: string }>}
 */
export async function aprovarRegistro(registroId) {
  const session = await requireRole(SUPERADMIN_ONLY)

  if (!registroId) throw new Error('registroId é obrigatório')

  await connectDB()

  const registro = await RegistroPendente.findById(registroId).select('+password_hash')
  if (!registro) throw new Error('Registro não encontrado')
  if (registro.status !== 'pendente') throw new Error('Registro já foi processado')

  // Verifica se o username ainda está livre
  const existeUser = await User.exists({ username: registro.username })
  if (existeUser) {
    registro.status = 'rejeitado'
    registro.motivo_rejeicao = 'Username já existe no sistema'
    registro.processado_em = new Date()
    registro.processado_por = session.user.username
    await registro.save()
    throw new Error('Username já existe no sistema')
  }

  // Gera slug único para empresa e projeto
  const nomeEmpresa = registro.empresa || registro.username
  let slug = gerarSlug(nomeEmpresa)
  // Garante unicidade do slug
  while (await Empresa.exists({ slug })) {
    slug = gerarSlug(nomeEmpresa)
  }
  const projetoId = slug

  // Mapeia plano escolhido para limites
  const planoMap = {
    starter:    { plano: 'basico',     maxCtos: 200,  maxUsuarios: 3,    trialDias: 15 },
    pro:        { plano: 'basico',     maxCtos: 500,  maxUsuarios: 10,   trialDias: 30 },
    enterprise: { plano: 'enterprise', maxCtos: null, maxUsuarios: null, trialDias: 30 },
  }
  const cfg = planoMap[registro.plano ?? 'pro'] ?? planoMap.pro

  // 1. Cria a Empresa
  const empresa = await Empresa.create({
    razao_social:       nomeEmpresa,
    slug,
    status_assinatura:  'trial',
    trial_expira_em:    new Date(Date.now() + cfg.trialDias * 24 * 60 * 60 * 1000),
    plano:              cfg.plano,
    email_contato:      registro.email ?? null,
    telefone_contato:   registro.telefone ?? null,
    projetos:           [projetoId],
    is_active:          true,
  })

  // 2. Cria o Projeto com limite conforme plano
  await Projeto.create({
    projeto_id: projetoId,
    nome:       nomeEmpresa,
    plano:      cfg.plano,
    ativo:      true,
    config: {
      maxCtos:              cfg.maxCtos,
      maxUsuarios:          cfg.maxUsuarios,
      registroPublicoAtivo: false,
      autoAprovarRegistro:  false,
      email:                registro.email ?? null,
      telefone:             registro.telefone ?? null,
    },
  })

  // 3. Cria o User como admin da empresa
  await User.create({
    username:      registro.username,
    password_hash: registro.password_hash,
    role:          'admin',
    projeto_id:    projetoId,
    empresa_id:    empresa._id.toString(),
    email:         registro.email ?? null,
    nome_completo: registro.nome_completo ?? null,
    is_active:     true,
  })

  // 4. Atualiza o registro com o projeto_id gerado
  registro.status         = 'aprovado'
  registro.projeto_id     = projetoId
  registro.processado_em  = new Date()
  registro.processado_por = session.user.username
  await registro.save()

  return { aprovado: true, username: registro.username, projeto_id: projetoId }
}

// ---------------------------------------------------------------------------
// POST /api/registros/rejeitar → rejeitarRegistro
// ---------------------------------------------------------------------------

/**
 * Rejeita um registro pendente.
 * Requer: superadmin.
 *
 * @param {string} registroId
 * @param {string} [motivo]
 * @returns {Promise<{ rejeitado: boolean }>}
 */
export async function rejeitarRegistro(registroId, motivo) {
  const session = await requireRole(SUPERADMIN_ONLY)

  if (!registroId) throw new Error('registroId é obrigatório')

  await connectDB()

  const registro = await RegistroPendente.findById(registroId)
  if (!registro)                    throw new Error('Registro não encontrado')
  if (registro.status !== 'pendente') throw new Error('Registro já foi processado')

  registro.status            = 'rejeitado'
  registro.motivo_rejeicao   = motivo?.trim() ?? null
  registro.processado_em     = new Date()
  registro.processado_por    = session.user.username
  await registro.save()

  return { rejeitado: true }
}
