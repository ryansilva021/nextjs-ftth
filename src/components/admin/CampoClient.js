'use client'

import { useState } from 'react'
import CTOsClient   from '@/components/admin/CTOsClient'
import CaixasClient from '@/components/admin/CaixasClient'
import RotasClient  from '@/components/admin/RotasClient'
import PostesClient from '@/components/admin/PostesClient'
import OLTsClient   from '@/components/admin/OLTsClient'
import { limparDadosProjeto } from '@/actions/imports'

const TABS = [
  { id: 'olts',   label: 'OLTs',    icon: '🖥️', color: '#0891b2' },
  { id: 'caixas', label: 'CE / CDO', icon: '🔌', color: '#7c3aed' },
  { id: 'rotas',  label: 'Rotas',   icon: '〰️', color: '#059669' },
  { id: 'postes', label: 'Postes',  icon: '🏗️', color: '#d97706' },
  { id: 'ctos',   label: 'CTOs',    icon: '📦', color: '#ff8000' },
]

export default function CampoClient({
  ctosIniciais,
  caixasIniciais,
  rotasIniciais,
  postesIniciais,
  oltsIniciais,
  projetoId,
  userRole,
  tabInicial = 'ctos',
  idInicial  = null,
}) {
  const [abaAtiva,    setAbaAtiva]    = useState(tabInicial)
  const [limparEtapa, setLimparEtapa] = useState(0)   // 0=idle 1=confirm 2=loading 3=done
  const [limparResult, setLimparResult] = useState(null)

  const aba = TABS.find((t) => t.id === abaAtiva)

  const canEdit = userRole === 'admin' || userRole === 'superadmin'

  async function executarLimpar() {
    setLimparEtapa(2)
    try {
      const res = await limparDadosProjeto(projetoId)
      setLimparResult(res.totais)
      setLimparEtapa(3)
    } catch (err) {
      setLimparResult({ erro: err.message })
      setLimparEtapa(3)
    }
  }

  return (
    <div>
      {/* Header row: tabs + limpar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl overflow-x-auto"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', flex: 1 }}
        >
            {TABS.map((tab) => {
            const ativo = tab.id === abaAtiva
            return (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  backgroundColor: ativo ? tab.color + '22' : 'transparent',
                  color: ativo ? tab.color : 'var(--text-muted)',
                  border: ativo ? `1px solid ${tab.color}44` : '1px solid transparent',
                  minWidth: 80,
                }}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Limpar projeto (admin+) */}
        {canEdit && limparEtapa === 0 && (
          <button
            onClick={() => setLimparEtapa(1)}
            title="Limpar todos os dados do projeto"
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.35)',
              background: 'rgba(239,68,68,0.08)',
              color: '#ef4444',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            🗑 Limpar
          </button>
        )}
      </div>

      {/* Confirmação / resultado */}
      {limparEtapa === 1 && (
        <div style={{
          marginBottom: 20,
          padding: '14px 16px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10,
        }}>
          <div style={{ color: '#fca5a5', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
            ⚠️ Apagar todos os CTOs, CDOs, Postes e Rotas deste projeto?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setLimparEtapa(0)}
              style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border-color-strong)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}
            >
              Cancelar
            </button>
            <button
              onClick={executarLimpar}
              style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              Sim, apagar tudo
            </button>
          </div>
        </div>
      )}
      {limparEtapa === 2 && (
        <div style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: 13 }}>Limpando projeto…</div>
      )}
      {limparEtapa === 3 && limparResult && (
        <div style={{ marginBottom: 20, fontSize: 13 }}>
          {limparResult.erro ? (
            <span style={{ color: '#f87171' }}>Erro: {limparResult.erro}</span>
          ) : (
            <span style={{ color: '#4ade80' }}>
              ✓ Projeto limpo — {limparResult.ctos} CTOs, {limparResult.caixas} CDOs,{' '}
              {limparResult.postes} Postes, {limparResult.rotas} Rotas removidos.
            </span>
          )}
          {' '}
          <button
            onClick={() => { setLimparEtapa(0); setLimparResult(null) }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
          >
            Fechar
          </button>
        </div>
      )}

      {/* Conteúdo da aba */}
      {abaAtiva === 'ctos' && (
        <CTOsClient
          ctosIniciais={ctosIniciais}
          projetoId={projetoId}
          userRole={userRole}
          idInicial={tabInicial === 'ctos' ? idInicial : null}
        />
      )}
      {abaAtiva === 'caixas' && (
        <CaixasClient
          caixasIniciais={caixasIniciais}
          projetoId={projetoId}
          userRole={userRole}
          idInicial={tabInicial === 'caixas' ? idInicial : null}
        />
      )}
      {abaAtiva === 'rotas' && (
        <RotasClient
          rotasIniciais={rotasIniciais}
          projetoId={projetoId}
          userRole={userRole}
          idInicial={tabInicial === 'rotas' ? idInicial : null}
        />
      )}
      {abaAtiva === 'postes' && (
        <PostesClient
          postesIniciais={postesIniciais}
          projetoId={projetoId}
          userRole={userRole}
          idInicial={tabInicial === 'postes' ? idInicial : null}
        />
      )}
      {abaAtiva === 'olts' && (
        <OLTsClient
          oltsIniciais={oltsIniciais ?? []}
          projetoId={projetoId}
          userRole={userRole}
        />
      )}
    </div>
  )
}
