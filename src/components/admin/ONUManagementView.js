'use client'

/**
 * ONUManagementView — NOC-grade ONU management dashboard.
 * Drop-in replacement for ClientesTab.
 * Props: onus[], olts[], onLog(tag, msg, level), userRole
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

function useIsMobile(bp = 768) {
  const [m, setM] = useState(false)
  useEffect(() => {
    function check() { setM(window.innerWidth <= bp) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [bp])
  return m
}

// ─── Theme constants ───────────────────────────────────────────────────────────

const C = {
  accent: '#2D8CFF',
  green:  '#00C853',
  yellow: '#FFD600',
  red:    '#FF3D00',
  orange: '#FF6D00',
  purple: '#9333EA',
  muted:  '#6B7280',
  text:   '#E2E8F0',
}

const card = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: 12,
  padding: 16,
}

const cardCompact = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: 10,
  padding: '12px 14px',
}

const btn = (color = '#2D8CFF') => ({
  backgroundColor: color,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
  whiteSpace: 'nowrap',
})

const btnSm = (color = '#2D8CFF') => ({
  ...btn(color),
  padding: '3px 8px',
  fontSize: 11,
  borderRadius: 4,
})

const inp = {
  backgroundColor: 'var(--inp-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--foreground)',
  borderRadius: 8,
  padding: '7px 12px',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const lbl = {
  fontSize: 10,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  fontWeight: 700,
  display: 'block',
  marginBottom: 4,
}

// ─── classifyFailure ──────────────────────────────────────────────────────────

export function classifyFailure(onu) {
  const off = onu.status === 'offline' || onu.status === 'error'
  const rx  = onu.rx_power

  if (off) {
    if (rx == null)
      return { type: 'energy',    badge: 'ENERGIA',    color: C.orange, icon: '⚡', desc: 'ONU desligada / sem energia' }
    if (rx < -30)
      return { type: 'fiber',     badge: 'FIBRA',      color: C.red,    icon: '●', desc: 'Fibra rompida ou desconectada' }
    return   { type: 'offline',   badge: 'OFFLINE',    color: C.red,    icon: '●', desc: 'ONU offline — causa indeterminada' }
  }

  if (rx != null) {
    if (rx < -28)
      return { type: 'atten', badge: 'ATENUAÇÃO', color: C.yellow, icon: '▲', desc: 'Sinal crítico — alta atenuação (RX < -28 dBm)' }
    if (rx < -25)
      return { type: 'atten', badge: 'ATENUAÇÃO', color: C.yellow, icon: '▲', desc: 'Atenuação elevada — verificar CTO/fusão' }
  }

  if (onu.tx_power != null && onu.tx_power > 5)
    return { type: 'saturation', badge: 'SATURAÇÃO', color: C.orange, icon: '⚡', desc: 'Saturação de transmissão — verificar transceptor' }

  if (onu.status === 'active')
    return { type: 'ok', badge: null, color: C.green, icon: null, desc: 'Funcionamento normal' }

  return { type: 'unknown', badge: null, color: C.muted, icon: null, desc: '—' }
}

// ─── detectMassEvents ─────────────────────────────────────────────────────────

function detectMassEvents(onus, threshold = 3) {
  const groups = {}
  for (const o of onus) {
    if (o.status !== 'offline') continue
    const olt = o.olt_id ?? 'N/A'
    const pon = o.pon ?? (o.pon_port != null ? String(o.pon_port) : 'N/A')
    const key = `${olt}|${pon}`
    if (!groups[key]) groups[key] = { olt, pon, count: 0, serials: [] }
    groups[key].count++
    groups[key].serials.push(o.serial)
  }
  return Object.values(groups)
    .filter(g => g.count >= threshold)
    .sort((a, b) => b.count - a.count)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function offlineDuration(onu, now) {
  if (onu.status !== 'offline' && onu.status !== 'error') return null
  const ts = onu.updatedAt ?? onu.last_tested_at ?? onu.createdAt
  if (!ts) return null
  const ms = now - new Date(ts).getTime()
  if (ms < 0) return null
  const mins = Math.floor(ms / 60000)
  if (mins < 1)  return '< 1m'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

function getRootCauses(onus) {
  const counts = {}
  for (const o of onus) {
    const c = classifyFailure(o)
    counts[c.type] = (counts[c.type] || 0) + 1
  }
  return [
    { label: 'Sem energia',   type: 'energy',     count: counts.energy     ?? 0, color: C.orange },
    { label: 'Fibra rompida', type: 'fiber',       count: counts.fiber      ?? 0, color: C.red },
    { label: 'Atenuação',     type: 'atten',       count: counts.atten      ?? 0, color: C.yellow },
    { label: 'Saturação',     type: 'saturation',  count: counts.saturation ?? 0, color: C.purple },
    { label: 'Operacional',   type: 'ok',          count: counts.ok         ?? 0, color: C.green },
    { label: 'Desconhecido',  type: 'unknown',     count: counts.unknown    ?? 0, color: '#4B5563' },
  ].filter(d => d.count > 0)
}

function genTrend(baseOffline, points = 24) {
  const arr = []
  for (let i = 0; i < points; i++) {
    const noise = (Math.random() - 0.5) * baseOffline * 0.4
    const wave  = Math.sin(i * 0.4) * baseOffline * 0.2
    arr.push(Math.max(0, Math.round(baseOffline + wave + noise)))
  }
  arr[arr.length - 1] = baseOffline
  return arr
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

function DonutChart({ data, size = 140 }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: C.muted }}>Sem dados</span>
      </div>
    )
  }

  const cx = size / 2
  const cy = size / 2
  const R  = size * 0.40
  const r  = size * 0.26
  const gap = 0.03

  let cumAngle = -Math.PI / 2
  const slices = data.map(d => {
    const sweep = (d.count / total) * (2 * Math.PI) - gap
    const start = cumAngle + gap / 2
    cumAngle += (d.count / total) * (2 * Math.PI)
    const end = start + sweep

    const x1 = cx + R * Math.cos(start);  const y1 = cy + R * Math.sin(start)
    const x2 = cx + R * Math.cos(end);    const y2 = cy + R * Math.sin(end)
    const ix1 = cx + r * Math.cos(start); const iy1 = cy + r * Math.sin(start)
    const ix2 = cx + r * Math.cos(end);   const iy2 = cy + r * Math.sin(end)
    const large = sweep > Math.PI ? 1 : 0

    return {
      ...d,
      path: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`,
    }
  })

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="var(--card-bg)" strokeWidth={1.5} opacity={0.92} />
      ))}
      <text x={cx} y={cy - 7} textAnchor="middle" fill={C.text} fontSize={size * 0.16} fontWeight="700">{total}</text>
      <text x={cx} y={cy + size * 0.11} textAnchor="middle" fill={C.muted} fontSize={size * 0.09} fontWeight="600">ONUs</text>
    </svg>
  )
}

// ─── SVG Trend Line Chart ─────────────────────────────────────────────────────

function TrendChart({ data, width = 320, height = 80, color = C.red }) {
  if (!data || data.length < 2) return null

  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (v / max) * (height - 10) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const polyline = pts.join(' ')
  const first = pts[0].split(',')
  const last  = pts[pts.length - 1].split(',')
  const area  = `M ${first[0]},${height} L ${polyline.split(' ').join(' L ')} L ${last[0]},${height} Z`

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#trendGrad)" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color = C.text, glow, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...cardCompact,
        flex: 1,
        minWidth: 110,
        cursor: onClick ? 'pointer' : 'default',
        borderColor: active ? color + '55' : 'var(--border-color)',
        boxShadow: glow ? `0 0 12px ${color}22` : undefined,
        transition: 'border-color 0.15s',
        userSelect: 'none',
      }}
    >
      <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color, margin: 0, lineHeight: 1.1 }}>{value ?? '—'}</p>
      {sub && <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0', fontWeight: 500 }}>{sub}</p>}
    </div>
  )
}

// ─── Failure Badge ────────────────────────────────────────────────────────────

function FailureBadge({ onu }) {
  const cls = classifyFailure(onu)
  if (!cls.badge) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 4,
      backgroundColor: cls.color + '18',
      border: `1px solid ${cls.color}44`,
      color: cls.color, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    }}>
      {cls.icon && <span style={{ fontSize: 9 }}>{cls.icon}</span>}
      {cls.badge}
    </span>
  )
}

// ─── Signal cell ──────────────────────────────────────────────────────────────

function RxCell({ rx }) {
  if (rx == null) return <span style={{ color: C.muted, fontSize: 12 }}>—</span>
  const color = rx > -20 ? C.green : rx >= -25 ? '#4ade80' : rx >= -28 ? C.yellow : C.red
  return <span style={{ color, fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{rx.toFixed(1)}</span>
}

// ─── Mass Event Banner ────────────────────────────────────────────────────────

function MassEventBanner({ events, olts }) {
  if (!events.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {events.map((ev, i) => {
        const oltName = olts.find(o => o.id === ev.olt)?.nome ?? ev.olt
        const isOutage = ev.count >= 10
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 8,
            backgroundColor: isOutage ? 'rgba(255,61,0,0.08)' : 'rgba(255,214,0,0.06)',
            border: `1px solid ${isOutage ? 'rgba(255,61,0,0.35)' : 'rgba(255,214,0,0.3)'}`,
          }}>
            <span style={{
              padding: '2px 6px', borderRadius: 3, fontSize: 9, fontWeight: 800,
              letterSpacing: '0.08em',
              backgroundColor: isOutage ? C.red : C.yellow,
              color: isOutage ? '#fff' : '#000',
            }}>
              {isOutage ? 'OUTAGE' : 'DEGRADAÇÃO'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{oltName}</span>
            <span style={{ fontSize: 11, color: C.muted }}>PON {ev.pon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: isOutage ? C.red : C.yellow, marginLeft: 'auto' }}>
              {ev.count} afetados
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── ONU Detail Drawer ────────────────────────────────────────────────────────

function ONUDrawer({ onu, olts, now, onClose, onTest, onLog }) {
  const [testing, setTesting] = useState(false)
  const [rebooting, setRebooting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const cls   = classifyFailure(onu)
  const dur   = offlineDuration(onu, now)
  const olt   = olts.find(o => o.id === onu.olt_id)
  const rxColor = onu.rx_power == null ? C.muted
    : onu.rx_power > -20 ? C.green
    : onu.rx_power >= -25 ? '#4ade80'
    : onu.rx_power >= -28 ? C.yellow : C.red

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const { testOnuConnection } = await import('@/actions/provisioning')
      const res = await testOnuConnection(onu.serial)
      setTestResult(res)
      onLog('ONU', `Diagnóstico ${onu.serial}: ${res.problema ?? 'OK'}`, res.nivel === 'ok' ? 'success' : 'warn')
    } catch (e) {
      setTestResult({ problema: e.message, nivel: 'error' })
      onLog('ONU', `Erro ao testar ${onu.serial}: ${e.message}`, 'error')
    } finally { setTesting(false) }
  }

  async function handleReboot() {
    if (!confirm(`Reiniciar ONU ${onu.serial}?`)) return
    setRebooting(true)
    try {
      const { rebootOnu } = await import('@/actions/olt-management')
      if (rebootOnu) {
        await rebootOnu(onu._id)
        onLog('ONU', `Reinicialização enviada: ${onu.serial}`, 'info')
      }
    } catch (e) {
      onLog('ONU', `Erro ao reiniciar ${onu.serial}: ${e.message}`, 'error')
    } finally { setRebooting(false) }
  }

  const statusColor = onu.status === 'active' ? C.green : onu.status === 'offline' ? C.red : C.yellow

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 1000,
        width: 380, maxWidth: '95vw',
        backgroundColor: 'var(--card-bg)',
        borderLeft: '1px solid var(--border-color)',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
        animation: 'nocDrawerIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(45,140,255,0.08), transparent)',
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0 }}>{onu.serial}</p>
            <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{onu.cliente ?? 'Cliente não identificado'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              backgroundColor: statusColor + '20', border: `1px solid ${statusColor}50`,
              color: statusColor,
            }}>
              {onu.status === 'active' ? 'Online' : onu.status === 'offline' ? 'Offline' : onu.status}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Causa provável */}
          {cls.badge && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              backgroundColor: cls.color + '10',
              border: `1px solid ${cls.color}30`,
            }}>
              <p style={{ ...lbl, marginBottom: 4 }}>Causa provável</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{cls.icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: cls.color, margin: 0 }}>{cls.badge}</p>
                  <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{cls.desc}</p>
                </div>
              </div>
            </div>
          )}

          {/* Signal */}
          <div>
            <p style={lbl}>Potência Óptica</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'RX (downstream)', value: onu.rx_power, unit: 'dBm', color: rxColor },
                { label: 'TX (upstream)', value: onu.tx_power, unit: 'dBm', color: onu.tx_power != null && onu.tx_power > 5 ? C.orange : C.green },
              ].map(m => (
                <div key={m.label} style={{ ...cardCompact, backgroundColor: 'var(--inp-bg)' }}>
                  <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', fontWeight: 600 }}>{m.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: m.value != null ? m.color : C.muted, margin: 0, fontFamily: 'monospace' }}>
                    {m.value != null ? m.value.toFixed(2) : 'N/D'}
                  </p>
                  {m.value != null && <p style={{ fontSize: 10, color: C.muted, margin: '2px 0 0' }}>{m.unit}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Info grid */}
          <div>
            <p style={lbl}>Informações</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                { label: 'OLT',        value: olt?.nome ?? onu.olt_id ?? '—' },
                { label: 'PON',        value: onu.pon   ?? onu.pon_port ?? '—' },
                { label: 'CTO',        value: onu.cto_id   ?? '—' },
                { label: 'Porta CTO',  value: onu.cto_port ?? '—' },
                { label: 'Sinal',      value: onu.signal_quality ?? '—' },
                { label: 'Tempo OFF',  value: dur ?? '—' },
                { label: 'Provisioned', value: onu.provisioned_at ? new Date(onu.provisioned_at).toLocaleDateString('pt-BR') : '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-color)', fontSize: 12 }}>
                  <span style={{ color: C.muted, fontWeight: 600 }}>{row.label}</span>
                  <span style={{ color: C.text, fontFamily: 'monospace' }}>{String(row.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Last diagnostic */}
          {onu.last_diagnostic && (
            <div style={{ ...cardCompact, backgroundColor: 'var(--inp-bg)' }}>
              <p style={lbl}>Último Diagnóstico</p>
              <p style={{ fontSize: 12, color: C.text, margin: 0 }}>{onu.last_diagnostic}</p>
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              backgroundColor: testResult.nivel === 'ok' ? 'rgba(0,200,83,0.08)' : 'rgba(255,61,0,0.08)',
              border: `1px solid ${testResult.nivel === 'ok' ? 'rgba(0,200,83,0.3)' : 'rgba(255,61,0,0.3)'}`,
            }}>
              <p style={{ ...lbl, marginBottom: 6 }}>Resultado do Teste</p>
              <p style={{ fontSize: 12, color: testResult.nivel === 'ok' ? C.green : C.red, margin: 0, fontWeight: 600 }}>
                {testResult.problema ?? testResult.status ?? 'Teste concluído'}
              </p>
              {testResult.recomendacao && (
                <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>{testResult.recomendacao}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            <button
              onClick={handleTest}
              disabled={testing}
              style={{ ...btn(C.accent), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: testing ? 0.7 : 1 }}
            >
              {testing ? (
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'noc-spin 0.7s linear infinite' }} />
              ) : '⚡'}
              {testing ? 'Testando...' : 'Testar Novamente'}
            </button>
            <button
              onClick={handleReboot}
              disabled={rebooting}
              style={{ ...btn('#374151'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: rebooting ? 0.7 : 1 }}
            >
              {rebooting ? '...' : '↺'} {rebooting ? 'Reiniciando...' : 'Reiniciar ONU'}
            </button>
            <button onClick={onClose} style={{ ...btn('#1F2937') }}>Fechar</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Virtual Table ────────────────────────────────────────────────────────────

const ROW_H    = 44
const VIEWPORT = 460
const BUFFER   = 6

const TH = ({ children, right, w }) => (
  <th style={{
    padding: '0 10px', height: 32, textAlign: right ? 'right' : 'left',
    fontSize: 10, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    borderBottom: '1px solid var(--border-color)',
    whiteSpace: 'nowrap', width: w,
    backgroundColor: 'var(--card-bg)',
    position: 'sticky', top: 0, zIndex: 1,
  }}>
    {children}
  </th>
)

function VirtualTable({ rows, now, olts, onDrawer, onTest, userRole }) {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - BUFFER)
  const endIdx   = Math.min(rows.length, Math.ceil((scrollTop + VIEWPORT) / ROW_H) + BUFFER)
  const visible  = rows.slice(startIdx, endIdx)
  const totalH   = rows.length * ROW_H
  const offsetY  = startIdx * ROW_H

  const canReboot = userRole === 'superadmin' || userRole === 'admin' || userRole === 'noc'

  return (
    <div
      ref={containerRef}
      style={{ height: VIEWPORT, overflowY: 'auto', overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border-color)' }}
      onScroll={e => setScrollTop(e.target.scrollTop)}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 860 }}>
        <colgroup>
          <col style={{ width: 130 }} />{/* Cliente */}
          <col style={{ width: 130 }} />{/* Serial */}
          <col style={{ width: 80 }}  />{/* OLT */}
          <col style={{ width: 70 }}  />{/* PON */}
          <col style={{ width: 80 }}  />{/* CTO */}
          <col style={{ width: 120 }} />{/* Causa */}
          <col style={{ width: 70 }}  />{/* Tempo OFF */}
          <col style={{ width: 70 }}  />{/* RX */}
          <col style={{ width: 110 }} />{/* Ações */}
        </colgroup>
        <thead>
          <tr>
            <TH>Cliente</TH>
            <TH>Serial</TH>
            <TH>OLT</TH>
            <TH>PON</TH>
            <TH>CTO</TH>
            <TH>Causa</TH>
            <TH right>Tempo OFF</TH>
            <TH right>RX (dBm)</TH>
            <TH>Ações</TH>
          </tr>
        </thead>
        <tbody style={{ position: 'relative' }}>
          {/* Spacer above */}
          <tr style={{ height: offsetY }}><td colSpan={9} style={{ padding: 0 }} /></tr>

          {visible.map((o, idx) => {
            const rowIdx  = startIdx + idx
            const dur     = offlineDuration(o, now)
            const cls     = classifyFailure(o)
            const olt     = olts.find(olt => olt.id === o.olt_id)
            const isOff   = o.status === 'offline' || o.status === 'error'
            const rowBg   = isOff
              ? 'rgba(255,61,0,0.04)'
              : cls.type === 'atten' ? 'rgba(255,214,0,0.03)' : undefined

            return (
              <tr
                key={o._id ?? o.serial}
                style={{
                  height: ROW_H,
                  backgroundColor: rowBg,
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'background-color 0.1s',
                }}
                onClick={() => onDrawer(o)}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(45,140,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = rowBg ?? '' }}
              >
                {/* Cliente */}
                <td style={{ padding: '0 10px', overflow: 'hidden' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.cliente ?? <span style={{ color: C.muted }}>—</span>}
                  </p>
                </td>

                {/* Serial */}
                <td style={{ padding: '0 10px' }}>
                  <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.serial}
                  </p>
                </td>

                {/* OLT */}
                <td style={{ padding: '0 10px' }}>
                  <p style={{ fontSize: 11, color: C.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {olt?.nome ?? o.olt_id ?? '—'}
                  </p>
                </td>

                {/* PON */}
                <td style={{ padding: '0 10px' }}>
                  <p style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted, margin: 0 }}>
                    {o.pon ?? o.pon_port ?? '—'}
                  </p>
                </td>

                {/* CTO */}
                <td style={{ padding: '0 10px' }}>
                  <p style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.cto_id ?? '—'}
                  </p>
                </td>

                {/* Causa */}
                <td style={{ padding: '0 10px' }}>
                  <FailureBadge onu={o} />
                </td>

                {/* Tempo OFF */}
                <td style={{ padding: '0 10px', textAlign: 'right' }}>
                  {dur ? (
                    <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: C.orange }}>{dur}</span>
                  ) : (
                    <span style={{ fontSize: 11, color: C.muted }}>—</span>
                  )}
                </td>

                {/* RX */}
                <td style={{ padding: '0 10px', textAlign: 'right' }}>
                  <RxCell rx={o.rx_power} />
                </td>

                {/* Ações */}
                <td style={{ padding: '0 8px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button
                      onClick={e => { e.stopPropagation(); onTest(o.serial) }}
                      style={{ ...btnSm('#1e40af'), backgroundColor: 'rgba(45,140,255,0.15)', color: '#60a5fa', border: '1px solid rgba(45,140,255,0.25)' }}
                      title="Testar ONU"
                    >
                      ⚡
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); onDrawer(o) }}
                      style={{ ...btnSm('#1e293b'), color: '#94a3b8', border: '1px solid var(--border-color)' }}
                      title="Ver detalhes"
                    >
                      ⬡
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}

          {/* Spacer below */}
          <tr style={{ height: Math.max(0, totalH - offsetY - visible.length * ROW_H) }}>
            <td colSpan={9} style={{ padding: 0 }} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Main: ONUManagementView ──────────────────────────────────────────────────

export default function ONUManagementView({ onus = [], olts = [], onLog, userRole = 'noc' }) {
  const isMobile = useIsMobile(768)
  const [now, setNow]               = useState(() => Date.now())
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [causeFilter, setCauseFilter]   = useState('todos')
  const [drawerOnu, setDrawerOnu]   = useState(null)
  const [testingSerial, setTestingSerial] = useState(null)
  const [trendRange, setTrendRange] = useState('6h')
  const [showProvision, setShowProvision] = useState(false)

  // Tick every 30s to refresh durations
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // ── Derived data ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total    = onus.length
    const online   = onus.filter(o => o.status === 'active').length
    const offline  = onus.filter(o => o.status === 'offline').length
    const critical = onus.filter(o => o.signal_quality === 'critico').length
    const atten    = onus.filter(o => o.rx_power != null && o.rx_power < -25 && o.status === 'active').length
    const pct      = total > 0 ? Math.round((online / total) * 100) : 0
    return { total, online, offline, critical, atten, pct }
  }, [onus])

  const massEvents = useMemo(() => detectMassEvents(onus, 3), [onus])

  const rootCauses = useMemo(() => getRootCauses(onus), [onus])

  const trendData = useMemo(() => {
    const points = trendRange === '1h' ? 12 : trendRange === '6h' ? 24 : 48
    return genTrend(stats.offline, points)
  }, [stats.offline, trendRange])

  const filtered = useMemo(() => {
    let list = onus
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.serial?.toLowerCase().includes(q) ||
        o.cliente?.toLowerCase().includes(q) ||
        o.cto_id?.toLowerCase().includes(q) ||
        o.olt_id?.toLowerCase().includes(q)
      )
    }
    if (statusFilter === 'ativas')   list = list.filter(o => o.status === 'active')
    if (statusFilter === 'offline')  list = list.filter(o => o.status === 'offline')
    if (statusFilter === 'critico')  list = list.filter(o => o.signal_quality === 'critico')
    if (statusFilter === 'prov')     list = list.filter(o => o.status === 'provisioning')

    if (causeFilter !== 'todos') {
      list = list.filter(o => classifyFailure(o).type === causeFilter)
    }

    // Sort: offline first, then by RX descending issues
    list = [...list].sort((a, b) => {
      if (a.status === 'offline' && b.status !== 'offline') return -1
      if (b.status === 'offline' && a.status !== 'offline') return 1
      const ra = a.rx_power ?? 0
      const rb = b.rx_power ?? 0
      return ra - rb
    })
    return list
  }, [onus, search, statusFilter, causeFilter])

  async function handleTest(serial) {
    setTestingSerial(serial)
  }

  // ── Quick provision form (inline) ──────────────────────────────────────────

  const [form, setForm] = useState({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })
  const [provisioning, setProvisioning] = useState(false)
  const [formFeedback, setFormFeedback] = useState(null)

  async function handleProvision() {
    if (!form.serial.trim()) { setFormFeedback({ type: 'error', msg: 'Serial obrigatório.' }); return }
    setProvisioning(true)
    setFormFeedback(null)
    onLog('ONU', `Provisionando ${form.serial}`, 'info')
    try {
      const { manualProvision } = await import('@/actions/provisioning')
      const res = await manualProvision({ serial: form.serial.trim(), cliente: form.cliente.trim(), oltId: form.oltId || null, ponPort: form.ponPort || null, ctoId: form.ctoId.trim() || null })
      if (res.processed) {
        setFormFeedback({ type: 'success', msg: `ONU ${form.serial} provisionada. Atualize a página.` })
        onLog('ONU', `${form.serial} provisionada`, 'success')
        setForm({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })
      } else {
        setFormFeedback({ type: 'error', msg: res.reason ?? 'Falha no provisionamento.' })
      }
    } catch (e) {
      setFormFeedback({ type: 'error', msg: e.message })
      onLog('ONU', e.message, 'error')
    } finally { setProvisioning(false) }
  }

  // ── DiagnosticModal (imported inline) ─────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Drawer animation */}
      <style>{`
        @keyframes nocDrawerIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>

      {/* ONU Drawer */}
      {drawerOnu && (
        <ONUDrawer
          onu={drawerOnu}
          olts={olts}
          now={now}
          onClose={() => setDrawerOnu(null)}
          onTest={serial => { setDrawerOnu(null); setTestingSerial(serial) }}
          onLog={onLog}
        />
      )}

      {/* Legacy DiagnosticModal */}
      {testingSerial && (
        <LegacyDiagnosticPlaceholder serial={testingSerial} onClose={() => setTestingSerial(null)} onLog={onLog} />
      )}

      {/* ── Row 1: KPI Cards ─────────────────────────────────────────────────── */}
      <div className="noc-kpi-row">
        <KPICard label="Total ONUs"    value={stats.total}   sub={`${stats.pct}% estabilidade`} />
        <KPICard label="Online"        value={stats.online}  color={C.green}  glow sub={`${stats.pct}% da rede`}    onClick={() => setStatusFilter(statusFilter === 'ativas' ? 'todos' : 'ativas')} active={statusFilter === 'ativas'} />
        <KPICard label="Offline"       value={stats.offline} color={C.red}    glow sub={`${stats.total ? Math.round(stats.offline / stats.total * 100) : 0}% crítico`} onClick={() => setStatusFilter(statusFilter === 'offline' ? 'todos' : 'offline')} active={statusFilter === 'offline'} />
        <KPICard label="Em Atenuação"  value={stats.atten}   color={C.yellow}      sub="RX < -25 dBm"    onClick={() => setCauseFilter(causeFilter === 'atten' ? 'todos' : 'atten')} active={causeFilter === 'atten'} />
        <KPICard label="Eventos Massa" value={massEvents.length} color={massEvents.length > 0 ? C.orange : C.muted} sub={massEvents.length > 0 ? 'Investigar' : 'Nenhum'} />
        <KPICard label="Sinal Crítico" value={stats.critical} color={stats.critical > 0 ? C.red : C.muted} sub="RX crítico"    onClick={() => setStatusFilter(statusFilter === 'critico' ? 'todos' : 'critico')} active={statusFilter === 'critico'} />
      </div>

      {/* ── Row 2: Mass Events ───────────────────────────────────────────────── */}
      {massEvents.length > 0 && (
        <div style={card}>
          <p style={{ ...lbl, marginBottom: 10 }}>Eventos de Massa Detectados</p>
          <MassEventBanner events={massEvents} olts={olts} />
        </div>
      )}

      {/* ── Row 3: Charts ────────────────────────────────────────────────────── */}
      <div className="noc-dual-charts">

        {/* Donut: Root Cause */}
        <div style={card}>
          <p style={{ ...lbl, marginBottom: 12 }}>Causa Raiz das Falhas</p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <DonutChart data={rootCauses} size={140} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rootCauses.map(d => (
                <div key={d.type} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                     onClick={() => setCauseFilter(causeFilter === d.type ? 'todos' : d.type)}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: causeFilter === d.type ? C.text : C.muted, fontWeight: causeFilter === d.type ? 700 : 400, flex: 1 }}>{d.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: d.color, fontFamily: 'monospace' }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Line: Offline Trend */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={lbl}>Tendência de Quedas</p>
            <div style={{ display: 'flex', gap: 4 }}>
              {['1h', '6h', '24h'].map(r => (
                <button key={r} onClick={() => setTrendRange(r)} style={{
                  padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, cursor: 'pointer', border: 'none',
                  backgroundColor: trendRange === r ? C.red + '20' : 'transparent',
                  color: trendRange === r ? C.red : C.muted,
                  outline: trendRange === r ? `1px solid ${C.red}40` : '1px solid var(--border-color)',
                }}>{r}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.red }}>{stats.offline}</span>
            <span style={{ fontSize: 11, color: C.muted, paddingBottom: 4 }}>offline agora</span>
          </div>
          <div style={{ width: '100%' }}>
            <TrendChart data={trendData} width={320} height={70} color={C.red} />
          </div>
          <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>* Tendência simulada — integre coleta histórica para dados reais</p>
        </div>
      </div>

      {/* ── Row 4: Table ─────────────────────────────────────────────────────── */}
      <div style={card}>
        {/* Table header: search + filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <p style={{ ...lbl, margin: 0, flexShrink: 0 }}>
            ONUs ({filtered.length}{filtered.length !== onus.length ? ` / ${onus.length}` : ''})
          </p>
          <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ ...inp, width: isMobile ? '100%' : 240 }}
              placeholder="Buscar serial, cliente, CTO, OLT..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {[
                { id: 'todos',   label: 'Todos',          color: C.accent },
                { id: 'ativas',  label: 'Online',         color: C.green },
                { id: 'offline', label: 'Offline',        color: C.red },
                { id: 'critico', label: 'Sinal Crítico',  color: C.orange },
                { id: 'prov',    label: 'Provisionando',  color: C.accent },
              ].map(chip => {
                const active = statusFilter === chip.id
                return (
                  <button key={chip.id} onClick={() => setStatusFilter(chip.id)} style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                    cursor: 'pointer', border: 'none',
                    backgroundColor: active ? chip.color : 'transparent',
                    color: active ? '#fff' : C.muted,
                    outline: active ? 'none' : '1px solid var(--border-color)',
                  }}>
                    {chip.label}
                  </button>
                )
              })}
            </div>
          </div>
          <button
            onClick={() => setShowProvision(v => !v)}
            style={{ ...btnSm(C.accent) }}
          >
            + Provisionar
          </button>
        </div>

        {/* Desktop: virtual table */}
        <div className="noc-table-wrap">
          <VirtualTable
            rows={filtered}
            now={now}
            olts={olts}
            onDrawer={setDrawerOnu}
            onTest={handleTest}
            userRole={userRole}
          />
          <p style={{ fontSize: 10, color: C.muted, marginTop: 8, textAlign: 'right' }}>
            Clique em qualquer linha para abrir diagnóstico detalhado
          </p>
        </div>

        {/* Mobile: card list */}
        <div className="noc-cards-wrap">
          {filtered.length === 0 && (
            <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>Nenhuma ONU encontrada.</p>
          )}
          {filtered.slice(0, 100).map(o => {
            const dur = offlineDuration(o, now)
            const cls = classifyFailure(o)
            const olt = olts.find(x => x.id === o.olt_id)
            const statusColor = o.status === 'active' ? C.green : o.status === 'offline' ? C.red : C.yellow
            return (
              <div
                key={o._id ?? o.serial}
                onClick={() => setDrawerOnu(o)}
                style={{
                  backgroundColor: 'var(--card-bg)',
                  border: `1px solid ${cls.color}33`,
                  borderLeft: `3px solid ${cls.color}`,
                  borderRadius: 8, padding: '10px 12px',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{o.cliente ?? '—'}</p>
                    <p style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted, margin: '2px 0 0' }}>{o.serial}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, backgroundColor: statusColor + '20', color: statusColor, border: `1px solid ${statusColor}40` }}>
                      {o.status === 'active' ? 'Online' : o.status === 'offline' ? 'Offline' : o.status}
                    </span>
                    {cls.badge && <FailureBadge onu={o} />}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
                  {olt && <span>OLT: <span style={{ color: C.text }}>{olt.nome}</span></span>}
                  {o.cto_id && <span>CTO: <span style={{ fontFamily: 'monospace', color: C.text }}>{o.cto_id}</span></span>}
                  {o.rx_power != null && <span>RX: <RxCell rx={o.rx_power} /></span>}
                  {dur && <span style={{ color: C.orange, fontWeight: 600 }}>⏱ {dur}</span>}
                </div>
              </div>
            )
          })}
          {filtered.length > 100 && (
            <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', padding: '8px 0' }}>
              Exibindo 100 de {filtered.length}. Use filtros para refinar.
            </p>
          )}
        </div>
      </div>

      {/* ── Row 5: Provision form (collapsible) ──────────────────────────────── */}
      {showProvision && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={lbl}>Provisionar ONU</p>
            <button onClick={() => setShowProvision(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          {formFeedback && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, marginBottom: 10,
              backgroundColor: formFeedback.type === 'success' ? 'rgba(0,200,83,0.08)' : 'rgba(255,61,0,0.08)',
              border: `1px solid ${formFeedback.type === 'success' ? '#00C85340' : '#FF3D0040'}`,
              color: formFeedback.type === 'success' ? C.green : C.red, fontSize: 12,
            }}>
              {formFeedback.msg}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            <div><label style={lbl}>Serial ONU *</label><input style={inp} placeholder="ZTEG1A2B3C4D" value={form.serial} onChange={e => setForm(f => ({ ...f, serial: e.target.value }))} /></div>
            <div><label style={lbl}>Cliente</label><input style={inp} placeholder="Nome do cliente" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} /></div>
            <div>
              <label style={lbl}>OLT</label>
              <select style={inp} value={form.oltId} onChange={e => setForm(f => ({ ...f, oltId: e.target.value }))}>
                <option value="">Auto / selecionar...</option>
                {olts.map(o => <option key={o.id} value={o.id}>{o.nome}{o.ip ? ` (${o.ip})` : ''}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Porta PON</label><input style={inp} type="number" min="0" placeholder="0" value={form.ponPort} onChange={e => setForm(f => ({ ...f, ponPort: e.target.value }))} /></div>
            <div><label style={lbl}>CTO ID</label><input style={inp} placeholder="CTO-001" value={form.ctoId} onChange={e => setForm(f => ({ ...f, ctoId: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={{ ...btn(C.accent), opacity: provisioning ? 0.7 : 1 }} onClick={handleProvision} disabled={provisioning}>
              {provisioning ? 'Provisionando...' : 'Provisionar ONU'}
            </button>
            <button style={{ ...btn('#1F2937') }} onClick={() => setForm({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })}>
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* ── Row 6: Signal Reference ──────────────────────────────────────────── */}
      <div style={{ ...cardCompact, padding: '12px 16px' }}>
        <p style={{ ...lbl, marginBottom: 8 }}>Referência de Sinal RX</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { color: C.green,  label: '> -20 dBm',      desc: 'Excelente' },
            { color: '#4ade80', label: '-20 a -25 dBm',  desc: 'Bom' },
            { color: C.yellow, label: '-25 a -28 dBm',  desc: 'Alta atenuação' },
            { color: C.red,    label: '< -28 dBm',       desc: 'Crítico / fibra' },
            { color: C.orange, label: 'Offline sem RX',  desc: 'Sem energia' },
            { color: C.red,    label: 'Offline + < -30', desc: 'Fibra rompida' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: r.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: r.color, fontWeight: 600 }}>{r.label}</span>
              <span style={{ fontSize: 11, color: C.muted }}>— {r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Diagnostic shim ──────────────────────────────────────────────────────────
// Reuses the DiagnosticModal from parent context if available,
// otherwise shows a minimal inline diagnostic panel.

function LegacyDiagnosticPlaceholder({ serial, onClose, onLog }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const { testOnuConnection } = await import('@/actions/provisioning')
        const res = await testOnuConnection(serial)
        if (!cancelled) {
          setResult(res)
          onLog('ONU', `Diagnóstico ${serial}: ${res.problema ?? 'OK'}`, res.nivel === 'ok' ? 'success' : 'warn')
        }
      } catch (e) {
        if (!cancelled) {
          setResult({ problema: e.message, nivel: 'error' })
          onLog('ONU', `Erro: ${e.message}`, 'error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [serial, onLog])

  const lvlColor = !result ? C.text
    : result.nivel === 'ok'     ? C.green
    : result.nivel === 'atencao' ? C.yellow : C.red

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 998, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 999, width: 400, maxWidth: '95vw',
        backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: 14, padding: 20, boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Diagnóstico ONU</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8', marginBottom: 14 }}>{serial}</p>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 13 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--border-color)', borderTopColor: C.accent, borderRadius: '50%', animation: 'noc-spin 0.7s linear infinite' }} />
            Consultando OLT...
          </div>
        ) : result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: lvlColor + '10', border: `1px solid ${lvlColor}30` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: lvlColor, margin: '0 0 4px' }}>{result.problema ?? 'Diagnóstico concluído'}</p>
              {result.recomendacao && <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{result.recomendacao}</p>}
            </div>
            {[
              { label: 'RX',     value: result.rx },
              { label: 'TX',     value: result.tx },
              { label: 'Status', value: result.status },
            ].filter(r => r.value).map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: C.muted }}>{r.label}</span>
                <span style={{ color: C.text, fontFamily: 'monospace', fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        <button onClick={onClose} style={{ ...btn('#374151'), marginTop: 16, width: '100%' }}>Fechar</button>
      </div>
    </>
  )
}
