/**
 * middleware.js
 * Middleware de autenticação e controle de acesso por rota.
 *
 * Usa NextAuth v5 (Edge Runtime) com authConfig.
 * A lógica de permissões por role está em authConfig.authorized.
 *
 * Fluxo:
 *   1. Rotas públicas → passa direto
 *   2. Não autenticado → redireciona para /login
 *   3. Role insuficiente → redireciona para /acesso-negado
 *   4. Autorizado → continua
 */

import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

export default NextAuth(authConfig).auth

export const config = {
  /*
   * Roda em todas as rotas exceto:
   *   - Arquivos estáticos do Next.js (_next/static, _next/image)
   *   - Ícones (favicon.ico)
   *   - Imagens públicas
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
}
