'use client'

import { Box, Layers, Route, Zap, Server } from 'lucide-react'

const LAYERS = [
  { key: 'ctos',   label: 'CTOs',    icon: Box,    activeBg: 'rgba(22,163,74,0.30)',  activeBorder: 'rgba(22,163,74,0.70)'  },
  { key: 'caixas', label: 'CE/CDOs', icon: Layers,  activeBg: 'rgba(37,99,235,0.30)',  activeBorder: 'rgba(37,99,235,0.70)'  },
  { key: 'rotas',  label: 'Rotas',   icon: Route,   activeBg: 'rgba(234,88,12,0.28)',  activeBorder: 'rgba(234,88,12,0.65)'  },
  { key: 'postes', label: 'Postes',  icon: Zap,     activeBg: 'rgba(202,138,4,0.28)',  activeBorder: 'rgba(202,138,4,0.65)'  },
  { key: 'olts',   label: 'OLTs',    icon: Server,  activeBg: 'rgba(8,145,178,0.28)',  activeBorder: 'rgba(8,145,178,0.65)'  },
]

export default function LayerToggles({ toggles = {}, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, pointerEvents: 'auto' }}>
      {LAYERS.map(({ key, label, icon: Icon, activeBg, activeBorder }) => {
        const isActive = toggles[key] ?? true
        return (
          <button
            key={key}
            onClick={() => onToggle?.(key, !isActive)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20, border: `1px solid ${isActive ? activeBorder : '#b8a080'}`,
              backgroundColor: isActive ? activeBg : 'rgba(0,0,0,0.06)',
              color: '#0f0701',
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
              outline: 'none',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
