'use client'

import { useState, useTransition } from 'react'
import { changePassword } from '@/actions/usuarios'

export const dynamic = 'force-dynamic'

const inputStyle = {
  backgroundColor: 'var(--inp-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--foreground)',
}

const cardStyle = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
}

export default function SenhaPage() {
  const [form, setForm] = useState({
    senhaAtual: '',
    novaSenha: '',
    confirmarSenha: '',
  })
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(false)
  const [erroCliente, setErroCliente] = useState(null)
  const [isPending, startTransition] = useTransition()

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErroCliente(null)
    setErro(null)
    setSucesso(false)
  }

  function validar() {
    if (!form.senhaAtual) return 'Informe a senha atual.'
    if (!form.novaSenha) return 'Informe a nova senha.'
    if (form.novaSenha.length < 8) return 'A nova senha deve ter no mínimo 8 caracteres.'
    if (form.novaSenha !== form.confirmarSenha)
      return 'A confirmação de senha não coincide com a nova senha.'
    if (form.novaSenha === form.senhaAtual)
      return 'A nova senha deve ser diferente da senha atual.'
    return null
  }

  function handleSubmit(e) {
    e.preventDefault()

    const erroVal = validar()
    if (erroVal) {
      setErroCliente(erroVal)
      return
    }

    setErro(null)
    setErroCliente(null)
    setSucesso(false)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('senhaAtual', form.senhaAtual)
      formData.set('novaSenha', form.novaSenha)
      formData.set('confirmarSenha', form.confirmarSenha)

      const resultado = await changePassword(formData)

      if (resultado?.error) {
        setErro(resultado.error)
      } else {
        setSucesso(true)
        setForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '' })
      }
    })
  }

  const erroExibido = erroCliente || erro

  return (
    <div className="p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Alterar Senha</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Troque a senha da sua conta de acesso.
        </p>
      </div>

      <div style={cardStyle} className="rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          {/* Senha atual */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="senhaAtual"
              className="text-xs text-slate-400 uppercase tracking-wider"
            >
              Senha atual
            </label>
            <input
              id="senhaAtual"
              name="senhaAtual"
              type="password"
              autoComplete="current-password"
              value={form.senhaAtual}
              onChange={handleChange}
              placeholder="Digite sua senha atual"
              style={inputStyle}
              className="rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              disabled={isPending}
            />
          </div>

          {/* Nova senha */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="novaSenha"
              className="text-xs text-slate-400 uppercase tracking-wider"
            >
              Nova senha
            </label>
            <input
              id="novaSenha"
              name="novaSenha"
              type="password"
              autoComplete="new-password"
              value={form.novaSenha}
              onChange={handleChange}
              placeholder="Mínimo 8 caracteres"
              style={inputStyle}
              className="rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              disabled={isPending}
            />
            {/* Indicador de força da senha */}
            {form.novaSenha.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((nivel) => {
                    const forca =
                      form.novaSenha.length >= 12 &&
                      /[A-Z]/.test(form.novaSenha) &&
                      /[0-9]/.test(form.novaSenha) &&
                      /[^A-Za-z0-9]/.test(form.novaSenha)
                        ? 4
                        : form.novaSenha.length >= 10 &&
                          (/[A-Z]/.test(form.novaSenha) || /[0-9]/.test(form.novaSenha))
                        ? 3
                        : form.novaSenha.length >= 8
                        ? 2
                        : 1
                    const cor =
                      forca === 4
                        ? '#22c55e'
                        : forca === 3
                        ? '#84cc16'
                        : forca === 2
                        ? '#f59e0b'
                        : '#ef4444'
                    return (
                      <div
                        key={nivel}
                        style={{
                          backgroundColor: nivel <= forca ? cor : 'var(--border-color)',
                          width: 28,
                          height: 3,
                          borderRadius: 2,
                        }}
                      />
                    )
                  })}
                </div>
                <span className="text-xs text-slate-500">
                  {form.novaSenha.length < 8
                    ? 'Fraca'
                    : form.novaSenha.length < 10
                    ? 'Razoável'
                    : form.novaSenha.length < 12
                    ? 'Boa'
                    : 'Forte'}
                </span>
              </div>
            )}
          </div>

          {/* Confirmar nova senha */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="confirmarSenha"
              className="text-xs text-slate-400 uppercase tracking-wider"
            >
              Confirmar nova senha
            </label>
            <input
              id="confirmarSenha"
              name="confirmarSenha"
              type="password"
              autoComplete="new-password"
              value={form.confirmarSenha}
              onChange={handleChange}
              placeholder="Repita a nova senha"
              style={{
                ...inputStyle,
                ...(form.confirmarSenha &&
                  form.novaSenha !== form.confirmarSenha && {
                    border: '1px solid #7f1d1d',
                  }),
                ...(form.confirmarSenha &&
                  form.novaSenha === form.confirmarSenha && {
                    border: '1px solid #14532d',
                  }),
              }}
              className="rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              disabled={isPending}
            />
            {form.confirmarSenha && form.novaSenha !== form.confirmarSenha && (
              <p className="text-xs text-red-400 mt-0.5">As senhas não coincidem.</p>
            )}
            {form.confirmarSenha && form.novaSenha === form.confirmarSenha && (
              <p className="text-xs text-green-400 mt-0.5">Senhas coincidem.</p>
            )}
          </div>

          {/* Erro */}
          {erroExibido && (
            <div
              style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
              className="rounded-lg px-4 py-3 text-sm text-red-400"
            >
              {erroExibido}
            </div>
          )}

          {/* Sucesso */}
          {sucesso && (
            <div
              style={{ backgroundColor: '#052e16', border: '1px solid #14532d' }}
              className="rounded-lg px-4 py-3 text-sm text-green-400"
            >
              Senha alterada com sucesso!
            </div>
          )}

          {/* Botão */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isPending || !form.senhaAtual || !form.novaSenha || !form.confirmarSenha}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              {isPending ? 'Salvando...' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </div>

      {/* Dicas de segurança */}
      <div
        style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border-color)' }}
        className="rounded-xl px-4 py-3 mt-4"
      >
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">
          Dicas de segurança
        </p>
        <ul className="text-xs text-slate-600 flex flex-col gap-1 list-disc list-inside">
          <li>Use no mínimo 8 caracteres</li>
          <li>Combine letras maiúsculas, minúsculas, números e símbolos</li>
          <li>Não reutilize senhas de outros serviços</li>
          <li>Não compartilhe sua senha com ninguém</li>
        </ul>
      </div>
    </div>
  )
}
