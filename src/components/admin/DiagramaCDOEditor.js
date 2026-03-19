'use client'

/**
 * DiagramaCDOEditor.js
 * Editor ABNT para CE/CDO com abas: PON/OLT | Bandejas | Splitters | Cabos | Resumo
 */

import { useState, useEffect } from 'react'
import { getDiagramaCaixa, saveDiagramaCaixa } from '@/actions/caixas'

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
const BG   = '#0d1117'
const BG2  = '#161b22'
const BG3  = '#1c2333'
const BORDER = '#30363d'

const S = {
  wrap:     { backgroundColor: BG, border: `1px solid ${BORDER}`, borderRadius: 12, color: '#e6edf3', overflow: 'hidden' },
  header:   { backgroundColor: BG2, borderBottom: `1px solid ${BORDER}`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  tabBar:   { backgroundColor: BG2, borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 0, overflowX: 'auto' },
  tabBtn:   (ativa, cor) => ({
    padding: '11px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    backgroundColor: 'transparent', border: 'none', borderBottom: ativa ? `2px solid ${cor}` : '2px solid transparent',
    color: ativa ? cor : '#8b949e', whiteSpace: 'nowrap', transition: 'all .15s',
  }),
  body:     { padding: '20px', minHeight: 300 },
  sec:      { backgroundColor: BG2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px', marginBottom: 14 },
  secHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  secTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8b949e' },
  inp:      { backgroundColor: BG3, border: `1px solid ${BORDER}`, color: '#e6edf3', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  inpSm:    { backgroundColor: BG3, border: `1px solid ${BORDER}`, color: '#e6edf3', borderRadius: 6, padding: '4px 6px', fontSize: 12, outline: 'none', width: 52, textAlign: 'center', boxSizing: 'border-box' },
  lbl:      { fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, display: 'block', marginBottom: 3 },
  btnAdd:   { background: 'linear-gradient(135deg,#238636,#1a7f37)', color: '#fff', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', border: 'none' },
  btnDel:   { backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.4)', color: '#f85149', fontSize: 11, borderRadius: 6, padding: '4px 8px', cursor: 'pointer' },
  btnSave:  { background: 'linear-gradient(135deg,#1f6feb,#1158c7)', color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 8, padding: '9px 24px', cursor: 'pointer', border: 'none' },
  tag:      (c) => ({ display:'inline-flex', alignItems:'center', gap:5, backgroundColor:`${c}18`, border:`1px solid ${c}44`, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600, color:c }),
  card:     { backgroundColor: BG3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8 },
}

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
function AbaOLT({ entrada, onChange }) {
  return (
    <div style={S.sec}>
      <p style={{ ...S.secTitle, marginBottom: 14 }}>Origem — OLT / PON</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 12 }}>
        <div>
          <label style={S.lbl}>ID da OLT</label>
          <input value={entrada.olt_id} onChange={e => onChange({ ...entrada, olt_id: e.target.value })}
            placeholder="ex: OLT-01" style={{ ...S.inp, borderColor: entrada.olt_id ? '#1f6feb' : BORDER }} />
        </div>
        <div>
          <label style={S.lbl}>PON / Slot</label>
          <input type="number" min={1} value={entrada.pon ?? ''}
            onChange={e => onChange({ ...entrada, pon: e.target.value ? +e.target.value : null })}
            placeholder="1" style={S.inp} />
        </div>
        <div>
          <label style={S.lbl}>Porta</label>
          <input type="number" min={1} value={entrada.porta_olt ?? ''}
            onChange={e => onChange({ ...entrada, porta_olt: e.target.value ? +e.target.value : null })}
            placeholder="1" style={S.inp} />
        </div>
      </div>
      {entrada.olt_id && (
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={S.tag('#1f6feb')}>🖥️ {entrada.olt_id}</span>
          {entrada.pon != null      && <span style={S.tag('#8957e5')}>PON {entrada.pon}</span>}
          {entrada.porta_olt != null && <span style={S.tag('#3fb950')}>Porta {entrada.porta_olt}</span>}
        </div>
      )}
    </div>
  )
}

// ─── Aba Bandejas ─────────────────────────────────────────────────────────────
function AbaBandejas({ bandejas, onChange }) {
  function addBandeja() {
    onChange([...bandejas, { id: uid(), nome: `Bandeja ${bandejas.length + 1}`, fusoes: [] }])
  }
  function remBandeja(id) { onChange(bandejas.filter(b => b.id !== id)) }
  function upBandeja(id, p) { onChange(bandejas.map(b => b.id === id ? { ...b, ...p } : b)) }

  function addFusao(bId) {
    const b = bandejas.find(b => b.id === bId)
    upBandeja(bId, { fusoes: [...b.fusoes, { id: uid(), entrada: { tubo: 1, fibra: 1 }, saida: { tubo: 1, fibra: 1 }, tipo: 'fusao', obs: '' }] })
  }
  function remFusao(bId, fId) {
    upBandeja(bId, { fusoes: bandejas.find(b => b.id === bId).fusoes.filter(f => f.id !== fId) })
  }
  function upFusao(bId, fId, p) {
    const b = bandejas.find(b => b.id === bId)
    upBandeja(bId, { fusoes: b.fusoes.map(f => f.id === fId ? { ...f, ...p } : f) })
  }

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
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '5px 6px', width: 28, color: '#484f58', fontWeight: 700, textAlign: 'center' }}>Nº</th>
                    {/* Entrada */}
                    <th colSpan={2} style={{ padding: '5px 8px', color: '#58a6ff', fontWeight: 700, borderLeft: '2px solid rgba(88,166,255,0.3)', textAlign: 'center' }}>
                      🔵 Fibra Entrada
                    </th>
                    <th style={{ padding: '5px 4px', color: '#484f58', width: 24, textAlign: 'center' }}>↔</th>
                    {/* Saída */}
                    <th colSpan={2} style={{ padding: '5px 8px', color: '#3fb950', fontWeight: 700, borderLeft: '2px solid rgba(63,185,80,0.3)', textAlign: 'center' }}>
                      🟢 Fibra Saída
                    </th>
                    <th style={{ padding: '5px 6px', color: '#8b949e', fontWeight: 700, textAlign: 'center' }}>Tipo</th>
                    <th style={{ padding: '5px 6px', color: '#8b949e', fontWeight: 700, textAlign: 'left', minWidth: 80 }}>Obs</th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {b.fusoes.map((f, fi) => (
                    <tr key={f.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '5px 4px', textAlign: 'center', color: '#484f58', fontWeight: 700 }}>{fi + 1}</td>

                      {/* Entrada: fibra select + tubo */}
                      <td style={{ padding: '5px 4px', borderLeft: '2px solid rgba(88,166,255,0.15)' }}>
                        <FibraSelect value={f.entrada.fibra} small
                          onChange={v => upFusao(b.id, f.id, { entrada: { ...f.entrada, fibra: v } })} />
                      </td>
                      <td style={{ padding: '5px 4px' }}>
                        <input type="number" min={1} value={f.entrada.tubo}
                          onChange={e => upFusao(b.id, f.id, { entrada: { ...f.entrada, tubo: +e.target.value } })}
                          style={S.inpSm} title="Tubo" />
                      </td>

                      <td style={{ padding: '5px 2px', textAlign: 'center', color: '#484f58' }}>—</td>

                      {/* Saída: fibra select + tubo */}
                      <td style={{ padding: '5px 4px', borderLeft: '2px solid rgba(63,185,80,0.15)' }}>
                        <FibraSelect value={f.saida.fibra} small
                          onChange={v => upFusao(b.id, f.id, { saida: { ...f.saida, fibra: v } })} />
                      </td>
                      <td style={{ padding: '5px 4px' }}>
                        <input type="number" min={1} value={f.saida.tubo}
                          onChange={e => upFusao(b.id, f.id, { saida: { ...f.saida, tubo: +e.target.value } })}
                          style={S.inpSm} title="Tubo" />
                      </td>

                      <td style={{ padding: '5px 4px' }}>
                        <select value={f.tipo} onChange={e => upFusao(b.id, f.id, { tipo: e.target.value })}
                          style={{ ...S.inp, padding: '3px 5px', width: 80, fontSize: 11 }}>
                          <option value="fusao">fusao</option>
                          <option value="pon">pon</option>
                          <option value="conector">conector</option>
                          <option value="passthrough">pass</option>
                        </select>
                      </td>

                      <td style={{ padding: '5px 4px' }}>
                        <input value={f.obs} onChange={e => upFusao(b.id, f.id, { obs: e.target.value })}
                          placeholder="obs..." style={{ ...S.inp, padding: '3px 7px', fontSize: 11, minWidth: 80 }} />
                      </td>

                      <td style={{ padding: '5px 4px' }}>
                        <button onClick={() => remFusao(b.id, f.id)} style={{ ...S.btnDel, padding: '3px 6px', fontSize: 10 }}>✕</button>
                      </td>
                    </tr>
                  ))}
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
function AbaSplitters({ splitters, onChange }) {
  function addSplitter() {
    const saidas = Array.from({ length: 8 }, (_, i) => ({ porta: i + 1, tipo: 'cto', cto_id: '', obs: '' }))
    onChange([...splitters, { id: uid(), nome: `Splitter ${splitters.length + 1}`, tipo: '1x8', entrada: { tubo: 1, fibra: 1 }, saidas }])
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ color: '#8b949e', fontSize: 13 }}>Splitters ópticos da caixa</p>
        <button onClick={addSplitter} style={S.btnAdd}>+ Splitter</button>
      </div>

      {splitters.length === 0 && (
        <div style={{ ...S.sec, textAlign: 'center', color: '#484f58', padding: '32px' }}>
          Nenhum splitter. Clique "+ Splitter".
        </div>
      )}

      {splitters.map((s, si) => {
        const ligadas = s.saidas.filter(sd => sd.cto_id?.trim()).length
        const corEnt = ABNT.find(a => a.idx === s.entrada.fibra)
        return (
          <div key={s.id} style={{ ...S.sec, borderLeft: '3px solid #e3b341' }}>
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
function AbaCabos({ cabos, onChange }) {
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
function AbaResumo({ entrada, bandejas, splitters, cabos }) {
  const totalFusoes = bandejas.reduce((a, b) => a + b.fusoes.length, 0)
  const ligadas     = splitters.reduce((a, s) => a + s.saidas.filter(sd => sd.cto_id?.trim()).length, 0)
  const totalSaidas = splitters.reduce((a, s) => a + s.saidas.length, 0)

  return (
    <div>
      {/* Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'OLT', val: entrada.olt_id || '—', cor: '#1f6feb' },
          { label: 'PON', val: entrada.pon ?? '—', cor: '#8957e5' },
          { label: 'Porta', val: entrada.porta_olt ?? '—', cor: '#3fb950' },
          { label: 'Bandejas', val: bandejas.length, cor: '#58a6ff' },
          { label: 'Fusões', val: totalFusoes, cor: '#a5d6ff' },
          { label: 'Splitters', val: splitters.length, cor: '#e3b341' },
          { label: 'CTOs ligadas', val: `${ligadas}/${totalSaidas}`, cor: '#3fb950' },
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

export default function DiagramaCDOEditor({ ceId, projetoId, capacidadeSaidas, initialDiagrama }) {
  const [aba, setAba]           = useState('bandejas')
  const [carregando, setCarregando] = useState(!initialDiagrama)
  const [saving, setSaving]     = useState(false)
  const [sucesso, setSucesso]   = useState(null)
  const [erro, setErro]         = useState(null)

  const [entrada, setEntrada]     = useState({ olt_id: '', pon: null, porta_olt: null })
  const [bandejas, setBandejas]   = useState([])
  const [splitters, setSplitters] = useState([])
  const [cabos, setCabos]         = useState([])

  function aplicarDiagrama(d) {
    if (!d) return
    setEntrada({ olt_id: d.entrada?.olt_id ?? '', pon: d.entrada?.pon ?? null, porta_olt: d.entrada?.porta_olt ?? null })
    setBandejas(d.bandejas   ?? [])
    setSplitters(d.splitters ?? [])
    setCabos(d.cabos         ?? [])
  }

  useEffect(() => {
    if (initialDiagrama) { aplicarDiagrama(initialDiagrama); setCarregando(false); return }
    let cancelado = false
    getDiagramaCaixa(ceId, projetoId)
      .then(res => { if (!cancelado && res?.diagrama) aplicarDiagrama(res.diagrama) })
      .catch(e  => { if (!cancelado) setErro('Erro ao carregar: ' + e.message) })
      .finally(() => { if (!cancelado) setCarregando(false) })
    return () => { cancelado = true }
  }, [ceId, projetoId, initialDiagrama])

  async function salvar() {
    if (saving) return
    setSaving(true); setErro(null); setSucesso(null)
    try {
      const res = await saveDiagramaCaixa({ ce_id: ceId, projeto_id: projetoId, diagrama: { entrada, bandejas, splitters, cabos } })
      setSucesso(res?.saved ? 'Diagrama salvo!' : 'Salvo (sem alterações).')
      setTimeout(() => setSucesso(null), 4000)
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
        {aba === 'olt'       && <AbaOLT       entrada={entrada}     onChange={setEntrada}   />}
        {aba === 'bandejas'  && <AbaBandejas  bandejas={bandejas}   onChange={setBandejas}  />}
        {aba === 'splitters' && <AbaSplitters splitters={splitters} onChange={setSplitters} />}
        {aba === 'cabos'     && <AbaCabos     cabos={cabos}         onChange={setCabos}     />}
        {aba === 'resumo'    && <AbaResumo    entrada={entrada} bandejas={bandejas} splitters={splitters} cabos={cabos} />}
      </div>
    </div>
  )
}
