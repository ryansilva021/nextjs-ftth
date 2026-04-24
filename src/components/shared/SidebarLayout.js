"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { hasPermission, PERM, ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions'
import { useOSNotification }    from '@/hooks/useOSNotification'
import { playNotifSound }       from '@/lib/notifSound'
import OSToast    from '@/components/shared/OSToast'
import PontoToast from '@/components/shared/PontoToast'
import { getTimeSettings } from '@/actions/time-settings'
import { useLanguage } from '@/contexts/LanguageContext'

// Rótulos legíveis por tipo de OS (para notificações nativas)
const TIPO_LABEL = {
  instalacao:   'Instalação',
  manutencao:   'Manutenção',
  suporte:      'Suporte',
  cancelamento: 'Cancelamento',
}

// Roles que recebem notificações de OS
const ROLES_COM_NOTIFICACAO = ['superadmin', 'admin', 'tecnico', 'recepcao', 'noc']

// Roles que recebem lembretes de ponto
const ROLES_COM_PONTO = ['admin', 'tecnico', 'recepcao', 'noc']

function buildPontoSchedule(s) {
  if (!s) return []
  const parse = (hhmm) => {
    const [h, m] = (hhmm ?? '').split(':').map(Number)
    return isNaN(h) || isNaN(m) ? null : { h, m }
  }
  return [
    s.alerta_entrada       && { ...parse(s.entrada),       msg: '⏰ Hora de iniciar sua jornada!' },
    s.alerta_almoco_inicio && { ...parse(s.almoco_inicio),  msg: '🍽 Hora de ir para o almoço!' },
    s.alerta_almoco_fim    && { ...parse(s.almoco_fim),     msg: '▶ Hora de retornar do almoço!' },
    s.alerta_saida         && { ...parse(s.saida),          msg: '🔴 Hora de encerrar seu expediente!' },
  ].filter(x => x && x.h != null)
}

// ── FiberOps brand colors (sidebar uses these directly) ─────────────────────
const FO = {
  bg:           '#1A120D',
  bgLight:      '#261812',
  border:       'rgba(255,255,255,0.07)',
  text:         'rgba(255,255,255,0.88)',
  textMuted:    'rgba(255,255,255,0.42)',
  textSection:  'rgba(255,255,255,0.28)',
  orange:       '#C45A2C',
  orangeText:   '#F4A771',
  orangeBg:     'rgba(196,90,44,0.14)',
  orangeBorder: 'rgba(196,90,44,0.30)',
}

// ── Grupos de separação visual ──────────────────────────────────────────────
const GROUPS = { public: 0, staff: 1, admin: 2, superadmin: 3 }

// ── Definição de itens do menu ──────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/visao-geral',      labelKey: 'nav.overview', icon: '◈', section: 'PAINEL',         group: GROUPS.public  },
  { href: '/mapa',             labelKey: 'nav.map',      icon: '◉',                             group: GROUPS.public  },

  { href: '/admin/topologia',      labelKey: 'nav.topology',     icon: '⬡', section: 'OPERAÇÃO', perm: PERM.VIEW_TOPOLOGY,     group: GROUPS.staff },
  { href: '/admin/campo',          labelKey: 'nav.field',        icon: '◎', perm: PERM.VIEW_FIELD,        group: GROUPS.staff },
  { href: '/admin/calculos',       labelKey: 'nav.calculations', icon: '◈', perm: PERM.VIEW_CALCULATIONS, group: GROUPS.staff },
  { href: '/admin/os',             labelKey: 'nav.all_os',       icon: '▣', perm: PERM.VIEW_SERVICE_ORDERS, group: GROUPS.staff },
  { href: '/admin/os/minhas',      labelKey: 'nav.my_os',        icon: '▤', perm: PERM.VIEW_SERVICE_ORDERS, group: GROUPS.staff, indent: true, noTecnico: true },
  { href: '/ponto',                labelKey: 'nav.ponto',        icon: '◷', perm: PERM.PUNCH_CLOCK,         group: GROUPS.staff },
  { href: '/configuracoes/ponto',  labelKey: 'nav.ponto_config', icon: '◔', perm: PERM.MANAGE_USERS,        group: GROUPS.staff, indent: true },

  { href: '/admin/usuarios', labelKey: 'nav.users',  icon: '◉', section: 'ADMINISTRAÇÃO', perm: PERM.MANAGE_USERS, group: GROUPS.admin },
  { href: '/admin/importar', labelKey: 'nav.import', icon: '◈', perm: PERM.VIEW_IMPORT,   group: GROUPS.admin },
  { href: '/admin/logs',     labelKey: 'nav.logs',   icon: '▤', perm: PERM.VIEW_LOGS,     group: GROUPS.admin },

  { href: '/superadmin/projetos',  labelKey: 'nav.projects',  icon: '⬡', section: 'SISTEMA', group: GROUPS.superadmin },
  { href: '/superadmin/empresas',  labelKey: 'nav.companies', icon: '◉',                    group: GROUPS.superadmin },
  { href: '/superadmin/registros', labelKey: 'nav.records',   icon: '▤',                    group: GROUPS.superadmin },
]

