/**
 * src/app/admin/diagramas/page.js
 * Página de gerenciamento de diagramas ópticos (CTOs, CE/CDOs e OLTs).
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCTOs } from '@/actions/ctos'
import { getCaixas } from '@/actions/caixas'
import { getOLTs } from '@/actions/olts'
import DiagramasClient from '@/components/admin/DiagramasClient'

export const metadata = { title: 'Fusões | FiberOps' }

const ROLE_RANK = { superadmin: 4, admin: 3, tecnico: 2, user: 1 }

export default async function DiagramasPage({ searchParams }) {
  const session = await auth()
  const projetoId = session?.user?.projeto_id

  // Somente admin e superadmin podem acessar Fusões ABNT
  const userRole = session?.user?.role ?? 'user'
  if ((ROLE_RANK[userRole] ?? 0) < ROLE_RANK.admin) redirect('/')

  const sp = await Promise.resolve(searchParams)
  const tipo      = sp?.tipo ?? null
  const idInicial = sp?.id   ?? null

  // Mapeia tipo=cto/cdo → aba interna
  const tabInicial = tipo === 'cto'  ? 'ctos'
                   : tipo === 'cdo'  ? 'cdos'
                   : (sp?.tab ?? null)

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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Fusões Ópticas</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {ctos.length} CTOs · {caixas.length} CE/CDOs · {olts.length} OLTs
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
