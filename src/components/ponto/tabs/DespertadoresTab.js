'use client'

import { T, ALARM_CFG } from '../pontoTheme'

export default function DespertadoresTab({ alarms, setAlarms }) {
  if (!alarms) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: T.dim, fontSize: 14 }}>
        Carregando…
      </div>
    )
  }

  function toggleAlarm(key) {
    setAlarms(prev => {
      const next = { ...prev, [key]: { ...prev[key], enabled: !prev[key]?.enabled } }
      try { localStorage.setItem('ponto_alarms', JSON.stringify(next)) } catch (_) {}
      return next
    })
  }

  function setTime(key, time) {
    setAlarms(prev => {
      const next = { ...prev, [key]: { ...prev[key], time } }
      try { localStorage.setItem('ponto_alarms', JSON.stringify(next)) } catch (_) {}
      return next
    })
  }

  const anyEnabled = ALARM_CFG.some(cfg => alarms[cfg.key]?.enabled)

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header info */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 14, padding: '14px 16px', marginBottom: 20,
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>⏰</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>
            Despertadores de Ponto
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
            Ativa um alarme sonoro e vibração no horário escolhido. Ao tocar, você pode bater o ponto diretamente pela tela do alarme.
          </p>
        </div>
      </div>

      {/* Alarm rows */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        {ALARM_CFG.map((cfg, i) => {
          const alarm   = alarms[cfg.key] ?? { enabled: false, time: cfg.defaultTime }
          const isLast  = i === ALARM_CFG.length - 1

          return (
            <div key={cfg.key} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '16px 18px',
              borderBottom: isLast ? 'none' : `1px solid ${T.border}`,
            }}>
              {/* Toggle */}
              <button
                onClick={() => toggleAlarm(cfg.key)}
                aria-label={`${alarm.enabled ? 'Desativar' : 'Ativar'} despertador ${cfg.label}`}
                style={{
                  flexShrink: 0, width: 44, height: 24, borderRadius: 99, border: 'none',
                  background: alarm.enabled ? T.accent : '#374151',
                  cursor: 'pointer', position: 'relative', transition: 'background .2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3,
                  left: alarm.enabled ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                  display: 'block',
                }} />
              </button>

              <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.icon}</span>

              <span style={{
                flex: 1, fontSize: 14, fontWeight: 600,
                color: alarm.enabled ? T.text : T.dim,
                transition: 'color .2s',
              }}>
                {cfg.label}
              </span>

              <input
                type="time"
                value={alarm.time}
                onChange={e => setTime(cfg.key, e.target.value)}
                style={{
                  background: T.card2, border: `1px solid ${T.border}`,
                  borderRadius: 8, color: alarm.enabled ? T.text : T.dim,
                  fontSize: 15, fontWeight: 700, padding: '7px 10px',
                  fontFamily: T.ff, outline: 'none', cursor: 'pointer',
                  opacity: alarm.enabled ? 1 : 0.4,
                  transition: 'opacity .2s, color .2s',
                  minWidth: 100,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Status hint */}
      <p style={{
        fontSize: 11, color: T.dim, textAlign: 'center', margin: 0,
        lineHeight: 1.6,
      }}>
        {anyEnabled
          ? `${ALARM_CFG.filter(c => alarms[c.key]?.enabled).length} despertador(es) ativo(s) · verificado a cada 30 s`
          : 'Nenhum despertador ativo — ative pelo menos um acima.'}
      </p>
    </div>
  )
}
