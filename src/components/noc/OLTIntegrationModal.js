'use client'

import { useState, useEffect, useCallback } from 'react'

// Proxy server-side — never call the lab directly from the browser
const LAB = '/api/noc/connections'

const FO = {
  bg: '#EDE3D2', card: '#F7F0E2', espresso: '#1A120D', orange: '#C45A2C',
  orangeSoft: '#E88A5A', muted: '#7A5C46', border: 'rgba(196,140,100,0.22)',
  line: 'rgba(196,140,100,0.13)', danger: '#dc2626',
}

const VENDORS = ['huawei', 'zte', 'fiberhome', 'intelbras', 'nokia']
const VENDOR_LABELS = { huawei: 'Huawei', zte: 'ZTE', fiberhome: 'Fiberhome', intelbras: 'Intelbras', nokia: 'Nokia' }

const PROTOCOLS = ['ssh', 'telnet', 'snmp', 'api', 'simulator']
const PROTOCOL_LABELS = { ssh: 'SSH', telnet: 'Telnet', snmp: 'SNMP', api: 'REST API', simulator: 'Simulador' }

const DEFAULT_PORTS = { ssh: 22, telnet: 23, snmp: 161, api: 80, simulator: 0 }

const VENDOR_DEFAULTS = {
  huawei:    { model: 'MA5608T', port_ssh: 22, port_telnet: 23 },
  zte:       { model: 'C320',    port_ssh: 22, port_telnet: 23 },
  fiberhome: { model: 'AN5516',  port_ssh: 22, port_telnet: 23 },
  intelbras: { model: 'OLT-1200', port_ssh: 22, port_telnet: 23 },
  nokia:     { model: '7360 FX-2', port_ssh: 22, port_telnet: 22 },
}

const EMPTY_FORM = {
  name: '', vendor: 'huawei', ip: '', port: 22,
  user: 'admin', password: '', protocol: 'simulator',
  mode: 'simulated', model: '',
}

function Field({ label, children, required, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
        {label}{required && <span style={{ color: FO.danger }}> *</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 10, color: FO.muted, marginTop: 3 }}>{hint}</p>}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  borderRadius: 7, border: `1px solid ${FO.border}`,
  backgroundColor: FO.bg, color: FO.espresso, outline: 'none',
  boxSizing: 'border-box',
}

const selectStyle = { ...inputStyle, cursor: 'pointer' }

