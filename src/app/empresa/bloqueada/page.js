import { signOut } from '@/lib/auth'

export const metadata = {
  title: 'Acesso Suspenso | FiberOps',
}

export default function EmpresaBloqueadaPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '1rem',
          padding: '2.5rem',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Icone de alerta */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#450a0a',
            border: '1px solid #7f1d1d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '1.5rem',
          }}
        >
          🔒
        </div>

        <h1
          style={{
            color: 'var(--foreground)',
            fontWeight: 700,
            fontSize: '1.25rem',
            marginBottom: '0.5rem',
          }}
        >
          Acesso Suspenso
        </h1>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            lineHeight: '1.6',
            marginBottom: '1.5rem',
          }}
        >
          O acesso da sua empresa ao FiberOps está temporariamente suspenso.
          Entre em contato com o suporte para regularizar a situação.
        </p>

        <div
          style={{
            backgroundColor: 'var(--inp-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
          }}
        >
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.25rem',
            }}
          >
            Suporte
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            suporte@fiberops.com.br
          </p>
        </div>

        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button
            type="submit"
            style={{
              width: '100%',
              backgroundColor: 'var(--border-color)',
              border: '1px solid var(--border-color-strong)',
              color: 'var(--text-secondary)',
              borderRadius: '0.5rem',
              padding: '0.625rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  )
}
