'use server'

/**
 * Server Actions para gerenciamento de assinatura via Asaas.
 */

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'

// Guard simples: só admin pode gerenciar assinatura da própria empresa
async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error('Não autenticado')
  if (session.user.role !== 'admin') throw new Error('Apenas administradores podem gerenciar a assinatura')
  if (!session.user.empresa_id) throw new Error('Empresa não encontrada na sessão')
  return session
}

// ---------------------------------------------------------------------------
// GET — dados da assinatura atual
// ---------------------------------------------------------------------------

export async function getAssinaturaStatus() {
  const session = await requireAdmin()
  await connectDB()

  const { Empresa } = await import('@/models/Empresa')
  const empresa = await Empresa.findById(
    session.user.empresa_id,
    'razao_social email_contato plano status_assinatura trial_expira_em data_vencimento ' +
    'asaas_customer_id asaas_subscription_id asaas_payment_method'
  ).lean()

  if (!empresa) throw new Error('Empresa não encontrada')

  // Buscar pagamentos recentes se houver assinatura
  let pagamentos = []
  if (empresa.asaas_subscription_id) {
    try {
      const { listSubscriptionPayments } = await import('@/lib/asaas')
      const result = await listSubscriptionPayments(empresa.asaas_subscription_id, 5)
      pagamentos = result?.data ?? []
    } catch { /* silencioso — não bloqueia a página */ }
  }

  return {
    razao_social:          empresa.razao_social,
    email:                 empresa.email_contato,
    plano:                 empresa.plano ?? 'trial',
    status:                empresa.status_assinatura,
    trial_expira_em:       empresa.trial_expira_em?.toISOString() ?? null,
    data_vencimento:       empresa.data_vencimento?.toISOString() ?? null,
    tem_assinatura:        !!empresa.asaas_subscription_id,
    metodo_pagamento:      empresa.asaas_payment_method ?? null,
    pagamentos,
  }
}

// ---------------------------------------------------------------------------
// POST — criar ou trocar assinatura
// ---------------------------------------------------------------------------

/**
 * @param {{ plano: string, billing_type: 'PIX'|'BOLETO'|'CREDIT_CARD', cpf_cnpj?: string }} data
 * @returns {{ success: boolean, payment_url?: string, message?: string }}
 */
export async function assinarPlano(data) {
  const session = await requireAdmin()
  const { plano, billing_type, cpf_cnpj } = data

  if (!['basico', 'pro', 'enterprise'].includes(plano)) {
    return { success: false, message: 'Plano inválido' }
  }
  if (!['PIX', 'BOLETO', 'CREDIT_CARD'].includes(billing_type)) {
    return { success: false, message: 'Forma de pagamento inválida' }
  }

  await connectDB()
  const { Empresa } = await import('@/models/Empresa')
  const empresa = await Empresa.findById(
    session.user.empresa_id,
    'razao_social email_contato asaas_customer_id asaas_subscription_id plano'
  )
  if (!empresa) return { success: false, message: 'Empresa não encontrada' }

  const { createCustomer, createSubscription, cancelSubscription } = await import('@/lib/asaas')

  try {
    // 1. Criar/buscar cliente no Asaas
    let customerId = empresa.asaas_customer_id
    if (!customerId) {
      const customer = await createCustomer({
        name:     empresa.razao_social,
        email:    empresa.email_contato ?? session.user.email,
        cpfCnpj: cpf_cnpj || undefined,
      })
      customerId = customer.id
      empresa.asaas_customer_id = customerId
    }

    // 2. Cancelar assinatura anterior se existir
    if (empresa.asaas_subscription_id) {
      try {
        await cancelSubscription(empresa.asaas_subscription_id)
      } catch { /* ignora se já cancelada */ }
    }

    // 3. Criar nova assinatura
    const subscription = await createSubscription(customerId, plano, billing_type)

    // 4. Atualizar empresa
    empresa.plano                  = plano
    empresa.asaas_subscription_id  = subscription.id
    empresa.asaas_payment_method   = billing_type
    // Status só muda para 'ativo' quando o webhook confirmar o pagamento;
    // por ora mantém 'trial' ou status atual até a confirmação
    await empresa.save()

    // 5. Buscar primeira cobrança e retornar dados de pagamento completos
    let paymentData = {}
    try {
      const { listSubscriptionPayments, getPixQrCode, getBoletoBarcode } = await import('@/lib/asaas')
      const payments = await listSubscriptionPayments(subscription.id, 1)
      const first = payments?.data?.[0]

      if (first) {
        paymentData.payment_id  = first.id
        paymentData.invoice_url = first.invoiceUrl ?? null
        paymentData.due_date    = first.dueDate ?? null
        paymentData.value       = first.value ?? null

        if (billing_type === 'PIX') {
          try {
            const pix = await getPixQrCode(first.id)
            paymentData.pix_encoded_image = pix.encodedImage ?? null
            paymentData.pix_payload       = pix.payload ?? null
            paymentData.pix_expiration    = pix.expirationDate ?? null
          } catch { /* silencioso */ }
        }

        if (billing_type === 'BOLETO') {
          try {
            const boleto = await getBoletoBarcode(first.id)
            paymentData.boleto_barcode  = boleto.identificationField ?? null
            paymentData.boleto_pdf_url  = first.bankSlipUrl ?? null
          } catch { /* silencioso */ }
        }

        if (billing_type === 'CREDIT_CARD') {
          paymentData.credit_card_url = first.invoiceUrl ?? null
        }
      }
    } catch { /* silencioso */ }

    return {
      success:         true,
      subscription_id: subscription.id,
      billing_type,
      ...paymentData,
      message: billing_type === 'CREDIT_CARD'
        ? 'Assinatura criada! Finalize o pagamento pelo checkout seguro.'
        : 'Assinatura criada. Realize o pagamento para ativar o plano.',
    }
  } catch (err) {
    console.error('[assinarPlano]', err)
    return { success: false, message: err.message ?? 'Erro ao criar assinatura' }
  }
}

// ---------------------------------------------------------------------------
// GET — verificar status de um pagamento específico
// ---------------------------------------------------------------------------

/**
 * Verifica se um pagamento já foi confirmado.
 * @param {string} paymentId
 */
export async function checkPaymentStatus(paymentId) {
  await requireAdmin()
  if (!paymentId) return { success: false, message: 'paymentId ausente' }

  try {
    const { getPayment } = await import('@/lib/asaas')
    const payment = await getPayment(paymentId)
    return {
      success: true,
      status:  payment.status, // PENDING | RECEIVED | CONFIRMED | OVERDUE | ...
      confirmed: ['RECEIVED', 'CONFIRMED'].includes(payment.status),
    }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

// ---------------------------------------------------------------------------
// POST — cancelar assinatura
// ---------------------------------------------------------------------------

export async function cancelarAssinatura() {
  const session = await requireAdmin()
  await connectDB()

  const { Empresa } = await import('@/models/Empresa')
  const empresa = await Empresa.findById(
    session.user.empresa_id,
    'asaas_subscription_id plano status_assinatura'
  )
  if (!empresa) return { success: false, message: 'Empresa não encontrada' }
  if (!empresa.asaas_subscription_id) return { success: false, message: 'Sem assinatura ativa' }

  try {
    const { cancelSubscription } = await import('@/lib/asaas')
    await cancelSubscription(empresa.asaas_subscription_id)

    empresa.asaas_subscription_id = null
    empresa.status_assinatura     = 'vencido'
    await empresa.save()

    return { success: true, message: 'Assinatura cancelada' }
  } catch (err) {
    return { success: false, message: err.message ?? 'Erro ao cancelar' }
  }
}
