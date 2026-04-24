import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import MapaFTTHClient from '@/components/map/MapaFTTHClient'

export default async function MapaPage() {
  const session = await auth()

  if (!session?.user) redirect('/login')

  return (
    <div className="h-full w-full relative">
      <MapaFTTHClient
        projetoId={session?.user?.projeto_id}
        userRole={session?.user?.role}
      />
    </div>
  )
}
