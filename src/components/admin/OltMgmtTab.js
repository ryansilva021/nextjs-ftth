'use client'

/**
 * src/components/admin/OltMgmtTab.js
 * OLT management tab — UNM-style interface for Huawei OLT devices.
 * Shows system info, PON ports, ONU list per port, and ONU actions.
 */

import { useState } from 'react'
import {
  getOltInfoAction,
  getPonPortsAction,
  getOnusAction,
  getOnuDetailAction,
  rebootOnuAction,
  deleteOnuAction,
} from '@/actions/olt-management'

// ─── Style constants ───────────────────────────────────────────────────────────

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
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
})

const btnSm = (color = '#0284c7') => ({
  ...btn(color),
  padding: '4px 10px',
  fontSize: 11,
})

const btnOutline = {
  backgroundColor: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  padding: '6px 13px',
  fontSize: 12,
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
  boxSizing: 'border-box',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rxColor(rx) {
  if (rx == null) return 'var(--text-muted)'
  if (rx > -20)  return '#22c55e'
  if (rx >= -25) return '#4ade80'
  if (rx >= -28) return '#f59e0b'
  return '#ef4444'
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

function TD({ children, mono, muted, right, bold }) {
  return (
    <td style={{
      padding: '9px 12px',
      fontSize: 13,
      color: muted ? 'var(--text-muted)' : 'var(--foreground)',
      fontWeight: bold ? 700 : 400,
      fontFamily: mono ? 'monospace' : undefined,
      textAlign: right ? 'right' : 'left',
      borderBottom: '1px solid var(--border-color)',
    }}>
      {children}
    </td>
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

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 120 }}>{label}</span>
      <span style={{ color: 'var(--foreground)', fontFamily: mono ? 'monospace' : undefined, fontWeight: 600 }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

// ─── ONU Detail Modal ─────────────────────────────────────────────────────────

function OnuDetailModal({ detail, onClose, onReboot, onDelete, rebooting, deleting }) {
  if (!detail) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        ...card, width: 420, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            Detalhes da ONU
          </p>
          <button onClick={onClose} style={{ ...btnOutline, padding: '3px 10px' }}>✕</button>
        </div>

        <InfoRow label="Cliente"   value={detail.cliente} />
        <InfoRow label="Serial"    value={detail.serial}  mono />
        <InfoRow label="PON"       value={detail.pon}     mono />
        <InfoRow label="Status"    value={detail.status} />
        <InfoRow label="RX Power"  value={detail.rx != null ? `${detail.rx.toFixed(2)} dBm` : null} />
        <InfoRow label="TX Power"  value={detail.tx != null ? `${detail.tx.toFixed(2)} dBm` : null} />
        <InfoRow label="MAC"       value={detail.mac}    mono />
        <InfoRow label="Distância" value={detail.distancia} />

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button style={btnSm('#f59e0b')} onClick={onReboot} disabled={rebooting || deleting}>
            {rebooting ? <Spinner /> : null}{' '}Reiniciar
          </button>
          <button style={btnSm('#ef4444')} onClick={onDelete} disabled={rebooting || deleting}>
            {deleting ? <Spinner /> : null}{' '}Remover
          </button>
          <button style={btnOutline} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── PON Port Row (expandable ONU list) ───────────────────────────────────────

function PonPortRow({ ponPort, oltId, onLog }) {
  const [expanded,  setExpanded]  = useState(false)
  const [onus,      setOnus]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [detail,    setDetail]    = useState(null)
  const [rebooting, setRebooting] = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [feedback,  setFeedback]  = useState(null)

  async function loadOnus() {
    if (onus !== null) { setExpanded(v => !v); return }
    setExpanded(true)
    setLoading(true)
    try {
      const res = await getOnusAction(oltId, ponPort.slot, ponPort.port)
      setOnus(res.onus ?? [])
    } catch (e) {
      setFeedback({ type: 'error', message: e.message })
      setOnus([])
    } finally {
      setLoading(false)
    }
  }

  async function openDetail(onu) {
    try {
      const res = await getOnuDetailAction(oltId, ponPort.slot, ponPort.port, onu.onuId)
      setDetail(res.detail)
    } catch (e) {
      setFeedback({ type: 'error', message: e.message })
    }
  }

  async function handleReboot() {
    if (!detail) return
    setRebooting(true)
    try {
      await rebootOnuAction(oltId, ponPort.slot, ponPort.port, detail.onuId, detail.cliente)
      onLog?.('OLT', `ONU reiniciada: ${detail.cliente ?? detail.serial}`, 'info')
      setFeedback({ type: 'success', message: `ONU ${detail.cliente ?? detail.serial} reiniciada.` })
      setDetail(null)
    } catch (e) {
      setFeedback({ type: 'error', message: e.message })
    } finally {
      setRebooting(false)
    }
  }

  async function handleDelete() {
    if (!detail) return
    if (!window.confirm(`Remover ONU ${detail.serial} (${detail.cliente})? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    try {
      await deleteOnuAction(oltId, ponPort.slot, ponPort.port, detail.onuId, null, detail.cliente)
      onLog?.('OLT', `ONU removida: ${detail.cliente ?? detail.serial}`, 'warn')
      setOnus(prev => prev?.filter(o => o.onuId !== detail.onuId))
      setDetail(null)
    } catch (e) {
      setFeedback({ type: 'error', message: e.message })
    } finally {
      setDeleting(false)
    }
  }

  const statusColor = ponPort.status === 'online' ? '#22c55e' : '#ef4444'

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={loadOnus}>
        <TD mono bold>{ponPort.pon}</TD>
        <TD>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', borderRadius: 99,
            backgroundColor: statusColor + '22', border: `1px solid ${statusColor}55`,
            fontSize: 11, color: statusColor, fontWeight: 600,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block' }} />
            {ponPort.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </TD>
        <TD right>{ponPort.onus}</TD>
        <TD right muted>{ponPort.capacidade}</TD>
        <TD right muted>{expanded ? '▲' : '▼'}</TD>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: 0 }}>
            <div style={{ backgroundColor: 'var(--inp-bg)', padding: '8px 16px' }}>
              {feedback && <FeedbackBanner feedback={feedback} />}
              {loading ? (
                <div style={{ padding: '12px 0', textAlign: 'center' }}><Spinner /></div>
              ) : onus?.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0', margin: 0 }}>
                  Nenhuma ONU nesta porta.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <TH>ID</TH>
                      <TH>Serial</TH>
                      <TH>Cliente</TH>
                      <TH>Status</TH>
                      <TH right>RX (dBm)</TH>
                      <TH></TH>
                    </tr>
                  </thead>
                  <tbody>
                    {(onus ?? []).map((onu) => (
                      <tr key={onu.onuId}>
                        <TD mono muted>{onu.onuId}</TD>
                        <TD mono>{onu.serial}</TD>
                        <TD bold>{onu.cliente ?? '—'}</TD>
                        <TD>
                          <span style={{ color: onu.status === 'online' ? '#22c55e' : '#ef4444', fontWeight: 600, fontSize: 12 }}>
                            {onu.status === 'online' ? '● Online' : '● Offline'}
                          </span>
                        </TD>
                        <TD right>
                          <span style={{ color: rxColor(onu.rx), fontFamily: 'monospace', fontWeight: 700 }}>
                            {onu.rx != null ? onu.rx.toFixed(1) : '—'}
                          </span>
                        </TD>
                        <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>
                          <button style={btnSm()} onClick={(e) => { e.stopPropagation(); openDetail(onu) }}>
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}

      <OnuDetailModal
        detail={detail}
        onClose={() => setDetail(null)}
        onReboot={handleReboot}
        onDelete={handleDelete}
        rebooting={rebooting}
        deleting={deleting}
      />
    </>
  )
}

// ─── Main OltMgmtTab ──────────────────────────────────────────────────────────

export default function OltMgmtTab({ olts = [], onLog }) {
  const [selectedOlt, setSelectedOlt] = useState(olts[0]?.id ?? '')
  const [loading,     setLoading]     = useState(false)
  const [oltInfo,     setOltInfo]     = useState(null)
  const [ponPorts,    setPonPorts]    = useState(null)
  const [feedback,    setFeedback]    = useState(null)

  async function loadOlt() {
    if (!selectedOlt) return
    setLoading(true)
    setFeedback(null)
    setOltInfo(null)
    setPonPorts(null)
    try {
      const [infoRes, portsRes] = await Promise.all([
        getOltInfoAction(selectedOlt),
        getPonPortsAction(selectedOlt),
      ])
      setOltInfo(infoRes)
      setPonPorts(portsRes.ports ?? [])
    } catch (e) {
      setFeedback({ type: 'error', message: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* OLT selector */}
      <div style={card}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 14 }}>
          Gerenciamento de OLT
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={selectedOlt}
            onChange={e => { setSelectedOlt(e.target.value); setOltInfo(null); setPonPorts(null) }}
            style={{ ...inp, width: 'auto', minWidth: 220 }}
          >
            {olts.length === 0 && <option value="">Nenhuma OLT cadastrada</option>}
            {olts.map(o => (
              <option key={o.id ?? o._id} value={o.id}>
                {o.nome} ({o.ip ?? 'mock'})
              </option>
            ))}
          </select>
          <button style={btn()} onClick={loadOlt} disabled={loading || !selectedOlt}>
            {loading ? <Spinner /> : null}{' '}Consultar OLT
          </button>
        </div>
        {feedback && <div style={{ marginTop: 12 }}><FeedbackBanner feedback={feedback} /></div>}
      </div>

      {/* OLT Info Card */}
      {oltInfo && (
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 14 }}>
            {oltInfo.olt?.nome ?? 'OLT'} — Informações do Sistema
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            <InfoRow label="IP"     value={oltInfo.olt?.ip}                    mono />
            <InfoRow label="Modelo" value={oltInfo.info?.modelo ?? oltInfo.olt?.modelo} />
            <InfoRow label="Versão" value={oltInfo.info?.versao} />
            <InfoRow label="Uptime" value={oltInfo.info?.uptime} />
            <InfoRow label="Status" value={oltInfo.olt?.status} />
            <InfoRow label="Slots"  value={oltInfo.info?.slots} />
          </div>
        </div>
      )}

      {/* PON Ports Table */}
      {ponPorts !== null && (
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 14 }}>
            Portas PON ({ponPorts.length}) — clique na linha para ver ONUs
          </p>
          {ponPorts.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              Nenhuma porta PON encontrada.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH>PON</TH>
                    <TH>Status</TH>
                    <TH right>ONUs</TH>
                    <TH right>Capacidade</TH>
                    <TH right></TH>
                  </tr>
                </thead>
                <tbody>
                  {ponPorts.map((p, i) => (
                    <PonPortRow
                      key={p.pon ?? i}
                      ponPort={p}
                      oltId={selectedOlt}
                      onLog={onLog}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
