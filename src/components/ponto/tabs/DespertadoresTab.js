'use client'

const FO = {
  orange: '#C45A2C', orangeSoft: '#E88A5A', orangeGlow: '#F4A771', orangeDeep: '#8E3B1A',
  cream: '#F7F0E2', muted: 'rgba(237,227,210,0.55)',
  line: 'rgba(237,227,210,0.10)', lineSoft: 'rgba(237,227,210,0.06)',
  success: '#5DBE7A', warn: '#E5A04A',
  mono: "'JetBrains Mono','Fira Mono',monospace",
  serif: "'Instrument Serif',Georgia,serif",
  card: 'linear-gradient(160deg,rgba(42,31,23,0.85) 0%,rgba(26,18,13,0.9) 100%)',
}

const ALARMS_CFG = [
  {
    key: 'entrada', time: '07:55', timeNote: '5 min antes da entrada',
    name: 'Bom dia, hora de bater',
    sub: 'Seg • Ter • Qua • Qui • Sex',
    chans: [{ id: 'push', label: 'Push', on: true }, { id: 'wa', label: 'WhatsApp', on: true }, { id: 'email', label: 'E-mail', on: false }],
  },
  {
    key: 'almoco_inicio', time: '11:55', timeNote: 'Início da pausa',
    name: 'Pausa para almoço',
    sub: 'Dias úteis · com tolerância de 5 min',
    chans: [{ id: 'push', label: 'Push', on: true }, { id: 'wa', label: 'WhatsApp', on: false }, { id: 'email', label: 'E-mail', on: false }],
  },
  {
    key: 'almoco_fim', time: '12:55', timeNote: 'Retorno da pausa',
    name: 'Volta do almoço',
    sub: 'Dias úteis',
    chans: [{ id: 'push', label: 'Push', on: true }, { id: 'wa', label: 'WhatsApp', on: true }, { id: 'email', label: 'E-mail', on: false }],
  },
  {
    key: 'saida', time: '17:00', timeNote: 'Fim da jornada',
    name: 'Encerrar o dia',
    sub: 'Dias úteis',
    chans: [{ id: 'push', label: 'Push', on: false }, { id: 'wa', label: 'WhatsApp', on: false }, { id: 'email', label: 'E-mail', on: false }],
    muted: true,
  },
  {
    key: 'hora_extra', time: '17:50', timeNote: 'Hora extra detectada',
    name: 'Atenção: você está em hora extra',
    sub: 'Dispara automático após 8h12 trabalhadas',
    chans: [{ id: 'push', label: 'Push', on: true }, { id: 'wa', label: 'WhatsApp', on: false }, { id: 'email', label: 'E-mail', on: true }],
  },
]

const CHANNELS = [
  { emoji: '📱', color: FO.orangeGlow, name: 'Push do app',         sub: 'FiberOps Mobile · Android e iOS',    pill: 'ok',    pillTxt: 'ATIVO'   },
  { emoji: '💬', color: '#7fd197',     name: 'WhatsApp Business',   sub: '+55 11 9****-1213 · verificado',      pill: 'ok',    pillTxt: 'ATIVO'   },
  { emoji: '✉',  color: '#9bc0e6',     name: 'E-mail corporativo',  sub: 'a.silva@alternativa.net.br',          pill: 'short', pillTxt: 'PAUSADO' },
  { emoji: '⌚', color: '#eab87a',     name: 'Apple Watch / Wear OS', sub: 'Vibração discreta · sem som',       pill: 'ok',    pillTxt: 'ATIVO'   },
]

const PILL_CLR = { ok: '#8ddba0', late: '#f4937c', short: '#eab87a' }
const PILL_BG  = { ok: 'rgba(93,190,122,0.16)', late: 'rgba(229,101,74,0.16)', short: 'rgba(229,160,74,0.16)' }

