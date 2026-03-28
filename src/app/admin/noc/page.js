import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getNOCStats } from '@/actions/noc'
import NOCClient from '@/components/admin/NOCClient'

export const metadata = { title: 'NOC | FiberOps' }

const ALLOWED = ['superadmin', 'admin', 'noc']

export default async function NOCPage() {
  const session = await auth()
  const role = session?.user?.role ?? 'user'
  if (!ALLOWED.includes(role)) redirect('/')

  let stats = null
  let erro = null
  try {
    stats = await getNOCStats(session?.user?.projeto_id)
  } catch (e) {
    erro = e.message
  }

  return (
    <div className="noc-page">
      <div style={{ marginBottom: 16 }}>
        <div className="noc-page-header">
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
            Centro de Operações de Rede
          </h1>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '2px 10px', borderRadius: 99,
            backgroundColor: '#16a34a22', border: '1px solid #16a34a55',
            fontSize: 11, color: '#4ade80', fontWeight: 600,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: '#4ade80', display: 'inline-block',
              animation: 'pulse 2s infinite',
            }} />
            AO VIVO
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Monitoramento FTTH · {session?.user?.projeto_nome ?? session?.user?.projeto_id}
        </p>
      </div>

      {erro && (
        <div style={{
          backgroundColor: '#450a0a', border: '1px solid #7f1d1d',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: '#fca5a5',
        }}>
          Erro ao carregar dados: {erro}
        </div>
      )}

      <NOCClient stats={stats} userRole={role} />
    </div>
  )
}
