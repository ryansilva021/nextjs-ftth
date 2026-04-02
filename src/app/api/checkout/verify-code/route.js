/**
 * POST /api/checkout/verify-code
 *
 * Valida o código de 6 dígitos enviado ao e-mail.
 *
 * Body: { email, code }
 * Returns: { ok: true, plano, empresa_nome } | { error }
 */

import { NextResponse } from 'next/server'
import { connectDB }    from '@/lib/db'

export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { email, code } = body ?? {}

  if (!email || !code) {
    return NextResponse.json({ error: 'email e code são obrigatórios' }, { status: 400 })
  }

  try {
    await connectDB()
  } catch (err) {
    console.error('[checkout/verify-code] DB error:', err)
    return NextResponse.json({ error: 'Erro de conexão com o banco de dados.' }, { status: 500 })
  }

  const { CheckoutPendente } = await import('@/models/CheckoutPendente')

  const checkout = await CheckoutPendente.findOne({ email })

  if (!checkout) {
    return NextResponse.json({ error: 'Nenhum checkout encontrado para este e-mail. Reinicie o processo.' }, { status: 404 })
  }

  if (checkout.code_expires_at < new Date()) {
    return NextResponse.json({ error: 'Código expirado. Solicite um novo código.' }, { status: 400 })
  }

  if (checkout.code !== String(code).trim()) {
    return NextResponse.json({ error: 'Código incorreto.' }, { status: 400 })
  }

  checkout.verified = true
  await checkout.save()

  return NextResponse.json({
    ok:           true,
    plano:        checkout.plano,
    empresa_nome: checkout.empresa_nome,
  })
}
