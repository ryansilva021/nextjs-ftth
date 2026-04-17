'use client'

import { useEffect, useRef } from 'react'

const CONTAINER_STYLE = {
  position: 'fixed',
  bottom: 20,
  left: 20,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  maxWidth: 320,
  width: 'calc(100vw - 40px)',
  pointerEvents: 'none',
}

function ToastItem({ notif, onRemove }) {
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(notif.id), 7_000)
    return () => clearTimeout(timerRef.current)
  }, [notif.id, onRemove])

  return (
    <div
      role="alert"
      aria-live="polite"
      onClick={() => onRemove(notif.id)}
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color-strong)',
        borderLeft: '4px solid #f59e0b',
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        pointerEvents: 'all',
        animation: 'pontoToastIn 0.25s ease',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>⏰</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 11, fontWeight: 700,
          color: '#f59e0b', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 3,
        }}>
          Lembrete de Ponto · {notif.time}
        </p>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600,
          color: 'var(--foreground)',
        }}>
          {notif.msg}
        </p>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onRemove(notif.id) }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 14, padding: '0 2px',
          flexShrink: 0, lineHeight: 1,
        }}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  )
}

export default function PontoToast({ notifications = [], onRemove }) {
  if (notifications.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes pontoToastIn {
          from { opacity: 0; transform: translateX(-20px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
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
