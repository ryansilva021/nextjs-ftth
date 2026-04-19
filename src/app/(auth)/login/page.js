'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function IconEye({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function IconWifi() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>
    </svg>
  )
}

function IconActivity() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, accent }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 11,
        background: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', marginTop: 3, lineHeight: 1 }}>
          {label}
        </div>
      </div>
    </div>
  )
}

// ─── Feature Row ──────────────────────────────────────────────────────────────

function Feature({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 20, height: 20, borderRadius: 6,
        background: 'rgba(234,88,12,0.2)',
        border: '1px solid rgba(234,88,12,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fb923c', flexShrink: 0,
      }}>
        <IconCheck />
      </div>
      <span style={{ fontSize: 13.5, color: 'rgba(203,213,225,0.85)', lineHeight: 1.4 }}>{text}</span>
    </div>
  )
}

// ─── Input Field ──────────────────────────────────────────────────────────────

function Field({ label, icon, right, error, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
        textTransform: 'uppercase', color: '#64748b',
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
          color: error ? '#f87171' : '#94a3b8', pointerEvents: 'none',
          display: 'flex', alignItems: 'center',
        }}>
          {icon}
        </span>
        <input
          {...props}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#f8fafc',
            border: `1.5px solid ${error ? '#fca5a5' : '#e2e8f0'}`,
            borderRadius: 10,
            padding: `11px ${right ? '42px' : '13px'} 11px 38px`,
            fontSize: 14, color: '#0f172a',
            outline: 'none',
            transition: 'border-color .15s, box-shadow .15s',
            fontFamily: 'inherit',
          }}
          onFocus={e => {
            e.target.style.borderColor = '#ea580c'
            e.target.style.boxShadow = '0 0 0 3px rgba(234,88,12,0.1)'
            e.target.style.background = '#fff'
          }}
          onBlur={e => {
            e.target.style.borderColor = error ? '#fca5a5' : '#e2e8f0'
            e.target.style.boxShadow = 'none'
            e.target.style.background = '#f8fafc'
          }}
        />
        {right && (
          <span style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            display: 'flex', alignItems: 'center', paddingRight: 13,
          }}>
            {right}
          </span>
        )}
      </div>
      {error && (
        <span style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>{error}</span>
      )}
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl  = searchParams.get('callbackUrl') || '/'

  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [erro,       setErro]       = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [success,    setSuccess]    = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      const result = await signIn('credentials', { username, password, redirect: false, callbackUrl })
      if (result?.error) {
        const msg = result.error
        setErro(msg.includes('rate_limited')
          ? (msg.split(':')[2] || 'Muitas tentativas. Tente novamente mais tarde.')
          : 'Usuário ou senha inválidos.')
      } else if (result?.ok) {
        setSuccess(true)
        setTimeout(() => { router.push(callbackUrl); router.refresh() }, 600)
      }
    } catch {
      setErro('Erro inesperado. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 380 }}>

      {/* Logo mobile */}
      <div className="mobile-logo" style={{ textAlign: 'center', marginBottom: 32 }}>
        <Image src="/long-logo.svg" alt="FiberOps" width={130} height={33} priority />
      </div>

      {/* Heading */}
      <div style={{ marginBottom: 30 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700, color: '#0f172a',
          margin: '0 0 8px', letterSpacing: '-0.03em',
        }}>
          Acesse sua conta
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
          Novo por aqui? <Link href="/cadastro" style={{ color: '#ea580c', fontWeight: 600, textDecoration: 'none' }}>Solicite seu acesso</Link> e comece agora.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field
          label="Usuário"
          icon={<IconUser />}
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="seu.usuario"
          error={erro && ' '}
        />

        <Field
          label="Senha"
          icon={<IconLock />}
          type={showPass ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          error={erro}
          right={
            <button type="button" onClick={() => setShowPass(v => !v)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center',
            }}>
              <IconEye open={showPass} />
            </button>
          }
        />

        {/* Button */}
        <button
          type="submit"
          disabled={carregando || success}
          style={{
            marginTop: 4,
            background: success
              ? 'linear-gradient(135deg,#16a34a,#22c55e)'
              : carregando
                ? '#cbd5e1'
                : 'linear-gradient(135deg,#c2410c 0%,#ea580c 60%,#f97316 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 11,
            padding: '13px 20px',
            fontSize: 14,
            fontWeight: 700,
            cursor: carregando || success ? 'not-allowed' : 'pointer',
            transition: 'all .2s',
            boxShadow: success
              ? '0 4px 16px rgba(34,197,94,0.3)'
              : carregando
                ? 'none'
                : '0 4px 20px rgba(234,88,12,0.3), 0 1px 0 rgba(255,255,255,0.15) inset',
            letterSpacing: '0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {success ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Acesso autorizado!
            </>
          ) : carregando ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin .8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Verificando…
            </>
          ) : 'Entrar na plataforma →'}
        </button>
      </form>

      {/* Divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0',
      }}>
        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>Não tem acesso?</span>
        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
      </div>

      {/* Signup */}
      <Link href="/cadastro" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '11px 20px', borderRadius: 11,
        border: '1.5px solid #e2e8f0', background: '#fff',
        fontSize: 14, fontWeight: 600, color: '#334155',
        textDecoration: 'none',
        transition: 'border-color .15s, background .15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#ea580c'; e.currentTarget.style.color = '#ea580c' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#334155' }}
      >
        Solicitar acesso
      </Link>

      {/* Security */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 5, marginTop: 24, color: '#94a3b8', fontSize: 11,
      }}>
        <IconShield />
        Conexão segura · criptografada com TLS
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeRight { from { opacity:0;transform:translateX(20px) } to { opacity:1;transform:translateX(0) } }
        input::placeholder { color: #cbd5e1 }
        .mobile-logo { display: none; }
        @media (max-width: 768px) {
          .mobile-logo { display: block !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Left Panel ───────────────────────────────────────────────────────────────

function LeftPanel() {
  return (
    <div style={{
      flex: 1,
      background: 'linear-gradient(145deg, #0a1628 0%, #0f1f3d 40%, #0d1a30 100%)',
      display: 'flex', flexDirection: 'column',
      padding: '48px 52px',
      position: 'relative', overflow: 'hidden',
      minHeight: '100dvh',
    }}>
      {/* Background decorations */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-15%',
        width: '55vw', height: '55vw', maxWidth: 500, maxHeight: 500,
        background: 'radial-gradient(circle, rgba(234,88,12,0.1) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', left: '-10%',
        width: '45vw', height: '45vw', maxWidth: 400, maxHeight: 400,
        background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`,
        backgroundSize: '44px 44px', pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: 'auto' }}>
        <Image src="/long-logo.svg" alt="FiberOps" width={140} height={35} priority />
      </div>

      {/* Center content */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 36, paddingTop: 48 }}>

        {/* Headline */}
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(234,88,12,0.12)', border: '1px solid rgba(234,88,12,0.25)',
            borderRadius: 20, padding: '5px 12px', marginBottom: 16,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fb923c', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#fb923c', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Plataforma FTTH
            </span>
          </div>
          <h2 style={{
            fontSize: 34, fontWeight: 800, color: '#fff',
            margin: '0 0 14px', lineHeight: 1.2, letterSpacing: '-0.03em',
          }}>
            Gestão completa<br />
            <span style={{ color: '#fb923c' }}>para o seu ISP</span>
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(148,163,184,0.8)', margin: 0, lineHeight: 1.65, maxWidth: 380 }}>
            Centralize ordens de serviço, monitoramento de rede, clientes e equipe em uma única plataforma.
          </p>
        </div>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {[
            'Ordens de serviço com status em tempo real',
            'Monitoramento de OLTs e ativos de rede',
            'Controle de ponto e equipes técnicas',
            'Notificações push para técnicos em campo',
            'Relatórios e dashboards operacionais',
          ].map(f => <Feature key={f} text={f} />)}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatCard icon={<IconUsers />} value="120+" label="ISPs ativos" accent="rgba(234,88,12,0.7)" />
          <StatCard icon={<IconActivity />} value="50k+" label="OS gerenciadas" accent="rgba(59,130,246,0.6)" />
          <StatCard icon={<IconWifi />} value="99.9%" label="Uptime garantido" accent="rgba(16,185,129,0.6)" />
          <StatCard icon={<IconActivity />} value="24/7" label="Suporte técnico" accent="rgba(139,92,246,0.6)" />
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', paddingTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(100,116,139,0.6)', fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
          Todos os sistemas operacionais
          <span style={{ marginLeft: 'auto' }}>© 2025 FiberOps</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <Suspense>
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      }}>

        {/* Left — branding panel */}
        <div className="left-panel" style={{ flex: '0 0 52%', maxWidth: 680 }}>
          <LeftPanel />
        </div>

        {/* Right — form panel */}
        <div style={{
          flex: 1,
          background: '#f8fafc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 32px',
          minHeight: '100dvh',
          position: 'relative',
        }}>
          {/* Subtle top accent */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 3,
            background: 'linear-gradient(90deg, #c2410c, #ea580c, #f97316)',
          }} />

          <div style={{ width: '100%', maxWidth: 380, animation: 'fadeRight .4s ease' }}>
            <LoginForm />
          </div>
        </div>

      </div>

      <style>{`
        @media (max-width: 768px) {
          .left-panel { display: none !important; }
        }
      `}</style>
    </Suspense>
  )
}
