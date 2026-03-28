'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import OltMgmtTab from './OltMgmtTab'

// ─── Style constants ───────────────────────────────────────────────────────────

const card = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: 12,
  padding: 20,
}

const btn = (color = '#2D8CFF') => ({
  backgroundColor: color,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
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

// ─── Lookup tables ─────────────────────────────────────────────────────────────

const STATUS_OLT = {
  ativo:         { label: 'Ativo',      color: '#00C853' },
  inativo:       { label: 'Inativo',    color: '#FF3D00' },
  em_manutencao: { label: 'Manutenção', color: '#FFD600' },
}

const STATUS_ONU = {
  active:       { label: 'Ativa',         color: '#00C853' },
  provisioning: { label: 'Provisionando', color: '#2D8CFF' },
  offline:      { label: 'Offline',       color: '#FF3D00' },
  error:        { label: 'Erro',          color: '#FF6D00' },
}

const SIGNAL_QUALITY = {
  excelente: { label: 'Excelente', color: '#00C853' },
  bom:       { label: 'Bom',       color: '#4ade80' },
  medio:     { label: 'Médio',     color: '#FFD600' },
  critico:   { label: 'Crítico',   color: '#FF3D00' },
}

const NIVEL_TERM_COLOR = {
  info:    '#4ade80',
  warn:    '#fbbf24',
  error:   '#f87171',
  success: '#86efac',
}

const ALERTA_CONFIG = {
  onu_offline:   { icon: '●', color: '#FF3D00', label: 'ONU Offline' },
  sinal_critico: { icon: '▲', color: '#FF6D00', label: 'Sinal Crítico' },
  cto_cheia:     { icon: '■', color: '#FFD600', label: 'CTO Cheia' },
}

const SIG_COLOR = {
  success: '#00C853',
  bom:     '#4ade80',
  limite:  '#FFD600',
  critico: '#FF3D00',
  unknown: 'var(--text-muted)',
}

// ─── Signal analysis ───────────────────────────────────────────────────────────

function analyzeSignal(rx, tx) {
  let rxQuality, rxClass, rxDiags = []
  if (rx == null)       { rxQuality = 'N/D';      rxClass = 'unknown' }
  else if (rx > -20)    { rxQuality = 'EXCELENTE'; rxClass = 'success' }
  else if (rx >= -25)   { rxQuality = 'BOM';       rxClass = 'bom' }
  else if (rx >= -28)   { rxQuality = 'LIMITE';    rxClass = 'limite'; rxDiags.push('Cliente no limite operacional — verificar CTO / fusão') }
  else                  { rxQuality = 'CRÍTICO';   rxClass = 'critico'; rxDiags.push('Sinal muito baixo (possível problema de fibra, fusão ou CTO)') }

  let txStatus, txClass, txDiags = []
  if (tx == null)  { txStatus = 'N/D';       txClass = 'unknown' }
  else if (tx > 5) { txStatus = 'MUITO ALTO'; txClass = 'critico'; txDiags.push('Potência muito alta (risco de saturação)') }
  else if (tx < 1) { txStatus = 'BAIXO';     txClass = 'limite';  txDiags.push('Potência de retorno baixa') }
  else             { txStatus = 'OK';         txClass = 'success' }

  const statusGeral = (rxClass === 'critico' || txClass === 'critico') ? 'ALERTA' :
                      (rxClass === 'limite'  || txClass === 'limite')  ? 'ATENÇÃO' : 'OK'
  return { rxQuality, rxClass, txStatus, txClass, statusGeral, diags: [...rxDiags, ...txDiags] }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}
function fmtTime(date) { return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
function fmtHHMMSS(iso) {
  if (!iso) return '??:??:??'
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return '??:??:??' }
}
function barColor(pct) {
  if (pct >= 90) return '#FF3D00'
  if (pct >= 70) return '#FFD600'
  return '#00C853'
}
function generateSparkData(base, points = 12) {
  const b = Math.max(base, 1)
  return Array.from({ length: points }, (_, i) =>
    Math.max(0, Math.round(b + Math.sin(i * 0.8 + b * 0.1) * b * 0.15 + (Math.random() - 0.5) * b * 0.08))
  )
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid var(--border-color)', borderTopColor: '#2D8CFF',
      borderRadius: '50%', animation: 'noc-spin 0.7s linear infinite', verticalAlign: 'middle',
    }} />
  )
}

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
      {children}
    </p>
  )
}

function FeedbackBanner({ feedback }) {
  if (!feedback) return null
  return (
    <div style={{
      padding: '10px 16px', borderRadius: 8, marginBottom: 12,
      backgroundColor: feedback.type === 'success' ? 'rgba(0,200,83,0.08)' : 'rgba(255,61,0,0.08)',
      border: `1px solid ${feedback.type === 'success' ? 'rgba(0,200,83,0.3)' : 'rgba(255,61,0,0.3)'}`,
      color: feedback.type === 'success' ? '#00C853' : '#FF3D00', fontSize: 13,
    }}>
      {feedback.message}
    </div>
  )
}

function StatusBadge({ statusMap, status }) {
  const cfg = statusMap?.[status]
  if (!cfg) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{status ?? '—'}</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99,
      backgroundColor: cfg.color + '18', border: `1px solid ${cfg.color}44`,
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
      backgroundColor: cfg.color + '18', border: `1px solid ${cfg.color}44`,
      fontSize: 11, color: cfg.color, fontWeight: 600,
    }}>{cfg.label}</span>
  )
}

function MiniCard({ label, value, accent, sublabel }) {
  return (
    <div style={{ ...card, padding: '14px 18px', borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: accent ?? 'var(--foreground)', lineHeight: 1 }}>{value ?? '—'}</p>
      {sublabel && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{sublabel}</p>}
    </div>
  )
}

function TH({ children, right }) {
  return (
    <th style={{
      padding: '8px 12px', textAlign: right ? 'right' : 'left',
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap',
    }}>{children}</th>
  )
}

function TD({ children, mono, muted, right, bold, style: extra }) {
  return (
    <td style={{
      padding: '9px 12px', fontSize: mono ? 12 : 13,
      color: muted ? 'var(--text-muted)' : 'var(--foreground)',
      fontFamily: mono ? 'monospace' : undefined,
      fontWeight: bold ? 600 : undefined,
      textAlign: right ? 'right' : 'left',
      borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle', ...extra,
    }}>{children}</td>
  )
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data = [], color = '#2D8CFF', height = 36, width = 88 }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = height - pad - ((v - min) / range) * (height - pad * 2)
    return [x.toFixed(1), y.toFixed(1)]
  })
  const polyline = pts.map(p => p.join(',')).join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  const fillPath = `M${pts.map(p => p.join(',')).join(' L')} L${last[0]},${height - pad} L${first[0]},${height - pad} Z`
  const uid = color.replace('#', 'c')
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#sg-${uid})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sublabel, accent = '#2D8CFF', sparkData, trend }) {
  return (
    <div style={{ ...card, padding: '16px 20px', borderTop: `2px solid ${accent}` }}>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, margin: '0 0 8px' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ fontSize: 32, fontWeight: 700, color: accent, lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value ?? '—'}</p>
          {sublabel && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sublabel}</p>}
          {trend != null && (
            <p style={{ fontSize: 11, color: trend >= 0 ? '#00C853' : '#FF3D00', marginTop: 3, fontWeight: 600 }}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        {sparkData && <Sparkline data={sparkData} color={accent} />}
      </div>
    </div>
  )
}

// ─── NetworkChart ─────────────────────────────────────────────────────────────

function NetworkChart({ onlineData, offlineData, range, onRangeChange }) {
  const W = 500, H = 120, padL = 26, padR = 6, padT = 8, padB = 20
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const allVals = [...(onlineData || []), ...(offlineData || [])]
  const maxVal = Math.max(...allVals, 1)
  const labels = range === '1h'  ? ['55m','45m','35m','25m','15m','5m','agora'] :
                 range === '6h'  ? ['5h','4h','3h','2h','1h','30m','agora'] :
                                   ['23h','18h','13h','8h','4h','2h','agora']

  function toPoints(data) {
    if (!data?.length) return []
    return data.map((v, i) => [
      padL + (i / (data.length - 1)) * chartW,
      padT + chartH - (v / maxVal) * chartH,
    ])
  }

  function renderArea(pts, color) {
    if (pts.length < 2) return null
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    const area = `${line} L${(padL + chartW).toFixed(1)},${(padT + chartH).toFixed(1)} L${padL},${(padT + chartH).toFixed(1)} Z`
    return (
      <g key={color}>
        <path d={area} fill={color} fillOpacity="0.1" />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    )
  }

  const yTicks = [0, Math.round(maxVal / 2), maxVal]
  const onPts  = toPoints(onlineData)
  const offPts = toPoints(offlineData)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Evolução de Rede</p>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10, marginRight: 8 }}>
            {[{ color: '#00C853', label: 'Online' }, { color: '#FF3D00', label: 'Offline' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 2, backgroundColor: l.color, display: 'inline-block', borderRadius: 2 }} />
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{l.label}</span>
              </div>
            ))}
          </div>
          {['1h', '6h', '24h'].map(r => (
            <button key={r} onClick={() => onRangeChange(r)} style={{
              fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', letterSpacing: '0.06em',
              backgroundColor: range === r ? '#2D8CFF' : 'transparent',
              color: range === r ? '#fff' : 'var(--text-muted)',
              outline: range === r ? 'none' : '1px solid var(--border-color)',
            }}>{r}</button>
          ))}
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {yTicks.map(t => {
          const y = padT + chartH - (t / maxVal) * chartH
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="2,3" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">{t}</text>
            </g>
          )
        })}
        {labels.map((l, i) => (
          <text key={i} x={padL + (i / (labels.length - 1)) * chartW} y={padT + chartH + 12} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{l}</text>
        ))}
        {renderArea(onPts, '#00C853')}
        {renderArea(offPts, '#FF3D00')}
      </svg>
    </div>
  )
}

// ─── OLTCard ──────────────────────────────────────────────────────────────────

