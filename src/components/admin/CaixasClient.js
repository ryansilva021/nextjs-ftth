'use client'

import { useState, useTransition, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { upsertCaixa, deleteCaixa } from '@/actions/caixas'

const LocationPicker = dynamic(() => import('@/components/map/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, backgroundColor: '#060d1a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando mapa...</span>
    </div>
  ),
})

const TIPOS = ['CDO', 'CE']

// ── Shared modal styles ───────────────────────────────────────────────────────
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

// Tipo chip colors
const TIPO_CHIP = {
  CDO: { bg: 'rgba(22,163,74,0.18)', border: 'rgba(22,163,74,0.5)', color: '#15803d' },
  CE:  { bg: 'rgba(99,102,241,0.18)', border: 'rgba(99,102,241,0.5)', color: '#4338ca' },
}

export default function CaixasClient({ caixasIniciais, projetoId, userRole, idInicial }) {
  const [caixas, setCaixas] = useState(caixasIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [caixaEditando, setCaixaEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()
  const [mostrarMapa, setMostrarMapa] = useState(false)
  const [gpsCarregando, setGpsCarregando] = useState(false)

  const [form, setForm] = useState({
    ce_id: '', nome: '', tipo: 'CDO', lat: '', lng: '',
    parent_tipo: 'olt', // 'olt' | 'cdo'
    olt_id: '', porta_olt: '',
    cdo_pai_id: '', porta_cdo_pai: '',
    splitter_cdo: '', rua: '', bairro: '', obs: '',
  })

  function abrirNovo() {
    setForm({ ce_id: '', nome: '', tipo: 'CDO', lat: '', lng: '', parent_tipo: 'olt', olt_id: '', porta_olt: '', cdo_pai_id: '', porta_cdo_pai: '', splitter_cdo: '', rua: '', bairro: '', obs: '' })
    setCaixaEditando(null)
    setErro(null)
    setMostrarMapa(false)
    setModalAberto(true)
  }

  function abrirEditar(caixa) {
    const hasCdoPai = !!caixa.cdo_pai_id
    setForm({
      ce_id: caixa.id ?? caixa.ce_id ?? '',
      nome: caixa.nome ?? '',
      tipo: caixa.tipo ?? 'CDO',
      lat: caixa.lat != null ? String(caixa.lat) : '',
      lng: caixa.lng != null ? String(caixa.lng) : '',
      parent_tipo: hasCdoPai ? 'cdo' : 'olt',
      olt_id: caixa.olt_id ?? '',
      porta_olt: caixa.porta_olt != null ? String(caixa.porta_olt) : '',
      cdo_pai_id: caixa.cdo_pai_id ?? '',
      porta_cdo_pai: caixa.porta_cdo_pai != null ? String(caixa.porta_cdo_pai) : '',
      splitter_cdo: caixa.splitter_cdo ?? '',
      rua: caixa.rua ?? '',
      bairro: caixa.bairro ?? '',
      obs: caixa.obs ?? '',
    })
    setCaixaEditando(caixa)
    setErro(null)
    setMostrarMapa(false)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setCaixaEditando(null)
    setErro(null)
    setMostrarMapa(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!idInicial) return
    const caixa = caixasIniciais.find(c => (c.id ?? c.ce_id) === idInicial)
    if (caixa) abrirEditar(caixa)
  }, [])

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

  function handleSalvar() {
    setErro(null)
    startTransition(async () => {
      try {
        const resultado = await upsertCaixa({
          ce_id: form.ce_id,
          projeto_id: projetoId,
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
          nome: form.nome || null,
          tipo: form.tipo,
          olt_id: form.parent_tipo === 'olt' ? (form.olt_id || null) : null,
          porta_olt: form.parent_tipo === 'olt' && form.porta_olt ? parseInt(form.porta_olt) : null,
          cdo_pai_id: form.parent_tipo === 'cdo' ? (form.cdo_pai_id || null) : null,
          porta_cdo_pai: form.parent_tipo === 'cdo' && form.porta_cdo_pai ? parseInt(form.porta_cdo_pai) : null,
          splitter_cdo: form.splitter_cdo || null,
          rua: form.rua || null,
          bairro: form.bairro || null,
          obs: form.obs || null,
        })
        if (caixaEditando) {
          const idEditando = caixaEditando.id ?? caixaEditando.ce_id
          setCaixas((prev) => prev.map((c) => {
            const cId = c.id ?? c.ce_id
            return cId === idEditando ? resultado : c
          }))
        } else {
          setCaixas((prev) => [resultado, ...prev])
        }
        setSucesso(caixaEditando ? 'Caixa atualizada com sucesso.' : 'Caixa criada com sucesso.')
        setTimeout(() => setSucesso(null), 3000)
        fecharModal()
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  function confirmarExclusao() {
    if (!confirmDelete) return
    startTransition(async () => {
      try {
        const caixaId = confirmDelete.id ?? confirmDelete.ce_id
        await deleteCaixa(caixaId, projetoId)
        setCaixas((prev) => prev.filter((c) => {
          const cId = c.id ?? c.ce_id
          return cId !== caixaId
        }))
        setSucesso('Caixa removida.')
        setTimeout(() => setSucesso(null), 3000)
      } catch (e) {
        setErro(e.message)
      } finally {
        setConfirmDelete(null)
      }
    })
  }

  const getCaixaId = (caixa) => caixa.id ?? caixa.ce_id ?? '—'

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
          + Nova Caixa
        </button>
      </div>

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
                {['ID', 'Nome', 'Tipo', 'Endereço', 'Splitter', 'OLT', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {caixas.length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-500 py-12 text-sm">Nenhuma caixa cadastrada ainda.</td></tr>
              )}
              {caixas.map((caixa, i) => {
                const chip = TIPO_CHIP[caixa.tipo] ?? TIPO_CHIP.CDO
                return (
                  <tr key={caixa._id} style={{ borderBottom: i < caixas.length - 1 ? '1px solid var(--border-color)' : 'none' }} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#ff8000' }}>{getCaixaId(caixa)}</td>
                    <td className="px-4 py-3 text-slate-200">{caixa.nome ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span style={{ backgroundColor: chip.bg, border: `1px solid ${chip.border}`, color: chip.color }} className="text-xs px-2 py-0.5 rounded-full font-semibold">
                        {caixa.tipo ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{[caixa.rua, caixa.bairro].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{caixa.splitter_cdo ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{caixa.olt_id ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => abrirEditar(caixa)} className="text-xs" style={{ color: '#ff8000' }}>Editar</button>
                        <span className="text-slate-700">|</span>
                        <button onClick={() => setConfirmDelete(caixa)} className="text-xs text-red-400 hover:text-red-300">Excluir</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova/Editar Caixa */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={modalOverlay} onClick={(e) => e.target === e.currentTarget && fecharModal()}>
          <div style={modalPanel} className="rounded-t-2xl sm:rounded-2xl w-full p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ color: 'var(--foreground)', fontSize: 17, fontWeight: 700 }}>
                {caixaEditando ? 'Editar Caixa CE/CDO' : 'Nova Caixa CE/CDO'}
              </h2>
              <button onClick={fecharModal} style={{ color: 'var(--border-color)', fontSize: 20, lineHeight: 1 }} className="hover:text-white transition-colors">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Grupo: Identificação */}
              <div style={fieldGroup}>
                <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Identificação</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>ID da Caixa *</label>
                    <input
                      name="ce_id" value={form.ce_id} onChange={handleFormChange}
                      disabled={!!caixaEditando} placeholder="ex: CDO-001"
                      style={{ ...fieldInput, opacity: caixaEditando ? 0.5 : 1 }}
                      className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Nome</label>
                    <input name="nome" value={form.nome} onChange={handleFormChange} placeholder="Nome descritivo" style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div className="col-span-2">
                    <label style={labelStyle}>Tipo</label>
                    <div className="flex gap-2">
                      {TIPOS.map((t) => {
                        const chip = TIPO_CHIP[t]
                        const ativo = form.tipo === t
                        return (
                          <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, tipo: t }))}
                            style={{
                              backgroundColor: ativo ? chip.bg : 'var(--border-color)',
                              border: `1px solid ${ativo ? chip.border : 'var(--border-color)'}`,
                              color: ativo ? chip.color : 'var(--border-color)',
                              padding: '6px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                              transition: 'all .15s',
                            }}>
                            {t}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grupo: Localização */}
              <div style={fieldGroup}>
                <div className="flex items-center justify-between">
                  <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Localização *</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={usarGPS} disabled={gpsCarregando}
                      style={{ backgroundColor: 'rgba(255,128,0,0.15)', border: '1px solid rgba(255,128,0,0.5)', color: '#ff8000', fontSize: 11, padding: '4px 10px', borderRadius: 8 }}
                      className="disabled:opacity-40 hover:brightness-110 transition-all flex items-center gap-1">
                      {gpsCarregando ? '⏳' : '📍'} GPS
                    </button>
                    <button type="button" onClick={() => setMostrarMapa((v) => !v)}
                      style={{ backgroundColor: mostrarMapa ? '#064e3b' : 'var(--card-bg)', border: `1px solid ${mostrarMapa ? '#065f46' : 'var(--border-color)'}`, color: mostrarMapa ? '#6ee7b7' : 'var(--text-secondary)', fontSize: 11, padding: '4px 10px', borderRadius: 8 }}
                      className="hover:brightness-110 transition-all">
                      🗺 {mostrarMapa ? 'Fechar' : 'Selecionar'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Latitude</label>
                    <input name="lat" value={form.lat} onChange={handleFormChange} placeholder="-23.550520" type="number" step="any" style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div>
                    <label style={labelStyle}>Longitude</label>
                    <input name="lng" value={form.lng} onChange={handleFormChange} placeholder="-46.633309" type="number" step="any" style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                </div>
                {mostrarMapa && (
                  <LocationPicker lat={form.lat ? parseFloat(form.lat) : null} lng={form.lng ? parseFloat(form.lng) : null}
                    onChange={(lat, lng) => setForm((prev) => ({ ...prev, lat: String(lat), lng: String(lng) }))} />
                )}
              </div>

              {/* Grupo: Endereço */}
              <div style={fieldGroup}>
                <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Endereço</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Rua</label>
                    <input name="rua" value={form.rua} onChange={handleFormChange} placeholder="Logradouro" style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div>
                    <label style={labelStyle}>Bairro</label>
                    <input name="bairro" value={form.bairro} onChange={handleFormChange} placeholder="Bairro" style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                </div>
              </div>

              {/* Grupo: Rede */}
              <div style={fieldGroup}>
                <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Configuração de Rede</p>

                {/* Toggle: OLT ou CDO pai */}
                <div>
                  <label style={labelStyle}>Alimentado por</label>
                  <div className="flex gap-2">
                    {[
                      { v: 'olt', label: '🖥️ OLT', cor: '#0891b2' },
                      { v: 'cdo', label: '🔌 CDO/CE', cor: '#7c3aed' },
                    ].map(({ v, label, cor }) => {
                      const ativo = form.parent_tipo === v
                      return (
                        <button key={v} type="button"
                          onClick={() => setForm((p) => ({ ...p, parent_tipo: v }))}
                          style={{
                            backgroundColor: ativo ? `${cor}22` : 'var(--border-color)',
                            border: `1px solid ${ativo ? cor + '66' : 'var(--border-color)'}`,
                            color: ativo ? cor : 'var(--border-color)',
                            padding: '6px 16px', borderRadius: 8, fontWeight: 600, fontSize: 12,
                            transition: 'all .15s', cursor: 'pointer',
                          }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {form.parent_tipo === 'olt' ? (
                    <>
                      <div>
                        <label style={labelStyle}>ID da OLT</label>
                        <input name="olt_id" value={form.olt_id} onChange={handleFormChange} placeholder="ex: OLT-001" style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                      </div>
                      <div>
                        <label style={labelStyle}>Porta OLT</label>
                        <input name="porta_olt" value={form.porta_olt} onChange={handleFormChange} placeholder="ex: 1" type="number" min={1} style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={labelStyle}>ID da CDO/CE pai</label>
                        <input name="cdo_pai_id" value={form.cdo_pai_id} onChange={handleFormChange}
                          placeholder="ex: CDO-001"
                          style={{ ...fieldInput, border: form.cdo_pai_id && form.cdo_pai_id === form.ce_id ? '1px solid #ef4444' : fieldInput.border }}
                          className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500/40" />
                        {form.cdo_pai_id && form.cdo_pai_id === form.ce_id && (
                          <p style={{ color: '#f87171', fontSize: 10, marginTop: 2 }}>Não pode ser pai de si mesma</p>
                        )}
                      </div>
                      <div>
                        <label style={labelStyle}>Porta CDO/CE pai</label>
                        <input name="porta_cdo_pai" value={form.porta_cdo_pai} onChange={handleFormChange} placeholder="ex: 1" type="number" min={1} style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500/40" />
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <label style={labelStyle}>Splitter CDO</label>
                    <input name="splitter_cdo" value={form.splitter_cdo} onChange={handleFormChange} placeholder="ex: 1:8, 1:16, 2:16" style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div className="col-span-2">
                    <label style={labelStyle}>Observações</label>
                    <textarea name="obs" value={form.obs} onChange={handleFormChange} rows={2} placeholder="Observações..." style={{ ...fieldInput, resize: 'vertical' }} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                </div>
              </div>
            </div>

            {erro && (
              <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }} className="rounded-lg px-4 py-3 text-sm text-red-400 mt-4">
                {erro}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={fecharModal} disabled={isPending}
                style={{ border: '1px solid var(--border-color)', color: 'var(--border-color)' }}
                className="px-5 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={isPending || !form.ce_id || !form.lat || !form.lng || (form.parent_tipo === 'cdo' && form.cdo_pai_id === form.ce_id)}
                style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 14 }}
                className="px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-40">
                {isPending ? 'Salvando...' : caixaEditando ? 'Salvar alterações' : 'Criar Caixa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalOverlay}>
          <div style={modalPanel} className="rounded-2xl p-6 text-center max-w-sm">
            <p className="text-white font-semibold mb-2">Excluir Caixa?</p>
            <p className="text-sm text-slate-400 mb-6">
              A caixa <span className="text-white font-mono">{getCaixaId(confirmDelete)}</span> será removida permanentemente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                style={{ border: '1px solid var(--border-color)', color: 'var(--border-color)' }}
                className="flex-1 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarExclusao} disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {isPending ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
