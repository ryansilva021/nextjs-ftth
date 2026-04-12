import { auth } from '@/lib/auth'
import { getMovimentacoes } from '@/actions/movimentacoes'
import MovimentacoesClient from '@/components/admin/MovimentacoesClient'

export const metadata = {
  title: 'Movimentações | FiberOps',
}

export default async function MovimentacoesPage() {
  const session = await auth()
  let movimentacoes = []
  let erroCarregamento = null

  try {
    movimentacoes = await getMovimentacoes(session?.user?.projeto_id)
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Movimentações</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Histórico de instalações e desinstalações — {movimentacoes.length} registros
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar movimentações: {erroCarregamento}
        </div>
      )}

      <MovimentacoesClient
        movimentacoesIniciais={movimentacoes}
        projetoId={session?.user?.projeto_id}
        userRole={session?.user?.role}
      />
    </div>
  )
}
