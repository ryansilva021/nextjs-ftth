import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEventos } from '@/actions/eventos'
import LogEventosClient from '@/components/admin/LogEventosClient'
import { hasPermission, PERM } from '@/lib/permissions'

export const metadata = { title: 'Log de Eventos | FiberOps' }

export default async function LogsPage() {
  const session = await auth()
  const userRole = session?.user?.role ?? 'user'
  if (!hasPermission(userRole, PERM.VIEW_LOGS)) redirect('/')

  const projetoId = session?.user?.projeto_id
  const eventos = await getEventos({ projeto_id: projetoId, limite: 100 })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Log de Eventos</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Histórico de ações realizadas no projeto — mais recente primeiro
        </p>
      </div>
      <LogEventosClient eventos={eventos} projetoId={projetoId} />
    </div>
  )
}
