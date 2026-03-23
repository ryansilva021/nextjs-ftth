'use client'

/**
 * DiagramaCDOEditor.js
 * Editor ABNT para CE/CDO com abas: PON/OLT | Bandejas | Splitters | Cabos | Resumo
 */

import { useState, useEffect } from 'react'
import { getDiagramaCaixa, saveDiagramaCaixa, getUsadosProjeto } from '@/actions/caixas'
import { useTheme } from '@/contexts/ThemeContext'

// ─── ABNT NBR 14721 ───────────────────────────────────────────────────────────
const ABNT = [
  { idx: 1,  nome: 'Verde',    hex: '#15803d', text: '#dcfce7' },
  { idx: 2,  nome: 'Amarelo',  hex: '#a16207', text: '#fef9c3' },
  { idx: 3,  nome: 'Branco',   hex: '#475569', text: '#f1f5f9' },
  { idx: 4,  nome: 'Azul',     hex: '#1d4ed8', text: '#dbeafe' },
  { idx: 5,  nome: 'Vermelho', hex: '#b91c1c', text: '#fee2e2' },
  { idx: 6,  nome: 'Violeta',  hex: '#6d28d9', text: '#ede9fe' },
  { idx: 7,  nome: 'Marrom',   hex: '#78350f', text: '#fef3c7' },
  { idx: 8,  nome: 'Rosa',     hex: '#9d174d', text: '#fce7f3' },
  { idx: 9,  nome: 'Preto',    hex: '#1e293b', text: '#cbd5e1' },
  { idx: 10, nome: 'Cinza',    hex: '#374151', text: '#e5e7eb' },
  { idx: 11, nome: 'Laranja',  hex: '#c2410c', text: '#ffedd5' },
  { idx: 12, nome: 'Ciano',    hex: '#0e7490', text: '#cffafe' },
]

const SPLITTER_TIPOS = ['1x2', '1x4', '1x8', '1x16', '1x32']
function uid() { return Math.random().toString(36).slice(2, 9) }

// ─── Estilos base ─────────────────────────────────────────────────────────────
// Dark-mode constants kept at module scope so sub-component inline JSX references remain valid.
const BG   = '#0d1117'
const BG2  = '#161b22'
const BG3  = '#1c2333'
const BORDER = '#30363d'

