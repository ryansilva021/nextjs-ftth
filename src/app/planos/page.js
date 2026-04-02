import { auth } from '@/lib/auth'
import PlanosClient from './PlanosClient'

export const metadata = {
  title: 'Planos | FiberOps',
  description: 'Escolha o plano ideal para o seu provedor de internet.',
}

export default async function PlanosPage() {
  // Verifica se já está logado para adaptar os CTAs
  const session = await auth().catch(() => null)
  const logado  = !!session?.user
  const isAdmin = session?.user?.role === 'admin'

  return <PlanosClient logado={logado} isAdmin={isAdmin} />
}
