import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { listOS, getOSStats } from '@/actions/service-orders'
import { getOLTs } from '@/actions/olts'
import { getUsuarios } from '@/actions/usuarios'
import ServiceOrdersClient from '@/components/admin/ServiceOrdersClient'

export const metadata = { title: 'Ordens de Serviço | FiberOps' }

const ALLOWED = ['superadmin', 'admin', 'noc', 'recepcao', 'tecnico']

export default async function OSPage() {
  const session = await auth()
  const role = session?.user?.role ?? 'user'
  if (!ALLOWED.includes(role)) redirect('/')

  let initialData = { items: [], total: 0 }
  let stats = null
  let olts = []
  let usuarios = []
  let erro = null

  const isTecnico = role === 'tecnico'

  try {
    const promises = [
      listOS({ limit: 100 }),
      getOSStats(),
      getOLTs(session?.user?.projeto_id),
      isTecnico ? Promise.resolve([]) : getUsuarios(session?.user?.projeto_id),
    ]
    const [data, s, o, u] = await Promise.all(promises)
    initialData = data
    stats = s
    olts = o
    usuarios = u.filter(u => u.is_active !== false)
  } catch (e) {
    erro = e.message
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
          Ordens de Serviço
        </h1>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '2px 10px', borderRadius: 99,
          backgroundColor: '#1d4ed822', border: '1px solid #1d4ed855',
          fontSize: 11, color: '#60a5fa', fontWeight: 600,
        }}>
          OS · Fluxo FTTH
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Instalações, manutenções e suporte técnico · {session?.user?.projeto_nome ?? session?.user?.projeto_id}
      </p>

      {erro && (
        <div style={{
          backgroundColor: '#450a0a', border: '1px solid #7f1d1d',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: '#fca5a5',
        }}>
          Erro ao carregar dados: {erro}
        </div>
      )}

      <ServiceOrdersClient
        initialItems={initialData.items}
        initialTotal={initialData.total}
        stats={stats}
        olts={olts}
        usuarios={usuarios}
        userRole={role}
        userId={session?.user?.username ?? ''}
        userName={session?.user?.name ?? session?.user?.email ?? ''}
      />
    </div>
  )
}
