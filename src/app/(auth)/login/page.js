'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        const msg = result.error
        if (msg.includes('rate_limited')) {
          const parts = msg.split(':')
          setErro(parts[2] || 'Muitas tentativas. Tente novamente mais tarde.')
        } else {
          setErro('Usuário ou senha inválidos.')
        }
      } else if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setErro('Erro inesperado. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="w-full max-w-sm px-6">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <Image src="/long-logo.svg" alt="FiberOps" width={160} height={40} priority />
      </div>

      {/* Card */}
      <div
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        className="rounded-2xl p-8"
      >
        <h2
          style={{ color: 'var(--foreground)' }}
          className="text-lg font-semibold mb-6"
        >
          Entrar na conta
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label
              style={{ color: 'var(--text-muted)' }}
              className="text-xs font-medium uppercase tracking-wider"
            >
              Usuário
            </label>
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="seu.usuario"
              style={{
                backgroundColor: 'var(--inp-bg)',
                border: '1px solid var(--border-color-strong)',
                color: 'var(--foreground)',
              }}
              className="rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              style={{ color: 'var(--text-muted)' }}
              className="text-xs font-medium uppercase tracking-wider"
            >
              Senha
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                backgroundColor: 'var(--inp-bg)',
                border: '1px solid var(--border-color-strong)',
                color: 'var(--foreground)',
              }}
              className="rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {erro && (
            <div
              style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
              className="rounded-lg px-4 py-3 text-sm text-red-400"
            >
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            style={{
              backgroundColor: 'var(--accent)',
              color: '#fff',
            }}
            className="mt-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold py-2.5 rounded-lg text-sm transition-opacity"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>

      {/* Link para cadastro */}
      <p style={{ color: 'var(--text-muted)' }} className="text-center text-sm mt-6">
        Sem conta?{' '}
        <Link
          href="/cadastro"
          style={{ color: 'var(--accent)' }}
          className="font-medium hover:opacity-80 transition-opacity"
        >
          Solicitar acesso
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
