import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { listOS } from '@/actions/service-orders'
import MinhasOSClient from '@/components/admin/os/MinhasOSClient'
import { OS_ADMIN_ROLES } from '@/lib/os-config'

export const metadata = { title: 'Minhas OS · FiberOps' }

export default async function MinhasOSPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const role     = session.user.role
  const username = session.user.username ?? ''

  // Técnico tem view própria em /admin/os — não acessa o painel admin de OS
  if (role === 'tecnico') redirect('/admin/os')
  if (!OS_ADMIN_ROLES.includes(role)) redirect('/')

  let items = []
  let erro  = null

  try {
    const data = await listOS({ limit: 200 })
    items = data.items
  } catch (e) {
    erro = e.message
  }

  return (
    <MinhasOSClient
      initialItems={items}
      userRole={role}
      userId={username}
      pageTitle="Todas as OS"
      erro={erro}
    />
  )
}
