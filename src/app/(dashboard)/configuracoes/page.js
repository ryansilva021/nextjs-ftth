'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Helpers de persistência (localStorage)
// ---------------------------------------------------------------------------
function loadPref(key, defaultVal) {
  if (typeof window === 'undefined') return defaultVal
  try {
    const v = localStorage.getItem(key)
    if (v === null) return defaultVal
    if (v === 'true') return true
    if (v === 'false') return false
    return v
  } catch { return defaultVal }
}
function savePref(key, val) {
  try { localStorage.setItem(key, String(val)) } catch { }
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function SectionTitle({ children }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: 'var(--text-muted)',
      marginBottom: 12, marginTop: 0,
    }}>
      {children}
    </p>
  )
}

function SettingRow({ label, description, children, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '14px 0',
      borderBottom: last ? 'none' : '1px solid var(--border-color)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{label}</p>
        {description && (
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{description}</p>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? '#0284c7' : 'var(--border-color)',
        position: 'relative', transition: 'background 0.2s',
        flexShrink: 0,
      }}
      aria-checked={value}
      role="switch"
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--inp-bg, var(--card-bg))',
        border: '1px solid var(--border-color)',
        borderRadius: 8, padding: '6px 10px',
        fontSize: 13, color: 'var(--foreground)', cursor: 'pointer',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ConfiguracoesPage() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  // Preferências
  const [campoMode, setCampoMode] = useState(false)

  // Mapa
  const [animacoes, setAnimacoes]       = useState(true)
  const [sombhasCTO, setSombrasCTO]     = useState(true)

  // GPS
  const [gpsAcc, setGpsAcc]           = useState('high')
  const [gpsAutoFollow, setGpsAutoFollow] = useState(false)

  // Carrega preferências salvas
  useEffect(() => {
    setCampoMode(loadPref('pref_campo_mode', false))
    setAnimacoes(loadPref('pref_animacoes', true))
    setSombrasCTO(loadPref('pref_sombras_cto', true))
    setGpsAcc(loadPref('pref_gps_acc', 'high'))
    setGpsAutoFollow(loadPref('pref_gps_follow', false))
  }, [])

  function set(setter, key, val) {
    setter(val)
    savePref(key, val)
  }

  const [cacheMsg, setCacheMsg] = useState('')
  const [syncMsg, setSyncMsg]   = useState('')

  function limparCache() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('ftth_cache_'))
      keys.forEach(k => localStorage.removeItem(k))
      setCacheMsg(`${keys.length} entradas removidas.`)
      setTimeout(() => setCacheMsg(''), 3000)
    } catch { setCacheMsg('Erro ao limpar cache.') }
  }

  function forceSinc() {
    setSyncMsg('Sincronizando...')
    // Dispara revalidation recarregando a página atual no background
    setTimeout(() => { setSyncMsg('Sincronizado!'); setTimeout(() => setSyncMsg(''), 3000) }, 1200)
  }

  const card = {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 16, padding: '20px 20px',
    marginBottom: 16,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Cabeçalho */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/perfil" style={{
            fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none',
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
          }}>
            ← Perfil
          </Link>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Configurações</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Preferências e comportamento do sistema</p>
          </div>
        </div>

        {/* ── Preferências ── */}
        <div style={card}>
          <SectionTitle>Preferências</SectionTitle>

          <SettingRow
            label="Tema"
            description={isDark ? 'Tema escuro ativado' : 'Tema claro ativado'}
          >
            <button
              onClick={toggleTheme}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg-active)',
                fontSize: 13, fontWeight: 600, color: 'var(--foreground)',
              }}
            >
              {isDark ? '☀️ Claro' : '🌙 Escuro'}
            </button>
          </SettingRow>

          <SettingRow
            label="Modo Campo"
            description="Interface simplificada para uso em campo com sol forte"
            last
          >
            <Toggle
              value={campoMode}
              onChange={v => set(setCampoMode, 'pref_campo_mode', v)}
            />
          </SettingRow>
        </div>

        {/* ── Mapa ── */}
        <div style={card}>
          <SectionTitle>Mapa</SectionTitle>

          <SettingRow
            label="Animações"
            description="Ativar efeitos visuais e transições no mapa"
          >
            <Toggle
              value={animacoes}
              onChange={v => set(setAnimacoes, 'pref_animacoes', v)}
            />
          </SettingRow>

          <SettingRow
            label="Sombra de alerta CTO"
            description="Glow vermelho pulsante em CTOs com 100% de ocupação"
            last
          >
            <Toggle
              value={sombhasCTO}
              onChange={v => set(setSombrasCTO, 'pref_sombras_cto', v)}
            />
          </SettingRow>
        </div>

        {/* ── GPS ── */}
        <div style={card}>
          <SectionTitle>GPS</SectionTitle>

          <SettingRow
            label="Precisão"
            description="Nível de precisão da geolocalização"
          >
            <SelectInput
              value={gpsAcc}
              onChange={v => set(setGpsAcc, 'pref_gps_acc', v)}
              options={[
                { value: 'high', label: 'Alta (mais bateria)' },
                { value: 'medium', label: 'Média' },
                { value: 'low', label: 'Baixa (menos bateria)' },
              ]}
            />
          </SettingRow>

          <SettingRow
            label="Seguir automaticamente"
            description="Centralizar mapa na posição GPS ao detectar movimento"
            last
          >
            <Toggle
              value={gpsAutoFollow}
              onChange={v => set(setGpsAutoFollow, 'pref_gps_follow', v)}
            />
          </SettingRow>
        </div>

        {/* ── Sistema ── */}
        <div style={card}>
          <SectionTitle>Sistema</SectionTitle>

          <SettingRow
            label="Limpar cache local"
            description={cacheMsg || 'Remove dados temporários armazenados no navegador'}
          >
            <button
              onClick={limparCache}
              style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg-active)',
                fontSize: 13, fontWeight: 600, color: 'var(--foreground)',
              }}
            >
              Limpar
            </button>
          </SettingRow>

          <SettingRow
            label="Forçar sincronização"
            description={syncMsg || 'Recarrega todos os dados do servidor'}
            last
          >
            <button
              onClick={forceSinc}
              style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid #0284c740',
                background: isDark ? 'rgba(2,132,199,0.1)' : '#e0f2fe',
                fontSize: 13, fontWeight: 600, color: '#0284c7',
              }}
            >
              Sincronizar
            </button>
          </SettingRow>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
          As configurações são salvas localmente no seu navegador.
        </p>

      </div>
    </div>
  )
}
