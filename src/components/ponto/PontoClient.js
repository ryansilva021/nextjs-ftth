'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { T, ALARM_CFG, defaultAlarms } from './pontoTheme'
import { registrarEntrada, registrarPausaInicio, registrarPausaFim, registrarSaida } from '@/actions/time-record'
import { getUserAlarms, saveUserAlarms } from '@/actions/alarm-settings'
import AlarmaModal            from './AlarmaModal'
import BaterPontoTab          from './tabs/BaterPontoTab'
import IncluirPontoTab        from './tabs/IncluirPontoTab'
import AjustarPontoTab        from './tabs/AjustarPontoTab'
import DespertadoresTab       from './tabs/DespertadoresTab'
import AusenciasTab           from './tabs/AusenciasTab'
import RelatoriosTab          from './tabs/RelatoriosTab'
import DadosCadastraisTab     from './tabs/DadosCadastraisTab'
import HistoricoTab           from './tabs/HistoricoTab'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'bater',         label: 'Bater Ponto',    icon: '🕐' },
  { id: 'incluir',       label: 'Incluir Ponto',  icon: '➕' },
  { id: 'ajustar',       label: 'Ajustar Ponto',  icon: '✏️' },
  { id: 'despertadores', label: 'Despertadores',  icon: '⏰' },
  { id: 'ausencias',     label: 'Ausências',      icon: '📋' },
  { id: 'relatorios',    label: 'Relatórios',     icon: '📊' },
  { id: 'historico',     label: 'Histórico',      icon: '📅' },
  { id: 'dados',         label: 'Dados',          icon: '👤' },
]

// ─── Mobile bottom nav (6 primary tabs) ──────────────────────────────────────

