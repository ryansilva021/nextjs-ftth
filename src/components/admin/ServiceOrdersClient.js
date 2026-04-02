'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
  listOS, createOS, updateOSStatus, updateOSFields,
  concludeInstallation, deleteOS,
} from '@/actions/service-orders'

// ─── Keyframe animations injected once ────────────────────────────────────────

const GLOBAL_STYLES = `
@keyframes pulse-red { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes fadeIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
.os-table-wrap { display:block }
.os-cards-wrap { display:none }
@media (max-width:768px) {
  .os-table-wrap { display:none }
  .os-cards-wrap { display:flex; flex-direction:column; gap:10px }
}
`

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  aberta:       { label: 'Aberta',       color: '#3b82f6', bg: '#1e3a5f' },
  agendada:     { label: 'Agendada',     color: '#a78bfa', bg: '#2e1b4e' },
  em_andamento: { label: 'Em andamento', color: '#f59e0b', bg: '#451a03' },
  concluida:    { label: 'Concluída',    color: '#22c55e', bg: '#052e16' },
  cancelada:    { label: 'Cancelada',    color: '#ef4444', bg: '#450a0a' },
}

const TIPO_META = {
  instalacao:   { label: 'Instalação',   icon: '📶', color: '#22c55e' },
  manutencao:   { label: 'Manutenção',   icon: '🔧', color: '#f59e0b' },
  suporte:      { label: 'Suporte',      icon: '💬', color: '#3b82f6' },
  cancelamento: { label: 'Cancelamento', icon: '✕',  color: '#ef4444' },
}

const PRIO_META = {
  baixa:   { label: 'Baixa',   color: '#6b7280', strip: 'transparent' },
  normal:  { label: 'Normal',  color: '#94a3b8', strip: 'transparent' },
  alta:    { label: 'Alta',    color: '#f59e0b', strip: '#f59e0b' },
  urgente: { label: 'Urgente', color: '#ef4444', strip: '#ef4444' },
}

// Status flow: which statuses can be transitioned to from each status
const STATUS_FLOW = {
  aberta:       ['agendada', 'em_andamento', 'cancelada'],
  agendada:     ['em_andamento', 'cancelada'],
  em_andamento: ['concluida', 'cancelada'],
  concluida:    [],
  cancelada:    [],
}

// Role-based access control
const CAN_WRITE   = ['superadmin', 'admin', 'tecnico', 'comercial']
const CAN_EXECUTE = ['superadmin', 'admin', 'tecnico']
const CAN_DELETE  = ['superadmin', 'admin']

// Status stepper order (linear flow, cancelada is a side-exit)
const STATUS_STEPS = ['aberta', 'agendada', 'em_andamento', 'concluida']

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Returns relative time label + color for scheduling display */
function relTime(d) {
  if (!d) return null
  const diff = Math.floor((new Date(d) - Date.now()) / 86400000)
  if (diff === 0) return {
    label: 'Hoje ' + new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    color: '#f59e0b',
  }
  if (diff === 1)  return { label: 'Amanhã', color: '#a78bfa' }
  if (diff > 1)    return { label: `Em ${diff} dias`, color: '#64748b' }
  if (diff === -1) return { label: 'Ontem', color: '#ef4444' }
  return { label: `${Math.abs(diff)}d atrás`, color: '#ef4444' }
}

/** RX power signal quality: good > -20, warning > -28, bad <= -28 */
function rxColor(rx) {
  if (rx == null) return 'var(--text-muted)'
  if (rx > -20) return '#22c55e'
  if (rx > -28) return '#f59e0b'
  return '#ef4444'
}

/** Percentage bar width capped at 100% */
function pct(value, total) {
  if (!total || !value) return 0
  return Math.min(100, Math.round((value / total) * 100))
}

// ─── Shared style tokens ───────────────────────────────────────────────────────

const INP = {
  background: 'var(--inp-bg)', border: '1px solid var(--border-color)',
  borderRadius: 6, padding: '7px 10px', color: 'var(--foreground)',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
}
const INP_SM = { ...INP, fontSize: 12, padding: '6px 10px' }
const LBL = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, display: 'block', fontWeight: 500 }
const ROW2 = { display: 'flex', gap: 12 }
const COL  = { flex: 1, minWidth: 0 }

// ─── Atoms ────────────────────────────────────────────────────────────────────

/** Pill badge with a colored dot and label */
function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label: status, color: '#6b7280', bg: '#1f2937' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, color: m.color,
      backgroundColor: m.bg, border: `1px solid ${m.color}44`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
      {m.label}
    </span>
  )
}

/** Icon + colored label for service type */
function TipoBadge({ tipo }) {
  const m = TIPO_META[tipo] ?? { label: tipo, icon: '📋', color: '#6b7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 12, color: m.color, fontWeight: 500,
    }}>
      <span>{m.icon}</span> {m.label}
    </span>
  )
}

/** Priority badge — urgente gets animated pulse */
function PrioBadge({ prioridade }) {
  const m = PRIO_META[prioridade] ?? { label: prioridade, color: '#6b7280' }
  const isUrgent = prioridade === 'urgente'
  return (
    <span style={{
      fontSize: 11, color: m.color, fontWeight: 700,
      animation: isUrgent ? 'pulse-red 1.5s ease-in-out infinite' : 'none',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: m.color === '#6b7280' || m.color === '#94a3b8' ? 'currentColor' : m.color,
        display: 'inline-block',
      }} />
      {m.label.toUpperCase()}
    </span>
  )
}

