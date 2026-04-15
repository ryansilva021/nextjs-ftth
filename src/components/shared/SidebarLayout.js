"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { hasPermission, PERM, ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions'

// ── Grupos de separação visual ──────────────────────────────────────────────
const GROUPS = { public: 0, staff: 1, admin: 2, superadmin: 3 }

// ── Definição de itens do menu ──────────────────────────────────────────────
// perm:  permissão necessária (PERM.*)
// group: para separador visual e controle de acesso por role
const NAV_ITEMS = [
  { href: '/',                     label: 'Mapa',              icon: '🗺️', group: GROUPS.public  },

  // Visão de rede
  { href: '/admin/topologia', label: 'Topologia', icon: '🌐', perm: PERM.VIEW_TOPOLOGY, group: GROUPS.staff },
  { href: '/admin/campo',     label: 'Campo',      icon: '📡', perm: PERM.VIEW_FIELD,   group: GROUPS.staff },
  { href: '/admin/calculos',  label: 'Cálc. Potência', icon: '⚡', perm: PERM.VIEW_CALCULATIONS, group: GROUPS.staff },

  // Ordens de Serviço (tecnico, noc, recepcao)
  { href: '/admin/os',             label: 'Ordens de Serviço', icon: '📋', perm: PERM.VIEW_SERVICE_ORDERS,  group: GROUPS.staff },

  // Admin
  { href: '/admin/usuarios',       label: 'Usuários',          icon: '👥', perm: PERM.MANAGE_USERS,         group: GROUPS.admin },
  { href: '/admin/importar',       label: 'Imp/Exportar',      icon: '📦', perm: PERM.VIEW_IMPORT,          group: GROUPS.admin },
  { href: '/admin/logs',           label: 'Log de Eventos',    icon: '📜', perm: PERM.VIEW_LOGS,            group: GROUPS.admin },
  // Assinatura movida para /perfil (acessível pelo avatar no rodapé da sidebar)

  // Superadmin
  { href: '/superadmin/projetos',  label: 'Projetos',          icon: '🏢', group: GROUPS.superadmin },
  { href: '/superadmin/empresas',  label: 'Empresas',          icon: '🏬', group: GROUPS.superadmin },
  { href: '/superadmin/registros', label: 'Registros',         icon: '📋', group: GROUPS.superadmin },
]

function isItemVisible(item, role) {
  if (role === 'superadmin') {
    // Superadmin vê APENAS o painel de gestão (Projetos, Empresas, Registros)
    return item.group === GROUPS.superadmin
  }
  // Demais roles nunca veem itens do painel superadmin
  if (item.group === GROUPS.superadmin) return false
  if (item.perm) return hasPermission(role, item.perm)
  return true // sem restrição (Mapa)
}

export default function SidebarLayout({ session, children }) {
  const [aberta, setAberta] = useState(false);
  const pathname = usePathname();
  const role = session?.user?.role ?? "user";
  const roleLabel = ROLE_LABELS[role] ?? role
  const roleColor = ROLE_COLORS[role] ?? ROLE_COLORS.user

  const itensVisiveis = NAV_ITEMS.filter(item => isItemVisible(item, role))

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
            const ativa    = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const prevItem = arr[idx - 1]
            const showSep  = idx > 0 && prevItem && item.group !== prevItem.group

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
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-slate-200/20 hover:text-current"
                >
                  <span>{item.icon}</span>
                  {item.label}
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
              ⚙️
            </Link>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            className="w-full text-xs py-2 rounded-lg hover:bg-slate-200/20 transition-colors"
          >
            Sair
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

          {/* Direita: espaço reservado para simetria */}
          <div className="ml-auto w-7" />
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-auto min-h-0 relative isolate" style={{ minHeight: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
