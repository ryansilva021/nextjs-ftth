import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSystemConfig } from '@/actions/config'
import SystemConfigClient from '@/components/admin/configuracoes/SystemConfigClient'

export const metadata = { title: 'Configurações · FiberOps' }

const ADMIN_ROLES = ['superadmin', 'admin']

export default async function ConfiguracoesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!ADMIN_ROLES.includes(session.user.role)) redirect('/')

  const config = await getSystemConfig()

  return <SystemConfigClient initialConfig={config} />
}
