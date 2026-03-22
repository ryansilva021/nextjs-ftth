'use client'

import { useState, useTransition, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { upsertPoste, deletePoste } from '@/actions/postes'

const LocationPicker = dynamic(() => import('@/components/map/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, backgroundColor: '#060d1a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando mapa...</span>
    </div>
  ),
})

const TIPOS = ['simples', 'transformador', 'ancoragem', 'derivacao', 'cruzamento']
const STATUS_OPTS = ['ativo', 'inativo', 'em_manutencao', 'removido']
const ALTURAS = ['7m', '9m', '11m', '13m']
const MATERIAIS = ['concreto', 'madeira', 'ferro', 'fibra']

const STATUS_CORES = {
  ativo: 'text-green-400',
  inativo: 'text-slate-500',
  em_manutencao: 'text-yellow-400',
  removido: 'text-red-400',
}

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

export default function PostesClient({ postesIniciais, projetoId, userRole, idInicial }) {
  const [postes, setPostes] = useState(postesIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [posteEditando, setPosteEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()
  const [mostrarMapa, setMostrarMapa] = useState(false)
  const [gpsCarregando, setGpsCarregando] = useState(false)

  const [form, setForm] = useState({
    poste_id: '', tipo: 'simples', lat: '', lng: '', nome: '', rua: '',
    bairro: '', altura: '9m', material: 'concreto', proprietario: '', status: 'ativo', obs: '',
  })

  function abrirNovo() {
    setForm({ poste_id: '', tipo: 'simples', lat: '', lng: '', nome: '', rua: '', bairro: '', altura: '9m', material: 'concreto', proprietario: '', status: 'ativo', obs: '' })
    setPosteEditando(null)
    setErro(null)
    setMostrarMapa(false)
    setModalAberto(true)
  }

  function abrirEditar(poste) {
    setForm({
      poste_id: poste.poste_id ?? '',
      tipo: poste.tipo ?? 'simples',
      lat: poste.lat != null ? String(poste.lat) : '',
      lng: poste.lng != null ? String(poste.lng) : '',
      nome: poste.nome ?? '',
      rua: poste.rua ?? '',
      bairro: poste.bairro ?? '',
      altura: poste.altura ?? '9m',
      material: poste.material ?? 'concreto',
      proprietario: poste.proprietario ?? '',
      status: poste.status ?? 'ativo',
      obs: poste.obs ?? '',
    })
    setPosteEditando(poste)
    setErro(null)
    setMostrarMapa(false)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setPosteEditando(null)
    setErro(null)
    setMostrarMapa(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!idInicial) return
    const poste = postesIniciais.find(p => p.poste_id === idInicial)
    if (poste) abrirEditar(poste)
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
        const resultado = await upsertPoste({
          poste_id: form.poste_id,
          projeto_id: projetoId,
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
          tipo: form.tipo || null,
          nome: form.nome || null,
          rua: form.rua || null,
          bairro: form.bairro || null,
          altura: form.altura || null,
          material: form.material || null,
          proprietario: form.proprietario || null,
          status: form.status || 'ativo',
          obs: form.obs || null,
        })
        if (posteEditando) {
          setPostes((prev) => prev.map((p) => p.poste_id === resultado.poste_id ? resultado : p))
        } else {
          setPostes((prev) => [resultado, ...prev])
        }
        setSucesso(posteEditando ? 'Poste atualizado com sucesso.' : 'Poste criado com sucesso.')
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
        await deletePoste(confirmDelete.poste_id, projetoId)
        setPostes((prev) => prev.filter((p) => p.poste_id !== confirmDelete.poste_id))
        setSucesso('Poste removido.')
        setTimeout(() => setSucesso(null), 3000)
      } catch (e) {
        setErro(e.message)
      } finally {
        setConfirmDelete(null)
      }
    })
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
          + Novo Poste
        </button>
      </div>

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
                {['ID', 'Tipo', 'Status', 'Latitude', 'Longitude', 'Material', 'Bairro', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {postes.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-500 py-12 text-sm">Nenhum poste cadastrado ainda.</td></tr>
              )}
              {postes.map((poste, i) => (
                <tr key={poste._id} style={{ borderBottom: i < postes.length - 1 ? '1px solid var(--border-color)' : 'none' }} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-sky-400">{poste.poste_id}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{poste.tipo ?? '—'}</td>
                  <td className="px-4 py-3 text-xs capitalize">
                    <span className={STATUS_CORES[poste.status] ?? 'text-slate-400'}>{poste.status ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{poste.lat != null ? poste.lat.toFixed(6) : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{poste.lng != null ? poste.lng.toFixed(6) : '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs capitalize">{poste.material ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{poste.bairro ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirEditar(poste)} className="text-xs text-sky-400 hover:text-sky-300">Editar</button>
                      <span className="text-slate-700">|</span>
                      <button onClick={() => setConfirmDelete(poste)} className="text-xs text-red-400 hover:text-red-300">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova/Editar Poste */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={modalOverlay} onClick={(e) => e.target === e.currentTarget && fecharModal()}>
          <div style={modalPanel} className="rounded-t-2xl sm:rounded-2xl w-full p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ color: 'var(--foreground)', fontSize: 17, fontWeight: 700 }}>
                {posteEditando ? 'Editar Poste' : 'Novo Poste'}
              </h2>
              <button onClick={fecharModal} style={{ color: 'var(--border-color)', fontSize: 20, lineHeight: 1 }} className="hover:text-white transition-colors">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Grupo: Identificação */}
              <div style={fieldGroup}>
                <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Identificação</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>ID do Poste *</label>
                    <input
                      name="poste_id" value={form.poste_id} onChange={handleFormChange}
                      disabled={!!posteEditando} placeholder="ex: PT-001"
                      style={{ ...fieldInput, opacity: posteEditando ? 0.5 : 1 }}
                      className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Nome</label>
                    <input name="nome" value={form.nome} onChange={handleFormChange} placeholder="Identificação" style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo</label>
                    <select name="tipo" value={form.tipo} onChange={handleFormChange} style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40 capitalize">
                      {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select name="status" value={form.status} onChange={handleFormChange} style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40">
                      {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Grupo: Localização */}
              <div style={fieldGroup}>
                <div className="flex items-center justify-between">
                  <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Localização *</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={usarGPS} disabled={gpsCarregando}
                      style={{ backgroundColor: '#0c2340', border: '1px solid #0369a1', color: '#38bdf8', fontSize: 11, padding: '4px 10px', borderRadius: 8 }}
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

              {/* Grupo: Especificações */}
              <div style={fieldGroup}>
                <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Especificações</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Altura</label>
                    <select name="altura" value={form.altura} onChange={handleFormChange} style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40">
                      {ALTURAS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Material</label>
                    <select name="material" value={form.material} onChange={handleFormChange} style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40 capitalize">
                      {MATERIAIS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label style={labelStyle}>Proprietário</label>
                    <input name="proprietario" value={form.proprietario} onChange={handleFormChange} placeholder="ex: CEMIG, proprio" style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                  <div className="col-span-2">
                    <label style={labelStyle}>Observações</label>
                    <textarea name="obs" value={form.obs} onChange={handleFormChange} rows={3} placeholder="Observações..." style={{ ...fieldInput, resize: 'vertical' }} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
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
              <button onClick={handleSalvar} disabled={isPending || !form.poste_id || !form.lat || !form.lng}
                style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 14 }}
                className="px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-40">
                {isPending ? 'Salvando...' : posteEditando ? 'Salvar alterações' : 'Criar Poste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalOverlay}>
          <div style={modalPanel} className="rounded-2xl p-6 text-center max-w-sm">
            <p className="text-white font-semibold mb-2">Excluir Poste?</p>
            <p className="text-sm text-slate-400 mb-6">
              O poste <span className="text-white font-mono">{confirmDelete.poste_id}</span> será removido permanentemente.
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
