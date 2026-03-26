'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import OltMgmtTab from './OltMgmtTab'

// ─── Style constants ──────────────────────────────────────────────────────────

const card = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: 12,
  padding: 20,
}

const btn = (color = '#0284c7') => ({
  backgroundColor: color,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
})

const btnOutline = {
  backgroundColor: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  padding: '7px 15px',
  fontSize: 13,
  cursor: 'pointer',
}

const inp = {
  backgroundColor: 'var(--inp-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--foreground)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const lbl = {
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 600,
  display: 'block',
  marginBottom: 4,
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

const STATUS_OLT = {
  ativo:         { label: 'Ativo',      color: '#22c55e' },
  inativo:       { label: 'Inativo',    color: '#ef4444' },
  em_manutencao: { label: 'Manutenção', color: '#f59e0b' },
}

const STATUS_ONU = {
  active:       { label: 'Ativa',         color: '#22c55e' },
  provisioning: { label: 'Provisionando', color: '#60a5fa' },
  offline:      { label: 'Offline',       color: '#ef4444' },
  error:        { label: 'Erro',          color: '#f87171' },
}

const SIGNAL_QUALITY = {
  excelente: { label: 'Excelente', color: '#22c55e' },
  bom:       { label: 'Bom',       color: '#4ade80' },
  medio:     { label: 'Médio',     color: '#f59e0b' },
  critico:   { label: 'Crítico',   color: '#ef4444' },
}

const NIVEL_TERM_COLOR = {
  info:    '#4ade80',
  warn:    '#fbbf24',
  error:   '#f87171',
  success: '#86efac',
}

const ALERTA_CONFIG = {
  onu_offline:   { icon: '📴', color: '#ef4444', label: 'ONU Offline' },
  sinal_critico: { icon: '⚡', color: '#f97316', label: 'Sinal Crítico' },
  cto_cheia:     { icon: '📦', color: '#f59e0b', label: 'CTO Cheia' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function fmtTime(date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtHHMMSS(iso) {
  if (!iso) return '??:??:??'
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return '??:??:??' }
}

function barColor(pct) {
  if (pct >= 90) return '#ef4444'
  if (pct >= 70) return '#f59e0b'
  return '#22c55e'
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function MiniCard({ label, value, accent, sublabel }) {
  return (
    <div style={{ ...card, padding: '14px 18px', borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 700, color: accent ?? 'var(--foreground)', lineHeight: 1 }}>
        {value ?? '—'}
      </p>
      {sublabel && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{sublabel}</p>}
    </div>
  )
}

function StatusBadge({ statusMap, status }) {
  const cfg = statusMap?.[status]
  if (!cfg) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{status ?? '—'}</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      backgroundColor: cfg.color + '22', border: `1px solid ${cfg.color}55`,
      fontSize: 11, color: cfg.color, fontWeight: 600,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  )
}

function SignalBadge({ quality }) {
  if (!quality) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
  const cfg = SIGNAL_QUALITY[quality]
  if (!cfg) return null
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      backgroundColor: cfg.color + '22', border: `1px solid ${cfg.color}55`,
      fontSize: 11, color: cfg.color, fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid var(--border-color)', borderTopColor: 'var(--foreground)',
      borderRadius: '50%', animation: 'noc-spin 0.7s linear infinite',
      verticalAlign: 'middle',
    }} />
  )
}

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 16 }}>
      {children}
    </p>
  )
}