export default function DespertadoresTab({ alarms, setAlarms }) {
  function toggleAlarm(key) {
    if (!alarms) return
    setAlarms(prev => {
      const next = { ...prev, [key]: { ...prev[key], enabled: !prev[key]?.enabled } }
      try { localStorage.setItem('ponto_alarms', JSON.stringify(next)) } catch (_) {}
      return next
    })
  }

  return (
    <div>
      <style>{`
        .desp-vgrid{display:grid;grid-template-columns:1.4fr 1fr;gap:22px}
        .desp-alarm{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;padding:16px 18px;border-radius:12px;background:${FO.card};border:1px solid ${FO.line};transition:border-color .15s;margin-bottom:10px}
        .desp-alarm:last-child{margin-bottom:0}
        .desp-alarm:hover{border-color:rgba(196,90,44,0.3)}
        .desp-toggle{position:relative;width:42px;height:24px;display:inline-block;cursor:pointer;flex-shrink:0}
        .desp-toggle input{opacity:0;width:0;height:0;position:absolute}
        .desp-toggle span{position:absolute;inset:0;background:rgba(237,227,210,0.1);border-radius:999px;transition:.2s;border:1px solid ${FO.line}}
        .desp-toggle span::before{content:'';position:absolute;top:2px;left:3px;width:18px;height:18px;border-radius:50%;background:${FO.cream};transition:.2s}
        .desp-toggle input:checked+span{background:${FO.orange};border-color:${FO.orange}}
        .desp-toggle input:checked+span::before{transform:translateX(17px)}
        .desp-chip{font-size:10px;letter-spacing:0.1em;text-transform:uppercase;font-family:${FO.mono};font-weight:600;padding:3px 8px;border-radius:4px;background:rgba(237,227,210,0.05);color:${FO.muted};border:1px solid ${FO.lineSoft}}
        .desp-chip.on{background:rgba(196,90,44,0.15);color:${FO.orangeGlow};border-color:rgba(196,90,44,0.3)}
        @media(max-width:900px){.desp-vgrid{grid-template-columns:1fr}}
        @media(max-width:600px){.desp-alarm{grid-template-columns:auto 1fr auto;gap:12px;padding:13px 14px}}
      `}</style>

      <div style={{ padding: '24px 30px 40px' }}>
        {/* vhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: FO.orangeGlow, fontFamily: FO.mono, fontWeight: 500 }}>Lembretes inteligentes</div>
            <h2 style={{ margin: '6px 0 4px', fontFamily: FO.serif, fontWeight: 400, fontSize: 32, letterSpacing: '-0.02em', color: FO.cream }}>
              Nunca mais <em style={{ color: FO.orangeGlow, fontStyle: 'italic' }}>esqueça</em> de bater
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: FO.muted, maxWidth: 580, lineHeight: 1.55 }}>
              Notificações por push, WhatsApp e e-mail antes de cada marcação. Toleramos sua humanidade.
            </p>
          </div>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 7, border: 'none', background: `linear-gradient(180deg,${FO.orangeSoft} 0%,${FO.orange} 45%,${FO.orangeDeep} 100%)`, color: FO.cream, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 14px rgba(196,90,44,0.32)', fontFamily: 'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            Novo despertador
          </button>
        </div>

        <div className="desp-vgrid">
          {/* Alarm list */}
          <div>
            {ALARMS_CFG.map(alarm => {
              const enabled = alarms ? (alarms[alarm.key]?.enabled ?? !alarm.muted) : !alarm.muted
              return (
                <div key={alarm.key} className="desp-alarm" style={{ opacity: alarm.muted && !enabled ? 0.55 : 1 }}>
                  {/* Time */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
                    <span style={{ fontFamily: FO.mono, fontSize: 26, color: FO.cream, fontWeight: 500, letterSpacing: '-0.02em' }}>{alarm.time}</span>
                    <span style={{ fontSize: 10.5, color: FO.muted, fontFamily: FO.mono, letterSpacing: '0.06em' }}>{alarm.timeNote}</span>
                  </div>
                  {/* Body */}
                  <div>
                    <div style={{ fontSize: 14, color: FO.cream, fontWeight: 500 }}>{alarm.name}</div>
                    <div style={{ fontSize: 12, color: FO.muted, marginTop: 2 }}>{alarm.sub}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {alarm.chans.map(ch => (
                        <span key={ch.id} className={`desp-chip${ch.on ? ' on' : ''}`}>{ch.label}</span>
                      ))}
                    </div>
                  </div>
                  {/* Toggle */}
                  <label className="desp-toggle">
                    <input type="checkbox" checked={enabled} onChange={() => toggleAlarm(alarm.key)} />
                    <span />
                  </label>
                </div>
              )
            })}
          </div>

          {/* Channels sidebar */}
          <div style={{ background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Canais de envio</div>
              <div style={{ fontSize: 11.5, color: FO.muted, fontFamily: FO.mono }}>Por preferência</div>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {CHANNELS.map((ch, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', paddingBottom: i < CHANNELS.length - 1 ? 14 : 0, borderBottom: i < CHANNELS.length - 1 ? `1px solid ${FO.lineSoft}` : 'none' }}>
                  <span style={{ fontSize: 22, width: 34, textAlign: 'center', color: ch.color }}>{ch.emoji}</span>
                  <div>
                    <div style={{ fontSize: 13.5, color: FO.cream, fontWeight: 500 }}>{ch.name}</div>
                    <div style={{ fontSize: 11.5, color: FO.muted, marginTop: 1 }}>{ch.sub}</div>
                  </div>
                  <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: FO.mono, background: PILL_BG[ch.pill], color: PILL_CLR[ch.pill], whiteSpace: 'nowrap' }}>
                    {ch.pillTxt}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${FO.lineSoft}`, fontSize: 11.5, color: FO.muted, lineHeight: 1.5 }}>
              <b style={{ color: FO.cream }}>Modo silencioso:</b> entre 22:00 e 06:00 e finais de semana, lembretes ficam apenas no app.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
