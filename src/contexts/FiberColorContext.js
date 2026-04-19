'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getFiberColors } from '@/actions/config'
import { setProjectAbntColors } from '@/lib/topologia-ftth'

const ABNT_FALLBACK = [
  { idx: 1,  posicao: 1,  nome: 'Verde',    hex: '#16a34a' },
  { idx: 2,  posicao: 2,  nome: 'Amarelo',  hex: '#ca8a04' },
  { idx: 3,  posicao: 3,  nome: 'Branco',   hex: '#94a3b8' },
  { idx: 4,  posicao: 4,  nome: 'Azul',     hex: '#2563eb' },
  { idx: 5,  posicao: 5,  nome: 'Vermelho', hex: '#dc2626' },
  { idx: 6,  posicao: 6,  nome: 'Violeta',  hex: '#7c3aed' },
  { idx: 7,  posicao: 7,  nome: 'Marrom',   hex: '#92400e' },
  { idx: 8,  posicao: 8,  nome: 'Rosa',     hex: '#db2777' },
  { idx: 9,  posicao: 9,  nome: 'Preto',    hex: '#1e293b' },
  { idx: 10, posicao: 10, nome: 'Cinza',    hex: '#6b7280' },
  { idx: 11, posicao: 11, nome: 'Laranja',  hex: '#ea580c' },
  { idx: 12, posicao: 12, nome: 'Aqua',     hex: '#0891b2' },
]

export const FiberColorContext = createContext(ABNT_FALLBACK)

export function FiberColorProvider({ projectId, children }) {
  const [colors, setColors] = useState(ABNT_FALLBACK)

  const apply = useCallback((raw) => {
    if (!raw?.length) return
    const normalized = raw.map(c => ({ ...c, idx: c.idx ?? c.posicao }))
    setColors(normalized)
    setProjectAbntColors(normalized) // sincroniza o módulo para abntHex()
  }, [])

  // Carrega do banco na montagem
  useEffect(() => {
    if (!projectId) return
    getFiberColors(projectId)
      .then(apply)
      .catch(() => {})
  }, [projectId, apply])

  // Escuta evento disparado pelo painel de configurações ao salvar
  useEffect(() => {
    function onUpdate(e) {
      if (e.detail?.length >= 12) apply(e.detail)
    }
    window.addEventListener('fibercolors:update', onUpdate)
    return () => window.removeEventListener('fibercolors:update', onUpdate)
  }, [apply])

  return (
    <FiberColorContext.Provider value={colors}>
      {children}
    </FiberColorContext.Provider>
  )
}

/** Hook para componentes de edição — retorna o array de cores do projeto. */
export function useFiberColors() {
  return useContext(FiberColorContext)
}
