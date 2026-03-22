'use client'

import { useState, useTransition } from 'react'
import {
  upsertEmpresa,
  bloquearEmpresa,
  desbloquearEmpresa,
  deleteEmpresa,
} from '@/actions/empresas'

// ---------------------------------------------------------------------------
// Estilos compartilhados
// ---------------------------------------------------------------------------

const inputStyle = {
  backgroundColor: 'var(--inp-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--foreground)',
}

const cardStyle = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
}

const modalBgStyle = {
  backgroundColor: 'rgba(0,0,0,0.75)',
}

const tableHeaderStyle = {
  backgroundColor: 'var(--background)',
  color: 'var(--text-secondary)',
}

// ---------------------------------------------------------------------------
// Helpers de badge de status
// ---------------------------------------------------------------------------

const STATUS_BADGE = {
  ativo: { bg: '#052e16', color: '#4ade80', label: 'Ativo' },
  trial: { bg: '#1e3a5f', color: '#60a5fa', label: 'Trial' },
  vencido: { bg: '#3b2a00', color: '#fbbf24', label: 'Vencido' },
  bloqueado: { bg: '#450a0a', color: '#f87171', label: 'Bloqueado' },
}

const PLANO_LABEL = {
  trial: 'Trial',
  basico: 'Básico',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || { bg: 'var(--border-color)', color: 'var(--text-secondary)', label: status }
  return (
    <span
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
      className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
    >
      {cfg.label}
    </span>
  )
}

