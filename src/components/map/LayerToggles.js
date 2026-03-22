'use client'

import { Box, Layers, Route, Zap, Server } from 'lucide-react'

const LAYERS = [
  { key: 'ctos',   label: 'CTOs',    icon: Box,    activeColor: 'bg-emerald-600/40 text-white border-emerald-500/60' },
  { key: 'caixas', label: 'CE/CDOs', icon: Layers,  activeColor: 'bg-blue-600/40 text-white border-blue-500/60' },
  { key: 'rotas',  label: 'Rotas',   icon: Route,   activeColor: 'bg-orange-600/40 text-white border-orange-500/60' },
  { key: 'postes', label: 'Postes',  icon: Zap,     activeColor: 'bg-yellow-600/40 text-white border-yellow-500/60' },
  { key: 'olts',   label: 'OLTs',    icon: Server,  activeColor: 'bg-cyan-600/40 text-white border-cyan-500/60' },
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
                : 'bg-white/10 text-zinc-500 dark:text-zinc-400 border-black/20 dark:border-white/40 hover:border-black/40 dark:hover:border-white/60 hover:bg-black/10 dark:hover:bg-white/5',
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
