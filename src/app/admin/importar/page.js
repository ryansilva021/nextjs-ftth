/**
 * src/app/admin/importar/page.js
 * Página de importação e exportação de dados do projeto.
 */

import { auth } from '@/lib/auth'
import { getCTOs } from '@/actions/ctos'
import { getCaixas } from '@/actions/caixas'
import { getRotas } from '@/actions/rotas'
import { getPostes } from '@/actions/postes'
import ImportarExportarClient from '@/components/admin/ImportarExportarClient'

export const metadata = { title: 'Importar / Exportar | FiberOps' }

export default async function ImportarPage() {
  const session = await auth()
  const projetoId = session?.user?.projeto_id

  let ctos   = []
  let caixas = []
  let rotas  = { type: 'FeatureCollection', features: [] }
  let postes = []

  try {
    ;[ctos, caixas, rotas, postes] = await Promise.all([
      getCTOs(projetoId),
      getCaixas(projetoId),
      getRotas(projetoId),
      getPostes(projetoId),
    ])
  } catch (e) {
    console.error('[ImportarPage] erro ao carregar dados:', e)
  }

  return (
    <div className="p-4 sm:p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Importar / Exportar</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {ctos.length} CTOs · {caixas.length} CDOs · {postes.length} Postes · {rotas?.features?.length ?? 0} Rotas
          </p>
        </div>
      </div>
      <ImportarExportarClient
        ctos={ctos}
        caixas={caixas}
        rotas={rotas}
        postes={postes}
        projetoId={projetoId}
      />
    </div>
  )
}
