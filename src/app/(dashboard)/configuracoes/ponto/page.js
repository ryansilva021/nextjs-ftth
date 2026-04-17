import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTimeSettings } from '@/actions/time-settings'
import PontoConfigClient from '@/components/configuracoes/PontoConfigClient'

export const metadata = { title: 'Config. Ponto · FiberOps' }

const ALLOWED = ['superadmin', 'admin']

export default async function PontoConfigPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!ALLOWED.includes(session.user.role)) redirect('/configuracoes')

  const settings = await getTimeSettings().catch(() => null)

  return <PontoConfigClient initialSettings={settings} />
}
