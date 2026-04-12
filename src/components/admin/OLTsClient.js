'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { upsertOLT, deleteOLT } from '@/actions/olts'

const LocationPicker = dynamic(() => import('@/components/map/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, backgroundColor: '#060d1a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando mapa...</span>
    </div>
  ),
})

// ── Estilos (padrão do projeto) ────────────────────────────────────────────────
const modalOverlay = { backgroundColor: 'rgba(0,0,0,0.85)' }

const modalPanel = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  width: 'min(580px,100%)',
}

const fieldInput = {
  backgroundColor: 'var(--inp-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--foreground)',
  fontSize: '13px',
  outline: 'none',
}

const fieldGroup = {
  backgroundColor: 'var(--inp-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const labelStyle = {
  fontSize: '10px',
  color: 'var(--border-color)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 600,
  marginBottom: '4px',
  display: 'block',
}

const cardStyle = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
}

const STATUS_CONFIG = {
  ativo:         { label: 'Ativo',      color: '#22c55e' },
  inativo:       { label: 'Inativo',    color: '#ef4444' },
  em_manutencao: { label: 'Manutenção', color: '#f59e0b' },
}

const FORM_VAZIO = {
  olt_id: '', nome: '', modelo: '', ip: '',
  capacidade: 16, status: 'ativo', lat: '', lng: '',
}

