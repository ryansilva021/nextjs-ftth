import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAssinaturaStatus } from '@/actions/assinatura'
import AssinaturaClient from './AssinaturaClient'

export const metadata = { title: 'Assinatura | FiberOps' }

export default async function AssinaturaPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'admin') redirect('/')

  let dados = null
  let erro  = null
  try {
    dados = await getAssinaturaStatus()
  } catch (e) {
    erro = e.message
  }

  return <AssinaturaClient dados={dados} erro={erro} />
}
