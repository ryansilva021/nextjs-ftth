import Link from 'next/link'
import { auth } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/permissions'

export const metadata = { title: 'Acesso Restrito | FiberOps' }

export default async function AcessoNegadoPage() {
  const session = await auth()
  const role    = session?.user?.role ?? 'user'
  const label   = ROLE_LABELS[role] ?? role

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
      background: 'var(--background)',
    }}>
      <div style={{
        textAlign: 'center', maxWidth: 480,
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: 16, padding: '40px 32px',
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>

        <h1 style={{
          fontSize: 22, fontWeight: 700, color: 'var(--foreground)',
          margin: '0 0 8px',
        }}>
          Acesso restrito
        </h1>

        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.6 }}>
          Seu perfil <strong style={{ color: 'var(--text-secondary)' }}>{label}</strong> não tem
          permissão para acessar esta página.
        </p>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 28px', lineHeight: 1.6 }}>
          Se acredita que isso é um erro, contate o administrador do sistema.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{
            padding: '9px 22px', borderRadius: 8,
            background: '#0284c7', color: '#fff',
            fontWeight: 600, fontSize: 13, textDecoration: 'none',
            display: 'inline-block',
          }}>
            ← Voltar ao Mapa
          </Link>

          {session && (
            <Link href="/perfil" style={{
              padding: '9px 22px', borderRadius: 8,
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              fontSize: 13, textDecoration: 'none',
              display: 'inline-block',
            }}>
              Meu Perfil
            </Link>
          )}
        </div>

        <div style={{
          marginTop: 28, padding: '10px 16px', borderRadius: 8,
          background: '#1a1a2e', border: '1px solid #6366f133',
          fontSize: 12, color: '#6b7280',
        }}>
          <span style={{ color: '#818cf8' }}>[RBAC]</span>{' '}
          Permissão negada para rota protegida · perfil: {label}
        </div>
      </div>
    </div>
  )
}
