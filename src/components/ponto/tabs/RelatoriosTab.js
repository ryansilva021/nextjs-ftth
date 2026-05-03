'use client'

import { useEffect, useRef, useState } from 'react'

const FO = {
  orange: '#C45A2C', orangeSoft: '#E88A5A', orangeGlow: '#F4A771', orangeDeep: '#8E3B1A',
  cream: '#F7F0E2', muted: 'rgba(237,227,210,0.55)',
  line: 'rgba(237,227,210,0.10)', lineSoft: 'rgba(237,227,210,0.06)',
  success: '#5DBE7A', danger: '#E5654A', warn: '#E5A04A',
  mono: "'JetBrains Mono','Fira Mono',monospace",
  serif: "'Instrument Serif',Georgia,serif",
  card: 'linear-gradient(160deg,rgba(42,31,23,0.85) 0%,rgba(26,18,13,0.9) 100%)',
}

const PILL_CLR = { ok: '#8ddba0', late: '#f4937c', short: '#eab87a' }
const PILL_BG  = { ok: 'rgba(93,190,122,0.16)', late: 'rgba(229,101,74,0.16)', short: 'rgba(229,160,74,0.16)' }

const STATS = [
  { k: 'Horas trabalhadas', v: '152h 47min', sub: 'de 168h previstas · 90%',        bar: 90,  barClr: null },
  { k: 'Horas extras',      v: '+04h 12min', sub: '3 dias com extra · max 1h32',     bar: 22,  barClr: FO.orange,   vClr: FO.orangeGlow },
  { k: 'Atrasos',           v: '38 min',     sub: '2 ocorrências · dentro da tolerância', bar: 12, barClr: '#e5654a', vClr: '#f4937c' },
  { k: 'Aderência à escala',v: '98,2%',      sub: 'Top 5% da equipe',               bar: 98,  barClr: FO.success,  vClr: '#8ddba0' },
]

const EXPORTS = [
  { icon: '📄', name: 'Espelho de ponto · maio/2026', sub: 'PDF · 4 páginas · assinado digitalmente',    pill: 'ok',   pillTxt: 'PRONTO'   },
  { icon: '📊', name: 'Banco de horas · YTD',          sub: 'XLSX · com fórmulas e gráficos',             pill: 'ok',   pillTxt: 'PRONTO'   },
  { icon: '⚖',  name: 'AFD · Portaria MTP 671/2021',  sub: 'Arquivo Fonte de Dados · até 02/05',         pill: 'ok',   pillTxt: 'PRONTO'   },
  { icon: '⚖',  name: 'AEJ · jornada acumulada',       sub: 'Arquivo Eletrônico de Jornada',              pill: 'short',pillTxt: 'GERANDO'  },
  { icon: '🔒', name: 'Trilha de auditoria LGPD',      sub: 'Quem acessou seus dados de ponto',           pill: 'ok',   pillTxt: 'PRONTO'   },
]

const TEAM = [
  { name: 'Ana Silva', you: true, cargo: 'Analista NOC',   worked: '152h 47min', extra: '+04:12', atrasos: '38min',  faltas: '0', ader: '98,2%', aderClr: '#8ddba0' },
  { name: 'Bruno Costa',          cargo: 'Eng. de Campo',  worked: '147h 12min', extra: '+08:40', atrasos: '1h 12min', faltas: '1', ader: '91,4%', aderClr: '#eab87a' },
  { name: 'Carla Mendes',         cargo: 'Coord. NOC',     worked: '160h 03min', extra: '+12:18', atrasos: '12min',  faltas: '0', ader: '99,1%', aderClr: '#8ddba0' },
  { name: 'Diego Rocha',          cargo: 'Técnico FTTH',   worked: '140h 25min', extra: '+02:00', atrasos: '2h 41min', faltas: '0', ader: '88,6%', aderClr: '#eab87a', atrasosClr: '#f4937c' },
  { name: 'Elisa Tavares',        cargo: 'Analista Sênior',worked: '155h 50min', extra: '+06:55', atrasos: '25min',  faltas: '0', ader: '97,3%', aderClr: '#8ddba0' },
]