function FeedbackBanner({ feedback }) {
  if (!feedback) return null
  return (
    <div style={{
      padding: '10px 16px', borderRadius: 8, marginBottom: 12,
      backgroundColor: feedback.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${feedback.type === 'success' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
      color: feedback.type === 'success' ? '#16a34a' : '#dc2626',
      fontSize: 13,
    }}>
      {feedback.message}
    </div>
  )
}

// Table helpers
function TH({ children, right }) {
  return (
    <th style={{
      padding: '8px 12px', textAlign: right ? 'right' : 'left',
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

function TD({ children, mono, muted, right, bold, style: extra }) {
  return (
    <td style={{
      padding: '9px 12px',
      fontSize: mono ? 12 : 13,
      color: muted ? 'var(--text-muted)' : 'var(--foreground)',
      fontFamily: mono ? 'monospace' : undefined,
      fontWeight: bold ? 600 : undefined,
      textAlign: right ? 'right' : 'left',
      borderBottom: '1px solid var(--border-color)',
      verticalAlign: 'middle',
      ...extra,
    }}>
      {children}
    </td>
  )
}

// ─── TAB 1: VISÃO GERAL ───────────────────────────────────────────────────────

function VisaoGeralTab({ stats }) {
  const { oltStats, onuStats, totalCTOs, totalCDOs, pendingEvents, alertas = [] } = stats ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        <MiniCard label="ONUs Total"    value={onuStats?.total        ?? 0} />
        <MiniCard label="ONUs Ativas"   value={onuStats?.active       ?? 0} accent="#22c55e" />
        <MiniCard label="ONUs Offline"  value={onuStats?.offline      ?? 0} accent={onuStats?.offline > 0 ? '#ef4444' : undefined} />
        <MiniCard label="Provisionando" value={onuStats?.provisioning ?? 0} accent="#60a5fa" />
        <MiniCard label="OLTs Ativas"   value={oltStats?.ativos       ?? 0} accent="#22c55e" />
        <MiniCard label="CTOs"          value={totalCTOs              ?? 0} />
        <MiniCard label="Fila"          value={pendingEvents          ?? 0} accent={pendingEvents > 0 ? '#f59e0b' : undefined} />
      </div>

      {/* Alertas */}
      <div style={card}>
        <SectionTitle>
          {alertas.length > 0 ? `⚠ Alertas Ativos (${alertas.length})` : 'Alertas'}
        </SectionTitle>

        {alertas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#22c55e', fontSize: 13 }}>
            ✓ Nenhum alerta — rede operando normalmente
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alertas.map((a, i) => {
              const cfg = ALERTA_CONFIG[a.tipo] ?? { icon: '⚠', color: '#f59e0b', label: a.tipo }
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 8,
                  backgroundColor: cfg.color + '14', border: `1px solid ${cfg.color}44`,
                }}>
                  <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                    {a.tipo === 'onu_offline' && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {a.cliente ?? a.serial} {a.cto_id ? `— CTO ${a.cto_id}` : ''}
                      </span>
                    )}
                    {a.tipo === 'sinal_critico' && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {a.cliente ?? a.serial} — RX {a.rx_power?.toFixed(2)} dBm
                      </span>
                    )}
                    {a.tipo === 'cto_cheia' && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {a.nome ?? a.cto_id} — {a.pct}% ocupado
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB 2: CLIENTES ──────────────────────────────────────────────────────────

function ClientesTab({ onus = [], olts = [], onLog }) {
  const [search, setSearch]             = useState('')
  const [provisioning, setProvisioning] = useState(false)
  const [cancelling, setCancelling]     = useState(false)
  const [feedback, setFeedback]         = useState(null)
  const [form, setForm]                 = useState({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })

  function showFeedback(type, message) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 5000)
  }

  const filtered = onus.filter(o => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      o.serial?.toLowerCase().includes(q) ||
      o.cliente?.toLowerCase().includes(q) ||
      o.cto_id?.toLowerCase().includes(q) ||
      o.olt_id?.toLowerCase().includes(q)
    )
  })

  async function handleProvision() {
    if (!form.serial.trim()) { showFeedback('error', 'Serial ONU é obrigatório.'); return }
    setProvisioning(true)
    onLog('ONU', `Provisionando ${form.serial}`, 'info')
    try {
      const { manualProvision } = await import('@/actions/provisioning')
      const result = await manualProvision({
        serial:  form.serial.trim(),
        cliente: form.cliente.trim(),
        oltId:   form.oltId || null,
        ponPort: form.ponPort || null,
        ctoId:   form.ctoId.trim() || null,
      })
      if (result.processed) {
        showFeedback('success', `ONU ${form.serial} provisionada. Atualize a página para ver.`)
        onLog('ONU', `${form.serial} provisionada com sucesso`, 'success')
        setForm({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })
      } else {
        showFeedback('error', result.reason ?? 'Falha no provisionamento.')
        onLog('ONU', result.reason ?? 'Falha no provisionamento', 'error')
      }
    } catch (e) {
      showFeedback('error', e.message ?? 'Erro ao provisionar.')
      onLog('ONU', e.message, 'error')
    } finally {
      setProvisioning(false)
    }
  }

  async function handleCancel() {
    if (!form.serial.trim()) { showFeedback('error', 'Serial ONU é obrigatório.'); return }
    setCancelling(true)
    onLog('ONU', `Cancelando ONU ${form.serial}`, 'warn')
    try {
      const { manualCancel } = await import('@/actions/provisioning')
      await manualCancel(form.serial.trim())
      showFeedback('success', `ONU ${form.serial} cancelada. Atualize a página para ver.`)
      onLog('ONU', `${form.serial} cancelada`, 'info')
      setForm(f => ({ ...f, serial: '' }))
    } catch (e) {
      showFeedback('error', e.message ?? 'Erro ao cancelar.')
      onLog('ONU', e.message, 'error')
    } finally {
      setCancelling(false)
    }
  }

  const selectedOlt = olts.find(o => o.id === form.oltId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ONU list */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          <SectionTitle>ONUs Ativas ({filtered.length})</SectionTitle>
          <input
            style={{ ...inp, width: 240 }}
            type="text"
            placeholder="Buscar serial, cliente, CTO..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {onus.length === 0 ? 'Nenhuma ONU provisionada.' : 'Nenhum resultado.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Cliente</TH>
                  <TH>Serial</TH>
                  <TH>CTO</TH>
                  <TH right>Porta</TH>
                  <TH>OLT</TH>
                  <TH right>PON</TH>
                  <TH right>RX (dBm)</TH>
                  <TH>Qualidade</TH>
                  <TH>Status</TH>
                  <TH>Provisionado</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => (
                  <tr key={o._id ?? i}>
                    <TD bold>{o.cliente ?? '—'}</TD>
                    <TD mono>{o.serial}</TD>
                    <TD mono muted>{o.cto_id ?? '—'}</TD>
                    <TD right muted>{o.cto_port ?? '—'}</TD>
                    <TD mono muted>{o.olt_id ?? '—'}</TD>
                    <TD right muted>{o.pon_port ?? '—'}</TD>
                    <TD right mono>
                      {o.rx_power != null ? (
                        <span style={{ color: SIGNAL_QUALITY[o.signal_quality]?.color ?? 'var(--foreground)' }}>
                          {o.rx_power.toFixed(2)}
                        </span>
                      ) : '—'}
                    </TD>
                    <TD><SignalBadge quality={o.signal_quality} /></TD>
                    <TD><StatusBadge statusMap={STATUS_ONU} status={o.status} /></TD>
                    <TD muted>{fmtTs(o.provisioned_at)}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision form */}
      <div style={card}>
        <SectionTitle>Provisionar / Cancelar ONU</SectionTitle>
        <FeedbackBanner feedback={feedback} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Serial ONU *</label>
              <input style={inp} type="text" placeholder="ZTEG1A2B3C4D" value={form.serial} onChange={e => setForm(f => ({ ...f, serial: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Nome do Cliente</label>
              <input style={inp} type="text" placeholder="João da Silva" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>OLT</label>
              <select
                style={{ ...inp }}
                value={form.oltId}
                onChange={e => setForm(f => ({ ...f, oltId: e.target.value, ponPort: '' }))}
              >
                <option value="">Auto / selecionar OLT...</option>
                {olts.map(olt => (
                  <option key={olt.id} value={olt.id}>
                    {olt.nome}{olt.ip ? ` (${olt.ip})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Porta PON</label>
              <input
                style={inp}
                type="number"
                min="0"
                placeholder={selectedOlt ? `0 – ${(selectedOlt.capacidade ?? 16) - 1}` : '0'}
                value={form.ponPort}
                onChange={e => setForm(f => ({ ...f, ponPort: e.target.value }))}
              />
            </div>
            <div>
              <label style={lbl}>CTO ID (auto se vazio)</label>
              <input style={inp} type="text" placeholder="CTO-001" value={form.ctoId} onChange={e => setForm(f => ({ ...f, ctoId: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              style={{ ...btn('#0284c7'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: (provisioning || cancelling) ? 0.7 : 1 }}
              onClick={handleProvision}
              disabled={provisioning || cancelling}
            >
              {provisioning && <Spinner />}
              Provisionar ONU
            </button>
            <button
              style={{ ...btn('#dc2626'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: (provisioning || cancelling) ? 0.7 : 1 }}
              onClick={handleCancel}
              disabled={provisioning || cancelling}
            >
              {cancelling && <Spinner />}
              Cancelar ONU
            </button>
            <button
              style={btnOutline}
              onClick={() => setForm({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })}
              disabled={provisioning || cancelling}
            >
              Limpar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB 3: TOPOLOGIA ─────────────────────────────────────────────────────────

function CTOCard({ cto }) {
  const [expanded, setExpanded] = useState(false)
  const pct   = cto.pct ?? (cto.capacidade > 0 ? Math.min(100, Math.round(((cto.ocupadas ?? cto.ocupacao ?? 0) / cto.capacidade) * 100)) : 0)
  const color = barColor(pct)
  const ports = cto.ports ?? []

  return (
    <div style={{
      backgroundColor: 'var(--inp-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header — always visible */}
      <div
        style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{cto.id ?? cto.cto_id}</p>
            {cto.name && cto.name !== (cto.id ?? cto.cto_id) && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{cto.name}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 99,
              backgroundColor: color + '22', border: `1px solid ${color}55`,
              color, fontSize: 11, fontWeight: 700,
            }}>
              {pct}%
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Occupancy bar */}
        <div style={{ height: 5, borderRadius: 99, backgroundColor: 'var(--border-color)', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 99 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
          <span>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>{cto.ocupadas ?? cto.ocupacao ?? 0}</span>
            {' / '}
            {cto.capacidade ?? ports.length} portas
            {(cto.livres ?? 0) > 0 && (
              <span style={{ color: '#22c55e', marginLeft: 6 }}>· {cto.livres} livre{cto.livres !== 1 ? 's' : ''}</span>
            )}
          </span>
          {cto.cdo_id && (
            <span>CDO: <span style={{ fontFamily: 'monospace', color: 'var(--foreground)' }}>{cto.cdo_id}</span></span>
          )}
        </div>
      </div>

      {/* Port list — expanded */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border-color)',
          maxHeight: 280,
          overflowY: 'auto',
        }}>
          {ports.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
              Nenhuma porta mapeada no diagrama.
            </p>
          ) : (
            ports.map((p) => {
              const occupied  = p.status === 'OCUPADO'
              const dotColor  = occupied ? '#ef4444' : '#22c55e'
              const sqColor   = p.client?.signal_quality ? SIGNAL_QUALITY[p.client.signal_quality]?.color : null
              return (
                <div
                  key={p.port_number}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: 12,
                  }}
                >
                  {/* Port dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: dotColor,
                    flexShrink: 0,
                  }} />

                  {/* Port number */}
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: 54 }}>
                    Porta {String(p.port_number).padStart(2, '0')}
                  </span>

                  {/* Client or "Livre" */}
                  {occupied ? (
                    <span style={{ color: 'var(--foreground)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.client?.name ?? '—'}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', flex: 1 }}>Livre</span>
                  )}

                  {/* RX power badge for occupied ports */}
                  {occupied && p.client?.rx_power != null && (
                    <span style={{ fontSize: 10, color: sqColor ?? 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                      {p.client.rx_power.toFixed(1)} dBm
                    </span>
                  )}

                  {/* Splitter label */}
                  {p.splitter_nome && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {p.splitter_nome}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function TopologiaTab({ ctos: ctosBasic = [], olts = [] }) {
  const [ctosFull, setCtosFull]   = useState(null)
  const [loading,  setLoading]    = useState(true)
  const [fetchErr, setFetchErr]   = useState(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/ctos/full')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => { setCtosFull(data); setLoading(false) })
      .catch(e  => { setFetchErr(String(e)); setLoading(false) })
  }, [])

  // Prefer full data (with ports); fall back to basic stats list
  const ctos = ctosFull ?? ctosBasic.map(c => ({
    id:         c.cto_id,
    name:       c.nome,
    cdo_id:     c.cdo_id,
    capacidade: c.capacidade,
    ocupadas:   c.ocupacao,
    livres:     (c.capacidade ?? 0) - (c.ocupacao ?? 0),
    pct:        c.capacidade > 0 ? Math.min(100, Math.round((c.ocupacao / c.capacidade) * 100)) : 0,
    ports:      [],
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* OLT table */}
      <div style={card}>
        <SectionTitle>OLTs ({olts.length})</SectionTitle>
        {olts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhuma OLT cadastrada.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Nome</TH>
                  <TH>IP</TH>
                  <TH>Modelo</TH>
                  <TH>Status</TH>
                  <TH right>Capacidade</TH>
                </tr>
              </thead>
              <tbody>
                {olts.map((o, i) => {
                  const status = STATUS_OLT[o.status] ? o.status : 'ativo'
                  return (
                    <tr key={o._id ?? o.id ?? i}>
                      <TD bold>{o.nome || o.id || '—'}</TD>
                      <TD mono muted>{o.ip || '—'}</TD>
                      <TD muted>{o.modelo || '—'}</TD>
                      <TD><StatusBadge statusMap={STATUS_OLT} status={status} /></TD>
                      <TD right muted>{o.capacidade ?? '—'}</TD>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTO grid */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            CTOs — Portas por Cliente ({ctos.length})
          </p>
          {loading && <Spinner />}
          {fetchErr && <span style={{ fontSize: 12, color: '#ef4444' }}>{fetchErr}</span>}
        </div>
        {ctos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhuma CTO cadastrada.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {ctos.map((cto, i) => (
              <CTOCard key={cto.id ?? cto.cto_id ?? i} cto={cto} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB 4: SGP ───────────────────────────────────────────────────────────────

function SGPTab({ sgpStatus, onLog }) {
  const [sgpForm, setSgpForm]         = useState({ host: '', username: '', password: '' })
  const [savingCreds, setSavingCreds] = useState(false)
  const [fetching, setFetching]       = useState(false)
  const [applying, setApplying]       = useState(false)
  const [diff, setDiff]               = useState(null)
  const [selectedInstalls, setSelectedInstalls] = useState([])
  const [selectedCancels,  setSelectedCancels]  = useState([])
  const [feedback, setFeedback]       = useState(null)

  function showFeedback(type, message) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 5000)
  }

  async function handleSaveCreds() {
    if (!sgpForm.host.trim()) { showFeedback('error', 'Host é obrigatório.'); return }
    setSavingCreds(true)
    try {
      const { saveSGPConfig } = await import('@/actions/sgp')
      await saveSGPConfig({ host: sgpForm.host.trim(), username: sgpForm.username.trim(), password: sgpForm.password })
      showFeedback('success', 'Credenciais salvas. Recarregue a página.')
      onLog('SGP', 'Credenciais configuradas', 'success')
    } catch (e) {
      showFeedback('error', e.message)
      onLog('SGP', e.message, 'error')
    } finally {
      setSavingCreds(false)
    }
  }

  async function handleFetch() {
    setFetching(true)
    setDiff(null)
    setSelectedInstalls([])
    setSelectedCancels([])
    onLog('SGP', 'Buscando dados do SGP...', 'info')
    try {
      const { fetchFromSGP } = await import('@/actions/sgp')
      const result = await fetchFromSGP()
      setDiff(result)
      const msg = `${result.novos.length} novos, ${result.cancelamentos.length} cancelamentos detectados`
      onLog('SGP', msg, 'info')
      if (result.novos.length === 0 && result.cancelamentos.length === 0) {
        showFeedback('success', 'SGP sincronizado — sem diferenças.')
      }
    } catch (e) {
      showFeedback('error', e.message)
      onLog('SGP', e.message, 'error')
    } finally {
      setFetching(false)
    }
  }

  async function handleApply() {
    const installs = (diff?.novos ?? []).filter(n => selectedInstalls.includes(n.serial))
    const cancels  = (diff?.cancelamentos ?? []).filter(c => selectedCancels.includes(c.serial))
    if (installs.length === 0 && cancels.length === 0) {
      showFeedback('error', 'Selecione ao menos um item.')
      return
    }
    setApplying(true)
    onLog('SGP', `Aplicando ${installs.length + cancels.length} itens selecionados`, 'info')
    try {
      const { applyFromSGP } = await import('@/actions/sgp')
      const result = await applyFromSGP({ installs, cancels })
      showFeedback('success', `${result.criados} eventos enfileirados para processamento.`)
      onLog('SGP', `${result.criados} eventos criados`, 'success')
      setDiff(null)
      setSelectedInstalls([])
      setSelectedCancels([])
    } catch (e) {
      showFeedback('error', e.message)
      onLog('SGP', e.message, 'error')
    } finally {
      setApplying(false)
    }
  }

  function toggleInstall(serial) {
    setSelectedInstalls(prev => prev.includes(serial) ? prev.filter(s => s !== serial) : [...prev, serial])
  }

  function toggleCancel(serial) {
    setSelectedCancels(prev => prev.includes(serial) ? prev.filter(s => s !== serial) : [...prev, serial])
  }

  const isConfigured = sgpStatus?.isConfigured ?? false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FeedbackBanner feedback={feedback} />

      {/* Connection card */}
      <div style={card}>
        <SectionTitle>Integração SGP / TMSX</SectionTitle>

        {isConfigured ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 99,
                backgroundColor: '#052e1688', border: '1px solid #166534',
                color: '#4ade80', fontSize: 12, fontWeight: 600,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#4ade80', display: 'inline-block' }} />
                Configurado
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Host: <strong style={{ color: 'var(--foreground)' }}>{sgpStatus.host}</strong>
              </span>
              {sgpStatus.username && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Usuário: <strong style={{ color: 'var(--foreground)' }}>{sgpStatus.username}</strong>
                </span>
              )}
            </div>
            {sgpStatus.lastSync && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Última consulta: {fmtTs(sgpStatus.lastSync)}
                {sgpStatus.lastSyncStats && (
                  <> — {sgpStatus.lastSyncStats.novos ?? 0} novos, {sgpStatus.lastSyncStats.cancelamentos ?? 0} cancelamentos</>
                )}
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>SGP não configurado.</p>
            <div>
              <label style={lbl}>Host (URL ou &apos;mock&apos;)</label>
              <input style={inp} type="text" placeholder="https://sgp.empresa.com.br" value={sgpForm.host} onChange={e => setSgpForm(f => ({ ...f, host: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Usuário</label>
                <input style={inp} type="text" value={sgpForm.username} onChange={e => setSgpForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Senha</label>
                <input style={inp} type="password" value={sgpForm.password} onChange={e => setSgpForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
            <button
              style={{ ...btn('#0284c7'), display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', opacity: savingCreds ? 0.7 : 1 }}
              onClick={handleSaveCreds}
              disabled={savingCreds}
            >
              {savingCreds && <Spinner />}
              Salvar Credenciais
            </button>
          </div>
        )}
      </div>

      {/* Diff viewer */}
      {isConfigured && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <SectionTitle>Comparar com SGP</SectionTitle>
            <button
              style={{ ...btn(fetching ? '#475569' : '#0284c7'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: (fetching || applying) ? 0.8 : 1 }}
              onClick={handleFetch}
              disabled={fetching || applying}
            >
              {fetching && <Spinner />}
              {fetching ? 'Buscando...' : 'Atualizar dados do SGP'}
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Consulta o SGP em modo leitura e mostra as diferenças. Nenhum dado é alterado até você confirmar.
          </p>

          {diff && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Novos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>
                    ✚ {diff.novos.length} novos clientes encontrados
                  </p>
                  {diff.novos.length > 0 && (
                    <button style={{ ...btnOutline, fontSize: 11, padding: '4px 10px' }} onClick={() => setSelectedInstalls(diff.novos.map(n => n.serial))}>
                      Todos
                    </button>
                  )}
                </div>
                {diff.novos.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum cliente novo.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {diff.novos.map(n => {
                      const checked = selectedInstalls.includes(n.serial)
                      return (
                        <label key={n.serial} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                          backgroundColor: checked ? '#052e16aa' : 'var(--inp-bg)',
                          border: `1px solid ${checked ? '#16a34a' : 'var(--border-color)'}`,
                          transition: 'background-color 0.15s, border-color 0.15s',
                        }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleInstall(n.serial)} style={{ accentColor: '#22c55e', width: 14, height: 14 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{n.nome}</span>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{n.serial}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Cancelamentos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>
                    ✕ {diff.cancelamentos.length} clientes cancelados no SGP
                  </p>
                  {diff.cancelamentos.length > 0 && (
                    <button style={{ ...btnOutline, fontSize: 11, padding: '4px 10px' }} onClick={() => setSelectedCancels(diff.cancelamentos.map(c => c.serial))}>
                      Todos
                    </button>
                  )}
                </div>
                {diff.cancelamentos.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum cancelamento.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {diff.cancelamentos.map(c => {
                      const checked = selectedCancels.includes(c.serial)
                      return (
                        <label key={c.serial} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                          backgroundColor: checked ? '#3d0a0aaa' : 'var(--inp-bg)',
                          border: `1px solid ${checked ? '#7f1d1d' : 'var(--border-color)'}`,
                          transition: 'background-color 0.15s, border-color 0.15s',
                        }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleCancel(c.serial)} style={{ accentColor: '#ef4444', width: 14, height: 14 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{c.nome}</span>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{c.serial}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {(selectedInstalls.length > 0 || selectedCancels.length > 0) && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                  <button
                    style={{ ...btn('#0284c7'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: applying ? 0.7 : 1 }}
                    onClick={handleApply}
                    disabled={applying}
                  >
                    {applying && <Spinner />}
                    Aplicar Selecionados ({selectedInstalls.length + selectedCancels.length})
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    Eventos de provisionamento serão criados e processados na fila.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TAB 5: AUTO-FIND ─────────────────────────────────────────────────────────

function AutoFindTab({ olts, onLog }) {
  const [running,   setRunning]   = useState(false)
  const [detected,  setDetected]  = useState(null)   // null = not yet run
  const [feedback,  setFeedback]  = useState(null)
  const [provisioning, setProvisioning] = useState({}) // { serial: true }

  function showFeedback(type, message) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 5000)
  }

  async function handleScan() {
    setRunning(true)
    setDetected(null)
    onLog('AUTO-FIND', 'Escaneando OLTs em busca de ONUs não provisionadas...', 'info')
    try {
      const { autoFindONUs } = await import('@/actions/provisioning')
      const result = await autoFindONUs()
      setDetected(result)
      if (result.length === 0) {
        onLog('AUTO-FIND', 'Nenhuma ONU nova detectada', 'info')
        showFeedback('success', 'Nenhuma ONU nova detectada nas OLTs.')
      } else {
        onLog('AUTO-FIND', `${result.length} ONU(s) detectada(s)`, 'info')
      }
    } catch (e) {
      onLog('AUTO-FIND', e.message, 'error')
      showFeedback('error', e.message)
    } finally {
      setRunning(false)
    }
  }

  async function handleProvision(item) {
    setProvisioning(prev => ({ ...prev, [item.serial]: true }))
    onLog('AUTO-FIND', `Provisionando ONU detectada: ${item.serial}`, 'info')
    try {
      const { manualProvision } = await import('@/actions/provisioning')
      const result = await manualProvision({
        serial:  item.serial,
        cliente: item.serial,
        oltId:   item.olt_id,
        ponPort: item.pon_port,
        ctoId:   null,
      })
      if (result.processed) {
        onLog('AUTO-FIND', `${item.serial} provisionada com sucesso`, 'success')
        setDetected(prev => (prev ?? []).filter(d => d.serial !== item.serial))
      } else {
        onLog('AUTO-FIND', result.reason ?? 'Falha', 'error')
        showFeedback('error', `${item.serial}: ${result.reason ?? 'Falha no provisionamento'}`)
      }
    } catch (e) {
      onLog('AUTO-FIND', e.message, 'error')
      showFeedback('error', e.message)
    } finally {
      setProvisioning(prev => { const n = { ...prev }; delete n[item.serial]; return n })
    }
  }

  async function handleProvisionAll() {
    if (!detected?.length) return
    for (const item of detected) {
      await handleProvision(item)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FeedbackBanner feedback={feedback} />

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <SectionTitle>Auto-Find — ONUs Detectadas</SectionTitle>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -10, marginBottom: 0 }}>
              Executa <span style={{ fontFamily: 'monospace', color: 'var(--foreground)' }}>display ont autofind all</span> em cada OLT ativa e lista seriais não provisionados.
            </p>
          </div>
          <button
            style={{ ...btn(running ? '#475569' : '#0284c7'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: running ? 0.8 : 1 }}
            onClick={handleScan}
            disabled={running}
          >
            {running && <Spinner />}
            {running ? 'Escaneando...' : 'Executar Auto-Find'}
          </button>
        </div>

        {/* OLT summary */}
        {olts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {olts.map(olt => (
              <span key={olt.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 99, fontSize: 11,
                backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
                {olt.nome}{olt.ip ? ` (${olt.ip})` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Not yet scanned */}
        {detected === null && !running && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Clique em "Executar Auto-Find" para escanear as OLTs.
          </div>
        )}

        {/* Results */}
        {detected !== null && (
          detected.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '24px 0',
              color: '#22c55e', fontSize: 13,
            }}>
              ✓ Nenhuma ONU nova detectada — todas já estão provisionadas.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>
                  ⚡ {detected.length} ONU(s) aguardando provisionamento
                </p>
                <button
                  style={{ ...btn('#0284c7'), fontSize: 12, padding: '6px 14px' }}
                  onClick={handleProvisionAll}
                >
                  Provisionar Todas
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <TH>Serial</TH>
                      <TH>PON</TH>
                      <TH>OLT</TH>
                      <TH>IP</TH>
                      <TH></TH>
                    </tr>
                  </thead>
                  <tbody>
                    {detected.map((item, i) => {
                      const busy = !!provisioning[item.serial]
                      return (
                        <tr key={item.serial ?? i}>
                          <TD mono bold>
                            {item.serial}
                            {item.mock && (
                              <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b', fontFamily: 'sans-serif' }}>(mock)</span>
                            )}
                          </TD>
                          <TD mono muted>{item.pon ?? '—'}</TD>
                          <TD muted>{item.olt_nome ?? item.olt_id ?? '—'}</TD>
                          <TD mono muted>{item.olt_ip ?? '—'}</TD>
                          <TD>
                            <button
                              style={{ ...btn('#0284c7'), fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: busy ? 0.7 : 1 }}
                              onClick={() => handleProvision(item)}
                              disabled={busy}
                            >
                              {busy && <Spinner />}
                              Provisionar
                            </button>
                          </TD>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {/* Info card */}
      <div style={{
        ...card, padding: '12px 16px',
        backgroundColor: 'var(--inp-bg)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>ℹ️</span>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Como funciona o Auto-Find</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            O Auto-Find conecta via SSH a cada OLT ativa e executa{' '}
            <span style={{ fontFamily: 'monospace', color: 'var(--foreground)' }}>display ont autofind all</span>.
            ONUs que aparecem neste comando foram conectadas fisicamente mas ainda não estão provisionadas no sistema.
            O serial detectado é comparado com o banco — apenas os não provisionados são listados aqui.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── LOG TERMINAL ─────────────────────────────────────────────────────────────

function LogTerminal({ logs }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', backgroundColor: '#0d1117',
        border: '1px solid #1e3a20', borderBottom: 'none',
        borderRadius: '8px 8px 0 0',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', fontFamily: 'monospace' }}>
          &#128225; LOG EM TEMPO REAL
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#4ade80', animation: 'noc-blink 1.2s step-start infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, letterSpacing: '0.12em' }}>AO VIVO</span>
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4ade8077', fontFamily: 'monospace' }}>
          {logs.length} entradas
        </span>
      </div>
      <div style={{
        backgroundColor: '#0a0e1a', border: '1px solid #1e3a20',
        borderRadius: '0 0 8px 8px', height: 200, overflowY: 'auto',
        padding: '8px 14px', fontFamily: 'monospace', fontSize: 12,
        display: 'flex', flexDirection: 'column', gap: 1,
      }}>
        {logs.length === 0 && (
          <span style={{ color: '#4ade8055', fontSize: 11 }}>Aguardando eventos...</span>
        )}
        {logs.map((entry, i) => {
          const color = NIVEL_TERM_COLOR[entry.nivel] ?? NIVEL_TERM_COLOR.info
          return (
            <div key={entry.id ?? i} style={{ display: 'flex', gap: 8, lineHeight: 1.5 }}>
              <span style={{ color: '#4ade8066', flexShrink: 0 }}>{fmtHHMMSS(entry.ts)}</span>
              <span style={{ color: '#60a5fa', flexShrink: 0 }}>[{entry.tag ?? 'NOC'}]</span>
              <span style={{ color }}>{entry.message}</span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function NOCClient({ stats, userRole }) {
  const [activeTab, setActiveTab] = useState('visao-geral')
  const [logs, setLogs]           = useState([])
  const [lastUpdate]              = useState(() => new Date())

  const olts      = stats?.olts      ?? []
  const onus      = stats?.onus      ?? []
  const ctos      = stats?.ctos      ?? []
  const alertas   = stats?.alertas   ?? []
  const sgpStatus = stats?.sgpStatus ?? { isConfigured: false }
  const eventos   = stats?.eventos   ?? []

  // Seed log terminal with recent eventos on mount
  useEffect(() => {
    if (eventos.length > 0) {
      setLogs(eventos.slice(0, 200).map(e => ({
        id:      e._id,
        ts:      e.ts ?? new Date().toISOString(),
        tag:     (e.role ?? 'NOC').toUpperCase(),
        message: [e.action, e.entity].filter(Boolean).join(' · '),
        nivel:   e.nivel ?? 'info',
      })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // SSE real-time log stream
  useEffect(() => {
    const es = new EventSource('/api/noc/stream')

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.heartbeat) return
        setLogs(prev => [...prev.slice(-199), {
          id:      data._id ?? data.id ?? String(Date.now()),
          ts:      data.ts ?? new Date().toISOString(),
          tag:     (data.tag ?? data.role ?? 'NOC').toUpperCase(),
          message: data.message ?? data.action ?? JSON.stringify(data),
          nivel:   data.nivel ?? 'info',
        }])
      } catch { /* ignore */ }
    }

    es.onerror = () => { /* EventSource auto-reconnects */ }

    return () => es.close()
  }, [])

  const addLog = useCallback((tag, message, nivel = 'info') => {
    setLogs(prev => [...prev.slice(-199), {
      id:      String(Date.now()),
      ts:      new Date().toISOString(),
      tag:     tag.toUpperCase(),
      message,
      nivel,
    }])
  }, [])

  const TABS = [
    { id: 'visao-geral', label: alertas.length > 0 ? `Visão Geral ⚠${alertas.length}` : 'Visão Geral' },
    { id: 'clientes',    label: `Clientes (${onus.length})` },
    { id: 'topologia',   label: 'Topologia' },
    { id: 'sgp',         label: 'SGP' },
    { id: 'autofind',    label: 'Auto-Find' },
    { id: 'olt-mgmt',    label: 'Gerenciar OLTs' },
  ]

  return (
    <div>
      <style>{`
        @keyframes noc-spin  { to { transform: rotate(360deg); } }
        @keyframes noc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16, gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Carregado às {fmtTime(lastUpdate)}
        </span>
        <button onClick={() => window.location.reload()} style={btn('#0284c7')}>
          Atualizar
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 20px', fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                border: 'none',
                borderBottom: isActive ? '2px solid #0284c7' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? '#0284c7' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab panels */}
      {activeTab === 'visao-geral' && <VisaoGeralTab stats={stats} />}
      {activeTab === 'clientes'    && <ClientesTab onus={onus} olts={olts} onLog={addLog} />}
      {activeTab === 'topologia'   && <TopologiaTab ctos={ctos} olts={olts} />}
      {activeTab === 'sgp'         && <SGPTab sgpStatus={sgpStatus} onLog={addLog} />}
      {activeTab === 'autofind'    && <AutoFindTab olts={olts} onLog={addLog} />}
      {activeTab === 'olt-mgmt'    && <OltMgmtTab olts={olts} onLog={addLog} />}

      {/* Log terminal — always visible */}
      <LogTerminal logs={logs} />
    </div>
  )
}
