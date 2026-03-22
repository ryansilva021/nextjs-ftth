'use client'

import { useState, useEffect } from 'react'
import { getCaminhoPotencia } from '@/actions/topologia'

// ─── Referência ───────────────────────────────────────────────────────────────

const SPLITTER_DB = {
  '1:2':  3.4,
  '1:4':  6.9,
  '1:8':  10.3,
  '1:16': 13.1,
  '1:32': 16.1,
  '1:64': 19.0,
}
const PON_TECHS = {
  GPON:   { nome: 'GPON B+',  potOLT: 5,  rxMin: -27, rxCrit: -30, budget: 32, cor: '#22c55e' },
  EPON:   { nome: 'EPON',     potOLT: 4,  rxMin: -24, rxCrit: -27, budget: 28, cor: '#3b82f6' },
  XGPON:  { nome: 'XG-PON',  potOLT: 7,  rxMin: -32, rxCrit: -35, budget: 39, cor: '#f59e0b' },
  XGSPON: { nome: 'XGS-PON', potOLT: 9,  rxMin: -32, rxCrit: -35, budget: 41, cor: '#a855f7' },
}
const LIMITES = { ok: -27, alto: -30 } // keep for fallback usage in sub-components

// ─── Cálculo ──────────────────────────────────────────────────────────────────

function calcTrecho({ potAtual, distKm, perdaKm, splitters, nFusoes, nConectores, perdaFusao, perdaConector }) {
  const perdaFibra      = distKm * perdaKm
  const perdaFusoes     = nFusoes * perdaFusao
  const perdaConectores = nConectores * perdaConector
  const perdaSplitters  = splitters.reduce((acc, s) => acc + (SPLITTER_DB[s] ?? 0), 0)
  const perdaTotal      = perdaFibra + perdaFusoes + perdaConectores + perdaSplitters
  const potFinal        = potAtual - perdaTotal
  return { perdaFibra, perdaFusoes, perdaConectores, perdaSplitters, perdaTotal, potFinal }
}

function calcularManual({ potOLT, distancia, perdaKm, nFusoes, nConectores, splitters, perdaFusao, perdaConector, limites = LIMITES }) {
  const { perdaFibra, perdaFusoes, perdaConectores, perdaSplitters, perdaTotal, potFinal } =
    calcTrecho({ potAtual: potOLT, distKm: distancia, perdaKm, splitters, nFusoes, nConectores, perdaFusao, perdaConector })

  let status = 'OK'; let cor = '#22c55e'
  if (potFinal < limites.alto) { status = 'FORA DO PADRÃO'; cor = '#ef4444' }
  else if (potFinal < limites.ok) { status = 'ATENUAÇÃO ALTA'; cor = '#f59e0b' }
  return { perdaFibra, perdaFusoes, perdaConectores, perdaSplitters, perdaTotal, potFinal, status, cor }
}

