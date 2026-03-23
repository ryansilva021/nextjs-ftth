'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const NAV_ITEMS = [
  { href: '/superadmin/projetos', label: 'Projetos', icon: '🏢' },
  { href: '/superadmin/registros', label: 'Registros Pendentes', icon: '📋' },
  { href: '/', label: 'Voltar ao Mapa', icon: '🗺️' },
]

export default function SuperadminSidebarLayout({ session, children }) {
  const [aberta, setAberta] = useState(false)
  const pathname = usePathname()

  const sidebarStyle = {
    backgroundColor: 'var(--sidebar-bg)',
    borderRight: '1px solid var(--sidebar-border)',
    width: '260px',
    minWidth: '260px',
  }

  return (
    <div style={{ backgroundColor: 'var(--background)' }} className="flex h-screen overflow-hidden">
      {/* Overlay mobile */}
      {aberta && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
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
          ${aberta ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
          className="flex items-center gap-3 px-5 py-4"
        >
          <div
            style={{ backgroundColor: '#7c3aed' }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          >
            S
          </div>
          <div>
            <p className="text-white text-sm font-bold">FiberOps</p>
            <p className="text-violet-400 text-xs font-semibold">Superadmin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const ativa = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAberta(false)}
                style={{
                  backgroundColor: ativa ? '#1e1040' : 'transparent',
                  color: ativa ? '#a78bfa' : 'var(--text-secondary)',
                  border: ativa ? '1px solid #5b21b6' : '1px solid transparent',
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-slate-800 hover:text-white"
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div
          style={{ borderTop: '1px solid var(--sidebar-border)', marginTop: 'auto' }}
          className="px-4 py-4"
        >
          <Link href="/perfil"
            className="flex items-center gap-3 mb-3 rounded-lg px-1 py-1 transition-colors hover:bg-slate-200/20"
            style={{ textDecoration: 'none' }}>
            <div
              style={{ backgroundColor: '#2e1065' }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-violet-400 text-xs font-bold uppercase flex-shrink-0"
            >
              {session?.user?.username?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: 'var(--foreground)' }} className="text-xs font-medium truncate">
                {session?.user?.username}
              </p>
              <p className="text-violet-400 text-xs font-semibold">superadmin</p>
            </div>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{ border: '1px solid var(--sidebar-border)', color: 'var(--text-secondary)' }}
            className="w-full text-xs py-2 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header mobile */}
        <header
          style={{ backgroundColor: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0 }}
          className="sticky top-0 z-[60] flex items-center justify-between px-4 py-3 lg:hidden"
        >
          <button
            onClick={() => setAberta(true)}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Abrir menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-white text-sm font-bold">Superadmin</span>
          <div className="w-7" />
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