export default function OLTIntegrationModal({ onClose, onSaved, editData = null }) {
  const [form,      setForm]      = useState(editData ? { ...EMPTY_FORM, ...editData } : { ...EMPTY_FORM })
  const [testing,   setTesting]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [error,     setError]     = useState(null)

  const isEdit = !!editData

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // Auto-fill port when protocol changes
  useEffect(() => {
    if (!isEdit) {
      if (form.protocol === 'simulator') {
        set('mode', 'simulated')
      } else {
        set('port', DEFAULT_PORTS[form.protocol] ?? 22)
      }
    }
  }, [form.protocol]) // eslint-disable-line

  // Auto-fill simulator SSH defaults when switching to simulated mode
  useEffect(() => {
    if (!isEdit && form.mode === 'simulated' && form.protocol === 'ssh') {
      setForm(f => ({
        ...f,
        ip:   f.ip   && f.ip !== 'localhost' ? f.ip : 'localhost',
        port: f.port && f.port !== 22 ? f.port : 2222,
        user: f.user || 'admin',
      }))
    }
    if (!isEdit && form.mode === 'simulated' && form.protocol === 'telnet') {
      setForm(f => ({
        ...f,
        ip:   f.ip   && f.ip !== 'localhost' ? f.ip : 'localhost',
        port: f.port && f.port !== 23 ? f.port : 2222,
        user: f.user || 'admin',
      }))
    }
  }, [form.mode, form.protocol]) // eslint-disable-line

  // Auto-fill model when vendor changes
  useEffect(() => {
    if (!isEdit) {
      const def = VENDOR_DEFAULTS[form.vendor]
      if (def) set('model', def.model)
    }
  }, [form.vendor]) // eslint-disable-line

  // Sanitise IP: strip protocol prefix and trailing slashes that users accidentally paste
  function sanitiseIP(raw) {
    return raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim()
  }

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    setError(null)
    try {
      const payload = { ...form, ip: sanitiseIP(form.ip) }
      // Se editando uma conexão existente, testa via ID
      if (isEdit && editData.id) {
        const res = await fetch(`${LAB}/${editData.id}/test`, { method: 'POST' })
        const data = await res.json()
        setTestResult(data)
      } else {
        // Testa sem persistir — cria temp e testa
        const res = await fetch(`${LAB}/test-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        setTestResult(data)
      }
    } catch (e) {
      setTestResult({ ok: false, message: `Erro de rede: ${e.message}` })
    } finally {
      setTesting(false)
    }
  }, [form, isEdit, editData])

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    if (form.protocol !== 'simulator' && !form.ip.trim()) { setError('IP é obrigatório'); return }

    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, ip: sanitiseIP(form.ip) }
      const url    = isEdit ? `${LAB}/${editData.id}` : LAB
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      onSaved?.(data)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }, [form, isEdit, editData, onSaved, onClose])

  const needsCreds = form.protocol !== 'simulator' && form.protocol !== 'snmp'
  const needsIP    = form.protocol !== 'simulator'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          backgroundColor: 'rgba(26,18,13,0.55)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 101, width: 520, maxHeight: '90vh',
        backgroundColor: FO.card, borderRadius: 14,
        border: `1px solid ${FO.border}`,
        boxShadow: '0 24px 64px rgba(26,18,13,0.22)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${FO.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: FO.espresso, margin: 0 }}>
              {isEdit ? 'Editar Integração' : '+ Integrar OLT'}
            </h2>
            <p style={{ fontSize: 11, color: FO.muted, margin: '2px 0 0' }}>
              {isEdit ? `Editando ${editData.name}` : 'Conectar uma OLT ao FiberOps NOC'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: FO.muted, fontSize: 20, padding: 4 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* Nome */}
          <Field label="Nome da OLT" required>
            <input
              style={inputStyle}
              placeholder="ex: OLT-01 Matriz"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </Field>

          {/* Linha: Fabricante + Modelo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Fabricante" required>
              <select style={selectStyle} value={form.vendor} onChange={e => set('vendor', e.target.value)}>
                {VENDORS.map(v => <option key={v} value={v}>{VENDOR_LABELS[v]}</option>)}
              </select>
            </Field>
            <Field label="Modelo">
              <input style={inputStyle} placeholder="ex: MA5608T" value={form.model} onChange={e => set('model', e.target.value)} />
            </Field>
          </div>

          {/* Linha: Protocolo + Modo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Protocolo" required>
              <select style={selectStyle} value={form.protocol} onChange={e => set('protocol', e.target.value)}>
                {PROTOCOLS.map(p => <option key={p} value={p}>{PROTOCOL_LABELS[p]}</option>)}
              </select>
            </Field>
            <Field label="Modo" required>
              <select
                style={selectStyle}
                value={form.mode}
                onChange={e => set('mode', e.target.value)}
                disabled={form.protocol === 'simulator'}
              >
                <option value="simulated">Simulada</option>
                <option value="real">Real</option>
              </select>
            </Field>
          </div>

          {/* IP + Porta (oculto para simulator) */}
          {needsIP && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <Field
                  label="Endereço IP"
                  required
                  hint={form.mode === 'simulated' ? 'Simulador local: use localhost' : undefined}
                >
                  <input
                    style={inputStyle}
                    placeholder={form.mode === 'simulated' ? 'localhost' : '192.168.1.10'}
                    value={form.ip}
                    onChange={e => set('ip', sanitiseIP(e.target.value))}
                  />
                </Field>
                <Field label="Porta" hint={form.mode === 'simulated' ? 'SSH sim: 2222' : undefined}>
                  <input
                    style={inputStyle}
                    type="number"
                    value={form.port}
                    onChange={e => set('port', parseInt(e.target.value) || DEFAULT_PORTS[form.protocol])}
                  />
                </Field>
              </div>
              {form.mode === 'simulated' && (form.protocol === 'ssh' || form.protocol === 'telnet') && (
                <div style={{ padding: '8px 12px', borderRadius: 7, backgroundColor: '#eff6ff', border: '1px solid #3b82f633', marginBottom: 14, marginTop: -6 }}>
                  <p style={{ fontSize: 11, color: '#1e40af', margin: 0 }}>
                    <strong>Simulador SSH:</strong> IP = <code>localhost</code>, Porta = <code>2222</code>, Usuário/Senha = <code>admin</code> / <code>admin</code>
                  </p>
                </div>
              )}
            </>
          )}

          {/* Credenciais (oculto para SNMP e Simulator) */}
          {needsCreds && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Usuário">
                <input style={inputStyle} placeholder="admin" value={form.user} onChange={e => set('user', e.target.value)} />
              </Field>
              <Field label="Senha">
                <input style={inputStyle} type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} />
              </Field>
            </div>
          )}

          {/* Info simulator */}
          {form.protocol === 'simulator' && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#dbeafe', border: '1px solid #3b82f633', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#1e40af', margin: 0 }}>
                <strong>Modo Simulador</strong> — Uma OLT virtual será criada com ONUs e eventos gerados automaticamente. Não requer conexão de rede.
              </p>
            </div>
          )}

          {/* Resultado do teste */}
          {testResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 14,
              backgroundColor: testResult.ok ? '#dcfce7' : '#fee2e2',
              border: `1px solid ${testResult.ok ? '#16a34a44' : '#dc262644'}`,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: testResult.ok ? '#166534' : '#991b1b', margin: 0 }}>
                {testResult.ok ? '✓ Conexão bem-sucedida' : '✗ Falha na conexão'}
                {testResult.latencyMs != null && ` · ${testResult.latencyMs}ms`}
              </p>
              {testResult.message && <p style={{ fontSize: 11, color: testResult.ok ? '#166534' : '#991b1b', margin: '3px 0 0' }}>{testResult.message}</p>}
            </div>
          )}

          {/* Erro de save */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#fee2e2', border: '1px solid #dc262644', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#991b1b', margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${FO.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={handleTest}
            disabled={testing || saving}
            style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: testing ? 'not-allowed' : 'pointer',
              border: `1px solid ${FO.border}`, borderRadius: 7,
              backgroundColor: FO.bg, color: FO.muted,
              opacity: testing ? 0.6 : 1,
            }}
          >
            {testing ? '⟳ Testando…' : '⚡ Testar Conexão'}
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${FO.border}`, borderRadius: 7, backgroundColor: FO.bg, color: FO.muted }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                border: 'none', borderRadius: 7,
                backgroundColor: saving ? FO.muted : FO.orange, color: '#fff',
              }}
            >
              {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Conectar OLT'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
