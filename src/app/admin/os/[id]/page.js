/**
 * src/app/admin/os/[id]/page.js
 * Página de detalhes de uma Ordem de Serviço.
 * Acesso: superadmin, admin, noc, tecnico, recepcao
 */

import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getOS } from '@/actions/service-orders'
import OSDetailClient from '@/components/admin/os/OSDetailClient'

export async function generateMetadata({ params }) {
  return { title: `OS ${params.id} | FiberOps` }
}

const OS_VIEW = ['superadmin', 'admin', 'tecnico', 'noc', 'recepcao']

export default async function OSDetailPage({ params }) {
  const session = await auth()
  const role = session?.user?.role ?? 'user'

  if (!session?.user) redirect('/login')
  if (!OS_VIEW.includes(role)) redirect('/')

  let os = null
  try {
    os = await getOS(params.id)
  } catch (err) {
    if (err.message === 'OS não encontrada') notFound()
    // For other errors, still show the page with the error embedded
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          backgroundColor: '#450a0a', border: '1px solid #7f1d1d',
          borderRadius: 8, padding: '12px 16px',
          fontSize: 13, color: '#fca5a5',
        }}>
          Erro ao carregar OS: {err.message}
        </div>
      </div>
    )
  }

  // Serialize dates to strings so they cross the server→client boundary cleanly
  const osSerialized = JSON.parse(JSON.stringify(os))

  return (
    <OSDetailClient
      os={osSerialized}
      userRole={role}
      userName={session.user.name ?? session.user.username ?? session.user.email ?? ''}
    />
  )
}
