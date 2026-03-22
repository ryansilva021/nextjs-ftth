'use client'

import { useState, useTransition } from 'react'
import { registrarMovimentacao } from '@/actions/movimentacoes'

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

const TIPOS = ['instalacao', 'desinstalacao', 'troca', 'manutencao']

const TIPO_CORES = {
  instalacao: 'text-green-400',
  desinstalacao: 'text-red-400',
  troca: 'text-yellow-400',
  manutencao: 'text-blue-400',
}

const TIPO_BG = {
  instalacao: { backgroundColor: '#052e16', border: '1px solid #16a34a' },
  desinstalacao: { backgroundColor: '#450a0a', border: '1px solid #dc2626' },
  troca: { backgroundColor: '#422006', border: '1px solid #d97706' },
  manutencao: { backgroundColor: 'var(--card-bg-active)', border: '1px solid #2563eb' },
}

function formatarData(dataStr) {
  if (!dataStr) return '—'
  try {
    return new Date(dataStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dataStr
  }
}

export default function MovimentacoesClient({ movimentacoesIniciais, projetoId, userRole }) {
  const [movimentacoes, setMovimentacoes] = useState(movimentacoesIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    cto_id: '',
    tipo: 'instalacao',
    cliente: '',
    porta: '',
    observacao: '',
  })

  function abrirNovo() {
    setForm({ cto_id: '', tipo: 'instalacao', cliente: '', porta: '', observacao: '' })
    setErro(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setErro(null)
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleRegistrar() {
    setErro(null)
    startTransition(async () => {
      try {
        const resultado = await registrarMovimentacao({
          projeto_id: projetoId,
          cto_id: form.cto_id,
          tipo: form.tipo,
          cliente: form.cliente,
          porta: form.porta ? parseInt(form.porta) : null,
          observacao: form.observacao || null,
        })
        setMovimentacoes((prev) => [resultado, ...prev])
        setSucesso('Movimentação registrada com sucesso.')
        setTimeout(() => setSucesso(null), 3000)
        fecharModal()
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  const tipoNorm = (tipo) => {
    if (!tipo) return 'desconhecido'
    const t = tipo.toLowerCase()
    if (t.includes('instal')) return 'instalacao'
    if (t.includes('desins') || t.includes('remov') || t.includes('cancel')) return 'desinstalacao'
    if (t.includes('troca')) return 'troca'
    if (t.includes('manut')) return 'manutencao'
    return t
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
          + Registrar Movimentação
        </button>
      </div>

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
                {['CTO', 'Tipo', 'Cliente', 'Porta', 'Técnico', 'Data/Hora', 'Observação'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimentacoes.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-12 text-sm">
                    Nenhuma movimentação registrada ainda.
                  </td>
                </tr>
              )}
              {movimentacoes.map((mov, i) => {
                const norm = tipoNorm(mov.tipo)
                const corTexto = TIPO_CORES[norm] ?? 'text-slate-300'
                const bgStyle = TIPO_BG[norm] ?? {}
                return (
                  <tr
                    key={mov._id}
                    style={{ borderBottom: i < movimentacoes.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-sky-400">{mov.cto_id}</td>
                    <td className="px-4 py-3">
                      <span
                        style={bgStyle}
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${corTexto}`}
                      >
                        {mov.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-200">{mov.cliente}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {mov.porta != null ? `Porta ${mov.porta}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{mov.usuario ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {formatarData(mov.data)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">
                      {mov.observacao ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Movimentação */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-white mb-5">
              Registrar Movimentação
            </h2>

            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">ID da CTO *</label>
                <input
                  name="cto_id"
                  value={form.cto_id}
                  onChange={handleFormChange}
                  placeholder="ex: CTO-001"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Tipo *</label>
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
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Cliente *</label>
                <input
                  name="cliente"
                  value={form.cliente}
                  onChange={handleFormChange}
                  placeholder="Nome do cliente"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Porta</label>
                <input
                  name="porta"
                  value={form.porta}
                  onChange={handleFormChange}
                  placeholder="ex: 1"
                  type="number"
                  min={1}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Observação</label>
                <textarea
                  name="observacao"
                  value={form.observacao}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Detalhes da movimentação..."
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
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                className="px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrar}
                disabled={isPending || !form.cto_id || !form.cliente || !form.tipo}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
