/**
 * src/app/api/auth/[...nextauth]/route.js
 *
 * Handler de rota para NextAuth v5 no App Router do Next.js 16.
 *
 * NextAuth v5 exporta `handlers` diretamente do arquivo de configuração.
 * O objeto `handlers` contém os métodos GET e POST prontos para o App Router.
 *
 * NÃO adicionar lógica de negócio aqui — toda a configuração fica em
 * src/lib/auth.js para permitir reuso em Server Components e Server Actions.
 */

export const runtime = 'nodejs'

import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
