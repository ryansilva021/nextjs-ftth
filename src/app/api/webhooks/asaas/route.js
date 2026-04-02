/**
 * src/app/api/webhooks/asaas/route.js
 *
 * Recebe eventos do Asaas e:
 *   A) Atualiza o status de assinatura de empresas existentes
 *   B) Cria Empresa + User admin para novos clientes que assinaram via /planos
 *
 * Configurar no painel Asaas:
 *   URL:   https://seudominio.com/api/webhooks/asaas
 *   Token: valor de ASAAS_WEBHOOK_TOKEN
 */

import { NextResponse } from 'next/server'
import { connectDB }    from '@/lib/db'
import { Empresa }      from '@/models/Empresa'
import { WebhookLog }   from '@/models/WebhookLog'
import { validateWebhookToken } from '@/lib/asaas'
import { criarContaParaCheckout } from '@/lib/checkout-onboarding'

const EVENT_STATUS_MAP = {
  PAYMENT_CONFIRMED:    'ativo',
  PAYMENT_RECEIVED:     'ativo',
  PAYMENT_OVERDUE:      'vencido',
  PAYMENT_DELETED:      null,
  SUBSCRIPTION_DELETED: 'vencido',
  SUBSCRIPTION_UPDATED: null,
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request) {
  // 1. Validar token
  const token = request.headers.get('asaas-access-token') || ''
  if (!validateWebhookToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parsear payload
  let payload
  try { payload = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const eventType    = payload?.event          || 'UNKNOWN'
  const payment      = payload?.payment        || {}
  const subscription = payload?.subscription   || {}

  const externalId = payment?.id || subscription?.id || null
  const customerId = payment?.customer || subscription?.customer || null

  await connectDB()

  // 3. Gravar log
  const log = await WebhookLog.create({
    provider:    'asaas',
    event_type:  eventType,
    external_id: externalId,
    payload,
  })

  // 4. Processar
  try {
    const newStatus = EVENT_STATUS_MAP[eventType]

    if (newStatus === undefined) {
      await WebhookLog.findByIdAndUpdate(log._id, { processed: true })
      return NextResponse.json({ ok: true, action: 'ignored' })
    }
    if (newStatus === null) {
      await WebhookLog.findByIdAndUpdate(log._id, { processed: true })
      return NextResponse.json({ ok: true, action: 'no_op' })
    }

    // Buscar empresa existente
    let empresa = null
    if (customerId) {
      empresa = await Empresa.findOne({ asaas_customer_id: customerId })
    }
    if (!empresa && subscription?.id) {
      empresa = await Empresa.findOne({ asaas_subscription_id: subscription.id })
    }

    // Se não encontrou empresa existente E é evento de confirmação → pode ser checkout público
    if (!empresa && newStatus === 'ativo' && customerId) {
      const { CheckoutPendente } = await import('@/models/CheckoutPendente')
      const checkout = await CheckoutPendente.findOne({
        asaas_customer_id: customerId,
        onboarding_completed: false,
      })

      if (checkout) {
        empresa = await criarContaParaCheckout(checkout)
        await WebhookLog.findByIdAndUpdate(log._id, {
          processed:  true,
          empresa_id: String(empresa._id),
        })
        return NextResponse.json({ ok: true, action: 'account_created' })
      }
    }

    // Empresa não encontrada (nem nova nem existente)
    if (!empresa) {
      await WebhookLog.findByIdAndUpdate(log._id, {
        processed: false,
        error:     `Empresa não encontrada para customer=${customerId}`,
      })
      return NextResponse.json({ ok: true, action: 'empresa_not_found' })
    }

    // Atualizar empresa existente
    const update = { status_assinatura: newStatus }
    if (newStatus === 'ativo' && payment?.dueDate) {
      const due = new Date(payment.dueDate)
      due.setDate(due.getDate() + 30)
      update.data_vencimento = due
    }
    await Empresa.findByIdAndUpdate(empresa._id, update)

    await WebhookLog.findByIdAndUpdate(log._id, {
      processed:  true,
      empresa_id: String(empresa._id),
    })

    // E-mails para empresa existente (não-bloqueante)
    import('@/lib/email').then(({ sendPaymentConfirmedEmail, sendPaymentFailedEmail, sendAccountSuspendedEmail }) => {
      if (newStatus === 'ativo') {
        sendPaymentConfirmedEmail(empresa).catch(() => {})
      } else if (newStatus === 'vencido' && eventType === 'PAYMENT_OVERDUE') {
        sendPaymentFailedEmail(empresa).catch(() => {})
      } else if (newStatus === 'vencido' && eventType === 'SUBSCRIPTION_DELETED') {
        sendAccountSuspendedEmail(empresa).catch(() => {})
      }
    }).catch(() => {})

    return NextResponse.json({ ok: true, action: 'updated', status: newStatus })

  } catch (err) {
    await WebhookLog.findByIdAndUpdate(log._id, {
      processed: false,
      error:     err?.message || 'Unknown error',
    }).catch(() => {})

    console.error('[webhook/asaas] Erro:', err)
    return NextResponse.json({ ok: false, error: 'processing_error' })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
