/**
 * src/app/api/webhooks/asaas/route.js
 *
 * Recebe eventos do Asaas e atualiza o status de assinatura das empresas.
 *
 * Configurar no painel Asaas:
 *   URL:   https://seudominio.com/api/webhooks/asaas
 *   Token: valor de ASAAS_WEBHOOK_TOKEN
 *
 * Documentação dos eventos:
 *   https://docs.asaas.com/docs/notificacoes-webhooks
 */

import { NextResponse } from 'next/server'
import { connectDB }    from '@/lib/db'
import { Empresa }      from '@/models/Empresa'
import { WebhookLog }   from '@/models/WebhookLog'
import { validateWebhookToken } from '@/lib/asaas'

// Mapeamento evento → novo status de assinatura
const EVENT_STATUS_MAP = {
  PAYMENT_CONFIRMED:     'ativo',
  PAYMENT_RECEIVED:      'ativo',
  PAYMENT_OVERDUE:       'vencido',
  PAYMENT_DELETED:       null,        // ignorar
  SUBSCRIPTION_DELETED:  'vencido',
  SUBSCRIPTION_UPDATED:  null,        // ignorar (só log)
}

export async function POST(request) {
  // ── 1. Validar token ───────────────────────────────────────────────────────
  const token = request.headers.get('asaas-access-token') || ''
  if (!validateWebhookToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parsear payload ─────────────────────────────────────────────────────
  let payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType  = payload?.event        || 'UNKNOWN'
  const payment    = payload?.payment      || {}
  const subscription = payload?.subscription || {}

  // ID externo do objeto principal
  const externalId = payment?.id || subscription?.id || null

  // Asaas identifica o cliente — buscamos a empresa pelo asaas_customer_id
  const customerId = payment?.customer || subscription?.customer || null

  await connectDB()

  // ── 3. Gravar log (sempre, antes de processar) ─────────────────────────────
  const log = await WebhookLog.create({
    provider:    'asaas',
    event_type:  eventType,
    external_id: externalId,
    payload,
  })

  // ── 4. Processar evento ────────────────────────────────────────────────────
  try {
    const newStatus = EVENT_STATUS_MAP[eventType]

    // Evento desconhecido ou sem ação — retorna 200 para evitar retry do Asaas
    if (newStatus === undefined) {
      await WebhookLog.findByIdAndUpdate(log._id, { processed: true })
      return NextResponse.json({ ok: true, action: 'ignored' })
    }

    if (newStatus === null) {
      await WebhookLog.findByIdAndUpdate(log._id, { processed: true })
      return NextResponse.json({ ok: true, action: 'no_op' })
    }

    // Encontrar empresa pelo asaas_customer_id
    let empresa = null
    if (customerId) {
      empresa = await Empresa.findOne({ asaas_customer_id: customerId })
    }

    // Fallback: buscar pelo asaas_subscription_id
    if (!empresa && subscription?.id) {
      empresa = await Empresa.findOne({ asaas_subscription_id: subscription.id })
    }

    if (!empresa) {
      await WebhookLog.findByIdAndUpdate(log._id, {
        processed: false,
        error:     `Empresa não encontrada para customer=${customerId}`,
      })
      // Retorna 200 mesmo assim — não queremos que o Asaas fique tentando
      return NextResponse.json({ ok: true, action: 'empresa_not_found' })
    }

    // Montar update
    const update = { status_assinatura: newStatus }

    if (newStatus === 'ativo' && payment?.dueDate) {
      // Próximo vencimento = data atual + 30 dias (ou data do próximo pagamento)
      const due = new Date(payment.dueDate)
      due.setDate(due.getDate() + 30)
      update.data_vencimento = due
    }

    await Empresa.findByIdAndUpdate(empresa._id, update)

    // Atualizar log com empresa_id
    await WebhookLog.findByIdAndUpdate(log._id, {
      processed:  true,
      empresa_id: String(empresa._id),
    })

    // ── 5. Disparar e-mail (não-bloqueante) ──────────────────────────────────
    // Importação dinâmica para evitar carregar Resend no edge
    if (typeof process !== 'undefined') {
      import('@/lib/email-triggers').then(({ sendPaymentConfirmedEmail, sendPaymentFailedEmail, sendAccountSuspendedEmail }) => {
        try {
          if (newStatus === 'ativo') {
            sendPaymentConfirmedEmail(empresa).catch(() => {})
          } else if (newStatus === 'vencido' && eventType === 'PAYMENT_OVERDUE') {
            sendPaymentFailedEmail(empresa).catch(() => {})
          } else if (newStatus === 'vencido' && eventType === 'SUBSCRIPTION_DELETED') {
            sendAccountSuspendedEmail(empresa).catch(() => {})
          }
        } catch { /* não falhar o webhook por causa de e-mail */ }
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, action: 'updated', status: newStatus })

  } catch (err) {
    await WebhookLog.findByIdAndUpdate(log._id, {
      processed: false,
      error:     err?.message || 'Unknown error',
    }).catch(() => {})

    console.error('[webhook/asaas] Erro ao processar evento:', err)

    // Sempre retorna 200 para evitar retry em loop do Asaas
    return NextResponse.json({ ok: false, error: 'processing_error' })
  }
}

// Rejeitar outros métodos
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