/** Section divider with optional label */
function Divider({ label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: color ?? 'var(--border-color)' }} />
      {label && (
        <span style={{
          fontSize: 10, color: color ?? 'var(--text-muted)',
          fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
        }}>{label}</span>
      )}
      <div style={{ flex: 1, height: 1, background: color ?? 'var(--border-color)' }} />
    </div>
  )
}

/** Info row used inside detail panels */
function InfoRow({ label, value, valueStyle }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, minHeight: 20 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--foreground)', textAlign: 'right', wordBreak: 'break-all', ...valueStyle }}>{value ?? '—'}</span>
    </div>
  )
}

/** Bordered info section with title */
function Section({ title, color, children }) {
  return (
    <div style={{
      background: 'var(--background)', borderRadius: 8,
      padding: '10px 14px', border: '1px solid var(--border-color)',
      borderLeft: color ? `3px solid ${color}` : '1px solid var(--border-color)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: color ?? 'var(--text-muted)',
        letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase',
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  )
}

// ─── KPI Dashboard Card ────────────────────────────────────────────────────────

function KPICard({ label, value, color, total, onClick, active }) {
  const width = pct(value, total)
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${color}18` : 'var(--card-bg)',
        border: `1.5px solid ${active ? color : 'var(--border-color)'}`,
        borderRadius: 10, padding: '14px 16px 10px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s', minWidth: 100, flex: '1 1 90px',
        boxShadow: active ? `0 0 0 1px ${color}44` : 'none',
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value ?? 0}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, marginBottom: 8 }}>{label}</div>
      {/* Progress bar relative to total */}
      <div style={{ height: 3, borderRadius: 2, background: 'var(--border-color)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: color, width: `${width}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}

// ─── Status Stepper ────────────────────────────────────────────────────────────

function StatusStepper({ status }) {
  const isCanceled = status === 'cancelada'
  const stepIdx = STATUS_STEPS.indexOf(status)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '10px 20px 0' }}>
      {STATUS_STEPS.map((s, i) => {
        const m = STATUS_META[s]
        const done = stepIdx >= i && !isCanceled
        const current = stepIdx === i && !isCanceled
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_STEPS.length - 1 ? 1 : 'none' }}>
            {/* Dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
              <div style={{
                width: current ? 14 : 10, height: current ? 14 : 10,
                borderRadius: '50%',
                background: done ? m.color : 'var(--border-color)',
                border: current ? `2px solid ${m.color}` : 'none',
                boxShadow: current ? `0 0 0 3px ${m.color}33` : 'none',
                transition: 'all 0.2s',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 9, color: done ? m.color : 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: current ? 700 : 400 }}>
                {m.label}
              </span>
            </div>
            {/* Connector line */}
            {i < STATUS_STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginBottom: 14,
                background: stepIdx > i && !isCanceled ? m.color : 'var(--border-color)',
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        )
      })}
      {/* Canceled exit indicator */}
      {isCanceled && (
        <div style={{ marginLeft: 12, marginBottom: 14 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#ef4444',
            background: '#450a0a', border: '1px solid #ef444444',
            padding: '2px 8px', borderRadius: 99,
          }}>✕ Cancelada</span>
        </div>
      )}
    </div>
  )
}

// ─── Signal Bar ────────────────────────────────────────────────────────────────

