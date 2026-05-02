import { auth } from '@/lib/auth'
import { getOLTs } from '@/actions/olts'
import OLTsClient from '@/components/admin/OLTsClient'

export const metadata = {
  title: 'Integrações / OLTs | FiberOps',
}

export default async function OLTsPage() {
  const session = await auth()
  let olts = []
  let erroCarregamento = null

  try {
    olts = await getOLTs(session?.user?.projeto_id)
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Integrações / OLTs</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Optical Line Terminals — {olts.length} registros
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar OLTs: {erroCarregamento}
        </div>
      )}

      <OLTsClient
        oltsIniciais={olts}
        projetoId={session?.user?.projeto_id}
        userRole={session?.user?.role}
      />
    </div>
  )
}
