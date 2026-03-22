'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'

const ROLE_LABEL = {
  superadmin: 'Super Administrador',
  admin:      'Administrador',
  tecnico:    'Técnico',
  user:       'Usuário',
}

const AVATAR_COLORS = [
  ['#0284c7', '#0ea5e9'], ['#7c3aed', '#a78bfa'],
  ['#16a34a', '#4ade80'], ['#d97706', '#fbbf24'],
  ['#dc2626', '#f87171'],
]

function getAvatarColor(str = '') {
  const idx = (str.charCodeAt(0) + str.charCodeAt(1 % str.length)) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx] ?? AVATAR_COLORS[0]
}

export default function PerfilPage() {
  const { data: session } = useSession()
  const { theme }         = useTheme()
  const isDark            = theme === 'dark'

  const user     = session?.user ?? {}
  const initials = (user.username ?? '?')[0]?.toUpperCase()
  const [colors] = useState(() => getAvatarColor(user.username ?? ''))

  const S = {
    page:    { minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', padding: '32px 16px' },
    wrap:    { maxWidth: 680, margin: '0 auto' },
    card:    { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '24px', marginBottom: 16 },
    title:   { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 16 },
    row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' },
    label:   { fontSize: 13, color: 'var(--text-muted)' },
    value:   { fontSize: 14, fontWeight: 600, color: 'var(--foreground)' },
    badge:   { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* Cabeçalho */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Perfil</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Gerencie suas informações e preferências</p>
        </div>

        {/* Avatar + nome */}
        <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 800, color: '#fff',
            boxShadow: `0 4px 20px ${colors[0]}40`,
          }}>
            {initials}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1.2 }}>
              {user.username ?? '—'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Projeto: <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{user.projeto_nome ?? user.projeto_id ?? '—'}</span>
            </p>
            <span style={{
              ...S.badge, marginTop: 8, display: 'inline-block',
              backgroundColor: isDark ? 'rgba(2,132,199,0.15)' : '#e0f2fe',
              color: '#0284c7', border: '1px solid #0284c740',
            }}>
              {ROLE_LABEL[user.role] ?? user.role ?? 'Usuário'}
            </span>
          </div>
        </div>

        {/* Informações da conta */}
        <div style={S.card}>
          <p style={S.title}>Informações da Conta</p>
          <div style={{ ...S.row }}>
            <span style={S.label}>Usuário</span>
            <span style={{ ...S.value, fontFamily: 'monospace', fontSize: 13 }}>{user.username ?? '—'}</span>
          </div>
          <div style={{ ...S.row }}>
            <span style={S.label}>Função</span>
            <span style={S.value}>{ROLE_LABEL[user.role] ?? user.role ?? '—'}</span>
          </div>
          <div style={{ ...S.row }}>
            <span style={S.label}>Projeto</span>
            <span style={S.value}>{user.projeto_nome ?? user.projeto_id ?? '—'}</span>
          </div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <span style={S.label}>Segurança</span>
            <Link href="/perfil/senha" style={{
              fontSize: 13, fontWeight: 600, color: '#0284c7',
              textDecoration: 'none', padding: '6px 14px',
              background: isDark ? 'rgba(2,132,199,0.1)' : '#e0f2fe',
              borderRadius: 8, border: '1px solid #0284c740',
            }}>
              Alterar senha →
            </Link>
          </div>
        </div>

        {/* Avatar — em breve */}
        <div style={S.card}>
          <p style={S.title}>Avatar</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: '#fff',
            }}>
              {initials}
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 600, margin: 0 }}>
                Avatar gerado automaticamente
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Upload de foto em breve
              </p>
            </div>
            <button disabled style={{
              marginLeft: 'auto', padding: '8px 18px', borderRadius: 8,
              background: 'var(--card-bg)', border: '1px solid var(--border-color)',
              color: 'var(--text-muted)', fontSize: 13, cursor: 'not-allowed', opacity: 0.6,
            }}>
              Alterar foto
            </button>
          </div>
        </div>

        {/* Pagamentos */}
        <div style={S.card}>
          <p style={S.title}>Pagamentos</p>
          <div style={{
            border: '2px dashed var(--border-color)', borderRadius: 12,
            padding: '28px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💳</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
              Meios de pagamento
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
              Gateway de pagamento em implementação.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              {['Cartão de crédito', 'PIX', 'Boleto'].map(m => (
                <span key={m} style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                  background: 'var(--background)', border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Plano atual */}
        <div style={{ ...S.card, background: isDark ? 'rgba(2,132,199,0.08)' : '#f0f9ff', borderColor: '#0284c740' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284c7', margin: 0 }}>Plano atual</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: '4px 0 0' }}>FiberOps Profissional</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Licença ativa · Renovação automática</p>
            </div>
            <button disabled style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#0284c7,#0369a1)',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'not-allowed', opacity: 0.7,
            }}>
              Gerenciar plano
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