const BOTTOM_NAV = [
  {
    id: 'bater', label: 'Ponto',
    svg: <svg viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.6"/><path d="M11 6.5v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  },
  {
    id: 'incluir', label: 'Incluir',
    svg: <svg viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.6"/><path d="M11 7v8M7 11h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  },
  {
    id: 'ajustar', label: 'Ajustar',
    svg: <svg viewBox="0 0 22 22" fill="none"><path d="M4 17.5L16.5 5l1.5 1.5L5.5 19z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M14 7l3 3" stroke="currentColor" strokeWidth="1.5"/></svg>,
  },
  {
    id: 'despertadores', label: 'Alarme',
    svg: <svg viewBox="0 0 22 22" fill="none"><path d="M11 3a6 6 0 0 0-6 6v3l-1.5 2h15L17 12V9a6 6 0 0 0-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    id: 'ausencias', label: 'Ausência',
    svg: <svg viewBox="0 0 22 22" fill="none"><rect x="3" y="4.5" width="16" height="15" rx="1.6" stroke="currentColor" strokeWidth="1.5"/><path d="M3 8.5h16M7 2v4M15 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    id: 'relatorios', label: 'Relatórios',
    svg: <svg viewBox="0 0 22 22" fill="none"><path d="M3 17l5-6 4 4 5-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
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
  const [activeTab,  setActiveTab]  = useState('bater')
  const [record,     setRecord]     = useState(initialRecord)
  const [requests,   setRequests]   = useState(initialRequests ?? [])
  const [toast,      setToast]      = useState(null)
  const [today,      setToday]      = useState('')

  // Tab bar scroll arrows
  const tabsRef = useRef(null)
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function updateArrows() {
    const el = tabsRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows)
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateArrows); ro.disconnect() }
  }, [])

  function scrollTabs(dir) {
    tabsRef.current?.scrollBy({ left: dir * 120, behavior: 'smooth' })
  }

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
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(120% 80% at 50% 0%, #251a13 0%, #1A120D 60%, #150e09 100%)',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#F7F0E2',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes fo-wave{0%,60%,100%{transform:rotate(0)}10%{transform:rotate(14deg)}20%{transform:rotate(-8deg)}30%{transform:rotate(12deg)}40%{transform:rotate(-4deg)}50%{transform:rotate(8deg)}}
        @keyframes fo-status-pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .ponto-tabs-bar::-webkit-scrollbar{display:none}
        .fo-tab{padding:14px 18px;background:transparent;border:none;color:rgba(237,227,210,0.55);font-size:13.5px;font-weight:500;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap;cursor:pointer;display:inline-flex;align-items:center;gap:8px;margin-bottom:-1px;font-family:inherit}
        .fo-tab:hover{color:#F7F0E2}
        .fo-tab.active{color:#F4A771;border-bottom-color:#C45A2C}
        .fo-tab .fo-badge{padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600;background:rgba(229,160,74,0.2);color:#E5A04A}
        /* Desktop: show top tab bar, hide bottom nav */
        .fo-tabbar-desktop{display:flex}
        .fo-bottomnav{display:none}
        .fo-hero{padding:30px 30px 8px}
        /* Mobile: hide top tab bar, show bottom nav */
        @media(max-width:768px){
          .fo-tabbar-desktop{display:none !important}
          .fo-bottomnav{display:flex !important}
          .fo-hero{padding:20px 16px 6px}
          .fo-hero h1{font-size:clamp(24px,7vw,32px) !important}
          .fo-hero .fo-date{font-size:12.5px !important}
          .fo-content-area{padding-bottom:72px}
        }
        /* Bottom nav styles */
        .fo-bottomnav{position:fixed;left:0;right:0;bottom:0;z-index:60;background:rgba(20,14,9,0.95);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid rgba(237,227,210,0.10);padding:6px 0 calc(6px + env(safe-area-inset-bottom));gap:0;justify-content:space-around;box-shadow:0 -8px 24px rgba(0,0,0,0.4)}
        .fo-bn{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;background:transparent;border:none;color:rgba(237,227,210,0.45);font-size:9.5px;font-weight:500;border-radius:0;font-family:inherit;cursor:pointer;letter-spacing:0.02em;position:relative;transition:color .15s}
        .fo-bn svg{width:20px;height:20px;flex-shrink:0;opacity:0.8}
        .fo-bn.active{color:#F4A771}
        .fo-bn.active svg{opacity:1}
        .fo-bn.active::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:28px;height:2px;border-radius:0 0 2px 2px;background:#C45A2C}
        .fo-bn .fo-nbadge{position:absolute;top:2px;right:calc(50% - 18px);min-width:14px;height:14px;padding:0 4px;border-radius:7px;background:#E5A04A;color:#1A120D;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace}
      `}</style>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="fo-hero">
        <div style={{ fontSize: 10.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#F4A771', fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
          Controle de ponto
        </div>
        <h1 style={{
          margin: '6px 0 4px',
          fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 40, letterSpacing: '-0.02em',
          color: '#F7F0E2', lineHeight: 1.1,
        }}>
          Olá, {userName?.split(' ')[0]?.toLowerCase() || userName}{' '}
          <span style={{ display: 'inline-block', animation: 'fo-wave 1.6s ease-in-out infinite', transformOrigin: '70% 70%' }}>👋</span>
        </h1>
        <div className="fo-date" style={{ fontSize: 13.5, color: 'rgba(237,227,210,0.55)', textTransform: 'capitalize' }}>
          {today}
        </div>
        {record && (
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 999, background: 'rgba(93,190,122,0.12)', color: '#7fd197', fontSize: 11.5, fontWeight: 500, border: '1px solid rgba(93,190,122,0.25)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: '#7fd197', boxShadow: '0 0 8px #7fd197', animation: 'fo-status-pulse 1.6s ease-out infinite' }} />
            Ponto sincronizado · CLT 6.382/76
          </div>
        )}
      </section>

      {/* ── Sticky top tab bar (desktop only) ───────────────────────────────── */}
      <div className="fo-tabbar-desktop" style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(20,14,9,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(237,227,210,0.10)',
        marginTop: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 30px' }}>
          <button onClick={() => scrollTabs(-1)} aria-label="Rolar para esquerda" style={{ flexShrink: 0, width: 28, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: canScrollLeft ? 'rgba(237,227,210,0.6)' : 'transparent', padding: 0, pointerEvents: canScrollLeft ? 'auto' : 'none', fontSize: 20 }}>‹</button>

          <div ref={tabsRef} className="ponto-tabs-bar" style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto', flexWrap: 'nowrap', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id
              const label = tab.label
              const pendCount = tab.id === 'ajustar' ? requests.filter(r => r.status === 'pendente').length : 0
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`fo-tab${active ? ' active' : ''}`}>
                  <span style={{ fontSize: 14, opacity: 0.85 }}>{tab.icon}</span>
                  {label}
                  {pendCount > 0 && <span className="fo-badge">{pendCount}</span>}
                </button>
              )
            })}
          </div>

          <button onClick={() => scrollTabs(1)} aria-label="Rolar para direita" style={{ flexShrink: 0, width: 28, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: canScrollRight ? 'rgba(237,227,210,0.6)' : 'transparent', padding: 0, pointerEvents: canScrollRight ? 'auto' : 'none', fontSize: 20 }}>›</button>
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────────── */}
      <div className="fo-content-area" style={{ flex: 1 }}>
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
            onSuccess={req => { addRequest(req); setActiveTab('relatorios') }}
          />
        )}
        {activeTab === 'ajustar' && (
          <AjustarPontoTab
            showToast={showToast}
            onSuccess={req => { addRequest(req); setActiveTab('relatorios') }}
          />
        )}
        {activeTab === 'despertadores' && (
          <DespertadoresTab alarms={alarms} setAlarms={setAlarms} />
        )}
        {activeTab === 'ausencias' && (
          <AusenciasTab showToast={showToast} />
        )}
        {activeTab === 'relatorios' && (
          <RelatoriosTab showToast={showToast} />
        )}
        {activeTab === 'historico' && (
          <HistoricoTab />
        )}
        {activeTab === 'dados' && (
          <DadosCadastraisTab userProfile={userProfile} />
        )}
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────────── */}
      <nav className="fo-bottomnav" aria-label="Navegação de ponto">
        {BOTTOM_NAV.map(item => {
          const active = activeTab === item.id
          const pendCount = (item.id === 'ajustar') ? requests.filter(r => r.status === 'pendente').length : 0
          return (
            <button key={item.id} className={`fo-bn${active ? ' active' : ''}`} onClick={() => setActiveTab(item.id)}>
              {item.svg}
              <span>{item.label}</span>
              {pendCount > 0 && <span className="fo-nbadge">{pendCount}</span>}
            </button>
          )
        })}
      </nav>

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
