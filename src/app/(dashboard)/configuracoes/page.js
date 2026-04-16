'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getProjetoConfig, updateProjetoConfig } from '@/actions/projetos'
import { testPushNotification } from '@/actions/push'
import { usePushNotification } from '@/hooks/usePushNotification'
import { playNotifSound } from '@/lib/notifSound'

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ConfiguracoesPage() {
  const router = useRouter()

  const [campoMode,    setCampoMode]    = useState(false)
  const [notifSound,   setNotifSound]   = useState(true)

  // Push notifications
  const { status: pushStatus, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } =
    usePushNotification()
  const [pushTestMsg, setPushTestMsg] = useState('')
  const [pushTesting, setPushTesting] = useState(false)

  async function testPush() {
    setPushTesting(true)
    setPushTestMsg('')
    try {
      const data = await testPushNotification()
      if (data.error) setPushTestMsg(`Erro: ${data.error}`)
      else setPushTestMsg('Enviado! Verifique suas notificações.')
    } catch {
      setPushTestMsg('Falha na requisição.')
    } finally {
      setPushTesting(false)
      setTimeout(() => setPushTestMsg(''), 6000)
    }
  }

  // Fibras Ópticas (salvo no servidor)
  const [fiberStandard, setFiberStandard]   = useState('ABNT')
  const [fiberSaving, setFiberSaving]       = useState(false)
  const [fiberMsg, setFiberMsg]             = useState('')
  const [fiberLoadError, setFiberLoadError] = useState('')

  // Sistema
  const [cacheMsg, setCacheMsg] = useState('')
  const [syncMsg, setSyncMsg]   = useState('')
  const [syncing, setSyncing]   = useState(false)

  useEffect(() => {
    setCampoMode(loadPref('pref_campo_mode', false))
    setNotifSound(loadPref('pref_notif_sound', true))

    const localStandard = loadPref('pref_fiber_standard', null)
    if (localStandard) setFiberStandard(localStandard)

    getProjetoConfig()
      .then(cfg => {
        const std = cfg.fiberColorStandard ?? localStandard ?? 'ABNT'
        setFiberStandard(std)
        savePref('pref_fiber_standard', std)
      })
      .catch(() => {
        if (!localStandard) setFiberLoadError('Não foi possível carregar as configurações de fibra.')
      })
  }, [])

  async function saveFiberStandard(standard) {
    setFiberStandard(standard)
    savePref('pref_fiber_standard', standard)
    setFiberSaving(true)
    setFiberMsg('')
    try {
      await updateProjetoConfig({ fiberColorStandard: standard })
      setFiberMsg('Salvo!')
    } catch {
      setFiberMsg('Salvo localmente.')
    } finally {
      setFiberSaving(false)
      setTimeout(() => setFiberMsg(''), 3000)
    }
  }

  function limparCache() {
    try {
      const keys = Object.keys(localStorage).filter(k =>
        k.startsWith('pref_') || k.startsWith('ftth_cache_')
      )
      keys.forEach(k => localStorage.removeItem(k))
      setCacheMsg(`${keys.length} preferências removidas. Recarregue para aplicar.`)
      setTimeout(() => setCacheMsg(''), 5000)
    } catch {
      setCacheMsg('Erro ao limpar.')
    }
  }

  async function forceSinc() {
    setSyncing(true)
    setSyncMsg('')
    try {
      router.refresh()
      setSyncMsg('Dados recarregados!')
    } catch {
      setSyncMsg('Erro ao sincronizar.')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 3000)
    }
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
            label="Modo Campo"
            description="Interface simplificada para uso em campo com sol forte"
            last
          >
            <Toggle
              value={campoMode}
              onChange={v => {
                setCampoMode(v)
                savePref('pref_campo_mode', v)
              }}
            />
          </SettingRow>
        </div>

        {/* ── Notificações ── */}
        <div style={card}>
          <SectionTitle>Notificações</SectionTitle>

          {/* Som */}
          <SettingRow
            label="Som de notificação"
            description="Toca um som quando uma nova OS for atribuída a você"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {notifSound && (
                <button
                  onClick={() => playNotifSound()}
                  title="Testar som"
                  style={{
                    background: 'none', border: '1px solid var(--border-color)',
                    borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                    fontSize: 14, color: 'var(--text-muted)',
                  }}
                >
                  ▶
                </button>
              )}
              <Toggle
                value={notifSound}
                onChange={v => { setNotifSound(v); savePref('pref_notif_sound', v) }}
              />
            </div>
          </SettingRow>

          {/* Push notifications */}
          <SettingRow
            label="Notificações fora do app"
            description={
              pushStatus === 'unsupported'
                ? 'Seu navegador não suporta notificações push'
                : pushStatus === 'denied'
                  ? 'Permissão bloqueada — reative nas configurações do navegador'
                  : pushStatus === 'subscribed'
                    ? 'Você receberá notificações mesmo com o app fechado'
                    : 'Receba notificações mesmo com o app fechado ou minimizado'
            }
            last
          >
            {pushStatus === 'unsupported' || pushStatus === 'denied' ? (
              <span style={{
                fontSize: 12, color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '6px 12px',
              }}>
                {pushStatus === 'denied' ? '🔕 Bloqueado' : '—'}
              </span>
            ) : pushStatus === 'loading' ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>...</span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {pushTestMsg && (
                  <span style={{ fontSize: 12, color: pushTestMsg.startsWith('Erro') ? '#f85149' : '#3fb950' }}>
                    {pushTestMsg}
                  </span>
                )}
                {pushStatus === 'subscribed' && (
                  <button
                    onClick={testPush}
                    disabled={pushTesting}
                    title="Enviar push de teste agora"
                    style={{
                      padding: '7px 12px', borderRadius: 8, cursor: pushTesting ? 'not-allowed' : 'pointer',
                      fontSize: 13, border: '1px solid var(--border-color)',
                      background: 'var(--card-bg-active)', color: 'var(--text-muted)',
                      opacity: pushTesting ? 0.6 : 1,
                    }}
                  >
                    {pushTesting ? '...' : '▶ Testar'}
                  </button>
                )}
                <button
                  onClick={pushStatus === 'subscribed' ? pushUnsubscribe : pushSubscribe}
                  style={{
                    padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                    border: `1px solid ${pushStatus === 'subscribed' ? 'var(--accent)' : 'var(--border-color)'}`,
                    background: pushStatus === 'subscribed' ? 'rgba(212,98,43,0.10)' : 'var(--card-bg-active)',
                    color: pushStatus === 'subscribed' ? 'var(--accent)' : 'var(--foreground)',
                    transition: 'all 0.15s',
                  }}
                >
                  {pushStatus === 'subscribed' ? '🔔 Ativo — Desativar' : '🔔 Ativar'}
                </button>
              </div>
            )}
          </SettingRow>
        </div>

        {/* ── Fibras Ópticas ── */}
        <div style={card}>
          <SectionTitle>Fibras Ópticas</SectionTitle>

          {fiberLoadError && (
            <p style={{ fontSize: 12, color: '#f85149', marginBottom: 12 }}>{fiberLoadError}</p>
          )}

          <SettingRow
            label="Padrão de cores"
            description="Sequência de cores usada em bandejas, fusões e diagramas"
            last
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {fiberMsg && (
                <span style={{ fontSize: 12, color: fiberMsg.startsWith('Erro') ? '#f85149' : '#3fb950' }}>
                  {fiberMsg}
                </span>
              )}
              {fiberSaving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Salvando…</span>}
            </div>
          </SettingRow>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
            {[
              {
                value: 'ABNT',
                label: 'ABNT NBR 14721',
                desc: 'Padrão brasileiro',
                colors: ['#16a34a','#ca8a04','#94a3b8','#2563eb','#dc2626','#7c3aed','#92400e','#db2777','#1e293b','#6b7280','#ea580c','#0891b2'],
                names: ['Verde','Amarelo','Branco','Azul','Vermelho','Violeta','Marrom','Rosa','Preto','Cinza','Laranja','Aqua'],
              },
              {
                value: 'EIA_598_A',
                label: 'EIA-598-A',
                desc: 'Padrão internacional',
                colors: ['#2563eb','#ea580c','#16a34a','#92400e','#6b7280','#94a3b8','#dc2626','#1e293b','#ca8a04','#7c3aed','#db2777','#0891b2'],
                names: ['Azul','Laranja','Verde','Marrom','Cinza','Branco','Vermelho','Preto','Amarelo','Violeta','Rosa','Aqua'],
              },
            ].map(opt => {
              const active = fiberStandard === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => saveFiberStandard(opt.value)}
                  disabled={fiberSaving}
                  style={{
                    textAlign: 'left', cursor: fiberSaving ? 'not-allowed' : 'pointer',
                    background: active ? '#ffedd5' : 'var(--card-bg)',
                    border: `2px solid ${active ? '#0284c7' : 'var(--border-color)'}`,
                    borderRadius: 12, padding: '12px 14px',
                    transition: 'all 0.15s',
                    opacity: fiberSaving ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: active ? '#ea580c' : 'var(--foreground)' }}>
                      {opt.label}
                    </span>
                    {active && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#ea580c',
                        background: '#ffedd5',
                        borderRadius: 4, padding: '1px 6px',
                      }}>
                        ATIVO
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>{opt.desc}</p>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {opt.colors.map((hex, i) => (
                      <span
                        key={i}
                        title={`${i + 1}. ${opt.names[i]}`}
                        style={{
                          width: 16, height: 16, borderRadius: 4,
                          background: hex,
                          boxShadow: active ? `0 0 4px ${hex}88` : 'none',
                          border: `1px solid ${hex}aa`,
                          flexShrink: 0,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 7, fontWeight: 800, color: '#fff',
                        }}
                      >
                        {i + 1}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Sistema ── */}
        <div style={card}>
          <SectionTitle>Sistema</SectionTitle>

          <SettingRow
            label="Limpar preferências"
            description={cacheMsg || 'Remove todas as preferências salvas localmente no navegador'}
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
            description={syncMsg || 'Recarrega todos os dados do servidor imediatamente'}
            last
          >
            <button
              onClick={forceSinc}
              disabled={syncing}
              style={{
                padding: '7px 14px', borderRadius: 8, cursor: syncing ? 'not-allowed' : 'pointer',
                border: '1px solid #0284c740',
                background: '#ffedd5',
                fontSize: 13, fontWeight: 600, color: '#ea580c',
                opacity: syncing ? 0.6 : 1,
              }}
            >
              {syncing ? 'Sincronizando…' : 'Sincronizar'}
            </button>
          </SettingRow>
        </div>

      </div>
    </div>
  )
}
