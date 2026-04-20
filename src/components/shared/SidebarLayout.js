"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
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

// ── Grupos de separação visual ──────────────────────────────────────────────
const GROUPS = { public: 0, staff: 1, admin: 2, superadmin: 3 }

// ── Definição de itens do menu ──────────────────────────────────────────────
// perm:  permissão necessária (PERM.*)
// group: para separador visual e controle de acesso por role
const NAV_ITEMS = [
  { href: '/',                     labelKey: 'nav.map',          icon: '🗺️', group: GROUPS.public  },

  // Visão de rede
  { href: '/admin/topologia', labelKey: 'nav.topology',     icon: '🌐', perm: PERM.VIEW_TOPOLOGY,      group: GROUPS.staff },
  { href: '/admin/campo',     labelKey: 'nav.field',        icon: '📡', perm: PERM.VIEW_FIELD,         group: GROUPS.staff },
  { href: '/admin/calculos',  labelKey: 'nav.calculations', icon: '⚡', perm: PERM.VIEW_CALCULATIONS,  group: GROUPS.staff },

  // Ordens de Serviço (tecnico, noc, recepcao)
  { href: '/admin/os',        labelKey: 'nav.all_os', icon: '📋', perm: PERM.VIEW_SERVICE_ORDERS, group: GROUPS.staff },
  { href: '/admin/os/minhas', labelKey: 'nav.my_os',  icon: '🗒️', perm: PERM.VIEW_SERVICE_ORDERS, group: GROUPS.staff, indent: true, noTecnico: true },
  { href: '/ponto',                labelKey: 'nav.ponto',        icon: '🕐', perm: PERM.PUNCH_CLOCK,          group: GROUPS.staff },
  { href: '/configuracoes/ponto',  labelKey: 'nav.ponto_config', icon: '⏰', perm: PERM.MANAGE_USERS,         group: GROUPS.staff, indent: true },

  // Admin
  { href: '/admin/usuarios',       labelKey: 'nav.users',    icon: '👥', perm: PERM.MANAGE_USERS,  group: GROUPS.admin },
  { href: '/admin/importar',       labelKey: 'nav.import',   icon: '📦', perm: PERM.VIEW_IMPORT,   group: GROUPS.admin },
  { href: '/admin/logs',           labelKey: 'nav.logs',     icon: '📜', perm: PERM.VIEW_LOGS,     group: GROUPS.admin },

  // Superadmin
  { href: '/superadmin/projetos',  labelKey: 'nav.projects',  icon: '🏢', group: GROUPS.superadmin },
  { href: '/superadmin/empresas',  labelKey: 'nav.companies', icon: '🏬', group: GROUPS.superadmin },
  { href: '/superadmin/registros', labelKey: 'nav.records',   icon: '📋', group: GROUPS.superadmin },
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

  const sidebarStyle = {
    backgroundColor: "var(--sidebar-bg)",
    borderRight: "1px solid var(--sidebar-border)",
    width: "240px",
    minWidth: "240px",
  };

  return (
    <div
      style={{ backgroundColor: "var(--background)" }}
      className="flex h-screen overflow-hidden"
    >
      {/* Overlay mobile */}
      {aberta && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setAberta(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{ ...sidebarStyle, height: 'calc(100dvh - 52px)' }}
        className={`
          fixed top-[52px] left-0 z-30 flex flex-col
          transform transition-transform duration-200
          lg:static lg:translate-x-0 lg:top-0 lg:!h-screen lg:flex-shrink-0
          ${aberta ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
          className="flex items-center gap-3 px-5 py-4"
        >
          <Image src="/short-logo.svg" alt="FiberOps" width={32} height={32} priority />
          <div className="flex-1 min-w-0">
            <p style={{ color: "var(--foreground)" }} className="text-sm font-bold">FiberOps</p>
            <p style={{ color: 'var(--text-muted)' }} className="text-xs truncate max-w-[120px]">
              {session?.user?.projeto_nome ?? session?.user?.projeto_id}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {itensVisiveis.map((item, idx, arr) => {
            const ativa    = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href) && item.href !== '/admin/os')
            const prevItem = arr[idx - 1]
            const showSep  = idx > 0 && prevItem && item.group !== prevItem.group && !item.indent

            return (
              <div key={item.href}>
                {showSep && (
                  <div
                    className="my-2 mx-1 h-px"
                    style={{ backgroundColor: 'var(--border-color)' }}
                  />
                )}
                <Link
                  href={item.href}
                  onClick={() => setAberta(false)}
                  style={{
                    backgroundColor: ativa ? "var(--card-bg-active)" : "transparent",
                    color:           ativa ? "#ea580c" : "var(--text-muted)",
                    border:          ativa ? "1px solid #f4b07a" : "1px solid transparent",
                    marginLeft:      item.indent ? 16 : 0,
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-slate-200/20 hover:text-current"
                >
                  <span style={{ fontSize: item.indent ? 13 : undefined }}>{item.icon}</span>
                  <span style={{ fontSize: item.indent ? 12 : undefined }}>{t(item.labelKey)}</span>
                </Link>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: "1px solid var(--border-color)", marginTop: 'auto' }} className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Link
              href="/perfil"
              onClick={() => setAberta(false)}
              className="flex items-center gap-3 flex-1 min-w-0 rounded-lg px-1 py-1 transition-colors hover:bg-slate-200/20"
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{ backgroundColor: "var(--card-bg-active)" }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sky-400 text-xs font-bold uppercase flex-shrink-0"
              >
                {session?.user?.username?.[0] ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: 'var(--foreground)' }} className="text-xs font-medium truncate">
                  {session?.user?.username}
                </p>
                {/* Badge de role com cor dinâmica */}
                <span style={{
                  display: 'inline-block', marginTop: 2,
                  fontSize: 10, fontWeight: 600,
                  padding: '1px 7px', borderRadius: 99,
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
                flexShrink: 0, fontSize: 15, textDecoration: 'none',
                width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, border: '1px solid var(--border-color)',
                background: 'var(--card-bg-active)', color: 'var(--text-muted)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </Link>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            className="w-full text-xs py-2 rounded-lg hover:bg-slate-200/20 transition-colors"
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
            backgroundColor: "var(--sidebar-bg)",
            borderBottom: "1px solid var(--sidebar-border)",
            flexShrink: 0,
          }}
          className="sticky top-0 z-[60] flex items-center px-4 py-3 lg:hidden relative"
        >
          {/* Esquerda: hambúrguer */}
          <button
            onClick={() => setAberta(prev => !prev)}
            className="text-slate-400 hover:text-white p-1 z-10"
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

          {/* Centro: apenas FiberOps centralizado */}
          <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            FiberOps
          </span>

          {/* Direita: badge online/offline */}
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
