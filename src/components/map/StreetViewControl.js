'use client'

/**
 * StreetViewControl — botão flutuante estilo Pegman para ativar modo Street View.
 * Renderiza dois elementos absolute dentro do container do mapa:
 *   1. Botão (canto inferior esquerdo, acima do GPS)
 *   2. Banner de instrução (topo central) — visível só quando ativo
 *
 * Props:
 *   isActive   boolean   — modo pickMode ligado
 *   onActivate () => void
 *   onDeactivate () => void
 *   isDark     boolean   — segue tema do mapa
 */
export default function StreetViewControl({ isActive, onActivate, onDeactivate, isDark }) {
  return (
    <>
      {/* ── Botão Pegman ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 'max(70px, calc(env(safe-area-inset-bottom, 16px) + 54px))',
          left: 12,
          zIndex: 40,
        }}
      >
        <button
          onClick={isActive ? onDeactivate : onActivate}
          title={isActive ? 'Sair do modo Street View' : 'Ver Street View (clique no mapa)'}
          aria-pressed={isActive}
          style={{
            position: 'relative',
            width: 44, height: 44,
            borderRadius: 12,
            background: isActive
              ? 'rgba(2,132,199,0.92)'
              : isDark ? 'rgba(15,23,42,0.88)' : 'rgba(162,138,108,0.96)',
            border: isActive
              ? '1.5px solid #38bdf8'
              : isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #8e7254',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: isActive
              ? '0 2px 16px rgba(2,132,199,0.45)'
              : '0 2px 12px rgba(0,0,0,0.18)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isActive ? '#fff' : isDark ? '#e2e8f0' : '#1e293b',
            transition: 'all 0.18s ease',
          }}
        >
          <PegmanIcon />

          {/* Pulse ring quando ativo */}
          {isActive && (
            <span style={{
              position: 'absolute', inset: -4,
              borderRadius: 16,
              border: '2px solid rgba(56,189,248,0.5)',
              animation: 'sv-pulse 1.4s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}
        </button>

        <style>{`
          @keyframes sv-pulse {
            0%, 100% { opacity: 0.7; transform: scale(1); }
            50%       { opacity: 0.2; transform: scale(1.12); }
          }
        `}</style>
      </div>

      {/* ── Banner de instrução — só quando ativo ── */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 16px 8px 12px',
            borderRadius: 999,
            background: 'rgba(2,132,199,0.92)',
            border: '1px solid rgba(56,189,248,0.4)',
            boxShadow: '0 4px 20px rgba(2,132,199,0.3)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap',
            maxWidth: '90vw',
            pointerEvents: 'none',
          }}
        >
          {/* Ícone crosshair animado */}
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#fff',
            display: 'inline-block',
            animation: 'sv-pulse 1.4s ease-in-out infinite',
            flexShrink: 0,
          }} />

          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
            Clique no mapa para ver a rua
          </span>

          <button
            onClick={onDeactivate}
            aria-label="Cancelar Street View"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1,
              padding: 0, marginLeft: 4, flexShrink: 0,
              pointerEvents: 'auto',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}

/* Ícone de pessoa estilo Pegman */
function PegmanIcon() {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Cabeça */}
      <circle cx="12" cy="4.5" r="2.2" fill="currentColor" stroke="none" />
      {/* Tronco */}
      <line x1="12" y1="6.7" x2="12" y2="14" />
      {/* Braço esquerdo — baixo */}
      <line x1="12" y1="10" x2="8"  y2="13" />
      {/* Braço direito — levantado (acenando) */}
      <line x1="12" y1="9"  x2="17" y2="7" />
      {/* Perna esquerda */}
      <line x1="12" y1="14" x2="9"  y2="20" />
      {/* Perna direita */}
      <line x1="12" y1="14" x2="15" y2="20" />
    </svg>
  )
}
