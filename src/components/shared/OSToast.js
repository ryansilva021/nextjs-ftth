/**
 * components/shared/OSToast.js
 *
 * Exibe notificações em tempo real de novas OS atribuídas ao técnico.
 * Estilo compatível com o tema quente (warm) do FiberOps.
 *
 * Uso:
 *   <OSToast notifications={notifications} onRemove={(id) => ...} />
 */

'use client'

import { useEffect, useRef } from 'react'

const TIPO_ICON = {
  instalacao:   '📶',
  manutencao:   '🔧',
  suporte:      '💬',
  cancelamento: '✕',
}

const TIPO_LABEL = {
  instalacao:   'Instalação',
  manutencao:   'Manutenção',
  suporte:      'Suporte',
  cancelamento: 'Cancelamento',
}

// ── Estilos do tema quente (warm) ───────────────────────────────────────────

const CONTAINER_STYLE = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  maxWidth: 340,
  width: 'calc(100vw - 40px)',
  pointerEvents: 'none',
}

function ToastItem({ notif, onRemove }) {
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(notif.id), 6_000)
    return () => clearTimeout(timerRef.current)
  }, [notif.id, onRemove])

  const icon  = TIPO_ICON[notif.tipo]  ?? '📋'
  const label = TIPO_LABEL[notif.tipo] ?? notif.tipo

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color-strong)',
        borderLeft: '4px solid var(--accent)',
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        pointerEvents: 'all',
        animation: 'osToastIn 0.25s ease',
        cursor: 'pointer',
      }}
      onClick={() => onRemove(notif.id)}
    >
      {/* Ícone */}
      <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{icon}</span>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--accent)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 2,
        }}>
          Nova OS · {label}
        </p>
        <p style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--foreground)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {notif.cliente_nome ?? 'Cliente'}
        </p>
        {notif.cliente_endereco && (
          <p style={{
            margin: '2px 0 0',
            fontSize: 11,
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {notif.cliente_endereco}
          </p>
        )}
        <p style={{
          margin: '4px 0 0',
          fontSize: 11,
          color: 'var(--text-secondary)',
          fontWeight: 500,
        }}>
          Nova ordem de serviço atribuída a você
        </p>
      </div>

      {/* Botão fechar */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(notif.id) }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 14,
          padding: '0 2px',
          flexShrink: 0,
          lineHeight: 1,
        }}
        aria-label="Fechar notificação"
      >
        ✕
      </button>
    </div>
  )
}

export default function OSToast({ notifications = [], onRemove }) {
  if (notifications.length === 0) return null

  return (
    <>
      {/* Keyframe injetado uma vez */}
      <style>{`
        @keyframes osToastIn {
          from { opacity: 0; transform: translateX(20px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)   scale(1); }
        }
      `}</style>

      <div style={CONTAINER_STYLE}>
        {notifications.map(n => (
          <ToastItem key={n.id} notif={n} onRemove={onRemove} />
        ))}
      </div>
    </>
  )
}