function OLTCard({ olt, onusForOlt }) {
  const online  = onusForOlt.filter(o => o.status === 'active').length
  const offline = onusForOlt.filter(o => o.status === 'offline').length
  const total   = onusForOlt.length
  const rxVals  = onusForOlt.filter(o => o.rx_power != null).map(o => o.rx_power)
  const avgRx   = rxVals.length ? (rxVals.reduce((a, b) => a + b, 0) / rxVals.length).toFixed(1) : null
  const rxColor = avgRx == null ? 'var(--text-muted)' : avgRx > -20 ? '#00C853' : avgRx >= -25 ? '#4ade80' : avgRx >= -28 ? '#FFD600' : '#FF3D00'
  const statusCfg = STATUS_OLT[olt.status] ?? STATUS_OLT.ativo

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden', borderTop: `2px solid ${statusCfg.color}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{olt.nome}</p>
            <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', margin: '3px 0 0' }}>{olt.ip || '—'}</p>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99,
            backgroundColor: statusCfg.color + '18', border: `1px solid ${statusCfg.color}44`,
            fontSize: 10, color: statusCfg.color, fontWeight: 700, flexShrink: 0,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusCfg.color, display: 'inline-block' }} />
            {statusCfg.label}
          </span>
        </div>
        {olt.modelo && <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '4px 0 0', fontFamily: 'monospace' }}>{olt.modelo}</p>}
      </div>

      <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Online',  val: online,  color: '#00C853' },
            { label: 'Offline', val: offline, color: offline > 0 ? '#FF3D00' : 'var(--text-muted)' },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: 'var(--inp-bg)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px', fontWeight: 700 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: s.color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{s.val}</p>
            </div>
          ))}
        </div>
        {avgRx && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Sinal médio RX</span>
            <span style={{ fontFamily: 'monospace', color: rxColor, fontWeight: 700 }}>{avgRx} dBm</span>
          </div>
        )}
        {total > 0 && (
          <div>
            <div style={{ height: 4, borderRadius: 99, backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(online / total) * 100}%`, backgroundColor: '#00C853', borderRadius: 99, transition: 'width 0.4s ease' }} />
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{total} ONUs total · cap. {olt.capacidade ?? '—'}</p>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 6 }}>
        {olt.ip && (
          <button onClick={() => window.open(`http://${olt.ip}`, '_blank')} style={{ ...btn('#2D8CFF'), fontSize: 11, padding: '5px 12px', flex: 1 }}>Acessar</button>
        )}
        <button style={{ ...btnOutline, fontSize: 11, padding: '5px 12px', flex: 1 }}>Diagnóstico</button>
      </div>
    </div>
  )
}

// ─── OLTsPanel ────────────────────────────────────────────────────────────────

