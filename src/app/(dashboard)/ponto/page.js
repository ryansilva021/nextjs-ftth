import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPontoHoje } from '@/actions/time-record'
import { getMinhasSolicitacoes } from '@/actions/time-request'
import { getTimeSettings } from '@/actions/time-settings'
import PontoClient from '@/components/ponto/PontoClient'

export const metadata = { title: 'Bater Ponto · FiberOps' }

const ALLOWED = ['admin', 'tecnico', 'noc', 'recepcao']

export default async function PontoPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role } = session.user
  if (!ALLOWED.includes(role)) redirect('/')

  // Carrega dados em paralelo — sem loading flash no cliente
  const [initialRecord, initialRequests, projectSchedule] = await Promise.all([
    getPontoHoje().catch(() => null),
    getMinhasSolicitacoes({ limit: 40 }).catch(() => []),
    getTimeSettings().catch(() => null),
  ])

  // Passa o perfil diretamente da sessão (sem query extra ao banco)
  const userProfile = {
    username:     session.user.username,
    name:         session.user.name,
    nome_completo:session.user.nome_completo,
    email:        session.user.email,
    role:         session.user.role,
    projeto_nome: session.user.projeto_nome,
    empresa_nome: session.user.empresa_nome,
    empresa_slug: session.user.empresa_slug,
  }

  const displayName = session.user.nome_completo || session.user.name || session.user.username

  return (
    <PontoClient
      initialRecord={initialRecord}
      initialRequests={initialRequests}
      userName={displayName}
      userProfile={userProfile}
      projectSchedule={projectSchedule}
    />
  )
}
