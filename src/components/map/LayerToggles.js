'use client'

import { Box, Layers, Route, Zap, Server } from 'lucide-react'

const LAYERS = [
  { key: 'ctos',   label: 'CTOs',    icon: Box,    activeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { key: 'caixas', label: 'CE/CDOs', icon: Layers,  activeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  { key: 'rotas',  label: 'Rotas',   icon: Route,   activeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  { key: 'postes', label: 'Postes',  icon: Zap,     activeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  { key: 'olts',   label: 'OLTs',    icon: Server,  activeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
]

export default function LayerToggles({ toggles = {}, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2 p-3 pointer-events-auto">
      {LAYERS.map(({ key, label, icon: Icon, activeColor }) => {
        const isActive = toggles[key] ?? true
        return (
          <button
            key={key}
            onClick={() => onToggle?.(key, !isActive)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium',
              'transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
              isActive
                ? activeColor
                : 'bg-[#0b1220]/80 text-white border-white/20 hover:border-white/40 hover:bg-white/5',
            ].join(' ')}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