// Chart data — deterministic seed so it matches design
const CHART_DATA = [88,96,72,110,84,60,102,78,92,116,80,95,68,104,86,76,100,88,112,72,95,84]
  .map((work, i) => ({ work, pause: 14 + (i % 3) * 3, late: i % 6 === 5 ? 8 + (i % 4) : 0 }))

export default function RelatoriosTab({ showToast }) {
  const [period, setPeriod] = useState('Maio 2026')
  const chartRef = useRef(null)
  const [chartBuilt, setChartBuilt] = useState(false)

  useEffect(() => {
    setChartBuilt(true)
  }, [])

  return (
    <div>
      <style>{`
        .rel-vgrid{display:grid;grid-template-columns:1.4fr 1fr;gap:22px}
        .rel-statgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:0 0 22px}
        .rel-trow{display:grid;grid-template-columns:1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.7fr;gap:10px;align-items:center;padding:10px 14px;border-radius:7px;font-size:12.5px;color:rgba(237,227,210,0.85)}
        .rel-trow:not(.rel-thead):hover{background:rgba(237,227,210,0.03)}
        .rel-trow.rel-thead{font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${FO.muted};font-family:${FO.mono};font-weight:500;border-bottom:1px solid ${FO.lineSoft};border-radius:0;padding-bottom:8px;margin-bottom:4px}
        .rel-subbtn{padding:6px 10px;border-radius:6px;border:1px solid ${FO.line};background:rgba(237,227,210,0.04);color:rgba(237,227,210,0.85);font-size:11.5px;font-weight:500;cursor:pointer;font-family:inherit;white-space:nowrap}
        .rel-subbtn:hover{background:rgba(237,227,210,0.08)}
        .rel-bar-wrap{display:flex;align-items:flex-end;gap:5px;height:200px;padding:0 4px}
        .rel-bar{flex:1;display:flex;flex-direction:column-reverse;gap:1px;border-radius:4px 4px 0 0;overflow:hidden;position:relative;min-height:6px;cursor:pointer;transition:opacity .15s}
        .rel-bar:hover{opacity:0.82}
        .rel-bar .seg-work{background:linear-gradient(180deg,${FO.orangeSoft},${FO.orange})}
        .rel-bar .seg-pause{background:rgba(229,160,74,0.55)}
        .rel-bar .seg-late{background:#e5654a}
        @media(max-width:900px){.rel-vgrid{grid-template-columns:1fr}.rel-statgrid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:600px){.rel-trow{grid-template-columns:1fr 0.8fr 0.8fr 0.8fr 0.8fr!important;font-size:11px!important}}
      `}</style>

      <div style={{ padding: '24px 30px 40px' }}>
        {/* vhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: FO.orangeGlow, fontFamily: FO.mono, fontWeight: 500 }}>Espelho · AFD · AEJ</div>
            <h2 style={{ margin: '6px 0 4px', fontFamily: FO.serif, fontWeight: 400, fontSize: 32, letterSpacing: '-0.02em', color: FO.cream }}>
              Relatórios de <em style={{ color: FO.orangeGlow, fontStyle: 'italic' }}>jornada</em>
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: FO.muted, maxWidth: 580, lineHeight: 1.55 }}>
              Espelho de ponto, banco de horas, exportações fiscais (AFD/AEJ Portaria 671) e visões consolidadas por equipe.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={period} onChange={e => setPeriod(e.target.value)} style={{ height: 34, padding: '0 12px', borderRadius: 7, border: `1px solid ${FO.line}`, background: 'rgba(237,227,210,0.04)', color: FO.cream, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }}>
              <option>Maio 2026</option>
              <option>Abril 2026</option>
              <option>Março 2026</option>
              <option>Período personalizado</option>
            </select>
            <button onClick={() => showToast?.('Exportando PDF...')} style={{ padding: '8px 14px', borderRadius: 7, border: `1px solid ${FO.line}`, background: 'rgba(237,227,210,0.04)', color: 'rgba(237,227,210,0.85)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 2v8M4 7l3 3 3-3M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Exportar PDF
            </button>
            <button onClick={() => showToast?.('Gerando AFD/AEJ...')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 7, border: 'none', background: `linear-gradient(180deg,${FO.orangeSoft} 0%,${FO.orange} 45%,${FO.orangeDeep} 100%)`, color: FO.cream, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 14px rgba(196,90,44,0.32)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v8M4 7l3 3 3-3M2 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              AFD/AEJ
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="rel-statgrid">
          {STATS.map((s, i) => (
            <div key={i} style={{ padding: '16px 18px', borderRadius: 12, background: FO.card, border: `1px solid ${FO.line}` }}>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: FO.muted, fontFamily: FO.mono, fontWeight: 500 }}>{s.k}</div>
              <div style={{ margin: '8px 0 4px', fontFamily: FO.serif, fontSize: 28, letterSpacing: '-0.02em', color: s.vClr || FO.cream, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 11.5, color: FO.muted }}>{s.sub}</div>
              <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: 'rgba(237,227,210,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.bar}%`, background: `linear-gradient(90deg,${s.barClr || FO.orangeSoft},${s.barClr || FO.orange})`, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>

        <div className="rel-vgrid" style={{ marginBottom: 24 }}>
          {/* Chart */}
          <div style={{ background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Distribuição diária · maio</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: FO.muted, fontFamily: FO.mono, letterSpacing: '0.06em' }}>
                {[['#C45A2C','Trabalho'],['rgba(229,160,74,0.7)','Pausa'],['#e5654a','Atraso']].map(([clr, lbl]) => (
                  <span key={lbl}><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 6, verticalAlign: -1, background: clr }} />{lbl}</span>
                ))}
              </div>
            </div>
            <div style={{ padding: '18px 22px 28px' }}>
              {chartBuilt && (
                <div ref={chartRef} className="rel-bar-wrap">
                  {CHART_DATA.map((d, i) => (
                    <div key={i} className="rel-bar" title={`Dia ${i+1}`}>
                      {d.late > 0 && <div className="seg-late" style={{ height: d.late }} />}
                      <div className="seg-pause" style={{ height: d.pause }} />
                      <div className="seg-work" style={{ height: d.work }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Exports */}
          <div style={{ background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}` }}>
              <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Exportações disponíveis</div>
            </div>
            <div style={{ padding: '6px 12px 14px' }}>
              {EXPORTS.map((ex, i) => (
                <div key={i} onClick={() => showToast?.(`Baixando: ${ex.name}`)} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', padding: '11px 10px', borderRadius: 7, cursor: 'pointer' }}>
                  <span style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{ex.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, color: FO.cream, fontWeight: 500 }}>{ex.name}</div>
                    <div style={{ fontSize: 11.5, color: FO.muted, marginTop: 2 }}>{ex.sub}</div>
                  </div>
                  <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: FO.mono, background: PILL_BG[ex.pill], color: PILL_CLR[ex.pill], whiteSpace: 'nowrap' }}>
                    {ex.pillTxt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team table */}
        <div style={{ background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Resumo por funcionário · equipe NOC</div>
            <div style={{ fontSize: 11.5, color: FO.muted, fontFamily: FO.mono }}>5 pessoas</div>
          </div>
          <div style={{ padding: '6px 6px 14px' }}>
            <div className="rel-trow rel-thead">
              <span>Funcionário</span><span>Cargo</span><span>Trabalhado</span><span>Extra</span><span>Atrasos</span><span>Faltas</span><span>Aderência</span><span></span>
            </div>
            {TEAM.map((m, i) => (
              <div key={i} className="rel-trow">
                <span>{m.name}{m.you && <small style={{ color: FO.muted, marginLeft: 4, fontSize: 10 }}>(você)</small>}</span>
                <span style={{ fontSize: 11.5, color: FO.muted }}>{m.cargo}</span>
                <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: FO.cream }}>{m.worked}</span>
                <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: FO.orangeGlow }}>{m.extra}</span>
                <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: m.atrasosClr || FO.cream }}>{m.atrasos}</span>
                <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: FO.cream }}>{m.faltas}</span>
                <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: m.aderClr }}>{m.ader}</span>
                <span>
                  <button className="rel-subbtn" onClick={() => showToast?.(`Detalhes de ${m.name}`)}>Detalhes</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
