import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { hasMinRole } from '@/lib/auth'
import SidebarLayout from '@/components/shared/SidebarLayout'
import FiberColorProvider from '@/components/shared/FiberColorProvider'

export default async function AdminLayout({ children }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  if (!hasMinRole(session.user.role, 'tecnico')) {
    redirect('/')
  }

  const projectId = session.user.projeto_id ?? null

  return (
    <SidebarLayout session={session}>
      <FiberColorProvider projectId={projectId}>
        {children}
      </FiberColorProvider>
    </SidebarLayout>
  )
}
