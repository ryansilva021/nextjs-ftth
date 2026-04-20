'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { T, ALARM_CFG, defaultAlarms } from './pontoTheme'
import { useLanguage } from '@/contexts/LanguageContext'
import { registrarEntrada, registrarPausaInicio, registrarPausaFim, registrarSaida } from '@/actions/time-record'
import { getUserAlarms, saveUserAlarms } from '@/actions/alarm-settings'
import AlarmaModal            from './AlarmaModal'
import BaterPontoTab          from './tabs/BaterPontoTab'
import IncluirPontoTab        from './tabs/IncluirPontoTab'
import AjustarPontoTab        from './tabs/AjustarPontoTab'
import DespertadoresTab       from './tabs/DespertadoresTab'
import JustificarAusenciaTab  from './tabs/JustificarAusenciaTab'
import MinhasSolicitacoesTab  from './tabs/MinhasSolicitacoesTab'
import DadosCadastraisTab     from './tabs/DadosCadastraisTab'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'bater',         labelKey: 'ponto.tab.bater',         icon: '🕐' },
  { id: 'incluir',       labelKey: 'ponto.tab.incluir',       icon: '➕' },
  { id: 'ajustar',       labelKey: 'ponto.tab.ajustar',       icon: '✏️' },
  { id: 'despertadores', labelKey: 'ponto.tab.despertadores', icon: '⏰' },
  { id: 'ausencia',      labelKey: 'ponto.tab.ausencia',      icon: '📋' },
  { id: 'solicitacoes',  labelKey: 'ponto.tab.solicitacoes',  icon: '📩' },
  { id: 'dados',         labelKey: 'ponto.tab.dados',         icon: '👤' },
]

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const bg = type === 'error' ? '#ef4444' : '#22c55e'
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: bg, color: '#fff', borderRadius: 12, padding: '12px 20px',
      fontSize: 14, fontWeight: 600, zIndex: 9999, maxWidth: 340, width: 'calc(100% - 32px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.45)', textAlign: 'center',
      animation: 'slideUp .2s ease',
    }}>
      {msg}
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  )
}

// ─── Geolocalização ───────────────────────────────────────────────────────────

function getLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      () => resolve(null),
      { timeout: 6000, maximumAge: 60_000 }
    )
  })
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function PontoClient({ initialRecord, initialRequests, userName, userProfile, projectSchedule }) {
  const { t } = useLanguage()
  const [activeTab,  setActiveTab]  = useState('bater')
  const [record,     setRecord]     = useState(initialRecord)
  const [requests,   setRequests]   = useState(initialRequests ?? [])
  const [toast,      setToast]      = useState(null)
  const [today,      setToday]      = useState('')

  useEffect(() => {
    setToday(new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    }))
  }, [])

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type, id: Date.now() })
  }, [])

  // ── Despertadores ──────────────────────────────────────────────────────────
  const [alarms,      setAlarms]      = useState(null)   // null = ainda carregando
  const [firedAlarm,  setFiredAlarm]  = useState(null)
  const [alarmPending, startAlarmTrans] = useTransition()
  const saveAlarmTimer = useRef(null)

  // Monta defaults a partir do projectSchedule — horários do projeto como base
  const buildAlarmDefaults = useCallback(() => {
    if (!projectSchedule) return defaultAlarms()
    const map = {
      entrada:       projectSchedule.entrada,
      almoco_inicio: projectSchedule.almoco_inicio,
      almoco_fim:    projectSchedule.almoco_fim,
      saida:         projectSchedule.saida,
    }
    return Object.fromEntries(
      ALARM_CFG.map(a => [a.key, { enabled: false, time: map[a.key] ?? a.defaultTime }])
    )
  }, [projectSchedule]) // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega: backend (fonte primária) → localStorage (cache offline) → defaults
  useEffect(() => {
    const scheduleHash = projectSchedule
      ? [projectSchedule.entrada, projectSchedule.almoco_inicio, projectSchedule.almoco_fim, projectSchedule.saida].join('|')
      : null

    // Aplica sincronização de horários do projeto: mantém enabled/disabled do usuário
    // mas atualiza os tempos se o admin alterou o projeto
    function syncSchedule(base) {
      if (!scheduleHash) return base
      const storedHash = localStorage.getItem('ponto_alarms_hash')
      if (storedHash === scheduleHash) return base
      const map = {
        entrada:       projectSchedule.entrada,
        almoco_inicio: projectSchedule.almoco_inicio,
        almoco_fim:    projectSchedule.almoco_fim,
        saida:         projectSchedule.saida,
      }
      const synced = Object.fromEntries(
        ALARM_CFG.map(a => [a.key, { ...base[a.key], time: map[a.key] ?? base[a.key]?.time ?? a.defaultTime }])
      )
      localStorage.setItem('ponto_alarms_hash', scheduleHash)
      return synced
    }

    async function load() {
      try {
        // 1. Tenta carregar do backend (funciona em todos os dispositivos)
        const backendAlarms = await getUserAlarms()
        if (backendAlarms) {
          const synced = syncSchedule(backendAlarms)
          try { localStorage.setItem('ponto_alarms', JSON.stringify(synced)) } catch (_) {}
          setAlarms(synced)
          // Se sync atualizou os tempos, persiste no backend também
          if (synced !== backendAlarms) saveUserAlarms(synced).catch(() => {})
          return
        }
      } catch (_) {}

      // 2. Fallback: localStorage (offline ou backend falhou)
      try {
        const stored = localStorage.getItem('ponto_alarms')
        if (stored) {
          const parsed = JSON.parse(stored)
          const synced = syncSchedule(parsed)
          if (synced !== parsed) {
            localStorage.setItem('ponto_alarms', JSON.stringify(synced))
            saveUserAlarms(synced).catch(() => {})
          }
          setAlarms(synced)
          return
        }
      } catch (_) {}

      // 3. Primeira abertura: defaults do projeto
      const defaults = buildAlarmDefaults()
      if (scheduleHash) localStorage.setItem('ponto_alarms_hash', scheduleHash)
      try { localStorage.setItem('ponto_alarms', JSON.stringify(defaults)) } catch (_) {}
      setAlarms(defaults)
    }

    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persiste no localStorage + backend (debounce 800ms para não bater na API a cada tecla)
  useEffect(() => {
    if (!alarms) return
    try { localStorage.setItem('ponto_alarms', JSON.stringify(alarms)) } catch (_) {}

    clearTimeout(saveAlarmTimer.current)
    saveAlarmTimer.current = setTimeout(() => {
      saveUserAlarms(alarms).catch(() => {})
    }, 800)

    return () => clearTimeout(saveAlarmTimer.current)
  }, [alarms])

  // Verifica despertadores a cada 30s
  useEffect(() => {
    if (!alarms) return
    function checkAlarms() {
      if (firedAlarm) return // já existe um alarme tocando
      const d = new Date()
      const today      = d.toISOString().split('T')[0]
      const storageKey = `ponto_alarm_fired_${today}`
      let fired
      try { fired = new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]')) }
      catch (_) { fired = new Set() }

      const hhmm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      for (const cfg of ALARM_CFG) {
        const alarm = alarms[cfg.key]
        if (!alarm?.enabled)        continue
        if (alarm.time !== hhmm)    continue
        if (fired.has(cfg.key))     continue

        fired.add(cfg.key)
        try { localStorage.setItem(storageKey, JSON.stringify([...fired])) } catch (_) {}
        setFiredAlarm({ ...cfg, time: hhmm })
        return
      }
    }

    checkAlarms()
    const id = setInterval(checkAlarms, 30_000)
    return () => clearInterval(id)
  }, [alarms, firedAlarm])

  // Bater ponto pelo despertador
  const handleAlarmaBater = useCallback((alarmaKey) => {
    startAlarmTrans(async () => {
      const ACTION_MAP = {
        entrada:       async () => registrarEntrada({ location: await getLocation() }),
        almoco_inicio: ()       => registrarPausaInicio(),
        almoco_fim:    ()       => registrarPausaFim(),
        saida:         async () => registrarSaida({ location: await getLocation() }),
      }
      const result = await ACTION_MAP[alarmaKey]?.()
      setFiredAlarm(null)
      if (result?.ok) {
        setRecord(result.record)
        showToast(t('ponto.toast.success'))
      } else {
        showToast(result?.error ?? 'Erro ao registrar ponto', 'error')
      }
    })
  }, [showToast, setRecord])

  const addRequest = useCallback((req) => {
    setRequests(prev => [req, ...prev])
  }, [])

  return (
    <div style={{ minHeight: '100dvh', background: T.canvas, fontFamily: T.ff, color: T.text, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: T.card, borderBottom: `1px solid ${T.border}`,
        padding: '16px 16px 0', flexShrink: 0,
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>

          {/* Topo: saudação + badge lado a lado */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
            flexWrap: 'nowrap',
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 10, color: T.dim,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3,
              }}>
                {t('ponto.header')}
              </div>
              <div style={{
                fontSize: 17, fontWeight: 800, color: T.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                Olá, {userName} 👋
              </div>
              <div style={{ fontSize: 11, color: T.dim, marginTop: 2, textTransform: 'capitalize' }}>
                {today}
              </div>
            </div>
            {record && (
              <div style={{ flexShrink: 0 }}>
                <StatusBadgeMini status={record.status} />
              </div>
            )}
          </div>

          {/* Tab bar — scroll horizontal em telas pequenas */}
          <div className="ponto-tabs" style={{
            display: 'flex', gap: 0,
            overflowX: 'auto', flexWrap: 'nowrap',
            msOverflowStyle: 'none', scrollbarWidth: 'none',
          }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 14px',
                    background: 'none', border: 'none',
                    borderBottom: `2px solid ${active ? T.accent : 'transparent'}`,
                    color: active ? T.accent : T.dim,
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    fontFamily: T.ff, cursor: 'pointer',
                    transition: 'all .15s',
                    whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{tab.icon}</span>
                  {t(tab.labelKey)}
                  {/* Badge de contagem em Solicitações */}
                  {tab.id === 'solicitacoes' && requests.filter(r => r.status === 'pendente').length > 0 && (
                    <span style={{
                      background: T.warning, color: '#000', borderRadius: 99,
                      fontSize: 9, fontWeight: 800, padding: '1px 5px', lineHeight: 1.4,
                    }}>
                      {requests.filter(r => r.status === 'pendente').length}
                    </span>
                  )}
                </button>
              )
            })}
            <style>{`.ponto-tabs::-webkit-scrollbar{display:none}`}</style>
          </div>
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'bater' && (
          <BaterPontoTab
            record={record}
            setRecord={setRecord}
            showToast={showToast}
          />
        )}
        {activeTab === 'incluir' && (
          <IncluirPontoTab
            showToast={showToast}
            onSuccess={req => { addRequest(req); setActiveTab('solicitacoes') }}
          />
        )}
        {activeTab === 'ajustar' && (
          <AjustarPontoTab
            showToast={showToast}
            onSuccess={req => { addRequest(req); setActiveTab('solicitacoes') }}
          />
        )}
        {activeTab === 'despertadores' && (
          <DespertadoresTab alarms={alarms} setAlarms={setAlarms} />
        )}
        {activeTab === 'ausencia' && (
          <JustificarAusenciaTab
            showToast={showToast}
            onSuccess={req => { addRequest(req); setActiveTab('solicitacoes') }}
          />
        )}
        {activeTab === 'solicitacoes' && (
          <MinhasSolicitacoesTab requests={requests} />
        )}
        {activeTab === 'dados' && (
          <DadosCadastraisTab userProfile={userProfile} />
        )}
      </div>

      {/* Toast global */}
      {toast && (
        <Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Despertador */}
      {firedAlarm && (
        <AlarmaModal
          alarma={firedAlarm}
          pending={alarmPending}
          onBaterPonto={handleAlarmaBater}
          onCancelar={() => setFiredAlarm(null)}
        />
      )}
    </div>
  )
}

// Badge compacto de status para o header
function StatusBadgeMini({ status }) {
  const cfg = {
    trabalhando: { label: 'Trabalhando', dot: '#22c55e' },
    em_pausa:    { label: 'Em Pausa',    dot: '#f59e0b' },
    finalizado:  { label: 'Finalizado',  dot: '#94a3b8' },
  }[status] ?? { label: status, dot: '#6b7280' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: `${cfg.dot}18`, border: `1px solid ${cfg.dot}44`,
      borderRadius: 20, padding: '4px 10px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 5px ${cfg.dot}` }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.dot }}>{cfg.label}</span>
    </div>
  )
}
