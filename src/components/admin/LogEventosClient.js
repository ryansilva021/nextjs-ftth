'use client'

import { useState, useTransition } from 'react'
import { getEventos } from '@/actions/eventos'

const TIPO_LABEL = {
  criou:   { label: 'Criou',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  editou:  { label: 'Editou',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  excluiu: { label: 'Excluiu', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

const ENTIDADE_ICON = {
  cto: '📡', caixa: '🔷', rota: '〰️', poste: '🪝', olt: '🖥️',
  fusao: '🧩', usuario: '👤',
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function LogEventosClient({ eventos: initial, projetoId }) {
  const [eventos, setEventos] = useState(initial)
  const [busca, setBusca] = useState('')
  const [pending, startTransition] = useTransition()

  function handleBusca(e) {
    const v = e.target.value
    setBusca(v)
    startTransition(async () => {
      const fresh = await getEventos({ projeto_id: projetoId, busca: v, limite: 100 })
      setEventos(fresh)
    })
  }

  return (
    <div>
      {/* Campo de busca */}
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
        <input
          value={busca}
          onChange={handleBusca}
          placeholder="Buscar por item, usuário, ação..."
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color-strong)',
            color: 'var(--foreground)', borderRadius: 10,
            padding: '10px 16px 10px 38px', fontSize: 14, outline: 'none',
          }}
        />
        {pending && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12 }}>...</span>}
      </div>

      {/* Lista */}
      {eventos.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
          Nenhum evento encontrado.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {eventos.map(ev => {
          const tipo = TIPO_LABEL[ev.tipo_acao] ?? { label: ev.tipo_acao, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
          const icon = ENTIDADE_ICON[ev.entidade] ?? '📄'
          return (
            <div key={ev.id} style={{
              backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)',
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {/* Ícone entidade */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: tipo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: tipo.color,
                    background: tipo.bg, borderRadius: 5, padding: '2px 7px',
                  }}>
                    {tipo.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.item_nome || ev.item_id}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {ev.entidade?.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  👤 {ev.username || '—'}  ·  🕐 {formatDate(ev.timestamp)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {eventos.length >= 100 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
          Mostrando os 100 eventos mais recentes.
        </p>
      )}
    </div>
  )
}
