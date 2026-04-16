'use client'

import { T } from '../pontoTheme'

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin:      'Administrador',
  tecnico:    'Técnico de Campo',
  noc:        'NOC / Suporte',
  recepcao:   'Recepção',
  user:       'Usuário',
}

const ROLE_COLORS = {
  superadmin: '#f59e0b',
  admin:      '#a855f7',
  tecnico:    '#3b82f6',
  noc:        '#22c55e',
  recepcao:   '#ec4899',
  user:       '#6b7280',
}

function Row({ label, value, mono = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '13px 16px', borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ fontSize: 13, color: T.dim, fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: 13, color: value ? T.text : T.dim, fontWeight: 600,
        fontFamily: mono ? 'monospace' : T.ff,
        maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all',
      }}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function DadosCadastraisTab({ userProfile }) {
  const {
    username, name, nome_completo, email, role,
    projeto_nome, empresa_nome, empresa_slug,
  } = userProfile ?? {}

  const displayName = nome_completo || name || username
  const roleLabel   = ROLE_LABELS[role] ?? role
  const roleColor   = ROLE_COLORS[role] ?? T.dim

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: `${roleColor}22`,
          border: `2px solid ${roleColor}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
        }}>
          {displayName?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{displayName}</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4,
            background: `${roleColor}18`, border: `1px solid ${roleColor}40`,
            borderRadius: 20, padding: '3px 10px',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: roleColor }} />
            <span style={{ fontSize: 11, color: roleColor, fontWeight: 700 }}>{roleLabel}</span>
          </div>
        </div>
      </div>

      {/* Dados pessoais */}
      <SectionTitle title="Dados pessoais" />
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
        <Row label="Nome completo" value={displayName} />
        <Row label="Login"         value={username} mono />
        <Row label="E-mail"        value={email} />
        <div style={{ padding: '13px 16px' }}>
          <span style={{ fontSize: 13, color: T.dim, fontWeight: 500 }}>Cargo</span>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '3px 10px',
              background: `${roleColor}18`, border: `1px solid ${roleColor}40`,
              borderRadius: 20, color: roleColor,
            }}>
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Dados da empresa */}
      <SectionTitle title="Empresa / Projeto" />
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
        <Row label="Empresa"  value={empresa_nome} />
        <Row label="Projeto"  value={projeto_nome} />
        {empresa_slug && <Row label="Identificador" value={empresa_slug} mono />}
      </div>

      {/* Nota */}
      <div style={{
        fontSize: 11, color: T.dim, textAlign: 'center', marginTop: 8, lineHeight: 1.5,
      }}>
        Para atualizar seus dados pessoais, acesse <strong style={{ color: T.muted }}>Perfil</strong> no menu lateral
        ou solicite ao administrador.
      </div>
    </div>
  )
}

function SectionTitle({ title }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: T.dim,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 8,
    }}>
      {title}
    </div>
  )
}
