'use client'

import { useState, useCallback, useEffect } from 'react'
import OLTIntegrationModal from '@/components/noc/OLTIntegrationModal'

// Proxy server-side — never call the lab directly from the browser
const LAB = '/api/noc/connections'

const FO = {
  bg: '#EDE3D2', card: '#F7F0E2', espresso: '#1A120D', orange: '#C45A2C',
  muted: '#7A5C46', border: 'rgba(196,140,100,0.22)', line: 'rgba(196,140,100,0.13)',
  danger: '#dc2626',
}

const PROTOCOL_LABELS  = { ssh: 'SSH', telnet: 'Telnet', snmp: 'SNMP', api: 'REST API', simulator: 'Simulador' }
const VENDOR_LABELS    = { huawei: 'Huawei', zte: 'ZTE', fiberhome: 'Fiberhome', intelbras: 'Intelbras', nokia: 'Nokia' }

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    connected:    { label: 'Conectada',    bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
    disconnected: { label: 'Desconectada', bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
    error:        { label: 'Erro',         bg: '#fee2e2', color: '#991b1b', dot: '#dc2626' },
    testing:      { label: 'Testando…',    bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
    connecting:   { label: 'Conectando…',  bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  }
  const m = map[status] ?? map.disconnected
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      backgroundColor: m.bg, color: m.color,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', backgroundColor: m.dot,
        boxShadow: status === 'connected' ? `0 0 5px ${m.dot}88` : 'none',
      }} />
      {m.label}
    </span>
  )
}

// ── Connection card ───────────────────────────────────────────────────────────