export default function OLTsClient({ oltsIniciais, projetoId, userRole }) {
  const [olts, setOlts]               = useState(oltsIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [oltEditando, setOltEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm]               = useState(FORM_VAZIO)
  const [saving, setSaving]           = useState(false)
  const [erro, setErro]               = useState(null)
  const [sucesso, setSucesso]         = useState(null)
  const [mostrarMapa, setMostrarMapa] = useState(false)
  const [gpsCarregando, setGpsCarregando] = useState(false)

  function abrirNovo() {
    setForm(FORM_VAZIO)
    setOltEditando(null)
    setErro(null)
    setMostrarMapa(false)
    setModalAberto(true)
  }

  function abrirEditar(olt) {
    setForm({
      olt_id:     olt.id      ?? '',
      nome:       olt.nome    ?? '',
      modelo:     olt.modelo  ?? '',
      ip:         olt.ip      ?? '',
      capacidade: olt.capacidade ?? 16,
      status:     olt.status  ?? 'ativo',
      lat:        olt.lat != null ? String(olt.lat) : '',
      lng:        olt.lng != null ? String(olt.lng) : '',
    })
    setOltEditando(olt)
    setErro(null)
    setMostrarMapa(false)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setOltEditando(null)
    setErro(null)
    setMostrarMapa(false)
  }

  function usarGPS() {
    if (!navigator.geolocation) { setErro('Geolocalização não suportada.'); return }
    setGpsCarregando(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({ ...prev, lat: pos.coords.latitude.toFixed(7), lng: pos.coords.longitude.toFixed(7) }))
        setGpsCarregando(false)
      },
      () => { setErro('Não foi possível obter GPS.'); setGpsCarregando(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSalvar() {
    if (!form.olt_id.trim()) { setErro('ID da OLT é obrigatório.'); return }
    if (!form.nome.trim())   { setErro('Nome é obrigatório.'); return }
    setErro(null)
    setSaving(true)
    try {
      const res = await upsertOLT({
        olt_id:     form.olt_id.trim(),
        nome:       form.nome.trim(),
        modelo:     form.modelo.trim() || null,
        ip:         form.ip.trim()     || null,
        capacidade: parseInt(form.capacidade) || 16,
        status:     form.status,
        lat:        form.lat ? parseFloat(form.lat) : null,
        lng:        form.lng ? parseFloat(form.lng) : null,
        projeto_id: projetoId,
      })
      const normalizado = { ...res, id: res.id ?? form.olt_id.trim() }
      if (oltEditando) {
        setOlts((prev) => prev.map((o) => o._id === normalizado._id ? normalizado : o))
      } else {
        setOlts((prev) => [normalizado, ...prev])
      }
      setSucesso(oltEditando ? 'OLT atualizada com sucesso.' : 'OLT criada com sucesso.')
      setTimeout(() => setSucesso(null), 3000)
      fecharModal()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmarExclusao() {
    if (!confirmDelete) return
    setSaving(true)
    try {
      await deleteOLT(confirmDelete.id, projetoId)
      setOlts((prev) => prev.filter((o) => o._id !== confirmDelete._id))
      setSucesso('OLT removida.')
      setTimeout(() => setSucesso(null), 3000)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSaving(false)
      setConfirmDelete(null)
    }
  }

  return (
    <>
      {/* Barra de ações */}
      <div className="flex items-center justify-between mb-4">
        {sucesso && <p className="text-sm text-green-400">{sucesso}</p>}
        {erro && !modalAberto && <p className="text-sm text-red-400">{erro}</p>}
        {!sucesso && !erro && <div />}
        <button
          onClick={abrirNovo}
          style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700 }}
          className="text-sm px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
        >
          + Nova OLT
        </button>
      </div>

      {/* Aviso de OLTs sem coordenadas */}
      {olts.some((o) => o.lat == null || o.lng == null) && (
        <div style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 10 }}
          className="px-4 py-3 text-xs text-yellow-400 mb-4 flex items-start gap-2">
          <span className="text-base flex-shrink-0">⚠️</span>
          <span>OLTs sem coordenadas não aparecem no mapa. Edite a OLT e defina a localização via GPS ou selecionando no mapa.</span>
        </div>
      )}

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
                {['ID', 'Nome', 'Modelo', 'IP Gerência', 'Portas PON', 'Status', 'Mapa', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {olts.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-500 py-12 text-sm">
                    Nenhuma OLT cadastrada ainda.
                  </td>
                </tr>
              )}
              {olts.map((olt, i) => {
                const st = STATUS_CONFIG[olt.status] ?? { label: olt.status ?? '—', color: 'var(--text-secondary)' }
                const temCoordenadas = olt.lat != null && olt.lng != null
                return (
                  <tr key={olt._id} style={{ borderBottom: i < olts.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                    className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#ff8000' }}>{olt.id ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{olt.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{olt.modelo ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{olt.ip ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{olt.capacidade ?? 16}</td>
                    <td className="px-4 py-3">
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        backgroundColor: `${st.color}18`,
                        border: `1px solid ${st.color}44`,
                        color: st.color,
                      }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {temCoordenadas
                        ? <span title={`${olt.lat?.toFixed(5)}, ${olt.lng?.toFixed(5)}`} style={{ fontSize: 13, color: '#22c55e' }}>✓</span>
                        : <span title="Sem coordenadas — não aparece no mapa" style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, cursor: 'help' }}>⚠ Sem local</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => abrirEditar(olt)} className="text-xs" style={{ color: '#ff8000' }}>Editar</button>
                        <span className="text-slate-700">|</span>
                        <button onClick={() => setConfirmDelete(olt)} className="text-xs text-red-400 hover:text-red-300">Excluir</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova/Editar OLT */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={modalOverlay} onClick={(e) => e.target === e.currentTarget && fecharModal()}>
          <div style={modalPanel} className="rounded-t-2xl sm:rounded-2xl w-full p-6 max-h-[92vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-5">
              <h2 style={{ color: 'var(--foreground)', fontSize: 17, fontWeight: 700 }}>
                {oltEditando ? 'Editar OLT' : 'Nova OLT'}
              </h2>
              <button onClick={fecharModal}
                style={{ color: 'var(--border-color)', fontSize: 20, lineHeight: 1 }}
                className="hover:text-white transition-colors">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Identificação */}
              <div style={fieldGroup}>
                <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Identificação</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>ID da OLT *</label>
                    <input name="olt_id" value={form.olt_id} onChange={handleFormChange}
                      disabled={!!oltEditando} placeholder="ex: OLT-01"
                      style={{ ...fieldInput, opacity: oltEditando ? 0.5 : 1 }}
                      className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div>
                    <label style={labelStyle}>Nome *</label>
                    <input name="nome" value={form.nome} onChange={handleFormChange}
                      placeholder="ex: OLT Central" style={fieldInput}
                      className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div>
                    <label style={labelStyle}>Modelo</label>
                    <input name="modelo" value={form.modelo} onChange={handleFormChange}
                      placeholder="ex: Huawei MA5800-X7" style={fieldInput}
                      className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div>
                    <label style={labelStyle}>IP de Gerência</label>
                    <input name="ip" value={form.ip} onChange={handleFormChange}
                      placeholder="ex: 192.168.1.1" style={fieldInput}
                      className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                </div>
              </div>

              {/* Configuração */}
              <div style={fieldGroup}>
                <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Configuração</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Portas PON</label>
                    <input name="capacidade" type="number" min={1} value={form.capacidade}
                      onChange={handleFormChange} style={fieldInput}
                      className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                        <button key={val} type="button"
                          onClick={() => setForm((p) => ({ ...p, status: val }))}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 8,
                            backgroundColor: form.status === val ? `${cfg.color}22` : 'var(--border-color)',
                            border: `1px solid ${form.status === val ? cfg.color : 'var(--border-color)'}`,
                            color: form.status === val ? cfg.color : 'var(--text-muted)', cursor: 'pointer',
                          }}>
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Localização (opcional) */}
              <div style={fieldGroup}>
                <div className="flex items-center justify-between">
                  <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>
                    Localização <span style={{ color: 'var(--border-color)', fontWeight: 400 }}>(opcional)</span>
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={usarGPS} disabled={gpsCarregando}
                      style={{ backgroundColor: 'rgba(255,128,0,0.15)', border: '1px solid rgba(255,128,0,0.5)', color: '#ff8000', fontSize: 11, padding: '4px 10px', borderRadius: 8 }}
                      className="disabled:opacity-40 hover:brightness-110 transition-all flex items-center gap-1">
                      {gpsCarregando ? '⏳' : '📍'} GPS
                    </button>
                    <button type="button" onClick={() => setMostrarMapa((v) => !v)}
                      style={{
                        backgroundColor: mostrarMapa ? '#064e3b' : 'var(--card-bg)',
                        border: `1px solid ${mostrarMapa ? '#065f46' : 'var(--border-color)'}`,
                        color: mostrarMapa ? '#6ee7b7' : 'var(--text-secondary)',
                        fontSize: 11, padding: '4px 10px', borderRadius: 8,
                      }}
                      className="hover:brightness-110 transition-all">
                      🗺 {mostrarMapa ? 'Fechar' : 'Selecionar'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Latitude</label>
                    <input name="lat" value={form.lat} onChange={handleFormChange}
                      placeholder="-23.550520" type="number" step="any" style={fieldInput}
                      className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div>
                    <label style={labelStyle}>Longitude</label>
                    <input name="lng" value={form.lng} onChange={handleFormChange}
                      placeholder="-46.633309" type="number" step="any" style={fieldInput}
                      className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                </div>
                {mostrarMapa && (
                  <LocationPicker lat={form.lat} lng={form.lng}
                    onChange={(lat, lng) => setForm((prev) => ({ ...prev, lat: String(lat), lng: String(lng) }))} />
                )}
              </div>
            </div>

            {erro && (
              <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
                className="rounded-lg px-4 py-3 text-sm text-red-400 mt-4">
                {erro}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={fecharModal} disabled={saving}
                style={{ border: '1px solid var(--border-color)', color: 'var(--border-color)' }}
                className="px-5 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={saving || !form.olt_id || !form.nome}
                style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 14 }}
                className="px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-40">
                {saving ? 'Salvando...' : oltEditando ? 'Salvar alterações' : 'Criar OLT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalOverlay}>
          <div style={modalPanel} className="rounded-2xl p-6 text-center max-w-sm">
            <p className="text-white font-semibold mb-2">Excluir OLT?</p>
            <p className="text-sm text-slate-400 mb-6">
              A OLT <span className="text-white font-mono">{confirmDelete.id}</span> ({confirmDelete.nome}) será removida permanentemente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                style={{ border: '1px solid var(--border-color)', color: 'var(--border-color)' }}
                className="flex-1 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarExclusao} disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {saving ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
