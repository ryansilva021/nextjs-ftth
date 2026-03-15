'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { upsertCaixa, deleteCaixa } from '@/actions/caixas'

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

const TIPOS = ['CDO', 'CE']

export default function CaixasClient({ caixasIniciais, projetoId, userRole }) {
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
    ce_id: '',
    nome: '',
    tipo: 'CDO',
    lat: '',
    lng: '',
    olt_id: '',
    porta_olt: '',
    splitter_cdo: '',
    rua: '',
    bairro: '',
    obs: '',
  })

  function abrirNovo() {
    setForm({
      ce_id: '', nome: '', tipo: 'CDO', lat: '', lng: '',
      olt_id: '', porta_olt: '', splitter_cdo: '', rua: '', bairro: '', obs: '',
    })
    setCaixaEditando(null)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEditar(caixa) {
    // O modelo CaixaEmendaCDO usa 'id' como campo identificador
    setForm({
      ce_id: caixa.id ?? caixa.ce_id ?? '',
      nome: caixa.nome ?? '',
      tipo: caixa.tipo ?? 'CDO',
      lat: caixa.lat != null ? String(caixa.lat) : '',
      lng: caixa.lng != null ? String(caixa.lng) : '',
      olt_id: caixa.olt_id ?? '',
      porta_olt: caixa.porta_olt != null ? String(caixa.porta_olt) : '',
      splitter_cdo: caixa.splitter_cdo ?? '',
      rua: caixa.rua ?? '',
      bairro: caixa.bairro ?? '',
      obs: caixa.obs ?? '',
    })
    setCaixaEditando(caixa)
    setErro(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setCaixaEditando(null)
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
        const resultado = await upsertCaixa({
          ce_id: form.ce_id,
          projeto_id: projetoId,
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
          nome: form.nome || null,
          tipo: form.tipo,
          olt_id: form.olt_id || null,
          porta_olt: form.porta_olt ? parseInt(form.porta_olt) : null,
          splitter_cdo: form.splitter_cdo || null,
          rua: form.rua || null,
          bairro: form.bairro || null,
          obs: form.obs || null,
        })
        const idResultado = resultado.id ?? resultado.ce_id
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

  function handleExcluir(caixa) {
    setConfirmDelete(caixa)
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
          + Nova Caixa
        </button>
      </div>

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2937', backgroundColor: '#0d1526' }}>
                {['ID', 'Nome', 'Tipo', 'Endereço', 'Splitter', 'OLT', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {caixas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-12 text-sm">
                    Nenhuma caixa cadastrada ainda.
                  </td>
                </tr>
              )}
              {caixas.map((caixa, i) => (
                <tr
                  key={caixa._id}
                  style={{ borderBottom: i < caixas.length - 1 ? '1px solid #1f2937' : 'none' }}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-sky-400">{getCaixaId(caixa)}</td>
                  <td className="px-4 py-3 text-slate-200">{caixa.nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      style={{
                        backgroundColor: caixa.tipo === 'CE' ? '#1e3a5f' : '#1a2e1a',
                        border: `1px solid ${caixa.tipo === 'CE' ? '#2563eb' : '#16a34a'}`,
                      }}
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    >
                      <span className={caixa.tipo === 'CE' ? 'text-blue-300' : 'text-green-300'}>
                        {caixa.tipo ?? '—'}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {[caixa.rua, caixa.bairro].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{caixa.splitter_cdo ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{caixa.olt_id ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => abrirEditar(caixa)}
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        Editar
                      </button>
                      <span className="text-slate-700">|</span>
                      <button
                        onClick={() => handleExcluir(caixa)}
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

      {/* Modal Nova/Editar Caixa */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-5">
              {caixaEditando ? 'Editar Caixa CE/CDO' : 'Nova Caixa CE/CDO'}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">ID da Caixa *</label>
                <input
                  name="ce_id"
                  value={form.ce_id}
                  onChange={handleFormChange}
                  disabled={!!caixaEditando}
                  placeholder="ex: CDO-001"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Tipo</label>
                <select
                  name="tipo"
                  value={form.tipo}
                  onChange={handleFormChange}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Nome</label>
                <input
                  name="nome"
                  value={form.nome}
                  onChange={handleFormChange}
                  placeholder="Nome descritivo"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
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
                <label className="text-xs text-slate-400 uppercase tracking-wider">OLT vinculada</label>
                <input
                  name="olt_id"
                  value={form.olt_id}
                  onChange={handleFormChange}
                  placeholder="ID da OLT"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Porta OLT</label>
                <input
                  name="porta_olt"
                  value={form.porta_olt}
                  onChange={handleFormChange}
                  placeholder="ex: 1"
                  type="number"
                  min={1}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Splitter CDO</label>
                <input
                  name="splitter_cdo"
                  value={form.splitter_cdo}
                  onChange={handleFormChange}
                  placeholder="ex: 1:8, 1:16, 2:16"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
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
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Observações</label>
                <textarea
                  name="obs"
                  value={form.obs}
                  onChange={handleFormChange}
                  rows={2}
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
                disabled={isPending || !form.ce_id || !form.lat || !form.lng}
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
            <p className="text-white font-semibold mb-2">Excluir Caixa?</p>
            <p className="text-sm text-slate-400 mb-6">
              A caixa <span className="text-white font-mono">{getCaixaId(confirmDelete)}</span> será
              removida permanentemente.
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
