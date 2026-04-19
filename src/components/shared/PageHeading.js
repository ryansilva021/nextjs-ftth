'use client'

import { useLanguage } from '@/contexts/LanguageContext'

export default function PageHeading({ titleKey, subtitleKey, subtitle }) {
  const { t } = useLanguage()
  return (
    <div>
      <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
        {t(titleKey)}
      </h1>
      {(subtitleKey || subtitle) && (
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {subtitleKey ? t(subtitleKey) : subtitle}
        </p>
      )}
    </div>
  )
}
