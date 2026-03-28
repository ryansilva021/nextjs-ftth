'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
  listOS, createOS, updateOSStatus, updateOSFields,
  concludeInstallation, deleteOS,
} from '@/actions/service-orders'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META = {
  aberta:       { label: 'Aberta',       color: '#3B82F6', bg: '#1e3a5f' },
  agendada:     { label: 'Agendada',     color: '#A78BFA', bg: '#2e1b4e' },
  em_andamento: { label: 'Em andamento', color: '#F59E0B', bg: '#451a03' },
  concluida:    { label: 'Concluída',    color: '#22C55E', bg: '#052e16' },
  cancelada:    { label: 'Cancelada',    color: '#EF4444', bg: '#450a0a' },
}

const TIPO_META = {
  instalacao:   { label: 'Instalação',   icon: '📶', color: '#22C55E' },
  manutencao:   { label: 'Manutenção',   icon: '🔧', color: '#F59E0B' },
  suporte:      { label: 'Suporte',      icon: '💬', color: '#3B82F6' },
  cancelamento: { label: 'Cancelamento', icon: '❌', color: '#EF4444' },
}

const PRIO_META = {
  baixa:   { label: 'Baixa',   color: '#6B7280' },
  normal:  { label: 'Normal',  color: '#94A3B8' },
  alta:    { label: 'Alta',    color: '#F59E0B' },
  urgente: { label: 'Urgente', color: '#EF4444' },
}

const STATUS_FLOW = {
  aberta:       ['agendada', 'em_andamento', 'cancelada'],
  agendada:     ['em_andamento', 'cancelada'],
  em_andamento: ['concluida', 'cancelada'],
  concluida:    [],
  cancelada:    [],
}

const CAN_WRITE  = ['superadmin', 'admin', 'tecnico', 'comercial']
const CAN_EXECUTE = ['superadmin', 'admin', 'tecnico']
const CAN_DELETE  = ['superadmin', 'admin']

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const INP = {
  background: 'var(--inp-bg)', border: '1px solid var(--border-color)',
  borderRadius: 6, padding: '7px 10px', color: 'var(--foreground)',
  fontSize: 13, width: '100%',
}
const INP_SM = { ...INP, fontSize: 12, padding: '6px 10px' }
const LBL = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, display: 'block' }
const ROW2 = { display: 'flex', gap: 12 }
const COL  = { flex: 1, minWidth: 0 }

// ─── UI Atoms ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label: status, color: '#6B7280', bg: '#1f2937' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, color: m.color,
      backgroundColor: m.bg, border: `1px solid ${m.color}44`,
    }}>{m.label}</span>
  )
}

function TipoBadge({ tipo }) {
  const m = TIPO_META[tipo] ?? { label: tipo, icon: '📋', color: '#6B7280' }
  return <span style={{ fontSize: 12, color: m.color }}>{m.icon} {m.label}</span>
}

function PrioBadge({ prioridade }) {
  const m = PRIO_META[prioridade] ?? { label: prioridade, color: '#6B7280' }
  const dot = m.label === 'Urgente' ? '🔴' : m.label === 'Alta' ? '🟡' : '⚪'
  return <span style={{ fontSize: 11, color: m.color, fontWeight: 600 }}>{dot} {m.label}</span>
}

function KPICard({ label, value, color, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      background: active ? `${color}22` : 'var(--card-bg)',
      border: `1px solid ${active ? color : 'var(--border-color)'}`,
      borderRadius: 10, padding: '14px 16px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.15s', minWidth: 90,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
      {label && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: 12, padding: 24, width: '100%', maxWidth: 580,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>
            Nova Ordem de Serviço
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {err && (
          <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#fca5a5' }}>
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

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

          <Divider label="Cliente" />

          {/* Cliente */}
          <div>
            <label style={LBL}>Nome do Cliente *</label>
            <input style={INP} required value={form.cliente_nome} onChange={e => set('cliente_nome', e.target.value)} placeholder="Ex: João da Silva" />
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

          <Divider label="Equipe" />

          {/* Equipe */}
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

          <Divider label="Rede — opcional (pode preencher depois)" />

          {/* Rede — sempre visível, mas opcional */}
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

          <Divider label="Observações" />

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
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 18px', borderRadius: 7, border: '1px solid var(--border-color)',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
            }}>Cancelar</button>
            <button type="submit" disabled={isPending} style={{
              padding: '8px 22px', borderRadius: 7, border: 'none',
              background: '#3B82F6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              opacity: isPending ? 0.7 : 1,
            }}>
              {isPending ? 'Criando...' : '+ Criar OS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Section / Row helpers ─────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--background)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--foreground)', textAlign: 'right', wordBreak: 'break-all' }}>{value ?? '—'}</span>
    </div>
  )
}

