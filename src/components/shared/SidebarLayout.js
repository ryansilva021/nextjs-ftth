"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { buscarClientes } from "@/actions/search";

function centralizarGPS() {
  window.dispatchEvent(new CustomEvent("fiberops:gps-center"));
}

const NAV_ITEMS = [
  { href: "/",                   label: "Mapa",        icon: "🗺️" },
  // --- Admin ---
  { href: "/admin/campo",        label: "Campo",       icon: "📡", minRole: "admin" },
  { href: "/admin/topologia",    label: "Diagramas",   icon: "🌐", minRole: "tecnico" },
  { href: "/admin/diagramas",    label: "Fusões ABNT", icon: "🧩", minRole: "admin" },
  { href: "/admin/usuarios",     label: "Usuários",    icon: "👥", minRole: "admin" },
  // --- Superadmin ---
  { href: "/superadmin/projetos",  label: "Projetos",  icon: "🏢", minRole: "superadmin" },
  { href: "/superadmin/empresas",  label: "Empresas",  icon: "🏬", minRole: "superadmin" },
  { href: "/superadmin/registros", label: "Registros", icon: "📋", minRole: "superadmin" },
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

  // --- Busca de clientes ---
  const [buscaCliente, setBuscaCliente] = useState("");
  const [resultadosCliente, setResultadosCliente] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const buscaTimerRef = useRef(null);
  const projetoId = session?.user?.projeto_id;

  useEffect(() => {
    if (buscaTimerRef.current) clearTimeout(buscaTimerRef.current);
    if (buscaCliente.trim().length < 2) {
      setResultadosCliente([]);
      return;
    }
    setBuscando(true);
    buscaTimerRef.current = setTimeout(async () => {
      try {
        const res = await buscarClientes(buscaCliente.trim(), projetoId);
        setResultadosCliente(res);
      } catch {
        setResultadosCliente([]);
      } finally {
        setBuscando(false);
      }
    }, 400);
    return () => clearTimeout(buscaTimerRef.current);
  }, [buscaCliente, projetoId]);

  function flyToCliente(item) {
    if (item.lat != null && item.lng != null) {
      window.dispatchEvent(new CustomEvent("fiberops:fly-to", {
        detail: { lat: item.lat, lng: item.lng, id: item.cto_id, tipo: "cto" },
      }));
    }
    setBuscaCliente("");
    setResultadosCliente([]);
    setAberta(false);
  }

  const itensVisiveis = NAV_ITEMS.filter(
    (item) => !item.minRole || hasMinRole(role, item.minRole),
  );

  const sidebarStyle = {
    backgroundColor: "#0d1526",
    borderRight: "1px solid #1f2937",
    width: "240px",
    minWidth: "240px",
  };

  const overlayStyle = {
    backgroundColor: "rgba(0,0,0,0.6)",
  };

  return (
    <div
      style={{ backgroundColor: "#0b1220", minHeight: "100vh" }}
      className="flex"
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
        style={sidebarStyle}
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col
          transform transition-transform duration-200
          lg:static lg:translate-x-0
          ${aberta ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div
          style={{ borderBottom: "1px solid #1f2937" }}
          className="flex items-center gap-3 px-5 py-4"
        >
          <div
            style={{ backgroundColor: "#0284c7" }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          >
            F
          </div>
          <div>
            <p className="text-white text-sm font-bold">FiberOps</p>
            <p className="text-slate-500 text-xs truncate max-w-[120px]">
              {session?.user?.projeto_nome ?? session?.user?.projeto_id}
            </p>
          </div>
        </div>

        {/* Busca de clientes */}
        <div style={{ borderBottom: "1px solid #1f2937", padding: "10px 12px", position: "relative" }}>
          <input
            type="text"
            value={buscaCliente}
            onChange={(e) => setBuscaCliente(e.target.value)}
            placeholder="Buscar cliente..."
            style={{
              width: "100%",
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 12,
              padding: "7px 10px",
              outline: "none",
            }}
          />
          {buscando && (
            <div style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: 11 }}>
              ...
            </div>
          )}
          {resultadosCliente.length > 0 && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              backgroundColor: "#0d1526",
              border: "1px solid #1f2937",
              borderTop: "none",
              borderRadius: "0 0 8px 8px",
              zIndex: 100,
              maxHeight: 220,
              overflowY: "auto",
            }}>
              {resultadosCliente.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => flyToCliente(item)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    backgroundColor: "transparent",
                    color: "#94a3b8",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                  className="hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <div style={{ color: "#e2e8f0", fontWeight: 600 }}>{item.cliente}</div>
                  <div style={{ color: "#475569", fontSize: 11 }}>
                    {item.cto_id}{item.porta != null ? ` · Porta ${item.porta}` : ""}
                    {item.lat == null ? " · sem localização" : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
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
                    style={{ backgroundColor: '#1f2937' }}
                  />
                )}
                <Link
                  href={item.href}
                  onClick={() => setAberta(false)}
                  style={{
                    backgroundColor: ativa ? "#0c2340" : "transparent",
                    color: ativa ? "#38bdf8" : "#94a3b8",
                    border: ativa ? "1px solid #0369a1" : "1px solid transparent",
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-slate-800 hover:text-white"
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              </div>
            )
          })}
        </nav>

        {/* Footer do sidebar */}
        <div style={{ borderTop: "1px solid #1f2937" }} className="px-4 py-4">
          {/* GPS */}
          <button
            onClick={() => { centralizarGPS(); setAberta(false) }}
            style={{ border: "1px solid #1e3a5f", color: "#7dd3fc", backgroundColor: "rgba(8,145,178,0.08)" }}
            className="w-full text-xs py-2 rounded-lg hover:bg-sky-900/30 transition-colors mb-3 flex items-center justify-center gap-2"
          >
            <span>📍</span>
            Minha localização
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div
              style={{ backgroundColor: "#1e3a5f" }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sky-400 text-xs font-bold uppercase"
            >
              {session?.user?.username?.[0] ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {session?.user?.username}
              </p>
              <p className="text-slate-500 text-xs capitalize">{role}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ border: "1px solid #1f2937", color: "#94a3b8" }}
            className="w-full text-xs py-2 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header mobile */}
        <header
          style={{
            backgroundColor: "#0d1526",
            borderBottom: "1px solid #1f2937",
          }}
          className="relative z-[60] flex items-center justify-between px-4 py-3 lg:hidden"
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
          <span className="text-white text-sm font-bold">FiberOps</span>
          <div className="w-7" />
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-auto min-h-0 relative isolate">{children}</main>
      </div>
    </div>
  );
}
