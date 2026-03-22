'use client'

import dynamic from 'next/dynamic'

const MapaFTTH = dynamic(() => import('@/components/map/MapaFTTH'), {
  ssr: false,
  loading: () => (
    <div
      style={{ backgroundColor: 'var(--background)' }}
      className="flex items-center justify-center h-full w-full"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Carregando mapa...</p>
      </div>
    </div>
  ),
})

export default function MapaFTTHClient(props) {
  return <MapaFTTH {...props} />
}
