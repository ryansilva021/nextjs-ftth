import { auth }      from '@/lib/auth'
import { getCTOs }   from '@/actions/ctos'
import { getCaixas } from '@/actions/caixas'
import { getRotas }  from '@/actions/rotas'
import { getPostes } from '@/actions/postes'
import { getOLTs }   from '@/actions/olts'
import CampoClient   from '@/components/admin/CampoClient'
import PageHeading from '@/components/shared/PageHeading'

export const metadata = {
  title: 'Campo | FiberOps',
}

export default async function CampoPage({ searchParams }) {
  const session   = await auth()
  const projetoId = session?.user?.projeto_id
  const userRole  = session?.user?.role
  const sp = await Promise.resolve(searchParams)
  const tabInicial = sp?.tab ?? 'ctos'
  const idInicial  = sp?.id  ?? null

  const [ctos, caixas, rotasFC, postes, olts] = await Promise.allSettled([
    getCTOs(projetoId),
    getCaixas(projetoId),
    getRotas(projetoId),
    getPostes(projetoId),
    getOLTs(projetoId),
  ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : [])))

  const rotas = rotasFC?.features ?? []

  return (
    <div className="p-6">
      <div className="mb-6">
        <PageHeading titleKey="campo.title" subtitleKey="campo.subtitle" />
      </div>

      <CampoClient
        ctosIniciais={ctos}
        caixasIniciais={caixas}
        rotasIniciais={rotas}
        postesIniciais={postes}
        oltsIniciais={olts}
        projetoId={projetoId}
        userRole={userRole}
        tabInicial={tabInicial}
        idInicial={idInicial}
      />
    </div>
  )
}