function formatarData(isoString) {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

// ---------------------------------------------------------------------------
// Formulário inicial vazio
// ---------------------------------------------------------------------------

const FORM_VAZIO = {
  _id: '',
  razao_social: '',
  slug: '',
  cnpj: '',
  email_contato: '',
  telefone_contato: '',
  plano: 'basico',
  status_assinatura: 'trial',
  data_vencimento: '',
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function EmpresasClient({ empresasIniciais }) {
  const [empresas, setEmpresas] = useState(empresasIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmBloquear, setConfirmBloquear] = useState(null)
  const [motivoBloqueio, setMotivoBloqueio] = useState('')
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState(FORM_VAZIO)

  // ── Feedback temporário ──────────────────────────────────────────────────

  function flash(msg) {
    setSucesso(msg)
    setTimeout(() => setSucesso(null), 3500)
  }

  function flashErro(msg) {
    setErro(msg)
    setTimeout(() => setErro(null), 5000)
  }

  // ── Abertura de modal ────────────────────────────────────────────────────

  function abrirNovo() {
    setForm(FORM_VAZIO)
    setEditando(null)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEditar(empresa) {
    setForm({
      _id: empresa._id,
      razao_social: empresa.razao_social ?? '',
      slug: empresa.slug ?? '',
      cnpj: empresa.cnpj ?? '',
      email_contato: empresa.email_contato ?? '',
      telefone_contato: empresa.telefone_contato ?? '',
      plano: empresa.plano ?? 'basico',
      status_assinatura: empresa.status_assinatura ?? 'trial',
      data_vencimento: empresa.data_vencimento
        ? empresa.data_vencimento.substring(0, 10)
        : '',
    })
    setEditando(empresa)
    setErro(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
    setErro(null)
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // ── Salvar (criar ou editar) ─────────────────────────────────────────────

  function handleSalvar() {
    setErro(null)
    startTransition(async () => {
      try {
        const resultado = await upsertEmpresa(form)
        if (editando) {
          setEmpresas((prev) =>
            prev.map((e) => (e._id === resultado._id ? { ...e, ...resultado } : e))
          )
          flash('Empresa atualizada com sucesso.')
        } else {
          setEmpresas((prev) => [resultado, ...prev])
          flash('Empresa criada com sucesso.')
        }
        fecharModal()
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  // ── Bloquear empresa ─────────────────────────────────────────────────────

  function abrirConfirmBloquear(empresa) {
    setConfirmBloquear(empresa)
    setMotivoBloqueio('')
  }

  function confirmarBloquear() {
    if (!confirmBloquear) return
    startTransition(async () => {
      try {
        const resultado = await bloquearEmpresa(confirmBloquear._id, motivoBloqueio)
        setEmpresas((prev) =>
          prev.map((e) =>
            e._id === resultado._id
              ? { ...e, status_assinatura: 'bloqueado', motivo_bloqueio: resultado.motivo_bloqueio }
              : e
          )
        )
        flash(`Empresa "${confirmBloquear.razao_social}" bloqueada.`)
      } catch (e) {
        flashErro(e.message)
      } finally {
        setConfirmBloquear(null)
        setMotivoBloqueio('')
      }
    })
  }

  // ── Desbloquear empresa ──────────────────────────────────────────────────

  function handleDesbloquear(empresa) {
    startTransition(async () => {
      try {
        const resultado = await desbloquearEmpresa(empresa._id)
        setEmpresas((prev) =>
          prev.map((e) =>
            e._id === resultado._id
              ? { ...e, status_assinatura: 'ativo', motivo_bloqueio: null }
              : e
          )
        )
        flash(`Empresa "${empresa.razao_social}" desbloqueada.`)
      } catch (e) {
        flashErro(e.message)
      }
    })
  }

  // ── Excluir (soft delete) ────────────────────────────────────────────────

  function confirmarExclusao() {
    if (!confirmDelete) return
    startTransition(async () => {
      try {
        await deleteEmpresa(confirmDelete._id)
        setEmpresas((prev) => prev.filter((e) => e._id !== confirmDelete._id))
        flash('Empresa desativada com sucesso.')
      } catch (e) {
        flashErro(e.message)
      } finally {
        setConfirmDelete(null)
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Barra superior: feedback + botão novo */}
      <div className="flex items-center justify-between mb-4">
        {sucesso ? (
          <p className="text-sm text-green-400">{sucesso}</p>
        ) : (
          <div />
        )}
        <button
          onClick={abrirNovo}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nova Empresa
        </button>
      </div>

      {/* Erro global (fora de modais) */}
      {erro && !modalAberto && !confirmDelete && !confirmBloquear && (
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
              <tr style={tableHeaderStyle}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                  Empresa
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                  CNPJ
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                  Plano
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {empresas.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-slate-500 text-sm"
                  >
                    Nenhuma empresa cadastrada.
                  </td>
                </tr>
              )}
              {empresas.map((empresa, idx) => (
                <tr
                  key={empresa._id}
                  style={{
                    borderTop: idx === 0 ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  {/* Empresa */}
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{empresa.razao_social}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{empresa.slug}</p>
                  </td>

                  {/* CNPJ */}
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                    {empresa.cnpj
                      ? empresa.cnpj.replace(
                          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                          '$1.$2.$3/$4-$5'
                        )
                      : '—'}
                  </td>

                  {/* Plano */}
                  <td className="px-4 py-3 text-slate-300">
                    {PLANO_LABEL[empresa.plano] || empresa.plano || '—'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={empresa.status_assinatura} />
                    {empresa.status_assinatura === 'bloqueado' && empresa.motivo_bloqueio && (
                      <p className="text-xs text-slate-500 mt-1 max-w-[180px] truncate">
                        {empresa.motivo_bloqueio}
                      </p>
                    )}
                  </td>

                  {/* Vencimento */}
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {formatarData(empresa.data_vencimento)}
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => abrirEditar(empresa)}
                        disabled={isPending}
                        style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                        className="text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40"
                      >
                        Editar
                      </button>

                      {empresa.status_assinatura !== 'bloqueado' ? (
                        <button
                          onClick={() => abrirConfirmBloquear(empresa)}
                          disabled={isPending}
                          style={{ border: '1px solid #7f1d1d', color: '#f87171' }}
                          className="text-xs px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-40"
                        >
                          Bloquear
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDesbloquear(empresa)}
                          disabled={isPending}
                          style={{ border: '1px solid #14532d', color: '#4ade80' }}
                          className="text-xs px-3 py-1.5 rounded-lg hover:bg-green-900/20 transition-colors disabled:opacity-40"
                        >
                          Desbloquear
                        </button>
                      )}

                      <button
                        onClick={() => setConfirmDelete(empresa)}
                        disabled={isPending}
                        style={{ border: '1px solid var(--border-color-strong)', color: 'var(--text-muted)' }}
                        className="text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 hover:text-red-400 transition-colors disabled:opacity-40"
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

      {/* ── Modal Criar / Editar ────────────────────────────────────────────── */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-5">
              {editando ? 'Editar Empresa' : 'Nova Empresa'}
            </h2>

            <div className="flex flex-col gap-4 mb-4">
              {/* Razão Social */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">
                  Razão Social *
                </label>
                <input
                  name="razao_social"
                  value={form.razao_social}
                  onChange={handleFormChange}
                  placeholder="Nome legal da empresa"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Slug */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">
                  Slug *
                </label>
                <input
                  name="slug"
                  value={form.slug}
                  onChange={handleFormChange}
                  disabled={!!editando}
                  placeholder="ex: fibra-norte"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                />
                {!editando && (
                  <p className="text-xs text-slate-500">
                    Apenas letras minúsculas, números, _ e - (sem espaços). Não pode ser alterado depois.
                  </p>
                )}
              </div>

              {/* CNPJ */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">CNPJ</label>
                <input
                  name="cnpj"
                  value={form.cnpj}
                  onChange={handleFormChange}
                  placeholder="Somente 14 dígitos (sem pontuação)"
                  maxLength={14}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* E-mail */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">E-mail</label>
                <input
                  name="email_contato"
                  type="email"
                  value={form.email_contato}
                  onChange={handleFormChange}
                  placeholder="contato@empresa.com.br"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Telefone */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Telefone</label>
                <input
                  name="telefone_contato"
                  value={form.telefone_contato}
                  onChange={handleFormChange}
                  placeholder="(11) 99999-9999"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Plano + Status em linha */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Plano</label>
                  <select
                    name="plano"
                    value={form.plano}
                    onChange={handleFormChange}
                    style={inputStyle}
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="basico">Básico</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">
                    Status da Assinatura
                  </label>
                  <select
                    name="status_assinatura"
                    value={form.status_assinatura}
                    onChange={handleFormChange}
                    style={inputStyle}
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="trial">Trial</option>
                    <option value="ativo">Ativo</option>
                    <option value="vencido">Vencido</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              {/* Data de vencimento */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">
                  Data de Vencimento
                </label>
                <input
                  name="data_vencimento"
                  type="date"
                  value={form.data_vencimento}
                  onChange={handleFormChange}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Erro dentro do modal */}
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
                onClick={handleSalvar}
                disabled={isPending || !form.razao_social.trim()}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Bloqueio ────────────────────────────────────────── */}
      {confirmBloquear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-sm p-6">
            <p className="text-red-400 font-bold text-sm mb-1">Bloquear acesso</p>
            <p className="text-white font-semibold mb-2">
              {confirmBloquear.razao_social}
            </p>
            <p className="text-sm text-slate-400 mb-4">
              Todos os usuários desta empresa perderão acesso imediatamente.
            </p>
            <div className="flex flex-col gap-1 mb-5">
              <label className="text-xs text-slate-400 uppercase tracking-wider">
                Motivo do bloqueio
              </label>
              <textarea
                value={motivoBloqueio}
                onChange={(e) => setMotivoBloqueio(e.target.value)}
                placeholder="Descreva o motivo (opcional)"
                rows={3}
                style={inputStyle}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmBloquear(null)}
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                className="flex-1 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBloquear}
                disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Bloqueando...' : 'Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Exclusão ────────────────────────────────────────── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-sm p-6 text-center">
            <p className="text-red-400 font-bold text-sm mb-1">Desativar empresa</p>
            <p className="text-white font-semibold mb-2">{confirmDelete.razao_social}</p>
            <p className="text-sm text-slate-400 mb-6">
              A empresa será desativada (soft delete). Os dados são preservados, mas o acesso
              será negado a todos os usuários vinculados.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                className="flex-1 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExclusao}
                disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Desativando...' : 'Desativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
