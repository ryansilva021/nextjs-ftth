'use client'

import { useState, useTransition, useEffect } from 'react'
import { upsertRota, deleteRota } from '@/actions/rotas'

const TIPOS = ['BACKBONE', 'RAMAL', 'DROP']

const TIPO_CONFIG = {
  BACKBONE: { cor: '#6366f1', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)', desc: 'Fibra principal' },
  RAMAL:    { cor: '#f97316', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)',  desc: 'Distribuição' },
  DROP:     { cor: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   desc: 'Última milha' },
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

const TIPO_CORES_TABLE = {
  BACKBONE: 'text-blue-300',
  RAMAL: 'text-orange-300',
  DROP: 'text-emerald-300',
}

export default function RotasClient({ rotasIniciais, projetoId, userRole, idInicial }) {
  const [rotas, setRotas] = useState(rotasIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [rotaEditando, setRotaEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    rota_id: '', nome: '', tipo: 'RAMAL', coordinates: '', obs: '',
  })

  function abrirNovo() {
    setForm({ rota_id: '', nome: '', tipo: 'RAMAL', coordinates: '', obs: '' })
    setRotaEditando(null)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEditar(rota) {
    const props = rota.properties ?? rota
    const coords = rota.geometry?.coordinates ?? []
    setForm({
      rota_id: props.rota_id ?? '',
      nome: props.nome ?? '',
      tipo: props.tipo ?? 'RAMAL',
      coordinates: coords.length > 0 ? JSON.stringify(coords, null, 2) : '',
      obs: props.obs ?? '',
    })
    setRotaEditando(rota)
    setErro(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setRotaEditando(null)
    setErro(null)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!idInicial) return
    const rota = rotasIniciais.find(r => (r.properties?.rota_id ?? r.rota_id) === idInicial)
    if (rota) abrirEditar(rota)
  }, [])

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleSalvar() {
    setErro(null)
    startTransition(async () => {
      try {
        let coordinates
        try {
          coordinates = JSON.parse(form.coordinates)
        } catch {
          throw new Error('Coordenadas inválidas. Informe um array JSON válido, ex: [[-46.6, -23.5], [-46.7, -23.6]]')
        }

        const resultado = await upsertRota({
          rota_id: form.rota_id,
          projeto_id: projetoId,
          coordinates,
          geometry_type: 'LineString',
          nome: form.nome || null,
          tipo: form.tipo || null,
          obs: form.obs || null,
        })

        const feature = {
          type: 'Feature',
          id: resultado.rota_id,
          geometry: { type: resultado.geometry_type ?? 'LineString', coordinates: resultado.coordinates ?? [] },
          properties: {
            rota_id: resultado.rota_id,
            nome: resultado.nome,
            tipo: resultado.tipo,
            obs: resultado.obs,
            projeto_id: resultado.projeto_id,
            _id: resultado._id,
          },
        }

        if (rotaEditando) {
          const rotaId = (rotaEditando.properties ?? rotaEditando).rota_id
          setRotas((prev) => prev.map((r) => {
            const rId = (r.properties ?? r).rota_id
            return rId === rotaId ? feature : r
          }))
        } else {
          setRotas((prev) => [feature, ...prev])
        }

        setSucesso(rotaEditando ? 'Rota atualizada com sucesso.' : 'Rota criada com sucesso.')
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
        const rotaId = (confirmDelete.properties ?? confirmDelete).rota_id
        await deleteRota(rotaId, projetoId)
        setRotas((prev) => prev.filter((r) => {
          const rId = (r.properties ?? r).rota_id
          return rId !== rotaId
        }))
        setSucesso('Rota removida.')
        setTimeout(() => setSucesso(null), 3000)
      } catch (e) {
        setErro(e.message)
      } finally {
        setConfirmDelete(null)
      }
    })
  }

  const getRotaId = (rota) => (rota.properties ?? rota).rota_id ?? '—'
  const getRotaNome = (rota) => (rota.properties ?? rota).nome ?? '—'
  const getRotaTipo = (rota) => (rota.properties ?? rota).tipo ?? '—'
  const getRotaPontos = (rota) => rota.geometry?.coordinates?.length ?? 0

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
          + Nova Rota
        </button>
      </div>

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
                {['ID', 'Nome', 'Tipo', 'Pontos', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rotas.length === 0 && (
                <tr><td colSpan={5} className="text-center text-slate-500 py-12 text-sm">Nenhuma rota cadastrada ainda.</td></tr>
              )}
              {rotas.map((rota, i) => {
                const tipo = getRotaTipo(rota)
                const cfg = TIPO_CONFIG[tipo]
                return (
                  <tr key={(rota.properties ?? rota)._id ?? i} style={{ borderBottom: i < rotas.length - 1 ? '1px solid var(--border-color)' : 'none' }} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#ff8000' }}>{getRotaId(rota)}</td>
                    <td className="px-4 py-3 text-slate-200">{getRotaNome(rota)}</td>
                    <td className="px-4 py-3">
                      {cfg ? (
                        <span style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.cor }} className="text-xs px-2 py-0.5 rounded-full font-bold">
                          {tipo}
                        </span>
                      ) : (
                        <span className={`text-xs font-semibold ${TIPO_CORES_TABLE[tipo] ?? 'text-slate-300'}`}>{tipo}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{getRotaPontos(rota)} pts</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => abrirEditar(rota)} className="text-xs" style={{ color: '#ff8000' }}>Editar</button>
                        <span className="text-slate-700">|</span>
                        <button onClick={() => setConfirmDelete(rota)} className="text-xs text-red-400 hover:text-red-300">Excluir</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova/Editar Rota */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={modalOverlay} onClick={(e) => e.target === e.currentTarget && fecharModal()}>
          <div style={modalPanel} className="rounded-t-2xl sm:rounded-2xl w-full p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ color: 'var(--foreground)', fontSize: 17, fontWeight: 700 }}>
                {rotaEditando ? 'Editar Rota' : 'Nova Rota'}
              </h2>
              <button onClick={fecharModal} style={{ color: 'var(--border-color)', fontSize: 20, lineHeight: 1 }} className="hover:text-white transition-colors">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Grupo: Identificação */}
              <div style={fieldGroup}>
                <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Identificação</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>ID da Rota *</label>
                    <input
                      name="rota_id" value={form.rota_id} onChange={handleFormChange}
                      disabled={!!rotaEditando} placeholder="ex: RT-001"
                      style={{ ...fieldInput, opacity: rotaEditando ? 0.5 : 1 }}
                      className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Nome</label>
                    <input name="nome" value={form.nome} onChange={handleFormChange} placeholder="Nome da rota" style={fieldInput} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
                  </div>
                </div>
              </div>

              {/* Grupo: Tipo — visual chips */}
              <div style={fieldGroup}>
                <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Tipo de Rota</p>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS.map((t) => {
                    const cfg = TIPO_CONFIG[t]
                    const ativo = form.tipo === t
                    return (
                      <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, tipo: t }))}
                        style={{
                          backgroundColor: ativo ? cfg.bg : 'var(--border-color)',
                          border: `1px solid ${ativo ? cfg.border : 'var(--border-color)'}`,
                          padding: '10px 8px',
                          borderRadius: 10,
                          transition: 'all .15s',
                        }}
                        className="flex flex-col items-center gap-1"
                      >
                        <span style={{ color: ativo ? cfg.cor : 'var(--border-color)', fontWeight: 700, fontSize: 13 }}>{t}</span>
                        <span style={{ color: ativo ? cfg.cor : 'var(--border-color)', fontSize: 10 }}>{cfg.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Grupo: Coordenadas */}
              <div style={fieldGroup}>
                <p style={{ ...labelStyle, marginBottom: 0, color: 'var(--border-color)' }}>Coordenadas *</p>
                <div>
                  <label style={labelStyle}>Array JSON — [[lng, lat], ...]</label>
                  <textarea
                    name="coordinates" value={form.coordinates} onChange={handleFormChange}
                    rows={6}
                    placeholder={`[[-46.6333, -23.5505],\n [-46.6340, -23.5510]]`}
                    style={{ ...fieldInput, fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                    className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40"
                  />
                  <p style={{ color: 'var(--border-color)', fontSize: 11, marginTop: 4 }}>
                    Formato GeoJSON: longitude antes da latitude. Mínimo 2 pontos.
                  </p>
                </div>
              </div>

              {/* Grupo: Observações */}
              <div style={fieldGroup}>
                <div>
                  <label style={labelStyle}>Observações</label>
                  <textarea name="obs" value={form.obs} onChange={handleFormChange} rows={2} placeholder="Observações sobre a rota..." style={{ ...fieldInput, resize: 'vertical' }} className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40" />
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
              <button onClick={handleSalvar} disabled={isPending || !form.rota_id || !form.coordinates}
                style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 14 }}
                className="px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-40">
                {isPending ? 'Salvando...' : rotaEditando ? 'Salvar alterações' : 'Criar Rota'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalOverlay}>
          <div style={modalPanel} className="rounded-2xl p-6 text-center max-w-sm">
            <p className="text-white font-semibold mb-2">Excluir Rota?</p>
            <p className="text-sm text-slate-400 mb-6">
              A rota <span className="text-white font-mono">{getRotaId(confirmDelete)}</span> será removida permanentemente.
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
