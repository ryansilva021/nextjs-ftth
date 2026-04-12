/**
 * src/app/admin/calculos/page.js
 * Página de cálculo de potência óptica FTTH.
 */

import { auth } from '@/lib/auth'
import { getTopologiaLista } from '@/actions/topologia'
import CalculoPotenciaClient from '@/components/admin/CalculoPotenciaClient'

export const metadata = { title: 'Cálculo de Potência | FiberOps' }

export default async function CalculosPage() {
  const session  = await auth()
  const projetoId = session?.user?.projeto_id

  let topologia = { olts: [], ctos: [] }
  try {
    topologia = await getTopologiaLista(projetoId)
  } catch (e) {
    console.error('[CalculosPage]', e)
  }

  return (
    <div className="p-4 sm:p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Cálculo de Potência FTTH</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {topologia.ctos.length} CTOs · {topologia.olts.length} OLTs detectados
          </p>
        </div>
      </div>
      <CalculoPotenciaClient topologia={topologia} projetoId={projetoId} />
    </div>
  )
}
