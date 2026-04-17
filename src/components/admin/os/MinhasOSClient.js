'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { reagendarOS } from '@/actions/service-orders'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  aberta:       { label: 'Aberta',       bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa',  border: 'rgba(59,130,246,0.3)'  },
  agendada:     { label: 'Agendada',     bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24',  border: 'rgba(245,158,11,0.3)'  },
  em_andamento: { label: 'Em andamento', bg: 'rgba(168,85,247,0.15)',  color: '#c084fc',  border: 'rgba(168,85,247,0.3)'  },
  concluida:    { label: 'Concluída',    bg: 'rgba(34,197,94,0.15)',   color: '#4ade80',  border: 'rgba(34,197,94,0.3)'   },
  cancelada:    { label: 'Cancelada',    bg: 'rgba(239,68,68,0.12)',   color: '#f87171',  border: 'rgba(239,68,68,0.3)'   },
}

const TIPO_CFG = {
  instalacao:  { label: 'Instalação',  icon: '🔧' },
  manutencao:  { label: 'Manutenção',  icon: '🔨' },
  suporte:     { label: 'Suporte',     icon: '📞' },
  cancelamento:{ label: 'Cancelamento',icon: '❌' },
}

function fmtDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── Reagendar Modal ──────────────────────────────────────────────────────────

function ReagendarModal({ os, onClose, onSuccess }) {
  const today = new Date().toISOString().split('T')[0]
  const [data, setData] = useState(
    os.data_agendamento ? new Date(os.data_agendamento).toISOString().split('T')[0] : today
  )
  const [pending, startTrans] = useTransition()
  const [error, setError] = useState(null)

  const handleSave = () => {
    setError(null)
    startTrans(async () => {
      const res = await reagendarOS(os.os_id, data)
      if (res?.error) { setError(res.error); return }
      onSuccess(res.os)
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--card-bg, #0f172a)',
        border: '1px solid var(--border-color, #1e293b)',
        borderRadius: 20, padding: 24, width: '100%', maxWidth: 360,
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: 'var(--foreground)' }}>
          📅 Reagendar OS
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          {os.os_id} · {os.cliente_nome}
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          Nova data de agendamento
        </label>
        <input
          type="date"
          value={data}
          min={today}
          onChange={e => setData(e.target.value)}
          style={{
            width: '100%', padding: '12px', borderRadius: 10,
            background: 'var(--input-bg, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            color: 'var(--foreground)', fontSize: 16,
            fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box',
          }}
        />

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '10px 12px', marginBottom: 16,
            fontSize: 13, color: '#f87171',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: 12,
            background: 'var(--input-bg, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={pending || !data}
            style={{
              flex: 2, padding: '12px', borderRadius: 12, border: 'none',
              background: pending ? '#374151' : '#ea580c',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: pending ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              boxShadow: pending ? 'none' : '0 4px 16px rgba(234,88,12,0.3)',
            }}
          >
            {pending ? 'Salvando…' : '📅 Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de OS ───────────────────────────────────────────────────────────────

function OSCard({ os, userRole, onReagendar }) {
  const sc   = STATUS_CFG[os.status]   ?? STATUS_CFG.aberta
  const tc   = TIPO_CFG[os.tipo]       ?? { label: os.tipo, icon: '📋' }
  const podeConcluida = ['concluida', 'cancelada'].includes(os.status)

  return (
    <div style={{
      background: 'var(--card-bg, #0f172a)',
      border: '1px solid var(--border-color, #1e293b)',
      borderRadius: 14, overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid var(--border-color, #1e293b)',
        gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>{tc.icon}</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{os.os_id}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{tc.label}</span>
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
        }}>
          {sc.label}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>
          👤 {os.cliente_nome || '—'}
        </div>
        {os.cliente_endereco && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            📍 {os.cliente_endereco}
          </div>
        )}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
          {os.data_agendamento && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              📅 Agendado: <strong style={{ color: 'var(--foreground)' }}>{fmtDate(os.data_agendamento)}</strong>
            </span>
          )}
          {os.tecnico_nome && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              🔧 {os.tecnico_nome}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--border-color, #1e293b)',
        display: 'flex', gap: 8, flexWrap: 'wrap',
      }}>
        <Link
          href={`/admin/os/${os.os_id}`}
          style={{
            flex: 1, textAlign: 'center', padding: '9px 12px', borderRadius: 10,
            background: 'var(--input-bg, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            color: 'var(--foreground)', fontSize: 12, fontWeight: 600,
            textDecoration: 'none', display: 'block',
          }}
        >
          Ver detalhes →
        </Link>

        {!podeConcluida && (
          <button
            onClick={() => onReagendar(os)}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 10,
              background: 'rgba(234,88,12,0.12)',
              border: '1px solid rgba(234,88,12,0.3)',
              color: '#ea580c', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            📅 Reagendar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: 'todas',       label: 'Todas' },
  { key: 'aberta',      label: 'Abertas' },
  { key: 'agendada',    label: 'Agendadas' },
  { key: 'em_andamento',label: 'Em andamento' },
  { key: 'concluida',   label: 'Concluídas' },
]

export default function MinhasOSClient({ initialItems, userRole, userId, erro }) {
  const [items,        setItems]        = useState(initialItems ?? [])
  const [filtro,       setFiltro]       = useState('todas')
  const [reagendarOS,  setReagendarOS]  = useState(null)

  const filtrados = filtro === 'todas'
    ? items
    : items.filter(o => o.status === filtro)

  const handleReagendarSuccess = (osAtualizada) => {
    setItems(prev => prev.map(o => o.os_id === osAtualizada.os_id ? osAtualizada : o))
    setReagendarOS(null)
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--background)',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      color: 'var(--foreground)',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--card-bg, #0f172a)',
        borderBottom: '1px solid var(--border-color, #1e293b)',
        padding: '16px 16px 0',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            Ordens de Serviço
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Minhas OS</h1>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.3)',
            }}>
              {filtrados.length} OS
            </span>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 0, scrollbarWidth: 'none' }}>
            {STATUS_FILTERS.map(f => {
              const active = filtro === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  style={{
                    flexShrink: 0, padding: '8px 14px',
                    background: 'none', border: 'none',
                    borderBottom: `2px solid ${active ? '#ea580c' : 'transparent'}`,
                    color: active ? '#ea580c' : 'var(--text-muted)',
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ padding: '16px', maxWidth: 600, margin: '0 auto' }}>
        {erro && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16,
            fontSize: 13, color: '#f87171',
          }}>
            Erro ao carregar: {erro}
          </div>
        )}

        {filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Nenhuma OS encontrada</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              {filtro !== 'todas' ? 'Tente outro filtro.' : 'Você não possui ordens de serviço.'}
            </div>
          </div>
        ) : (
          filtrados.map(os => (
            <OSCard
              key={os._id ?? os.os_id}
              os={os}
              userRole={userRole}
              onReagendar={setReagendarOS}
            />
          ))
        )}
      </div>

      {/* Modal reagendar */}
      {reagendarOS && (
        <ReagendarModal
          os={reagendarOS}
          onClose={() => setReagendarOS(null)}
          onSuccess={handleReagendarSuccess}
        />
      )}
    </div>
  )
}
