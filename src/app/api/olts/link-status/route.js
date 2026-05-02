/**
 * GET /api/olts/link-status
 * Retorna link_status, link_tested_at e link_error de todas as OLTs do projeto.
 * Usado pelo polling da UI — lê apenas MongoDB, nunca abre SSH.
 */
import { NextResponse }        from 'next/server'
import { auth }                from '@/lib/auth'
import { connectDB }           from '@/lib/db'
import { OLT }                 from '@/models/OLT'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { projeto_id } = session.user

  await connectDB()

  const olts = await OLT.find(
    { projeto_id },
    'id nome link_status link_tested_at link_error'
  ).lean()

  const status = {}
  for (const o of olts) {
    status[o.id] = {
      link_status:    o.link_status    ?? 'unknown',
      link_tested_at: o.link_tested_at ?? null,
      link_error:     o.link_error     ?? null,
    }
  }

  return NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