function calcularCaminhoAuto(caminho, potOLT, perdaKm, perdaFusao, perdaConector, limites = LIMITES) {
  let potAtual = potOLT
  const trechos = caminho.trechos.map(t => {
    const r = calcTrecho({
      potAtual, distKm: t.distKm, perdaKm,
      splitters: t.splitters, nFusoes: t.nFusoes,
      nConectores: t.nConectores, perdaFusao, perdaConector,
    })
    potAtual = r.potFinal
    return { ...t, ...r }
  })
  const potFinal = potAtual
  let status = 'OK'; let cor = '#22c55e'
  if (potFinal < limites.alto) { status = 'FORA DO PADRÃO'; cor = '#ef4444' }
  else if (potFinal < limites.ok) { status = 'ATENUAÇÃO ALTA'; cor = '#f59e0b' }
  return { trechos, potFinal, status, cor }
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEF_COMUM  = { potOLT: 5, perdaKm: 0.35, perdaFusao: 0.1, perdaConector: 0.5 }
const DEF_TRECHO = { nome: '', distancia: 2, nFusoes: 4, nConectores: 2, splitters: ['1:8'] }

// ─── Estilos ──────────────────────────────────────────────────────────────────

const CS = {
  card:    { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20 },
  label:   { display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 },
  input:   { width: '100%', background: 'var(--inp-bg)', border: '1px solid var(--border-color-strong)', borderRadius: 8, padding: '8px 12px', color: 'var(--foreground)', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  select:  { width: '100%', background: 'var(--inp-bg)', border: '1px solid var(--border-color-strong)', borderRadius: 8, padding: '8px 12px', color: 'var(--foreground)', fontSize: 13, outline: 'none', boxSizing: 'border-box', cursor: 'pointer' },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  calcBtn: { width: '100%', padding: 13, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, background: '#6366f1', color: 'white' },
  modeBtn: (ativa) => ({
    flex: '1 1 120px', padding: '10px 12px', borderRadius: 8, border: `1px solid ${ativa ? '#6366f144' : 'var(--border-color)'}`,
    cursor: 'pointer', fontWeight: 600, fontSize: 13,
    background: ativa ? '#6366f122' : 'var(--card-bg)',
    color: ativa ? '#818cf8' : 'var(--text-muted)', transition: 'all .15s',
  }),
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Campo({ label, value, onChange, min, max, step = 0.01, unit }) {
  return (
    <div>
      <label style={CS.label}>{label}{unit && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({unit})</span>}</label>
      <input type="number" step={step} min={min} max={max} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)} style={CS.input} />
    </div>
  )
}

function SplitterPicker({ selected, onChange }) {
  const totalDB = selected.reduce((a, s) => a + (SPLITTER_DB[s] ?? 0), 0)
  return (
    <div>
      <label style={CS.label}>Splitters</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
        {Object.entries(SPLITTER_DB).map(([s, db]) => {
          const ativo = selected.includes(s)
          return (
            <button key={s} type="button" title={`${s} → ${db} dB`}
              onClick={() => onChange(ativo ? selected.filter(x => x !== s) : [...selected, s])}
              style={{ padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: ativo ? '#6366f122' : 'var(--card-bg)', color: ativo ? '#818cf8' : 'var(--text-muted)', border: `1px solid ${ativo ? '#6366f144' : 'var(--border-color)'}` }}>
              {s}
            </button>
          )
        })}
      </div>
      {selected.length > 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {selected.map(s => `${s}→${SPLITTER_DB[s]}dB`).join(' + ')} = <b style={{ color: 'var(--text-muted)' }}>{totalDB.toFixed(1)} dB</b>
        </div>
      )}
    </div>
  )
}

