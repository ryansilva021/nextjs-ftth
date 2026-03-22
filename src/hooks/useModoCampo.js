'use client'

import { useState, useEffect } from 'react'

/**
 * AGENT_CAMPO — detecta modo campo (mobile < 480px).
 * SSR-safe: retorna false no servidor.
 *
 * @returns {{ isCampo: boolean, isMobile: boolean, isTablet: boolean }}
 */
export function useModoCampo() {
  const [width, setWidth] = useState(null)

  useEffect(() => {
    const update = () => setWidth(window.innerWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [])

  return {
    isCampo:  width !== null ? width < 480  : false,
    isMobile: width !== null ? width < 768  : false,
    isTablet: width !== null ? width >= 768 && width < 1024 : false,
  }
}
