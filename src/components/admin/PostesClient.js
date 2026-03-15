'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { upsertPoste, deletePoste } from '@/actions/postes'

const LocationPicker = dynamic(() => import('@/components/map/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, backgroundColor: '#0d1526', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#475569', fontSize: 13 }}>Carregando mapa...</span>
    </div>
  ),
})

const cardStyle = {
  backgroundColor: '#111827',
  border: '1px solid #1f2937',
}

const modalBgStyle = {
  backgroundColor: 'rgba(0,0,0,0.7)',
}

const inputStyle = {
  backgroundColor: '#0b1220',
  border: '1px solid #1f2937',
  color: '#f1f5f9',
}

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

export default function PostesClient({ postesIniciais, projetoId, userRole }) {
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
    poste_id: '',
    tipo: 'simples',
    lat: '',
    lng: '',
    nome: '',
    rua: '',
    bairro: '',
    altura: '9m',
    material: 'concreto',
    proprietario: '',
    status: 'ativo',
    obs: '',
  })

  function abrirNovo() {
    setForm({
      poste_id: '', tipo: 'simples', lat: '', lng: '', nome: '', rua: '',
      bairro: '', altura: '9m', material: 'concreto', proprietario: '', status: 'ativo', obs: '',
    })
    setPosteEditando(null)
    setErro(null)
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
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setPosteEditando(null)
    setErro(null)
    setMostrarMapa(false)
  }

  function usarGPS() {
    if (!navigator.geolocation) {
      setErro('Geolocalização não suportada neste dispositivo.')
      return
    }
    setGpsCarregando(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(7),
          lng: pos.coords.longitude.toFixed(7),
        }))
        setGpsCarregando(false)
      },
      () => {
        setErro('Não foi possível obter a localização GPS.')
        setGpsCarregando(false)
      },
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

  function handleExcluir(poste) {
    setConfirmDelete(poste)
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
        {sucesso && (
          <p className="text-sm text-green-400">{sucesso}</p>
        )}
        {erro && !modalAberto && (
          <p className="text-sm text-red-400">{erro}</p>
        )}
        {!sucesso && !erro && <div />}
        <button
          onClick={abrirNovo}
          className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Novo Poste
        </button>
      </div>

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2937', backgroundColor: '#0d1526' }}>
                {['ID', 'Tipo', 'Status', 'Latitude', 'Longitude', 'Material', 'Bairro', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {postes.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-500 py-12 text-sm">
                    Nenhum poste cadastrado ainda.
                  </td>
                </tr>
              )}
              {postes.map((poste, i) => (
                <tr
                  key={poste._id}
                  style={{ borderBottom: i < postes.length - 1 ? '1px solid #1f2937' : 'none' }}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-sky-400">{poste.poste_id}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{poste.tipo ?? '—'}</td>
                  <td className="px-4 py-3 text-xs capitalize">
                    <span className={STATUS_CORES[poste.status] ?? 'text-slate-400'}>
                      {poste.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {poste.lat != null ? poste.lat.toFixed(6) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {poste.lng != null ? poste.lng.toFixed(6) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs capitalize">{poste.material ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{poste.bairro ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => abrirEditar(poste)}
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        Editar
                      </button>
                      <span className="text-slate-700">|</span>
                      <button
                        onClick={() => handleExcluir(poste)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Excluir
                      </button>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-5">
              {posteEditando ? 'Editar Poste' : 'Novo Poste'}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">ID do Poste *</label>
                <input
                  name="poste_id"
                  value={form.poste_id}
                  onChange={handleFormChange}
                  disabled={!!posteEditando}
                  placeholder="ex: PT-001"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Nome</label>
                <input
                  name="nome"
                  value={form.nome}
                  onChange={handleFormChange}
                  placeholder="Identificação"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Tipo</label>
                <select
                  name="tipo"
                  value={form.tipo}
                  onChange={handleFormChange}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 capitalize"
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleFormChange}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {STATUS_OPTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Localização *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={usarGPS}
                      disabled={gpsCarregando}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                      style={{ backgroundColor: '#0c2340', border: '1px solid #0369a1', color: '#38bdf8' }}
                    >
                      {gpsCarregando ? '...' : '📍 GPS'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMostrarMapa((v) => !v)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
                      style={{ backgroundColor: mostrarMapa ? '#0c2340' : '#111827', border: '1px solid #1f2937', color: '#94a3b8' }}
                    >
                      🗺️ {mostrarMapa ? 'Ocultar mapa' : 'Escolher no mapa'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="lat"
                    value={form.lat}
                    onChange={handleFormChange}
                    placeholder="Latitude"
                    type="number"
                    step="any"
                    style={inputStyle}
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <input
                    name="lng"
                    value={form.lng}
                    onChange={handleFormChange}
                    placeholder="Longitude"
                    type="number"
                    step="any"
                    style={inputStyle}
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                {mostrarMapa && (
                  <LocationPicker
                    lat={form.lat ? parseFloat(form.lat) : null}
                    lng={form.lng ? parseFloat(form.lng) : null}
                    onChange={({ lat, lng }) =>
                      setForm((prev) => ({
                        ...prev,
                        lat: lat.toFixed(7),
                        lng: lng.toFixed(7),
                      }))
                    }
                  />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Altura</label>
                <select
                  name="altura"
                  value={form.altura}
                  onChange={handleFormChange}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {ALTURAS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Material</label>
                <select
                  name="material"
                  value={form.material}
                  onChange={handleFormChange}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 capitalize"
                >
                  {MATERIAIS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Rua</label>
                <input
                  name="rua"
                  value={form.rua}
                  onChange={handleFormChange}
                  placeholder="Logradouro"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Bairro</label>
                <input
                  name="bairro"
                  value={form.bairro}
                  onChange={handleFormChange}
                  placeholder="Bairro"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Proprietário</label>
                <input
                  name="proprietario"
                  value={form.proprietario}
                  onChange={handleFormChange}
                  placeholder="ex: CEMIG, proprio"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Observações</label>
                <textarea
                  name="obs"
                  value={form.obs}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Observações..."
                  style={{ ...inputStyle, resize: 'vertical' }}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {erro && (
              <div
                style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
                className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
              >
                {erro}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={fecharModal}
                disabled={isPending}
                style={{ border: '1px solid #1f2937', color: '#94a3b8' }}
                className="px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={isPending || !form.poste_id || !form.lat || !form.lng}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-sm p-6 text-center">
            <p className="text-white font-semibold mb-2">Excluir Poste?</p>
            <p className="text-sm text-slate-400 mb-6">
              O poste <span className="text-white font-mono">{confirmDelete.poste_id}</span> será
              removido permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ border: '1px solid #1f2937', color: '#94a3b8' }}
                className="flex-1 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExclusao}
                disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
