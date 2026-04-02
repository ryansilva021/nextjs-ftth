/**
 * POST /api/checkout/create-subscription
 *
 * Cria o cliente + assinatura no Asaas para um checkout verificado.
 * Retorna os dados de pagamento: PIX QR code, boleto ou URL do cartão.
 *
 * Body: { email, billing_type: 'PIX'|'BOLETO'|'CREDIT_CARD' }
 */

import { NextResponse }    from 'next/server'
import { connectDB }       from '@/lib/db'

export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { email, billing_type } = body ?? {}

  if (!email) {
    return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 })
  }
  if (!['PIX', 'BOLETO', 'CREDIT_CARD'].includes(billing_type)) {
    return NextResponse.json({ error: 'billing_type inválido' }, { status: 400 })
  }

  await connectDB()
  const { CheckoutPendente } = await import('@/models/CheckoutPendente')

  const checkout = await CheckoutPendente.findOne({ email })

  if (!checkout) {
    return NextResponse.json({ error: 'Checkout não encontrado. Reinicie o processo.' }, { status: 404 })
  }
  if (!checkout.verified) {
    return NextResponse.json({ error: 'E-mail não verificado.' }, { status: 400 })
  }

  try {
    const {
      createCustomer,
      createSubscription,
      listSubscriptionPayments,
      getPixQrCode,
      getBoletoBarcode,
    } = await import('@/lib/asaas')

    // 1. Criar/buscar cliente no Asaas
    const customer = await createCustomer({
      name:     checkout.empresa_nome,
      email:    checkout.email,
      cpfCnpj: checkout.cnpj || undefined,
    })

    // 2. Criar assinatura
    const subscription = await createSubscription(customer.id, checkout.plano, billing_type)

    // 3. Buscar primeiro pagamento (retry — Asaas sandbox pode demorar alguns ms)
    let firstPayment = null
    for (let attempt = 0; attempt < 4; attempt++) {
      const paymentsResult = await listSubscriptionPayments(subscription.id, 1)
      firstPayment = paymentsResult?.data?.[0] ?? null
      if (firstPayment) break
      await new Promise(r => setTimeout(r, 800))
    }

    // 4. Buscar dados de pagamento conforme método
    let paymentData = {
      payment_id:  firstPayment?.id  ?? null,
      invoice_url: firstPayment?.invoiceUrl ?? null,
      due_date:    firstPayment?.dueDate ?? null,
      value:       firstPayment?.value ?? null,
    }

    if (billing_type === 'PIX' && firstPayment?.id) {
      try {
        const pix = await getPixQrCode(firstPayment.id)
        paymentData.pix_encoded_image = pix.encodedImage ?? null
        paymentData.pix_payload       = pix.payload ?? null
        paymentData.pix_expiration    = pix.expirationDate ?? null
      } catch (e) {
        console.warn('[checkout] PIX QR code error:', e?.message)
      }
    }

    if (billing_type === 'BOLETO' && firstPayment?.id) {
      try {
        const boleto = await getBoletoBarcode(firstPayment.id)
        paymentData.boleto_barcode  = boleto.identificationField ?? null
        paymentData.boleto_pdf_url  = firstPayment.bankSlipUrl ?? null
      } catch (e) {
        console.warn('[checkout] Boleto barcode error:', e?.message)
      }
    }

    if (billing_type === 'CREDIT_CARD') {
      paymentData.credit_card_url = firstPayment?.invoiceUrl ?? null
    }

    // 5. Salvar IDs no CheckoutPendente para o webhook usar
    checkout.asaas_customer_id     = customer.id
    checkout.asaas_subscription_id = subscription.id
    checkout.payment_id            = firstPayment?.id ?? null
    checkout.payment_method        = billing_type
    await checkout.save()

    return NextResponse.json({
      ok:           true,
      billing_type,
      empresa_nome: checkout.empresa_nome,
      plano:        checkout.plano,
      ...paymentData,
    })

  } catch (err) {
    console.error('[checkout/create-subscription]', err)
    return NextResponse.json(
      { error: err.message ?? 'Erro ao criar assinatura. Tente novamente.' },
      { status: 500 }
    )
  }
}
