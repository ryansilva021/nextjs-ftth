'use client'

import { useState, useTransition } from 'react'
import { aprovarRegistro, rejeitarRegistro } from '@/actions/registros'

const cardStyle = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
}

const modalBgStyle = {
  backgroundColor: 'rgba(0,0,0,0.7)',
}

const inputStyle = {
  backgroundColor: 'var(--inp-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--foreground)',
}

function StatusBadge({ status }) {
  const cores = {
    pendente: { bg: '#0c2340', color: '#38bdf8' },
    aprovado: { bg: '#052e16', color: '#4ade80' },
    rejeitado: { bg: '#1c0a0a', color: '#f87171' },
  }
  const c = cores[status] ?? cores.pendente
  return (
    <span
      style={{ backgroundColor: c.bg, color: c.color }}
      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
    >
      {status}
    </span>
  )
}

export default function RegistrosClient({ registrosIniciais }) {
  const [registros, setRegistros] = useState(registrosIniciais)
  const [filtro, setFiltro] = useState('pendente')
  const [modalRejeitar, setModalRejeitar] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()

  function flash(msg) {
    setSucesso(msg)
    setTimeout(() => setSucesso(null), 3000)
  }

  const registrosFiltrados = filtro === 'todos'
    ? registros
    : registros.filter((r) => r.status === filtro)

  function handleAprovar(registro) {
    startTransition(async () => {
      try {
        const res = await aprovarRegistro(registro._id)
        setRegistros((prev) =>
          prev.map((r) =>
            r._id === registro._id
              ? { ...r, status: 'aprovado', projeto_id: res.projeto_id }
              : r
          )
        )
        flash(`Empresa "${registro.empresa}" aprovada. Projeto: ${res.projeto_id}`)
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  function abrirRejeitar(registro) {
    setModalRejeitar(registro)
    setMotivo('')
    setErro(null)
  }

  function confirmarRejeitar() {
    if (!modalRejeitar) return
    startTransition(async () => {
      try {
        await rejeitarRegistro(modalRejeitar._id, motivo)
        setRegistros((prev) =>
          prev.map((r) =>
            r._id === modalRejeitar._id
              ? { ...r, status: 'rejeitado', motivo_rejeicao: motivo }
              : r
          )
        )
        flash(`Registro de ${modalRejeitar.username} rejeitado.`)
        setModalRejeitar(null)
        setMotivo('')
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  const counts = {
    pendente: registros.filter((r) => r.status === 'pendente').length,
    aprovado: registros.filter((r) => r.status === 'aprovado').length,
    rejeitado: registros.filter((r) => r.status === 'rejeitado').length,
    todos: registros.length,
  }

  return (
    <>
      {/* Tabs de filtro */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {['pendente', 'aprovado', 'rejeitado', 'todos'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              backgroundColor: filtro === f ? '#0c2340' : 'var(--card-bg)',
              border: `1px solid ${filtro === f ? '#0369a1' : 'var(--border-color)'}`,
              color: filtro === f ? '#38bdf8' : 'var(--text-secondary)',
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
          >
            {f} <span className="opacity-70">({counts[f]})</span>
          </button>
        ))}

        {sucesso && <p className="ml-auto text-sm text-green-400">{sucesso}</p>}
      </div>

      {erro && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          {erro}
        </div>
      )}

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--sidebar-bg)' }}>
                {['Empresa', 'Usuário (admin)', 'Projeto gerado', 'Data', 'Status', 'Motivo', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-12 text-sm">
                    Nenhum registro com status &quot;{filtro}&quot;.
                  </td>
                </tr>
              )}
              {registrosFiltrados.map((r, i) => (
                <tr
                  key={r._id}
                  style={{ borderBottom: i < registrosFiltrados.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-200 font-medium">{r.empresa ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-sky-400">{r.username}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {r.projeto_id ?? <span className="text-slate-600 italic">gerado na aprovação</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {r.solicitado_em
                      ? new Date(r.solicitado_em).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">
                    {r.motivo_rejeicao ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'pendente' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAprovar(r)}
                          disabled={isPending}
                          className="text-xs text-green-400 hover:text-green-300 disabled:opacity-40 transition-colors font-medium"
                        >
                          Aprovar
                        </button>
                        <span className="text-slate-700">|</span>
                        <button
                          onClick={() => abrirRejeitar(r)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Rejeitar
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600 italic">Processado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Rejeitar */}
      {modalRejeitar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalBgStyle}>
          <div style={cardStyle} className="rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-white mb-1">Rejeitar registro</h2>
            <p className="text-sm text-slate-400 mb-4">
              Usuário: <span className="text-white font-mono">{modalRejeitar.username}</span>
            </p>
            <div className="flex flex-col gap-1 mb-4">
              <label className="text-xs text-slate-400 uppercase tracking-wider">Motivo (opcional)</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Explique o motivo da rejeição..."
                rows={3}
                style={inputStyle}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            {erro && (
              <div
                style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
                className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
              >
                {erro}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setModalRejeitar(null)}
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                className="flex-1 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRejeitar}
                disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Rejeitando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
