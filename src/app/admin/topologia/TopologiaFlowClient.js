'use client'

import dynamic from 'next/dynamic'

const DiagramaTopologiaFlow = dynamic(
  () => import('@/components/map/DiagramaTopologiaFlow'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: '100%', minHeight: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#060a16', borderRadius: 12,
        color: '#475569', fontSize: 13,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 28, height: 28,
            border: '3px solid rgba(8,145,178,0.3)',
            borderTop: '3px solid #0891b2',
            borderRadius: '50%', margin: '0 auto 10px',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Carregando diagrama...
        </div>
      </div>
    ),
  }
)

export default function TopologiaFlowClient({ projetoId, userRole }) {
  return (
    <div style={{ height: 'calc(100vh - 120px)', minHeight: 500 }}>
      <DiagramaTopologiaFlow projetoId={projetoId} userRole={userRole} altura="100%" />
    </div>
  )
}
