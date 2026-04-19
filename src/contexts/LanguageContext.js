'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { createT, LANGUAGES } from '@/lib/i18n'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('pt')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pref_language')
      if (saved && LANGUAGES.some(l => l.code === saved)) {
        setLangState(saved)
      }
    } catch (_) {}
  }, [])

  const setLang = useCallback((code) => {
    setLangState(code)
    try { localStorage.setItem('pref_language', code) } catch (_) {}
    window.dispatchEvent(new CustomEvent('language:change', { detail: code }))
  }, [])

  // Sync across tabs/components
  useEffect(() => {
    function onLangChange(e) {
      if (e.detail && e.detail !== lang) setLangState(e.detail)
    }
    window.addEventListener('language:change', onLangChange)
    return () => window.removeEventListener('language:change', onLangChange)
  }, [lang])

  const t = useMemo(() => createT(lang), [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
