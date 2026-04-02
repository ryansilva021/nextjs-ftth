/**
 * GET /api/checkout/status?email=...
 *
 * Verifica se o pagamento foi confirmado e a conta foi criada.
 *
 * Fluxo:
 *   1. Checa onboarding_completed no CheckoutPendente (webhook já processou)
 *   2. Se não, consulta o status do pagamento diretamente na API do Asaas
 *   3. Se pagamento confirmado, cria a conta na hora (fallback para dev/webhook falho)
 */

import { NextResponse } from 'next/server'
import { connectDB }    from '@/lib/db'

const PAID_STATUSES = ['RECEIVED', 'CONFIRMED']

export async function GET(request) {
  const email = request.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 })

  await connectDB()
  const { CheckoutPendente } = await import('@/models/CheckoutPendente')

  const checkout = await CheckoutPendente.findOne({ email })

  if (!checkout) {
    return NextResponse.json({ confirmed: false, not_found: true })
  }

  // Caminho rápido: webhook já processou
  if (checkout.onboarding_completed) {
    return NextResponse.json({ confirmed: true, payment_method: checkout.payment_method })
  }

  // Sem payment_id ainda não dá pra consultar o Asaas
  if (!checkout.payment_id) {
    return NextResponse.json({ confirmed: false, payment_method: checkout.payment_method })
  }

  // Consultar o Asaas diretamente (funciona em dev sem webhook)
  try {
    const { getPayment } = await import('@/lib/asaas')
    const payment = await getPayment(checkout.payment_id)

    if (!PAID_STATUSES.includes(payment.status)) {
      return NextResponse.json({
        confirmed: false,
        payment_status: payment.status,
        payment_method: checkout.payment_method,
      })
    }

    // Pagamento confirmado → criar conta agora
    const { criarContaParaCheckout } = await import('@/lib/checkout-onboarding')
    await criarContaParaCheckout(checkout)

    return NextResponse.json({ confirmed: true, payment_method: checkout.payment_method })

  } catch (err) {
    console.error('[checkout/status] Erro ao verificar Asaas:', err?.message)
    // Não bloqueia o cliente — retorna não confirmado
    return NextResponse.json({ confirmed: false, payment_method: checkout.payment_method })
  }
}
