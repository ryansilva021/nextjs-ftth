'use client'

import { useEffect, useState } from 'react'

const SV_URL  = (lat, lng) =>
  `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=12,90,0,0,0&hl=pt-BR`

/**
 * StreetViewModal — modal de confirmação + link direto para Google Street View.
 * Google bloqueia iframe (X-Frame-Options), portanto usa <a target="_blank">.
 */
export default function StreetViewModal({ lat, lng, onClose }) {
  const [loading, setLoading] = useState(false)
  const [opened,  setOpened]  = useState(false)

  // Fechar com ESC
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  function handleOpen() {
    setLoading(true)
    // Simula feedback de loading antes de abrir a nova aba
    setTimeout(() => { setLoading(false); setOpened(true) }, 600)
  }

  const svUrl = SV_URL(lat, lng)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Street View"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
        animation: 'sv-fade 0.18s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <style>{`
        @keyframes sv-fade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sv-rise  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sv-spin  { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 18,
        padding: '28px 28px 22px',
        maxWidth: 360, width: '90vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        textAlign: 'center',
        animation: 'sv-rise 0.22s ease',
      }}>

        {/* Ícone Pegman */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: opened ? 'rgba(34,197,94,0.12)' : 'rgba(2,132,199,0.12)',
          border: `1px solid ${opened ? 'rgba(34,197,94,0.3)' : 'rgba(2,132,199,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.3s',
        }}>
          {loading ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'sv-spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : opened ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="4.5" r="2.2" fill="#0284c7" stroke="none"/>
              <line x1="12" y1="6.7" x2="12" y2="14"/>
              <line x1="12" y1="10"  x2="8"  y2="13"/>
              <line x1="12" y1="9"   x2="17" y2="7"/>
              <line x1="12" y1="14"  x2="9"  y2="20"/>
              <line x1="12" y1="14"  x2="15" y2="20"/>
            </svg>
          )}
        </div>

        {/* Texto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, margin: 0 }}>
            {opened ? 'Street View aberto!' : 'Street View'}
          </p>
          <p style={{ color: '#475569', fontSize: 11, margin: 0 }}>
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        </div>

        {/* Botão principal */}
        <a
          href={svUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpen}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '12px 0', borderRadius: 10,
            background: loading
              ? 'rgba(2,132,199,0.4)'
              : opened
                ? 'linear-gradient(135deg,#16a34a,#15803d)'
                : 'linear-gradient(135deg,#0284c7,#0369a1)',
            color: '#fff', fontWeight: 700, fontSize: 14,
            textDecoration: 'none',
            pointerEvents: loading ? 'none' : 'auto',
            transition: 'background 0.25s',
          }}
        >
          {loading ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'sv-spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Abrindo…
            </>
          ) : opened ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Abrir novamente
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Abrir Street View
            </>
          )}
        </a>

        {/* Nota de fallback */}
        {!opened && (
          <p style={{ color: '#334155', fontSize: 11, margin: 0, lineHeight: 1.4 }}>
            Abre o Google Maps na visão de rua para este ponto.
          </p>
        )}

        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#334155', fontSize: 12, padding: 0,
          }}
        >
          {opened ? 'Fechar' : 'Cancelar'}
        </button>
      </div>
    </div>
  )
}