function isItemVisible(item, role) {
  if (role === 'superadmin') {
    return item.group === GROUPS.superadmin
  }
  if (item.group === GROUPS.superadmin) return false
  // Técnico não vê painel administrativo de ordens (acessa apenas as suas via /admin/os)
  if (item.noTecnico && role === 'tecnico') return false
  if (item.perm) return hasPermission(role, item.perm)
  return true
}

export default function SidebarLayout({ session, children }) {
  const [aberta, setAberta] = useState(false);
  const pathname = usePathname();
  const role = session?.user?.role ?? "user";
  const roleLabel = ROLE_LABELS[role] ?? role
  const roleColor = ROLE_COLORS[role] ?? ROLE_COLORS.user
  const { t } = useLanguage()

  const itensVisiveis = NAV_ITEMS.filter(item => isItemVisible(item, role))

  // ── Registro do service worker + listener para push recebido com app em foco ─
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})

    // O SW envia PUSH_RECEIVED quando o app está em foco (para evitar notificação
    // duplicada: o SW não exibe a notificação do sistema, mas sinaliza aqui para
    // tocar o som — o toast in-app já está sendo exibido via SSE.
    function onSwMessage(e) {
      if (e.data?.type !== 'PUSH_RECEIVED') return
      try {
        const soundOn = localStorage.getItem('pref_notif_sound')
        if (soundOn !== 'false') playNotifSound()
      } catch (_) {}
    }
    navigator.serviceWorker.addEventListener('message', onSwMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage)
  }, [])

  // ── Online / Offline ─────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(true)
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // ── Notificações OS em tempo real (SSE in-app) ───────────────────────────
  const [toasts, setToasts] = useState([])

  const handleNova = useCallback((event) => {
    const id = `${event.os_id ?? Date.now()}-${Math.random()}`
    setToasts(prev => [...prev.slice(-4), { ...event, id }])
    try {
      const soundOn = localStorage.getItem('pref_notif_sound')
      if (soundOn !== 'false') playNotifSound()
    } catch (_) {}
    // NÃO chama showNativeNotif aqui — o push do backend já entrega a notificação
    // do sistema via SW. Chamar aqui causaria duplicação (push SW + reg.showNotification).
    // Se o app está em foco, o toast in-app acima é suficiente.
    // Se o app está em background/fechado, o SW push event cobre o caso.
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const notificacoesAtivas = ROLES_COM_NOTIFICACAO.includes(role)
  useOSNotification(notificacoesAtivas ? { onNova: handleNova } : {})

  // ── Lembretes de ponto globais ───────────────────────────────────────────────
  const [pontoToasts,   setPontoToasts]   = useState([])
  const [pontoSchedule, setPontoSchedule] = useState([])
  const pontoAtivo = ROLES_COM_PONTO.includes(role)

  useEffect(() => {
    if (!pontoAtivo) return
    getTimeSettings()
      .then(s => setPontoSchedule(buildPontoSchedule(s)))
      .catch(() => {})
  }, [pontoAtivo])

  useEffect(() => {
    if (!pontoAtivo || !pontoSchedule.length) return
    function checkPonto() {
      const d = new Date()
      const today = d.toISOString().split('T')[0]
      const storageKey = `ponto_notified_${today}`
      let notified
      try { notified = new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]')) }
      catch (_) { notified = new Set() }

      const h = d.getHours(), m = d.getMinutes()
      let changed = false
      for (const s of pontoSchedule) {
        if (h !== s.h || m !== s.m) continue
        const key = `${String(s.h).padStart(2, '0')}:${String(s.m).padStart(2, '0')}`
        if (notified.has(key)) continue
        notified.add(key)
        changed = true
        const id = `ponto-${key}-${Math.random()}`
        setPontoToasts(prev => [...prev.slice(-3), { id, msg: s.msg, time: key }])
        // Notificação do sistema entregue pelo cron via push (evita duplicata)
        try {
          const soundOn = localStorage.getItem('pref_notif_sound')
          if (soundOn !== 'false') playNotifSound()
        } catch (_) {}
      }
      if (changed) {
        try { localStorage.setItem(storageKey, JSON.stringify([...notified])) } catch (_) {}
      }
    }
    checkPonto()
    const id = setInterval(checkPonto, 30_000)
    return () => clearInterval(id)
  }, [pontoAtivo, pontoSchedule])

  const removePontoToast = useCallback((id) => {
    setPontoToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Despertadores pessoais (ponto_alarms) — funciona em qualquer aba ────────
  useEffect(() => {
    if (!pontoAtivo) return
    const ALARM_LABELS = { entrada: 'Entrada', almoco_inicio: 'Almoço início', almoco_fim: 'Almoço fim', saida: 'Saída' }

    function checkPontoAlarms() {
      let alarms
      try { alarms = JSON.parse(localStorage.getItem('ponto_alarms') ?? 'null') }
      catch (_) { return }
      if (!alarms) return

      const d        = new Date()
      const today    = d.toISOString().split('T')[0]
      const storeKey = `ponto_alarm_fired_${today}`
      let fired
      try { fired = new Set(JSON.parse(localStorage.getItem(storeKey) ?? '[]')) }
      catch (_) { fired = new Set() }

      const hhmm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      let changed = false
      for (const [key, cfg] of Object.entries(alarms)) {
        if (!cfg?.enabled)   continue
        if (cfg.time !== hhmm) continue
        if (fired.has(key))  continue
        fired.add(key)
        changed = true
        const label = ALARM_LABELS[key] ?? key
        const id    = `alarm-${key}-${Math.random()}`
        setPontoToasts(prev => [...prev.slice(-3), { id, msg: `⏰ Despertador: ${label} — hora de bater ponto!`, time: hhmm }])
        // Notificação do sistema entregue pelo cron via push (evita duplicata)
        try {
          const soundOn = localStorage.getItem('pref_notif_sound')
          if (soundOn !== 'false') playNotifSound()
        } catch (_) {}
      }
      if (changed) {
        try { localStorage.setItem(storeKey, JSON.stringify([...fired])) } catch (_) {}
      }
    }

    checkPontoAlarms()
    const id = setInterval(checkPontoAlarms, 30_000)
    return () => clearInterval(id)
  }, [pontoAtivo])

  return (
    <div
      style={{ backgroundColor: "var(--background)" }}
      className="flex h-screen overflow-hidden"
    >
      {/* Overlay mobile */}
      {aberta && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={() => setAberta(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          backgroundColor: FO.bg,
          borderRight: `1px solid ${FO.border}`,
          width: 240, minWidth: 240,
          height: 'calc(100dvh - 52px)',
        }}
        className={`
          fixed top-[52px] left-0 z-30 flex flex-col
          transform transition-transform duration-200
          lg:static lg:translate-x-0 lg:top-0 lg:!h-screen lg:flex-shrink-0
          ${aberta ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div
          style={{ borderBottom: `1px solid ${FO.border}`, padding: '16px 20px' }}
          className="flex items-center gap-3"
        >
          {/* LogoMark */}
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
            <rect width="30" height="30" rx="6" fill="#C45A2C"/>
            <text x="6" y="22" fontFamily="Georgia,serif" fontSize="20" fontWeight="700" fill="white">F</text>
            <rect x="18" y="8"  width="7" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
            <rect x="18" y="12" width="7" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
            <rect x="18" y="16" width="5" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p style={{ color: FO.text, fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>
              FiberOps
            </p>
            <p style={{ color: FO.textMuted, fontSize: 11 }} className="truncate">
              {session?.user?.projeto_nome ?? session?.user?.projeto_id ?? 'Painel'}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: '12px 10px' }}>
          {itensVisiveis.map((item) => {
            const ativa = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href) && item.href !== '/admin/os')

            return (
              <div key={item.href}>
                {item.section && !item.indent && (
                  <p style={{
                    color: FO.textSection,
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
                    padding: '14px 10px 6px',
                    marginTop: 0,
                  }}>
                    {item.section}
                  </p>
                )}
                <Link
                  href={item.href}
                  onClick={() => setAberta(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: item.indent ? '7px 10px 7px 26px' : '8px 10px',
                    borderRadius: 8, marginBottom: 2,
                    fontSize: item.indent ? 12 : 13,
                    fontWeight: ativa ? 600 : 400,
                    backgroundColor: ativa ? FO.orangeBg : 'transparent',
                    color:           ativa ? FO.orangeText : FO.textMuted,
                    border:          ativa ? `1px solid ${FO.orangeBorder}` : '1px solid transparent',
                    transition: 'all 0.15s',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => { if (!ativa) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = FO.text } }}
                  onMouseLeave={e => { if (!ativa) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = FO.textMuted } }}
                >
                  <span style={{ fontSize: 11, opacity: ativa ? 1 : 0.7, flexShrink: 0 }}>{item.icon}</span>
                  <span>{t(item.labelKey)}</span>
                </Link>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${FO.border}`, padding: '14px 12px' }}>
          <div className="flex items-center gap-2 mb-3">
            <Link
              href="/perfil"
              onClick={() => setAberta(false)}
              className="flex items-center gap-2 flex-1 min-w-0 rounded-lg px-2 py-1.5 transition-colors"
              style={{ textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                backgroundColor: FO.orange,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              }}>
                {session?.user?.username?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: FO.text, fontSize: 12, fontWeight: 500 }} className="truncate">
                  {session?.user?.username}
                </p>
                <span style={{
                  display: 'inline-block', marginTop: 2,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                  padding: '1px 6px', borderRadius: 99,
                  color: roleColor.color,
                  backgroundColor: roleColor.bg,
                  border: `1px solid ${roleColor.border}`,
                }}>
                  {roleLabel}
                </span>
              </div>
            </Link>
            <Link
              href="/configuracoes"
              onClick={() => setAberta(false)}
              title="Configurações"
              style={{
                flexShrink: 0, textDecoration: 'none',
                width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, border: `1px solid ${FO.border}`,
                background: 'rgba(255,255,255,0.05)', color: FO.textMuted,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </Link>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              width: '100%', fontSize: 11, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${FO.border}`, background: 'transparent', color: FO.textMuted,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = FO.text }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = FO.textMuted }}
          >
            {t('sidebar.logout')}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header mobile */}
        <header
          style={{
            backgroundColor: FO.bg,
            borderBottom: `1px solid ${FO.border}`,
            flexShrink: 0,
          }}
          className="sticky top-0 z-[60] flex items-center px-4 py-3 lg:hidden relative"
        >
          <button
            onClick={() => setAberta(prev => !prev)}
            style={{ color: FO.textMuted, padding: 4 }}
            aria-label={aberta ? 'Fechar menu' : 'Abrir menu'}
          >
            {aberta ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold" style={{ color: FO.text }}>
            FiberOps
          </span>

          <div className="ml-auto flex items-center">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 99,
              background: isOnline ? 'rgba(22,101,52,0.85)' : 'rgba(180,83,9,0.90)',
              border: `1px solid ${isOnline ? 'rgba(34,197,94,0.35)' : 'rgba(251,191,36,0.45)'}`,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isOnline ? '#4ade80' : '#fbbf24',
                boxShadow: isOnline ? '0 0 5px #4ade80' : '0 0 5px #fbbf24',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: isOnline ? '#bbf7d0' : '#fef3c7' }}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-auto min-h-0 relative isolate" style={{ minHeight: 0 }}>
          {children}
        </main>
      </div>

      {/* Notificações OS em tempo real */}
      {notificacoesAtivas && (
        <OSToast notifications={toasts} onRemove={removeToast} />
      )}

      {/* Lembretes de ponto */}
      {pontoAtivo && (
        <PontoToast notifications={pontoToasts} onRemove={removePontoToast} />
      )}
    </div>
  );
}
