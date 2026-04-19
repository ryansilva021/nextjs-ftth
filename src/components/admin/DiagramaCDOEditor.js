'use client'

/**
 * DiagramaCDOEditor.js
 * Editor ABNT para CE/CDO com abas: PON/OLT | Bandejas | Splitters | Cabos | Resumo
 */

import { useState, useEffect } from 'react'
import { getDiagramaCaixa, saveDiagramaCaixa, getUsadosProjeto } from '@/actions/caixas'
import { useTheme } from '@/contexts/ThemeContext'
import { logTopoChange, validarConexao, criarFusaoAuto, getActiveAbnt } from '@/lib/topologia-ftth'
import { useFiberColors } from '@/contexts/FiberColorContext'

// ─── Mobile detection ─────────────────────────────────────────────────────────

function useMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return mobile
}

// ─── Cores ABNT dinâmicas ─────────────────────────────────────────────────────
// Usa as cores configuradas pelo admin em /admin/configuracoes via getActiveAbnt().
// Adiciona campo `text` (cor de texto contrastante) calculado automaticamente.

function hexLuminance(hex) {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return (0.299*r + 0.587*g + 0.114*b) / 255
}

function getAbnt() {
  return getActiveAbnt().map(c => ({
    ...c,
    text: hexLuminance(c.hex) > 0.45 ? '#1c1208' : '#f3f4f6',
  }))
}

// Alias para compatibilidade com código existente que usa ABNT como array
const ABNT = new Proxy([], {
  get(_, prop) {
    const arr = getAbnt()
    if (prop === 'length') return arr.length
    if (prop === 'map')    return arr.map.bind(arr)
    if (prop === 'find')   return arr.find.bind(arr)
    if (prop === 'filter') return arr.filter.bind(arr)
    if (prop === 'forEach') return arr.forEach.bind(arr)
    if (typeof prop === 'string' && !isNaN(prop)) return arr[Number(prop)]
    return arr[prop]
  },
})

const SPLITTER_TIPOS = ['1x2', '1x4', '1x8', '1x16', '1x32']
function uid() { return Math.random().toString(36).slice(2, 9) }

// ─── Estilos base ─────────────────────────────────────────────────────────────
// Palette constants (warm light+orange theme)
const BG   = '#ffffff'
const BG2  = '#fff9f5'
const BG3  = '#fff4ea'
const BORDER = '#cca880'

