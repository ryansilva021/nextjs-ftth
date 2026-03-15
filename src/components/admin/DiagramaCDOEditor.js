'use client'

/**
 * DiagramaCDOEditor.js
 * Editor profissional ABNT para CE/CDO.
 * Estrutura salva: { entrada: {olt_id, pon, porta_olt}, bandejas: [...], splitters: [...] }
 */

import { useState, useEffect } from 'react'
import { getDiagramaCaixa, saveDiagramaCaixa } from '@/actions/caixas'

// ---------------------------------------------------------------------------
// ABNT NBR 14721
// ---------------------------------------------------------------------------
const ABNT = [
  { idx: 1,  nome: 'Verde',    hex: '#16a34a' },
  { idx: 2,  nome: 'Amarelo',  hex: '#ca8a04' },
  { idx: 3,  nome: 'Branco',   hex: '#e2e8f0' },
  { idx: 4,  nome: 'Azul',     hex: '#2563eb' },
  { idx: 5,  nome: 'Vermelho', hex: '#dc2626' },
  { idx: 6,  nome: 'Violeta',  hex: '#7c3aed' },
  { idx: 7,  nome: 'Marrom',   hex: '#92400e' },
  { idx: 8,  nome: 'Rosa',     hex: '#db2777' },
  { idx: 9,  nome: 'Preto',    hex: '#334155' },
  { idx: 10, nome: 'Cinza',    hex: '#64748b' },
  { idx: 11, nome: 'Laranja',  hex: '#ea580c' },
  { idx: 12, nome: 'Ciano',    hex: '#0891b2' },
]

const SPLITTER_TIPOS = ['1x2', '1x4', '1x8', '1x16', '1x32']

function uid() { return Math.random().toString(36).slice(2, 9) }

