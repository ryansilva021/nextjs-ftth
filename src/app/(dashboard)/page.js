import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()

  if (session?.user?.role === 'superadmin') {
    redirect('/superadmin/stats')
  }

  redirect('/visao-geral')
}
