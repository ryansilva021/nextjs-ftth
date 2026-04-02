/**
 * POST /api/checkout/send-verification
 *
 * Gera e envia um código de 6 dígitos para o e-mail do prospecto.
 * Cria ou substitui um registro CheckoutPendente para o e-mail informado.
 *
 * Body: { email, empresa_nome, plano, cnpj? }
 */

import { NextResponse } from 'next/server'
import crypto           from 'crypto'
import { connectDB }    from '@/lib/db'

export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { email, empresa_nome, plano, cnpj } = body ?? {}

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
  }
  if (!empresa_nome || empresa_nome.trim().length < 2) {
    return NextResponse.json({ error: 'Nome da empresa é obrigatório' }, { status: 400 })
  }
  if (!['basico', 'pro', 'enterprise'].includes(plano)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  try {
    await connectDB()
    const { CheckoutPendente } = await import('@/models/CheckoutPendente')

    const code            = String(crypto.randomInt(100000, 999999))
    const code_expires_at = new Date(Date.now() + 15 * 60 * 1000)

    await CheckoutPendente.findOneAndUpdate(
      { email },
      {
        email,
        empresa_nome:          empresa_nome.trim(),
        plano,
        cnpj:                  cnpj?.replace(/\D/g, '') || null,
        code,
        code_expires_at,
        verified:              false,
        asaas_customer_id:     null,
        asaas_subscription_id: null,
        payment_id:            null,
        payment_method:        null,
        onboarding_completed:  false,
        expires_at:            new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
      { upsert: true, new: true }
    )

    // Envia e-mail de verificação
    let emailError = null
    try {
      const { sendVerificationCode } = await import('@/lib/email')
      await sendVerificationCode({ to: email, code, plano, empresa_nome: empresa_nome.trim() })
    } catch (emailErr) {
      emailError = emailErr?.message || String(emailErr)
      console.error('[checkout] Falha ao enviar e-mail:', emailError, '| código dev:', code)
    }

    // Se não conseguiu enviar o e-mail, retorna o erro para o cliente poder exibir
    if (emailError) {
      return NextResponse.json({
        ok:          false,
        email_error: emailError,
        // Em dev, disponibiliza o código para não bloquear o teste
        dev_code:    process.env.NODE_ENV !== 'production' ? code : undefined,
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[checkout/send-verification]', err)
    return NextResponse.json(
      { error: 'Erro interno ao processar. Tente novamente.' },
      { status: 500 }
    )
  }
}
