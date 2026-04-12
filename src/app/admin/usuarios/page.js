import { auth } from '@/lib/auth'
import { getUsuarios } from '@/actions/usuarios'
import UsuariosClient from '@/components/admin/UsuariosClient'

export const metadata = {
  title: 'Usuários | FiberOps',
}

export default async function UsuariosPage() {
  const session = await auth()
  let usuarios = []
  let erroCarregamento = null

  try {
    usuarios = await getUsuarios(session?.user?.projeto_id)
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Usuários</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Gerenciamento de usuários — {usuarios.length} registros
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar usuários: {erroCarregamento}
        </div>
      )}

      <UsuariosClient
        usuariosIniciais={usuarios}
        projetoId={session?.user?.projeto_id}
        userRole={session?.user?.role}
        currentUsername={session?.user?.username}
      />
    </div>
  )
}