// Estilos
const S = {
  wrap:     { backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 24, color: '#f1f5f9' },
  sec:      { backgroundColor: '#0d1526', border: '1px solid #1f2937', borderRadius: 10, padding: 18, marginBottom: 20 },
  secHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  secTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', display: 'flex', alignItems: 'center', gap: 8 },
  dot:      (c) => ({ width: 8, height: 8, borderRadius: '50%', backgroundColor: c, display: 'inline-block', flexShrink: 0 }),
  inp:      { backgroundColor: '#0b1220', border: '1px solid #374151', color: '#f1f5f9', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%' },
  inpSm:    { backgroundColor: '#0b1220', border: '1px solid #374151', color: '#f1f5f9', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', textAlign: 'center', width: '100%' },
  lbl:      { fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, display: 'block', marginBottom: 3 },
  card:     { backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 10, padding: '12px 14px', marginBottom: 8 },
  btnPri:   { background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 8, padding: '10px 28px', cursor: 'pointer', border: 'none' },
  btnSec:   { background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', border: 'none' },
  btnDel:   { backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 11, borderRadius: 6, padding: '4px 8px', cursor: 'pointer' },
  tag:      (c) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, backgroundColor: `${c}18`, border: `1px solid ${c}44`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: c }),
  tblHead:  { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '4px 8px', textAlign: 'center' },
  tblCell:  { padding: '4px 4px', verticalAlign: 'middle' },
}

// Bolinha de cor ABNT
function FibraDot({ fibra, size = 12 }) {
  const c = ABNT.find(a => a.idx === Number(fibra))
  if (!c) return null
  return (
    <div title={`${c.idx} – ${c.nome}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: size, height: size, borderRadius: '50%', backgroundColor: c.hex, border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontSize: 10, color: c.hex, fontWeight: 600, whiteSpace: 'nowrap' }}>{c.nome}</span>
    </div>
  )
}

// Seletor de cor como bolinhas
function FibraSelect({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {ABNT.map(c => (
        <button
          key={c.idx}
          title={`${c.idx} – ${c.nome}`}
          onClick={() => onChange(c.idx)}
          style={{
            width: 16, height: 16, borderRadius: '50%',
            backgroundColor: c.hex,
            border: value === c.idx ? '2px solid #fff' : '1px solid rgba(255,255,255,0.12)',
            cursor: 'pointer', flexShrink: 0,
            transform: value === c.idx ? 'scale(1.3)' : 'scale(1)',
            transition: 'transform .1s',
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seção Entrada OLT
// ---------------------------------------------------------------------------
function SecaoEntrada({ entrada, onChange }) {
  return (
    <div style={S.sec}>
      <div style={S.secHead}>
        <p style={S.secTitle}>
          <span style={S.dot('#6366f1')} />
          Entrada — Origem OLT
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 12 }}>
        <div>
          <label style={S.lbl}>ID da OLT</label>
          <input value={entrada.olt_id} onChange={e => onChange({ ...entrada, olt_id: e.target.value })}
            placeholder="ex: OLT-01"
            style={{ ...S.inp, borderColor: entrada.olt_id ? '#4f46e5' : '#374151' }} />
        </div>
        <div>
          <label style={S.lbl}>PON / Slot</label>
          <input type="number" min={1} value={entrada.pon ?? ''} onChange={e => onChange({ ...entrada, pon: e.target.value ? +e.target.value : null })}
            placeholder="1" style={S.inp} />
        </div>
        <div>
          <label style={S.lbl}>Porta</label>
          <input type="number" min={1} value={entrada.porta_olt ?? ''} onChange={e => onChange({ ...entrada, porta_olt: e.target.value ? +e.target.value : null })}
            placeholder="1" style={S.inp} />
        </div>
      </div>
      {entrada.olt_id && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={S.tag('#6366f1')}>OLT: {entrada.olt_id}</span>
          {entrada.pon != null    && <span style={S.tag('#8b5cf6')}>PON {entrada.pon}</span>}
          {entrada.porta_olt != null && <span style={S.tag('#a78bfa')}>Porta {entrada.porta_olt}</span>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seção Bandejas de Fusão
// ---------------------------------------------------------------------------
function SecaoBandejas({ bandejas, onChange }) {
  function addBandeja() {
    onChange([...bandejas, { id: uid(), nome: `Bandeja ${bandejas.length + 1}`, fusoes: [] }])
  }
  function removeBandeja(id) { onChange(bandejas.filter(b => b.id !== id)) }
  function updateBandeja(id, patch) { onChange(bandejas.map(b => b.id === id ? { ...b, ...patch } : b)) }

  function addFusao(bId) {
    const b = bandejas.find(b => b.id === bId)
    const nova = { id: uid(), entrada: { tubo: 1, fibra: 1 }, saida: { tubo: 1, fibra: 1 }, tipo: 'fusao', obs: '' }
    updateBandeja(bId, { fusoes: [...b.fusoes, nova] })
  }
  function removeFusao(bId, fId) {
    updateBandeja(bId, { fusoes: bandejas.find(b => b.id === bId).fusoes.filter(f => f.id !== fId) })
  }
  function updateFusao(bId, fId, patch) {
    const b = bandejas.find(b => b.id === bId)
    updateBandeja(bId, { fusoes: b.fusoes.map(f => f.id === fId ? { ...f, ...patch } : f) })
  }

  return (
    <div style={S.sec}>
      <div style={S.secHead}>
        <p style={S.secTitle}>
          <span style={{ ...S.dot('#2563eb'), borderRadius: 2 }} />
          Bandejas de Fusão ({bandejas.length})
        </p>
        <button onClick={addBandeja} style={S.btnSec}>+ Bandeja</button>
      </div>

      {bandejas.length === 0 && (
        <p style={{ color: '#374151', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
          Nenhuma bandeja. Clique em "+ Bandeja" para adicionar.
        </p>
      )}

      {bandejas.map((b, bi) => (
        <div key={b.id} style={{ ...S.card, borderLeft: '3px solid #2563eb' }}>
          {/* Header da bandeja */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: b.fusoes.length > 0 ? 12 : 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', minWidth: 76 }}>Bandeja {bi + 1}</span>
            <input value={b.nome} onChange={e => updateBandeja(b.id, { nome: e.target.value })}
              placeholder="Nome" style={{ ...S.inp, flex: 1, padding: '4px 8px', fontSize: 12 }} />
            <button onClick={() => addFusao(b.id)} style={{ ...S.btnSec, whiteSpace: 'nowrap' }}>+ Fusão</button>
            <button onClick={() => removeBandeja(b.id)} style={S.btnDel}>✕</button>
          </div>

          {b.fusoes.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ ...S.tblHead, width: 28, color: '#475569' }}>#</th>
                    <th style={{ ...S.tblHead, width: 80, color: '#475569' }}>Tipo</th>
                    {/* Entrada */}
                    <th style={{ ...S.tblHead, color: '#3b82f6', borderLeft: '2px solid rgba(59,130,246,0.3)', paddingLeft: 8 }}>Tubo Ent.</th>
                    <th style={{ ...S.tblHead, color: '#3b82f6' }}>Fibra Ent.</th>
                    <th style={{ ...S.tblHead, color: '#3b82f6' }}>Cor Ent.</th>
                    {/* Separador */}
                    <th style={{ ...S.tblHead, width: 24, color: '#374151' }}>→</th>
                    {/* Saída */}
                    <th style={{ ...S.tblHead, color: '#34d399', borderLeft: '2px solid rgba(52,211,153,0.3)', paddingLeft: 8 }}>Tubo Saí.</th>
                    <th style={{ ...S.tblHead, color: '#34d399' }}>Fibra Saí.</th>
                    <th style={{ ...S.tblHead, color: '#34d399' }}>Cor Saí.</th>
                    <th style={{ ...S.tblHead, color: '#475569' }}>Obs</th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {b.fusoes.map((f, fi) => (
                    <tr key={f.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ ...S.tblCell, textAlign: 'center', color: '#374151', fontWeight: 700 }}>{fi + 1}</td>

                      <td style={S.tblCell}>
                        <select value={f.tipo} onChange={e => updateFusao(b.id, f.id, { tipo: e.target.value })}
                          style={{ ...S.inpSm, fontSize: 11, padding: '3px 4px' }}>
                          <option value="fusao">Fusão</option>
                          <option value="conector">Conector</option>
                          <option value="passthrough">Pass</option>
                        </select>
                      </td>

                      {/* Entrada */}
                      <td style={{ ...S.tblCell, borderLeft: '2px solid rgba(59,130,246,0.2)' }}>
                        <input type="number" min={1} value={f.entrada.tubo}
                          onChange={e => updateFusao(b.id, f.id, { entrada: { ...f.entrada, tubo: +e.target.value } })}
                          style={{ ...S.inpSm, width: 52 }} />
                      </td>
                      <td style={S.tblCell}>
                        <input type="number" min={1} max={12} value={f.entrada.fibra}
                          onChange={e => updateFusao(b.id, f.id, { entrada: { ...f.entrada, fibra: +e.target.value } })}
                          style={{ ...S.inpSm, width: 52 }} />
                      </td>
                      <td style={S.tblCell}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          <FibraDot fibra={f.entrada.fibra} />
                          <FibraSelect value={f.entrada.fibra} onChange={v => updateFusao(b.id, f.id, { entrada: { ...f.entrada, fibra: v } })} />
                        </div>
                      </td>

                      <td style={{ ...S.tblCell, textAlign: 'center', color: '#374151', fontWeight: 700, fontSize: 14 }}>→</td>

                      {/* Saída */}
                      <td style={{ ...S.tblCell, borderLeft: '2px solid rgba(52,211,153,0.2)' }}>
                        <input type="number" min={1} value={f.saida.tubo}
                          onChange={e => updateFusao(b.id, f.id, { saida: { ...f.saida, tubo: +e.target.value } })}
                          style={{ ...S.inpSm, width: 52 }} />
                      </td>
                      <td style={S.tblCell}>
                        <input type="number" min={1} max={12} value={f.saida.fibra}
                          onChange={e => updateFusao(b.id, f.id, { saida: { ...f.saida, fibra: +e.target.value } })}
                          style={{ ...S.inpSm, width: 52 }} />
                      </td>
                      <td style={S.tblCell}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          <FibraDot fibra={f.saida.fibra} />
                          <FibraSelect value={f.saida.fibra} onChange={v => updateFusao(b.id, f.id, { saida: { ...f.saida, fibra: v } })} />
                        </div>
                      </td>

                      <td style={S.tblCell}>
                        <input value={f.obs} onChange={e => updateFusao(b.id, f.id, { obs: e.target.value })}
                          placeholder="observação" style={{ ...S.inpSm, width: '100%', minWidth: 100 }} />
                      </td>

                      <td style={S.tblCell}>
                        <button onClick={() => removeFusao(b.id, f.id)} style={{ ...S.btnDel, padding: '3px 6px', fontSize: 10 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {b.fusoes.length === 0 && (
            <p style={{ color: '#374151', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              Sem fusões — clique em "+ Fusão"
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seção Splitters
// ---------------------------------------------------------------------------
function SecaoSplitters({ splitters, onChange }) {
  function addSplitter() {
    const saidas = Array.from({ length: 8 }, (_, i) => ({ porta: i + 1, cto_id: '', obs: '' }))
    onChange([...splitters, { id: uid(), nome: `Splitter ${splitters.length + 1}`, tipo: '1x8', entrada: { tubo: 1, fibra: 1 }, saidas }])
  }
  function removeSplitter(id) { onChange(splitters.filter(s => s.id !== id)) }
  function updateSplitter(id, patch) { onChange(splitters.map(s => s.id === id ? { ...s, ...patch } : s)) }
  function changeTipo(id, tipo) {
    const qtd = parseInt(tipo.split('x')[1])
    updateSplitter(id, { tipo, saidas: Array.from({ length: qtd }, (_, i) => ({ porta: i + 1, cto_id: '', obs: '' })) })
  }
  function updateSaida(sId, porta, patch) {
    const s = splitters.find(s => s.id === sId)
    updateSplitter(sId, { saidas: s.saidas.map(sd => sd.porta === porta ? { ...sd, ...patch } : sd) })
  }

  return (
    <div style={S.sec}>
      <div style={S.secHead}>
        <p style={S.secTitle}>
          <span style={{ ...S.dot('#ea580c'), borderRadius: 2 }} />
          Splitters ({splitters.length})
        </p>
        <button onClick={addSplitter} style={S.btnSec}>+ Splitter</button>
      </div>

      {splitters.length === 0 && (
        <p style={{ color: '#374151', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
          Nenhum splitter. Clique em "+ Splitter".
        </p>
      )}

      {splitters.map((s, si) => {
        const ligadas = s.saidas.filter(sd => sd.cto_id.trim()).length
        const cor = ABNT.find(a => a.idx === s.entrada.fibra)
        return (
          <div key={s.id} style={{ ...S.card, borderLeft: '3px solid #ea580c' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', minWidth: 76 }}>Splitter {si + 1}</span>
              <input value={s.nome} onChange={e => updateSplitter(s.id, { nome: e.target.value })}
                placeholder="Nome" style={{ ...S.inp, flex: 1, minWidth: 120, padding: '4px 8px', fontSize: 12 }} />
              <select value={s.tipo} onChange={e => changeTipo(s.id, e.target.value)}
                style={{ ...S.inpSm, width: 70 }}>
                {SPLITTER_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span style={S.tag('#16a34a')}>{ligadas}/{s.saidas.length}</span>
              <button onClick={() => removeSplitter(s.id)} style={S.btnDel}>✕</button>
            </div>

            {/* Entrada do splitter */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, padding: '8px 10px', backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', whiteSpace: 'nowrap' }}>Entrada:</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ ...S.lbl, color: '#3b82f6' }}>Tubo</label>
                  <input type="number" min={1} value={s.entrada.tubo}
                    onChange={e => updateSplitter(s.id, { entrada: { ...s.entrada, tubo: +e.target.value } })}
                    style={{ ...S.inpSm, width: 56 }} />
                </div>
                <div>
                  <label style={{ ...S.lbl, color: '#3b82f6' }}>Fibra (1–12)</label>
                  <input type="number" min={1} max={12} value={s.entrada.fibra}
                    onChange={e => updateSplitter(s.id, { entrada: { ...s.entrada, fibra: +e.target.value } })}
                    style={{ ...S.inpSm, width: 56 }} />
                </div>
                {cor && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 14 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: cor.hex, border: '1px solid rgba(255,255,255,0.2)' }} />
                    <span style={{ fontSize: 11, color: cor.hex, fontWeight: 700 }}>{cor.nome}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Saídas */}
            <p style={{ ...S.lbl, color: '#34d399', marginBottom: 8 }}>Saídas — {s.saidas.length} portas</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
              {s.saidas.map(sd => (
                <div key={sd.porta} style={{
                  backgroundColor: sd.cto_id.trim() ? 'rgba(22,163,74,0.08)' : '#0d1526',
                  border: `1px solid ${sd.cto_id.trim() ? 'rgba(22,163,74,0.35)' : '#1f2937'}`,
                  borderRadius: 8, padding: '8px 10px',
                }}>
                  <p style={{ ...S.lbl, color: sd.cto_id.trim() ? '#86efac' : '#374151', marginBottom: 5 }}>Porta {sd.porta}</p>
                  <input value={sd.cto_id} onChange={e => updateSaida(s.id, sd.porta, { cto_id: e.target.value })}
                    placeholder="ID CTO" style={{ ...S.inp, marginBottom: 4, padding: '4px 7px', fontSize: 12 }} />
                  <input value={sd.obs} onChange={e => updateSaida(s.id, sd.porta, { obs: e.target.value })}
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

// ---------------------------------------------------------------------------
// Legenda ABNT
// ---------------------------------------------------------------------------
function LegendaABNT() {
  return (
    <div style={{ ...S.sec, marginBottom: 0 }}>
      <p style={{ ...S.secTitle, marginBottom: 10 }}>
        <span style={S.dot('#f59e0b')} />
        Legenda ABNT NBR 14721
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ABNT.map(c => (
          <div key={c.idx} style={{ display: 'flex', alignItems: 'center', gap: 5, backgroundColor: `${c.hex}12`, border: `1px solid ${c.hex}40`, borderRadius: 6, padding: '3px 8px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c.hex, display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: c.hex, fontWeight: 700 }}>{c.idx} – {c.nome}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function DiagramaCDOEditor({ ceId, projetoId, capacidadeSaidas, initialDiagrama }) {
  const [carregando, setCarregando] = useState(!initialDiagrama)
  const [saving, setSaving]         = useState(false)
  const [sucesso, setSucesso]       = useState(null)
  const [erro, setErro]             = useState(null)

  const [entrada, setEntrada]     = useState({ olt_id: '', pon: null, porta_olt: null })
  const [bandejas, setBandejas]   = useState([])
  const [splitters, setSplitters] = useState([])

  function aplicarDiagrama(d) {
    if (!d) return
    setEntrada({
      olt_id:    d.entrada?.olt_id    ?? '',
      pon:       d.entrada?.pon       ?? null,
      porta_olt: d.entrada?.porta_olt ?? null,
    })
    setBandejas(d.bandejas   ?? [])
    setSplitters(d.splitters ?? [])
  }

  useEffect(() => {
    if (initialDiagrama) {
      aplicarDiagrama(initialDiagrama)
      setCarregando(false)
      return
    }
    let cancelado = false
    getDiagramaCaixa(ceId, projetoId)
      .then(res => { if (!cancelado && res?.diagrama) aplicarDiagrama(res.diagrama) })
      .catch(e  => { if (!cancelado) setErro('Erro ao carregar: ' + e.message) })
      .finally(() => { if (!cancelado) setCarregando(false) })
    return () => { cancelado = true }
  }, [ceId, projetoId, initialDiagrama])

  async function salvar() {
    if (saving) return
    setSaving(true)
    setErro(null)
    setSucesso(null)
    try {
      const res = await saveDiagramaCaixa({
        ce_id:      ceId,
        projeto_id: projetoId,
        diagrama:   { entrada, bandejas, splitters },
      })
      setSucesso(res?.saved ? 'Diagrama salvo com sucesso!' : 'Salvo (sem alterações detectadas).')
      setTimeout(() => setSucesso(null), 4000)
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const totalFusoes  = bandejas.reduce((a, b) => a + b.fusoes.length, 0)
  const totalLigadas = splitters.reduce((a, s) => a + s.saidas.filter(sd => sd.cto_id.trim()).length, 0)
  const totalPortas  = splitters.reduce((a, s) => a + s.saidas.length, 0)

  if (carregando) {
    return <div style={S.wrap}><p style={{ color: '#475569', fontSize: 14 }}>Carregando diagrama...</p></div>
  }

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Diagrama ABNT — CE / CDO</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={S.tag('#2563eb')}>{bandejas.length} bandejas</span>
            <span style={S.tag('#7c3aed')}>{totalFusoes} fusões</span>
            <span style={S.tag('#ea580c')}>{splitters.length} splitters</span>
            <span style={S.tag('#16a34a')}>{totalLigadas}/{totalPortas} saídas</span>
          </div>
        </div>
        <button onClick={salvar} disabled={saving}
          style={{ ...S.btnPri, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Salvando...' : 'Salvar Diagrama'}
        </button>
      </div>

      {sucesso && <div style={{ backgroundColor: '#052e16', border: '1px solid #166534', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#4ade80', marginBottom: 16 }}>{sucesso}</div>}
      {erro    && <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{erro}</div>}

      <SecaoEntrada   entrada={entrada}     onChange={setEntrada}   />
      <SecaoBandejas  bandejas={bandejas}   onChange={setBandejas}  />
      <SecaoSplitters splitters={splitters} onChange={setSplitters} />
      <LegendaABNT />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={salvar} disabled={saving}
          style={{ ...S.btnPri, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Salvando...' : 'Salvar Diagrama'}
        </button>
      </div>
    </div>
  )
}
