import { auth } from '@/lib/auth'
import TopologiaFlowClient from './TopologiaFlowClient'

export const metadata = {
  title: 'Diagramas | FiberOps',
}

export default async function TopologiaPage() {
  const session = await auth()

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <span className="text-xl">🌐</span>
        <div>
          <h1 className="text-lg font-bold leading-tight" style={{ color: 'var(--foreground)' }}>Diagramas de Rede</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>OLT → CDO / CE → Splitter → CTO</p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <TopologiaFlowClient projetoId={session?.user?.projeto_id} userRole={session?.user?.role} />
      </div>
    </div>
  )
}