function getStyles(isDark) {
  const bg   = isDark ? '#0d1117' : '#ffffff'
  const bg2  = isDark ? '#161b22' : '#f8fafc'
  const bg3  = isDark ? '#1c2333' : '#f1f5f9'
  const br   = isDark ? '#30363d' : '#e2e8f0'
  const text = isDark ? '#e6edf3' : '#1e293b'
  const muted = isDark ? '#8b949e' : '#64748b'
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

// Module-level S (dark defaults) used by sub-components that cannot access theme context.
const S = getStyles(true)

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
    upBandeja(bId, { fusoes: [...b.fusoes, { id: uid(), entrada: { tubo: 1, fibra: 1 }, saida: { tubo: 1, fibra: 1 }, tipo: 'fusao', obs: '', destino_id: '' }] })
  }
  function remFusao(bId, fId) {
    upBandeja(bId, { fusoes: bandejas.find(b => b.id === bId).fusoes.filter(f => f.id !== fId) })
  }
  function upFusao(bId, fId, p) {
    const b = bandejas.find(b => b.id === bId)
    const currentF = b.fusoes.find(f => f.id === fId)
    const updated = { ...currentF, ...p }
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

      {bandejas.map((b, bi) => (
        <div key={b.id} style={{ ...S.sec, borderLeft: '3px solid #1f6feb' }}>
          {/* Header bandeja */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: b.fusoes.length ? 14 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#58a6ff' }}>🗂️ Bandeja {bi + 1}</span>
            <input value={b.nome} onChange={e => upBandeja(b.id, { nome: e.target.value })}
              style={{ ...S.inp, flex: 1, padding: '4px 8px', fontSize: 12, height: 28 }} />
            <button onClick={() => addFusao(b.id)} style={{ ...S.btnAdd, whiteSpace: 'nowrap' }}>+ Fusão</button>
            <button onClick={() => remBandeja(b.id)} style={S.btnDel}>🗑️</button>
          </div>

          {b.fusoes.length > 0 && (
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
                          <select value={f.tipo} onChange={e => upFusao(b.id, f.id, { tipo: e.target.value, destino_id: '' })}
                            style={{ ...S.inp, padding: '4px 4px', width: 90, fontSize: 11,
                              borderColor: f.tipo === 'saida_cto' ? '#3fb950' : f.tipo === 'saida_cdo' ? '#8957e5' : BORDER }}>
                            <option value="fusao">Fusão</option>
                            <option value="pon">PON</option>
                            <option value="conector">Conector</option>
                            <option value="passthrough">Passagem</option>
                            <option value="saida_cto">→ CTO</option>
                            <option value="saida_cdo">→ CDO/CEO</option>
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
                              <select value={f.splitter_id ?? ''} onChange={e => {
                                const sid = e.target.value || null
                                upFusao(b.id, f.id, { splitter_id: sid })
                                if (sid && onChangeSplitters && splitters) {
                                  onChangeSplitters(splitters.map(s => s.id === sid ? {
                                    ...s,
                                    entrada: { ...s.entrada, fibra: f.entrada?.fibra ?? s.entrada.fibra },
                                    pon_placa: f.pon_placa ?? null,
                                    pon_porta: f.pon_porta ?? null,
                                  } : s))
                                }
                              }} style={{ ...S.inp, width: 80, padding: '4px 4px', fontSize: 11,
                                borderColor: f.splitter_id ? '#e3b341' : BORDER }}>
                                <option value="">↳ SPL</option>
                                {(splitters ?? []).map((s, si) => <option key={s.id} value={s.id}>{s.nome || `SPL ${si + 1}`}</option>)}
                              </select>
                              {isDup && <span title={globalDup ? 'PON em uso em outra CDO/CEO do projeto' : 'PON duplicada nesta caixa'}
                                style={{ fontSize: 10, color: '#f85149', fontWeight: 700, whiteSpace: 'nowrap' }}>⚠{globalDup ? 'PROJ' : 'DUP'}</span>}
                              {!isDup && f.pon_placa != null && f.pon_porta != null && (
                                <span style={{ fontSize: 10, color: '#8957e5', fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: 700 }}>
                                  P{f.pon_placa}/{f.pon_porta}
                                </span>
                              )}
                            </div>
                          ) : f.tipo === 'saida_cto' ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#3fb950', whiteSpace: 'nowrap', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: 5, padding: '2px 7px' }}>→ CTO</span>
                              <input
                                value={f.destino_id ?? ''}
                                onChange={e => upFusao(b.id, f.id, { destino_id: e.target.value })}
                                placeholder="ID da CTO"
                                style={{ ...S.inp, padding: '4px 7px', fontSize: 11, minWidth: 90, borderColor: f.destino_id?.trim() ? '#3fb950' : BORDER }}
                              />
                              <input value={f.obs ?? ''} onChange={e => upFusao(b.id, f.id, { obs: e.target.value })}
                                placeholder="obs" style={{ ...S.inp, padding: '4px 7px', fontSize: 11, minWidth: 60 }} />
                            </div>
                          ) : f.tipo === 'saida_cdo' ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#8957e5', whiteSpace: 'nowrap', background: 'rgba(137,87,229,0.1)', border: '1px solid rgba(137,87,229,0.3)', borderRadius: 5, padding: '2px 7px' }}>→ CDO</span>
                              <input
                                value={f.destino_id ?? ''}
                                onChange={e => upFusao(b.id, f.id, { destino_id: e.target.value })}
                                placeholder="ID da CDO/CEO"
                                style={{ ...S.inp, padding: '4px 7px', fontSize: 11, minWidth: 90, borderColor: f.destino_id?.trim() ? '#8957e5' : BORDER }}
                              />
                              <input value={f.obs ?? ''} onChange={e => upFusao(b.id, f.id, { obs: e.target.value })}
                                placeholder="obs" style={{ ...S.inp, padding: '4px 7px', fontSize: 11, minWidth: 60 }} />
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
      ))}
    </div>
  )
}

