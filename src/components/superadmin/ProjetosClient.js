'use client'

import { useState, useTransition } from 'react'
import { upsertProjeto, deleteProjeto, limparProjeto, toggleProjetoAtivo } from '@/actions/projetos'

const inputStyle = {
  backgroundColor: '#0b1220',
  border: '1px solid #1f2937',
  color: '#f1f5f9',
}

const cardStyle = {
  backgroundColor: '#111827',
  border: '1px solid #1f2937',
}

const modalBgStyle = {
  backgroundColor: 'rgba(0,0,0,0.7)',
}

function StatChip({ label, value }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold text-white">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}

export default function ProjetosClient({ projetosIniciais }) {
  const [projetos, setProjetos] = useState(projetosIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmLimpar, setConfirmLimpar] = useState(null)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    projeto_id: '',
    nome: '',
    descricao: '',
    is_active: true,
  })

  function flash(msg) {
    setSucesso(msg)
    setTimeout(() => setSucesso(null), 3000)
  }

  function abrirNovo() {
    setForm({ projeto_id: '', nome: '', descricao: '', is_active: true })
    setEditando(null)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEditar(p) {
    setForm({
      projeto_id: p.projeto_id,
      nome: p.nome,
      descricao: p.descricao ?? '',
      is_active: p.is_active ?? true,
    })
    setEditando(p)
    setErro(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
    setErro(null)
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleSalvar() {
    setErro(null)
    startTransition(async () => {
      try {
        const resultado = await upsertProjeto(form)
        if (editando) {
          setProjetos((prev) =>
            prev.map((p) =>
              p.projeto_id === resultado.projeto_id ? { ...p, ...resultado } : p
            )
          )
        } else {
          setProjetos((prev) => [{ ...resultado, ctos: 0, usuarios: 0, rotas: 0 }, ...prev])
        }
        flash(editando ? 'Projeto atualizado.' : 'Projeto criado com sucesso.')
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
        await deleteProjeto(confirmDelete.projeto_id)
        setProjetos((prev) => prev.filter((p) => p.projeto_id !== confirmDelete.projeto_id))
        flash('Projeto e todos os dados foram removidos.')
      } catch (e) {
        setErro(e.message)
      } finally {
        setConfirmDelete(null)
      }
    })
  }

  function handleToggleAtivo(p) {
    startTransition(async () => {
      try {
        const res = await toggleProjetoAtivo(p.projeto_id)
        setProjetos((prev) =>
          prev.map((proj) =>
            proj.projeto_id === p.projeto_id ? { ...proj, is_active: res.ativo } : proj
          )
        )
        flash(`Projeto ${p.projeto_id} ${res.ativo ? 'ativado' : 'desativado'}.`)
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  function confirmarLimpar() {
    if (!confirmLimpar) return
    startTransition(async () => {
      try {
        const res = await limparProjeto(confirmLimpar.projeto_id)
        flash(`Projeto limpo. Coleções removidas: ${res.colecoesLimpas.join(', ')}.`)
      } catch (e) {
        setErro(e.message)
      } finally {
        setConfirmLimpar(null)
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        {sucesso ? <p className="text-sm text-green-400">{sucesso}</p> : <div />}
        <button
          onClick={abrirNovo}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Novo Projeto
        </button>
      </div>

      {erro && !modalAberto && !confirmDelete && !confirmLimpar && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          {erro}
        </div>
      )}

      {/* Grid de projetos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projetos.length === 0 && (
          <p className="text-slate-500 text-sm col-span-full py-12 text-center">
            Nenhum projeto cadastrado.
          </p>
        )}
        {projetos.map((p) => (
          <div key={p._id} style={cardStyle} className="rounded-xl p-5 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm">{p.nome}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{p.projeto_id}</p>
              </div>
              <span
                style={{
                  backgroundColor: p.is_active ? '#052e16' : '#1c0a0a',
                  color: p.is_active ? '#4ade80' : '#f87171',
                }}
                className="text-xs px-2 py-0.5 rounded-full font-medium"
              >
                {p.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            {p.descricao && (
              <p className="text-xs text-slate-400 leading-relaxed">{p.descricao}</p>
            )}

            {/* Stats */}
            <div
              style={{ backgroundColor: '#0b1220', border: '1px solid #1f2937' }}
              className="rounded-lg p-3 grid grid-cols-4 gap-2 text-center"
            >
              <StatChip label="CTOs" value={p.ctos ?? 0} />
              <StatChip label="Usuários" value={p.usuarios ?? 0} />
              <StatChip label="Rotas" value={p.rotas ?? 0} />
              <StatChip label="Postes" value={p.postes ?? 0} />
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                onClick={() => handleToggleAtivo(p)}
                disabled={isPending}
                style={{
                  border: `1px solid ${p.is_active ? '#166534' : '#1f2937'}`,
                  color: p.is_active ? '#4ade80' : '#94a3b8',
                }}
                className="flex-1 text-xs py-1.5 rounded-lg hover:opacity-80 transition-colors disabled:opacity-40"
              >
                {p.is_active ? '✓ Desativar' : '▶ Ativar'}
              </button>
              <button
                onClick={() => abrirEditar(p)}
                style={{ border: '1px solid #1f2937', color: '#94a3b8' }}
                className="flex-1 text-xs py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => setConfirmLimpar(p)}
                style={{ border: '1px solid #1f2937', color: '#fbbf24' }}
                className="flex-1 text-xs py-1.5 rounded-lg hover:bg-amber-900/20 transition-colors"
              >
                Limpar
              </button>
              <button
                onClick={() => setConfirmDelete(p)}
                style={{ border: '1px solid #1f2937', color: '#f87171' }}
                className="flex-1 text-xs py-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Criar/Editar */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalBgStyle}>
          <div style={cardStyle} className="rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-white mb-5">
              {editando ? 'Editar Projeto' : 'Novo Projeto'}
            </h2>
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">ID do Projeto *</label>
                <input
                  name="projeto_id"
                  value={form.projeto_id}
                  onChange={handleFormChange}
                  disabled={!!editando}
                  placeholder="ex: fibra-norte"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 font-mono"
                />
                <p className="text-xs text-slate-500">Apenas letras, números, _ e - (sem espaços)</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Nome *</label>
                <input
                  name="nome"
                  value={form.nome}
                  onChange={handleFormChange}
                  placeholder="Nome legível do projeto"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Descrição</label>
                <textarea
                  name="descricao"
                  value={form.descricao}
                  onChange={handleFormChange}
                  placeholder="Descrição opcional"
                  rows={2}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleFormChange}
                  className="accent-violet-500"
                />
                <span className="text-sm text-slate-300">Projeto ativo</span>
              </label>
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
                disabled={isPending || !form.projeto_id || !form.nome}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalBgStyle}>
          <div style={cardStyle} className="rounded-2xl w-full max-w-sm p-6 text-center">
            <p className="text-red-400 font-bold text-sm mb-1">Atenção: ação irreversível</p>
            <p className="text-white font-semibold mb-2">Excluir projeto?</p>
            <p className="text-sm text-slate-400 mb-6">
              O projeto <span className="text-white font-mono">{confirmDelete.projeto_id}</span> e{' '}
              <strong className="text-red-400">todos os seus dados</strong> serão removidos
              permanentemente.
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
                {isPending ? 'Removendo...' : 'Excluir tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm limpar */}
      {confirmLimpar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalBgStyle}>
          <div style={cardStyle} className="rounded-2xl w-full max-w-sm p-6 text-center">
            <p className="text-white font-semibold mb-2">Limpar dados do projeto?</p>
            <p className="text-sm text-slate-400 mb-6">
              Todos os dados de campo do projeto{' '}
              <span className="text-white font-mono">{confirmLimpar.projeto_id}</span> (CTOs, rotas,
              postes, etc.) serão removidos. Usuários e o projeto serão mantidos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmLimpar(null)}
                style={{ border: '1px solid #1f2937', color: '#94a3b8' }}
                className="flex-1 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarLimpar}
                disabled={isPending}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Limpando...' : 'Limpar dados'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