function getStyles(isDark) {
  const bg   = isDark ? '#0d1117' : '#ffffff'
  const bg2  = isDark ? '#161b22' : '#fff9f5'
  const bg3  = isDark ? '#1c2333' : '#fff4ea'
  const br   = isDark ? '#30363d' : '#cca880'
  const text = isDark ? '#e6edf3' : '#1c1208'
  const muted = isDark ? '#8b949e' : '#a07040'
  return {
    wrap:     { backgroundColor: bg, border: `1px solid ${br}`, borderRadius: 12, color: text, overflow: 'visible', minWidth: 0 },
    header:   { backgroundColor: bg2, borderBottom: `1px solid ${br}`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
    tabBar:   { backgroundColor: bg2, borderBottom: `1px solid ${br}`, display: 'flex', gap: 0, overflowX: 'auto' },
    tabBtn:   (ativa, cor) => ({
      padding: '11px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      backgroundColor: 'transparent', border: 'none', borderBottom: ativa ? `2px solid ${cor}` : '2px solid transparent',
      color: ativa ? cor : muted, whiteSpace: 'nowrap', transition: 'all .15s',
    }),
    body:     { padding: '16px', minHeight: 300, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', overflowX: 'auto' },
    sec:      { backgroundColor: bg2, border: `1px solid ${br}`, borderRadius: 10, padding: '16px', marginBottom: 14 },
    secHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    secTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted },
    inp:      { backgroundColor: bg3, border: `1px solid ${br}`, color: text, borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
    inpSm:    { backgroundColor: bg3, border: `1px solid ${br}`, color: text, borderRadius: 6, padding: '4px 6px', fontSize: 12, outline: 'none', width: 52, textAlign: 'center', boxSizing: 'border-box' },
    lbl:      { fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, display: 'block', marginBottom: 3 },
    btnAdd:   { background: 'linear-gradient(135deg,#238636,#1a7f37)', color: '#fff', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', border: 'none' },
    btnDel:   { backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.4)', color: '#f85149', fontSize: 11, borderRadius: 6, padding: '4px 8px', cursor: 'pointer' },
    btnSave:  { background: 'linear-gradient(135deg,#1f6feb,#1158c7)', color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 8, padding: '9px 24px', cursor: 'pointer', border: 'none' },
    tag:      (c) => ({ display:'inline-flex', alignItems:'center', gap:5, backgroundColor:`${c}18`, border:`1px solid ${c}44`, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600, color:c }),
    card:     { backgroundColor: bg3, border: `1px solid ${br}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8 },
  }
}

// Module-level S (light theme) used by sub-components that cannot access theme context.
const S = getStyles(false)

// ─── Seletor de fibra como <select> com opções coloridas ─────────────────────
function FibraSelect({ value, onChange, small }) {
  const cur = ABNT.find(a => a.idx === Number(value)) ?? ABNT[0]
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        backgroundColor: cur.hex,
        color: cur.text,
        border: `1px solid ${cur.hex}`,
        borderRadius: 5,
        padding: small ? '3px 5px' : '5px 7px',
        fontSize: small ? 11 : 12,
        fontWeight: 700,
        cursor: 'pointer',
        outline: 'none',
        width: small ? 110 : 130,
      }}
    >
      {ABNT.map(c => (
        <option key={c.idx} value={c.idx}
          style={{ backgroundColor: c.hex, color: c.text, fontWeight: 700 }}>
          {c.idx}. {c.nome}
        </option>
      ))}
    </select>
  )
}

// ─── Aba PON/OLT ─────────────────────────────────────────────────────────────
function AbaOLT({ entrada, onChange, olts, splitters, bandejas, isDark }) {
  const S = getStyles(isDark)
  // OLT vinculada (por id ou olt_id)
  const oltAtual = (olts ?? []).find(o => o.id === entrada.olt_id || o.olt_id === entrada.olt_id) ?? null
  const dioMapa  = oltAtual?.dio_config?.mapa ?? []

  // Porta DIO selecionada atualmente (porta_olt corresponde ao DIO port)
  const portaSel = entrada.porta_olt ?? null
  const entradaSel = dioMapa.find(m => m.porta === portaSel) ?? null

  // CTOs servidas pelos splitters desta CDO/CEO (para display informativo)
  const ctosServidas = (splitters ?? []).flatMap(s =>
    (s.saidas ?? []).filter(sd => sd?.cto_id?.trim()).map(sd => sd.cto_id)
  )
  // PONs já usadas nas bandejas desta CDO
  const ponsUsadas = new Set()
  ;(bandejas ?? []).forEach(b => (b.fusoes ?? []).forEach(f => {
    if (f.tipo === 'pon' && f.pon_porta != null) ponsUsadas.add(f.pon_porta)
  }))

  function selecionarOLT(id) {
    onChange({ ...entrada, olt_id: id, pon: null, porta_olt: null })
  }

  function selecionarDIO(m) {
    // Clique na mesma porta → deselecionar
    if (portaSel === m.porta) {
      onChange({ ...entrada, porta_olt: null, pon: null })
    } else {
      onChange({ ...entrada, porta_olt: m.porta, pon: m.pon ?? null })
    }
  }

  return (
    <div>
      {/* ── Seleção de OLT ── */}
      <div style={S.sec}>
        <p style={{ ...S.secTitle, marginBottom: 12 }}>OLT de Origem</p>

        {(olts ?? []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {olts.map(o => {
              const ativa = entrada.olt_id === o.id
              return (
                <div key={o.id} onClick={() => selecionarOLT(ativa ? '' : o.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    backgroundColor: ativa ? 'rgba(31,111,235,0.12)' : BG3,
                    border: `1px solid ${ativa ? '#1f6feb' : BORDER}`,
                    transition: 'all .15s' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ativa ? '#58a6ff' : '#e6edf3' }}>{o.nome}</span>
                    <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 8, fontFamily: 'monospace' }}>{o.id}</span>
                    {o.modelo && <span style={{ fontSize: 10, color: '#484f58', marginLeft: 6 }}>{o.modelo}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#7dd3fc' }}>{o.capacidade ?? 16} PONs</span>
                    {ativa && <span style={{ fontSize: 10, fontWeight: 700, color: '#1f6feb', background: 'rgba(31,111,235,0.15)', borderRadius: 4, padding: '2px 7px' }}>✓ Selecionada</span>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div>
            <label style={S.lbl}>ID da OLT (manual)</label>
            <input value={entrada.olt_id} onChange={e => onChange({ ...entrada, olt_id: e.target.value })}
              placeholder="ex: OLT-01" style={{ ...S.inp, borderColor: entrada.olt_id ? '#1f6feb' : BORDER }} />
          </div>
        )}
      </div>

      {/* ── DIO da OLT selecionada → seleção de porta/PON ── */}
      {oltAtual && (
        <div style={S.sec}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
            <span style={S.secTitle}>Porta DIO — selecione a que alimenta esta CEO/CDO</span>
            {entradaSel && (
              <span style={{ fontSize: 10, color: '#3fb950', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: 6, padding: '3px 10px', fontWeight: 700 }}>
                D{entradaSel.porta} → PON {entradaSel.pon ?? '?'} → {entradaSel.local || 'sem local'}
              </span>
            )}
          </div>

          {dioMapa.length === 0 && (
            <p style={{ fontSize: 12, color: '#484f58' }}>
              Esta OLT não tem mapa DIO configurado. Configure na aba OLTs.
            </p>
          )}

          {dioMapa.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[...dioMapa].sort((a, b) => a.porta - b.porta).map(m => {
                const sel   = portaSel === m.porta
                const ponEm = ponsUsadas.has(m.pon)
                return (
                  <div key={m.porta} onClick={() => selecionarDIO(m)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                      borderRadius: 8, cursor: 'pointer',
                      backgroundColor: sel ? 'rgba(139,87,229,0.14)' : BG3,
                      border: `1px solid ${sel ? '#8957e5' : BORDER}`,
                      transition: 'all .15s' }}>
                    {/* Badge porta */}
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#f97316', fontFamily: 'monospace',
                      background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                      borderRadius: 5, padding: '2px 8px', flexShrink: 0 }}>
                      D{m.porta}
                    </span>
                    {/* PON */}
                    {m.pon != null && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: ponEm && !sel ? '#f85149' : '#a78bfa',
                        background: sel ? 'rgba(139,87,229,0.2)' : 'rgba(139,87,229,0.08)',
                        border: `1px solid ${ponEm && !sel ? 'rgba(248,81,73,0.4)' : 'rgba(139,87,229,0.3)'}`,
                        borderRadius: 5, padding: '2px 8px', flexShrink: 0 }}>
                        PON {m.pon}
                        {ponEm && !sel && ' ⚠'}
                      </span>
                    )}
                    {/* Local */}
                    <span style={{ fontSize: 12, color: sel ? '#e6edf3' : '#8b949e', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.local || <em style={{ color: '#484f58' }}>sem descrição</em>}
                    </span>
                    {sel && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#8957e5', flexShrink: 0 }}>✓ Selecionado</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Campo placa manual */}
          <div style={{ marginTop: 12 }}>
            <label style={S.lbl}>Placa / Slot (opcional)</label>
            <input type="number" min={1} value={entrada.placa ?? ''} placeholder="1"
              onChange={e => onChange({ ...entrada, placa: e.target.value ? +e.target.value : null })}
              style={{ ...S.inp, maxWidth: 120 }} />
          </div>
        </div>
      )}

      {/* ── Resumo da seleção ── */}
      {entrada.olt_id && (
        <div style={{ ...S.sec, borderColor: entradaSel ? '#8957e5' : BORDER }}>
          <p style={{ ...S.secTitle, marginBottom: 10 }}>Resumo do vínculo</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={S.tag('#1f6feb')}>🖥 {entrada.olt_id}</span>
            {entrada.porta_olt != null && <span style={S.tag('#f97316')}>D{entrada.porta_olt}</span>}
            {entrada.pon != null       && <span style={S.tag('#8957e5')}>PON {entrada.pon}</span>}
            {entrada.placa != null     && <span style={S.tag('#e3b341')}>Placa {entrada.placa}</span>}
            {entradaSel?.local         && <span style={S.tag('#58a6ff')}>📍 {entradaSel.local}</span>}
          </div>
          {ctosServidas.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ ...S.lbl, marginBottom: 6 }}>CTOs alimentadas por esta CDO:</p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {ctosServidas.map((cid, i) => (
                  <span key={i} style={S.tag('#3fb950')}>📡 {cid}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Bandeja SVG — visualização ENTRADA → FUSÕES → SAÍDA ─────────────────────
/**
 * Renderiza a bandeja de forma visual:
 *   ENTRADA  ●──────●──────●  SAÍDA
 * Cada fusão aparece como linha horizontal com dots ABNT coloridos.
 * Tipo pon tem cor própria (roxo). Fluxo: bandeja → splitter → CTO.
 */
function BandejaSvg({ fusoes = [], isDark }) {
  const W = 360
  const PAD = 14
  const ROW_H = 28
  const ENT_X = 28
  const SAI_X = W - 28
  const FUS_X = W / 2
  const H = PAD * 2 + Math.max(fusoes.length, 1) * ROW_H

  const textColor = isDark ? '#8b949e' : '#64748b'
  const bg = isDark ? '#0d1117' : '#f8fafc'
  const borderColor = isDark ? '#21262d' : '#e2e8f0'

  // Cor do nó de fusão por tipo
  function tipoColor(tipo) {
    if (tipo === 'pon')         return '#8957e5'
    if (tipo === 'conector')    return '#f59e0b'
    if (tipo === 'passthrough') return '#06b6d4'
    return '#484f58'
  }

  function abntColor(fibra) {
    const c = ABNT[((fibra ?? 1) - 1) % ABNT.length]
    return c?.hex ?? '#374151'
  }

  return (
    <svg width={W} height={H} style={{ display: 'block', borderRadius: 8, backgroundColor: bg, border: `1px solid ${borderColor}` }}>
      {/* Labels coluna */}
      <text x={ENT_X} y={10} fontSize={8} fill={textColor} textAnchor="middle" fontFamily="system-ui" letterSpacing={1}>
        ENTRADA
      </text>
      <text x={FUS_X} y={10} fontSize={8} fill={textColor} textAnchor="middle" fontFamily="system-ui" letterSpacing={1}>
        FUSÕES
      </text>
      <text x={SAI_X} y={10} fontSize={8} fill={textColor} textAnchor="middle" fontFamily="system-ui" letterSpacing={1}>
        SAÍDA
      </text>

      {fusoes.length === 0 && (
        <text x={W / 2} y={H / 2 + 4} fontSize={11} fill={textColor} textAnchor="middle" fontFamily="system-ui">
          Sem fusões
        </text>
      )}

      {fusoes.map((f, i) => {
        const y      = PAD + 6 + i * ROW_H + ROW_H / 2
        const entC   = abntColor(f.entrada?.fibra)
        const saiC   = abntColor(f.saida?.fibra)
        const midC   = tipoColor(f.tipo)
        const isCTO  = false   // saída direta da bandeja removida — somente via splitter
        const isPON  = f.tipo === 'pon'

        // Espessura da linha por tipo
        const strokeW = isCTO ? 2 : isPON ? 2 : 1.5

        return (
          <g key={f.id ?? i}>
            {/* Linha entrada → nó fusão */}
            <line x1={ENT_X + 7} y1={y} x2={FUS_X - 8} y2={y}
              stroke={entC} strokeWidth={strokeW} strokeLinecap="round" />
            {/* Linha nó fusão → saída */}
            <line x1={FUS_X + 8} y1={y} x2={SAI_X - 7} y2={y}
              stroke={saiC} strokeWidth={strokeW} strokeLinecap="round" />

            {/* Dot entrada (ABNT color) */}
            <circle cx={ENT_X} cy={y} r={6} fill={entC} />
            <text x={ENT_X} y={y + 3.5} fontSize={8} fill="#fff" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
              {f.entrada?.fibra ?? '?'}
            </text>

            {/* Nó de fusão */}
            <circle cx={FUS_X} cy={y} r={7} fill={isDark ? '#161b22' : '#fff'} stroke={midC} strokeWidth={2} />
            {/* Símbolo no nó */}
            {isPON && (
              <text x={FUS_X} y={y + 3} fontSize={7} fill={midC} textAnchor="middle" fontFamily="monospace" fontWeight="bold">P</text>
            )}
            {isCTO && (
              <text x={FUS_X} y={y + 3} fontSize={7} fill={midC} textAnchor="middle" fontFamily="monospace" fontWeight="bold">→</text>
            )}
            {!isPON && !isCTO && (
              <text x={FUS_X} y={y + 3} fontSize={7} fill={midC} textAnchor="middle" fontFamily="monospace">✕</text>
            )}

            {/* Label destino/PON acima do nó */}
            {isCTO && f.destino_id && (
              <text x={FUS_X} y={y - 10} fontSize={8} fill={midC} textAnchor="middle" fontFamily="system-ui" fontWeight="bold">
                {f.destino_id.length > 10 ? f.destino_id.slice(0, 10) + '…' : f.destino_id}
              </text>
            )}
            {isPON && f.pon_porta != null && (
              <text x={FUS_X} y={y - 10} fontSize={8} fill={midC} textAnchor="middle" fontFamily="monospace">
                {f.pon_placa != null ? `P${f.pon_placa}/` : ''}{f.pon_porta}
              </text>
            )}

            {/* Dot saída (ABNT color) */}
            <circle cx={SAI_X} cy={y} r={6} fill={saiC} />
            <text x={SAI_X} y={y + 3.5} fontSize={8} fill="#fff" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
              {f.saida?.fibra ?? '?'}
            </text>

            {/* Número da fusão */}
            <text x={4} y={y + 3.5} fontSize={8} fill={textColor} fontFamily="monospace">{i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Aba Bandejas ─────────────────────────────────────────────────────────────
function AbaBandejas({ bandejas, onChange, entrada, splitters, onChangeSplitters, usadosGlobal, isDark }) {
  const S = getStyles(isDark)
  function addBandeja() {
    onChange([...bandejas, { id: uid(), nome: `Bandeja ${bandejas.length + 1}`, fusoes: [] }])
  }
  function remBandeja(id) { onChange(bandejas.filter(b => b.id !== id)) }
  function upBandeja(id, p) { onChange(bandejas.map(b => b.id === id ? { ...b, ...p } : b)) }

  function addFusao(bId) {
    const b = bandejas.find(b => b.id === bId)
    const novaFusao = criarFusaoAuto({ fibraEntrada: (b.fusoes.length % 12) + 1, fibraSaida: (b.fusoes.length % 12) + 1 })
    upBandeja(bId, { fusoes: [...b.fusoes, novaFusao] })
    logTopoChange('fusao_criada', { fusao_id: novaFusao.id, bandeja_id: bId })
  }
  function remFusao(bId, fId) {
    upBandeja(bId, { fusoes: bandejas.find(b => b.id === bId).fusoes.filter(f => f.id !== fId) })
    logTopoChange('fusao_removida', { fusao_id: fId, bandeja_id: bId })
  }
  function upFusao(bId, fId, p) {
    const b = bandejas.find(b => b.id === bId)
    const currentF = b.fusoes.find(f => f.id === fId)
    const updated = { ...currentF, ...p }

    // Bloquear saída direta da bandeja — fluxo obrigatório: bandeja → SPLITTER → CTO
    if (p.tipo && (p.tipo === 'saida_cto' || p.tipo === 'saida_cdo')) {
      console.warn('[Topologia] Saída direta da bandeja para CTO/CDO não permitida. Use splitter.')
      return
    }

    upBandeja(bId, { fusoes: b.fusoes.map(f => f.id === fId ? updated : f) })

    if (onChangeSplitters && splitters) {
      // Sync splitter PON vinculado (apenas para tipo 'pon')
      if (updated.splitter_id) {
        onChangeSplitters(splitters.map(s => s.id === updated.splitter_id ? {
          ...s,
          entrada: { ...s.entrada, fibra: updated.entrada?.fibra ?? s.entrada.fibra },
          pon_placa: updated.pon_placa ?? null,
          pon_porta: updated.pon_porta ?? null,
        } : s))
      }
    }
  }

  const placas = entrada?.dio_config?.placas ?? []

  // PON em uso: locais (todas as bandejas desta caixa) + outras caixas do projeto
  const ponUsadosLocal = new Set()
  bandejas.forEach(b => (b.fusoes ?? []).forEach(f => {
    if (f.tipo === 'pon' && f.pon_placa != null && f.pon_porta != null) {
      ponUsadosLocal.add(`${f.pon_placa}-${f.pon_porta}`)
    }
  }))
  const ponUsados = new Set([...ponUsadosLocal, ...(usadosGlobal?.pons ?? [])])

  // DIO em uso: locais + outras caixas do projeto
  const dioLocal = new Set()
  bandejas.forEach(b => (b.fusoes ?? []).forEach(f => {
    if (f.porta_dio != null) dioLocal.add(Number(f.porta_dio))
  }))
  const dioGlobal = new Set([...dioLocal, ...(usadosGlobal?.dios ?? [])])

  const [vistaVisual, setVistaVisual] = useState({}) // bandeja.id → boolean

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ color: '#8b949e', fontSize: 13 }}>Bandejas de fusão da caixa</p>
        <button onClick={addBandeja} style={S.btnAdd}>+ Bandeja</button>
      </div>

      {bandejas.length === 0 && (
        <div style={{ ...S.sec, textAlign: 'center', color: '#484f58', padding: '32px' }}>
          Nenhuma bandeja. Clique em "+ Bandeja" para adicionar.
        </div>
      )}

      {bandejas.map((b, bi) => {
        const visual = vistaVisual[b.id] ?? false
        return (
        <div key={b.id} style={{ ...S.sec, borderLeft: '3px solid #1f6feb' }}>
          {/* Header bandeja */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: b.fusoes.length ? 10 : 0, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#58a6ff' }}>🗂️ Bandeja {bi + 1}</span>
            <input value={b.nome} onChange={e => upBandeja(b.id, { nome: e.target.value })}
              style={{ ...S.inp, flex: 1, minWidth: 80, padding: '4px 8px', fontSize: 12, height: 28 }} />
            {/* Toggle visual/tabela */}
            <button
              onClick={() => setVistaVisual(v => ({ ...v, [b.id]: !visual }))}
              title={visual ? 'Vista tabela' : 'Vista visual'}
              style={{ ...S.btnAdd, background: visual ? 'rgba(88,166,255,0.2)' : 'rgba(88,166,255,0.08)',
                border: `1px solid ${visual ? '#58a6ff' : 'rgba(88,166,255,0.3)'}`,
                color: '#58a6ff', padding: '4px 8px', fontSize: 13, minHeight: 28 }}>
              {visual ? '📋' : '🖼️'}
            </button>
            <button onClick={() => addFusao(b.id)} style={{ ...S.btnAdd, whiteSpace: 'nowrap' }}>+ Fusão</button>
            <button onClick={() => remBandeja(b.id)} style={S.btnDel}>🗑️</button>
          </div>

          {/* Vista visual ENTRADA → FUSÕES → SAÍDA */}
          {b.fusoes.length > 0 && visual && (
            <div style={{ marginBottom: 12, overflowX: 'auto' }}>
              <BandejaSvg fusoes={b.fusoes} isDark={isDark} />
            </div>
          )}

          {b.fusoes.length > 0 && !visual && (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ minWidth: 520, borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '6px 4px', width: 24, color: '#484f58', fontWeight: 700, textAlign: 'center' }}>#</th>
                    <th style={{ padding: '6px 8px', color: '#58a6ff', fontWeight: 700, borderLeft: '2px solid rgba(88,166,255,0.3)', textAlign: 'center', whiteSpace: 'nowrap' }}>Ent.</th>
                    <th style={{ padding: '6px 8px', color: '#3fb950', fontWeight: 700, borderLeft: '2px solid rgba(63,185,80,0.3)', textAlign: 'center', whiteSpace: 'nowrap' }}>Saída</th>
                    <th style={{ padding: '6px 6px', color: '#f97316', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>DIO</th>
                    <th style={{ padding: '6px 6px', color: '#8b949e', fontWeight: 700, textAlign: 'center' }}>Tipo</th>
                    <th style={{ padding: '6px 6px', color: '#8b949e', fontWeight: 700, textAlign: 'left' }}>PON / Destino / Info</th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {b.fusoes.map((f, fi) => {
                    // PON checks
                    const placaAtual  = placas.find(p => p.num === f.pon_placa)
                    const localDup    = f.pon_placa != null && f.pon_porta != null &&
                      bandejas.some(bx => (bx.fusoes ?? []).some(fx =>
                        fx.id !== f.id && fx.pon_placa === f.pon_placa && fx.pon_porta === f.pon_porta))
                    const globalDup   = f.pon_placa != null && f.pon_porta != null &&
                      (usadosGlobal?.pons ?? new Set()).has(`${f.pon_placa}-${f.pon_porta}`)
                    const isDup       = localDup || globalDup
                    // DIO checks
                    const totalDIO    = placas.length > 0 ? placas.reduce((s, p) => s + (p.portas ?? 0), 0) : 48
                    const portasOcupadas = new Set([...dioGlobal].filter(p => p !== f.porta_dio))
                    return (
                      <tr key={f.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#484f58', fontWeight: 700, fontSize: 11 }}>{fi + 1}</td>

                        {/* Fibra Entrada */}
                        <td style={{ padding: '5px 4px', borderLeft: '2px solid rgba(88,166,255,0.15)' }}>
                          <FibraSelect value={f.entrada.fibra} small
                            onChange={v => upFusao(b.id, f.id, { entrada: { ...f.entrada, fibra: v } })} />
                        </td>

                        {/* Fibra Saída */}
                        <td style={{ padding: '5px 4px', borderLeft: '2px solid rgba(63,185,80,0.15)' }}>
                          <FibraSelect value={f.saida.fibra} small
                            onChange={v => upFusao(b.id, f.id, { saida: { ...f.saida, fibra: v } })} />
                        </td>

                        {/* Porta DIO */}
                        <td style={{ padding: '5px 4px' }}>
                          <select value={f.porta_dio ?? ''}
                            onChange={e => upFusao(b.id, f.id, { porta_dio: e.target.value ? +e.target.value : null })}
                            style={{ ...S.inp, width: 56, padding: '4px 4px', fontSize: 11,
                              borderColor: f.porta_dio != null ? '#f97316' : BORDER }}>
                            <option value="">—</option>
                            {Array.from({ length: totalDIO }, (_, i) => {
                              const p = i + 1
                              const occ = portasOcupadas.has(p)
                              return <option key={p} value={p} disabled={occ}>{p}{occ ? ' [-]' : ''}</option>
                            })}
                          </select>
                        </td>

                        {/* Tipo */}
                        <td style={{ padding: '5px 4px' }}>
                          <select value={f.tipo} onChange={e => upFusao(b.id, f.id, { tipo: e.target.value })}
                            style={{ ...S.inp, padding: '4px 4px', width: 90, fontSize: 11,
                              borderColor: f.tipo === 'pon' ? '#8957e5' : BORDER }}>
                            <option value="fusao">Fusão</option>
                            <option value="pon">PON→SPL</option>
                            <option value="conector">Conector</option>
                            <option value="passthrough">Passagem</option>
                          </select>
                        </td>

                        {/* PON / Info */}
                        <td style={{ padding: '5px 4px' }}>
                          {f.tipo === 'pon' ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
                              <select value={f.pon_placa ?? ''} onChange={e => upFusao(b.id, f.id, { pon_placa: e.target.value ? +e.target.value : null, pon_porta: null })}
                                style={{ ...S.inp, width: 76, padding: '4px 4px', fontSize: 11, borderColor: '#8957e5' }}>
                                <option value="">Placa</option>
                                {placas.map(p => <option key={p.num} value={p.num}>{p.label}</option>)}
                                {!placas.length && <option value="1">Pl 1</option>}
                              </select>
                              <select value={f.pon_porta ?? ''} onChange={e => upFusao(b.id, f.id, { pon_porta: e.target.value ? +e.target.value : null })}
                                style={{ ...S.inp, width: 56, padding: '4px 4px', fontSize: 11, borderColor: isDup ? '#f85149' : '#8957e5' }}>
                                <option value="">PON</option>
                                {Array.from({ length: placaAtual?.portas ?? 16 }, (_, i) => {
                                  const p = i + 1
                                  const k = `${f.pon_placa}-${p}`
                                  const occupied = p !== f.pon_porta && ponUsados.has(k)
                                  return <option key={p} value={p} disabled={occupied}>{p}{occupied ? ' [-]' : ''}</option>
                                })}
                              </select>
                              {/* Splitter vinculado — obrigatório para tipo pon */}
                              <select value={f.splitter_id ?? ''} onChange={e => {
                                const sid = e.target.value || null
                                upFusao(b.id, f.id, { splitter_id: sid })
                                if (sid && onChangeSplitters && splitters) {
                                  onChangeSplitters(splitters.map(s => s.id === sid ? {
                                    ...s,
                                    entrada: { ...s.entrada, fibra: f.saida?.fibra ?? f.entrada?.fibra ?? s.entrada.fibra },
                                    pon_placa: f.pon_placa ?? null,
                                    pon_porta: f.pon_porta ?? null,
                                  } : s))
                                }
                              }} style={{ ...S.inp, width: 80, padding: '4px 4px', fontSize: 11,
                                borderColor: f.splitter_id ? '#e3b341' : '#f85149' }}>
                                <option value="">↳ SPL *</option>
                                {(splitters ?? []).map((s, si) => <option key={s.id} value={s.id}>{s.nome || `SPL ${si + 1}`}</option>)}
                              </select>
                              {!f.splitter_id && <span style={{ fontSize: 10, color: '#f85149', fontWeight: 700 }}>⚠SPL?</span>}
                              {isDup && <span title={globalDup ? 'PON em uso em outra CDO/CEO do projeto' : 'PON duplicada nesta caixa'}
                                style={{ fontSize: 10, color: '#f85149', fontWeight: 700, whiteSpace: 'nowrap' }}>⚠{globalDup ? 'PROJ' : 'DUP'}</span>}
                              {!isDup && f.pon_placa != null && f.pon_porta != null && (
                                <span style={{ fontSize: 10, color: '#8957e5', fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: 700 }}>
                                  P{f.pon_placa}/{f.pon_porta}
                                </span>
                              )}
                            </div>
                          ) : (
                            <input value={f.obs ?? ''} onChange={e => upFusao(b.id, f.id, { obs: e.target.value })}
                              placeholder="obs..." style={{ ...S.inp, padding: '4px 7px', fontSize: 11, minWidth: 90 }} />
                          )}
                        </td>

                        <td style={{ padding: '5px 4px' }}>
                          <button onClick={() => remFusao(b.id, f.id)} style={{ ...S.btnDel, padding: '4px 8px', fontSize: 13, minHeight: 32 }}>✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {b.fusoes.length === 0 && (
            <p style={{ color: '#484f58', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              Sem fusões — clique "+ Fusão"
            </p>
          )}
        </div>
        )
      })}
    </div>
  )
}

// ─── Aba Splitters ────────────────────────────────────────────────────────────
function AbaSplitters({ splitters, onChange, bandejas, isDark, ctos = [], caixas = [] }) {
  const S = getStyles(isDark)
  // Bypass splitters são gerados automaticamente pelas saídas diretas da bandeja — não exibir aqui
  const nonBypass = splitters ?? []

  const mkSaida = i => ({ porta: i + 1, tipo: 'cto', cto_id: '', obs: '', ctos_cascata: [] })

  function addSplitter() {
    const saidas = Array.from({ length: 8 }, (_, i) => mkSaida(i))
    onChange([...splitters, { id: uid(), nome: `Splitter ${nonBypass.length + 1}`, tipo: '1x8', entrada: { tubo: 1, fibra: 1 }, saidas }])
  }
  function remSplitter(id) { onChange(splitters.filter(s => s.id !== id)) }
  function upSplitter(id, p) { onChange(splitters.map(s => s.id === id ? { ...s, ...p } : s)) }
  function changeTipo(id, tipo) {
    const qtd = parseInt(tipo.split('x')[1])
    upSplitter(id, { tipo, saidas: Array.from({ length: qtd }, (_, i) => mkSaida(i)) })
  }
  function upSaida(sId, porta, p) {
    const s = splitters.find(s => s.id === sId)
    upSplitter(sId, { saidas: s.saidas.map(sd => sd.porta === porta ? { ...sd, ...p } : sd) })
  }

  // (saídas diretas da bandeja removidas — fluxo obrigatório: bandeja → splitter → CTO)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ color: '#8b949e', fontSize: 13 }}>Splitters ópticos da caixa</p>
        <button onClick={addSplitter} style={S.btnAdd}>+ Splitter</button>
      </div>

      {nonBypass.length === 0 && (
        <div style={{ ...S.sec, textAlign: 'center', color: '#484f58', padding: '32px' }}>
          Nenhum splitter. Clique "+ Splitter".
        </div>
      )}

      {nonBypass.map((s, si) => {
        const ligadas = s.saidas.filter(sd => sd.cto_id?.trim()).length
        const corEnt = ABNT.find(a => a.idx === s.entrada.fibra)
        // Busca fusão vinculada a este splitter nas bandejas
        const linkedFusao = (bandejas ?? []).flatMap(b => b.fusoes ?? []).find(f => f.splitter_id === s.id)
        return (
          <div key={s.id} style={{ ...S.sec, borderLeft: `3px solid ${linkedFusao ? '#e3b341' : '#484f58'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e3b341' }}>Splitter {si + 1}</span>
              <input value={s.nome} onChange={e => upSplitter(s.id, { nome: e.target.value })}
                style={{ ...S.inp, flex: 1, minWidth: 100, padding: '4px 8px', fontSize: 12, height: 28 }} />
              <select value={s.tipo} onChange={e => changeTipo(s.id, e.target.value)}
                style={{ ...S.inp, width: 70, padding: '4px 6px', fontSize: 12 }}>
                {SPLITTER_TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
              <span style={S.tag('#3fb950')}>{ligadas}/{s.saidas.length} ligadas</span>
              <button onClick={() => remSplitter(s.id)} style={S.btnDel}>🗑️</button>
            </div>

            {/* PON herdada da bandeja */}
            {linkedFusao ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '6px 10px',
                backgroundColor: 'rgba(137,87,229,0.08)', border: '1px solid rgba(137,87,229,0.25)',
                borderRadius: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#bc8cff', whiteSpace: 'nowrap' }}>↳ PON herdada:</span>
                {linkedFusao.pon_placa != null && <span style={S.tag('#e3b341')}>Placa {linkedFusao.pon_placa}</span>}
                {linkedFusao.pon_porta != null && <span style={S.tag('#8957e5')}>PON {linkedFusao.pon_porta}</span>}
                <span style={S.tag('#58a6ff')}>FO {linkedFusao.entrada?.fibra ?? '?'}</span>
                <span style={{ fontSize: 10, color: '#484f58' }}>— todas as saídas pertencem a esta PON</span>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#484f58', padding: '4px 10px', marginBottom: 8 }}>
                Sem bandeja vinculada — selecione um splitter na aba Bandejas (fusão tipo PON).
              </div>
            )}

            {/* Entrada */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', backgroundColor: 'rgba(88,166,255,0.05)', border: '1px solid rgba(88,166,255,0.15)', borderRadius: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#58a6ff', whiteSpace: 'nowrap' }}>🔵 Entrada:</span>
              <FibraSelect value={s.entrada.fibra}
                onChange={v => upSplitter(s.id, { entrada: { ...s.entrada, fibra: v } })} />
              <div>
                <span style={{ ...S.lbl, display: 'inline' }}>Tubo </span>
                <input type="number" min={1} value={s.entrada.tubo}
                  onChange={e => upSplitter(s.id, { entrada: { ...s.entrada, tubo: +e.target.value } })}
                  style={{ ...S.inpSm, width: 52 }} />
              </div>
            </div>

            {/* Saídas */}
            <p style={{ ...S.lbl, color: '#3fb950', marginBottom: 8 }}>Saídas — {s.saidas.length} portas</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
              {s.saidas.map(sd => {
                const portaHex = ABNT[(sd.porta - 1) % 12]?.hex ?? '#374151'
                const portaText = ABNT[(sd.porta - 1) % 12]?.text ?? '#e5e7eb'
                const mainPlaceholder =
                  sd.tipo === 'pon'          ? 'ID PON' :
                  sd.tipo === 'cdo'          ? 'ID CE/CDO' :
                  sd.tipo === 'passagem'     ? 'ID/Nome' :
                  sd.tipo === 'conector'     ? 'Porta física' :
                  sd.tipo === 'fusao_bandeja' ? 'ID Bandeja' :
                  'ID CTO'
                return (
                  <div key={sd.porta} style={{
                    backgroundColor: sd.cto_id?.trim() ? 'rgba(63,185,80,0.08)' : BG3,
                    border: `1px solid ${sd.cto_id?.trim() ? 'rgba(63,185,80,0.3)' : BORDER}`,
                    borderRadius: 7, padding: '7px 9px',
                    borderTop: `2px solid ${portaHex}`,
                  }}>
                    {/* Header: fibra dot + port label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                      <span style={{
                        width: 9, height: 9, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                        background: portaHex, boxShadow: `0 0 4px ${portaHex}88`,
                        border: `1px solid ${portaHex}aa`,
                      }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: portaHex }}>S{sd.porta}</span>
                    </div>
                    {/* Tipo select */}
                    <select
                      value={sd.tipo ?? 'cto'}
                      onChange={e => upSaida(s.id, sd.porta, { tipo: e.target.value, cto_id: '' })}
                      style={{ ...S.inp, marginBottom: 4, padding: '3px 6px', fontSize: 11 }}
                    >
                      <option value="cto">CTO</option>
                      <option value="pon">PON</option>
                      <option value="cdo">CE/CDO</option>
                      <option value="passagem">Passagem</option>
                      <option value="conector">Conector</option>
                      <option value="fusao_bandeja">Fusão Bandeja</option>
                    </select>
                    {/* Main destination ID — dropdown for CTO/CDO, free text otherwise */}
                    {(sd.tipo === 'cto' || !sd.tipo) ? (
                      <select value={sd.cto_id ?? ''} onChange={e => upSaida(s.id, sd.porta, { cto_id: e.target.value })}
                        style={{ ...S.inp, marginBottom: 3, padding: '3px 7px', fontSize: 12 }}>
                        <option value="">— Selecione CTO —</option>
                        {ctos.map(c => (
                          <option key={c.cto_id ?? c._id} value={c.cto_id ?? c._id}>
                            {c.nome ?? c.cto_id ?? c._id}
                          </option>
                        ))}
                      </select>
                    ) : sd.tipo === 'cdo' ? (
                      <select value={sd.cto_id ?? ''} onChange={e => upSaida(s.id, sd.porta, { cto_id: e.target.value })}
                        style={{ ...S.inp, marginBottom: 3, padding: '3px 7px', fontSize: 12 }}>
                        <option value="">— Selecione CE/CDO —</option>
                        {caixas.map(c => (
                          <option key={c._id} value={c._id}>
                            {c.nome ?? c._id}
                          </option>
                        ))}
                      </select>
                    ) : sd.tipo === 'pon' ? (
                      /* PON: Placa OLT + Porta PON — sem ID */
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: '#8b949e', whiteSpace: 'nowrap' }}>Placa</span>
                        <input type="number" min={1} max={32}
                          value={sd.pon_placa ?? ''}
                          onChange={e => upSaida(s.id, sd.porta, { pon_placa: e.target.value ? +e.target.value : null })}
                          placeholder="1"
                          style={{ ...S.inp, width: 48, padding: '3px 6px', fontSize: 12 }} />
                        <span style={{ fontSize: 10, color: '#8b949e', whiteSpace: 'nowrap' }}>Porta</span>
                        <input type="number" min={1} max={16}
                          value={sd.pon_porta ?? ''}
                          onChange={e => upSaida(s.id, sd.porta, { pon_porta: e.target.value ? +e.target.value : null })}
                          placeholder="1"
                          style={{ ...S.inp, width: 48, padding: '3px 6px', fontSize: 12 }} />
                        {sd.pon_placa != null && sd.pon_porta != null && (
                          <span style={{ fontSize: 10, color: '#3fb950', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            P{sd.pon_placa}/PON{sd.pon_porta}
                          </span>
                        )}
                      </div>
                    ) : (
                      <input value={sd.cto_id ?? ''} onChange={e => upSaida(s.id, sd.porta, { cto_id: e.target.value })}
                        placeholder={mainPlaceholder}
                        style={{ ...S.inp, marginBottom: 3, padding: '3px 7px', fontSize: 12 }} />
                    )}
                    {/* Obs */}
                    <input value={sd.obs ?? ''} onChange={e => upSaida(s.id, sd.porta, { obs: e.target.value })}
                      placeholder="Obs" style={{ ...S.inp, padding: '3px 7px', fontSize: 11 }} />
                    {/* Continuação PON — CTOs que continuam a partir do nó PON */}
                    {sd.tipo === 'pon' && (
                      <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `2px solid ${ABNT[(sd.porta - 1) % 12]?.hex ?? '#374151'}44` }}>
                        {(sd.pon_continuacao ?? []).map((cRaw, ci) => {
                          const cItem   = typeof cRaw === 'string' ? { cto_id: cRaw, fibra: null } : (cRaw ?? { cto_id: '', fibra: null })
                          const fDot    = ABNT[(cItem.fibra - 1) % 12]
                          const normAll = arr => (arr ?? []).map(x => typeof x === 'string' ? { cto_id: x, fibra: null } : (x ?? { cto_id: '', fibra: null }))
                          return (
                            <div key={ci} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3, flexWrap: 'nowrap' }}>
                              <span style={{ fontSize: 9, color: ABNT[(sd.porta - 1) % 12]?.hex, flexShrink: 0 }}>↳ P{ci + 1}</span>
                              <select
                                value={cItem.cto_id ?? ''}
                                onChange={e => upSaida(s.id, sd.porta, {
                                  pon_continuacao: normAll(sd.pon_continuacao).map((it, xi) => xi === ci ? { ...it, cto_id: e.target.value } : it)
                                })}
                                style={{ ...S.inp, flex: 1, padding: '2px 6px', fontSize: 11, minWidth: 0 }}
                              >
                                <option value="">— CTO —</option>
                                {ctos.map(c => <option key={c.cto_id ?? c._id} value={c.cto_id ?? c._id}>{c.nome ?? c.cto_id}</option>)}
                              </select>
                              <select
                                value={cItem.fibra ?? ''}
                                title="Fibra para esta CTO"
                                onChange={e => upSaida(s.id, sd.porta, {
                                  pon_continuacao: normAll(sd.pon_continuacao).map((it, xi) => xi === ci ? { ...it, fibra: e.target.value ? Number(e.target.value) : null } : it)
                                })}
                                style={{ ...S.inp, width: 68, padding: '2px 4px', fontSize: 10, flexShrink: 0 }}
                              >
                                <option value="">FO</option>
                                {ABNT.map(a => <option key={a.idx} value={a.idx}>{a.idx}. {a.nome}</option>)}
                              </select>
                              {fDot && (
                                <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: fDot.hex, border: `1px solid ${fDot.hex}aa`, boxShadow: `0 0 4px ${fDot.hex}88` }} />
                              )}
                              <button
                                onClick={() => upSaida(s.id, sd.porta, { pon_continuacao: (sd.pon_continuacao ?? []).filter((_, xi) => xi !== ci) })}
                                style={{ fontSize: 11, padding: '1px 5px', cursor: 'pointer', color: '#f85149', background: 'none', border: 'none', flexShrink: 0 }}
                              >✕</button>
                            </div>
                          )
                        })}
                        <button
                          onClick={() => upSaida(s.id, sd.porta, { pon_continuacao: [...(sd.pon_continuacao ?? []), { cto_id: '', fibra: null }] })}
                          style={{ fontSize: 10, padding: '2px 8px', cursor: 'pointer', color: '#a78bfa', background: 'none', border: '1px solid #a78bfa55', borderRadius: 4 }}
                        >+ Continuar</button>
                      </div>
                    )}
                    {/* Cascata CTOs — só para tipo=cto com destino preenchido */}
                    {(sd.tipo === 'cto' || !sd.tipo) && sd.cto_id?.trim() && (
                      <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `2px solid ${ABNT[(sd.porta - 1) % 12]?.hex ?? '#374151'}44` }}>
                        {(sd.ctos_cascata ?? []).map((cRaw, ci) => {
                          const cItem = typeof cRaw === 'string' ? { cto_id: cRaw, fibra: null } : (cRaw ?? { cto_id: '', fibra: null })
                          const fDot  = ABNT[(cItem.fibra - 1) % 12]
                          const normAll = arr => (arr ?? []).map(x => typeof x === 'string' ? { cto_id: x, fibra: null } : (x ?? { cto_id: '', fibra: null }))
                          return (
                            <div key={ci} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3, flexWrap: 'nowrap' }}>
                              <span style={{ fontSize: 9, color: ABNT[(sd.porta - 1) % 12]?.hex, flexShrink: 0 }}>↳ C{ci + 1}</span>
                              {/* CTO select */}
                              <select
                                value={cItem.cto_id ?? ''}
                                onChange={e => upSaida(s.id, sd.porta, {
                                  ctos_cascata: normAll(sd.ctos_cascata).map((it, xi) => xi === ci ? { ...it, cto_id: e.target.value } : it)
                                })}
                                style={{ ...S.inp, flex: 1, padding: '2px 6px', fontSize: 11, minWidth: 0 }}
                              >
                                <option value="">— CTO —</option>
                                {ctos.map(c => <option key={c.cto_id ?? c._id} value={c.cto_id ?? c._id}>{c.nome ?? c.cto_id}</option>)}
                              </select>
                              {/* Fibra de saída */}
                              <select
                                value={cItem.fibra ?? ''}
                                title="Fibra de saída para esta CTO"
                                onChange={e => upSaida(s.id, sd.porta, {
                                  ctos_cascata: normAll(sd.ctos_cascata).map((it, xi) => xi === ci ? { ...it, fibra: e.target.value ? Number(e.target.value) : null } : it)
                                })}
                                style={{ ...S.inp, width: 68, padding: '2px 4px', fontSize: 10, flexShrink: 0 }}
                              >
                                <option value="">FO</option>
                                {ABNT.map(a => <option key={a.idx} value={a.idx}>{a.idx}. {a.nome}</option>)}
                              </select>
                              {/* Dot cor da fibra */}
                              {fDot && (
                                <span style={{
                                  width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                                  background: fDot.hex, border: `1px solid ${fDot.hex}aa`,
                                  boxShadow: `0 0 4px ${fDot.hex}88`,
                                }} />
                              )}
                              <button
                                onClick={() => upSaida(s.id, sd.porta, { ctos_cascata: (sd.ctos_cascata ?? []).filter((_, xi) => xi !== ci) })}
                                style={{ fontSize: 11, padding: '1px 5px', cursor: 'pointer', color: '#f85149', background: 'none', border: 'none', flexShrink: 0 }}
                              >✕</button>
                            </div>
                          )
                        })}
                        <button
                          onClick={() => upSaida(s.id, sd.porta, { ctos_cascata: [...(sd.ctos_cascata ?? []), { cto_id: '', fibra: null }] })}
                          style={{ fontSize: 10, padding: '2px 8px', cursor: 'pointer', color: '#58a6ff', background: 'none', border: '1px solid #58a6ff55', borderRadius: 4 }}
                        >+ Cascata</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Aba Cabos ────────────────────────────────────────────────────────────────
function AbaCabos({ cabos, onChange, isDark }) {
  const S = getStyles(isDark)
  function addCabo() {
    onChange([...(cabos ?? []), { id: uid(), nome: `Cabo ${(cabos?.length ?? 0) + 1}`, tipo: 'OPGW', fibras: 12, obs: '' }])
  }
  function remCabo(id) { onChange((cabos ?? []).filter(c => c.id !== id)) }
  function upCabo(id, p) { onChange((cabos ?? []).map(c => c.id === id ? { ...c, ...p } : c)) }

  const lista = cabos ?? []
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ color: '#8b949e', fontSize: 13 }}>Cabos de fibra entrando/saindo da caixa</p>
        <button onClick={addCabo} style={S.btnAdd}>+ Cabo</button>
      </div>
      {lista.length === 0 && (
        <div style={{ ...S.sec, textAlign: 'center', color: '#484f58', padding: '32px' }}>
          Nenhum cabo cadastrado.
        </div>
      )}
      {lista.map((c, ci) => (
        <div key={c.id} style={{ ...S.sec, borderLeft: '3px solid #8957e5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#bc8cff', minWidth: 60 }}>Cabo {ci + 1}</span>
            <input value={c.nome} onChange={e => upCabo(c.id, { nome: e.target.value })}
              placeholder="Nome" style={{ ...S.inp, flex: 1, minWidth: 100, padding: '4px 8px', fontSize: 12 }} />
            <select value={c.tipo} onChange={e => upCabo(c.id, { tipo: e.target.value })}
              style={{ ...S.inp, width: 90, padding: '4px 6px', fontSize: 12 }}>
              {['OPGW','ASU','ADSS','DROP','Interno'].map(t => <option key={t}>{t}</option>)}
            </select>
            <input type="number" min={1} max={864} value={c.fibras}
              onChange={e => upCabo(c.id, { fibras: +e.target.value })}
              style={{ ...S.inpSm, width: 56 }} title="Nº de fibras" />
            <span style={{ fontSize: 11, color: '#8b949e' }}>fibras</span>
            <input value={c.obs ?? ''} onChange={e => upCabo(c.id, { obs: e.target.value })}
              placeholder="Obs" style={{ ...S.inp, flex: 2, minWidth: 80, padding: '4px 8px', fontSize: 12 }} />
            <button onClick={() => remCabo(c.id)} style={S.btnDel}>✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Aba Resumo (legenda ABNT + estatísticas) ──────────────────────────────
function AbaResumo({ entrada, bandejas, splitters, cabos, isDark }) {
  const S = getStyles(isDark)
  const totalFusoes = bandejas.reduce((a, b) => a + b.fusoes.length, 0)
  const ligadas     = splitters.reduce((a, s) => a + s.saidas.filter(sd => sd.cto_id?.trim()).length, 0)
  const totalSaidas = splitters.reduce((a, s) => a + s.saidas.length, 0)

  return (
    <div>
      {/* Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'OLT', val: entrada.olt_id || '—', cor: '#1f6feb' },
          { label: 'Placa', val: entrada.placa ?? '—', cor: '#e3b341' },
          { label: 'PON', val: entrada.pon ?? '—', cor: '#8957e5' },
          { label: 'Porta', val: entrada.porta_olt ?? '—', cor: '#3fb950' },
          { label: 'Bandejas', val: bandejas.length, cor: '#58a6ff' },
          { label: 'Fusões', val: totalFusoes, cor: '#a5d6ff' },
          { label: 'Splitters', val: splitters.length, cor: '#e3b341' },
          { label: 'CTOs ligadas', val: `${ligadas}/${totalSaidas}`, cor: '#3fb950' },
          { label: 'PONs usadas', val: bandejas.reduce((a, b) => a + (b.fusoes ?? []).filter(f => f.tipo === 'pon').length, 0), cor: '#8957e5' },
          { label: 'Cabos', val: (cabos ?? []).length, cor: '#bc8cff' },
        ].map(it => (
          <div key={it.label} style={{ backgroundColor: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 14px', borderTop: `3px solid ${it.cor}` }}>
            <p style={{ ...S.lbl, color: '#484f58', marginBottom: 4 }}>{it.label}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: it.cor }}>{it.val}</p>
          </div>
        ))}
      </div>

      {/* Legenda ABNT */}
      <div style={S.sec}>
        <p style={{ ...S.secTitle, marginBottom: 12 }}>Legenda ABNT NBR 14721 — Cores de Fibra Óptica</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ABNT.map(c => (
            <div key={c.idx} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              backgroundColor: c.hex, border: `1px solid ${c.hex}`,
              borderRadius: 6, padding: '4px 10px',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: c.text }}>{c.idx} — {c.nome}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mapa de splitters */}
      {splitters.length > 0 && (
        <div style={S.sec}>
          <p style={{ ...S.secTitle, marginBottom: 12 }}>Mapa de Saídas dos Splitters</p>
          {splitters.map((s, si) => (
            <div key={s.id} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#e3b341', marginBottom: 6 }}>{s.nome} ({s.tipo})</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {s.saidas.map(sd => (
                  <div key={sd.porta} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 5,
                    backgroundColor: sd.cto_id?.trim() ? 'rgba(63,185,80,0.15)' : BG3,
                    border: `1px solid ${sd.cto_id?.trim() ? 'rgba(63,185,80,0.4)' : BORDER}`,
                    color: sd.cto_id?.trim() ? '#3fb950' : '#484f58',
                    fontWeight: 600,
                  }}>
                    S{sd.porta}: {sd.cto_id?.trim() || '—'}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Mobile step editor ───────────────────────────────────────────────────────

const MOBILE_STEPS = [
  { id: 'entrada', label: 'PON / Entrada', icon: '⚡', cor: '#1f6feb' },
  { id: 'bandeja', label: 'Bandeja',       icon: '🗂️', cor: '#58a6ff' },
  { id: 'splitter', label: 'Splitter',     icon: '🔀', cor: '#e3b341' },
  { id: 'saidas',  label: 'Saídas',        icon: '📡', cor: '#3fb950' },
]

function MobileCDOEditor({
  ceId, entrada, setEntrada, bandejas, setBandejas,
  splitters, setSplitters, olts, ctos = [], caixas = [], usadosGlobal, saving, salvar, sucesso, erro, isDark
}) {
  const S   = getStyles(isDark)
  const bg  = isDark ? '#0d1117' : '#c4b098'
  const bg2 = isDark ? '#161b22' : '#d0bfa8'
  const bg3 = isDark ? '#1c2333' : '#c8b094'
  const br  = isDark ? '#30363d' : '#8e7254'
  const txt = isDark ? '#e6edf3' : '#0f0701'
  const mut = isDark ? '#8b949e' : '#3d1f04'

  const [step, setStep] = useState(0)
  const curStep = MOBILE_STEPS[step]

  // ── touch-friendly styles ──
  const card = {
    backgroundColor: bg2, border: `1px solid ${br}`, borderRadius: 12,
    padding: '14px 16px', marginBottom: 10,
  }
  const bigBtn = (active, color) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
    backgroundColor: active ? color + '18' : bg3,
    border: `2px solid ${active ? color : br}`,
    width: '100%', textAlign: 'left', color: txt, fontSize: 14, fontWeight: 600,
    marginBottom: 8,
  })
  const navBtn = (disabled) => ({
    flex: 1, padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', border: 'none',
    background: disabled ? br : '#1f6feb', color: disabled ? mut : '#fff',
    opacity: disabled ? 0.5 : 1, minHeight: 52,
  })

  function uid() { return Math.random().toString(36).slice(2, 9) }

  // ── Step 1: Entrada/PON ──
  function renderEntrada() {
    const oltAtual = (olts ?? []).find(o => o.id === entrada.olt_id)
    const dioMapa  = oltAtual?.dio_config?.mapa ?? []
    const portaSel = entrada.porta_olt ?? null

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* OLT */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: mut, marginBottom: 8, letterSpacing: '0.07em' }}>
          Selecionar OLT
        </div>
        {(olts ?? []).length === 0 && (
          <div>
            <label style={{ fontSize: 12, color: mut, display: 'block', marginBottom: 4 }}>ID da OLT</label>
            <input value={entrada.olt_id} onChange={e => setEntrada({ ...entrada, olt_id: e.target.value })}
              placeholder="ex: OLT-01"
              style={{ ...S.inp, fontSize: 16, padding: '12px 14px', borderRadius: 10, marginBottom: 12 }} />
          </div>
        )}
        {(olts ?? []).map(o => {
          const ativa = entrada.olt_id === o.id
          return (
            <button key={o.id} style={bigBtn(ativa, '#1f6feb')}
              onClick={() => setEntrada({ ...entrada, olt_id: ativa ? '' : o.id, porta_olt: null, pon: null })}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: ativa ? '#58a6ff' : txt }}>{o.nome}</div>
                <div style={{ fontSize: 12, color: mut }}>{o.id} · {o.capacidade ?? 16} PONs</div>
              </div>
              {ativa && <span style={{ color: '#1f6feb', fontSize: 20 }}>✓</span>}
            </button>
          )
        })}

        {/* DIO ports */}
        {oltAtual && dioMapa.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: mut, marginBottom: 8, letterSpacing: '0.07em' }}>
              Porta DIO
            </div>
            {[...dioMapa].sort((a, b) => a.porta - b.porta).map(m => {
              const sel = portaSel === m.porta
              return (
                <button key={m.porta} style={bigBtn(sel, '#8957e5')}
                  onClick={() => setEntrada({ ...entrada, porta_olt: sel ? null : m.porta, pon: sel ? null : (m.pon ?? null) })}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 800, color: '#f97316', fontFamily: 'monospace',
                      background: 'rgba(249,115,22,0.15)', borderRadius: 6, padding: '4px 10px', flexShrink: 0
                    }}>D{m.porta}</span>
                    {m.pon != null && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: sel ? '#a78bfa' : mut }}>
                        PON {m.pon}
                      </span>
                    )}
                    <span style={{ fontSize: 13, color: sel ? txt : mut }}>{m.local || '—'}</span>
                  </div>
                  {sel && <span style={{ color: '#8957e5', fontSize: 20 }}>✓</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Resumo */}
        {entrada.olt_id && (
          <div style={{ ...card, borderColor: '#1f6feb55', background: '#1f6feb11', marginTop: 4 }}>
            <div style={{ fontSize: 12, color: mut, marginBottom: 6, fontWeight: 700 }}>Vínculo selecionado</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: '#1f6feb22', border: '1px solid #1f6feb44', borderRadius: 6, padding: '4px 10px', fontSize: 13, color: '#58a6ff', fontWeight: 700 }}>
                🖥 {entrada.olt_id}
              </span>
              {entrada.porta_olt != null && (
                <span style={{ background: '#f9731622', border: '1px solid #f9731644', borderRadius: 6, padding: '4px 10px', fontSize: 13, color: '#fb923c', fontWeight: 700 }}>
                  D{entrada.porta_olt}
                </span>
              )}
              {entrada.pon != null && (
                <span style={{ background: '#8957e522', border: '1px solid #8957e544', borderRadius: 6, padding: '4px 10px', fontSize: 13, color: '#a78bfa', fontWeight: 700 }}>
                  PON {entrada.pon}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Step 2: Bandejas ──
  function renderBandeja() {
    function addBandeja() {
      setBandejas([...bandejas, { id: uid(), nome: `Bandeja ${bandejas.length + 1}`, fusoes: [] }])
    }
    function addFusao(bId) {
      const n = bandejas.find(b => b.id === bId)?.fusoes?.length ?? 0
      const fibra = (n % 12) + 1
      setBandejas(bandejas.map(b => b.id !== bId ? b : {
        ...b, fusoes: [...b.fusoes, { id: uid(), tipo: 'pon', entrada: { fibra }, saida: { fibra }, pon_placa: null, pon_porta: null, splitter_id: null }]
      }))
    }
    function remFusao(bId, fId) {
      setBandejas(bandejas.map(b => b.id !== bId ? b : { ...b, fusoes: b.fusoes.filter(f => f.id !== fId) }))
    }
    function upFusao(bId, fId, p) {
      if (p.tipo === 'saida_cto' || p.tipo === 'saida_cdo') return
      setBandejas(bandejas.map(b => b.id !== bId ? b : {
        ...b, fusoes: b.fusoes.map(f => f.id !== fId ? f : { ...f, ...p })
      }))
    }
    function remBandeja(bId) { setBandejas(bandejas.filter(b => b.id !== bId)) }

    return (
      <div>
        {bandejas.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: mut, padding: '32px 16px' }}>
            Nenhuma bandeja. Toque em "+ Bandeja".
          </div>
        )}
        {bandejas.map((b, bi) => (
          <div key={b.id} style={{ ...card, borderLeft: '4px solid #1f6feb' }}>
            {/* Header bandeja */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#58a6ff', flex: 1 }}>🗂️ {b.nome}</span>
              <button onClick={() => remBandeja(b.id)}
                style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.4)', color: '#f85149', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                🗑️
              </button>
            </div>
            {/* Fusões */}
            {b.fusoes.map((f, fi) => {
              const entC = ABNT.find(a => a.idx === f.entrada?.fibra)
              const saiC = ABNT.find(a => a.idx === (f.saida?.fibra ?? f.entrada?.fibra))
              return (
                <div key={f.id} style={{
                  backgroundColor: bg3, borderRadius: 10, padding: '12px 14px',
                  marginBottom: 8, border: `1px solid ${br}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: mut, fontFamily: 'monospace' }}>#{fi + 1}</span>
                    {/* Entrada dot */}
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: entC?.hex ?? '#374151', display: 'inline-block', border: '2px solid #fff4' }} />
                    <span style={{ fontSize: 13, color: entC?.hex ?? mut, fontWeight: 700 }}>F{f.entrada?.fibra ?? '?'}</span>
                    <span style={{ color: br }}>→</span>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: saiC?.hex ?? '#374151', display: 'inline-block', border: '2px solid #fff4' }} />
                    <span style={{ fontSize: 13, color: saiC?.hex ?? mut, fontWeight: 700 }}>F{f.saida?.fibra ?? f.entrada?.fibra ?? '?'}</span>
                    <span style={{ flex: 1 }} />
                    <button onClick={() => remFusao(b.id, f.id)}
                      style={{ background: 'none', border: 'none', color: '#f85149', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>✕</button>
                  </div>
                  {/* Seletores FO */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: mut, display: 'block', marginBottom: 3 }}>FO Entrada</label>
                      <select value={f.entrada?.fibra ?? 1}
                        onChange={e => upFusao(b.id, f.id, { entrada: { ...f.entrada, fibra: +e.target.value } })}
                        style={{ width: '100%', padding: '10px 8px', fontSize: 14, borderRadius: 8, border: `1px solid ${br}`, backgroundColor: entC?.hex ?? bg3, color: entC?.text ?? txt, fontWeight: 700, cursor: 'pointer' }}>
                        {ABNT.map(c => <option key={c.idx} value={c.idx} style={{ backgroundColor: c.hex, color: c.text }}>F{c.idx} {c.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: mut, display: 'block', marginBottom: 3 }}>FO Saída</label>
                      <select value={f.saida?.fibra ?? f.entrada?.fibra ?? 1}
                        onChange={e => upFusao(b.id, f.id, { saida: { ...f.saida, fibra: +e.target.value } })}
                        style={{ width: '100%', padding: '10px 8px', fontSize: 14, borderRadius: 8, border: `1px solid ${br}`, backgroundColor: saiC?.hex ?? bg3, color: saiC?.text ?? txt, fontWeight: 700, cursor: 'pointer' }}>
                        {ABNT.map(c => <option key={c.idx} value={c.idx} style={{ backgroundColor: c.hex, color: c.text }}>F{c.idx} {c.nome}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Vinculo splitter para tipo pon */}
                  {f.tipo === 'pon' && (
                    <div>
                      <label style={{ fontSize: 11, color: mut, display: 'block', marginBottom: 3 }}>Splitter vinculado</label>
                      <select value={f.splitter_id ?? ''}
                        onChange={e => upFusao(b.id, f.id, { splitter_id: e.target.value || null })}
                        style={{ ...S.inp, padding: '10px 8px', fontSize: 14, borderRadius: 8, borderColor: f.splitter_id ? '#e3b341' : '#f85149' }}>
                        <option value="">— selecionar splitter *</option>
                        {splitters.map((s, si) => <option key={s.id} value={s.id}>{s.nome || `SPL ${si + 1}`} ({s.tipo})</option>)}
                      </select>
                      {!f.splitter_id && <div style={{ fontSize: 11, color: '#f85149', marginTop: 3 }}>⚠ Vincule a um splitter</div>}
                    </div>
                  )}
                </div>
              )
            })}
            <button onClick={() => addFusao(b.id)}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: '2px dashed #1f6feb88', background: 'rgba(31,111,235,0.06)', color: '#58a6ff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              + Fusão
            </button>
          </div>
        ))}
        <button onClick={addBandeja}
          style={{ width: '100%', padding: '16px', borderRadius: 10, border: '2px dashed #58a6ff88', background: 'rgba(88,166,255,0.06)', color: '#58a6ff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
          + Bandeja
        </button>
      </div>
    )
  }

  // ── Step 3: Splitters ──
  function renderSplitter() {
    function addSplitter() {
      const saidas = Array.from({ length: 8 }, (_, i) => ({ porta: i + 1, tipo: 'cto', cto_id: '', obs: '' }))
      setSplitters([...splitters, { id: uid(), nome: `Splitter ${splitters.length + 1}`, tipo: '1x8', entrada: { tubo: 1, fibra: 1 }, saidas }])
    }
    function remSplitter(id) { setSplitters(splitters.filter(s => s.id !== id)) }
    function upSplitter(id, p) { setSplitters(splitters.map(s => s.id === id ? { ...s, ...p } : s)) }
    function changeTipo(id, tipo) {
      const qtd = parseInt(tipo.split('x')[1])
      upSplitter(id, { tipo, saidas: Array.from({ length: qtd }, (_, i) => ({ porta: i + 1, tipo: 'cto', cto_id: '', obs: '' })) })
    }

    const linkedFusaoMap = new Map(
      bandejas.flatMap(b => b.fusoes ?? []).filter(f => f.splitter_id).map(f => [f.splitter_id, f])
    )

    return (
      <div>
        {splitters.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: mut, padding: '32px 16px' }}>
            Nenhum splitter. Toque em "+ Splitter".
          </div>
        )}
        {splitters.map((s, si) => {
          const ligadas = s.saidas.filter(sd => sd.cto_id?.trim()).length
          const entC = ABNT.find(a => a.idx === s.entrada.fibra)
          const linked = linkedFusaoMap.get(s.id)
          return (
            <div key={s.id} style={{ ...card, borderLeft: `4px solid ${linked ? '#e3b341' : br}` }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e3b341', flex: 1 }}>🔀 {s.nome}</span>
                <button onClick={() => remSplitter(s.id)}
                  style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.4)', color: '#f85149', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                  🗑️
                </button>
              </div>
              {/* Vínculo com bandeja */}
              {linked ? (
                <div style={{ background: 'rgba(139,87,229,0.1)', border: '1px solid rgba(139,87,229,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#a78bfa' }}>
                  ↳ PON: Placa {linked.pon_placa ?? '?'} / Porta {linked.pon_porta ?? '?'} · FO {linked.entrada?.fibra ?? '?'}
                </div>
              ) : (
                <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#f85149' }}>
                  ⚠ Sem bandeja vinculada — crie uma fusão PON na Bandeja.
                </div>
              )}
              {/* Nome */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: mut, display: 'block', marginBottom: 4 }}>Nome</label>
                <input value={s.nome} onChange={e => upSplitter(s.id, { nome: e.target.value })}
                  style={{ ...S.inp, fontSize: 15, padding: '10px 12px', borderRadius: 10 }} />
              </div>
              {/* Tipo + FO entrada */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 12, color: mut, display: 'block', marginBottom: 4 }}>Tipo</label>
                  <select value={s.tipo} onChange={e => changeTipo(s.id, e.target.value)}
                    style={{ ...S.inp, fontSize: 15, padding: '10px 8px', borderRadius: 10 }}>
                    {['1x2','1x4','1x8','1x16','1x32'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: mut, display: 'block', marginBottom: 4 }}>FO Entrada</label>
                  <select value={s.entrada.fibra}
                    onChange={e => upSplitter(s.id, { entrada: { ...s.entrada, fibra: +e.target.value } })}
                    style={{ width: '100%', padding: '10px 8px', fontSize: 14, borderRadius: 10, border: `1px solid ${br}`, backgroundColor: entC?.hex ?? bg3, color: entC?.text ?? txt, fontWeight: 700, cursor: 'pointer' }}>
                    {ABNT.map(c => <option key={c.idx} value={c.idx} style={{ backgroundColor: c.hex, color: c.text }}>F{c.idx} {c.nome}</option>)}
                  </select>
                </div>
              </div>
              {/* Status */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ background: '#e3b34122', border: '1px solid #e3b34144', borderRadius: 20, padding: '4px 10px', fontSize: 12, color: '#e3b341', fontWeight: 700 }}>
                  {s.tipo}
                </span>
                <span style={{ background: '#3fb95022', border: '1px solid #3fb95044', borderRadius: 20, padding: '4px 10px', fontSize: 12, color: '#3fb950', fontWeight: 700 }}>
                  {ligadas}/{s.saidas.length} CTOs
                </span>
              </div>
            </div>
          )
        })}
        <button onClick={addSplitter}
          style={{ width: '100%', padding: '16px', borderRadius: 10, border: '2px dashed #e3b34188', background: 'rgba(227,179,65,0.06)', color: '#e3b341', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
          + Splitter
        </button>
      </div>
    )
  }

  // ── Step 4: Saídas ──
  function renderSaidas() {
    function upSaida(sId, porta, p) {
      setSplitters(splitters.map(s => s.id !== sId ? s : {
        ...s, saidas: s.saidas.map(sd => sd.porta === porta ? { ...sd, ...p } : sd)
      }))
    }

    if (splitters.length === 0) {
      return (
        <div style={{ ...card, textAlign: 'center', color: mut, padding: '32px 16px' }}>
          Nenhum splitter configurado. Volte ao passo anterior.
        </div>
      )
    }

    return (
      <div>
        {splitters.map((s, si) => {
          const ligadas = s.saidas.filter(sd => sd.cto_id?.trim()).length
          return (
            <div key={s.id} style={{ ...card, borderLeft: '4px solid #3fb950' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e3b341', flex: 1 }}>🔀 {s.nome} ({s.tipo})</span>
                <span style={{ fontSize: 12, color: ligadas > 0 ? '#3fb950' : mut, fontWeight: 700 }}>
                  {ligadas}/{s.saidas.length}
                </span>
              </div>
              {/* Barra de ocupação */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
                {s.saidas.map((sd, idx) => {
                  const p = sd.porta ?? (idx + 1)
                  const hex = ABNT[(p - 1) % 12]?.hex ?? '#374151'
                  return (
                    <div key={p} style={{ flex: 1, height: 8, borderRadius: 4,
                      background: sd.cto_id?.trim() ? hex : br,
                      boxShadow: sd.cto_id?.trim() ? `0 0 4px ${hex}66` : 'none' }} />
                  )
                })}
              </div>
              {/* Saídas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {s.saidas.map((sd, idx) => {
                  const porta   = sd.porta ?? (idx + 1)
                  const tipo    = sd.tipo ?? 'cto'
                  const hex     = ABNT[(porta - 1) % 12]?.hex ?? '#374151'
                  const hasLink = !!(
                    sd.cto_id?.trim() ||
                    (tipo === 'pon' && sd.pon_placa != null && sd.pon_porta != null) ||
                    tipo === 'passagem' || tipo === 'conector'
                  )
                  return (
                    <div key={porta} style={{
                      padding: '10px 12px', borderRadius: 10,
                      backgroundColor: hasLink ? hex + '14' : bg3,
                      border: `2px solid ${hasLink ? hex + '66' : br}`,
                    }}>
                      {/* Porta + tipo selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', background: hex, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 5px ${hex}88` }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: hex, minWidth: 28 }}>S{porta}</span>
                        <select
                          value={tipo}
                          onChange={e => upSaida(s.id, porta, { tipo: e.target.value, cto_id: '' })}
                          style={{ flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: 8, border: `1px solid ${hex}66`, backgroundColor: bg, color: txt, fontWeight: 600, outline: 'none' }}
                        >
                          <option value="cto">CTO</option>
                          <option value="pon">PON</option>
                          <option value="cdo">CE/CDO</option>
                          <option value="passagem">Continuidade/FO</option>
                          <option value="conector">Conector</option>
                          <option value="fusao_bandeja">Fusão Bandeja</option>
                        </select>
                        {hasLink && <span style={{ fontSize: 16, color: '#3fb950', flexShrink: 0 }}>✓</span>}
                      </div>
                      {/* Destino */}
                      <div style={{ gap: 8, width: '100%' }}>
                        {tipo === 'cto' ? (
                          <select
                            value={sd.cto_id ?? ''}
                            onChange={e => upSaida(s.id, porta, { cto_id: e.target.value })}
                            style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 8, border: `1px solid ${sd.cto_id?.trim() ? hex + '88' : br}`, backgroundColor: bg, color: txt, outline: 'none' }}
                          >
                            <option value="">— Selecione CTO —</option>
                            {ctos.map(c => (
                              <option key={c.cto_id ?? c._id} value={c.cto_id ?? c._id}>
                                {c.nome ?? c.cto_id ?? c._id}
                              </option>
                            ))}
                          </select>
                        ) : tipo === 'cdo' ? (
                          <select
                            value={sd.cto_id ?? ''}
                            onChange={e => upSaida(s.id, porta, { cto_id: e.target.value })}
                            style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 8, border: `1px solid ${sd.cto_id?.trim() ? hex + '88' : br}`, backgroundColor: bg, color: txt, outline: 'none' }}
                          >
                            <option value="">— Selecione CE/CDO —</option>
                            {caixas.map(c => (
                              <option key={c._id} value={c._id}>
                                {c.nome ?? c._id}
                              </option>
                            ))}
                          </select>
                        ) : tipo === 'pon' ? (
                          /* PON: Placa OLT + Porta PON */
                          <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: mut, marginBottom: 4 }}>Placa OLT</div>
                              <input
                                type="number" min={1} max={32}
                                value={sd.pon_placa ?? ''}
                                onChange={e => upSaida(s.id, porta, { pon_placa: e.target.value ? +e.target.value : null })}
                                placeholder="Ex: 1"
                                style={{ width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: `1px solid ${sd.pon_placa != null ? hex + '88' : br}`, backgroundColor: bg, color: txt, outline: 'none', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: mut, marginBottom: 4 }}>Porta PON</div>
                              <input
                                type="number" min={1} max={16}
                                value={sd.pon_porta ?? ''}
                                onChange={e => upSaida(s.id, porta, { pon_porta: e.target.value ? +e.target.value : null })}
                                placeholder="Ex: 1"
                                style={{ width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: `1px solid ${sd.pon_porta != null ? hex + '88' : br}`, backgroundColor: bg, color: txt, outline: 'none', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        ) : tipo === 'passagem' ? (
                          <div style={{ padding: '10px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${hex}44`, backgroundColor: hex + '0a', color: txt }}>
                            Continuidade da fibra — sem emenda
                          </div>
                        ) : tipo === 'conector' ? (
                          /* Conector: etiqueta do ponto físico */
                          <div>
                            <div style={{ fontSize: 11, color: mut, marginBottom: 4 }}>Etiqueta / ponto físico</div>
                            <input
                              value={sd.obs ?? ''}
                              onChange={e => upSaida(s.id, porta, { obs: e.target.value })}
                              placeholder="Ex: A1, Rack-B3..."
                              style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: `1px solid ${sd.obs?.trim() ? hex + '88' : br}`, backgroundColor: bg, color: txt, outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                        ) : (
                          <input
                            value={sd.cto_id ?? ''}
                            onChange={e => upSaida(s.id, porta, { cto_id: e.target.value })}
                            placeholder="ID Bandeja"
                            style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 8, border: `1px solid ${sd.cto_id?.trim() ? hex + '88' : br}`, backgroundColor: bg, color: txt, outline: 'none' }}
                          />
                        )}
                      </div>
                      {/* Obs — não exibir para conector (já usa obs como etiqueta) */}
                      {tipo !== 'conector' && (
                        <input
                          value={sd.obs ?? ''}
                          onChange={e => upSaida(s.id, porta, { obs: e.target.value })}
                          placeholder="Observação"
                          style={{ width: '100%', marginTop: 6, padding: '6px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${br}`, backgroundColor: bg, color: txt, outline: 'none', boxSizing: 'border-box' }}
                        />
                      )}
                      {/* Cascata CTOs — mobile */}
                      {(sd.tipo === 'cto' || !sd.tipo) && sd.cto_id?.trim() && (
                        <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${hex}44` }}>
                          {(sd.ctos_cascata ?? []).map((cRaw, ci) => {
                            const cItem = typeof cRaw === 'string' ? { cto_id: cRaw, fibra: null } : (cRaw ?? { cto_id: '', fibra: null })
                            const fDot  = ABNT[(cItem.fibra - 1) % 12]
                            const normAll = arr => (arr ?? []).map(x => typeof x === 'string' ? { cto_id: x, fibra: null } : (x ?? { cto_id: '', fibra: null }))
                            return (
                              <div key={ci} style={{ marginBottom: 8 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontSize: 11, color: hex, flexShrink: 0, fontWeight: 700 }}>↳ C{ci + 1}</span>
                                  {/* CTO select */}
                                  <select
                                    value={cItem.cto_id ?? ''}
                                    onChange={e => upSaida(s.id, porta, {
                                      ctos_cascata: normAll(sd.ctos_cascata).map((it, xi) => xi === ci ? { ...it, cto_id: e.target.value } : it)
                                    })}
                                    style={{ flex: 1, padding: '8px 10px', fontSize: 13, borderRadius: 8, border: `1px solid ${cItem.cto_id ? hex + '88' : br}`, backgroundColor: bg, color: txt, outline: 'none' }}
                                  >
                                    <option value="">— CTO —</option>
                                    {(ctos ?? []).map(c => <option key={c.cto_id ?? c._id} value={c.cto_id ?? c._id}>{c.nome ?? c.cto_id}</option>)}
                                  </select>
                                  <button
                                    onClick={() => upSaida(s.id, porta, { ctos_cascata: (sd.ctos_cascata ?? []).filter((_, xi) => xi !== ci) })}
                                    style={{ fontSize: 16, padding: '4px 8px', cursor: 'pointer', color: '#f85149', background: 'none', border: 'none', borderRadius: 6, flexShrink: 0 }}
                                  >✕</button>
                                </div>
                                {/* Fibra de saída — linha separada no mobile */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 26 }}>
                                  <span style={{ fontSize: 11, color: '#8b949e', flexShrink: 0 }}>Fibra saída:</span>
                                  <select
                                    value={cItem.fibra ?? ''}
                                    title="Fibra de saída para esta CTO"
                                    onChange={e => upSaida(s.id, porta, {
                                      ctos_cascata: normAll(sd.ctos_cascata).map((it, xi) => xi === ci ? { ...it, fibra: e.target.value ? Number(e.target.value) : null } : it)
                                    })}
                                    style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fDot ? fDot.hex + '88' : br}`, backgroundColor: bg, color: txt, outline: 'none' }}
                                  >
                                    <option value="">— Selecionar FO —</option>
                                    {ABNT.map(a => <option key={a.idx} value={a.idx}>{a.idx}. {a.nome}</option>)}
                                  </select>
                                  {fDot && (
                                    <span style={{
                                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                                      background: fDot.hex, border: `2px solid ${fDot.hex}aa`,
                                      boxShadow: `0 0 6px ${fDot.hex}88`,
                                    }} />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          <button
                            onClick={() => upSaida(s.id, porta, { ctos_cascata: [...(sd.ctos_cascata ?? []), { cto_id: '', fibra: null }] })}
                            style={{ width: '100%', padding: '8px', marginTop: 4, fontSize: 13, cursor: 'pointer', color: '#58a6ff', background: '#58a6ff11', border: '1px solid #58a6ff44', borderRadius: 8, fontWeight: 600 }}
                          >+ Adicionar CTO em Cascata</button>
                        </div>
                      )}
                      {/* Continuação PON — CTOs a partir do nó PON */}
                      {tipo === 'pon' && (
                        <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${hex}44` }}>
                          {(sd.pon_continuacao ?? []).map((cRaw, ci) => {
                            const cItem   = typeof cRaw === 'string' ? { cto_id: cRaw, fibra: null } : (cRaw ?? { cto_id: '', fibra: null })
                            const fDot    = ABNT[(cItem.fibra - 1) % 12]
                            const normAll = arr => (arr ?? []).map(x => typeof x === 'string' ? { cto_id: x, fibra: null } : (x ?? { cto_id: '', fibra: null }))
                            return (
                              <div key={ci} style={{ marginBottom: 8 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontSize: 11, color: '#a78bfa', flexShrink: 0, fontWeight: 700 }}>↳ P{ci + 1}</span>
                                  <select
                                    value={cItem.cto_id ?? ''}
                                    onChange={e => upSaida(s.id, porta, {
                                      pon_continuacao: normAll(sd.pon_continuacao).map((it, xi) => xi === ci ? { ...it, cto_id: e.target.value } : it)
                                    })}
                                    style={{ flex: 1, padding: '8px 10px', fontSize: 13, borderRadius: 8, border: `1px solid ${cItem.cto_id ? '#a78bfa88' : br}`, backgroundColor: bg, color: txt, outline: 'none' }}
                                  >
                                    <option value="">— CTO —</option>
                                    {(ctos ?? []).map(c => <option key={c.cto_id ?? c._id} value={c.cto_id ?? c._id}>{c.nome ?? c.cto_id}</option>)}
                                  </select>
                                  <button
                                    onClick={() => upSaida(s.id, porta, { pon_continuacao: (sd.pon_continuacao ?? []).filter((_, xi) => xi !== ci) })}
                                    style={{ fontSize: 16, padding: '4px 8px', cursor: 'pointer', color: '#f85149', background: 'none', border: 'none', borderRadius: 6, flexShrink: 0 }}
                                  >✕</button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 26 }}>
                                  <span style={{ fontSize: 11, color: '#8b949e', flexShrink: 0 }}>Fibra:</span>
                                  <select
                                    value={cItem.fibra ?? ''}
                                    onChange={e => upSaida(s.id, porta, {
                                      pon_continuacao: normAll(sd.pon_continuacao).map((it, xi) => xi === ci ? { ...it, fibra: e.target.value ? Number(e.target.value) : null } : it)
                                    })}
                                    style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fDot ? fDot.hex + '88' : br}`, backgroundColor: bg, color: txt, outline: 'none' }}
                                  >
                                    <option value="">— FO —</option>
                                    {ABNT.map(a => <option key={a.idx} value={a.idx}>{a.idx}. {a.nome}</option>)}
                                  </select>
                                  {fDot && (
                                    <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, background: fDot.hex, border: `2px solid ${fDot.hex}aa`, boxShadow: `0 0 6px ${fDot.hex}88` }} />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          <button
                            onClick={() => upSaida(s.id, porta, { pon_continuacao: [...(sd.pon_continuacao ?? []), { cto_id: '', fibra: null }] })}
                            style={{ width: '100%', padding: '8px', marginTop: 4, fontSize: 13, cursor: 'pointer', color: '#a78bfa', background: '#a78bfa11', border: '1px solid #a78bfa44', borderRadius: 8, fontWeight: 600 }}
                          >+ Continuar CTO via PON</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: bg, color: txt, minHeight: '100%', display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${br}`, backgroundColor: bg2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: txt }}>{ceId}</div>
          <div style={{ fontSize: 11, color: mut }}>{bandejas.length} bandeja · {splitters.length} splitter</div>
        </div>
        <button onClick={salvar} disabled={saving}
          style={{ background: 'linear-gradient(135deg,#1f6feb,#1158c7)', color: '#fff', fontWeight: 700, fontSize: 13,
            borderRadius: 10, padding: '10px 20px', cursor: saving ? 'not-allowed' : 'pointer', border: 'none',
            opacity: saving ? 0.6 : 1, minHeight: 44 }}>
          {saving ? '...' : '💾 Salvar'}
        </button>
      </div>

      {/* Mensagens */}
      {(sucesso || erro) && (
        <div style={{ padding: '10px 16px', backgroundColor: sucesso ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
          borderBottom: `1px solid ${sucesso ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
          fontSize: 13, color: sucesso ? '#3fb950' : '#f85149', flexShrink: 0 }}>
          {sucesso || erro}
        </div>
      )}

      {/* Step indicator */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${br}`, backgroundColor: bg2, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {MOBILE_STEPS.map((s, i) => {
            const active = i === step
            const done   = i < step
            return (
              <button key={s.id} onClick={() => setStep(i)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                backgroundColor: active ? s.cor + '22' : done ? '#3fb95011' : bg3,
                borderTop: `3px solid ${active ? s.cor : done ? '#3fb950' : br}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
                <span style={{ fontSize: 16 }}>{done && !active ? '✓' : s.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: active ? s.cor : done ? '#3fb950' : mut,
                  textAlign: 'center', lineHeight: 1.2 }}>{s.label.split(' ').slice(0, 2).join(' ')}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: curStep.cor, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{curStep.icon}</span>
          <span>Passo {step + 1}: {curStep.label}</span>
        </div>
        {step === 0 && renderEntrada()}
        {step === 1 && renderBandeja()}
        {step === 2 && renderSplitter()}
        {step === 3 && renderSaidas()}
      </div>

      {/* Nav buttons */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 24px', borderTop: `1px solid ${br}`,
        backgroundColor: bg2, flexShrink: 0 }}>
        <button onClick={() => setStep(s => Math.max(0, s - 1))} style={navBtn(step === 0)}>
          ← Anterior
        </button>
        {step < MOBILE_STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} style={navBtn(false)}>
            Próximo →
          </button>
        ) : (
          <button
            onClick={salvar}
            disabled={saving}
            style={{
              ...navBtn(false),
              background: saving ? br : 'linear-gradient(135deg,#16a34a,#15803d)',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Salvando…' : '✓ Finalizar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
const TABS = [
  { id: 'olt',       label: 'PON/OLT',   cor: '#1f6feb' },
  { id: 'bandejas',  label: 'Bandejas',  cor: '#58a6ff' },
  { id: 'splitters', label: 'Splitters', cor: '#e3b341' },
  { id: 'cabos',     label: 'Cabos',     cor: '#8957e5' },
  { id: 'resumo',    label: 'Resumo',    cor: '#3fb950' },
]

export default function DiagramaCDOEditor({ ceId, projetoId, capacidadeSaidas, initialDiagrama, olts, ctos = [], caixas = [] }) {
  useFiberColors() // subscreve ao contexto — re-renderiza ao mudar cores
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const isMobile = useMobile()
  const S = getStyles(isDark)

  const [aba, setAba]           = useState('bandejas')
  const [carregando, setCarregando] = useState(!initialDiagrama)
  const [saving, setSaving]     = useState(false)
  const [sucesso, setSucesso]   = useState(null)
  const [erro, setErro]         = useState(null)

  const [entrada, setEntrada]         = useState({ olt_id: '', pon: null, porta_olt: null, placa: null, dio_config: { total: 48, mapa: [], placas: [] } })
  const [bandejas, setBandejas]       = useState([])
  const [splitters, setSplitters]     = useState([])
  const [cabos, setCabos]             = useState([])
  const [usadosGlobal, setUsadosGlobal] = useState({ pons: new Set(), dios: new Set() })

  function aplicarDiagrama(d) {
    if (!d) return
    setEntrada({
      olt_id:     d.entrada?.olt_id ?? '',
      pon:        d.entrada?.pon ?? null,
      porta_olt:  d.entrada?.porta_olt ?? null,
      placa:      d.entrada?.placa ?? null,
      dio_config: {
        total: d.entrada?.dio_config?.total ?? 48,
        mapa:  d.entrada?.dio_config?.mapa  ?? [],
        // compatibilidade legado
        placas: d.entrada?.dio_config?.placas ?? [],
      },
    })
    setBandejas(d.bandejas   ?? [])
    setSplitters(d.splitters ?? [])
    setCabos(d.cabos         ?? [])
  }

  useEffect(() => {
    let cancelado = false
    if (initialDiagrama) {
      aplicarDiagrama(initialDiagrama)
      setCarregando(false)
    } else {
      getDiagramaCaixa(ceId, projetoId)
        .then(res => { if (!cancelado && res?.diagrama) aplicarDiagrama(res.diagrama) })
        .catch(e  => { if (!cancelado) setErro('Erro ao carregar: ' + e.message) })
        .finally(() => { if (!cancelado) setCarregando(false) })
    }
    // Carrega uso global de PON e DIO de todas as outras caixas do projeto
    getUsadosProjeto(ceId, projetoId)
      .then(res => { if (!cancelado) setUsadosGlobal({ pons: new Set(res.pons), dios: new Set(res.dios) }) })
      .catch(() => {}) // não-crítico
    return () => { cancelado = true }
  }, [ceId, projetoId, initialDiagrama])

  async function salvar() {
    if (saving) return
    setErro(null); setSucesso(null)

    // Validação: duplicidade local e global de PON e DIO
    const ponCheck = new Set([...(usadosGlobal?.pons ?? [])])
    const dioCheck = new Set([...(usadosGlobal?.dios ?? [])])
    const errosValidacao = []
    bandejas.forEach(b => (b.fusoes ?? []).forEach(f => {
      if (f.tipo === 'pon' && f.pon_placa != null && f.pon_porta != null) {
        const pk = `${f.pon_placa}-${f.pon_porta}`
        if (ponCheck.has(pk)) errosValidacao.push(`PON Placa ${f.pon_placa} / Porta ${f.pon_porta} já está em uso no projeto`)
        else ponCheck.add(pk)
      }
      if (f.porta_dio != null) {
        const dk = Number(f.porta_dio)
        if (dioCheck.has(dk)) errosValidacao.push(`Porta DIO ${dk} já está em uso no projeto`)
        else dioCheck.add(dk)
      }
    }))
    if (errosValidacao.length > 0) { setErro(errosValidacao[0]); return }

    setSaving(true)
    try {
      const res = await saveDiagramaCaixa({ ce_id: ceId, projeto_id: projetoId, diagrama: { entrada, bandejas, splitters, cabos } })
      setSucesso(res?.saved ? 'Diagrama salvo!' : 'Salvo (sem alterações).')
      setTimeout(() => setSucesso(null), 4000)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fiberops:topologia-changed'))
    } catch (e) {
      setErro('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const totalFusoes  = bandejas.reduce((a, b) => a + b.fusoes.length, 0)
  const totalLigadas = splitters.reduce((a, s) => a + s.saidas.filter(sd => sd.cto_id?.trim()).length, 0)
  const totalSaidas  = splitters.reduce((a, s) => a + s.saidas.length, 0)

  if (carregando) {
    return <div style={{ ...S.wrap, padding: 24 }}><p style={{ color: '#484f58' }}>Carregando diagrama...</p></div>
  }

  if (isMobile) {
    return (
      <MobileCDOEditor
        ceId={ceId}
        entrada={entrada}
        setEntrada={setEntrada}
        bandejas={bandejas}
        setBandejas={setBandejas}
        splitters={splitters}
        setSplitters={setSplitters}
        olts={olts}
        ctos={ctos}
        caixas={caixas}
        usadosGlobal={usadosGlobal}
        saving={saving}
        salvar={salvar}
        sucesso={sucesso}
        erro={erro}
        isDark={isDark}
      />
    )
  }

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3', margin: 0 }}>
            {ceId} — Diagrama ABNT
          </p>
          <p style={{ fontSize: 12, color: '#8b949e', margin: '3px 0 0' }}>
            CDO · {bandejas.length} bandeja(s) · {splitters.length} splitter(s)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {sucesso && <span style={{ fontSize: 12, color: '#3fb950' }}>{sucesso}</span>}
          {erro    && <span style={{ fontSize: 12, color: '#f85149' }}>{erro}</span>}
          <button onClick={salvar} disabled={saving} style={{ ...S.btnSave, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setAba(t.id)} style={S.tabBtn(aba === t.id, t.cor)}>
            {t.label}
            {t.id === 'bandejas'  && bandejas.length   > 0 && <span style={{ marginLeft: 5, fontSize: 10, backgroundColor: `${t.cor}22`, borderRadius: 4, padding: '1px 5px', color: t.cor }}>{bandejas.length}</span>}
            {t.id === 'splitters' && splitters.length  > 0 && <span style={{ marginLeft: 5, fontSize: 10, backgroundColor: `${t.cor}22`, borderRadius: 4, padding: '1px 5px', color: t.cor }}>{splitters.length}</span>}
            {t.id === 'cabos'     && (cabos ?? []).length > 0 && <span style={{ marginLeft: 5, fontSize: 10, backgroundColor: `${t.cor}22`, borderRadius: 4, padding: '1px 5px', color: t.cor }}>{(cabos ?? []).length}</span>}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={S.body}>
        {aba === 'olt'       && <AbaOLT       entrada={entrada}     onChange={setEntrada} olts={olts} splitters={splitters} bandejas={bandejas} isDark={isDark} />}
        {aba === 'bandejas'  && <AbaBandejas  bandejas={bandejas}   onChange={setBandejas} entrada={entrada} splitters={splitters} onChangeSplitters={setSplitters} usadosGlobal={usadosGlobal} isDark={isDark} />}
        {aba === 'splitters' && <AbaSplitters splitters={splitters} onChange={setSplitters} bandejas={bandejas} isDark={isDark} ctos={ctos} caixas={caixas} />}
        {aba === 'cabos'     && <AbaCabos     cabos={cabos}         onChange={setCabos}     isDark={isDark} />}
        {aba === 'resumo'    && <AbaResumo    entrada={entrada} bandejas={bandejas} splitters={splitters} cabos={cabos} isDark={isDark} />}
      </div>
    </div>
  )
}
