'use client'

import { useLanguage } from '@/contexts/LanguageContext'

export default function OsBadge() {
  const { t } = useLanguage()
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 10px', borderRadius: 99,
      backgroundColor: '#1d4ed822', border: '1px solid #1d4ed855',
      fontSize: 11, color: '#60a5fa', fontWeight: 600,
    }}>
      {t('os.badge')}
    </span>
  )
}