// ─── OS Drawer ────────────────────────────────────────────────────────────────

function OSDrawer({ os, olts, userRole, onClose, onUpdated, onDeleted }) {
  const [activeTab, setActiveTab] = useState('info')
  const [isPending, startTransition] = useTransition()
  const [editMode, setEditMode] = useState(false)
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

  function setF(k, v) { setFields(p => ({ ...p, [k]: v })) }
  function setC(k, v) { setConclusaoForm(p => ({ ...p, [k]: v })) }

  function handleStatusChange(s) {
    setErr(null); setMsg(null)
    startTransition(async () => {
      try {
        const updated = await updateOSStatus(os.os_id, s)
        onUpdated(updated)
        setMsg(`Status → "${STATUS_META[s]?.label}"`)
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
        setMsg('Dados salvos.')
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
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{
        width: 430, maxWidth: '100vw',
        background: 'var(--card-bg)', borderLeft: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-color)',
          background: '#0d1526',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>{os.os_id}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <TipoBadge tipo={os.tipo} />
                <StatusBadge status={os.status} />
                <PrioBadge prioridade={os.prioridade} />
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>
          {os.cliente_nome && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              👤 {os.cliente_nome}
              {os.tecnico_nome && <span style={{ marginLeft: 12 }}>🔧 {os.tecnico_nome}</span>}
              {os.auxiliar_nome && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>+ {os.auxiliar_nome}</span>}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--background)' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: '9px 14px', fontSize: 12, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === t ? '2px solid #3B82F6' : '2px solid transparent',
              color: activeTab === t ? '#3B82F6' : 'var(--text-muted)',
            }}>{tabLabels[t]}</button>
          ))}
        </div>

        {/* Feedback */}
        {err && <div style={{ margin: '8px 16px 0', background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: '#fca5a5' }}>{err}</div>}
        {msg && <div style={{ margin: '8px 16px 0', background: '#052e16', border: '1px solid #16a34a44', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: '#4ade80' }}>{msg}</div>}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── TAB: Dados ── */}
          {activeTab === 'info' && (
            <>
              <Section title="Cliente">
                <InfoRow label="Nome"     value={os.cliente_nome} />
                <InfoRow label="Contato"  value={os.cliente_contato} />
                <InfoRow label="Endereço" value={os.cliente_endereco} />
              </Section>

              <Section title="Datas">
                <InfoRow label="Abertura"    value={fmtDateTime(os.data_abertura)} />
                <InfoRow label="Agendamento" value={fmtDateTime(os.data_agendamento)} />
                <InfoRow label="Execução"    value={fmtDateTime(os.data_execucao)} />
                <InfoRow label="Fechamento"  value={fmtDateTime(os.data_fechamento)} />
              </Section>

              {(os.descricao || os.obs_tecnico || os.resultado) && (
                <Section title="Observações">
                  {os.descricao    && <InfoRow label="Descrição" value={os.descricao} />}
                  {os.obs_tecnico  && <InfoRow label="Técnico"   value={os.obs_tecnico} />}
                  {os.resultado    && <div style={{ fontSize: 12, color: '#4ade80', marginTop: 4 }}>✓ {os.resultado}</div>}
                </Section>
              )}

              {os.status === 'concluida' && (os.rx_power != null || os.tx_power != null) && (
                <Section title="Sinal coletado">
                  <div style={{ display: 'flex', gap: 20 }}>
                    {os.rx_power != null && <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>RX Power</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: os.rx_power < -28 ? '#EF4444' : '#22C55E' }}>{os.rx_power} dBm</div>
                    </div>}
                    {os.tx_power != null && <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TX Power</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>{os.tx_power} dBm</div>
                    </div>}
                  </div>
                </Section>
              )}

              {/* Status transitions */}
              {canWrite && nextStatuses.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Avançar status</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {nextStatuses.map(s => (
                      <button key={s} disabled={isPending} onClick={() => handleStatusChange(s)} style={{
                        padding: '6px 14px', borderRadius: 6,
                        border: `1px solid ${STATUS_META[s]?.color}44`,
                        background: STATUS_META[s]?.bg, color: STATUS_META[s]?.color,
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        opacity: isPending ? 0.6 : 1,
                      }}>{STATUS_META[s]?.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {canDelete && (
                <button onClick={handleDelete} disabled={isPending} style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid #7f1d1d',
                  background: '#450a0a', color: '#fca5a5', cursor: 'pointer', fontSize: 12,
                  alignSelf: 'flex-start', marginTop: 4,
                }}>Excluir OS</button>
              )}
            </>
          )}

          {/* ── TAB: Rede / Equipe ── */}
          {activeTab === 'rede' && (
            <>
              {canWrite && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {!editMode
                    ? <button onClick={() => setEditMode(true)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>Editar</button>
                    : <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setEditMode(false)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
                        <button onClick={handleSaveFields} disabled={isPending} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#3B82F6', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          {isPending ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                  }
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
                    <div style={COL}><label style={LBL}>RX Power</label><input type="number" step="0.01" style={INP_SM} value={fields.rx_power} onChange={e => setF('rx_power', e.target.value)} /></div>
                    <div style={COL}><label style={LBL}>TX Power</label><input type="number" step="0.01" style={INP_SM} value={fields.tx_power} onChange={e => setF('tx_power', e.target.value)} /></div>
                  </div>
                  <div><label style={LBL}>Agendamento</label><input type="datetime-local" style={INP_SM} value={fields.data_agendamento} onChange={e => setF('data_agendamento', e.target.value)} /></div>
                  <div><label style={LBL}>Obs. Técnico</label><textarea style={{ ...INP_SM, height: 64, resize: 'vertical' }} value={fields.obs_tecnico} onChange={e => setF('obs_tecnico', e.target.value)} /></div>
                </div>
              ) : (
                <>
                  <Section title="Equipe">
                    <InfoRow label="Técnico"  value={os.tecnico_nome} />
                    <InfoRow label="Auxiliar" value={os.auxiliar_nome} />
                  </Section>
                  <Section title="Rede">
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

          {/* ── TAB: Provisionar ── */}
          {activeTab === 'provisionar' && (
            <>
              <div style={{ padding: '10px 14px', background: '#1a2742', borderRadius: 8, border: '1px solid #3B82F644', fontSize: 12, color: '#93c5fd' }}>
                Preencha os dados e clique em <strong>Concluir e Provisionar</strong> para ativar a ONU na OLT automaticamente.
              </div>
              <form onSubmit={handleConcluir} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
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
                <div style={ROW2}>
                  <div style={COL}><label style={LBL}>RX Power (dBm)</label><input type="number" step="0.01" style={INP_SM} value={conclusaoForm.rx_power} onChange={e => setC('rx_power', e.target.value)} /></div>
                  <div style={COL}><label style={LBL}>TX Power (dBm)</label><input type="number" step="0.01" style={INP_SM} value={conclusaoForm.tx_power} onChange={e => setC('tx_power', e.target.value)} /></div>
                </div>
                <div>
                  <label style={LBL}>Observações finais</label>
                  <textarea style={{ ...INP_SM, height: 56, resize: 'vertical' }} value={conclusaoForm.obs_tecnico} onChange={e => setC('obs_tecnico', e.target.value)} />
                </div>
                <button type="submit" disabled={isPending} style={{
                  padding: '9px 0', borderRadius: 7, border: 'none',
                  background: '#22C55E', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  opacity: isPending ? 0.7 : 1,
                }}>
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

// ─── Mobile Card ────────────────────────────────────────────────────────────────

function MobileCard({ os, onOpen }) {
  return (
    <div onClick={() => onOpen(os)} style={{
      background: 'var(--card-bg)', border: '1px solid var(--border-color)',
      borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{os.os_id}</div>
          <div style={{ marginTop: 4 }}><TipoBadge tipo={os.tipo} /></div>
        </div>
        <StatusBadge status={os.status} />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{os.cliente_nome ?? '—'}</div>
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

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ServiceOrdersClient({ initialItems, initialTotal, stats, olts, userRole }) {
  const [items, setItems]           = useState(initialItems ?? [])
  const [total, setTotal]           = useState(initialTotal ?? 0)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTipo, setFilterTipo]     = useState('')
  const [search, setSearch]             = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [selectedOS, setSelectedOS]     = useState(null)
  const [loading, startTransition]      = useTransition()

  const canCreate = CAN_WRITE.includes(userRole)

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

  const reload = useCallback(() => {
    startTransition(async () => {
      try {
        const data = await listOS({ limit: 100 })
        setItems(data.items)
        setTotal(data.total)
      } catch {}
    })
  }, [])

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

  function selBtn(key, active, onClick, label) {
    return (
      <button key={key} onClick={onClick} style={{
        padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
        border: '1px solid var(--border-color)',
        background: active ? '#3B82F622' : 'transparent',
        color: active ? '#3B82F6' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
      }}>{label}</button>
    )
  }

  return (
    <div>
      {/* KPI row */}
      {stats && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <KPICard label="Total"        value={stats.total}        color="#94A3B8" onClick={() => setFilterStatus('')}                                       active={!filterStatus} />
          <KPICard label="Abertas"      value={stats.abertas}      color="#3B82F6" onClick={() => setFilterStatus(filterStatus === 'aberta'       ? '' : 'aberta')}       active={filterStatus === 'aberta'} />
          <KPICard label="Agendadas"    value={stats.agendadas}    color="#A78BFA" onClick={() => setFilterStatus(filterStatus === 'agendada'     ? '' : 'agendada')}     active={filterStatus === 'agendada'} />
          <KPICard label="Em andamento" value={stats.em_andamento} color="#F59E0B" onClick={() => setFilterStatus(filterStatus === 'em_andamento' ? '' : 'em_andamento')} active={filterStatus === 'em_andamento'} />
          <KPICard label="Concluídas"   value={stats.concluidas}   color="#22C55E" onClick={() => setFilterStatus(filterStatus === 'concluida'   ? '' : 'concluida')}   active={filterStatus === 'concluida'} />
          <KPICard label="Canceladas"   value={stats.canceladas}   color="#EF4444" onClick={() => setFilterStatus(filterStatus === 'cancelada'   ? '' : 'cancelada')}   active={filterStatus === 'cancelada'} />
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          placeholder="Buscar OS, cliente, técnico, serial..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 200px', minWidth: 0,
            background: 'var(--inp-bg)', border: '1px solid var(--border-color)',
            borderRadius: 7, padding: '7px 12px', color: 'var(--foreground)', fontSize: 13,
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(TIPO_META).map(([k, v]) =>
            selBtn(k, filterTipo === k, () => setFilterTipo(filterTipo === k ? '' : k), `${v.icon} ${v.label}`)
          )}
        </div>
        <button onClick={reload} disabled={loading} style={{
          padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border-color)',
          background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
        }}>{loading ? '...' : '↻'}</button>
        {canCreate && (
          <button onClick={() => setShowCreate(true)} style={{
            padding: '7px 18px', borderRadius: 7, border: 'none',
            background: '#3B82F6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>+ Nova OS</button>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        {filtered.length} OS{filtered.length !== total ? ` (de ${total})` : ''}
      </div>

      {/* Table — desktop */}
      <div className="noc-table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {['OS ID', 'Tipo', 'Cliente', 'Técnico / Aux.', 'OLT / PON', 'Status', 'Prioridade', 'Abertura'].map(h => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left',
                  color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Nenhuma OS encontrada
              </td></tr>
            )}
            {filtered.map(os => (
              <tr
                key={os._id}
                onClick={() => setSelectedOS(os)}
                style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--card-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 12px', color: '#60a5fa', fontWeight: 600, whiteSpace: 'nowrap' }}>{os.os_id}</td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><TipoBadge tipo={os.tipo} /></td>
                <td style={{ padding: '10px 12px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--foreground)' }}>{os.cliente_nome ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {os.tecnico_nome ?? '—'}
                  {os.auxiliar_nome && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> + {os.auxiliar_nome}</span>}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {os.olt_id ? `${os.olt_id}${os.pon ? ` / ${os.pon}` : ''}` : '—'}
                </td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><StatusBadge status={os.status} /></td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><PrioBadge prioridade={os.prioridade} /></td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(os.data_abertura)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="noc-cards-wrap">
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma OS encontrada</div>
        )}
        {filtered.map(os => <MobileCard key={os._id} os={os} onOpen={setSelectedOS} />)}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          olts={olts}
          userRole={userRole}
        />
      )}

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