function OLTsPanel({ olts, onus }) {
  if (!olts.length) return (
    <div style={{ ...card, textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma OLT cadastrada.</div>
  )
  return (
    <div>
      <SectionTitle>OLTs ({olts.length})</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
        {olts.map(olt => (
          <OLTCard key={olt.id ?? olt._id} olt={olt} onusForOlt={onus.filter(o => o.olt_id === (olt.id ?? olt._id))} />
        ))}
      </div>
    </div>
  )
}

// ─── AlertsPanel ──────────────────────────────────────────────────────────────

function AlertsPanel({ alertas = [], ackedAlerts, onAck, onTestOnu }) {
  const [filter, setFilter] = useState('todos')
  function alertKey(a) { return `${a.tipo}-${a.serial ?? a.cto_id}` }
  function severityOf(tipo) { return (tipo === 'onu_offline' || tipo === 'sinal_critico') ? 'critico' : 'alto' }

  const filtered = alertas.filter(a => filter === 'todos' || severityOf(a.tipo) === filter)
  const active   = filtered.filter(a => !ackedAlerts.has(alertKey(a)))
  const acked    = filtered.filter(a =>  ackedAlerts.has(alertKey(a)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[{ id: 'todos', label: 'Todos', color: '#2D8CFF' }, { id: 'critico', label: 'Crítico', color: '#FF3D00' }, { id: 'alto', label: 'Alto', color: '#FFD600' }].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
            backgroundColor: filter === f.id ? f.color : 'transparent',
            color: filter === f.id ? '#fff' : 'var(--text-muted)',
            outline: filter === f.id ? 'none' : '1px solid var(--border-color)',
          }}>{f.label}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{active.length} ativos</span>
      </div>

      {active.length === 0 && acked.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '40px 0', color: '#00C853', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>Rede operando normalmente
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(a => {
            const cfg = ALERTA_CONFIG[a.tipo] ?? { icon: '●', color: '#FFD600', label: a.tipo }
            const key = alertKey(a)
            const isCrit = severityOf(a.tipo) === 'critico'
            return (
              <div key={key} style={{ ...card, padding: '12px 16px', borderLeft: `3px solid ${cfg.color}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: cfg.color, flexShrink: 0 }}>{cfg.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.08em',
                      backgroundColor: isCrit ? '#FF3D0022' : '#FFD60022',
                      border: `1px solid ${isCrit ? '#FF3D0055' : '#FFD60055'}`,
                      color: isCrit ? '#FF3D00' : '#FFD600',
                    }}>{isCrit ? 'P1 CRÍTICO' : 'P2 ALTO'}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                    {a.tipo === 'onu_offline'   && <>{a.cliente ?? a.serial}{a.cto_id ? ` — CTO ${a.cto_id}` : ''}</>}
                    {a.tipo === 'sinal_critico' && <>{a.cliente ?? a.serial} — RX {a.rx_power?.toFixed(2)} dBm</>}
                    {a.tipo === 'cto_cheia'     && <>{a.nome ?? a.cto_id} — {a.pct}% ocupado</>}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {a.tipo === 'onu_offline' && onTestOnu && (
                    <button onClick={() => onTestOnu(a.serial)} style={{ ...btn('#2D8CFF'), fontSize: 11, padding: '4px 10px' }}>Testar</button>
                  )}
                  <button onClick={() => onAck(key)} style={{ ...btnOutline, fontSize: 11, padding: '4px 10px' }}>Ack</button>
                </div>
              </div>
            )
          })}
          {acked.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reconhecidos ({acked.length})</p>
              {acked.map(a => {
                const cfg = ALERTA_CONFIG[a.tipo] ?? { icon: '●', color: '#6B7A8D', label: a.tipo }
                return (
                  <div key={alertKey(a)} style={{ ...card, padding: '8px 14px', opacity: 0.45, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: cfg.color }}>{cfg.icon}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cfg.label}</span>
                    {a.serial && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{a.serial}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── DiagnosticPanel ──────────────────────────────────────────────────────────

function DiagnosticPanel({ onus = [], onLog }) {
  const [query,      setQuery]      = useState('')
  const [selected,   setSelected]   = useState(null)
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showModal,  setShowModal]  = useState(false)

  const suggestions = query.length >= 2
    ? onus.filter(o => (o.serial?.toLowerCase().includes(query.toLowerCase()) || o.cliente?.toLowerCase().includes(query.toLowerCase()))).slice(0, 8)
    : []

  function selectOnu(o) { setSelected(o); setQuery(`${o.serial}${o.cliente ? ` — ${o.cliente}` : ''}`); setTestResult(null) }

  const sig = selected ? analyzeSignal(selected.rx_power, selected.tx_power) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showModal && selected && <DiagnosticModal serial={selected.serial} onClose={() => setShowModal(false)} />}

      <div style={card}>
        <SectionTitle>Selecionar ONU para Diagnóstico</SectionTitle>
        <div style={{ position: 'relative' }}>
          <input style={inp} value={query} onChange={e => { setQuery(e.target.value); setSelected(null) }} placeholder="Serial ou nome do cliente..." />
          {suggestions.length > 0 && !selected && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
              {suggestions.map(o => (
                <button key={o._id} onClick={() => selectOnu(o)} style={{ width: '100%', padding: '9px 14px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: STATUS_ONU[o.status]?.color ?? '#6B7A8D', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{o.cliente ?? '—'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{o.serial}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && sig && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{selected.cliente ?? selected.serial}</p>
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', margin: '3px 0 0' }}>{selected.serial}</p>
            </div>
            <StatusBadge statusMap={STATUS_ONU} status={selected.status} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginBottom: 16, fontSize: 12 }}>
            {[['OLT', selected.olt_id ?? '—'], ['PON', selected.pon_port ?? '—'], ['CTO', selected.cto_id ?? '—'], ['Provisionado', fmtTs(selected.provisioned_at)]].map(([k, v]) => (
              <div key={k}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{k}</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--foreground)' }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'RX chegada (ONU)', val: selected.rx_power, color: SIG_COLOR[sig.rxClass], quality: sig.rxQuality },
              { label: 'TX retorno (OLT)', val: selected.tx_power, color: SIG_COLOR[sig.txClass], quality: sig.txStatus },
            ].map(({ label, val, color, quality }) => (
              <div key={label} style={{ border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '10px 14px', backgroundColor: color + '0d' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color, margin: '0 0 2px', fontFamily: 'monospace' }}>
                  {val != null ? val.toFixed(2) : 'N/D'}{val != null && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3 }}>dBm</span>}
                </p>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{quality}</span>
              </div>
            ))}
          </div>

          <div style={{ borderRadius: 8, padding: '10px 14px', marginBottom: 14, backgroundColor: SIG_COLOR[sig.statusGeral === 'OK' ? 'success' : sig.statusGeral === 'ATENÇÃO' ? 'limite' : 'critico'] + '15', border: `1px solid ${SIG_COLOR[sig.statusGeral === 'OK' ? 'success' : sig.statusGeral === 'ATENÇÃO' ? 'limite' : 'critico']}44` }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: SIG_COLOR[sig.statusGeral === 'OK' ? 'success' : sig.statusGeral === 'ATENÇÃO' ? 'limite' : 'critico'], margin: 0 }}>Status: {sig.statusGeral}</p>
            {sig.diags.map((d, i) => <p key={i} style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>• {d}</p>)}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowModal(true)} style={{ ...btn('#2D8CFF'), display: 'inline-flex', alignItems: 'center', gap: 8 }}>Testar ONU</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── StatusBar ────────────────────────────────────────────────────────────────

function StatusBar({ alertas, now, lastUpdate, userRole }) {
  const dotColor = alertas.length === 0 ? '#00C853' : alertas.length <= 3 ? '#FFD600' : '#FF3D00'
  const netLabel = alertas.length === 0 ? 'OPERACIONAL' : alertas.length <= 3 ? 'DEGRADAÇÃO' : 'CRÍTICO'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}`, display: 'inline-block', animation: 'noc-pulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: dotColor, letterSpacing: '0.1em' }}>{netLabel}</span>
        </div>
        <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Carregado {fmtTime(lastUpdate)}</span>
        {userRole && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, backgroundColor: '#2D8CFF18', border: '1px solid #2D8CFF44', color: '#2D8CFF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {userRole}
          </span>
        )}
        <button onClick={() => window.location.reload()} style={{ ...btn('#2D8CFF'), fontSize: 11, padding: '5px 12px' }}>Atualizar</button>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ view, onNavigate, collapsed, onToggle, alertCount }) {
  const NAV = [
    { id: 'dashboard',   icon: '⊞', label: 'Dashboard' },
    { id: 'onus',        icon: '◉', label: 'ONUs' },
    { id: 'olts',        icon: '▦', label: 'OLTs' },
    { id: 'alertas',     icon: '⚠', label: 'Alertas', badge: alertCount },
    { id: 'diagnostico', icon: '⊙', label: 'Diagnóstico' },
    { id: 'logs',        icon: '≡', label: 'Logs' },
  ]
  const EXTRA = [
    { id: 'sgp',      icon: '⚡', label: 'SGP' },
    { id: 'autofind', icon: '◎', label: 'Auto-Find' },
    { id: 'olt-mgmt', icon: '⚙', label: 'Ger. OLTs' },
  ]
  const W = collapsed ? 52 : 210

  function NavBtn({ item }) {
    const active = view === item.id
    return (
      <button onClick={() => onNavigate(item.id)} title={collapsed ? item.label : undefined} style={{
        width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px 0' : '9px 14px',
        backgroundColor: active ? '#2D8CFF15' : 'transparent',
        borderLeft: active ? '3px solid #2D8CFF' : '3px solid transparent',
        color: active ? '#2D8CFF' : 'var(--text-muted)',
        transition: 'background-color 0.12s, color 0.12s',
        position: 'relative',
      }}>
        <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
        {!collapsed && <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{item.label}</span>}
        {item.badge > 0 && (
          <span style={{
            position: collapsed ? 'absolute' : 'static',
            top: collapsed ? 6 : undefined, right: collapsed ? 6 : undefined,
            marginLeft: collapsed ? 0 : 'auto',
            minWidth: 16, height: 16, borderRadius: 99, backgroundColor: '#FF3D00',
            color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>{item.badge}</span>
        )}
      </button>
    )
  }

  return (
    <div style={{ width: W, minWidth: W, flexShrink: 0, backgroundColor: 'var(--card-bg)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', transition: 'width 0.18s ease, min-width 0.18s ease', overflow: 'hidden' }}>
      <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: '1px solid var(--border-color)', gap: 8, flexShrink: 0 }}>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2D8CFF', fontSize: 16, padding: 2, lineHeight: 1, flexShrink: 0 }}>≡</button>
        {!collapsed && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>FiberOps NOC</span>}
      </div>
      <nav style={{ flex: 1, paddingTop: 6, overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV.map(item => <NavBtn key={item.id} item={item} />)}
        <div style={{ margin: '8px 12px', borderTop: '1px solid var(--border-color)' }} />
        {EXTRA.map(item => <NavBtn key={item.id} item={item} />)}
      </nav>
      {!collapsed && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>FiberOps · NOC v2</p>
        </div>
      )}
    </div>
  )
}

// ─── QuickActionsFAB ──────────────────────────────────────────────────────────

function QuickActionsFAB({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const items = [
    { label: 'Provisionar ONU',  view: 'onus' },
    { label: 'Testar ONU',       view: 'diagnostico' },
    { label: 'Ver Auto-Find',    view: 'autofind' },
    { label: 'Gerenciar OLTs',   view: 'olt-mgmt' },
  ]
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
      {open && (
        <div style={{ position: 'absolute', bottom: 52, right: 0, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          {items.map(item => (
            <button key={item.label} onClick={() => { onNavigate(item.view); setOpen(false) }} style={{ width: '100%', padding: '10px 14px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--foreground)', borderBottom: '1px solid var(--border-color)' }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} style={{ ...btn('#2D8CFF'), borderRadius: 99, padding: '10px 18px', boxShadow: '0 4px 16px rgba(45,140,255,0.4)', fontSize: 13, fontWeight: 700 }}>
        {open ? '✕ Fechar' : '⚡ Ações'}
      </button>
    </div>
  )
}

// ─── DashboardView ────────────────────────────────────────────────────────────

function DashboardView({ stats, ackedAlerts, onAck }) {
  const { oltStats, onuStats, totalCTOs, pendingEvents, alertas = [] } = stats ?? {}
  const onus = stats?.onus ?? []
  const olts = stats?.olts ?? []
  const [chartRange, setChartRange] = useState('24h')

  const pctActive    = (onuStats?.active ?? 0) / Math.max(onuStats?.total ?? 1, 1) * 100
  const criticalOnus = onus.filter(o => o.signal_quality === 'critico').length
  const sigScore     = criticalOnus === 0 ? 100 : Math.max(0, 100 - criticalOnus * 20)
  const pctOlts      = (oltStats?.ativos ?? 0) / Math.max(oltStats?.total ?? 1, 1) * 100
  const score        = Math.round(0.5 * pctActive + 0.3 * sigScore + 0.2 * pctOlts)
  const statusColor  = score >= 90 ? '#00C853' : score >= 70 ? '#FFD600' : '#FF3D00'

  const sqCounts = {
    excelente: onus.filter(o => o.signal_quality === 'excelente').length,
    bom:       onus.filter(o => o.signal_quality === 'bom').length,
    medio:     onus.filter(o => o.signal_quality === 'medio').length,
    critico:   onus.filter(o => o.signal_quality === 'critico').length,
  }
  const totalWithData = Object.values(sqCounts).reduce((a, b) => a + b, 0)

  const activeAlerts = alertas.filter(a => !ackedAlerts.has(`${a.tipo}-${a.serial ?? a.cto_id}`))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(196px, 1fr))', gap: 14 }}>
        <MetricCard label="ONUs Online"  value={onuStats?.active       ?? 0} accent="#00C853" sparkData={generateSparkData(onuStats?.active  ?? 0)} />
        <MetricCard label="ONUs Offline" value={onuStats?.offline      ?? 0} accent={(onuStats?.offline ?? 0) > 0 ? '#FF3D00' : '#6B7A8D'} sparkData={generateSparkData(onuStats?.offline ?? 0)} />
        <MetricCard label="Em Alerta"    value={activeAlerts.length}          accent={activeAlerts.length > 0 ? '#FFD600' : '#6B7A8D'} sparkData={generateSparkData(activeAlerts.length)} />
        <MetricCard label="OLTs Ativas"  value={oltStats?.ativos       ?? 0} accent="#2D8CFF" sparkData={generateSparkData(oltStats?.ativos   ?? 0)} sublabel={`de ${oltStats?.total ?? 0} total`} />
      </div>

      {/* Health + KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 14 }}>
        <div style={{ ...card, borderLeft: `4px solid ${statusColor}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
          <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, margin: 0 }}>Saúde da Rede</p>
          <p style={{ fontSize: 52, fontWeight: 700, color: statusColor, lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{score}</p>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, backgroundColor: statusColor + '20', border: `1px solid ${statusColor}44`, color: statusColor, alignSelf: 'flex-start', letterSpacing: '0.08em' }}>
            {score >= 90 ? 'OPERAÇÃO NORMAL' : score >= 70 ? 'DEGRADADO' : 'CRÍTICO'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
          {[
            { label: 'Provisionando', value: onuStats?.provisioning ?? 0, color: '#2D8CFF' },
            { label: 'CTOs',          value: totalCTOs ?? 0,               color: 'var(--foreground)' },
            { label: 'Fila Eventos',  value: pendingEvents ?? 0,            color: (pendingEvents ?? 0) > 0 ? '#FFD600' : 'var(--foreground)' },
            { label: 'Sinal Crítico', value: criticalOnus,                  color: criticalOnus > 0 ? '#FF3D00' : 'var(--foreground)' },
          ].map(k => (
            <div key={k.label} style={{ ...card, padding: '12px 14px' }}>
              <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px', fontWeight: 700 }}>{k.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* OLTs grid */}
      <OLTsPanel olts={olts} onus={onus} />

      {/* Chart + Signal + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card}>
            <NetworkChart
              onlineData={generateSparkData(onuStats?.active ?? 0, 18)}
              offlineData={generateSparkData(onuStats?.offline ?? 0, 18)}
              range={chartRange}
              onRangeChange={setChartRange}
            />
          </div>
          <div style={card}>
            <SectionTitle>Distribuição de Sinal</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 'excelente', label: 'Excelente', color: '#00C853' },
                { key: 'bom',       label: 'Bom',       color: '#4ade80' },
                { key: 'medio',     label: 'Médio',     color: '#FFD600' },
                { key: 'critico',   label: 'Crítico',   color: '#FF3D00' },
              ].map(row => {
                const pct = totalWithData > 0 ? (sqCounts[row.key] / totalWithData) * 100 : 0
                return (
                  <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: row.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 65, flexShrink: 0 }}>{row.label}</span>
                    <div style={{ flex: 1, height: 5, borderRadius: 99, backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(pct, sqCounts[row.key] > 0 ? 2 : 0)}%`, backgroundColor: row.color, borderRadius: 99, transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: row.color, width: 26, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{sqCounts[row.key]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Alerts sidebar */}
        <div style={card}>
          <SectionTitle>Alertas Ativos ({activeAlerts.length})</SectionTitle>
          {activeAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#00C853', fontSize: 12 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>Rede operando normalmente
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeAlerts.slice(0, 8).map(a => {
                const cfg = ALERTA_CONFIG[a.tipo] ?? { icon: '●', color: '#FFD600', label: a.tipo }
                const key = `${a.tipo}-${a.serial ?? a.cto_id}`
                return (
                  <div key={key} style={{ padding: '8px 10px', borderRadius: 7, backgroundColor: cfg.color + '12', border: `1px solid ${cfg.color}33`, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: cfg.color, fontSize: 11, marginTop: 1, flexShrink: 0 }}>{cfg.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: cfg.color, margin: 0 }}>{cfg.label}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.cliente ?? a.serial ?? a.nome ?? a.cto_id}
                      </p>
                    </div>
                    <button onClick={() => onAck(key)} style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>Ack</button>
                  </div>
                )
              })}
              {activeAlerts.length > 8 && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>+{activeAlerts.length - 8} mais alertas</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── DiagnosticModal ──────────────────────────────────────────────────────────

function DiagnosticModal({ serial, onClose }) {
  const [loading, setLoading] = useState(true)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { testOnu } = await import('@/actions/provisioning')
        const res = await testOnu(serial)
        if (!cancelled) { setResult(res); setLoading(false) }
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [serial])

  const sig = result ? analyzeSignal(result.rx_power, result.tx_power) : null
  const statusColor = sig ? (sig.statusGeral === 'OK' ? '#00C853' : sig.statusGeral === 'ATENÇÃO' ? '#FFD600' : '#FF3D00') : '#6B7A8D'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Diagnóstico ONU</p>
            <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', margin: '2px 0 0' }}>{serial}</p>
          </div>
          <button onClick={onClose} style={{ ...btnOutline, padding: '4px 10px', fontSize: 14 }}>✕</button>
        </div>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Spinner /> Testando ONU...
          </div>
        )}
        {error && <p style={{ color: '#FF3D00', fontSize: 13 }}>{error}</p>}
        {result && sig && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'RX (chegada)', val: result.rx_power, color: SIG_COLOR[sig.rxClass], q: sig.rxQuality },
                { label: 'TX (retorno)', val: result.tx_power, color: SIG_COLOR[sig.txClass], q: sig.txStatus },
              ].map(({ label, val, color, q }) => (
                <div key={label} style={{ border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '10px 14px', backgroundColor: color + '0d' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color, margin: '0 0 2px', fontFamily: 'monospace' }}>
                    {val != null ? val.toFixed(2) : 'N/D'}{val != null && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3 }}>dBm</span>}
                  </p>
                  <span style={{ fontSize: 11, fontWeight: 700, color }}>{q}</span>
                </div>
              ))}
            </div>
            <div style={{ borderRadius: 8, padding: '10px 14px', backgroundColor: statusColor + '15', border: `1px solid ${statusColor}40` }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: statusColor, margin: 0 }}>Status: {sig.statusGeral}</p>
              {sig.diags.length === 0
                ? <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Operação normal</p>
                : sig.diags.map((d, i) => <p key={i} style={{ fontSize: 11, color: statusColor, margin: '2px 0 0' }}>• {d}</p>)
              }
            </div>
            {result.report && (
              <div>
                <p style={{ ...lbl, marginBottom: 6 }}>Relatório UNM</p>
                <pre style={{ backgroundColor: '#0f172a', color: '#94a3b8', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', fontSize: 11, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'monospace' }}>
                  {result.report}
                </pre>
              </div>
            )}
          </>
        )}
        <button onClick={onClose} style={{ ...btn('#2D8CFF'), alignSelf: 'flex-end' }}>Fechar</button>
      </div>
    </div>
  )
}

// ─── TAB: CLIENTES (ONUs) ─────────────────────────────────────────────────────

function ClientesTab({ onus = [], olts = [], onLog }) {
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [provisioning, setProvisioning] = useState(false)
  const [cancelling, setCancelling]     = useState(false)
  const [feedback, setFeedback]         = useState(null)
  const [form, setForm]                 = useState({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })
  const [testingSerial, setTestingSerial] = useState(null)
  const [monitorActive, setMonitorActive] = useState(false)
  const [monitorAlerts, setMonitorAlerts] = useState([])
  const monitorRef = useRef(null)

  function showFeedback(type, message) { setFeedback({ type, message }); setTimeout(() => setFeedback(null), 5000) }

  useEffect(() => {
    if (!monitorActive) { if (monitorRef.current) { clearInterval(monitorRef.current); monitorRef.current = null }; return }
    async function runMonitor() {
      try {
        const { monitorOfflineOnus } = await import('@/actions/provisioning')
        const alerts = await monitorOfflineOnus()
        setMonitorAlerts(alerts)
        if (alerts.length > 0) onLog('MONITOR', `${alerts.length} ONU(s) offline detectada(s)`, 'warn')
      } catch { /* silent */ }
    }
    runMonitor()
    monitorRef.current = setInterval(runMonitor, 60_000)
    return () => { if (monitorRef.current) clearInterval(monitorRef.current) }
  }, [monitorActive, onLog])

  const STATUS_CHIPS = [
    { id: 'todos',         label: 'Todos',         color: '#2D8CFF' },
    { id: 'ativas',        label: 'Ativas',         color: '#00C853' },
    { id: 'offline',       label: 'Offline',        color: '#FF3D00' },
    { id: 'critico',       label: 'Critico',        color: '#FF6D00' },
    { id: 'provisionando', label: 'Provisionando',  color: '#2D8CFF' },
  ]

  const filtered = onus.filter(o => {
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!(o.serial?.toLowerCase().includes(q) || o.cliente?.toLowerCase().includes(q) || o.cto_id?.toLowerCase().includes(q) || o.olt_id?.toLowerCase().includes(q))) return false
    }
    if (statusFilter === 'ativas')        return o.status === 'active'
    if (statusFilter === 'offline')       return o.status === 'offline'
    if (statusFilter === 'critico')       return o.signal_quality === 'critico'
    if (statusFilter === 'provisionando') return o.status === 'provisioning'
    return true
  })

  async function handleProvision() {
    if (!form.serial.trim()) { showFeedback('error', 'Serial ONU é obrigatório.'); return }
    setProvisioning(true)
    onLog('ONU', `Provisionando ${form.serial}`, 'info')
    try {
      const { manualProvision } = await import('@/actions/provisioning')
      const result = await manualProvision({ serial: form.serial.trim(), cliente: form.cliente.trim(), oltId: form.oltId || null, ponPort: form.ponPort || null, ctoId: form.ctoId.trim() || null })
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
    } finally { setProvisioning(false) }
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
    } finally { setCancelling(false) }
  }

  const selectedOlt = olts.find(o => o.id === form.oltId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {testingSerial && <DiagnosticModal serial={testingSerial} onClose={() => setTestingSerial(null)} />}

      {monitorAlerts.length > 0 && (
        <div style={{ backgroundColor: '#422006', border: '1px solid #d97706', borderRadius: 10, padding: '12px 16px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>Monitor detectou {monitorAlerts.length} ONU(s) offline</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {monitorAlerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#FF3D00', flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', color: '#fbbf24', fontWeight: 600 }}>{a.serial}</span>
                <span style={{ color: 'var(--text-muted)' }}>{a.cliente}</span>
                <span style={{ color: '#f87171' }}>— {a.problema}</span>
                <button onClick={() => setTestingSerial(a.serial)} style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', backgroundColor: '#2D8CFF', color: '#fff' }}>Testar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ONU list */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
          <SectionTitle>ONUs ({filtered.length})</SectionTitle>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setMonitorActive(m => !m)} style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', backgroundColor: monitorActive ? '#00C85322' : 'var(--inp-bg)', color: monitorActive ? '#00C853' : 'var(--text-muted)', outline: monitorActive ? '1px solid #00C85355' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 5 }}>
              {monitorActive && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#00C853', animation: 'noc-blink 1s ease-in-out infinite' }} />}
              Monitor Auto
            </button>
            <input style={{ ...inp, width: 220 }} type="text" placeholder="Buscar serial, cliente, CTO..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {STATUS_CHIPS.map(chip => {
            const active = statusFilter === chip.id
            return (
              <button key={chip.id} onClick={() => setStatusFilter(chip.id)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 99, cursor: 'pointer', border: 'none', backgroundColor: active ? chip.color : 'var(--inp-bg)', color: active ? '#fff' : 'var(--text-muted)', outline: active ? 'none' : `1px solid var(--border-color)`, transition: 'background-color 0.15s, color 0.15s' }}>
                {chip.label}
              </button>
            )
          })}
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>{onus.length === 0 ? 'Nenhuma ONU provisionada.' : 'Nenhum resultado.'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Cliente</TH><TH>Serial</TH><TH>CTO</TH><TH right>Porta</TH>
                  <TH>OLT</TH><TH right>PON</TH><TH right>RX (dBm)</TH>
                  <TH>Qualidade</TH><TH>Status</TH><TH>Diagnóstico</TH><TH>Teste</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const diagColor = !o.last_diagnostic ? 'var(--text-muted)'
                    : o.last_diagnostic.toLowerCase().includes('normal') ? '#00C853'
                    : o.last_diagnostic.toLowerCase().includes('atenuação') || o.last_diagnostic.toLowerCase().includes('saturação') ? '#FFD600'
                    : '#FF3D00'
                  return (
                    <tr key={o._id ?? i}>
                      <TD bold>{o.cliente ?? '—'}</TD>
                      <TD mono>{o.serial}</TD>
                      <TD mono muted>{o.cto_id ?? '—'}</TD>
                      <TD right muted>{o.cto_port ?? '—'}</TD>
                      <TD mono muted>{o.olt_id ?? '—'}</TD>
                      <TD right muted>{o.pon_port ?? '—'}</TD>
                      <TD right mono>
                        {o.rx_power != null ? <span style={{ color: SIGNAL_QUALITY[o.signal_quality]?.color ?? 'var(--foreground)' }}>{o.rx_power.toFixed(2)}</span> : '—'}
                      </TD>
                      <TD><SignalBadge quality={o.signal_quality} /></TD>
                      <TD><StatusBadge statusMap={STATUS_ONU} status={o.status} /></TD>
                      <TD>{o.last_diagnostic ? <span style={{ fontSize: 11, color: diagColor, fontWeight: 600 }}>{o.last_diagnostic.length > 30 ? o.last_diagnostic.slice(0, 28) + '…' : o.last_diagnostic}</span> : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}</TD>
                      <TD>
                        <button onClick={() => setTestingSerial(o.serial)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', backgroundColor: '#2D8CFF22', color: '#38bdf8' }}>Testar</button>
                      </TD>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Diagnostic legend */}
      <div style={{ ...card, padding: '14px 18px' }}>
        <SectionTitle>Referência de Diagnóstico</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { color: '#00C853', label: 'RX > -20 dBm',       desc: 'Sinal excelente' },
            { color: '#4ade80', label: 'RX -20 a -25 dBm',   desc: 'Sinal bom' },
            { color: '#FFD600', label: 'RX -25 a -28 dBm',   desc: 'Alta atenuação — verificar CTO/fusão' },
            { color: '#FF3D00', label: 'RX < -28 dBm',        desc: 'Crítico — fibra ou ONU com problema' },
            { color: '#FF3D00', label: 'Offline sem RX',       desc: 'ONU desligada / sem energia' },
            { color: '#FF3D00', label: 'Offline + RX < -30',  desc: 'Possível fibra rompida' },
            { color: '#FFD600', label: 'TX > 5 dBm',          desc: 'Saturação — problema de transmissão' },
            { color: '#00C853', label: 'TX 1 – 5 dBm',        desc: 'Retorno da ONU OK' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: r.color, flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: r.color, fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>— {r.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provision form */}
      <div style={card}>
        <SectionTitle>Provisionar / Cancelar ONU</SectionTitle>
        <FeedbackBanner feedback={feedback} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Serial ONU *</label><input style={inp} type="text" placeholder="ZTEG1A2B3C4D" value={form.serial} onChange={e => setForm(f => ({ ...f, serial: e.target.value }))} /></div>
            <div><label style={lbl}>Nome do Cliente</label><input style={inp} type="text" placeholder="João da Silva" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>OLT</label>
              <select style={{ ...inp }} value={form.oltId} onChange={e => setForm(f => ({ ...f, oltId: e.target.value, ponPort: '' }))}>
                <option value="">Auto / selecionar OLT...</option>
                {olts.map(olt => <option key={olt.id} value={olt.id}>{olt.nome}{olt.ip ? ` (${olt.ip})` : ''}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Porta PON</label><input style={inp} type="number" min="0" placeholder={selectedOlt ? `0 – ${(selectedOlt.capacidade ?? 16) - 1}` : '0'} value={form.ponPort} onChange={e => setForm(f => ({ ...f, ponPort: e.target.value }))} /></div>
            <div><label style={lbl}>CTO ID (auto se vazio)</label><input style={inp} type="text" placeholder="CTO-001" value={form.ctoId} onChange={e => setForm(f => ({ ...f, ctoId: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={{ ...btn('#2D8CFF'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: (provisioning || cancelling) ? 0.7 : 1 }} onClick={handleProvision} disabled={provisioning || cancelling}>
              {provisioning && <Spinner />}Provisionar ONU
            </button>
            <button style={{ ...btn('#dc2626'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: (provisioning || cancelling) ? 0.7 : 1 }} onClick={handleCancel} disabled={provisioning || cancelling}>
              {cancelling && <Spinner />}Cancelar ONU
            </button>
            <button style={btnOutline} onClick={() => setForm({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })} disabled={provisioning || cancelling}>Limpar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CTOCard & TopologiaTab ────────────────────────────────────────────────────

function CTOCard({ cto }) {
  const [expanded, setExpanded] = useState(false)
  const pct   = cto.pct ?? (cto.capacidade > 0 ? Math.min(100, Math.round(((cto.ocupadas ?? cto.ocupacao ?? 0) / cto.capacidade) * 100)) : 0)
  const color = barColor(pct)
  const ports = cto.ports ?? []
  return (
    <div style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpanded(v => !v)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{cto.id ?? cto.cto_id}</p>
            {cto.name && cto.name !== (cto.id ?? cto.cto_id) && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{cto.name}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ padding: '2px 8px', borderRadius: 99, backgroundColor: color + '22', border: `1px solid ${color}55`, color, fontSize: 11, fontWeight: 700 }}>{pct}%</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        <div style={{ height: 5, borderRadius: 99, backgroundColor: 'var(--border-color)', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 99 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
          <span>
            <span style={{ color: '#FF3D00', fontWeight: 600 }}>{cto.ocupadas ?? cto.ocupacao ?? 0}</span>{' / '}{cto.capacidade ?? ports.length} portas
            {(cto.livres ?? 0) > 0 && <span style={{ color: '#00C853', marginLeft: 6 }}>· {cto.livres} livre{cto.livres !== 1 ? 's' : ''}</span>}
          </span>
          {cto.cdo_id && <span>CDO: <span style={{ fontFamily: 'monospace', color: 'var(--foreground)' }}>{cto.cdo_id}</span></span>}
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-color)', maxHeight: 280, overflowY: 'auto' }}>
          {ports.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Nenhuma porta mapeada no diagrama.</p>
          ) : ports.map(p => {
            const occupied = p.status === 'OCUPADO'
            const dotColor = occupied ? '#FF3D00' : '#00C853'
            const sqColor  = p.client?.signal_quality ? SIGNAL_QUALITY[p.client.signal_quality]?.color : null
            return (
              <div key={p.port_number} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid var(--border-color)', fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: 54 }}>Porta {String(p.port_number).padStart(2, '0')}</span>
                {occupied ? <span style={{ color: 'var(--foreground)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.client?.name ?? '—'}</span>
                          : <span style={{ color: 'var(--text-muted)', flex: 1 }}>Livre</span>}
                {occupied && p.client?.rx_power != null && <span style={{ fontSize: 10, color: sqColor ?? 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>{p.client.rx_power.toFixed(1)} dBm</span>}
                {p.splitter_nome && <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{p.splitter_nome}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TopologiaTab({ ctos: ctosBasic = [], olts = [] }) {
  const [ctosFull, setCtosFull] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [fetchErr, setFetchErr] = useState(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/ctos/full')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => { setCtosFull(data); setLoading(false) })
      .catch(e  => { setFetchErr(String(e)); setLoading(false) })
  }, [])

  const ctos = ctosFull ?? ctosBasic.map(c => ({
    id: c.cto_id, name: c.nome, cdo_id: c.cdo_id,
    capacidade: c.capacidade, ocupadas: c.ocupacao,
    livres: (c.capacidade ?? 0) - (c.ocupacao ?? 0),
    pct: c.capacidade > 0 ? Math.min(100, Math.round((c.ocupacao / c.capacidade) * 100)) : 0,
    ports: [],
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={card}>
        <SectionTitle>OLTs ({olts.length})</SectionTitle>
        {olts.length === 0 ? <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma OLT cadastrada.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><TH>Nome</TH><TH>IP</TH><TH>Modelo</TH><TH>Status</TH><TH right>Capacidade</TH></tr></thead>
              <tbody>
                {olts.map((o, i) => (
                  <tr key={o._id ?? o.id ?? i}>
                    <TD bold>{o.nome || o.id || '—'}</TD>
                    <TD mono muted>{o.ip || '—'}</TD>
                    <TD muted>{o.modelo || '—'}</TD>
                    <TD><StatusBadge statusMap={STATUS_OLT} status={STATUS_OLT[o.status] ? o.status : 'ativo'} /></TD>
                    <TD right muted>{o.capacidade ?? '—'}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>CTOs — Portas por Cliente ({ctos.length})</p>
          {loading && <Spinner />}
          {fetchErr && <span style={{ fontSize: 12, color: '#FF3D00' }}>{fetchErr}</span>}
        </div>
        {ctos.length === 0 ? <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma CTO cadastrada.</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {ctos.map((cto, i) => <CTOCard key={cto.id ?? cto.cto_id ?? i} cto={cto} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SGPTab ────────────────────────────────────────────────────────────────────

function SGPTab({ sgpStatus, onLog }) {
  const [sgpForm, setSgpForm]         = useState({ host: '', username: '', password: '' })
  const [savingCreds, setSavingCreds] = useState(false)
  const [fetching, setFetching]       = useState(false)
  const [applying, setApplying]       = useState(false)
  const [diff, setDiff]               = useState(null)
  const [selectedInstalls, setSelectedInstalls] = useState([])
  const [selectedCancels,  setSelectedCancels]  = useState([])
  const [feedback, setFeedback] = useState(null)

  function showFeedback(type, message) { setFeedback({ type, message }); setTimeout(() => setFeedback(null), 5000) }

  async function handleSaveCreds() {
    if (!sgpForm.host.trim()) { showFeedback('error', 'Host é obrigatório.'); return }
    setSavingCreds(true)
    try {
      const { saveSGPConfig } = await import('@/actions/sgp')
      await saveSGPConfig({ host: sgpForm.host.trim(), username: sgpForm.username.trim(), password: sgpForm.password })
      showFeedback('success', 'Credenciais salvas. Recarregue a página.')
      onLog('SGP', 'Credenciais configuradas', 'success')
    } catch (e) { showFeedback('error', e.message); onLog('SGP', e.message, 'error') }
    finally { setSavingCreds(false) }
  }

  async function handleFetch() {
    setFetching(true); setDiff(null); setSelectedInstalls([]); setSelectedCancels([])
    onLog('SGP', 'Buscando dados do SGP...', 'info')
    try {
      const { fetchFromSGP } = await import('@/actions/sgp')
      const result = await fetchFromSGP()
      setDiff(result)
      const msg = `${result.novos.length} novos, ${result.cancelamentos.length} cancelamentos detectados`
      onLog('SGP', msg, 'info')
      if (result.novos.length === 0 && result.cancelamentos.length === 0) showFeedback('success', 'SGP sincronizado — sem diferenças.')
    } catch (e) { showFeedback('error', e.message); onLog('SGP', e.message, 'error') }
    finally { setFetching(false) }
  }

  async function handleApply() {
    const installs = (diff?.novos ?? []).filter(n => selectedInstalls.includes(n.serial))
    const cancels  = (diff?.cancelamentos ?? []).filter(c => selectedCancels.includes(c.serial))
    if (installs.length === 0 && cancels.length === 0) { showFeedback('error', 'Selecione ao menos um item.'); return }
    setApplying(true)
    onLog('SGP', `Aplicando ${installs.length + cancels.length} itens selecionados`, 'info')
    try {
      const { applyFromSGP } = await import('@/actions/sgp')
      const result = await applyFromSGP({ installs, cancels })
      showFeedback('success', `${result.criados} eventos enfileirados para processamento.`)
      onLog('SGP', `${result.criados} eventos criados`, 'success')
      setDiff(null); setSelectedInstalls([]); setSelectedCancels([])
    } catch (e) { showFeedback('error', e.message); onLog('SGP', e.message, 'error') }
    finally { setApplying(false) }
  }

  function toggleInstall(serial) { setSelectedInstalls(prev => prev.includes(serial) ? prev.filter(s => s !== serial) : [...prev, serial]) }
  function toggleCancel(serial)  { setSelectedCancels(prev  => prev.includes(serial) ? prev.filter(s => s !== serial) : [...prev, serial]) }
  const isConfigured = sgpStatus?.isConfigured ?? false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FeedbackBanner feedback={feedback} />
      <div style={card}>
        <SectionTitle>Integração SGP / TMSX</SectionTitle>
        {isConfigured ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, backgroundColor: '#052e1688', border: '1px solid #166534', color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#4ade80', display: 'inline-block' }} />Configurado
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Host: <strong style={{ color: 'var(--foreground)' }}>{sgpStatus.host}</strong></span>
              {sgpStatus.username && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Usuário: <strong style={{ color: 'var(--foreground)' }}>{sgpStatus.username}</strong></span>}
            </div>
            {sgpStatus.lastSync && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Última consulta: {fmtTs(sgpStatus.lastSync)}{sgpStatus.lastSyncStats && <> — {sgpStatus.lastSyncStats.novos ?? 0} novos, {sgpStatus.lastSyncStats.cancelamentos ?? 0} cancelamentos</>}</p>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>SGP não configurado.</p>
            <div><label style={lbl}>Host (URL ou &apos;mock&apos;)</label><input style={inp} type="text" placeholder="https://sgp.empresa.com.br" value={sgpForm.host} onChange={e => setSgpForm(f => ({ ...f, host: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Usuário</label><input style={inp} type="text" value={sgpForm.username} onChange={e => setSgpForm(f => ({ ...f, username: e.target.value }))} /></div>
              <div><label style={lbl}>Senha</label><input style={inp} type="password" value={sgpForm.password} onChange={e => setSgpForm(f => ({ ...f, password: e.target.value }))} /></div>
            </div>
            <button style={{ ...btn('#2D8CFF'), display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', opacity: savingCreds ? 0.7 : 1 }} onClick={handleSaveCreds} disabled={savingCreds}>
              {savingCreds && <Spinner />}Salvar Credenciais
            </button>
          </div>
        )}
      </div>

      {isConfigured && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <SectionTitle>Comparar com SGP</SectionTitle>
            <button style={{ ...btn(fetching ? '#475569' : '#2D8CFF'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: (fetching || applying) ? 0.8 : 1 }} onClick={handleFetch} disabled={fetching || applying}>
              {fetching && <Spinner />}{fetching ? 'Buscando...' : 'Atualizar dados do SGP'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Consulta o SGP em modo leitura e mostra as diferenças. Nenhum dado é alterado até você confirmar.</p>
          {diff && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>✚ {diff.novos.length} novos clientes encontrados</p>
                  {diff.novos.length > 0 && <button style={{ ...btnOutline, fontSize: 11, padding: '4px 10px' }} onClick={() => setSelectedInstalls(diff.novos.map(n => n.serial))}>Todos</button>}
                </div>
                {diff.novos.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum cliente novo.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {diff.novos.map(n => {
                      const checked = selectedInstalls.includes(n.serial)
                      return (
                        <label key={n.serial} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', backgroundColor: checked ? '#052e16aa' : 'var(--inp-bg)', border: `1px solid ${checked ? '#16a34a' : 'var(--border-color)'}`, transition: 'background-color 0.15s, border-color 0.15s' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleInstall(n.serial)} style={{ accentColor: '#00C853', width: 14, height: 14 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{n.nome}</span>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{n.serial}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>✕ {diff.cancelamentos.length} clientes cancelados no SGP</p>
                  {diff.cancelamentos.length > 0 && <button style={{ ...btnOutline, fontSize: 11, padding: '4px 10px' }} onClick={() => setSelectedCancels(diff.cancelamentos.map(c => c.serial))}>Todos</button>}
                </div>
                {diff.cancelamentos.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum cancelamento.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {diff.cancelamentos.map(c => {
                      const checked = selectedCancels.includes(c.serial)
                      return (
                        <label key={c.serial} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', backgroundColor: checked ? '#3d0a0aaa' : 'var(--inp-bg)', border: `1px solid ${checked ? '#7f1d1d' : 'var(--border-color)'}`, transition: 'background-color 0.15s, border-color 0.15s' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleCancel(c.serial)} style={{ accentColor: '#FF3D00', width: 14, height: 14 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{c.nome}</span>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{c.serial}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
              {(selectedInstalls.length > 0 || selectedCancels.length > 0) && (
                <button style={{ ...btn('#16a34a'), display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', opacity: applying ? 0.8 : 1 }} onClick={handleApply} disabled={applying}>
                  {applying && <Spinner />}{applying ? 'Aplicando...' : `Aplicar ${selectedInstalls.length + selectedCancels.length} selecionados`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ProvisionModal ────────────────────────────────────────────────────────────

function ProvisionModal({ item, onConfirm, onCancel, loading }) {
  const [cliente,     setCliente]     = useState(item?.serial ?? '')
  const [vlan,        setVlan]        = useState('100')
  const [ponData,     setPonData]     = useState(null)
  const [ctoOverride, setCtoOverride] = useState('')

  useEffect(() => {
    if (!item?.olt_id || !item?.pon) { setPonData(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const { getCtoSuggestionsForPon } = await import('@/actions/pon-cto-map')
        const res = await getCtoSuggestionsForPon({ olt_id: item.olt_id, pon: item.pon })
        if (!cancelled) setPonData(res)
      } catch { if (!cancelled) setPonData(false) }
    })()
    return () => { cancelled = true }
  }, [item?.olt_id, item?.pon])

  if (!item) return null
  const hasSuggestions = ponData?.mapped && ponData.suggestions?.length > 0
  const autoCto        = ponData?.selected_cto ?? null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Provisionar ONU</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Detectada via Auto-Find (PON piscando)</p>
          </div>
          <button onClick={onCancel} style={{ ...btnOutline, padding: '4px 10px', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['SERIAL', <span key="s" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.serial}</span>], ['OLT', `${item.olt_nome ?? '—'} ${item.olt_ip ? `(${item.olt_ip})` : ''}`], ['PLACA / PON', <span key="p" style={{ fontFamily: 'monospace' }}>{item.board ?? '—'} / {item.pon ?? '—'}</span>]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: 12, color: 'var(--foreground)', textAlign: 'right' }}>{v}</span>
            </div>
          ))}
          {item.mock && <span style={{ fontSize: 10, color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4, alignSelf: 'flex-start' }}>MODO MOCK</span>}
        </div>
        <div>
          <label style={{ ...lbl, marginBottom: 6 }}>MAPEAMENTO PON → CTO</label>
          {ponData === null && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}><Spinner /> Verificando mapeamento PON...</div>}
          {ponData === false && <div style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Sem mapeamento PON configurado — será usada a primeira CTO disponível.</div>}
          {hasSuggestions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {autoCto && (
                <div style={{ backgroundColor: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                  <span style={{ color: '#00C853', fontWeight: 700 }}>✓ Auto-assign:</span>{' '}
                  <span style={{ color: 'var(--foreground)' }}>CTO <strong>{autoCto.nome}</strong> ({autoCto.livres} porta{autoCto.livres !== 1 ? 's' : ''} livre{autoCto.livres !== 1 ? 's' : ''})</span>
                </div>
              )}
              <select style={{ ...inp, width: '100%' }} value={ctoOverride} onChange={e => setCtoOverride(e.target.value)} disabled={loading}>
                <option value="">— Auto (recomendado: {autoCto?.nome ?? 'primeira disponível'}) —</option>
                {ponData.suggestions.filter(s => s.available).map(s => <option key={s.cto_id} value={s.cto_id}>{s.nome} (posição {s.ordem}, {s.livres} livres)</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <label style={lbl}>NOME DO CLIENTE</label>
          <input style={inp} value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Ex: João Silva" disabled={loading} />
        </div>
        <div>
          <label style={lbl}>VLAN</label>
          <input style={{ ...inp, width: 120 }} type="number" value={vlan} onChange={e => setVlan(e.target.value)} min={1} max={4094} disabled={loading} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnOutline} disabled={loading}>Cancelar</button>
          <button onClick={() => onConfirm({ cliente: cliente.trim() || item.serial, vlan: Number(vlan) || 100, ctoOverride: ctoOverride || null })} style={{ ...btn('#16a34a'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: loading ? 0.8 : 1 }} disabled={loading}>
            {loading && <Spinner />}{loading ? 'Provisionando...' : 'Confirmar e Provisionar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SignalReportModal ─────────────────────────────────────────────────────────

function SignalReportModal({ result, onClose }) {
  if (!result) return null
  const sig = analyzeSignal(result.rx_power, result.tx_power)
  const statusColor = sig.statusGeral === 'OK' ? '#00C853' : sig.statusGeral === 'ATENÇÃO' ? '#FFD600' : '#FF3D00'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block', boxShadow: `0 0 8px ${statusColor}` }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Relatório Técnico — ONU Provisionada</p>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Padrão UNM — FiberOps NOC</p>
          </div>
          <button onClick={onClose} style={{ ...btnOutline, padding: '4px 10px', fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          {[['SERIAL', result.serial], ['CLIENTE', result.cliente], ['OLT', result.olt_ip ?? '—'], ['PLACA', result.board ?? '—'], ['PON', result.pon ?? '—'], ['CTO', result.cto_id ?? '—']].map(([k, v]) => (
            <div key={k}><span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>{k}</span><span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--foreground)', fontWeight: 600 }}>{v}</span></div>
          ))}
        </div>
        <div>
          <p style={{ ...lbl, marginBottom: 8 }}>Sinal Óptico</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'RX — CHEGADA (ONU)', val: result.rx_power, color: SIG_COLOR[sig.rxClass], q: sig.rxQuality },
              { label: 'TX — RETORNO (OLT)', val: result.tx_power, color: SIG_COLOR[sig.txClass], q: sig.txStatus },
            ].map(({ label, val, color, q }) => (
              <div key={label} style={{ border: `1px solid ${color}40`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '10px 14px', backgroundColor: color + '0d' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color, margin: '0 0 2px', fontFamily: 'monospace' }}>{val != null ? `${val.toFixed(2)}` : 'N/D'}<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{val != null ? 'dBm' : ''}</span></p>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{q}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderRadius: 8, padding: '10px 14px', backgroundColor: statusColor + '15', border: `1px solid ${statusColor}40`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{sig.statusGeral === 'OK' ? '✅' : sig.statusGeral === 'ATENÇÃO' ? '⚠️' : '🚨'}</span>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: statusColor, margin: 0 }}>Status Geral: {sig.statusGeral}</p>
            {sig.diags.length === 0 ? <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Sem alertas — operação normal</p> : sig.diags.map((d, i) => <p key={i} style={{ fontSize: 11, color: statusColor, margin: '2px 0 0' }}>• {d}</p>)}
          </div>
        </div>
        {result.report && (
          <div>
            <p style={{ ...lbl, marginBottom: 6 }}>Relatório Completo (UNM)</p>
            <pre style={{ backgroundColor: '#0f172a', color: '#94a3b8', border: '1px solid #1e293b', borderRadius: 8, padding: '12px 14px', fontSize: 11, lineHeight: 1.7, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'monospace' }}>{result.report}</pre>
          </div>
        )}
        {result.mock && <p style={{ fontSize: 10, color: '#f59e0b', margin: 0 }}>⚠ Dados simulados — OLT em modo mock.</p>}
        <button onClick={onClose} style={{ ...btn('#2D8CFF'), alignSelf: 'flex-end' }}>Fechar</button>
      </div>
    </div>
  )
}

// ─── AutoFindTab ──────────────────────────────────────────────────────────────

function AutoFindTab({ olts, onLog }) {
  const [running,      setRunning]      = useState(false)
  const [autoRefresh,  setAutoRefresh]  = useState(false)
  const [detected,     setDetected]     = useState(null)
  const [feedback,     setFeedback]     = useState(null)
  const [modalItem,    setModalItem]    = useState(null)
  const [provLoading,  setProvLoading]  = useState(false)
  const [reportResult, setReportResult] = useState(null)
  const autoRefreshRef = useRef(null)

  function showFeedback(type, message) { setFeedback({ type, message }); setTimeout(() => setFeedback(null), 6000) }

  const doScan = useCallback(async (quiet = false) => {
    if (!quiet) { setRunning(true); setDetected(null); onLog('AUTO-FIND', 'Escaneando OLTs em busca de ONUs (PON piscando)...', 'info') }
    try {
      const { autoFindONUs } = await import('@/actions/provisioning')
      const result = await autoFindONUs()
      setDetected(result)
      if (!quiet) {
        if (result.length === 0) { onLog('AUTO-FIND', 'Nenhuma ONU nova detectada', 'info'); showFeedback('success', 'Nenhuma ONU nova detectada nas OLTs.') }
        else onLog('AUTO-FIND', `${result.length} ONU(s) detectada(s) (PON piscando)`, 'warn')
      } else if (result.length > 0) onLog('AUTO-FIND', `[Auto-Refresh] ${result.length} ONU(s) detectada(s)`, 'info')
    } catch (e) { if (!quiet) { onLog('AUTO-FIND', e.message, 'error'); showFeedback('error', e.message) } }
    finally { if (!quiet) setRunning(false) }
  }, [onLog])

  useEffect(() => {
    if (autoRefresh) { autoRefreshRef.current = setInterval(() => doScan(true), 30_000) }
    else clearInterval(autoRefreshRef.current)
    return () => clearInterval(autoRefreshRef.current)
  }, [autoRefresh, doScan])

  async function handleProvisionConfirm({ cliente, vlan, ctoOverride }) {
    if (!modalItem) return
    const item = modalItem; setProvLoading(true)
    onLog('AUTO-FIND', `Iniciando provisionamento 1-click: ${item.serial}`, 'info')
    try {
      const { quickProvisionAutoFound } = await import('@/actions/provisioning')
      const result = await quickProvisionAutoFound({ serial: item.serial, olt_id: item.olt_id, olt_ip: item.olt_ip, pon: item.pon, pon_port: item.pon_port, board: item.board, slot: item.slot, cliente, vlan, ctoIdOverride: ctoOverride ?? null })
      if (result.success) {
        onLog('PROVISION', `${item.serial} → ${result.cliente} provisionada`, 'success')
        setDetected(prev => (prev ?? []).filter(d => d.serial !== item.serial))
        setModalItem(null); setReportResult(result)
      } else { onLog('PROVISION', result.error ?? 'Falha', 'error'); showFeedback('error', result.error ?? 'Falha no provisionamento'); setModalItem(null) }
    } catch (e) { onLog('PROVISION', e.message, 'error'); showFeedback('error', e.message); setModalItem(null) }
    finally { setProvLoading(false) }
  }

  async function handleProvisionAll() {
    if (!detected?.length) return
    for (const item of detected) {
      setModalItem(null); onLog('AUTO-FIND', `Provisionando em lote: ${item.serial}`, 'info')
      try {
        const { quickProvisionAutoFound } = await import('@/actions/provisioning')
        const result = await quickProvisionAutoFound({ serial: item.serial, olt_id: item.olt_id, olt_ip: item.olt_ip, pon: item.pon, pon_port: item.pon_port, board: item.board, slot: item.slot, cliente: item.serial, vlan: 100 })
        if (result.success) { onLog('PROVISION', `${item.serial} provisionada (lote)`, 'success'); setDetected(prev => (prev ?? []).filter(d => d.serial !== item.serial)) }
      } catch (e) { onLog('PROVISION', `${item.serial}: ${e.message}`, 'error') }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ProvisionModal item={modalItem} loading={provLoading} onConfirm={handleProvisionConfirm} onCancel={() => setModalItem(null)} />
      <SignalReportModal result={reportResult} onClose={() => setReportResult(null)} />
      <FeedbackBanner feedback={feedback} />
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <SectionTitle>ONUs Detectadas — PON Piscando</SectionTitle>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -10, marginBottom: 0 }}>Executa <span style={{ fontFamily: 'monospace', color: 'var(--foreground)' }}>display ont autofind all</span> em cada OLT ativa.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={{ ...btnOutline, fontSize: 12, color: autoRefresh ? '#2D8CFF' : 'var(--text-muted)', borderColor: autoRefresh ? '#2D8CFF' : 'var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setAutoRefresh(v => !v)}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: autoRefresh ? '#00C853' : 'var(--text-muted)', display: 'inline-block', ...(autoRefresh ? { boxShadow: '0 0 6px #00C853', animation: 'noc-pulse 1.5s infinite' } : {}) }} />
              {autoRefresh ? 'Auto 30s' : 'Auto-Refresh'}
            </button>
            <button style={{ ...btn(running ? '#475569' : '#2D8CFF'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: running ? 0.8 : 1 }} onClick={() => doScan(false)} disabled={running}>
              {running && <Spinner />}{running ? 'Escaneando...' : 'Executar Auto-Find'}
            </button>
          </div>
        </div>
        {olts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {olts.map(olt => (
              <span key={olt.id ?? olt._id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, fontSize: 11, backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#00C853', display: 'inline-block' }} />
                {olt.nome}{olt.ip ? ` (${olt.ip})` : ''}
              </span>
            ))}
          </div>
        )}
        {detected === null && !running && (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>📡</p>
            <p>Clique em <strong>Executar Auto-Find</strong> para escanear as OLTs.</p>
          </div>
        )}
        {detected !== null && detected.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#00C853', fontSize: 13 }}>
            <p style={{ fontSize: 28, marginBottom: 6 }}>✓</p><p>Nenhuma ONU nova detectada — todas já estão provisionadas.</p>
          </div>
        )}
        {detected !== null && detected.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block', animation: 'noc-pulse 1s infinite' }} />
                {detected.length} ONU{detected.length > 1 ? 's' : ''} aguardando provisionamento
              </span>
              <button style={{ ...btn('#475569'), fontSize: 11, padding: '5px 12px' }} onClick={handleProvisionAll}>Provisionar Todas (serial como nome)</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><TH>Serial</TH><TH>Placa</TH><TH>PON</TH><TH>OLT</TH><TH>IP OLT</TH><TH></TH></tr></thead>
                <tbody>
                  {detected.map((item, i) => (
                    <tr key={item.serial ?? i}>
                      <TD mono bold>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block', boxShadow: '0 0 6px #f59e0b', flexShrink: 0 }} />
                          {item.serial}
                        </div>
                        {item.mock && <span style={{ fontSize: 10, color: '#f59e0b' }}>(mock)</span>}
                      </TD>
                      <TD mono muted>{item.board ?? '—'}</TD>
                      <TD mono muted>{item.pon ?? '—'}</TD>
                      <TD muted>{item.olt_nome ?? item.olt_id ?? '—'}</TD>
                      <TD mono muted>{item.olt_ip ?? '—'}</TD>
                      <TD><button style={{ ...btn('#2D8CFF'), fontSize: 12, padding: '5px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setModalItem(item)}>Provisionar</button></TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div style={{ ...card, padding: '14px 16px' }}>
        <p style={{ ...lbl, marginBottom: 10 }}>Análise de Sinal Óptico — Referência UNM</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>RX — Potência de Chegada (ONU)</p>
            {[['> -20 dBm','EXCELENTE','#00C853'],['-20 a -25 dBm','BOM','#4ade80'],['-25 a -28 dBm','LIMITE','#FFD600'],['< -28 dBm','CRÍTICO','#FF3D00']].map(([range, label, color]) => (
              <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', flex: 1 }}>{range}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>TX — Potência de Retorno (OLT)</p>
            {[['1 a 5 dBm','OK','#00C853'],['> 5 dBm','MUITO ALTO','#FF3D00'],['< 1 dBm','BAIXO','#FFD600']].map(([range, label, color]) => (
              <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', flex: 1 }}>{range}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <PonMapSection olts={olts} />
    </div>
  )
}

// ─── PonMapSection ────────────────────────────────────────────────────────────

function PonMapSection({ olts }) {
  const [expanded,   setExpanded]   = useState(false)
  const [maps,       setMaps]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [feedback,   setFeedback]   = useState(null)
  const [editOltId,  setEditOltId]  = useState('')
  const [editPon,    setEditPon]    = useState('')
  const [editCtoIds, setEditCtoIds] = useState('')
  const [saving,     setSaving]     = useState(false)

  function showFeedback(type, msg) { setFeedback({ type, msg }); setTimeout(() => setFeedback(null), 5000) }

  async function loadMaps() {
    setLoading(true)
    try { const { getPonCtoMaps } = await import('@/actions/pon-cto-map'); setMaps(await getPonCtoMaps()) }
    catch (e) { showFeedback('error', e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (expanded && maps === null) loadMaps() }, [expanded])

  async function handleSave() {
    if (!editOltId.trim() || !editPon.trim() || !editCtoIds.trim()) { showFeedback('error', 'OLT, PON e pelo menos uma CTO são obrigatórios'); return }
    const ctoParsed = editCtoIds.split(',').map((s, i) => ({ cto_id: s.trim(), ordem: i })).filter(c => c.cto_id)
    if (!ctoParsed.length) { showFeedback('error', 'Insira ao menos uma CTO'); return }
    setSaving(true)
    try {
      const { savePonCtoMap } = await import('@/actions/pon-cto-map')
      await savePonCtoMap({ olt_id: editOltId.trim(), pon: editPon.trim(), ctos: ctoParsed })
      setEditOltId(''); setEditPon(''); setEditCtoIds('')
      showFeedback('success', `Mapeamento PON ${editPon.trim()} salvo`); await loadMaps()
    } catch (e) { showFeedback('error', e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(olt_id, pon) {
    if (!window.confirm(`Excluir mapeamento PON ${pon}?`)) return
    try { const { deletePonCtoMap } = await import('@/actions/pon-cto-map'); await deletePonCtoMap({ olt_id, pon }); showFeedback('success', `Mapeamento ${pon} removido`); await loadMaps() }
    catch (e) { showFeedback('error', e.message) }
  }

  function startEdit(map) { setEditOltId(map.olt_id); setEditPon(map.pon); setEditCtoIds(map.ctos.map(c => c.cto_id).join(', ')) }

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <button onClick={() => setExpanded(v => !v)} style={{ width: '100%', padding: '12px 16px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Mapeamento PON → CTO</span>
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, backgroundColor: 'rgba(45,140,255,0.12)', color: '#2D8CFF', fontWeight: 700 }}>Vinculação Automática</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, lineHeight: 1.5 }}>Configure quais CTOs pertencem a cada PON da OLT (na ordem da fibra, da mais próxima à mais distante).</p>
          {feedback && <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, backgroundColor: feedback.type === 'error' ? 'rgba(255,61,0,0.1)' : 'rgba(0,200,83,0.1)', color: feedback.type === 'error' ? '#FF3D00' : '#00C853', border: `1px solid ${feedback.type === 'error' ? 'rgba(255,61,0,0.3)' : 'rgba(0,200,83,0.3)'}` }}>{feedback.msg}</div>}
          <div style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Adicionar / Atualizar Mapeamento</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>OLT</label>
                <select style={inp} value={editOltId} onChange={e => setEditOltId(e.target.value)} disabled={saving}>
                  <option value="">Selecione a OLT</option>
                  {olts.map(o => <option key={o.id ?? o._id} value={o.id ?? o._id}>{o.nome} {o.ip ? `(${o.ip})` : ''}</option>)}
                </select>
              </div>
              <div><label style={lbl}>PON (ex: 0/1/0)</label><input style={inp} value={editPon} onChange={e => setEditPon(e.target.value)} placeholder="0/1/0" disabled={saving} /></div>
            </div>
            <div>
              <label style={lbl}>CTOs (IDs separados por vírgula, em ordem de distância)</label>
              <input style={inp} value={editCtoIds} onChange={e => setEditCtoIds(e.target.value)} placeholder="CTO-01, CTO-02, CTO-03" disabled={saving} />
            </div>
            <button style={{ ...btn('#2D8CFF'), alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
              {saving && <Spinner />}{saving ? 'Salvando...' : 'Salvar Mapeamento'}
            </button>
          </div>
          {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}><Spinner /> Carregando mapeamentos...</div>}
          {!loading && maps !== null && maps.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Nenhum mapeamento cadastrado.</p>}
          {!loading && maps !== null && maps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ ...lbl, marginBottom: 4 }}>MAPEAMENTOS CADASTRADOS</p>
              {maps.map(m => {
                const olt = olts.find(o => (o.id ?? o._id) === m.olt_id)
                return (
                  <div key={m._id} style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{olt?.nome ?? m.olt_id}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2D8CFF' }}>PON {m.pon}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {m.ctos.map((c, idx) => (
                          <span key={c.cto_id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, backgroundColor: c.livres > 0 ? 'rgba(0,200,83,0.1)' : 'rgba(255,61,0,0.1)', color: c.livres > 0 ? '#00C853' : '#FF3D00', border: `1px solid ${c.livres > 0 ? 'rgba(0,200,83,0.3)' : 'rgba(255,61,0,0.3)'}` }}>
                            {idx + 1}. {c.nome} ({c.livres} livre{c.livres !== 1 ? 's' : ''})
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => startEdit(m)} style={{ ...btnOutline, padding: '4px 10px', fontSize: 11 }}>Editar</button>
                      <button onClick={() => handleDelete(m.olt_id, m.pon)} style={{ ...btn('#ef4444'), padding: '4px 10px', fontSize: 11 }}>✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── LOG TERMINAL ─────────────────────────────────────────────────────────────

function LogTerminal({ logs }) {
  const endRef = useRef(null)
  const [tagFilter,    setTagFilter]    = useState('TODOS')
  const [levelFilter,  setLevelFilter]  = useState('todos')
  const [paused,       setPaused]       = useState(false)
  const [userScrolled, setUserScrolled] = useState(false)

  useEffect(() => {
    if (!paused && !userScrolled) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, paused, userScrolled])

  const TAG_OPTIONS = ['TODOS','PROVISION','OLT','CTO','SGP','AUTO-FIND','POWER','SYNC','QUEUE','TEST','ANALYSIS','MONITOR']

  const filtered = logs.filter(e => {
    if (tagFilter !== 'TODOS' && (e.tag ?? '').toUpperCase() !== tagFilter) return false
    if (levelFilter === 'warn'  && !['warn', 'error'].includes(e.nivel))    return false
    if (levelFilter === 'error' && e.nivel !== 'error')                     return false
    return true
  })

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderBottom: 'none', borderRadius: '8px 8px 0 0', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          {TAG_OPTIONS.map(tag => {
            const active = tagFilter === tag
            return (
              <button key={tag} onClick={() => setTagFilter(tag)} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, cursor: 'pointer', border: 'none', letterSpacing: '0.06em', backgroundColor: active ? '#2D8CFF' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', outline: active ? 'none' : '1px solid var(--border-color)' }}>
                {tag}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', outline: 'none' }}>
            <option value="todos">Todos niveis</option>
            <option value="warn">Warn+</option>
            <option value="error">Apenas Erros</option>
          </select>
          <button onClick={() => { setPaused(p => !p); setUserScrolled(false) }} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: paused ? '#f59e0b' : 'var(--text-muted)' }}>
            {paused ? '▶ Retomar' : '⏸ Pausar'}
          </button>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{filtered.length}/{logs.length}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', backgroundColor: '#0d1117', border: '1px solid #1e3a20', borderTop: '1px solid #1e3a20', borderBottom: 'none' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', fontFamily: 'monospace' }}>LOG EM TEMPO REAL</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: paused ? '#f59e0b' : '#4ade80', animation: paused ? 'none' : 'noc-blink 1.2s step-start infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: paused ? '#f59e0b' : '#4ade80', fontWeight: 700, letterSpacing: '0.12em' }}>{paused ? 'PAUSADO' : 'AO VIVO'}</span>
        </span>
      </div>
      <div
        style={{ backgroundColor: '#0a0e1a', border: '1px solid #1e3a20', borderRadius: '0 0 8px 8px', height: 220, overflowY: 'auto', padding: '8px 14px', fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 1 }}
        onScroll={e => { const el = e.currentTarget; setUserScrolled(el.scrollHeight - el.scrollTop - el.clientHeight >= 20) }}
      >
        {filtered.length === 0 && <span style={{ color: '#4ade8055', fontSize: 11 }}>Aguardando eventos...</span>}
        {filtered.map((entry, i) => {
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
  const [view,             setView]             = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [logs,             setLogs]             = useState([])
  const [ackedAlerts,      setAckedAlerts]      = useState(new Set())
  const [lastUpdate]                            = useState(() => new Date())
  const [now,              setNow]              = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Collapse sidebar on small screens
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarCollapsed(true)
  }, [])

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
      id: String(Date.now()), ts: new Date().toISOString(),
      tag: tag.toUpperCase(), message, nivel,
    }])
  }, [])

  function handleAck(key) { setAckedAlerts(prev => new Set([...prev, key])) }

  return (
    <div style={{ display: 'flex', minHeight: '80vh' }}>
      <style>{`
        @keyframes noc-spin  { to { transform: rotate(360deg); } }
        @keyframes noc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes noc-pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 currentColor; } 50% { opacity: 0.85; box-shadow: 0 0 6px 2px currentColor; } }
      `}</style>

      <Sidebar
        view={view}
        onNavigate={setView}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        alertCount={alertas.filter(a => !ackedAlerts.has(`${a.tipo}-${a.serial ?? a.cto_id}`)).length}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', minWidth: 0 }}>
        <StatusBar alertas={alertas.filter(a => !ackedAlerts.has(`${a.tipo}-${a.serial ?? a.cto_id}`))} now={now} lastUpdate={lastUpdate} userRole={userRole} />

        {view === 'dashboard'   && <DashboardView stats={stats} ackedAlerts={ackedAlerts} onAck={handleAck} />}
        {view === 'onus'        && <ClientesTab onus={onus} olts={olts} onLog={addLog} />}
        {view === 'olts'        && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <OLTsPanel olts={olts} onus={onus} />
            <TopologiaTab ctos={ctos} olts={olts} />
          </div>
        )}
        {view === 'alertas'     && <AlertsPanel alertas={alertas} ackedAlerts={ackedAlerts} onAck={handleAck} onTestOnu={serial => { addLog('TEST', `Abrindo diagnóstico: ${serial}`, 'info') }} />}
        {view === 'diagnostico' && <DiagnosticPanel onus={onus} onLog={addLog} />}
        {view === 'logs'        && (
          <div style={card}>
            <SectionTitle>Logs ao Vivo</SectionTitle>
            <LogTerminal logs={logs} />
          </div>
        )}
        {view === 'sgp'         && <SGPTab sgpStatus={sgpStatus} onLog={addLog} />}
        {view === 'autofind'    && <AutoFindTab olts={olts} onLog={addLog} />}
        {view === 'olt-mgmt'    && <OltMgmtTab olts={olts} onLog={addLog} />}

        {/* Log terminal always visible except on logs view */}
        {view !== 'logs' && <LogTerminal logs={logs} />}
      </div>

      <QuickActionsFAB onNavigate={setView} />
    </div>
  )
}