function ConnectionCard({ conn, onAction, onEdit }) {
  const [loading, setLoading] = useState(null) // null | 'test' | 'reconnect' | 'disconnect' | 'remove'

  const doAction = useCallback(async (action) => {
    setLoading(action)
    try {
      if (action === 'remove') {
        await fetch(`${LAB}/${conn.id}`, { method: 'DELETE' })
      } else {
        await fetch(`${LAB}/${conn.id}/${action}`, { method: 'POST' })
      }
      onAction?.(conn.id, action)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(null)
    }
  }, [conn.id, onAction])

  const isSimulator = conn.protocol === 'simulator'

  return (
    <div style={{
      backgroundColor: FO.card, border: `1px solid ${FO.border}`,
      borderLeft: `4px solid ${conn.status === 'connected' ? '#22c55e' : conn.status === 'error' ? FO.danger : FO.muted}`,
      borderRadius: 10, padding: 18,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: FO.espresso, margin: 0 }}>{conn.name}</h3>
            <StatusBadge status={conn.status} />
          </div>
          <p style={{ fontSize: 11, color: FO.muted, margin: 0 }}>
            {VENDOR_LABELS[conn.vendor] ?? conn.vendor}
            {conn.model ? ` ${conn.model}` : ''}
            {' · '}
            {PROTOCOL_LABELS[conn.protocol] ?? conn.protocol}
            {conn.mode === 'simulated' && ' · Simulada'}
            {!isSimulator && conn.ip ? ` · ${conn.ip}:${conn.port}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onEdit(conn)}
            style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${FO.border}`, borderRadius: 6, backgroundColor: FO.bg, color: FO.muted }}
          >
            ✎ Editar
          </button>
          <button
            onClick={() => doAction('remove')}
            disabled={!!loading}
            style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid #dc262633`, borderRadius: 6, backgroundColor: '#fee2e225', color: FO.danger, opacity: loading ? 0.5 : 1 }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Stats row */}
      {conn.oltData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14, padding: '10px 12px', backgroundColor: FO.bg, borderRadius: 8 }}>
          {[
            { label: 'ONUs', value: conn.oltData.onu_count ?? '—' },
            { label: 'CPU', value: conn.oltData.cpu_usage != null ? `${conn.oltData.cpu_usage}%` : '—' },
            { label: 'Memória', value: conn.oltData.mem_usage != null ? `${conn.oltData.mem_usage}%` : '—' },
            { label: 'Temp.', value: conn.oltData.temperature != null ? `${conn.oltData.temperature}°C` : '—' },
          ].map(m => (
            <div key={m.label}>
              <p style={{ fontSize: 9, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{m.label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: FO.espresso }}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {conn.status === 'error' && conn.lastError && (
        <div style={{ padding: '6px 10px', borderRadius: 6, backgroundColor: '#fee2e2', marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: '#991b1b', margin: 0 }}>⚠ {conn.lastError}</p>
        </div>
      )}

      {/* Last sync */}
      {conn.lastPolled && (
        <p style={{ fontSize: 10, color: FO.muted, marginBottom: 10 }}>
          Última sincronização: {new Date(conn.lastPolled).toLocaleString('pt-BR')}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionBtn
          label="⚡ Testar"
          loading={loading === 'test'}
          onClick={() => doAction('test')}
          disabled={!!loading}
        />
        {conn.status === 'connected' ? (
          <ActionBtn label="⏏ Desconectar" loading={loading === 'disconnect'} onClick={() => doAction('disconnect')} disabled={!!loading} />
        ) : (
          <ActionBtn label="↻ Reconectar" loading={loading === 'reconnect'} onClick={() => doAction('reconnect')} disabled={!!loading} primary />
        )}
      </div>
    </div>
  )
}

function ActionBtn({ label, onClick, loading, disabled, primary }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px', fontSize: 11, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', borderRadius: 6,
        border: `1px solid ${primary ? FO.orange : FO.border}`,
        backgroundColor: primary ? FO.orange : FO.bg,
        color: primary ? '#fff' : FO.muted,
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? '⟳ …' : label}
    </button>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function OLTConnectionsView() {
  const [connections, setConnections] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [labOnline,   setLabOnline]   = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [editConn,    setEditConn]    = useState(null)

  const fetchConnections = useCallback(async () => {
    try {
      const res  = await fetch(LAB, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConnections(Array.isArray(data) ? data : (data.data ?? []))
      setLabOnline(true)
    } catch {
      setLabOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnections()
    const id = setInterval(fetchConnections, 15_000)
    return () => clearInterval(id)
  }, [fetchConnections])

  const handleAction = useCallback((_id, _action) => {
    // Refetch after action
    setTimeout(fetchConnections, 600)
  }, [fetchConnections])

  const handleSaved = useCallback(() => {
    setTimeout(fetchConnections, 600)
  }, [fetchConnections])

  const openAdd  = () => { setEditConn(null); setShowModal(true) }
  const openEdit = (conn) => { setEditConn(conn); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditConn(null) }

  const connected    = connections.filter(c => c.status === 'connected').length
  const disconnected = connections.filter(c => c.status !== 'connected').length

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: FO.espresso, margin: 0 }}>Integrações de OLT</h1>
          <p style={{ fontSize: 12, color: FO.muted, margin: '3px 0 0' }}>
            {connections.length} OLT{connections.length !== 1 ? 's' : ''} configurada{connections.length !== 1 ? 's' : ''}
            {connected > 0 && ` · ${connected} conectada${connected !== 1 ? 's' : ''}`}
            {disconnected > 0 && ` · ${disconnected} desconectada${disconnected !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Lab status */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700,
            backgroundColor: labOnline ? '#dcfce7' : '#fee2e2',
            color: labOnline ? '#166534' : '#991b1b',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: labOnline ? '#22c55e' : FO.danger, boxShadow: labOnline ? '0 0 5px #22c55e' : 'none' }} />
            {labOnline ? 'Lab Online' : 'Lab Offline'}
          </span>
          <button
            onClick={fetchConnections}
            style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', border: `1px solid ${FO.border}`, borderRadius: 8, backgroundColor: FO.card, color: FO.muted }}
          >
            ↻
          </button>
          <button
            onClick={openAdd}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: 'none', borderRadius: 8,
              backgroundColor: FO.orange, color: '#fff',
            }}
          >
            + Integrar OLT
          </button>
        </div>
      </div>

      {/* Lab offline warning */}
      {!labOnline && (
        <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: '#fee2e2', border: '1px solid #dc262633', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', margin: 0 }}>
            ⚠ Network Lab inacessível
          </p>
          <p style={{ fontSize: 12, color: '#991b1b', margin: '4px 0 0' }}>
            Inicie o lab com <code style={{ backgroundColor: '#fca5a5', padding: '1px 5px', borderRadius: 4 }}>npm start</code> no diretório fiberops-network-lab.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && connections.length === 0 && labOnline && (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          backgroundColor: FO.card, border: `1px solid ${FO.border}`,
          borderRadius: 12, borderStyle: 'dashed',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: FO.espresso, margin: '0 0 8px' }}>Nenhuma OLT integrada</h3>
          <p style={{ fontSize: 13, color: FO.muted, marginBottom: 20 }}>
            Conecte uma OLT real ou adicione um simulador para começar o monitoramento.
          </p>
          <button
            onClick={openAdd}
            style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 8, backgroundColor: FO.orange, color: '#fff' }}
          >
            + Integrar primeira OLT
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: FO.muted }}>Carregando integrações…</div>
      )}

      {/* Grid */}
      {!loading && connections.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {connections.map(conn => (
            <ConnectionCard
              key={conn.id}
              conn={conn}
              onAction={handleAction}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {/* Polling info */}
      {connections.length > 0 && (
        <div style={{ marginTop: 24, padding: '10px 16px', borderRadius: 8, backgroundColor: FO.card, border: `1px solid ${FO.border}` }}>
          <p style={{ fontSize: 11, color: FO.muted, margin: 0 }}>
            <strong>Polling automático:</strong>
            {' '}Status ONU/PON a cada 30s · Potência óptica a cada 1min · CPU/Memória/Temperatura a cada 5min
          </p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <OLTIntegrationModal
          onClose={closeModal}
          onSaved={handleSaved}
          editData={editConn}
        />
      )}
    </div>
  )
}
