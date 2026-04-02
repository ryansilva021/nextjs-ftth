/**
 * src/proxy.js
 *
 * Proxy (middleware) do Next.js 16 — substitui middleware.js.
 * Usa apenas auth.config.js que é Edge Runtime compatível.
 *
 * A lógica de autorização por role está no callback `authorized` do authConfig.
 * Proteção mais granular (admin, superadmin) é feita nos layouts de Server Component.
 *
 * Rate limiting em memória:
 *   - /login POST: 10 tentativas / 10 min por IP
 *   - /api/*: 120 req / 60 s por IP
 *
 * Verificação de empresa (multi-tenant):
 *   - Lê empresa_status do JWT (sem consulta ao DB no Edge)
 *   - Redireciona para /empresa/bloqueada se status for bloqueado/vencido/trial_expirado
 *   - Superadmin é isento desta verificação
 */

import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

// ---------------------------------------------------------------------------
// Rate limiting em memória (Edge-compatible — sem Node.js APIs)
// ---------------------------------------------------------------------------

/** @type {Map<string, { count: number, resetAt: number }>} */
const rlStore = new Map()

function maybePruneRLStore() {
  if (Math.random() > 0.005) return
  const now = Date.now()
  for (const [key, entry] of rlStore.entries()) {
    if (entry.resetAt < now) rlStore.delete(key)
  }
}

function rateLimit(key, maxReqs, windowMs) {
  maybePruneRLStore()
  const now   = Date.now()
  const entry = rlStore.get(key)

  if (!entry || entry.resetAt < now) {
    rlStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxReqs - 1, resetAt: now + windowMs }
  }

  entry.count++
  if (entry.count > maxReqs) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  return { allowed: true, remaining: maxReqs - entry.count, resetAt: entry.resetAt }
}

// ---------------------------------------------------------------------------
// Hierarquia de roles
// ---------------------------------------------------------------------------

const ROLE_RANK = { superadmin: 4, admin: 3, tecnico: 2, user: 1 }

function hasMinRole(role, minimum) {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[minimum] ?? 99)
}

// ---------------------------------------------------------------------------
// Proxy principal
// ---------------------------------------------------------------------------

export default auth(function proxy(request) {
  const { nextUrl } = request
  const pathname    = nextUrl.pathname
  const session     = request.auth
  const isAuthenticated = !!session?.user

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

  // ── Rate limiting no login ─────────────────────────────────────────────────
  if (pathname === '/login' && request.method === 'POST') {
    const rl = rateLimit(`login:${ip}`, 10, 10 * 60 * 1000)
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Muitas tentativas. Tente novamente mais tarde.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After':  String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      )
    }
  }

  // ── Rate limiting genérico de API ──────────────────────────────────────────
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
    const rl = rateLimit(`api:${ip}`, 120, 60 * 1000)
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Rate limit excedido.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After':  String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      )
    }
  }

  // ── Rotas públicas ─────────────────────────────────────────────────────────
  const publicRoutes = ['/login', '/cadastro']
  const isPublic = publicRoutes.includes(pathname) ||
    pathname.startsWith('/planos') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/registro') ||
    pathname.startsWith('/api/checkout')

  if (isPublic) {
    if (isAuthenticated && publicRoutes.includes(pathname)) {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
    return NextResponse.next()
  }

  // ── Sem sessão ─────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const userRole = session.user?.role ?? ''

  // ── Troca de senha obrigatória ─────────────────────────────────────────────
  if (session.user?.must_change_password && pathname !== '/perfil/senha') {
    return NextResponse.redirect(new URL('/perfil/senha', nextUrl))
  }

  // ── Verificação de status da Empresa (multi-tenant) ────────────────────────
  // Lê empresa_status diretamente do JWT — sem consulta ao DB no Edge Runtime.
  // A re-verificação real ocorre no jwt callback do auth.js (Node.js) a cada 5 min.
  const empresaStatus = session.user?.empresa_status
  const isSuperadmin  = userRole === 'superadmin'

  if (
    !isSuperadmin &&
    empresaStatus &&
    ['bloqueado', 'vencido', 'trial_expirado'].includes(empresaStatus)
  ) {
    // Permite apenas rotas de auth, página de bloqueio e assinatura (para o admin pagar)
    const allowedPaths = ['/empresa/bloqueada', '/api/auth', '/login', '/admin/assinatura']
    const isAllowed = allowedPaths.some((p) => pathname.startsWith(p))
    if (!isAllowed) {
      return NextResponse.redirect(new URL('/empresa/bloqueada', request.url))
    }
  }

  // ── Rotas superadmin ───────────────────────────────────────────────────────
  if (pathname.startsWith('/superadmin')) {
    if (!hasMinRole(userRole, 'superadmin')) {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
  }

  // ── Rotas admin ────────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!hasMinRole(userRole, 'admin')) {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
  }

  // ── Headers de segurança (todas as rotas autenticadas) ─────────────────────
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  return response
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
}
