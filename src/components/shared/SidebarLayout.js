"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from '@/contexts/ThemeContext'

const NAV_ITEMS = [
  { href: "/",                   label: "Mapa",        icon: "🗺️" },
  // --- Admin ---
  { href: "/admin/campo",        label: "Campo",       icon: "📡", minRole: "admin" },
  { href: "/admin/topologia",    label: "Diagramas",   icon: "🌐", minRole: "tecnico" },
  { href: "/admin/diagramas",    label: "Fusões ABNT", icon: "🧩", minRole: "admin" },
  { href: "/admin/usuarios",     label: "Usuários",    icon: "👥", minRole: "admin" },
  { href: "/admin/importar",     label: "Imp/Exportar", icon: "📦", minRole: "admin" },
  { href: "/admin/calculos",     label: "Cálc. Potência", icon: "⚡", minRole: "tecnico" },
  // --- Superadmin ---
  { href: "/superadmin/projetos",  label: "Projetos",  icon: "🏢", minRole: "superadmin" },
  { href: "/superadmin/empresas",  label: "Empresas",  icon: "🏬", minRole: "superadmin" },
  { href: "/superadmin/registros", label: "Registros", icon: "📋", minRole: "superadmin" },
  { href: "/admin/logs",           label: "Log de Eventos", icon: "📜", minRole: "tecnico" },
  { href: "/configuracoes",        label: "Configurações",  icon: "⚙️" },
];

const ROLE_RANK = {
  superadmin: 4,
  admin: 3,
  tecnico: 2,
  user: 1,
};

function hasMinRole(role, minimum) {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[minimum] ?? 99);
}

export default function SidebarLayout({ session, children }) {
  const [aberta, setAberta] = useState(false);
  const pathname = usePathname();
  const role = session?.user?.role ?? "user";
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const itensVisiveis = NAV_ITEMS.filter(
    (item) => !item.minRole || hasMinRole(role, item.minRole),
  );

  const sidebarStyle = {
    backgroundColor: "var(--sidebar-bg)",
    borderRight: "1px solid var(--sidebar-border)",
    width: "240px",
    minWidth: "240px",
  };

  const overlayStyle = {
    backgroundColor: "rgba(0,0,0,0.6)",
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
          style={overlayStyle}
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
          <div
            style={{ backgroundColor: "#0284c7" }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          >
            F
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ color: "var(--foreground)" }} className="text-sm font-bold">FiberOps</p>
            <p className="text-slate-500 text-xs truncate max-w-[120px]">
              {session?.user?.projeto_nome ?? session?.user?.projeto_id}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            style={{
              background: 'none',
              border: '1px solid var(--sidebar-border)',
              borderRadius: 8,
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 16,
              flexShrink: 0,
              color: 'var(--text-muted)',
            }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {itensVisiveis.map((item, idx, arr) => {
            const ativa = pathname === item.href
            const prevItem = arr[idx - 1]
            // Separador visual entre grupos: público / staff (tecnico+admin) / superadmin
            const grupo = (r) => r === 'superadmin' ? 'superadmin' : r ? 'staff' : 'public'
            const showSeparator = idx > 0 && grupo(item.minRole) !== grupo(prevItem?.minRole)
            return (
              <div key={item.href}>
                {showSeparator && (
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
                    color: ativa ? "#38bdf8" : "var(--text-muted)",
                    border: ativa ? "1px solid #0369a1" : "1px solid transparent",
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

        {/* Footer do sidebar */}
        <div style={{ borderTop: "1px solid var(--border-color)", marginTop: 'auto' }} className="px-4 py-4">
          <Link href="/perfil" onClick={() => setAberta(false)}
            className="flex items-center gap-3 mb-3 rounded-lg px-1 py-1 transition-colors hover:bg-slate-200/20"
            style={{ textDecoration: 'none' }}>
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
              <p style={{ color: 'var(--text-muted)' }} className="text-xs capitalize">{role}</p>
            </div>
          </Link>
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
          className="sticky top-0 z-[60] flex items-center justify-between px-4 py-3 lg:hidden"
        >
          <button
            onClick={() => setAberta(true)}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Abrir menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span style={{ color: 'var(--foreground)' }} className="text-sm font-bold">FiberOps</span>
          <div className="w-7" />
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-auto min-h-0 relative isolate" style={{ minHeight: 0 }}>{children}</main>
      </div>
    </div>
  );
}
