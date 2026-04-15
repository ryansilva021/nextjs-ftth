import { auth }      from '@/lib/auth'
import { redirect }   from 'next/navigation'
import { hasPermission, PERM } from '@/lib/permissions'
import { getCTOs }    from '@/actions/ctos'
import { getCaixas }  from '@/actions/caixas'
import { getOLTs }    from '@/actions/olts'
import DiagramasClient from '@/components/admin/DiagramasClient'

export const metadata = { title: 'Topologia | FiberOps' }

export default async function TopologiaPage({ searchParams }) {
  const session  = await auth()
  const userRole = session?.user?.role ?? 'user'
  const projetoId = session?.user?.projeto_id

  if (!hasPermission(userRole, PERM.VIEW_TOPOLOGY)) redirect('/')

  const sp        = await Promise.resolve(searchParams)
  const tabInicial = sp?.tab ?? 'topologia'   // abre o canvas por padrão
  const idInicial  = sp?.id  ?? null

  let ctos   = []
  let caixas = []
  let olts   = []
  let erroCarregamento = null

  try {
    ;[ctos, caixas, olts] = await Promise.all([
      getCTOs(projetoId),
      getCaixas(projetoId),
      getOLTs(projetoId),
    ])
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="lg:p-6 p-4">
      <div className="hidden lg:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Topologia da Rede</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {olts.length} OLTs · {caixas.length} CE/CDOs · {ctos.length} CTOs
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
          Erro ao carregar dados: {erroCarregamento}
        </div>
      )}

      <DiagramasClient
        ctos={ctos}
        caixas={caixas}
        olts={olts}
        projetoId={projetoId}
        tabInicial={tabInicial}
        idInicial={idInicial}
        userRole={userRole}
      />
    </div>
  )
}
