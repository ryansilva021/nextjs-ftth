'use client'

import { useState } from 'react'

const FO = {
  orange: '#C45A2C', orangeSoft: '#E88A5A', orangeGlow: '#F4A771', orangeDeep: '#8E3B1A',
  cream: '#F7F0E2', muted: 'rgba(237,227,210,0.55)',
  line: 'rgba(237,227,210,0.10)', lineSoft: 'rgba(237,227,210,0.06)',
  success: '#5DBE7A', danger: '#E5654A', warn: '#E5A04A', info: '#7CA8D9',
  mono: "'JetBrains Mono','Fira Mono',monospace",
  serif: "'Instrument Serif',Georgia,serif",
  card: 'linear-gradient(160deg,rgba(42,31,23,0.85) 0%,rgba(26,18,13,0.9) 100%)',
}

const PILL_CLR = { ok: '#8ddba0', late: '#f4937c', short: '#eab87a' }
const PILL_BG  = { ok: 'rgba(93,190,122,0.16)', late: 'rgba(229,101,74,0.16)', short: 'rgba(229,160,74,0.16)' }

const STATS = [
  { k: 'Saldo de férias',   v: '22', unit: 'dias',   sub: 'Período aquisitivo até 14/jul/2026' },
  { k: 'Banco de horas',    v: '+02h 14min', unit: '', sub: 'Vencimento em 30 dias', color: FO.orangeGlow },
  { k: 'Atestados no ano',  v: '3', unit: '',         sub: '2 abonados · 1 em análise' },
  { k: 'Próxima ausência',  v: 'Folga · 18/mai', unit: '', sub: 'Compensação de feriado', small: true },
]

const ABSENCES = [
  { type: 'vac', typeTxt: 'Férias',   name: '15 dias · 04/ago a 18/ago/2026', sub: 'Solicitado em 18/abr · gestor: Carla M.', pill: 'ok',    pillTxt: 'APROVADA', qty: '15 dias' },
  { type: 'med', typeTxt: 'Atestado', name: 'Consulta médica · 22/abr',         sub: 'CID-10 abonado · 4h · Dr. Almeida',          pill: 'ok',    pillTxt: 'ABONADO',  qty: '4h'      },
  { type: 'fol', typeTxt: 'Folga',    name: 'Compensação de feriado · 18/mai',  sub: 'Banco de horas · 8h',                         pill: 'ok',    pillTxt: 'APROVADA', qty: '1 dia'   },
  { type: 'med', typeTxt: 'Atestado', name: 'Acompanhamento de filho · 06/mai', sub: 'Aguardando análise do RH',                    pill: 'short', pillTxt: 'PENDENTE', qty: '8h'      },
  { type: 'vac', typeTxt: 'Férias',   name: '10 dias · 12/dez a 22/dez/2026',  sub: 'Conflita com escala de plantão (NOC)',         pill: 'late',  pillTxt: 'RECUSADA', qty: '10 dias' },
]

const TYPE_STYLE = {
  vac: { bg: 'rgba(124,168,217,0.15)', color: '#9bc0e6' },
  med: { bg: 'rgba(229,101,74,0.15)',  color: '#f4937c' },
  fol: { bg: 'rgba(93,190,122,0.15)', color: '#8ddba0'  },
}

// Calendar data for May 2026
// May 1 = Friday (weekday index 5 in Sun=0 system)
const CAL_EVENTS = { 1: 'hol', 4: 'vac', 6: 'med', 18: 'fol', 25: 'fol' }
const CAL_COLORS = {
  vac: { bg: 'rgba(124,168,217,0.22)', color: '#cbe1f4' },
  med: { bg: 'rgba(229,101,74,0.22)',  color: '#f7b3a0' },
  fol: { bg: 'rgba(93,190,122,0.22)', color: '#b3e7c2'  },
  hol: { bg: 'rgba(229,160,74,0.22)', color: '#f4d8a8'  },
}

const FILTERS = ['Todas', 'Pendentes', 'Aprovadas', 'Recusadas']