function SignalBar({ label, value, unit = 'dBm', good = -20, warn = -28 }) {
  if (value == null || value === '') return null
  const num = parseFloat(value)
  const color = num > good ? '#22c55e' : num > warn ? '#f59e0b' : '#ef4444'
  // Map -40..0 dBm range to 0-100%
  const barWidth = Math.min(100, Math.max(0, ((num + 40) / 40) * 100))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{num} {unit}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
        <div style={{ width: `${barWidth}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

// ─── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ status, items, onOpen }) {
  const m = STATUS_META[status]
  return (
    <div style={{
      flex: '1 1 180px', minWidth: 170,
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      {/* Column header */}
      <div style={{
        padding: '8px 12px', borderRadius: '8px 8px 0 0',
        background: `${m.color}18`, borderTop: `3px solid ${m.color}`,
        border: `1px solid ${m.color}44`, borderBottom: 'none',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: m.color,
          background: `${m.color}33`, borderRadius: 99, padding: '1px 7px',
        }}>{items.length}</span>
      </div>

      {/* Card list */}
      <div style={{
        border: `1px solid ${m.color}33`, borderTop: 'none',
        borderRadius: '0 0 8px 8px', padding: 8,
        background: 'var(--background)',
        maxHeight: '70vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 7,
        minHeight: 60,
      }}>
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 11 }}>
            Vazia
          </div>
        )}
        {items.map(os => <KanbanCard key={os._id ?? os.os_id} os={os} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

/** Compact card used inside Kanban columns */
function KanbanCard({ os, onOpen }) {
  const sm = STATUS_META[os.status]
  const pm = PRIO_META[os.prioridade]
  const tm = TIPO_META[os.tipo]
  const sched = relTime(os.data_agendamento)

  return (
    <div
      onClick={() => onOpen(os)}
      style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: 8, padding: '9px 11px', cursor: 'pointer',
        borderLeft: `3px solid ${pm?.strip && pm.strip !== 'transparent' ? pm.strip : sm.color}`,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = `0 2px 8px ${sm.color}33`}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: sm.color }}>{os.os_id}</span>
        <span style={{ fontSize: 13 }}>{tm?.icon}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {os.cliente_nome ?? '—'}
      </div>
      {os.tecnico_nome && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
          🔧 {os.tecnico_nome}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: pm?.color,
          animation: os.prioridade === 'urgente' ? 'pulse-red 1.5s ease-in-out infinite' : 'none',
        }}>
          {pm?.label?.toUpperCase()}
        </span>
        {sched && (
          <span style={{ fontSize: 10, color: sched.color, fontWeight: 500 }}>
            {sched.label}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Mobile Card ───────────────────────────────────────────────────────────────

function MobileCard({ os, onOpen }) {
  const pm = PRIO_META[os.prioridade]
  const strip = pm?.strip && pm.strip !== 'transparent' ? pm.strip : 'transparent'
  return (
    <div
      onClick={() => onOpen(os)}
      style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
        borderLeft: strip !== 'transparent' ? `4px solid ${strip}` : '1px solid var(--border-color)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: STATUS_META[os.status]?.color }}>{os.os_id}</div>
          <div style={{ marginTop: 4 }}><TipoBadge tipo={os.tipo} /></div>
        </div>
        <StatusBadge status={os.status} />
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--foreground)', fontWeight: 500 }}>{os.cliente_nome ?? '—'}</div>
      {os.tecnico_nome && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          🔧 {os.tecnico_nome}{os.auxiliar_nome ? ` + ${os.auxiliar_nome}` : ''}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
        <PrioBadge prioridade={os.prioridade} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(os.data_abertura)}</span>
      </div>
    </div>
  )
}

// ─── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated, olts, userRole }) {
  const [form, setForm] = useState({
    tipo: 'instalacao', prioridade: 'normal',
    cliente_nome: '', cliente_contato: '', cliente_endereco: '',
    tecnico_nome: '', auxiliar_nome: '',
    olt_id: '', pon: '', cto_id: '', porta_cto: '',
    onu_serial: '', descricao: '', data_agendamento: '',
  })
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState(null)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function handleSubmit(e) {
    e.preventDefault()
    setErr(null)
    startTransition(async () => {
      try {
        const os = await createOS({
          ...form,
          porta_cto: form.porta_cto ? Number(form.porta_cto) : null,
          data_agendamento: form.data_agendamento || null,
        })
        onCreated(os)
      } catch (ex) {
        setErr(ex.message)
      }
    })
  }

  const sectionHead = (label, color) => (
    <div style={{
      fontSize: 10, fontWeight: 700, color: color ?? '#3b82f6',
      letterSpacing: 1.2, textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ flex: 1, height: 1, background: color ? `${color}44` : '#3b82f644' }} />
      {label}
      <div style={{ flex: 1, height: 1, background: color ? `${color}44` : '#3b82f644' }} />
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: 14, width: '100%', maxWidth: 600,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Colored top strip */}
        <div style={{ height: 4, borderRadius: '14px 14px 0 0', background: 'linear-gradient(90deg,#3b82f6,#a78bfa)' }} />

        <div style={{ padding: '20px 24px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--foreground)' }}>
                Nova Ordem de Serviço
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Preencha os dados essenciais — rede pode ser completada depois
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
            >✕</button>
          </div>

          {err && (
            <div style={{
              background: '#450a0a', border: '1px solid #7f1d1d',
              borderRadius: 8, padding: '9px 14px', marginBottom: 16, fontSize: 12, color: '#fca5a5',
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span style={{ flexShrink: 0 }}>⚠</span> {err}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Tipo + Prioridade */}
            <div style={ROW2}>
              <div style={COL}>
                <label style={LBL}>Tipo *</label>
                <select style={INP} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                  {Object.entries(TIPO_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div style={COL}>
                <label style={LBL}>Prioridade</label>
                <select style={INP} value={form.prioridade} onChange={e => set('prioridade', e.target.value)}>
                  {Object.entries(PRIO_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {sectionHead('Cliente', '#3b82f6')}

            <div>
              <label style={LBL}>Nome do Cliente *</label>
              <input
                style={INP} required
                value={form.cliente_nome}
                onChange={e => set('cliente_nome', e.target.value)}
                placeholder="Ex: João da Silva"
              />
            </div>
            <div style={ROW2}>
              <div style={COL}>
                <label style={LBL}>Contato / Telefone</label>
                <input style={INP} value={form.cliente_contato} onChange={e => set('cliente_contato', e.target.value)} placeholder="(xx) 9xxxx-xxxx" />
              </div>
              <div style={COL}>
                <label style={LBL}>Agendamento</label>
                <input type="datetime-local" style={INP} value={form.data_agendamento} onChange={e => set('data_agendamento', e.target.value)} />
              </div>
            </div>
            <div>
              <label style={LBL}>Endereço</label>
              <input style={INP} value={form.cliente_endereco} onChange={e => set('cliente_endereco', e.target.value)} placeholder="Rua, número, bairro" />
            </div>

            {sectionHead('Equipe', '#a78bfa')}

            <div style={ROW2}>
              <div style={COL}>
                <label style={LBL}>Técnico Responsável</label>
                <input style={INP} value={form.tecnico_nome} onChange={e => set('tecnico_nome', e.target.value)} placeholder="Nome do técnico" />
              </div>
              <div style={COL}>
                <label style={LBL}>Auxiliar / Ajudante</label>
                <input style={INP} value={form.auxiliar_nome} onChange={e => set('auxiliar_nome', e.target.value)} placeholder="Nome do auxiliar" />
              </div>
            </div>

            {sectionHead('Rede — opcional', '#64748b')}

            <div style={ROW2}>
              <div style={COL}>
                <label style={LBL}>OLT</label>
                <select style={INP} value={form.olt_id} onChange={e => set('olt_id', e.target.value)}>
                  <option value="">— Não definida —</option>
                  {olts.map(o => <option key={o._id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <div style={COL}>
                <label style={LBL}>Porta PON</label>
                <input style={INP} value={form.pon} onChange={e => set('pon', e.target.value)} placeholder="Ex: 0/1/0" />
              </div>
            </div>
            <div style={ROW2}>
              <div style={COL}>
                <label style={LBL}>CTO ID</label>
                <input style={INP} value={form.cto_id} onChange={e => set('cto_id', e.target.value)} placeholder="Ex: cto-01" />
              </div>
              <div style={COL}>
                <label style={LBL}>Porta CTO</label>
                <input type="number" min="1" style={INP} value={form.porta_cto} onChange={e => set('porta_cto', e.target.value)} placeholder="Ex: 4" />
              </div>
            </div>
            {form.tipo === 'instalacao' && (
              <div>
                <label style={LBL}>Serial ONU</label>
                <input style={INP} value={form.onu_serial} onChange={e => set('onu_serial', e.target.value)} placeholder="Ex: HWTC12345678" />
              </div>
            )}

            {sectionHead('Observações', '#64748b')}

            <div>
              <label style={LBL}>Descrição do serviço</label>
              <textarea
                style={{ ...INP, height: 72, resize: 'vertical' }}
                value={form.descricao}
                onChange={e => set('descricao', e.target.value)}
                placeholder="Descreva o serviço a ser executado..."
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                type="button" onClick={onClose}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-color)',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
                }}
              >Cancelar</button>
              <button
                type="submit" disabled={isPending}
                style={{
                  padding: '9px 26px', borderRadius: 8, border: 'none',
                  background: isPending ? '#1d4ed8' : '#3b82f6',
                  color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  opacity: isPending ? 0.8 : 1,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {isPending && (
                  <span style={{ width: 14, height: 14, border: '2px solid #ffffff55', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                )}
                {isPending ? 'Criando...' : '+ Criar OS'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── OS Drawer ─────────────────────────────────────────────────────────────────

function OSDrawer({ os, olts, userRole, onClose, onUpdated, onDeleted }) {
  const [activeTab, setActiveTab]   = useState('info')
  const [isPending, startTransition] = useTransition()
  const [editMode, setEditMode]     = useState(false)
  const [fields, setFields] = useState({
    tecnico_nome:     os.tecnico_nome     ?? '',
    auxiliar_nome:    os.auxiliar_nome    ?? '',
    olt_id:           os.olt_id           ?? '',
    pon:              os.pon              ?? '',
    cto_id:           os.cto_id          ?? '',
    porta_cto:        os.porta_cto        ?? '',
    onu_serial:       os.onu_serial       ?? '',
    obs_tecnico:      os.obs_tecnico      ?? '',
    rx_power:         os.rx_power         ?? '',
    tx_power:         os.tx_power         ?? '',
    data_agendamento: os.data_agendamento
      ? new Date(os.data_agendamento).toISOString().slice(0, 16) : '',
  })
  const [conclusaoForm, setConclusaoForm] = useState({
    serial:      os.onu_serial ?? '',
    oltId:       os.olt_id    ?? '',
    ponPort:     os.pon       ?? '',
    ctoId:       os.cto_id   ?? '',
    rx_power:    '',
    tx_power:    '',
    obs_tecnico: '',
  })
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)

  const canWrite   = CAN_WRITE.includes(userRole)
  const canExecute = CAN_EXECUTE.includes(userRole)
  const canDelete  = CAN_DELETE.includes(userRole)
  const nextStatuses = STATUS_FLOW[os.status] ?? []
  const showProvTab  = os.tipo === 'instalacao' && canExecute && os.status !== 'concluida'

  const sm = STATUS_META[os.status] ?? { color: '#6b7280' }

  function setF(k, v) { setFields(p => ({ ...p, [k]: v })) }
  function setC(k, v) { setConclusaoForm(p => ({ ...p, [k]: v })) }

  function handleStatusChange(s) {
    setErr(null); setMsg(null)
    startTransition(async () => {
      try {
        const updated = await updateOSStatus(os.os_id, s)
        onUpdated(updated)
        setMsg(`Status atualizado para "${STATUS_META[s]?.label}"`)
      } catch (ex) { setErr(ex.message) }
    })
  }

  function handleSaveFields() {
    setErr(null); setMsg(null)
    const payload = {}
    for (const [k, v] of Object.entries(fields)) {
      if (v !== '' && v != null) payload[k] = v
    }
    startTransition(async () => {
      try {
        const updated = await updateOSFields(os.os_id, payload)
        onUpdated(updated)
        setEditMode(false)
        setMsg('Dados salvos com sucesso.')
      } catch (ex) { setErr(ex.message) }
    })
  }

  function handleConcluir(e) {
    e.preventDefault()
    setErr(null); setMsg(null)
    startTransition(async () => {
      try {
        const r = await concludeInstallation(os.os_id, conclusaoForm)
        onUpdated(r.os)
        setMsg('OS concluída e ONU provisionada!')
        setActiveTab('info')
      } catch (ex) { setErr(ex.message) }
    })
  }

  function handleDelete() {
    if (!confirm(`Excluir OS ${os.os_id}? Esta ação não pode ser desfeita.`)) return
    startTransition(async () => {
      try {
        await deleteOS(os.os_id)
        onDeleted(os.os_id)
      } catch (ex) { setErr(ex.message) }
    })
  }

  const tabs = ['info', 'rede', ...(showProvTab ? ['provisionar'] : [])]
  const tabLabels = { info: 'Dados', rede: 'Rede / Equipe', provisionar: '⚡ Provisionar' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} />

      {/* Panel */}
      <div style={{
        width: 500, maxWidth: '100vw',
        background: 'var(--card-bg)', borderLeft: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Status color gradient bar */}
        <div style={{ height: 5, background: `linear-gradient(90deg, ${sm.color}, ${sm.color}88)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-color)',
          background: 'var(--background)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: sm.color }}>{os.os_id}</span>
                <TipoBadge tipo={os.tipo} />
                <StatusBadge status={os.status} />
                <PrioBadge prioridade={os.prioridade} />
              </div>
              {os.cliente_nome && (
                <div style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 500 }}>
                  👤 {os.cliente_nome}
                  {os.tecnico_nome && <span style={{ marginLeft: 10, color: 'var(--text-muted)' }}>🔧 {os.tecnico_nome}</span>}
                  {os.auxiliar_nome && <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>+ {os.auxiliar_nome}</span>}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4, flexShrink: 0 }}
            >✕</button>
          </div>

          {/* Status stepper */}
          <StatusStepper status={os.status} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--background)', flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: '9px 16px', fontSize: 12, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === t ? `2px solid ${sm.color}` : '2px solid transparent',
              color: activeTab === t ? sm.color : 'var(--text-muted)',
              transition: 'color 0.15s',
            }}>{tabLabels[t]}</button>
          ))}
        </div>

        {/* Feedback banners */}
        {err && (
          <div style={{ margin: '8px 16px 0', background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#fca5a5', display: 'flex', gap: 6 }}>
            <span>⚠</span> {err}
          </div>
        )}
        {msg && (
          <div style={{ margin: '8px 16px 0', background: '#052e16', border: '1px solid #16a34a44', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#4ade80', display: 'flex', gap: 6 }}>
            <span>✓</span> {msg}
          </div>
        )}

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ──── TAB: Dados ──── */}
          {activeTab === 'info' && (
            <>
              {/* Client card */}
              <Section title="Cliente" color="#3b82f6">
                <InfoRow label="Nome"     value={os.cliente_nome} />
                <InfoRow label="Contato"  value={os.cliente_contato} />
                <InfoRow label="Endereço" value={os.cliente_endereco} />
              </Section>

              {/* Dates */}
              <Section title="Datas" color="#64748b">
                <InfoRow label="Abertura"    value={fmtDateTime(os.data_abertura)} />
                <InfoRow label="Agendamento" value={fmtDateTime(os.data_agendamento)} />
                <InfoRow label="Execução"    value={fmtDateTime(os.data_execucao)} />
                <InfoRow label="Fechamento"  value={fmtDateTime(os.data_fechamento)} />
              </Section>

              {/* Description / observations */}
              {(os.descricao || os.obs_tecnico || os.resultado) && (
                <Section title="Observações" color="#a78bfa">
                  {os.descricao   && <InfoRow label="Descrição"  value={os.descricao} />}
                  {os.obs_tecnico && <InfoRow label="Técnico"    value={os.obs_tecnico} />}
                  {os.resultado   && (
                    <div style={{ fontSize: 12, color: '#4ade80', marginTop: 4, display: 'flex', gap: 6 }}>
                      <span>✓</span> {os.resultado}
                    </div>
                  )}
                </Section>
              )}

              {/* Signal readings with visual bar */}
              {(os.rx_power != null || os.tx_power != null) && (
                <Section title="Sinal coletado" color="#f59e0b">
                  <SignalBar label="RX Power" value={os.rx_power} />
                  <SignalBar label="TX Power" value={os.tx_power} good={0} warn={-5} />
                </Section>
              )}

              {/* Status transition buttons */}
              {canWrite && nextStatuses.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    Avançar status
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {nextStatuses.map(s => (
                      <button
                        key={s} disabled={isPending}
                        onClick={() => handleStatusChange(s)}
                        style={{
                          padding: '8px 16px', borderRadius: 8,
                          border: `1px solid ${STATUS_META[s]?.color}55`,
                          background: STATUS_META[s]?.bg,
                          color: STATUS_META[s]?.color,
                          cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          opacity: isPending ? 0.6 : 1,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[s]?.color }} />
                        {STATUS_META[s]?.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Spacer + Delete at bottom */}
              <div style={{ flex: 1 }} />
              {canDelete && (
                <button
                  onClick={handleDelete} disabled={isPending}
                  style={{
                    padding: '7px 14px', borderRadius: 7, border: '1px solid #7f1d1d',
                    background: '#450a0a', color: '#fca5a5', cursor: 'pointer', fontSize: 12,
                    alignSelf: 'flex-start', marginTop: 8,
                  }}
                >Excluir OS</button>
              )}
            </>
          )}

          {/* ──── TAB: Rede / Equipe ──── */}
          {activeTab === 'rede' && (
            <>
              {canWrite && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {!editMode ? (
                    <button
                      onClick={() => setEditMode(true)}
                      style={{
                        padding: '6px 14px', borderRadius: 7,
                        border: '1px solid var(--border-color)',
                        background: 'transparent', color: 'var(--foreground)',
                        cursor: 'pointer', fontSize: 12, fontWeight: 500,
                      }}
                    >Editar</button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setEditMode(false)}
                        style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
                      >Cancelar</button>
                      <button
                        onClick={handleSaveFields} disabled={isPending}
                        style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: isPending ? 0.7 : 1 }}
                      >{isPending ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                  )}
                </div>
              )}

              {editMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <div style={ROW2}>
                    <div style={COL}><label style={LBL}>Técnico</label><input style={INP_SM} value={fields.tecnico_nome} onChange={e => setF('tecnico_nome', e.target.value)} /></div>
                    <div style={COL}><label style={LBL}>Auxiliar</label><input style={INP_SM} value={fields.auxiliar_nome} onChange={e => setF('auxiliar_nome', e.target.value)} /></div>
                  </div>
                  <div>
                    <label style={LBL}>OLT</label>
                    <select style={INP_SM} value={fields.olt_id} onChange={e => setF('olt_id', e.target.value)}>
                      <option value="">— Não definida —</option>
                      {olts.map(o => <option key={o._id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </div>
                  <div style={ROW2}>
                    <div style={COL}><label style={LBL}>PON</label><input style={INP_SM} value={fields.pon} onChange={e => setF('pon', e.target.value)} placeholder="0/1/0" /></div>
                    <div style={COL}><label style={LBL}>CTO ID</label><input style={INP_SM} value={fields.cto_id} onChange={e => setF('cto_id', e.target.value)} /></div>
                  </div>
                  <div style={ROW2}>
                    <div style={COL}><label style={LBL}>Porta CTO</label><input type="number" style={INP_SM} value={fields.porta_cto} onChange={e => setF('porta_cto', e.target.value)} /></div>
                    <div style={COL}><label style={LBL}>Serial ONU</label><input style={INP_SM} value={fields.onu_serial} onChange={e => setF('onu_serial', e.target.value)} /></div>
                  </div>
                  <div style={ROW2}>
                    <div style={COL}><label style={LBL}>RX Power (dBm)</label><input type="number" step="0.01" style={INP_SM} value={fields.rx_power} onChange={e => setF('rx_power', e.target.value)} /></div>
                    <div style={COL}><label style={LBL}>TX Power (dBm)</label><input type="number" step="0.01" style={INP_SM} value={fields.tx_power} onChange={e => setF('tx_power', e.target.value)} /></div>
                  </div>
                  <div><label style={LBL}>Agendamento</label><input type="datetime-local" style={INP_SM} value={fields.data_agendamento} onChange={e => setF('data_agendamento', e.target.value)} /></div>
                  <div><label style={LBL}>Obs. Técnico</label><textarea style={{ ...INP_SM, height: 64, resize: 'vertical' }} value={fields.obs_tecnico} onChange={e => setF('obs_tecnico', e.target.value)} /></div>
                </div>
              ) : (
                <>
                  <Section title="Equipe" color="#a78bfa">
                    <InfoRow label="Técnico"  value={os.tecnico_nome} />
                    <InfoRow label="Auxiliar" value={os.auxiliar_nome} />
                  </Section>
                  <Section title="Rede" color="#3b82f6">
                    <InfoRow label="OLT"        value={olts.find(o => o.id === os.olt_id)?.nome ?? os.olt_id} />
                    <InfoRow label="PON"        value={os.pon} />
                    <InfoRow label="CTO"        value={os.cto_id} />
                    <InfoRow label="Porta CTO"  value={os.porta_cto} />
                    <InfoRow label="Serial ONU" value={os.onu_serial} />
                  </Section>
                </>
              )}
            </>
          )}

          {/* ──── TAB: Provisionar ──── */}
          {activeTab === 'provisionar' && (
            <>
              <div style={{
                padding: '10px 14px', background: '#1a2742',
                borderRadius: 8, border: '1px solid #3b82f644',
                fontSize: 12, color: '#93c5fd', lineHeight: 1.5,
              }}>
                Preencha os dados e clique em <strong>Concluir e Provisionar</strong> para ativar a ONU na OLT automaticamente.
              </div>
              <form onSubmit={handleConcluir} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={LBL}>Serial ONU *</label>
                  <input required style={INP_SM} value={conclusaoForm.serial} onChange={e => setC('serial', e.target.value)} placeholder="Ex: HWTC12345678" />
                </div>
                <div>
                  <label style={LBL}>OLT</label>
                  <select style={INP_SM} value={conclusaoForm.oltId} onChange={e => setC('oltId', e.target.value)}>
                    <option value="">— Selecionar —</option>
                    {olts.map(o => <option key={o._id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
                <div style={ROW2}>
                  <div style={COL}><label style={LBL}>Porta PON</label><input style={INP_SM} value={conclusaoForm.ponPort} onChange={e => setC('ponPort', e.target.value)} placeholder="0/1/0" /></div>
                  <div style={COL}><label style={LBL}>CTO ID</label><input style={INP_SM} value={conclusaoForm.ctoId} onChange={e => setC('ctoId', e.target.value)} /></div>
                </div>

                <Divider label="Sinal coletado" color="#22c55e" />

                <div style={ROW2}>
                  <div style={COL}><label style={LBL}>RX Power (dBm)</label><input type="number" step="0.01" style={INP_SM} value={conclusaoForm.rx_power} onChange={e => setC('rx_power', e.target.value)} placeholder="-18.5" /></div>
                  <div style={COL}><label style={LBL}>TX Power (dBm)</label><input type="number" step="0.01" style={INP_SM} value={conclusaoForm.tx_power} onChange={e => setC('tx_power', e.target.value)} placeholder="2.5" /></div>
                </div>
                <div>
                  <label style={LBL}>Observações finais</label>
                  <textarea style={{ ...INP_SM, height: 56, resize: 'vertical' }} value={conclusaoForm.obs_tecnico} onChange={e => setC('obs_tecnico', e.target.value)} />
                </div>
                <button
                  type="submit" disabled={isPending}
                  style={{
                    padding: '11px 0', borderRadius: 8, border: 'none',
                    background: isPending ? '#15803d' : '#22c55e',
                    color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800,
                    opacity: isPending ? 0.8 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {isPending && (
                    <span style={{ width: 14, height: 14, border: '2px solid #ffffff55', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  )}
                  {isPending ? 'Provisionando...' : '✓ Concluir e Provisionar ONU'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ServiceOrdersClient({ initialItems, initialTotal, stats, olts, userRole, userName }) {
  const [items, setItems]               = useState(initialItems ?? [])
  const [total, setTotal]               = useState(initialTotal ?? 0)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTipo, setFilterTipo]     = useState('')
  const [search, setSearch]             = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [selectedOS, setSelectedOS]     = useState(null)
  const [view, setView]                 = useState('list')   // 'list' | 'kanban'
  const [loading, startTransition]      = useTransition()

  const canCreate = CAN_WRITE.includes(userRole)

  // ── Derived filtered list ──
  const filtered = useMemo(() => {
    let r = items
    if (filterStatus) r = r.filter(o => o.status === filterStatus)
    if (filterTipo)   r = r.filter(o => o.tipo   === filterTipo)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(o =>
        o.os_id?.toLowerCase().includes(q) ||
        o.cliente_nome?.toLowerCase().includes(q) ||
        o.tecnico_nome?.toLowerCase().includes(q) ||
        o.auxiliar_nome?.toLowerCase().includes(q) ||
        o.onu_serial?.toLowerCase().includes(q)
      )
    }
    return r
  }, [items, filterStatus, filterTipo, search])

  // ── Items grouped by status for Kanban ──
  const byStatus = useMemo(() => {
    const map = {}
    for (const s of Object.keys(STATUS_META)) map[s] = []
    for (const os of filtered) {
      if (map[os.status]) map[os.status].push(os)
      else map[os.status] = [os]
    }
    return map
  }, [filtered])

  // ── Reload from server ──
  const reload = useCallback(() => {
    startTransition(async () => {
      try {
        const data = await listOS({ limit: 100 })
        setItems(data.items)
        setTotal(data.total)
      } catch {}
    })
  }, [])

  // ── Handlers ──
  function handleCreated(os) {
    setItems(p => [os, ...p])
    setTotal(p => p + 1)
    setShowCreate(false)
    setSelectedOS(os)
  }

  function handleUpdated(os) {
    setItems(p => p.map(i => i.os_id === os.os_id ? os : i))
    setSelectedOS(os)
  }

  function handleDeleted(osId) {
    setItems(p => p.filter(i => i.os_id !== osId))
    setTotal(p => p - 1)
    setSelectedOS(null)
  }

  // ── Toggle filter helpers ──
  function toggleStatus(s) { setFilterStatus(p => p === s ? '' : s) }
  function toggleTipo(k)   { setFilterTipo(p => p === k ? '' : k) }

  return (
    <div>
      {/* Inject global animations */}
      <style>{GLOBAL_STYLES}</style>

      {/* ── KPI Dashboard Row ── */}
      {stats && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <KPICard label="Total"        value={stats.total}        color="#64748b" total={stats.total} onClick={() => setFilterStatus('')}             active={!filterStatus} />
          <KPICard label="Abertas"      value={stats.abertas}      color="#3b82f6" total={stats.total} onClick={() => toggleStatus('aberta')}          active={filterStatus === 'aberta'} />
          <KPICard label="Agendadas"    value={stats.agendadas}    color="#a78bfa" total={stats.total} onClick={() => toggleStatus('agendada')}        active={filterStatus === 'agendada'} />
          <KPICard label="Em andamento" value={stats.em_andamento} color="#f59e0b" total={stats.total} onClick={() => toggleStatus('em_andamento')}    active={filterStatus === 'em_andamento'} />
          <KPICard label="Concluidas"   value={stats.concluidas}   color="#22c55e" total={stats.total} onClick={() => toggleStatus('concluida')}       active={filterStatus === 'concluida'} />
          <KPICard label="Canceladas"   value={stats.canceladas}   color="#ef4444" total={stats.total} onClick={() => toggleStatus('cancelada')}       active={filterStatus === 'cancelada'} />
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        {/* Search */}
        <input
          placeholder="Buscar OS, cliente, técnico, serial..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 220px', minWidth: 0,
            background: 'var(--inp-bg)', border: '1px solid var(--border-color)',
            borderRadius: 8, padding: '8px 13px', color: 'var(--foreground)', fontSize: 13,
          }}
        />

        {/* Tipo filters */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {Object.entries(TIPO_META).map(([k, v]) => (
            <button
              key={k}
              onClick={() => toggleTipo(k)}
              style={{
                padding: '6px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${filterTipo === k ? v.color : 'var(--border-color)'}`,
                background: filterTipo === k ? `${v.color}22` : 'transparent',
                color: filterTipo === k ? v.color : 'var(--text-muted)',
                fontWeight: filterTipo === k ? 700 : 400,
                transition: 'all 0.12s',
              }}
            >{v.icon} {v.label}</button>
          ))}
        </div>

        {/* View toggle */}
        <div style={{
          display: 'flex', border: '1px solid var(--border-color)',
          borderRadius: 7, overflow: 'hidden',
        }}>
          {[['list', '≡ Lista'], ['kanban', '⬛ Kanban']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: 'none',
                background: view === v ? '#3b82f6' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.12s',
              }}
            >{label}</button>
          ))}
        </div>

        {/* Reload */}
        <button
          onClick={reload} disabled={loading}
          title="Recarregar"
          style={{
            padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border-color)',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
          }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
        </button>

        {/* New OS */}
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '7px 20px', borderRadius: 8, border: 'none',
              background: '#3b82f6', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >+ Nova OS</button>
        )}
      </div>

      {/* Count label */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        {filtered.length} OS{filtered.length !== total ? ` (de ${total} carregadas)` : ''}
        {(filterStatus || filterTipo || search) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterTipo(''); setSearch('') }}
            style={{ marginLeft: 10, fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >Limpar filtros</button>
        )}
      </div>

      {/* ── KANBAN VIEW ── */}
      {view === 'kanban' && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
          {Object.keys(STATUS_META).map(s => (
            <KanbanColumn key={s} status={s} items={byStatus[s] ?? []} onOpen={setSelectedOS} />
          ))}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {/* Table — desktop */}
          <div className="os-table-wrap" style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border-color)' }}>
                  {/* Priority strip column */}
                  <th style={{ width: 4, padding: 0 }} />
                  {['OS ID', 'Tipo', 'Cliente', 'Tecnico', 'Agendamento', 'Status', 'Prioridade', ''].map(h => (
                    <th key={h} style={{
                      padding: '10px 12px', textAlign: 'left',
                      color: 'var(--text-muted)', fontSize: 11, fontWeight: 700,
                      whiteSpace: 'nowrap', letterSpacing: 0.5,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                      <div style={{ fontSize: 13 }}>Nenhuma OS encontrada</div>
                    </td>
                  </tr>
                )}
                {filtered.map(os => {
                  const pm = PRIO_META[os.prioridade]
                  const strip = pm?.strip && pm.strip !== 'transparent' ? pm.strip : null
                  const sched = relTime(os.data_agendamento)
                  return (
                    <tr
                      key={os._id ?? os.os_id}
                      onClick={() => setSelectedOS(os)}
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--card-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Priority color strip */}
                      <td style={{ padding: 0, width: 4 }}>
                        <div style={{ width: 4, height: '100%', minHeight: 40, background: strip ?? 'transparent', borderRadius: '2px 0 0 2px' }} />
                      </td>
                      <td style={{ padding: '11px 12px', color: STATUS_META[os.status]?.color ?? '#60a5fa', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {os.os_id}
                      </td>
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        <TipoBadge tipo={os.tipo} />
                      </td>
                      <td style={{ padding: '11px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--foreground)', fontWeight: 500 }}>
                        {os.cliente_nome ?? '—'}
                      </td>
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {os.tecnico_nome ?? '—'}
                        {os.auxiliar_nome && <span style={{ fontSize: 11, marginLeft: 4 }}>+{os.auxiliar_nome}</span>}
                      </td>
                      {/* Relative agendamento */}
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        {sched
                          ? <span style={{ color: sched.color, fontWeight: 600, fontSize: 11 }}>{sched.label}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        <StatusBadge status={os.status} />
                      </td>
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        <PrioBadge prioridade={os.prioridade} />
                      </td>
                      {/* Chevron */}
                      <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: 14 }}>›</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="os-cards-wrap">
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 13 }}>Nenhuma OS encontrada</div>
              </div>
            )}
            {filtered.map(os => (
              <MobileCard key={os._id ?? os.os_id} os={os} onOpen={setSelectedOS} />
            ))}
          </div>
        </>
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          olts={olts}
          userRole={userRole}
        />
      )}

      {/* ── OS Drawer ── */}
      {selectedOS && (
        <OSDrawer
          os={selectedOS}
          olts={olts}
          userRole={userRole}
          onClose={() => setSelectedOS(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
