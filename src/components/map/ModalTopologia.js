'use client'

import dynamic from 'next/dynamic'

const DiagramaTopologia = dynamic(
  () => import('@/components/map/DiagramaTopologiaFlow'),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
        Carregando topologia...
      </div>
    ),
  }
)

export default function ModalTopologia({ projetoId, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-6xl overflow-hidden"
        style={{ backgroundColor: 'rgba(6,10,22,0.99)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '94vh', height: '94vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🌐</span>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>Diagrama</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Topologia da Rede</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            className="hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '12px' }}>
          <DiagramaTopologia projetoId={projetoId} altura="100%" />
        </div>
      </div>
    </div>
  )
}
