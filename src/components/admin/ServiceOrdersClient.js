'use client'

import { useState, useMemo, useCallback, useTransition, useEffect, useRef } from 'react'
import {
  listOS, createOS, updateOSStatus, updateOSFields,
  concludeInstallation, deleteOS,
  addMaterial, removeMaterial, addHistorico,
  updateConexao, updatePlano, addFoto, removeFoto,
} from '@/actions/service-orders'

// ─── Keyframe animations injected once ────────────────────────────────────────

const GLOBAL_STYLES = `
@keyframes pulse-red  { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
@keyframes pulse-dot  { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.5; transform:scale(0.7) } }
@keyframes spin       { to { transform: rotate(360deg) } }
@keyframes fadeIn     { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
@keyframes fadeInUp   { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
.os-table-wrap { display:block }
.os-cards-wrap { display:none }
.os-copy-btn:hover   { background:#1d4ed855 !important; color:#93c5fd !important; }
.os-action-btn:hover { opacity:0.82 !important; transform:translateY(-1px); }
.os-mat-row:hover    { background:#ffffff09 !important; }
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
const CAN_CREATE    = ['superadmin', 'admin', 'recepcao']
const CAN_WRITE     = ['superadmin', 'admin', 'recepcao']
const CAN_STATUS    = ['superadmin', 'admin', 'recepcao', 'tecnico']
const CAN_EXECUTE   = ['superadmin', 'admin']
const CAN_DELETE    = ['superadmin', 'admin']
const CAN_HISTORICO = ['superadmin', 'admin', 'noc', 'recepcao']
const CAN_ONU_AUTH  = ['superadmin', 'admin', 'noc']

// Materiais pré-definidos
const MATERIAIS_PRESET = [
  'ONU',
  'Roteador',
  'Cabo drop',
  'Cabo UTP',
  'Fita',
  'Fixa fios',
  'Conector APC',
  'Conector UPC',
  'RJ45',
  'Alça',
  'BAPE',
  'Splitter 1x2',
  'Splitter 1x4',
  'Splitter 1x8',
  'Splitter 1x16',
  'Patch cord SC/APC',
  'Patch cord SC/UPC',
  'Caixa CTO',
  'Caixa CDO',
]

// Materiais que usam metros como unidade
const MATERIAIS_METROS = new Set(['Cabo drop', 'Cabo UTP'])

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

// ─── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ value, label = '' }) {
  const [ok, setOk] = useState(false)
  function copy() {
    if (!value) return
    navigator.clipboard.writeText(String(value)).then(() => {
      setOk(true)
      setTimeout(() => setOk(false), 1800)
    })
  }
  return (
    <button
      onClick={copy}
      title={`Copiar ${label}`}
      className="os-copy-btn"
      style={{
        padding: '2px 7px', borderRadius: 5, border: '1px solid #334155',
        background: ok ? '#1e3a5f' : 'transparent',
        color: ok ? '#93c5fd' : '#64748b',
        cursor: 'pointer', fontSize: 10, fontWeight: 700,
        transition: 'all 0.15s', flexShrink: 0,
      }}
    >{ok ? '✓ Copiado' : '⎘ Copiar'}</button>
  )
}

// ─── Dados Tab ─────────────────────────────────────────────────────────────────

// Row styles — compact for field use
const DR  = { padding: '9px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 2 }
const DRL = { ...DR, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }
const DL  = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }
const DV  = { fontSize: 13, color: 'var(--foreground)', lineHeight: 1.45 }
const COPY_BTN = { padding: '4px 12px', borderRadius: 5, border: 'none', background: '#f59e0b', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 16 }

// Helper — label with colon
function DLabel({ children }) {
  return <span style={DL}>{children}:</span>
}

function DadosTab({ os, canWrite, canStatus, canDelete, isPending, nextStatuses, onStatusChange, onUpdate, onDelete }) {
  const [editTipo,   setEditTipo]   = useState(false)
  const [tipoVal,    setTipoVal]    = useState(os.tipo ?? '')
  const [editServico, setEditServico] = useState(false)
  const [servicoVal, setServicoVal] = useState(os.resultado ?? '')

  const conteudo = [
    os.cliente_id  ? `ID Cliente: ${os.cliente_id}` : null,
    os.descricao   ? `Problema: ${os.descricao}` : null,
    os.obs_tecnico ? `OBS: ${os.obs_tecnico}` : null,
  ].filter(Boolean).join('\n')

  return (
    <>
      {/* OS */}
      <div style={DR}>
        <DLabel>OS</DLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...DV, fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{os.os_id}</span>
          <a href={`/admin/os/${os.os_id}`} style={{
            fontSize: 11, color: '#60a5fa', background: '#1d4ed822',
            border: '1px solid #1d4ed855', borderRadius: 5,
            padding: '2px 8px', textDecoration: 'none', fontWeight: 600,
          }}>Abrir página ↗</a>
        </div>
      </div>

      {/* Motivo / Tipo */}
      <div style={DRL}>
        <div style={{ flex: 1 }}>
          <DLabel>Motivo</DLabel>
          {editTipo ? (
            <select value={tipoVal} onChange={e => setTipoVal(e.target.value)} style={{ ...INP_SM, marginTop: 3, width: 'auto' }}>
              {Object.entries(TIPO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          ) : (
            <div style={DV}>{TIPO_META[os.tipo]?.label ?? os.tipo ?? '—'}</div>
          )}
        </div>
        {canWrite && (
          editTipo
            ? <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginTop: 16 }}>
                <button onClick={() => { onUpdate({ tipo: tipoVal }); setEditTipo(false) }} disabled={isPending} style={{ padding: '4px 11px', borderRadius: 5, border: 'none', background: '#f59e0b', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>Salvar</button>
                <button onClick={() => setEditTipo(false)} style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>✕</button>
              </div>
            : <button onClick={() => setEditTipo(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15, padding: '16px 4px 0', flexShrink: 0 }}>✏</button>
        )}
      </div>

      {/* Cliente */}
      <div style={DR}>
        <DLabel>Cliente</DLabel>
        <span style={{ ...DV, fontWeight: 600, textTransform: 'uppercase' }}>{os.cliente_nome ?? '—'}</span>
      </div>

      {/* Endereço */}
      <div style={DRL}>
        <div style={{ flex: 1 }}>
          <DLabel>Endereço</DLabel>
          <span style={DV}>{os.cliente_endereco ?? '—'}</span>
        </div>
        {os.cliente_endereco && <button onClick={() => navigator.clipboard.writeText(os.cliente_endereco)} style={COPY_BTN}>Copiar</button>}
      </div>

      {/* Contato */}
      <div style={DRL}>
        <div style={{ flex: 1 }}>
          <DLabel>Contato</DLabel>
          <span style={DV}>{os.cliente_contato ?? '—'}</span>
        </div>
        {os.cliente_contato && <button onClick={() => navigator.clipboard.writeText(os.cliente_contato)} style={COPY_BTN}>Copiar</button>}
      </div>

      {/* Lat / Lng */}
      <div style={{ ...DR, flexDirection: 'row', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <DLabel>Latitude</DLabel>
          <span style={{ ...DV, color: os.localizacao?.lat ? 'var(--foreground)' : 'var(--text-muted)' }}>{os.localizacao?.lat ?? '—'}</span>
        </div>
        <div style={{ flex: 1 }}>
          <DLabel>Longitude</DLabel>
          <span style={{ ...DV, color: os.localizacao?.lng ? 'var(--foreground)' : 'var(--text-muted)' }}>{os.localizacao?.lng ?? '—'}</span>
        </div>
      </div>

      {/* Conteúdo */}
      {conteudo ? (
        <div style={DR}>
          <DLabel>Conteúdo</DLabel>
          <pre style={{ ...DV, fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{conteudo}</pre>
        </div>
      ) : null}

      {/* Serviço Prestado — editable by tecnico too */}
      <div style={DRL}>
        <div style={{ flex: 1 }}>
          <DLabel>Serviço Prestado</DLabel>
          {editServico ? (
            <textarea
              value={servicoVal}
              onChange={e => setServicoVal(e.target.value)}
              rows={3}
              placeholder="Descreva o serviço realizado..."
              style={{ ...INP_SM, marginTop: 3, resize: 'none', width: '100%' }}
            />
          ) : (
            <span style={{ ...DV, color: os.resultado ? 'var(--foreground)' : 'var(--text-muted)' }}>{os.resultado || '—'}</span>
          )}
        </div>
        {(canWrite || canStatus) && (
          editServico
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, marginTop: 16 }}>
                <button onClick={() => { onUpdate({ resultado: servicoVal }); setEditServico(false) }} disabled={isPending} style={{ padding: '4px 11px', borderRadius: 5, border: 'none', background: '#f59e0b', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>Salvar</button>
                <button onClick={() => setEditServico(false)} style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>✕</button>
              </div>
            : <button onClick={() => setEditServico(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15, padding: '16px 4px 0', flexShrink: 0 }}>✏</button>
        )}
      </div>

      {/* Status */}
      <div style={{ ...DR, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <DLabel>Status</DLabel>
        <StatusBadge status={os.status} />
      </div>

      {/* Datas — compact two-column grid */}
      <div style={{ ...DR, flexDirection: 'row', flexWrap: 'wrap', gap: 0 }}>
        {[
          { label: 'Abertura',    val: fmtDateTime(os.data_abertura) },
          { label: 'Agendamento', val: fmtDateTime(os.data_agendamento) },
          { label: 'Execução',    val: fmtDateTime(os.data_execucao) },
          { label: 'Fechamento',  val: fmtDateTime(os.data_fechamento) },
        ].filter(d => d.val !== '—').map(d => (
          <div key={d.label} style={{ flex: '1 1 45%', minWidth: 130, padding: '4px 0' }}>
            <div style={DL}>{d.label}:</div>
            <div style={{ ...DV, fontSize: 12 }}>{d.val}</div>
          </div>
        ))}
      </div>

      {/* Sinal */}
      {(os.rx_power != null || os.tx_power != null) && (
        <div style={{ ...DR, gap: 8 }}>
          <DLabel>Sinal</DLabel>
          <SignalBar label="RX Power" value={os.rx_power} />
          <SignalBar label="TX Power" value={os.tx_power} good={0} warn={-5} />
        </div>
      )}

      {/* Avançar status — tecnico pode abrir/fechar/colocar em andamento */}
      {canStatus && nextStatuses.length > 0 && (
        <div style={{ ...DR }}>
          <DLabel>Avançar Status</DLabel>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {nextStatuses.map(s => (
              <button key={s} disabled={isPending} onClick={() => onStatusChange(s)} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${STATUS_META[s]?.color}44`, background: STATUS_META[s]?.bg, color: STATUS_META[s]?.color, cursor: 'pointer', fontSize: 11, fontWeight: 700, opacity: isPending ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_META[s]?.color }} />{STATUS_META[s]?.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {canDelete && (
        <div style={{ paddingTop: 8 }}>
          <button onClick={onDelete} disabled={isPending} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #7f1d1d', background: '#450a0a', color: '#fca5a5', cursor: 'pointer', fontSize: 11 }}>Excluir OS</button>
        </div>
      )}
    </>
  )
}

