import { auth } from '@/lib/auth'
import { getPostes } from '@/actions/postes'
import PostesClient from '@/components/admin/PostesClient'

export const metadata = {
  title: 'Postes | FiberOps',
}

export default async function PostesPage() {
  const session = await auth()
  let postes = []
  let erroCarregamento = null

  try {
    postes = await getPostes(session?.user?.projeto_id)
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Postes</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Infraestrutura de postes da rede — {postes.length} registros
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar postes: {erroCarregamento}
        </div>
      )}

      <PostesClient
        postesIniciais={postes}
        projetoId={session?.user?.projeto_id}
        userRole={session?.user?.role}
      />
    </div>
  )
}