function CartaoResultado({ r, titulo, tech }) {
  return (
    <div style={{ ...CS.card, borderColor: `${r.cor}55` }}>
      {titulo && <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{titulo}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Potência recebida</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: r.cor, lineHeight: 1.1 }}>{r.potFinal.toFixed(2)} dBm</div>
        </div>
        <div style={{ padding: '8px 18px', borderRadius: 8, background: `${r.cor}1a`, color: r.cor, border: `1px solid ${r.cor}55`, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
          {r.status}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {[['Fibra', r.perdaFibra], ['Fusões', r.perdaFusoes], ['Conectores', r.perdaConectores], ['Splitter(s)', r.perdaSplitters], ['Total', r.perdaTotal]].map(([label, val]) => (
          <div key={label} style={{ background: 'var(--card-bg)', borderRadius: 6, padding: '6px 10px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{label}</div>
            <div style={{ color: label === 'Total' ? 'var(--foreground)' : 'var(--text-secondary)', fontWeight: label === 'Total' ? 700 : 500, fontSize: 13 }}>{val.toFixed(2)} dB</div>
          </div>
        ))}
      </div>
      {tech && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            ['Orçamento óptico', `${tech.budget} dB`, 'var(--text-muted)'],
            ['Perdas totais',    `${r.perdaTotal.toFixed(2)} dB`, 'var(--text-secondary)'],
            ['Margem disponível', `${(r.potFinal - tech.rxMin).toFixed(2)} dB`, r.potFinal >= tech.rxMin ? '#22c55e' : '#ef4444'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ flex: '1 1 100px', background: 'var(--card-bg)', borderRadius: 6, padding: '6px 10px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{l}</div>
              <div style={{ color: c, fontWeight: 700, fontSize: 13 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ABNT fiber color badge ────────────────────────────────────────────────────

function FibraBadge({ fibra }) {
  if (!fibra) return null
  const textColor = ['Branco','Amarelo','Cinza'].includes(fibra.cor) ? '#0f172a' : '#fff'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: fibra.hex, color: textColor,
      border: '1px solid var(--border-color)',
      borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 700,
    }}>
      F{fibra.n} {fibra.cor}
    </span>
  )
}

// ─── Componente de trecho no caminho automático ───────────────────────────────

function TrechoCard({ t, potEntrada, idx }) {
  const cor = { OLT: '#6366f1', CDO: '#7c3aed', CTO: '#0284c7' }

  // Detalhes de porta para o nó de origem
  const portaLabel = t.tipoDe === 'OLT' && t.portaOLT
    ? `PON ${t.portaOLT}`
    : t.tipoDe === 'CDO' && t.portaCDO
    ? `Porta ${t.portaCDO}`
    : null
  const fibraLabel = t.tipoDe === 'OLT' ? t.fibraOLT : t.fibraCDO

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Nó de origem */}
      {idx === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: `${cor[t.tipoDe] ?? '#6366f1'}22`, border: `1px solid ${cor[t.tipoDe] ?? '#6366f1'}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: cor[t.tipoDe] ?? '#6366f1', flexShrink: 0 }}>
            {t.tipoDe}
          </div>
          <div>
            <div style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: 13 }}>{t.de}</div>
            <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>+{potEntrada.toFixed(2)} dBm</div>
          </div>
        </div>
      )}

      {/* Linha de trecho */}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Trilho vertical */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
          <div style={{ width: 2, flex: 1, background: 'var(--card-bg)', minHeight: 8 }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--card-bg)' }} />
          <div style={{ width: 2, flex: 1, background: 'var(--card-bg)', minHeight: 8 }} />
        </div>

        {/* Card do trecho */}
        <div style={{ flex: 1, background: 'var(--card-bg)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border-color)', marginBottom: 6 }}>
          {/* Linha superior: distância + perda total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {t.distKm.toFixed(3)} km
              <span style={{ color: t.fonteDistancia === 'estimativa' ? '#f59e0b' : '#22c55e', fontSize: 10, marginLeft: 4 }}>
                ({t.fonteDistancia === 'estimativa' ? '≈estimativa' : '✓ rota'})
              </span>
            </span>
            {t.perdaTotal != null && (
              <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>−{t.perdaTotal.toFixed(2)} dB</span>
            )}
          </div>

          {/* Porta + fibra + conector */}
          {(portaLabel || fibraLabel) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {portaLabel && (
                <span style={{ padding: '2px 8px', borderRadius: 4, background: `${cor[t.tipoDe] ?? '#6366f1'}18`, border: `1px solid ${cor[t.tipoDe] ?? '#6366f1'}44`, color: cor[t.tipoDe] ?? '#6366f1', fontSize: 11, fontWeight: 700 }}>
                  {portaLabel}
                </span>
              )}
              {fibraLabel && <FibraBadge fibra={fibraLabel} />}
              {t.conector && (
                <span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 11 }}>
                  {t.conector}
                </span>
              )}
            </div>
          )}

          {/* Perdas detalhadas */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11 }}>
            <span style={{ color: 'var(--text-muted)' }}>
              fibra: <b style={{ color: 'var(--text-secondary)' }}>{t.perdaFibra?.toFixed(2) ?? '—'} dB</b>
            </span>
            {t.splitters?.length > 0 && (
              <span style={{ color: 'var(--text-muted)' }}>
                splitter: <b style={{ color: '#818cf8' }}>{t.splitters.join('+')} = {t.perdaSplitters?.toFixed(1)} dB</b>
              </span>
            )}
            {t.nFusoes > 0 && (
              <span style={{ color: 'var(--text-muted)' }}>
                fusões: <b style={{ color: 'var(--text-secondary)' }}>{t.nFusoes} × {(t.perdaFusoes / t.nFusoes).toFixed(2)} = {t.perdaFusoes?.toFixed(2)} dB</b>
              </span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>
              conect.: <b style={{ color: 'var(--text-secondary)' }}>{t.nConectores} = {t.perdaConectores?.toFixed(2)} dB</b>
            </span>
          </div>
        </div>
      </div>

      {/* Nó de destino */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: `${cor[t.tipoPara] ?? '#0284c7'}22`, border: `1px solid ${cor[t.tipoPara] ?? '#0284c7'}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: cor[t.tipoPara] ?? '#0284c7', flexShrink: 0 }}>
          {t.tipoPara}
        </div>
        <div>
          <div style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: 13 }}>{t.para}</div>
          {t.potFinal != null ? (
            <div style={{ fontSize: 12, fontWeight: 700, color: t.potFinal < LIMITES.alto ? '#ef4444' : t.potFinal < LIMITES.ok ? '#f59e0b' : '#22c55e' }}>
              {t.potFinal.toFixed(2)} dBm
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>aguardando cálculo</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modo Automático ──────────────────────────────────────────────────────────

function ModoAutomatico({ topologia, projetoId, tech }) {
  const [ctoId,        setCtoId]        = useState('')
  const [caminho,      setCaminho]      = useState(null)
  const [carregando,   setCarregando]   = useState(false)
  const [erroCaminho,  setErroCaminho]  = useState(null)
  const [potOLT,       setPotOLT]       = useState(tech?.potOLT ?? 5)
  const [perdaKm,      setPerdaKm]      = useState(0.35)
  const [perdaFusao,   setPerdaFusao]   = useState(0.10)
  const [perdaConect,  setPerdaConect]  = useState(0.50)
  const [resultado,    setResultado]    = useState(null)

  useEffect(() => {
    if (tech) { setPotOLT(tech.potOLT); setPerdaKm(0.35); setPerdaFusao(0.10); setPerdaConect(0.50); setResultado(null) }
  }, [tech])

  // Agrupar CTOs por OLT para o optgroup
  const grupos = {}
  const semVinculo = []
  for (const cto of (topologia?.ctos || [])) {
    const grupo = cto.olt_nome ? `OLT: ${cto.olt_nome}` : cto.cdo_nome ? `CDO: ${cto.cdo_nome}` : null
    if (grupo) {
      if (!grupos[grupo]) grupos[grupo] = []
      grupos[grupo].push(cto)
    } else {
      semVinculo.push(cto)
    }
  }

  async function selecionarCTO(id) {
    setCtoId(id)
    setCaminho(null)
    setResultado(null)
    setErroCaminho(null)
    if (!id) return
    setCarregando(true)
    try {
      const data = await getCaminhoPotencia(projetoId, id)
      setCaminho(data)
    } catch (e) {
      setErroCaminho(e.message)
    } finally {
      setCarregando(false)
    }
  }

  function calcular() {
    if (!caminho) return
    const limites = tech ? { ok: tech.rxMin, alto: tech.rxCrit } : LIMITES
    setResultado(calcularCaminhoAuto(caminho, potOLT, perdaKm, perdaFusao, perdaConect, limites))
  }

  const totalCtos = (topologia?.ctos || []).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {totalCtos === 0 && (
        <div style={{ ...CS.card, color: 'var(--text-secondary)', fontSize: 13 }}>
          Nenhuma CTO cadastrada. Adicione CTOs e configure a topologia para usar o modo automático.
        </div>
      )}

      {/* Seleção */}
      <div style={CS.card}>
        <div style={{ color: 'var(--foreground)', fontWeight: 700, marginBottom: 14 }}>Selecionar caminho</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 0 }}>
          <div>
            <label style={CS.label}>CTO / destino</label>
            <select value={ctoId} onChange={e => selecionarCTO(e.target.value)} style={CS.select}>
              <option value="">— selecionar CTO —</option>
              {Object.entries(grupos).map(([grupo, lista]) => (
                <optgroup key={grupo} label={grupo}>
                  {lista.map(cto => (
                    <option key={cto.cto_id} value={cto.cto_id}>
                      {cto.nome}{cto.cdo_nome ? ` (${cto.cdo_nome})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
              {semVinculo.length > 0 && (
                <optgroup label="Sem topologia">
                  {semVinculo.map(cto => <option key={cto.cto_id} value={cto.cto_id}>{cto.nome}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <Campo label="Pot. OLT"     value={potOLT}      onChange={setPotOLT}      min={-5}  max={10}  step={0.1}  unit="dBm"   />
          <Campo label="Fib./km"      value={perdaKm}     onChange={setPerdaKm}     min={0.1} max={2}   step={0.01} unit="dB/km" />
          <Campo label="Perda/fusão"  value={perdaFusao}  onChange={setPerdaFusao}  min={0}   max={1}   step={0.01} unit="dB"    />
          <Campo label="Perda/conect" value={perdaConect} onChange={setPerdaConect} min={0}   max={2}   step={0.01} unit="dB"    />
        </div>
      </div>

      {/* Loading */}
      {carregando && (
        <div style={{ ...CS.card, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
          🔍 Percorrendo topologia…
        </div>
      )}

      {/* Erro */}
      {erroCaminho && (
        <div style={{ ...CS.card, borderColor: '#ef444455', color: '#fca5a5', fontSize: 13 }}>
          ⚠️ {erroCaminho}
        </div>
      )}

      {/* Caminho carregado — preview do path */}
      {caminho && !carregando && (
        <div style={CS.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ color: 'var(--foreground)', fontWeight: 700 }}>
              {caminho.olt?.id ?? 'OLT'}{caminho.cdo ? ` → ${caminho.cdo.id}` : ''} → {caminho.cto.id}
            </div>
            {caminho.cto.lat && (
              <a
                href={`/?cto=${caminho.cto.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: '#0284c7', textDecoration: 'none', border: '1px solid #0284c744', padding: '4px 10px', borderRadius: 6 }}
              >
                🗺️ Ver no mapa
              </a>
            )}
          </div>

          {/* Resumo de equipamentos */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {caminho.olt && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', minWidth: 110 }}>
                <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>OLT</span>
                <span style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 600 }}>{caminho.olt.id}</span>
                {caminho.olt.modelo && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{caminho.olt.modelo}</span>}
                {caminho.cdo?.porta_olt && <span style={{ fontSize: 10, color: '#818cf8' }}>PON {caminho.cdo.porta_olt}</span>}
              </div>
            )}
            {caminho.cdo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderRadius: 8, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', minWidth: 110 }}>
                <span style={{ fontSize: 9, color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>CDO / DIO</span>
                <span style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 600 }}>{caminho.cdo.id}</span>
                {caminho.cdo.splitter && <span style={{ fontSize: 10, color: '#a78bfa' }}>Splitter {caminho.cdo.splitter}</span>}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderRadius: 8, background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.2)', minWidth: 110 }}>
              <span style={{ fontSize: 9, color: '#0284c7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>CTO</span>
              <span style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 600 }}>{caminho.cto.id}</span>
              {caminho.cto.porta_cdo && <span style={{ fontSize: 10, color: '#38bdf8' }}>Porta {caminho.cto.porta_cdo}</span>}
              {caminho.cto.capacidade && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{caminho.cto.capacidade} portas</span>}
              {caminho.cto.splitter && <span style={{ fontSize: 10, color: '#38bdf8' }}>Splitter {caminho.cto.splitter}</span>}
            </div>
          </div>

          {/* Visualização do caminho */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {caminho.trechos.map((t, i) => (
              <TrechoCard
                key={i}
                t={resultado ? { ...t, ...resultado.trechos[i] } : t}
                potEntrada={potOLT}
                idx={i}
              />
            ))}
          </div>

          {/* Aviso estimativa */}
          {caminho.trechos.some(t => t.fonteDistancia === 'estimativa') && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠️ Distâncias marcadas como "estimativa" são linha reta (sem rota cadastrada entre os elementos).
              Para maior precisão, crie rotas vinculando os elementos.
            </div>
          )}
        </div>
      )}

      {/* Botão calcular */}
      {caminho && !carregando && (
        <button onClick={calcular} style={CS.calcBtn}>⚡ Calcular Potência</button>
      )}

      {/* Resultado automático */}
      {resultado && (() => {
        const perdaTotal = resultado.trechos.reduce((s, t) => s + t.perdaTotal, 0)
        const maxLoss    = Math.max(...resultado.trechos.map(t => t.perdaTotal))
        const budgetPct  = tech ? Math.min(100, perdaTotal / tech.budget * 100) : null
        const budgetCor  = budgetPct > 95 ? '#ef4444' : budgetPct > 80 ? '#f59e0b' : '#22c55e'
        const margem     = tech ? resultado.potFinal - tech.rxMin : null
        return (
          <div style={{ ...CS.card, borderColor: `${resultado.cor}55` }}>
            {/* Potência + status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Potência na ONU (final)</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: resultado.cor, lineHeight: 1.1 }}>
                  {resultado.potFinal.toFixed(2)} dBm
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ padding: '6px 16px', borderRadius: 8, background: `${resultado.cor}1a`, color: resultado.cor, border: `1px solid ${resultado.cor}55`, fontWeight: 700, fontSize: 13 }}>
                  {resultado.status}
                </div>
                {margem != null && (
                  <span style={{ fontSize: 11, color: margem >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    Margem: {margem >= 0 ? '+' : ''}{margem.toFixed(2)} dB
                  </span>
                )}
              </div>
            </div>

            {/* Budget progress bar */}
            {tech && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>Orçamento óptico</span>
                  <span style={{ color: budgetCor, fontWeight: 700 }}>{perdaTotal.toFixed(2)} / {tech.budget} dB ({budgetPct.toFixed(0)}%)</span>
                </div>
                <div style={{ height: 6, background: 'var(--card-bg)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${budgetPct}%`, background: budgetCor, borderRadius: 3, transition: 'width 0.4s' }} />
                </div>
              </div>
            )}

            {/* Tabela resumo de perdas */}
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 480 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Trecho</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Fibra</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Splitter</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Fusões</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Conect.</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Total</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Acum.</th>
                </tr>
              </thead>
              <tbody>
                {resultado.trechos.map((t, i) => {
                  const isCrit = t.perdaTotal === maxLoss && maxLoss > 0
                  const acumCor = t.potFinal < (tech?.rxCrit ?? LIMITES.alto) ? '#ef4444' : t.potFinal < (tech?.rxMin ?? LIMITES.ok) ? '#f59e0b' : '#22c55e'
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)', background: isCrit ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                      <td style={{ padding: '5px 8px', color: 'var(--foreground)' }}>
                        {t.de} → {t.para}
                        {isCrit && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '1px 5px', borderRadius: 3 }}>CRÍTICO</span>}
                      </td>
                      <td style={{ textAlign: 'right', padding: '5px 8px' }}>{t.perdaFibra.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '5px 8px' }}>{t.perdaSplitters.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '5px 8px' }}>{t.perdaFusoes.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '5px 8px' }}>{t.perdaConectores.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '5px 8px', color: isCrit ? '#ef4444' : 'var(--foreground)', fontWeight: 700 }}>{t.perdaTotal.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '5px 8px', color: acumCor, fontWeight: 600 }}>{t.potFinal.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Modo manual: Balanceada ──────────────────────────────────────────────────

function ModoBalanceada({ tech }) {
  const [comum,     setComum]     = useState({ ...DEF_COMUM, potOLT: tech?.potOLT ?? DEF_COMUM.potOLT })
  const [trecho,    setTrecho]    = useState(DEF_TRECHO)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    if (tech) { setComum(p => ({ ...p, potOLT: tech.potOLT })); setResultado(null) }
  }, [tech])

  const setC = (k, v) => { setComum(p => ({ ...p, [k]: v })); setResultado(null) }
  const setT = (k, v) => { setTrecho(p => ({ ...p, [k]: v })); setResultado(null) }

  function calcular() {
    const limites = tech ? { ok: tech.rxMin, alto: tech.rxCrit } : LIMITES
    setResultado(calcularManual({
      potOLT: comum.potOLT, perdaKm: comum.perdaKm,
      perdaFusao: comum.perdaFusao, perdaConector: comum.perdaConector,
      distancia: trecho.distancia, nFusoes: trecho.nFusoes,
      nConectores: trecho.nConectores, splitters: trecho.splitters,
      limites,
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={CS.card}>
        <div style={{ color: 'var(--foreground)', fontWeight: 700, marginBottom: 14 }}>Parâmetros OLT / Fibra</div>
        <div style={CS.grid}>
          <Campo label="Potência OLT"    value={comum.potOLT}         onChange={v => setC('potOLT', v)}         min={-10} max={10}  step={0.1}  unit="dBm"   />
          <Campo label="Atenuação fibra" value={comum.perdaKm}        onChange={v => setC('perdaKm', v)}        min={0.1} max={2}   step={0.01} unit="dB/km" />
          <Campo label="Perda / fusão"   value={comum.perdaFusao}     onChange={v => setC('perdaFusao', v)}     min={0}   max={1}   step={0.01} unit="dB"    />
          <Campo label="Perda / conector" value={comum.perdaConector} onChange={v => setC('perdaConector', v)}  min={0}   max={2}   step={0.01} unit="dB"    />
        </div>
      </div>
      <div style={CS.card}>
        <div style={{ color: 'var(--foreground)', fontWeight: 700, marginBottom: 14 }}>Trecho OLT → ONU</div>
        <div style={{ ...CS.grid, marginBottom: 14 }}>
          <Campo label="Distância"    value={trecho.distancia}    onChange={v => setT('distancia', v)}    min={0} max={500} step={0.1} unit="km" />
          <Campo label="Nº fusões"    value={trecho.nFusoes}      onChange={v => setT('nFusoes', v)}      min={0} max={200} step={1}   />
          <Campo label="Nº conectores" value={trecho.nConectores} onChange={v => setT('nConectores', v)}  min={0} max={100} step={1}   />
        </div>
        <SplitterPicker selected={trecho.splitters} onChange={v => setT('splitters', v)} />
      </div>
      <button onClick={calcular} style={CS.calcBtn}>⚡ Calcular</button>
      {resultado && <CartaoResultado r={resultado} tech={tech} />}
    </div>
  )
}

// ─── Modo manual: Desbalanceada ───────────────────────────────────────────────

function ModoDesbalanceada({ tech }) {
  const [comum,     setComum]     = useState({ ...DEF_COMUM, potOLT: tech?.potOLT ?? DEF_COMUM.potOLT })
  const [caminhos,  setCaminhos]  = useState([
    { ...DEF_TRECHO, nome: 'Caminho 1' },
    { ...DEF_TRECHO, nome: 'Caminho 2', splitters: ['1:4'], distancia: 4 },
  ])
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    if (tech) { setComum(p => ({ ...p, potOLT: tech.potOLT })); setResultado(null) }
  }, [tech])

  const setC = (k, v) => { setComum(p => ({ ...p, [k]: v })); setResultado(null) }
  const setK = (i, k, v) => { setCaminhos(cs => cs.map((c, j) => j === i ? { ...c, [k]: v } : c)); setResultado(null) }

  function calcular() {
    const limites = tech ? { ok: tech.rxMin, alto: tech.rxCrit } : LIMITES
    setResultado(caminhos.map(c => ({
      nome: c.nome || 'Caminho',
      ...calcularManual({
        potOLT: comum.potOLT, perdaKm: comum.perdaKm,
        perdaFusao: comum.perdaFusao, perdaConector: comum.perdaConector,
        distancia: c.distancia, nFusoes: c.nFusoes,
        nConectores: c.nConectores, splitters: c.splitters,
        limites,
      }),
    })))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={CS.card}>
        <div style={{ color: 'var(--foreground)', fontWeight: 700, marginBottom: 14 }}>Parâmetros OLT / Fibra</div>
        <div style={CS.grid}>
          <Campo label="Potência OLT"    value={comum.potOLT}         onChange={v => setC('potOLT', v)}         min={-10} max={10}  step={0.1}  unit="dBm"   />
          <Campo label="Atenuação fibra" value={comum.perdaKm}        onChange={v => setC('perdaKm', v)}        min={0.1} max={2}   step={0.01} unit="dB/km" />
          <Campo label="Perda / fusão"   value={comum.perdaFusao}     onChange={v => setC('perdaFusao', v)}     min={0}   max={1}   step={0.01} unit="dB"    />
          <Campo label="Perda / conector" value={comum.perdaConector} onChange={v => setC('perdaConector', v)}  min={0}   max={2}   step={0.01} unit="dB"    />
        </div>
      </div>
      <div style={CS.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ color: 'var(--foreground)', fontWeight: 700 }}>Caminhos ({caminhos.length})</div>
          <button onClick={() => { setCaminhos(cs => [...cs, { ...DEF_TRECHO, nome: `Caminho ${cs.length + 1}` }]); setResultado(null) }}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            + Adicionar
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {caminhos.map((c, i) => (
            <div key={i} style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 14, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={c.nome} placeholder={`Caminho ${i + 1}`} onChange={e => setK(i, 'nome', e.target.value)} style={{ ...CS.input, flex: 1 }} />
                {caminhos.length > 1 && (
                  <button onClick={() => { setCaminhos(cs => cs.filter((_, j) => j !== i)); setResultado(null) }}
                    style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    ✕
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 12 }}>
                <Campo label="Distância"   value={c.distancia}    onChange={v => setK(i, 'distancia', v)}    min={0} max={500} step={0.1} unit="km" />
                <Campo label="Fusões"      value={c.nFusoes}      onChange={v => setK(i, 'nFusoes', v)}      min={0} max={200} step={1}   />
                <Campo label="Conectores"  value={c.nConectores}  onChange={v => setK(i, 'nConectores', v)}  min={0} max={100} step={1}   />
              </div>
              <SplitterPicker selected={c.splitters} onChange={v => setK(i, 'splitters', v)} />
            </div>
          ))}
        </div>
      </div>
      <button onClick={calcular} style={CS.calcBtn}>⚡ Calcular</button>
      {resultado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resultado.map((r, i) => <CartaoResultado key={i} r={r} titulo={r.nome} tech={tech} />)}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CalculoPotenciaClient({ topologia, projetoId }) {
  const [modo, setModo] = useState('automatico')
  const [techKey, setTechKey] = useState('GPON')
  const tech = PON_TECHS[techKey]

  const modos = [
    ['automatico',    'Automatico'],
    ['balanceada',    'Rede Balanceada'],
    ['desbalanceada', 'Rede Desbalanceada'],
  ]

  return (
    <div style={{ width: '100%' }}>
      {/* Seletor de modo */}
      <div style={{ ...CS.card, padding: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {modos.map(([m, label]) => (
            <button key={m} style={CS.modeBtn(modo === m)} onClick={() => setModo(m)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Tecnologia PON */}
      <div style={{ ...CS.card, padding: '10px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Tecnologia:</span>
          {Object.entries(PON_TECHS).map(([k, t]) => (
            <button key={k} onClick={() => setTechKey(k)}
              style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${k === techKey ? t.cor + '66' : 'var(--border-color)'}`, background: k === techKey ? t.cor + '18' : 'var(--card-bg)', color: k === techKey ? t.cor : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {t.nome}
            </button>
          ))}
          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>
            Orcamento: <b style={{ color: 'var(--text-secondary)' }}>{tech.budget} dB</b> · OLT: <b style={{ color: 'var(--text-secondary)' }}>{tech.potOLT} dBm</b> · RX min: <b style={{ color: 'var(--text-secondary)' }}>{tech.rxMin} dBm</b>
          </span>
        </div>
      </div>

      {/* Conteúdo do modo selecionado */}
      {modo === 'automatico' && <ModoAutomatico topologia={topologia} projetoId={projetoId} tech={tech} />}
      {modo === 'balanceada' && <ModoBalanceada tech={tech} />}
      {modo === 'desbalanceada' && <ModoDesbalanceada tech={tech} />}

      {/* Tabela de referência */}
      <div style={{ ...CS.card, background: 'var(--card-bg)', padding: '14px 16px', marginTop: 16 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Referencia — {tech.nome} · Orcamento {tech.budget} dB
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 10 }}>
          {[['#22c55e', `OK >= ${tech.rxMin} dBm`], ['#f59e0b', `Limite ${tech.rxMin}<->${tech.rxCrit} dBm`], ['#ef4444', `Fora < ${tech.rxCrit} dBm`]].map(([cor, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(SPLITTER_DB).map(([s, db]) => (
            <span key={s} style={{ color: 'var(--text-muted)', fontSize: 11 }}><b style={{ color: 'var(--text-muted)' }}>{s}</b>: {db} dB</span>
          ))}
        </div>
      </div>
    </div>
  )
}
