import { auth } from '@/lib/auth'
import { getCaixas } from '@/actions/caixas'
import CaixasClient from '@/components/admin/CaixasClient'

export const metadata = {
  title: 'Caixas CE/CDO | FiberOps',
}

export default async function CaixasPage() {
  const session = await auth()
  let caixas = []
  let erroCarregamento = null

  try {
    caixas = await getCaixas(session?.user?.projeto_id)
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Caixas CE / CDO</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Caixas de Emenda e Distribuição Óptica — {caixas.length} registros
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar caixas: {erroCarregamento}
        </div>
      )}

      <CaixasClient
        caixasIniciais={caixas}
        projetoId={session?.user?.projeto_id}
        userRole={session?.user?.role}
      />
    </div>
  )
}
