/**
 * src/app/admin/os/new/page.js
 * Página de criação de nova Ordem de Serviço.
 * Acesso: superadmin, admin, noc, recepcao (NOT tecnico)
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/db'
import CreateOSClient from '@/components/admin/os/CreateOSClient'

export const metadata = { title: 'Nova OS | FiberOps' }

const ALLOWED = ['superadmin', 'admin', 'noc', 'recepcao']

export default async function NewOSPage() {
  const session = await auth()
  const role = session?.user?.role ?? 'user'

  if (!session?.user) redirect('/login')
  if (!ALLOWED.includes(role)) redirect('/admin/os')

  let tecnicos = []
  try {
    await connectDB()
    const { User } = await import('@/models/User')
    const projeto_id = session.user.projeto_id
    const docs = await User.find(
      { projeto_id, role: 'tecnico', is_active: true },
      'username name _id'
    ).lean()
    tecnicos = docs.map(u => ({
      id:    u._id.toString(),
      nome:  u.name ?? u.username,
      login: u.username,
    }))
  } catch {
    tecnicos = []
  }

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <a
          href="/admin/os"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 6,
            backgroundColor: '#ffffff0d', border: '1px solid var(--border-color)',
            color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          ← Voltar
        </a>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
          Nova Ordem de Serviço
        </h1>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '2px 10px', borderRadius: 99,
          backgroundColor: '#1d4ed822', border: '1px solid #1d4ed855',
          fontSize: 11, color: '#60a5fa', fontWeight: 600,
        }}>
          OS · Abertura
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Preencha os dados abaixo para abrir uma nova OS no sistema.
      </p>

      <CreateOSClient
        tecnicos={tecnicos}
        userRole={role}
        userName={session.user.name ?? session.user.email ?? ''}
      />
    </div>
  )
}
