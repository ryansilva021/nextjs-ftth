import { auth } from '@/lib/auth'
import { getRotas } from '@/actions/rotas'
import RotasClient from '@/components/admin/RotasClient'

export const metadata = {
  title: 'Rotas de Fibra | FiberOps',
}

export default async function RotasPage() {
  const session = await auth()
  let rotas = []
  let erroCarregamento = null

  try {
    const featureCollection = await getRotas(session?.user?.projeto_id)
    // getRotas returns a GeoJSON FeatureCollection; extract features for the client
    rotas = featureCollection?.features ?? []
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Rotas de Fibra</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Traçados de rede óptica — {rotas.length} registros
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar rotas: {erroCarregamento}
        </div>
      )}

      <RotasClient
        rotasIniciais={rotas}
        projetoId={session?.user?.projeto_id}
        userRole={session?.user?.role}
      />
    </div>
  )
}
