import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { listOS } from '@/actions/service-orders'
import MinhasOSClient from '@/components/admin/os/MinhasOSClient'

export const metadata = { title: 'Minhas OS · FiberOps' }

const ALLOWED = ['superadmin', 'admin', 'noc', 'recepcao', 'tecnico']

export default async function MinhasOSPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const role = session.user.role
  if (!ALLOWED.includes(role)) redirect('/')

  let items = []
  let erro  = null

  try {
    // listOS já filtra automaticamente por tecnico_id para role=tecnico
    // Para outros roles, filtra por criado_por via query extra (abaixo)
    const data = await listOS({ limit: 100 })
    items = data.items
  } catch (e) {
    erro = e.message
  }

  return (
    <MinhasOSClient
      initialItems={items}
      userRole={role}
      userId={session.user.username ?? ''}
      erro={erro}
    />
  )
}