// ─── OS Drawer ─────────────────────────────────────────────────────────────────

function OSDrawer({ os: initialOs, olts, usuarios = [], userRole, userId, onClose, onUpdated, onDeleted }) {
  const [os, setOs]                 = useState(initialOs)
  const [activeTab, setActiveTab]   = useState('dados')
  const [isPending, startTransition] = useTransition()
  const [editMode, setEditMode]     = useState(false)
  const [err, setErr]               = useState(null)
  const [msg, setMsg]               = useState(null)

  // Sync when parent updates the OS
  useEffect(() => { setOs(initialOs) }, [initialOs])

  // ── Connection status mock ──────────────────────────────────────────────────
  const [connStatus, setConnStatus] = useState(os.conexao?.status ?? null)
  const [connPolling, setConnPolling] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!os.conexao?.login && !os.conexao?.ip && !os.onu_serial) return
    setConnPolling(true)
    pollRef.current = setInterval(() => {
      setConnStatus(s => s === 'ONLINE' ? 'OFFLINE' : 'ONLINE')
    }, 9000)
    setConnStatus(prev => prev ?? (Math.random() > 0.3 ? 'ONLINE' : 'OFFLINE'))
    return () => clearInterval(pollRef.current)
  }, [os.conexao?.login, os.conexao?.ip, os.onu_serial])

  // ── Field forms ────────────────────────────────────────────────────────────
  const [fields, setFields] = useState({
    tecnico_nome:     os.tecnico_nome     ?? '',
    tecnico_id:       os.tecnico_id       ?? '',
    auxiliar_nome:    os.auxiliar_nome    ?? '',
    auxiliar_id:      os.auxiliar_id      ?? '',
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

  const [conexaoForm, setConexaoForm] = useState({
    login:    os.conexao?.login    ?? '',
    senha:    os.conexao?.senha    ?? '',
    ip:       os.conexao?.ip       ?? '',
    mac:      os.conexao?.mac      ?? '',
    onu_id:   os.conexao?.onu_id   ?? '',
    slot:     os.conexao?.slot     ?? '',
    pon_porta:os.conexao?.pon_porta ?? '',
  })

  const [planoForm, setPlanoForm] = useState({
    nome:     os.plano?.nome     ?? '',
    download: os.plano?.download ?? '',
    upload:   os.plano?.upload   ?? '',
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

  // ── Materiais state ─────────────────────────────────────────────────────────
  const [materiais, setMateriais]         = useState(os.materiais ?? [])
  const [showMatForm, setShowMatForm]     = useState(false)
  const [matForm, setMatForm]             = useState({ nome: '', quantidade: 1, tipo: 'OS', unidade: 'un' })

  // ── Histórico state ─────────────────────────────────────────────────────────
  const [historico, setHistorico]         = useState(os.historico ?? [])
  const [showNota, setShowNota]           = useState(false)
  const [notaText, setNotaText]           = useState('')

  // ── Fotos state ─────────────────────────────────────────────────────────────
  const [fotos, setFotos]                 = useState(os.fotos ?? [])
  const fileRef                           = useRef(null)

  // ── Senha reveal ───────────────────────────────────────────────────────────
  const [showSenha, setShowSenha]         = useState(false)

  const canWrite      = CAN_WRITE.includes(userRole)
  const canStatus     = CAN_STATUS.includes(userRole)
  const canExecute    = CAN_EXECUTE.includes(userRole)
  const canDelete     = CAN_DELETE.includes(userRole)
  const canHistorico  = CAN_HISTORICO.includes(userRole)
  const canOnuAuth    = CAN_ONU_AUTH.includes(userRole)
  const nextStatuses  = STATUS_FLOW[os.status] ?? []
  const showProvTab   = os.tipo === 'instalacao' && canExecute && os.status !== 'concluida'
  const sm           = STATUS_META[os.status] ?? { color: '#6b7280' }

  function setF(k, v) { setFields(p => ({ ...p, [k]: v })) }
  function setC(k, v) { setConclusaoForm(p => ({ ...p, [k]: v })) }
  function flash(m, isErr) { isErr ? setErr(m) : setMsg(m); setTimeout(() => isErr ? setErr(null) : setMsg(null), 3000) }

  function handleOsUpdate(updated) {
    setOs(updated)
    onUpdated(updated)
    if (updated.materiais) setMateriais(updated.materiais)
    if (updated.historico) setHistorico(updated.historico)
    if (updated.fotos)     setFotos(updated.fotos)
  }

  function handleStatusChange(s) {
    startTransition(async () => {
      try { handleOsUpdate(await updateOSStatus(os.os_id, s)); flash(`Status → ${STATUS_META[s]?.label}`) }
      catch (ex) { flash(ex.message, true) }
    })
  }

  function handleSaveFields() {
    const payload = {}
    for (const [k, v] of Object.entries(fields)) { if (v !== '' && v != null) payload[k] = v }
    startTransition(async () => {
      try { handleOsUpdate(await updateOSFields(os.os_id, payload)); setEditMode(false); flash('Dados salvos.') }
      catch (ex) { flash(ex.message, true) }
    })
  }

  function handleSaveConexao() {
    startTransition(async () => {
      try { handleOsUpdate(await updateConexao(os.os_id, conexaoForm)); flash('Conexão atualizada.') }
      catch (ex) { flash(ex.message, true) }
    })
  }

  function handleSavePlano() {
    startTransition(async () => {
      try { handleOsUpdate(await updatePlano(os.os_id, planoForm)); flash('Plano atualizado.') }
      catch (ex) { flash(ex.message, true) }
    })
  }

  function handleAddMaterial() {
    if (!matForm.nome.trim()) return
    startTransition(async () => {
      try {
        const nomeComUnidade = MATERIAIS_METROS.has(matForm.nome)
          ? `${matForm.nome} (${matForm.quantidade}m)`
          : matForm.nome.trim()
        const updated = await addMaterial(os.os_id, {
          nome:       nomeComUnidade,
          quantidade: MATERIAIS_METROS.has(matForm.nome) ? 1 : (Number(matForm.quantidade) || 1),
          tipo:       matForm.tipo,
        })
        handleOsUpdate(updated)
        setMatForm({ nome: '', quantidade: 1, tipo: 'OS', unidade: 'un' })
        setShowMatForm(false)
        flash('Material adicionado.')
      } catch (ex) { flash(ex.message, true) }
    })
  }

  function handleRemoveMaterial(mid) {
    if (!confirm('Remover material?')) return
    startTransition(async () => {
      try { handleOsUpdate(await removeMaterial(os.os_id, mid)); flash('Material removido.') }
      catch (ex) { flash(ex.message, true) }
    })
  }

  function handleAddNota() {
    if (!notaText.trim()) return
    startTransition(async () => {
      try {
        const updated = await addHistorico(os.os_id, `📝 Nota: ${notaText.trim()}`)
        handleOsUpdate(updated)
        setNotaText('')
        setShowNota(false)
        flash('Nota adicionada.')
      } catch (ex) { flash(ex.message, true) }
    })
  }

  function handleFotos(e) {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const updated = await addFoto(os.os_id, { nome: file.name, url: ev.target.result, tamanho: file.size })
          handleOsUpdate(updated)
        } catch (ex) { flash(ex.message, true) }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function handleRemoveFoto(fid) {
    startTransition(async () => {
      try { handleOsUpdate(await removeFoto(os.os_id, fid)) }
      catch (ex) { flash(ex.message, true) }
    })
  }

  function handleConcluir(e) {
    e.preventDefault()
    startTransition(async () => {
      try {
        const r = await concludeInstallation(os.os_id, conclusaoForm)
        handleOsUpdate(r.os)
        flash('OS concluída e ONU provisionada!')
        setActiveTab('conexao')
      } catch (ex) { flash(ex.message, true) }
    })
  }

  function handleDelete() {
    if (!confirm(`Excluir OS ${os.os_id}? Esta ação não pode ser desfeita.`)) return
    startTransition(async () => {
      try { await deleteOS(os.os_id); onDeleted(os.os_id) }
      catch (ex) { flash(ex.message, true) }
    })
  }

  const tabs = [
    { id: 'dados',      label: '📋 Dados' },
    { id: 'conexao',    label: '🔌 Conexão & Rede' },
    { id: 'materiais',  label: `📦 Materiais${materiais.length ? ` (${materiais.length})` : ''}` },
    { id: 'fotos',      label: `📷 Fotos${fotos.length ? ` (${fotos.length})` : ''}` },
    ...(canHistorico ? [{ id: 'historico', label: '🕐 Histórico' }] : []),
    ...(showProvTab   ? [{ id: 'provisionar', label: '⚡ Provisionar' }] : []),
  ]

  const hasConexao = !!(conexaoForm.login || conexaoForm.ip || conexaoForm.mac || os.onu_serial)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        width: 520, maxWidth: '100vw',
        background: 'var(--card-bg)', borderLeft: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Accent bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${sm.color}, ${sm.color}44)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '10px 14px 0', borderBottom: '1px solid var(--border-color)', background: 'var(--background)', flexShrink: 0 }}>
          {/* Row 1: Cliente (most important) + close */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.2, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                {os.cliente_nome ?? '—'}
              </div>
              {/* Row 2: status + tipo + prioridade */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <StatusBadge status={os.status} />
                <TipoBadge tipo={os.tipo} />
                <PrioBadge prioridade={os.prioridade} />
              </div>
              {/* Row 3: OS ID + tecnico + agendamento */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, fontFamily: 'monospace', background: `${sm.color}18`, padding: '1px 6px', borderRadius: 4 }}>{os.os_id}</span>
                {os.tecnico_nome && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔧 {os.tecnico_nome}</span>}
                {os.data_agendamento && <span style={{ fontSize: 11, color: '#a78bfa' }}>📅 {fmtDate(os.data_agendamento)}</span>}
                {os.cliente_contato && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📞 {os.cliente_contato}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <a href={`/admin/os/${os.os_id}`} style={{
                fontSize: 11, fontWeight: 600, color: '#60a5fa',
                background: '#1d4ed822', border: '1px solid #1d4ed855',
                borderRadius: 6, padding: '4px 10px', textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}>Abrir ↗</a>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
            </div>
          </div>
          <StatusStepper status={os.status} />
        </div>

        {/* Tab bar — scrollable */}
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', background: 'var(--background)', flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '8px 13px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === t.id ? `2px solid ${sm.color}` : '2px solid transparent',
              color: activeTab === t.id ? sm.color : 'var(--text-muted)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Feedback */}
        {err && <div style={{ margin: '8px 16px 0', background: '#450a0a', border: '1px solid #7f1d1d44', borderRadius: 6, padding: '7px 11px', fontSize: 11, color: '#fca5a5' }}>⚠ {err}</div>}
        {msg && <div style={{ margin: '8px 16px 0', background: '#052e16', border: '1px solid #16a34a44', borderRadius: 6, padding: '7px 11px', fontSize: 11, color: '#4ade80' }}>✓ {msg}</div>}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ════ TAB: DADOS ════ */}
          {activeTab === 'dados' && (
            <DadosTab
              os={os}
              canWrite={canWrite}
              canStatus={canStatus}
              canDelete={canDelete}
              isPending={isPending}
              nextStatuses={nextStatuses}
              onStatusChange={handleStatusChange}
              onUpdate={(payload) => startTransition(async () => {
                try { handleOsUpdate(await updateOSFields(os.os_id, payload)); flash('Dados salvos.') }
                catch (ex) { flash(ex.message, true) }
              })}
              onDelete={handleDelete}
            />
          )}

          {/* ════ TAB: CONEXÃO & REDE (merged) ════ */}
          {activeTab === 'conexao' && (
            <>
              {/* Status online/offline */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8,
                background: connStatus === 'ONLINE' ? '#052e1633' : connStatus === 'OFFLINE' ? '#450a0a33' : '#1e293b33',
                border: `1px solid ${connStatus === 'ONLINE' ? '#16a34a44' : connStatus === 'OFFLINE' ? '#ef444444' : '#33415544'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                    background: connStatus === 'ONLINE' ? '#22c55e' : connStatus === 'OFFLINE' ? '#ef4444' : '#64748b',
                    animation: connStatus ? 'pulse-dot 1.8s ease-in-out infinite' : 'none',
                    boxShadow: connStatus === 'ONLINE' ? '0 0 6px #22c55e' : connStatus === 'OFFLINE' ? '0 0 6px #ef4444' : 'none',
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: connStatus === 'ONLINE' ? '#4ade80' : connStatus === 'OFFLINE' ? '#f87171' : '#94a3b8' }}>
                    {connStatus ?? 'SEM DADOS'}
                  </span>
                  {connPolling && <span style={{ fontSize: 9, color: '#475569' }}>ao vivo</span>}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {os.onu_serial ?? os.conexao?.mac ?? '—'}
                </span>
              </div>

              {/* Ações rápidas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { label: '⎘ Login', val: conexaoForm.login },
                  { label: '⎘ Senha', val: conexaoForm.senha },
                  { label: '⎘ IP',    val: conexaoForm.ip },
                  { label: '⎘ MAC',   val: conexaoForm.mac },
                ].map(({ label, val }) => (
                  <button key={label} className="os-copy-btn"
                    onClick={() => val && navigator.clipboard.writeText(String(val))}
                    disabled={!val}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: '1px solid #334155', background: '#0f172a', color: val ? '#94a3b8' : '#374151', cursor: val ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
                  >{label}</button>
                ))}
                <button className="os-action-btn"
                  onClick={() => { const mac = Array.from({length:6},()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join(':').toUpperCase(); setConexaoForm(p=>({...p,mac})); navigator.clipboard.writeText(mac) }}
                  style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: '1px solid #1e40af44', background: '#1e3a5f', color: '#93c5fd', cursor: 'pointer', transition: 'all 0.15s' }}
                >⚡ MAC Auto</button>
                {canOnuAuth && (
                  <button className="os-action-btn"
                    onClick={() => flash('Comando de autorização ONU enviado.')}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: '1px solid #15803d44', background: '#052e16', color: '#4ade80', cursor: 'pointer', transition: 'all 0.15s' }}
                  >✓ Autorizar ONU</button>
                )}
                {conexaoForm.ip && (
                  <button className="os-action-btn"
                    onClick={() => window.open(`http://${conexaoForm.ip}`, '_blank')}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: '1px solid #a16207', background: '#451a03', color: '#fbbf24', cursor: 'pointer', transition: 'all 0.15s' }}
                  >↗ CPE</button>
                )}
              </div>

              {/* Dados de acesso */}
              <Section title="Acesso" color="#3b82f6">
                {[
                  { label: 'Login',  key: 'login',     val: conexaoForm.login },
                  { label: 'Senha',  key: 'senha',     val: conexaoForm.senha, secret: true },
                  { label: 'IP',     key: 'ip',        val: conexaoForm.ip },
                  { label: 'MAC',    key: 'mac',        val: conexaoForm.mac },
                  { label: 'ONU ID', key: 'onu_id',    val: conexaoForm.onu_id },
                  { label: 'Slot',   key: 'slot',      val: conexaoForm.slot },
                  { label: 'PON',    key: 'pon_porta', val: conexaoForm.pon_porta },
                ].map(({ label, key, val, secret }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #1e293b' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 60, flexShrink: 0 }}>{label}</span>
                    {canWrite ? (
                      <input type={secret && !showSenha ? 'password' : 'text'} value={val}
                        onChange={e => setConexaoForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder="—"
                        style={{ ...INP_SM, flex: 1, padding: '2px 6px', fontSize: 11 }} />
                    ) : (
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--foreground)', fontFamily: 'monospace' }}>
                        {secret && !showSenha ? '••••••' : (val || '—')}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                      {secret && <button onClick={() => setShowSenha(s => !s)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 11, padding: 0 }}>{showSenha ? '🙈' : '👁'}</button>}
                      {val && <CopyBtn value={val} label={label} />}
                    </div>
                  </div>
                ))}
                {canWrite && (
                  <button onClick={handleSaveConexao} disabled={isPending} style={{ marginTop: 6, padding: '4px 12px', borderRadius: 5, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, opacity: isPending ? 0.7 : 1 }}>
                    {isPending ? '...' : '💾 Salvar'}
                  </button>
                )}
              </Section>

              {/* Plano */}
              <Section title="Plano" color="#a78bfa">
                {[
                  { label: 'Plano',    key: 'nome',     val: planoForm.nome,     ph: 'Fibra 500MB' },
                  { label: 'Download', key: 'download', val: planoForm.download, ph: '500 Mbps' },
                  { label: 'Upload',   key: 'upload',   val: planoForm.upload,   ph: '250 Mbps' },
                ].map(({ label, key, val, ph }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #1e293b' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 60, flexShrink: 0 }}>{label}</span>
                    {canWrite
                      ? <input value={val} onChange={e => setPlanoForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={{ ...INP_SM, flex: 1, padding: '2px 6px', fontSize: 11 }} />
                      : <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 600 }}>{val || '—'}</span>}
                  </div>
                ))}
                {canWrite && (
                  <button onClick={handleSavePlano} disabled={isPending} style={{ marginTop: 6, padding: '4px 12px', borderRadius: 5, border: 'none', background: '#6d28d9', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, opacity: isPending ? 0.7 : 1 }}>
                    {isPending ? '...' : '💾 Salvar'}
                  </button>
                )}
              </Section>

              {/* Equipe + Rede */}
              <Section title="Equipe & Rede" color="#f59e0b">
                {canWrite && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                    {!editMode
                      ? <button onClick={() => setEditMode(true)} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontSize: 11 }}>Editar</button>
                      : <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => setEditMode(false)} style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
                          <button onClick={handleSaveFields} disabled={isPending} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: '#f59e0b', color: '#000', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{isPending ? '...' : 'Salvar'}</button>
                        </div>
                    }
                  </div>
                )}
                {editMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={ROW2}>
                      <div style={COL}>
                        <label style={LBL}>Técnico</label>
                        <select style={INP_SM} value={fields.tecnico_nome} onChange={e => {
                          const u = usuarios.find(u => (u.nome_completo || u.username) === e.target.value)
                          setFields(p => ({ ...p, tecnico_nome: e.target.value, tecnico_id: u?.username ?? '' }))
                        }}>
                          <option value="">— Nenhum —</option>
                          {usuarios.map(u => { const n = u.nome_completo || u.username; return <option key={u._id} value={n}>{n}</option> })}
                        </select>
                      </div>
                      <div style={COL}>
                        <label style={LBL}>Auxiliar</label>
                        <select style={INP_SM} value={fields.auxiliar_nome} onChange={e => {
                          const u = usuarios.find(u => (u.nome_completo || u.username) === e.target.value)
                          setFields(p => ({ ...p, auxiliar_nome: e.target.value, auxiliar_id: u?.username ?? '' }))
                        }}>
                          <option value="">— Nenhum —</option>
                          {usuarios.map(u => { const n = u.nome_completo || u.username; return <option key={u._id} value={n}>{n}</option> })}
                        </select>
                      </div>
                    </div>
                    <div><label style={LBL}>OLT</label><select style={INP_SM} value={fields.olt_id} onChange={e => setF('olt_id', e.target.value)}><option value="">—</option>{olts.map(o => <option key={o._id} value={o.id}>{o.nome}</option>)}</select></div>
                    <div style={ROW2}>
                      <div style={COL}><label style={LBL}>PON</label><input style={INP_SM} value={fields.pon} onChange={e => setF('pon', e.target.value)} placeholder="0/1/0" /></div>
                      <div style={COL}><label style={LBL}>CTO</label><input style={INP_SM} value={fields.cto_id} onChange={e => setF('cto_id', e.target.value)} /></div>
                    </div>
                    <div style={ROW2}>
                      <div style={COL}><label style={LBL}>Porta CTO</label><input type="number" style={INP_SM} value={fields.porta_cto} onChange={e => setF('porta_cto', e.target.value)} /></div>
                      <div style={COL}><label style={LBL}>Serial ONU</label><input style={INP_SM} value={fields.onu_serial} onChange={e => setF('onu_serial', e.target.value)} /></div>
                    </div>
                    <div style={ROW2}>
                      <div style={COL}><label style={LBL}>RX (dBm)</label><input type="number" step="0.01" style={INP_SM} value={fields.rx_power} onChange={e => setF('rx_power', e.target.value)} /></div>
                      <div style={COL}><label style={LBL}>TX (dBm)</label><input type="number" step="0.01" style={INP_SM} value={fields.tx_power} onChange={e => setF('tx_power', e.target.value)} /></div>
                    </div>
                    <div><label style={LBL}>Agendamento</label><input type="datetime-local" style={INP_SM} value={fields.data_agendamento} onChange={e => setF('data_agendamento', e.target.value)} /></div>
                    <div><label style={LBL}>Obs. Técnico</label><textarea style={{ ...INP_SM, height: 52, resize: 'vertical' }} value={fields.obs_tecnico} onChange={e => setF('obs_tecnico', e.target.value)} /></div>
                  </div>
                ) : (
                  <>
                    <InfoRow label="Técnico"    value={os.tecnico_nome} />
                    <InfoRow label="Auxiliar"   value={os.auxiliar_nome} />
                    <InfoRow label="OLT"        value={olts.find(o => o.id === os.olt_id)?.nome ?? os.olt_id} />
                    <InfoRow label="PON"        value={os.pon} />
                    <InfoRow label="CTO"        value={os.cto_id} />
                    <InfoRow label="Porta CTO"  value={os.porta_cto} />
                    <InfoRow label="Serial ONU" value={os.onu_serial} />
                  </>
                )}
              </Section>

              {/* Localização */}
              {(os.localizacao?.lat || os.localizacao?.lng) && (
                <Section title="Localização" color="#22c55e">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lat: <span style={{ color: 'var(--foreground)', fontFamily: 'monospace' }}>{os.localizacao.lat}</span></div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lng: <span style={{ color: 'var(--foreground)', fontFamily: 'monospace' }}>{os.localizacao.lng}</span></div>
                    </div>
                    <a href={`https://maps.google.com/?q=${os.localizacao.lat},${os.localizacao.lng}`} target="_blank" rel="noreferrer"
                      style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#14532d', border: '1px solid #16a34a44', color: '#4ade80', textDecoration: 'none' }}>
                      ↗ Maps
                    </a>
                  </div>
                </Section>
              )}
            </>
          )}

          {/* ════ TAB: MATERIAIS ════ */}
          {activeTab === 'materiais' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{materiais.length} item(s)</span>
                {(canWrite || canStatus) && (
                  <button onClick={() => setShowMatForm(s => !s)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #1e40af44', background: '#1e3a5f', color: '#93c5fd', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    {showMatForm ? '✕ Cancelar' : '+ Material'}
                  </button>
                )}
              </div>

              {showMatForm && (
                <div style={{ padding: '10px 12px', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 8, animation: 'fadeInUp 0.2s ease' }}>
                  {/* Preset dropdown */}
                  <div>
                    <label style={LBL}>Material</label>
                    <select
                      value={MATERIAIS_PRESET.includes(matForm.nome) ? matForm.nome : '__custom__'}
                      onChange={e => {
                        const val = e.target.value
                        const isMetros = MATERIAIS_METROS.has(val)
                        if (val !== '__custom__') setMatForm(p => ({ ...p, nome: val, unidade: isMetros ? 'm' : 'un', quantidade: isMetros ? 10 : 1 }))
                        else setMatForm(p => ({ ...p, nome: '', unidade: 'un', quantidade: 1 }))
                      }}
                      style={INP_SM}
                    >
                      <option value="">— Selecione —</option>
                      {MATERIAIS_PRESET.map(m => <option key={m} value={m}>{m}{MATERIAIS_METROS.has(m) ? ' (m)' : ''}</option>)}
                      <option value="__custom__">✏ Outro (digitar)</option>
                    </select>
                  </div>
                  {/* Custom name input */}
                  {!MATERIAIS_PRESET.includes(matForm.nome) && (
                    <input placeholder="Nome do material *" value={matForm.nome}
                      onChange={e => setMatForm(p => ({ ...p, nome: e.target.value }))}
                      style={INP_SM} autoFocus />
                  )}
                  <div style={ROW2}>
                    <div style={COL}>
                      <label style={LBL}>{MATERIAIS_METROS.has(matForm.nome) ? 'Metragem (m)' : 'Qtd'}</label>
                      <input type="number" min="1" value={matForm.quantidade}
                        onChange={e => setMatForm(p => ({ ...p, quantidade: e.target.value }))}
                        style={INP_SM}
                        placeholder={MATERIAIS_METROS.has(matForm.nome) ? 'ex: 30' : '1'} />
                    </div>
                    <div style={COL}>
                      <label style={LBL}>Tipo</label>
                      <select value={matForm.tipo} onChange={e => setMatForm(p => ({...p, tipo: e.target.value}))} style={INP_SM}>
                        <option value="OS">OS</option>
                        <option value="COMODATO">COMODATO</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={handleAddMaterial} disabled={isPending || !matForm.nome.trim()} style={{ padding: '7px 0', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: isPending ? 0.7 : 1 }}>
                    {isPending ? 'Adicionando...' : '+ Adicionar'}
                  </button>
                </div>
              )}

              {materiais.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>Nenhum material adicionado</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {materiais.map((m, i) => (
                    <div key={m._id ?? i} className="os-mat-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, background: i % 2 === 0 ? '#0f172a' : 'transparent' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Qtd: {m.quantidade}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: m.tipo === 'COMODATO' ? '#451a0322' : '#1e3a5f22', color: m.tipo === 'COMODATO' ? '#fb923c' : '#60a5fa', border: `1px solid ${m.tipo === 'COMODATO' ? '#ea580c44' : '#3b82f644'}` }}>{m.tipo}</span>
                      {canDelete && <button onClick={() => handleRemoveMaterial(m._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>✕</button>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════ TAB: FOTOS ════ */}
          {activeTab === 'fotos' && (
            <>
              {canWrite && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFotos} style={{ display: 'none' }} />
                  <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 0', borderRadius: 7, border: '2px dashed #334155', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12, width: '100%' }}>
                    📷 Selecionar fotos
                  </button>
                </>
              )}

              {fotos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>Nenhuma foto adicionada</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {fotos.map((f, i) => (
                    <div key={f._id ?? i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #1e293b', background: '#0f172a' }}>
                      <img src={f.url} alt={f.nome} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.nome}</span>
                        {canWrite && <button onClick={() => handleRemoveFoto(f._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 10, color: '#334155', textAlign: 'center' }}>Em produção, usar armazenamento externo (S3, Cloudinary, etc.)</p>
            </>
          )}

          {/* ════ TAB: HISTÓRICO ════ */}
          {activeTab === 'historico' && (
            <>
              {canWrite && (
                <div style={{ marginBottom: 4 }}>
                  {showNota ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, animation: 'fadeInUp 0.2s ease' }}>
                      <textarea value={notaText} onChange={e => setNotaText(e.target.value)} placeholder="Digite a nota..." rows={2} style={{ ...INP_SM, resize: 'none' }} />
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button onClick={() => { setShowNota(false); setNotaText('') }} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
                        <button onClick={handleAddNota} disabled={isPending || !notaText.trim()} style={{ flex: 2, padding: '6px 0', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Adicionar Nota</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowNota(true)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #1e40af44', background: '#1e3a5f', color: '#93c5fd', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>+ Nota</button>
                  )}
                </div>
              )}

              {/* Auto entry: criação */}
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                <div style={{ position: 'absolute', left: 5, top: 6, width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                <div style={{ position: 'absolute', left: 8, top: 14, width: 1, height: 'calc(100% - 14px)', background: '#1e293b' }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>OS aberta</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{os.criado_por ?? 'Sistema'} · {fmtDateTime(os.data_abertura ?? os.created_at)}</div>
              </div>

              {historico.length === 0 && <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 11 }}>Nenhum registro adicional</div>}

              {[...historico].reverse().map((h, i) => {
                const colors = ['#a78bfa','#22c55e','#f59e0b','#3b82f6','#f87171']
                const c = colors[i % colors.length]
                return (
                  <div key={h._id ?? i} style={{ position: 'relative', paddingLeft: 20, animation: 'fadeInUp 0.2s ease' }}>
                    <div style={{ position: 'absolute', left: 5, top: 6, width: 8, height: 8, borderRadius: '50%', background: c }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>{h.acao}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{h.usuario_nome ?? '—'} · {fmtDateTime(h.timestamp)}</div>
                  </div>
                )
              })}
            </>
          )}

          {/* ════ TAB: PROVISIONAR ════ */}
          {activeTab === 'provisionar' && (
            <>
              <div style={{ padding: '10px 14px', background: '#1a2742', borderRadius: 8, border: '1px solid #3b82f644', fontSize: 12, color: '#93c5fd', lineHeight: 1.5 }}>
                Preencha os dados e clique em <strong>Concluir e Provisionar</strong> para ativar a ONU na OLT automaticamente.
              </div>
              <form onSubmit={handleConcluir} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={LBL}>Serial ONU *</label><input required style={INP_SM} value={conclusaoForm.serial} onChange={e => setC('serial', e.target.value)} placeholder="Ex: HWTC12345678" /></div>
                <div><label style={LBL}>OLT</label><select style={INP_SM} value={conclusaoForm.oltId} onChange={e => setC('oltId', e.target.value)}><option value="">—</option>{olts.map(o => <option key={o._id} value={o.id}>{o.nome}</option>)}</select></div>
                <div style={ROW2}>
                  <div style={COL}><label style={LBL}>Porta PON</label><input style={INP_SM} value={conclusaoForm.ponPort} onChange={e => setC('ponPort', e.target.value)} placeholder="0/1/0" /></div>
                  <div style={COL}><label style={LBL}>CTO ID</label><input style={INP_SM} value={conclusaoForm.ctoId} onChange={e => setC('ctoId', e.target.value)} /></div>
                </div>
                <Divider label="Sinal coletado" color="#22c55e" />
                <div style={ROW2}>
                  <div style={COL}><label style={LBL}>RX Power (dBm)</label><input type="number" step="0.01" style={INP_SM} value={conclusaoForm.rx_power} onChange={e => setC('rx_power', e.target.value)} placeholder="-18.5" /></div>
                  <div style={COL}><label style={LBL}>TX Power (dBm)</label><input type="number" step="0.01" style={INP_SM} value={conclusaoForm.tx_power} onChange={e => setC('tx_power', e.target.value)} placeholder="2.5" /></div>
                </div>
                <div><label style={LBL}>Observações finais</label><textarea style={{ ...INP_SM, height: 56, resize: 'vertical' }} value={conclusaoForm.obs_tecnico} onChange={e => setC('obs_tecnico', e.target.value)} /></div>
                <button type="submit" disabled={isPending} style={{ padding: '11px 0', borderRadius: 8, border: 'none', background: isPending ? '#15803d' : '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800, opacity: isPending ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {isPending && <span style={{ width: 13, height: 13, border: '2px solid #ffffff44', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />}
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

// SGP-style status tab definitions (order matters for tab row)
const STATUS_TABS = [
  { key: '', label: 'Todos', color: '#64748b' },
  { key: 'aberta',       label: 'Aberta',       color: '#3b82f6' },
  { key: 'agendada',     label: 'Agendada',     color: '#a78bfa' },
  { key: 'em_andamento', label: 'Em andamento', color: '#f59e0b' },
  { key: 'concluida',    label: 'Concluida',    color: '#22c55e' },
  { key: 'cancelada',    label: 'Cancelada',    color: '#ef4444' },
]

// Strip counts for the stats bar (keyed from stats object)
const STATS_STRIP = [
  { key: 'abertas',      status: 'aberta',       label: 'Abertas',      color: '#3b82f6' },
  { key: 'agendadas',    status: 'agendada',     label: 'Agendadas',    color: '#a78bfa' },
  { key: 'em_andamento', status: 'em_andamento', label: 'Em andamento', color: '#f59e0b' },
  { key: 'concluidas',   status: 'concluida',    label: 'Concluidas',   color: '#22c55e' },
  { key: 'canceladas',   status: 'cancelada',    label: 'Canceladas',   color: '#ef4444' },
]

export default function ServiceOrdersClient({ initialItems, initialTotal, stats, olts, usuarios = [], userRole, userId = '', userName }) {
  const [items, setItems]               = useState(initialItems ?? [])
  const [total, setTotal]               = useState(initialTotal ?? 0)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTipo, setFilterTipo]     = useState('')
  const [search, setSearch]             = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [selectedOS, setSelectedOS]     = useState(null)
  const [view, setView]                 = useState('list')   // 'list' | 'kanban'
  const [loading, startTransition]      = useTransition()

  const canCreate = CAN_CREATE.includes(userRole)

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

  const hasFilters = !!(filterStatus || filterTipo || search)

  return (
    <div>
      {/* Inject global animations */}
      <style>{GLOBAL_STYLES}</style>

      {/* ── SGP Stats Strip ── */}
      {stats && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {STATS_STRIP.map(({ key, status, label, color }) => (
            <button
              key={key}
              onClick={() => toggleStatus(status)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', borderRadius: 7, cursor: 'pointer',
                border: `1px solid ${filterStatus === status ? color : 'var(--border-color)'}`,
                background: filterStatus === status ? `${color}22` : 'var(--card-bg)',
                transition: 'all 0.12s',
                outline: 'none',
              }}
            >
              <span style={{
                fontSize: 18, fontWeight: 800, color,
                lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              }}>
                {stats[key] ?? 0}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── SGP Status Tabs ── */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        marginBottom: 16,
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: 0,
      }}>
        {STATUS_TABS.map(({ key, label, color }) => {
          const isActive = filterStatus === key
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              style={{
                padding: '7px 16px', borderRadius: '6px 6px 0 0',
                fontSize: 12, fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', outline: 'none',
                border: `1px solid ${isActive ? color : 'var(--border-color)'}`,
                borderBottom: isActive ? `2px solid ${color}` : '1px solid var(--border-color)',
                background: isActive ? `${color}22` : 'transparent',
                color: isActive ? color : 'var(--text-muted)',
                marginBottom: -1,
                transition: 'all 0.12s',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Search */}
        <input
          placeholder="Buscar OS, cliente, tecnico, serial..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 220px', minWidth: 0,
            background: 'var(--inp-bg)', border: '1px solid var(--border-color)',
            borderRadius: 7, padding: '7px 12px', color: 'var(--foreground)', fontSize: 13,
          }}
        />

        {/* Tipo chip filters */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Object.entries(TIPO_META).map(([k, v]) => (
            <button
              key={k}
              onClick={() => toggleTipo(k)}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
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
          borderRadius: 7, overflow: 'hidden', flexShrink: 0,
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
          onClick={reload}
          disabled={loading}
          title="Recarregar"
          style={{
            padding: '6px 11px', borderRadius: 7, border: '1px solid var(--border-color)',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15,
            flexShrink: 0,
          }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
            ↻
          </span>
        </button>

        {/* New OS */}
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '7px 18px', borderRadius: 7, border: 'none',
              background: '#3b82f6', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >+ Nova OS</button>
        )}
      </div>

      {/* ── Result count ── */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>
          {filtered.length} {filtered.length === 1 ? 'ordem de servico' : 'ordens de servico'}
          {filtered.length !== total && ` (de ${total} carregadas)`}
        </span>
        {hasFilters && (
          <button
            onClick={() => { setFilterStatus(''); setFilterTipo(''); setSearch('') }}
            style={{
              fontSize: 11, color: '#3b82f6', background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0,
            }}
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
                <tr style={{ background: 'var(--background)', borderBottom: '2px solid var(--border-color)' }}>
                  {/* Priority strip column header (no text) */}
                  <th style={{ width: 4, padding: 0 }} />
                  {[
                    { label: 'No OS',        style: { minWidth: 80 } },
                    { label: 'Data',         style: { minWidth: 80 } },
                    { label: 'Tipo',         style: { minWidth: 100 } },
                    { label: 'Cliente',      style: { minWidth: 160 } },
                    { label: 'Tecnico',      style: { minWidth: 110 } },
                    { label: 'Agendamento',  style: { minWidth: 100 } },
                    { label: 'Status',       style: { minWidth: 110 } },
                    { label: 'Acoes',        style: { width: 56, textAlign: 'center' } },
                  ].map(({ label, style }) => (
                    <th key={label} style={{
                      padding: '9px 12px', textAlign: 'left',
                      color: 'var(--text-muted)', fontSize: 10, fontWeight: 700,
                      whiteSpace: 'nowrap', letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      ...style,
                    }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Nenhuma OS encontrada</div>
                      {hasFilters && (
                        <button
                          onClick={() => { setFilterStatus(''); setFilterTipo(''); setSearch('') }}
                          style={{
                            fontSize: 12, color: '#3b82f6', background: 'none',
                            border: 'none', cursor: 'pointer', textDecoration: 'underline',
                          }}
                        >Limpar filtros</button>
                      )}
                    </td>
                  </tr>
                )}
                {filtered.map(os => {
                  const pm    = PRIO_META[os.prioridade]
                  const strip = pm?.strip && pm.strip !== 'transparent' ? pm.strip : null
                  const sched = relTime(os.data_agendamento)
                  const smColor = STATUS_META[os.status]?.color ?? '#60a5fa'
                  return (
                    <tr
                      key={os._id ?? os.os_id}
                      onClick={() => setSelectedOS(os)}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--card-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Priority color strip — 4px left accent */}
                      <td style={{ padding: 0, width: 4 }}>
                        <div style={{
                          width: 4, height: '100%', minHeight: 48,
                          background: strip ?? 'transparent',
                          borderRadius: '2px 0 0 2px',
                        }} />
                      </td>

                      {/* No OS — colored, bold, monospace feel */}
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          color: smColor, fontWeight: 800,
                          fontSize: 12, fontFamily: 'monospace',
                        }}>
                          {os.os_id}
                        </span>
                      </td>

                      {/* Data abertura */}
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {fmtDate(os.data_abertura)}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        <TipoBadge tipo={os.tipo} />
                      </td>

                      {/* Cliente — two lines: bold name + muted address */}
                      <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                        <div style={{
                          fontSize: 12, color: 'var(--foreground)', fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {os.cliente_nome ?? '—'}
                        </div>
                        {os.cliente_endereco && (
                          <div style={{
                            fontSize: 10, color: 'var(--text-muted)', marginTop: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {os.cliente_endereco}
                          </div>
                        )}
                      </td>

                      {/* Tecnico */}
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {os.tecnico_nome ?? '—'}
                        </span>
                        {os.auxiliar_nome && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginTop: 1 }}>
                            + {os.auxiliar_nome}
                          </span>
                        )}
                      </td>

                      {/* Agendamento — relative time */}
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        {sched
                          ? <span style={{ color: sched.color, fontWeight: 600, fontSize: 11 }}>{sched.label}</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                        }
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        <StatusBadge status={os.status} />
                      </td>

                      {/* Acoes — eye icon opens drawer */}
                      <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                        <button
                          title="Ver detalhes"
                          onClick={e => { e.stopPropagation(); setSelectedOS(os) }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', fontSize: 16, lineHeight: 1,
                            padding: '3px 6px', borderRadius: 5,
                            transition: 'color 0.12s, background 0.12s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = smColor; e.currentTarget.style.background = `${smColor}18` }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                        >
                          &#128065;
                        </button>
                      </td>
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
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Nenhuma OS encontrada</div>
                {hasFilters && (
                  <button
                    onClick={() => { setFilterStatus(''); setFilterTipo(''); setSearch('') }}
                    style={{
                      fontSize: 12, color: '#3b82f6', background: 'none',
                      border: 'none', cursor: 'pointer', textDecoration: 'underline',
                    }}
                  >Limpar filtros</button>
                )}
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
          usuarios={usuarios}
          userRole={userRole}
          userId={userId}
          onClose={() => setSelectedOS(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
