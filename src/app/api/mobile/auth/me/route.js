/**
 * GET /api/mobile/auth/me
 * Returns the current authenticated user payload.
 */

import { verifyMobileToken, extractBearerToken } from '@/lib/mobile-jwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const token = extractBearerToken(req)
    if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 })

    const payload = await verifyMobileToken(token)
    return Response.json({
      sub:          payload.sub,
      username:     payload.username,
      name:         payload.name,
      role:         payload.role,
      projeto_id:   payload.projeto_id,
      projeto_nome: payload.projeto_nome,
      empresa_id:   payload.empresa_id,
    })
  } catch {
    return Response.json({ error: 'Token inválido ou expirado' }, { status: 401 })
  }
}
