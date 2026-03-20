import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { hasMinRole } from '@/lib/auth'
import SidebarLayout from '@/components/shared/SidebarLayout'

export default async function AdminLayout({ children }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  if (!hasMinRole(session.user.role, 'tecnico')) {
    redirect('/')
  }

  return <SidebarLayout session={session}>{children}</SidebarLayout>
}
