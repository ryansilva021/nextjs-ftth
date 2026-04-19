'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { getMinhasOS } from '@/actions/service-orders'
import { useLanguage } from '@/contexts/LanguageContext'

const AVATAR_COLORS = [
  ['#0284c7', '#0ea5e9'], ['#7c3aed', '#a78bfa'],
  ['#16a34a', '#4ade80'], ['#d97706', '#fbbf24'],
  ['#dc2626', '#f87171'],
]

function getAvatarColor(str = '') {
  const idx = (str.charCodeAt(0) + str.charCodeAt(1 % str.length)) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx] ?? AVATAR_COLORS[0]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BG_COLOR = {
  aberta:       { bg: '#dbeafe', color: '#1d4ed8' },
  agendada:     { bg: '#ede9fe', color: '#6d28d9' },
  em_andamento: { bg: '#fef9c3', color: '#92400e' },
  concluida:    { bg: '#dcfce7', color: '#15803d' },
  cancelada:    { bg: '#fee2e2', color: '#b91c1c' },
}
const PRIO_COLOR = { urgente: '#ef4444', alta: '#f59e0b', normal: '#94a3b8', baixa: '#6b7280' }

function MinhasOS({ S }) {
  const { t } = useLanguage()
  const FILTROS = [
    { key: 'todas',      label: t('filter.all') },
    { key: 'hoje',       label: t('filter.today') },
    { key: 'atrasadas',  label: t('filter.overdue') },
    { key: 'finalizadas',label: t('filter.done') },
  ]

  const [filtro, setFiltro]   = useState('todas')
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState(null)

  const carregar = useCallback(async (f) => {
    setLoading(true)
    setErro(null)
    try {
      const data = await getMinhasOS({ filtro: f })
      setItems(data)
    } catch (e) {
      setErro(e.message ?? t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar(filtro) }, [filtro, carregar])

  function fmt(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  function isAtrasada(item) {
    if (!item.data_agendamento) return false
    if (['concluida', 'cancelada'].includes(item.status)) return false
    return new Date(item.data_agendamento) < new Date()
  }

  return (
    <div style={S.card}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ ...S.title, margin: 0 }}>{t('perfil.section.my_os')}</p>
        <Link href="/admin/os" style={{
          fontSize: 12, color: '#ea580c', textDecoration: 'none',
          padding: '4px 10px', borderRadius: 6,
          background: '#ffedd5', border: '1px solid #f4b07a',
        }}>
          {t('perfil.see_all')}
        </Link>
      </div>

      {/* Filtros rápidos */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: filtro === f.key ? '#ea580c' : 'var(--card-bg-active)',
            color:      filtro === f.key ? '#fff'    : 'var(--text-muted)',
            border:     filtro === f.key ? '1px solid #ea580c' : '1px solid var(--border-color)',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          {t('common.loading')}
        </div>
      ) : erro ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#f85149', fontSize: 13 }}>{erro}</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          {t('common.no_os')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(os => {
            const stColor = STATUS_BG_COLOR[os.status] ?? { bg: '#f1f5f9', color: '#475569' }
            const atrs = isAtrasada(os)
            return (
              <Link key={os._id} href={`/admin/os/${os.os_id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--card-bg-active)',
                  border: `1px solid ${atrs ? 'rgba(239,68,68,0.35)' : 'var(--border-color)'}`,
                  transition: 'opacity 0.15s',
                }}>
                  {/* Prioridade dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: PRIO_COLOR[os.prioridade] ?? '#94a3b8',
                  }} />

                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                        #{os.os_id}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {t(`tipo.${os.tipo}`) ?? os.tipo}
                      </span>
                      {atrs && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', background: '#fee2e2', borderRadius: 4, padding: '1px 5px' }}>
                          {t('common.overdue')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {os.cliente_nome}
                      {os.tecnico_nome ? ` · ${t('common.tech_abbr')} ${os.tecnico_nome}` : ''}
                    </div>
                  </div>

                  {/* Direita: status + data */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                      background: stColor.bg, color: stColor.color, display: 'block', marginBottom: 3,
                    }}>
                      {t(`status.${os.status}`) || os.status}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {fmt(os.data_abertura)}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PerfilPage() {
  const { data: session } = useSession()
  const { t } = useLanguage()

  const [campoMode, setCampoMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('pref_campo_mode') === 'true'
  })
  function toggleCampo(v) {
    setCampoMode(v)
    try { localStorage.setItem('pref_campo_mode', String(v)) } catch {}
  }

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
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{t('perfil.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{t('perfil.subtitle')}</p>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1.2 }}>
                {user.username ?? '—'}
              </p>
              <Link href="/configuracoes" title="Configurações" style={{
                fontSize: 18, textDecoration: 'none', opacity: 0.7,
                padding: '3px 6px', borderRadius: 8, border: '1px solid var(--border-color)',
                background: 'var(--card-bg-active)', lineHeight: 1,
                display: 'flex', alignItems: 'center',
              }}>
                ⚙️
              </Link>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {t('perfil.project')}: <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{user.projeto_nome ?? user.projeto_id ?? '—'}</span>
            </p>
            <span style={{
              ...S.badge, marginTop: 8, display: 'inline-block',
              backgroundColor: '#ffedd5',
              color: '#ea580c', border: '1px solid #f4b07a',
            }}>
              {t(`perfil.role.${user.role}`) ?? user.role ?? t('perfil.role.user')}
            </span>
          </div>
        </div>

        {/* Informações da conta */}
        <div style={S.card}>
          <p style={S.title}>{t('perfil.section.account')}</p>
          <div style={{ ...S.row }}>
            <span style={S.label}>{t('perfil.username')}</span>
            <span style={{ ...S.value, fontFamily: 'monospace', fontSize: 13 }}>{user.username ?? '—'}</span>
          </div>
          <div style={{ ...S.row }}>
            <span style={S.label}>{t('perfil.role')}</span>
            <span style={S.value}>{t(`perfil.role.${user.role}`) ?? user.role ?? '—'}</span>
          </div>
          <div style={{ ...S.row }}>
            <span style={S.label}>{t('perfil.project')}</span>
            <span style={S.value}>{user.projeto_nome ?? user.projeto_id ?? '—'}</span>
          </div>
          <div style={S.row}>
            <span style={S.label}>{t('perfil.security')}</span>
            <Link href="/perfil/senha" style={{
              fontSize: 13, fontWeight: 600, color: '#ea580c',
              textDecoration: 'none', padding: '6px 14px',
              background: '#ffedd5',
              borderRadius: 8, border: '1px solid #f4b07a',
            }}>
              {t('perfil.change_password')}
            </Link>
          </div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <span style={S.label}>{t('perfil.preferences')}</span>
            <Link href="/configuracoes" style={{
              fontSize: 13, fontWeight: 600, color: 'var(--foreground)',
              textDecoration: 'none', padding: '6px 14px',
              background: 'var(--card-bg-active)',
              borderRadius: 8, border: '1px solid var(--border-color)',
            }}>
              {t('perfil.settings_link')}
            </Link>
          </div>
        </div>

        {/* Configurações Rápidas */}
        <div style={S.card}>
          <p style={S.title}>{t('perfil.section.quick')}</p>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <div>
              <span style={S.label}>{t('perfil.campo_mode')}</span>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{t('perfil.campo_desc')}</p>
            </div>
            <button
              onClick={() => toggleCampo(!campoMode)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: campoMode ? '#0284c7' : 'var(--border-color)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
              role="switch" aria-checked={campoMode}
            >
              <span style={{
                position: 'absolute', top: 3, left: campoMode ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>
        </div>

        {/* Sistema */}
        <div style={S.card}>
          <p style={S.title}>{t('perfil.section.system')}</p>
          <div style={{ ...S.row }}>
            <span style={S.label}>{t('perfil.full_settings')}</span>
            <Link href="/configuracoes" style={{
              fontSize: 13, fontWeight: 600, color: 'var(--foreground)',
              textDecoration: 'none', padding: '6px 14px',
              background: 'var(--card-bg-active)',
              borderRadius: 8, border: '1px solid var(--border-color)',
            }}>
              {t('perfil.open_settings')}
            </Link>
          </div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <span style={S.label}>{t('perfil.session')}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{
                fontSize: 13, fontWeight: 600, color: '#ef4444',
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                background: '#fef2f2',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              {t('perfil.logout')}
            </button>
          </div>
        </div>

        {/* Avatar — em breve */}
        <div style={S.card}>
          <p style={S.title}>{t('perfil.section.avatar')}</p>
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
                {t('perfil.avatar_auto')}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {t('perfil.avatar_soon')}
              </p>
            </div>
            <button disabled style={{
              marginLeft: 'auto', padding: '8px 18px', borderRadius: 8,
              background: 'var(--card-bg)', border: '1px solid var(--border-color)',
              color: 'var(--text-muted)', fontSize: 13, cursor: 'not-allowed', opacity: 0.6,
            }}>
              {t('perfil.change_avatar')}
            </button>
          </div>
        </div>

        {/* Minhas Ordens de Serviço — admin, recepcao, noc */}
        {['admin', 'recepcao', 'noc'].includes(user.role) && (
          <MinhasOS S={S} />
        )}

        {/* Assinatura — visível apenas para admin */}
        {(user.role === 'admin') && (
          <div style={{ ...S.card, background: '#fff9f5', borderColor: '#f4b07a' }}>
            <p style={S.title}>{t('perfil.section.sub')}</p>
            <div style={S.row}>
              <div>
                <span style={{ ...S.label, display: 'block' }}>{t('perfil.plan')}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {t('perfil.plan_desc')}
                </span>
              </div>
              <Link href="/admin/assinatura" style={{
                fontSize: 13, fontWeight: 600, color: '#ea580c',
                textDecoration: 'none', padding: '7px 16px',
                background: '#ffedd5',
                borderRadius: 8, border: '1px solid #f4b07a',
                whiteSpace: 'nowrap',
              }}>
                {t('perfil.manage')}
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
