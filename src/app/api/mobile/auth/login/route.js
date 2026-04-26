/**
 * POST /api/mobile/auth/login
 * Mobile JWT authentication — separate from NextAuth session.
 */

import { connectDB }      from '@/lib/db'
import { User }           from '@/models/User'
import { Projeto }        from '@/models/Projeto'
import { verifyPassword } from '@/lib/password'
import { signMobileToken } from '@/lib/mobile-jwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'tecnico', 'noc', 'recepcao', 'superadmin']

export async function POST(req) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return Response.json({ error: 'Usuário e senha são obrigatórios' }, { status: 400 })
    }

    await connectDB()

    const user = await User.findOne({ username: username.toLowerCase().trim() }).lean()
    if (!user) {
      return Response.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      return Response.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(user.role)) {
      return Response.json({ error: 'Acesso não permitido para este perfil' }, { status: 403 })
    }

    // Resolve projeto info
    const projeto = user.projeto_id
      ? await Projeto.findOne({ projeto_id: user.projeto_id }).lean()
      : null

    const payload = {
      sub:          user._id.toString(),
      username:     user.username,
      name:         user.nome_completo ?? user.name ?? user.username,
      role:         user.role,
      projeto_id:   user.projeto_id   ?? null,
      projeto_nome: projeto?.nome     ?? null,
      empresa_id:   user.empresa_id   ?? null,
    }

    const token = await signMobileToken(payload)

    return Response.json({
      token,
      user: payload,
    })
  } catch (err) {
    console.error('[mobile/auth/login]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
