'use client'

import { useState } from 'react'
import CTOsClient   from '@/components/admin/CTOsClient'
import CaixasClient from '@/components/admin/CaixasClient'
import RotasClient  from '@/components/admin/RotasClient'
import PostesClient from '@/components/admin/PostesClient'

const TABS = [
  { id: 'ctos',   label: 'CTOs',    icon: '📦', color: '#0284c7' },
  { id: 'caixas', label: 'CE / CDO', icon: '🔌', color: '#7c3aed' },
  { id: 'rotas',  label: 'Rotas',   icon: '〰️', color: '#059669' },
  { id: 'postes', label: 'Postes',  icon: '🏗️', color: '#d97706' },
]

export default function CampoClient({
  ctosIniciais,
  caixasIniciais,
  rotasIniciais,
  postesIniciais,
  projetoId,
  userRole,
}) {
  const [abaAtiva, setAbaAtiva] = useState('ctos')

  const aba = TABS.find((t) => t.id === abaAtiva)

  return (
    <div>
      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6"
        style={{ backgroundColor: '#0d1526', border: '1px solid #1f2937' }}
      >
        {TABS.map((tab) => {
          const ativo = tab.id === abaAtiva
          return (
            <button
              key={tab.id}
              onClick={() => setAbaAtiva(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: ativo ? tab.color + '22' : 'transparent',
                color: ativo ? tab.color : '#64748b',
                border: ativo ? `1px solid ${tab.color}44` : '1px solid transparent',
              }}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Conteúdo da aba */}
      {abaAtiva === 'ctos' && (
        <CTOsClient
          ctosIniciais={ctosIniciais}
          projetoId={projetoId}
          userRole={userRole}
        />
      )}
      {abaAtiva === 'caixas' && (
        <CaixasClient
          caixasIniciais={caixasIniciais}
          projetoId={projetoId}
          userRole={userRole}
        />
      )}
      {abaAtiva === 'rotas' && (
        <RotasClient
          rotasIniciais={rotasIniciais}
          projetoId={projetoId}
          userRole={userRole}
        />
      )}
      {abaAtiva === 'postes' && (
        <PostesClient
          postesIniciais={postesIniciais}
          projetoId={projetoId}
          userRole={userRole}
        />
      )}
    </div>
  )
}
