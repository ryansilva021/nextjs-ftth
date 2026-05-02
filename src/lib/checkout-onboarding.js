/**
 * src/lib/checkout-onboarding.js
 *
 * Lógica compartilhada de criação de Empresa + User após pagamento confirmado.
 * Usado pelo webhook do Asaas e pelo polling de status do checkout.
 */

import { connectDB } from '@/lib/db'

function toSlug(str) {
  const base = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}

function toUsername(str) {
  const base = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}${suffix}`
}

function genTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < 10; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  return pwd
}

/**
 * Cria Empresa + User admin para um CheckoutPendente confirmado.
 * Idempotente: verifica se já foi criado antes de agir.
 *
 * @param {object} checkout — documento Mongoose do CheckoutPendente
 * @returns {Promise<object>} empresa criada
 */
export async function criarContaParaCheckout(checkout) {
  await connectDB()

  const { Empresa } = await import('@/models/Empresa')
  const { User }    = await import('@/models/User')
  const { hashPassword } = await import('@/lib/password')

  // Idempotência: se já existe empresa com esse customer_id, não recria
  if (checkout.asaas_customer_id) {
    const existing = await Empresa.findOne({ asaas_customer_id: checkout.asaas_customer_id }).lean()
    if (existing) {
      // Garante que o checkout fica marcado
      if (!checkout.onboarding_completed) {
        checkout.onboarding_completed = true
        await checkout.save()
      }
      return existing
    }
  }

  // Gerar slug único
  let slug
  let tries = 0
  while (tries < 5) {
    slug = toSlug(checkout.empresa_nome)
    const exists = await Empresa.findOne({ slug }).lean()
    if (!exists) break
    tries++
  }

  // Criar Empresa
  const empresa = await Empresa.create({
    razao_social:          checkout.empresa_nome,
    slug,
    email_contato:         checkout.email,
    cnpj:                  checkout.cnpj || null,
    plano:                 checkout.plano,
    status_assinatura:     'ativo',
    asaas_customer_id:     checkout.asaas_customer_id,
    asaas_subscription_id: checkout.asaas_subscription_id,
    asaas_payment_method:  checkout.payment_method,
    trial_expira_em:       null,
  })

  // Usa credenciais preferidas (wizard) ou gera automaticamente
  const usePreferred  = !!(checkout.preferred_username && checkout.preferred_password_hash)
  const username      = usePreferred ? checkout.preferred_username : toUsername(checkout.empresa_nome)
  const temp_password = usePreferred ? null : genTempPassword()
  const password_hash = usePreferred
    ? checkout.preferred_password_hash
    : await hashPassword(temp_password)

  await User.create({
    username,
    password_hash,
    role:                 'admin',
    projeto_id:           slug,
    empresa_id:           String(empresa._id),
    email:                checkout.email,
    nome_completo:        checkout.empresa_nome,
    must_change_password: !usePreferred,
    is_active:            true,
  })

  // Marcar checkout como concluído
  checkout.onboarding_completed = true
  await checkout.save()

  // Enviar e-mail de boas-vindas apenas quando usamos credenciais auto-geradas
  if (!usePreferred) {
    import('@/lib/email').then(({ sendWelcomeEmail }) => {
      sendWelcomeEmail({
        to:           checkout.email,
        empresa_nome: checkout.empresa_nome,
        username,
        temp_password,
        plano:        checkout.plano,
      }).catch(e => console.warn('[onboarding] Falha ao enviar e-mail de boas-vindas:', e?.message))
    }).catch(() => {})
  }

  console.log(`[onboarding] Nova conta criada: ${checkout.empresa_nome} / ${username}`)
  return empresa
}