// ─── Aba Splitters ────────────────────────────────────────────────────────────
function AbaSplitters({ splitters, onChange, bandejas, isDark }) {
  const S = getStyles(isDark)
  // Bypass splitters são gerados automaticamente pelas saídas diretas da bandeja — não exibir aqui
  const nonBypass = (splitters ?? []).filter(s => !s.id?.startsWith('bypass-'))

  function addSplitter() {
    const saidas = Array.from({ length: 8 }, (_, i) => ({ porta: i + 1, tipo: 'cto', cto_id: '', obs: '' }))
    onChange([...splitters, { id: uid(), nome: `Splitter ${nonBypass.length + 1}`, tipo: '1x8', entrada: { tubo: 1, fibra: 1 }, saidas }])
  }
  function remSplitter(id) { onChange(splitters.filter(s => s.id !== id)) }
  function upSplitter(id, p) { onChange(splitters.map(s => s.id === id ? { ...s, ...p } : s)) }
  function changeTipo(id, tipo) {
    const qtd = parseInt(tipo.split('x')[1])
    upSplitter(id, { tipo, saidas: Array.from({ length: qtd }, (_, i) => ({ porta: i + 1, tipo: 'cto', cto_id: '', obs: '' })) })
  }
  function upSaida(sId, porta, p) {
    const s = splitters.find(s => s.id === sId)
    upSplitter(sId, { saidas: s.saidas.map(sd => sd.porta === porta ? { ...sd, ...p } : sd) })
  }

  // Saídas diretas da bandeja (bypass) para exibir em resumo
  const bypassFusoes = (bandejas ?? []).flatMap(b =>
    (b.fusoes ?? []).filter(f => f.tipo === 'saida_cto' || f.tipo === 'saida_cdo')
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ color: '#8b949e', fontSize: 13 }}>Splitters ópticos da caixa</p>
        <button onClick={addSplitter} style={S.btnAdd}>+ Splitter</button>
      </div>

      {/* Saídas diretas da bandeja */}
      {bypassFusoes.length > 0 && (
        <div style={{ ...S.sec, borderLeft: '3px solid #22c55e', marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#22c55e', marginBottom: 10 }}>
            Saídas Diretas da Bandeja ({bypassFusoes.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bypassFusoes.map((f, i) => {
              const fo = ABNT.find(a => a.idx === f.entrada?.fibra)
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  padding: '7px 10px', borderRadius: 7,
                  backgroundColor: f.destino_id?.trim() ? 'rgba(34,197,94,0.07)' : BG3,
                  border: `1px solid ${f.destino_id?.trim() ? 'rgba(34,197,94,0.3)' : BORDER}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                    background: f.tipo === 'saida_cto' ? 'rgba(34,197,94,0.15)' : 'rgba(139,87,229,0.15)',
                    border: `1px solid ${f.tipo === 'saida_cto' ? 'rgba(34,197,94,0.4)' : 'rgba(139,87,229,0.4)'}`,
                    color: f.tipo === 'saida_cto' ? '#22c55e' : '#8957e5' }}>
                    {f.tipo === 'saida_cto' ? '→ CTO' : '→ CDO'}
                  </span>
                  {fo && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                      backgroundColor: fo.hex, color: fo.text }}>
                      FO {fo.idx} {fo.nome}
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: f.destino_id?.trim() ? '#e6edf3' : '#484f58' }}>
                    {f.destino_id?.trim() || <em style={{ color: '#484f58' }}>sem destino</em>}
                  </span>
                  {f.obs?.trim() && <span style={{ fontSize: 11, color: '#8b949e' }}>{f.obs}</span>}
                  <span style={{ fontSize: 10, color: '#484f58', marginLeft: 'auto' }}>gerenciado na bandeja</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {nonBypass.length === 0 && bypassFusoes.length === 0 && (
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
            <p style={{ ...S.lbl, color: '#3fb950', marginBottom: 8 }}>🟢 Saídas — {s.saidas.length} portas</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 6 }}>
              {s.saidas.map(sd => (
                <div key={sd.porta} style={{
                  backgroundColor: sd.cto_id?.trim() ? 'rgba(63,185,80,0.08)' : BG3,
                  border: `1px solid ${sd.cto_id?.trim() ? 'rgba(63,185,80,0.3)' : BORDER}`,
                  borderRadius: 7, padding: '7px 9px',
                }}>
                  <p style={{ ...S.lbl, color: sd.cto_id?.trim() ? '#3fb950' : '#484f58', marginBottom: 4 }}>S{sd.porta}</p>
                  <select
                    value={sd.tipo ?? 'cto'}
                    onChange={e => upSaida(s.id, sd.porta, { tipo: e.target.value, cto_id: '' })}
                    style={{ ...S.inp, marginBottom: 4, padding: '3px 6px', fontSize: 11 }}
                  >
                    <option value="cto">CTO</option>
                    <option value="pon">PON</option>
                    <option value="cdo">CDO/CEO</option>
                    <option value="passagem">Passagem</option>
                  </select>
                  <input value={sd.cto_id ?? ''} onChange={e => upSaida(s.id, sd.porta, { cto_id: e.target.value })}
                    placeholder={sd.tipo === 'pon' ? 'ID PON' : sd.tipo === 'cdo' ? 'ID CDO' : sd.tipo === 'passagem' ? 'ID/Nome' : 'ID CTO'}
                    style={{ ...S.inp, marginBottom: 3, padding: '3px 7px', fontSize: 12 }} />
                  <input value={sd.obs ?? ''} onChange={e => upSaida(s.id, sd.porta, { obs: e.target.value })}
                    placeholder="Obs" style={{ ...S.inp, padding: '3px 7px', fontSize: 11 }} />
                </div>
              ))}
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
          { label: 'Splitters', val: splitters.filter(s => !s.id?.startsWith('bypass-')).length, cor: '#e3b341' },
          { label: 'CTOs ligadas', val: `${ligadas}/${totalSaidas}`, cor: '#3fb950' },
          { label: 'Saídas diretas', val: bandejas.reduce((a, b) => a + (b.fusoes ?? []).filter(f => f.tipo === 'saida_cto' || f.tipo === 'saida_cdo').length, 0), cor: '#22c55e' },
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

// ─── Componente principal ─────────────────────────────────────────────────────
const TABS = [
  { id: 'olt',       label: 'PON/OLT',   cor: '#1f6feb' },
  { id: 'bandejas',  label: 'Bandejas',  cor: '#58a6ff' },
  { id: 'splitters', label: 'Splitters', cor: '#e3b341' },
  { id: 'cabos',     label: 'Cabos',     cor: '#8957e5' },
  { id: 'resumo',    label: 'Resumo',    cor: '#3fb950' },
]

export default function DiagramaCDOEditor({ ceId, projetoId, capacidadeSaidas, initialDiagrama, olts }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
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
        {aba === 'splitters' && <AbaSplitters splitters={splitters} onChange={setSplitters} bandejas={bandejas} isDark={isDark} />}
        {aba === 'cabos'     && <AbaCabos     cabos={cabos}         onChange={setCabos}     isDark={isDark} />}
        {aba === 'resumo'    && <AbaResumo    entrada={entrada} bandejas={bandejas} splitters={splitters} cabos={cabos} isDark={isDark} />}
      </div>
    </div>
  )
}