export default function AusenciasTab({ showToast }) {
  const [filter, setFilter] = useState('Todas')

  const filtered = ABSENCES.filter(a => {
    if (filter === 'Todas') return true
    if (filter === 'Pendentes') return a.pillTxt === 'PENDENTE'
    if (filter === 'Aprovadas') return a.pillTxt === 'APROVADA' || a.pillTxt === 'ABONADO'
    if (filter === 'Recusadas') return a.pillTxt === 'RECUSADA'
    return true
  })

  // Build calendar cells
  const firstDow = 5 // May 2026 starts on Friday (0=Sun)
  const today = 2    // today is May 2
  const calCells = []
  for (let i = 0; i < firstDow; i++) calCells.push(null)
  for (let d = 1; d <= 31; d++) calCells.push(d)

  return (
    <div>
      <style>{`
        .aus-vgrid{display:grid;grid-template-columns:1.4fr 1fr;gap:22px}
        .aus-statgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:0 0 22px}
        .aus-chiptab{font-size:11px;padding:5px 10px;border-radius:5px;border:1px solid ${FO.line};background:transparent;color:${FO.muted};cursor:pointer;font-family:inherit;transition:all .15s}
        .aus-chiptab.active{background:${FO.orange};color:${FO.cream};border-color:${FO.orange}}
        .aus-chiptab:hover:not(.active){border-color:rgba(237,227,210,0.25);color:${FO.cream}}
        .aus-caldow{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:10.5px;color:${FO.muted};text-align:center;font-family:${FO.mono};letter-spacing:0.1em;padding-bottom:6px;font-weight:500}
        .aus-calgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
        .aus-calday{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:12px;color:rgba(237,227,210,0.7);position:relative;background:rgba(237,227,210,0.03)}
        .aus-calday.empty{background:transparent}
        .aus-calday.today{outline:2px solid ${FO.orange};color:${FO.cream};font-weight:600}
        @media(max-width:900px){.aus-vgrid{grid-template-columns:1fr}.aus-statgrid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:500px){.aus-statgrid{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <div style={{ padding: '24px 30px 40px' }}>
        {/* vhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: FO.orangeGlow, fontFamily: FO.mono, fontWeight: 500 }}>Férias, atestados e folgas</div>
            <h2 style={{ margin: '6px 0 4px', fontFamily: FO.serif, fontWeight: 400, fontSize: 32, letterSpacing: '-0.02em', color: FO.cream }}>
              Gerencie suas <em style={{ color: FO.orangeGlow, fontStyle: 'italic' }}>ausências</em>
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: FO.muted, maxWidth: 580, lineHeight: 1.55 }}>
              Solicite, acompanhe e baixe comprovantes. Integrado com seu banco de horas e calendário do gestor.
            </p>
          </div>
          <button onClick={() => showToast?.('Funcionalidade em breve!')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 7, border: 'none', background: `linear-gradient(180deg,${FO.orangeSoft} 0%,${FO.orange} 45%,${FO.orangeDeep} 100%)`, color: FO.cream, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 14px rgba(196,90,44,0.32)', fontFamily: 'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            Nova solicitação
          </button>
        </div>

        {/* Stat cards */}
        <div className="aus-statgrid">
          {STATS.map((s, i) => (
            <div key={i} style={{ padding: '16px 18px', borderRadius: 12, background: FO.card, border: `1px solid ${FO.line}` }}>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: FO.muted, fontFamily: FO.mono, fontWeight: 500 }}>{s.k}</div>
              <div style={{ margin: '8px 0 4px', fontFamily: s.small ? 'inherit' : FO.serif, fontSize: s.small ? 18 : 30, letterSpacing: '-0.02em', color: s.color || FO.cream, lineHeight: 1 }}>
                {s.v}{s.unit && <em style={{ fontSize: 14, fontStyle: 'italic', color: FO.orangeGlow, marginLeft: 4 }}>{s.unit}</em>}
              </div>
              <div style={{ fontSize: 11.5, color: FO.muted }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="aus-vgrid">
          {/* Solicitações */}
          <div style={{ background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Solicitações</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {FILTERS.map(f => (
                  <button key={f} className={`aus-chiptab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: '6px 14px 14px', display: 'flex', flexDirection: 'column' }}>
              {filtered.map((a, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center', padding: '12px 8px', borderBottom: i < filtered.length - 1 ? `1px solid ${FO.lineSoft}` : 'none' }}>
                  <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FO.mono, minWidth: 80, textAlign: 'center', background: TYPE_STYLE[a.type]?.bg, color: TYPE_STYLE[a.type]?.color }}>
                    {a.typeTxt}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, color: FO.cream, fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 11.5, color: FO.muted, marginTop: 2 }}>{a.sub}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                    <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: FO.mono, background: PILL_BG[a.pill], color: PILL_CLR[a.pill] }}>{a.pillTxt}</span>
                    <span style={{ fontSize: 11, color: FO.muted, fontFamily: FO.mono }}>{a.qty}</span>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: FO.muted, fontSize: 13 }}>
                  Nenhuma solicitação nesta categoria.
                </div>
              )}
            </div>
          </div>

          {/* Calendar */}
          <div style={{ background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Calendário · Maio 2026</div>
              <div style={{ fontSize: 11.5, color: FO.muted, fontFamily: FO.mono }}>Equipe NOC</div>
            </div>
            <div style={{ padding: '14px 18px 18px' }}>
              <div className="aus-caldow">
                {['D','S','T','Q','Q','S','S'].map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="aus-calgrid">
                {calCells.map((d, i) => {
                  if (!d) return <div key={i} className="aus-calday empty" />
                  const evt = CAL_EVENTS[d]
                  const clr = evt ? CAL_COLORS[evt] : null
                  const isToday = d === today
                  return (
                    <div key={i} className={`aus-calday${isToday ? ' today' : ''}`} style={{ background: clr ? clr.bg : 'rgba(237,227,210,0.03)', color: clr ? clr.color : undefined }}>
                      {d}
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: FO.muted, fontFamily: FO.mono, letterSpacing: '0.06em' }}>
                {[['vac','Férias'],['med','Atestado'],['fol','Folga'],['hol','Feriado']].map(([t, l]) => (
                  <span key={t}>
                    <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6, verticalAlign: -1, background: CAL_COLORS[t].bg.replace('0.22','0.5') }} />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
