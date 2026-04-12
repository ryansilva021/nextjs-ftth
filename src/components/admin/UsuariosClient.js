'use client'

import { useState, useTransition } from 'react'
import {
  upsertUsuario,
  deleteUsuario,
  toggleUsuarioAtivo,
  setPassword,
} from '@/actions/usuarios'
import { ROLE_LABELS } from '@/lib/permissions'

// Roles que um admin pode atribuir (superadmin só via painel superadmin)
const ROLES = ['user', 'recepcao', 'tecnico', 'noc', 'admin']

const ROLE_DESCRIPTIONS = {
  user:     'Somente visualização do mapa',
  recepcao: 'Criar OS, visualizar e editar clientes',
  tecnico:  'Acessar Topologia, executar e concluir OS',
  noc:      'Acessar NOC, monitorar OLTs e ONUs',
  admin:    'Acesso completo ao projeto',
}

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
  backgroundColor: 'rgba(0,0,0,0.7)',
}

function RoleBadge({ role }) {
  const cores = {
    superadmin: { bg: 'rgba(124,58,237,0.18)', color: '#5b21b6', border: 'rgba(124,58,237,0.4)' },
    admin:      { bg: 'rgba(2,132,199,0.15)',  color: '#0369a1',  border: 'rgba(2,132,199,0.4)' },
    tecnico:    { bg: 'rgba(22,163,74,0.15)',  color: '#15803d',  border: 'rgba(22,163,74,0.4)' },
    noc:        { bg: 'rgba(99,102,241,0.15)', color: '#4338ca',  border: 'rgba(99,102,241,0.4)' },
    recepcao:   { bg: 'rgba(234,88,12,0.15)',  color: '#c2410c',  border: 'rgba(234,88,12,0.4)' },
    user:       { bg: 'rgba(120,113,108,0.15)',color: '#57534e',  border: 'rgba(120,113,108,0.4)' },
  }
  const c = cores[role] ?? cores.user
  return (
    <span
      style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}
      className="text-xs px-2 py-0.5 rounded-full font-medium"
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

function StatusBadge({ ativo }) {
  return (
    <span
      style={{
        backgroundColor: ativo ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)',
        color: ativo ? '#15803d' : '#b91c1c',
        border: `1px solid ${ativo ? 'rgba(22,163,74,0.4)' : 'rgba(239,68,68,0.4)'}`,
      }}
      className="text-xs px-2 py-0.5 rounded-full font-medium"
    >
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}

export default function UsuariosClient({
  usuariosIniciais,
  projetoId,
  userRole,
  currentUsername,
}) {
  const [usuarios, setUsuarios] = useState(usuariosIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalSenha, setModalSenha] = useState(null)
  const [editando, setEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    username: '',
    role: 'user',
    email: '',
    nome_completo: '',
    password: '',
    must_change_password: false,
  })

  const [novaSenha, setNovaSenha] = useState('')

  function flash(msg) {
    setSucesso(msg)
    setTimeout(() => setSucesso(null), 3000)
  }

  function abrirNovo() {
    setForm({ username: '', role: 'user', email: '', nome_completo: '', password: '', must_change_password: false })
    setEditando(null)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEditar(u) {
    setForm({
      username: u.username,
      role: u.role,
      email: u.email ?? '',
      nome_completo: u.nome_completo ?? '',
      password: '',
      must_change_password: u.must_change_password ?? false,
    })
    setEditando(u)
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
        const resultado = await upsertUsuario({ ...form, projeto_id: projetoId })
        if (editando) {
          setUsuarios((prev) => prev.map((u) => (u.username === resultado.username ? resultado : u)))
        } else {
          setUsuarios((prev) => [resultado, ...prev])
        }
        flash(editando ? 'Usuário atualizado.' : 'Usuário criado com sucesso.')
        fecharModal()
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  function handleToggleAtivo(u) {
    startTransition(async () => {
      try {
        const res = await toggleUsuarioAtivo(u.username, projetoId)
        setUsuarios((prev) =>
          prev.map((x) => (x.username === u.username ? { ...x, is_active: res.is_active } : x))
        )
        flash(`Usuário ${res.is_active ? 'ativado' : 'desativado'}.`)
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  function handleExcluir(u) {
    setConfirmDelete(u)
  }

  function confirmarExclusao() {
    if (!confirmDelete) return
    startTransition(async () => {
      try {
        await deleteUsuario(confirmDelete.username, projetoId)
        setUsuarios((prev) => prev.filter((u) => u.username !== confirmDelete.username))
        flash('Usuário removido.')
      } catch (e) {
        setErro(e.message)
      } finally {
        setConfirmDelete(null)
      }
    })
  }

  function handleRedefinirSenha() {
    if (!modalSenha || !novaSenha) return
    startTransition(async () => {
      try {
        await setPassword(modalSenha.username, novaSenha, projetoId)
        flash('Senha redefinida com sucesso.')
        setModalSenha(null)
        setNovaSenha('')
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        {sucesso ? <p className="text-sm text-green-400">{sucesso}</p> : <div />}
        <button
          onClick={abrirNovo}
          className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Novo Usuário
        </button>
      </div>

      {erro && !modalAberto && !confirmDelete && !modalSenha && (
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
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
                {['Usuário', 'Nome', 'Role', 'Status', 'Último login', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500 py-12 text-sm">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
              {usuarios.map((u, i) => {
                const isSelf = u.username === currentUsername
                return (
                  <tr
                    key={u._id}
                    style={{ borderBottom: i < usuarios.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-sky-400">{u.username}</td>
                    <td className="px-4 py-3 text-slate-200">{u.nome_completo ?? '—'}</td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3"><StatusBadge ativo={u.is_active} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => abrirEditar(u)}
                          className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                        >
                          Editar
                        </button>
                        {!isSelf && (
                          <>
                            <span className="text-slate-700">|</span>
                            <button
                              onClick={() => handleToggleAtivo(u)}
                              disabled={isPending}
                              className="text-xs text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-40"
                            >
                              {u.is_active ? 'Desativar' : 'Ativar'}
                            </button>
                            <span className="text-slate-700">|</span>
                            <button
                              onClick={() => { setModalSenha(u); setNovaSenha(''); setErro(null) }}
                              className="text-xs text-slate-400 hover:text-white transition-colors"
                            >
                              Senha
                            </button>
                            <span className="text-slate-700">|</span>
                            <button
                              onClick={() => handleExcluir(u)}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar/Editar */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalBgStyle}>
          <div style={cardStyle} className="rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-5">
              {editando ? 'Editar Usuário' : 'Novo Usuário'}
            </h2>
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Usuário *</label>
                <input
                  name="username"
                  value={form.username}
                  onChange={handleFormChange}
                  disabled={!!editando}
                  placeholder="nome.usuario"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Nome completo</label>
                <input
                  name="nome_completo"
                  value={form.nome_completo}
                  onChange={handleFormChange}
                  placeholder="Ex: João da Silva"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">E-mail</label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleFormChange}
                  placeholder="email@empresa.com"
                  type="email"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Role</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleFormChange}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                  ))}
                </select>
                {form.role && ROLE_DESCRIPTIONS[form.role] && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {ROLE_DESCRIPTIONS[form.role]}
                  </p>
                )}
              </div>
              {!editando && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Senha inicial *</label>
                  <input
                    name="password"
                    value={form.password}
                    onChange={handleFormChange}
                    type="password"
                    placeholder="mínimo 6 caracteres"
                    style={inputStyle}
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="must_change_password"
                  checked={form.must_change_password}
                  onChange={handleFormChange}
                  className="accent-sky-500"
                />
                <span className="text-sm text-slate-300">Forçar troca de senha no próximo login</span>
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
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                className="px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={isPending || !form.username}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal redefinir senha */}
      {modalSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalBgStyle}>
          <div style={cardStyle} className="rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-1">Redefinir Senha</h2>
            <p className="text-sm text-slate-400 mb-4">
              Usuário: <span className="text-slate-100 font-mono">{modalSenha.username}</span>
            </p>
            <div className="flex flex-col gap-1 mb-4">
              <label className="text-xs text-slate-400 uppercase tracking-wider">Nova senha</label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="mínimo 6 caracteres"
                style={inputStyle}
                className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                onClick={() => { setModalSenha(null); setErro(null) }}
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                className="flex-1 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRedefinirSenha}
                disabled={isPending || novaSenha.length < 6}
                className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Salvando...' : 'Redefinir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalBgStyle}>
          <div style={cardStyle} className="rounded-2xl w-full max-w-sm p-6 text-center">
            <p className="text-slate-100 font-semibold mb-2">Excluir usuário?</p>
            <p className="text-sm text-slate-400 mb-6">
              O usuário <span className="text-slate-100 font-mono">{confirmDelete.username}</span> será
              removido permanentemente.
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
                {isPending ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
