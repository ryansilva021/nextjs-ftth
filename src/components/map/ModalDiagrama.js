'use client'

import { useEffect, useState } from 'react'
import { getDiagramaCTO, saveDiagramaCTO } from '@/actions/ctos'
import { useFiberColors } from '@/contexts/FiberColorContext'

const SPLITTER_TIPOS = ['1x2', '1x4', '1x8', '1x16', '1x32']
function uid() { return Math.random().toString(36).slice(2, 9) }

// ─── Estilos ─────────────────────────────────────────────────────────────────
const overlay  = { backgroundColor: 'rgba(0,0,0,0.88)' }
const panel    = { backgroundColor: 'rgba(8,13,28,0.99)', border: '1px solid rgba(255,255,255,0.08)', width: 'min(720px,100%)', maxHeight: '92vh' }
const label    = { fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }
const fieldIn  = { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', fontSize: 12, outline: 'none', borderRadius: 6, padding: '5px 8px', width: '100%' }
const card     = { backgroundColor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }
const btnAdd   = { background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '5px 12px' }
const btnDel   = { backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 11, borderRadius: 6, padding: '4px 8px' }

// ─── FibraColorDot ────────────────────────────────────────────────────────────
function FibraColorDot({ fibra }) {
  const cor = abntCor(fibra)
  if (!cor) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cor.hex, display: 'inline-block', flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
      <span style={{ ...label, color: cor.hex }}>{cor.nome}</span>
    </div>
  )
}

// ─── Aba Bandejas ─────────────────────────────────────────────────────────────
function TabBandejas({ bandejas, onChange }) {
  function addBandeja() {
    onChange([...bandejas, { id: uid(), nome: `Bandeja ${bandejas.length + 1}`, fusoes: [] }])
  }
  function removeBandeja(id) { onChange(bandejas.filter(b => b.id !== id)) }
  function updateBandeja(id, patch) { onChange(bandejas.map(b => b.id === id ? { ...b, ...patch } : b)) }
  function addFusao(bId) {
    const b = bandejas.find(b => b.id === bId)
    updateBandeja(bId, { fusoes: [...b.fusoes, { id: uid(), entrada: { tubo: 1, fibra: 1 }, saida: { tubo: 1, fibra: 1 }, tipo: 'fusao', obs: '' }] })
  }
  function removeFusao(bId, fId) {
    const b = bandejas.find(b => b.id === bId)
    updateBandeja(bId, { fusoes: b.fusoes.filter(f => f.id !== fId) })
  }
  function updateFusao(bId, fId, patch) {
    const b = bandejas.find(b => b.id === bId)
    updateBandeja(bId, { fusoes: b.fusoes.map(f => f.id === fId ? { ...f, ...patch } : f) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {bandejas.length === 0 && (
        <p style={{ ...label, textAlign: 'center', padding: '24px 0' }}>Nenhuma bandeja. Clique em "+ Bandeja".</p>
      )}
      {bandejas.map((b, bi) => (
        <div key={b.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ ...label, color: 'rgba(255,255,255,0.6)', minWidth: 70 }}>Bandeja {bi + 1}</span>
            <input value={b.nome} onChange={e => updateBandeja(b.id, { nome: e.target.value })} placeholder="Nome da bandeja" style={{ ...fieldIn, flex: 1 }} />
            <button onClick={() => addFusao(b.id)} style={btnAdd}>+ Fusão</button>
            <button onClick={() => removeBandeja(b.id)} style={btnDel}>✕</button>
          </div>

          {b.fusoes.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 80px 1fr 1fr 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <span />
              <span style={{ ...label, textAlign: 'center', color: '#2563eb' }}>Entrada — Tubo</span>
              <span style={{ ...label, textAlign: 'center', color: '#2563eb' }}>Entrada — Fibra</span>
              <span style={{ ...label, textAlign: 'center' }}>Tipo</span>
              <span style={{ ...label, textAlign: 'center', color: '#16a34a' }}>Saída — Tubo</span>
              <span style={{ ...label, textAlign: 'center', color: '#16a34a' }}>Saída — Fibra</span>
              <span />
            </div>
          )}

          {b.fusoes.map((f, fi) => (
            <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 80px 1fr 1fr 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <span style={{ ...label, textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>{fi + 1}</span>

              <input type="number" min={1} max={99} value={f.entrada.tubo}
                onChange={e => updateFusao(b.id, f.id, { entrada: { ...f.entrada, tubo: +e.target.value } })}
                style={{ ...fieldIn, textAlign: 'center' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input type="number" min={1} max={12} value={f.entrada.fibra}
                  onChange={e => updateFusao(b.id, f.id, { entrada: { ...f.entrada, fibra: +e.target.value } })}
                  style={{ ...fieldIn, textAlign: 'center' }} />
                <FibraColorDot fibra={f.entrada.fibra} />
              </div>

              <select value={f.tipo} onChange={e => updateFusao(b.id, f.id, { tipo: e.target.value })} style={{ ...fieldIn, textAlign: 'center' }}>
                <option value="fusao">Fusão</option>
                <option value="conector">Conector</option>
                <option value="passthrough">Pass</option>
              </select>

              <input type="number" min={1} max={99} value={f.saida.tubo}
                onChange={e => updateFusao(b.id, f.id, { saida: { ...f.saida, tubo: +e.target.value } })}
                style={{ ...fieldIn, textAlign: 'center' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input type="number" min={1} max={12} value={f.saida.fibra}
                  onChange={e => updateFusao(b.id, f.id, { saida: { ...f.saida, fibra: +e.target.value } })}
                  style={{ ...fieldIn, textAlign: 'center' }} />
                <FibraColorDot fibra={f.saida.fibra} />
              </div>

              <button onClick={() => removeFusao(b.id, f.id)} style={{ ...btnDel, padding: '4px 6px' }}>✕</button>
            </div>
          ))}

          {b.fusoes.length === 0 && (
            <p style={{ ...label, textAlign: 'center', padding: '8px 0' }}>Sem fusões. Clique em "+ Fusão".</p>
          )}
        </div>
      ))}
      <button onClick={addBandeja} style={{ ...btnAdd, alignSelf: 'flex-start', padding: '7px 16px', fontSize: 12 }}>+ Bandeja</button>
    </div>
  )
}

// ─── Aba Splitters (CTO: saídas têm campo cliente) ────────────────────────────
function TabSplitters({ splitters, onChange }) {
  function addSplitter() {
    const saidas = Array.from({ length: 8 }, (_, i) => ({ porta: i + 1, cliente: '', obs: '' }))
    onChange([...splitters, { id: uid(), nome: `Splitter ${splitters.length + 1}`, tipo: '1x8', entrada: { tubo: 1, fibra: 1 }, saidas }])
  }
  function removeSplitter(id) { onChange(splitters.filter(s => s.id !== id)) }
  function updateSplitter(id, patch) { onChange(splitters.map(s => s.id === id ? { ...s, ...patch } : s)) }
  function changeTipo(id, tipo) {
    const qtd = parseInt(tipo.split('x')[1])
    const saidas = Array.from({ length: qtd }, (_, i) => ({ porta: i + 1, cliente: '', obs: '' }))
    updateSplitter(id, { tipo, saidas })
  }
  function updateSaida(sId, porta, patch) {
    const s = splitters.find(s => s.id === sId)
    updateSplitter(sId, { saidas: s.saidas.map(sd => sd.porta === porta ? { ...sd, ...patch } : sd) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {splitters.length === 0 && (
        <p style={{ ...label, textAlign: 'center', padding: '24px 0' }}>Nenhum splitter. Clique em "+ Splitter".</p>
      )}
      {splitters.map((s, si) => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ ...label, color: 'rgba(255,255,255,0.6)', minWidth: 60 }}>Splitter {si + 1}</span>
            <input value={s.nome} onChange={e => updateSplitter(s.id, { nome: e.target.value })} placeholder="Nome" style={{ ...fieldIn, flex: 1, minWidth: 100 }} />
            <select value={s.tipo} onChange={e => changeTipo(s.id, e.target.value)} style={{ ...fieldIn, width: 80 }}>
              {SPLITTER_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => removeSplitter(s.id)} style={btnDel}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...label, color: '#2563eb' }}>Entrada</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div>
                <p style={{ ...label, marginBottom: 3 }}>Tubo</p>
                <input type="number" min={1} value={s.entrada.tubo}
                  onChange={e => updateSplitter(s.id, { entrada: { ...s.entrada, tubo: +e.target.value } })}
                  style={{ ...fieldIn, width: 60 }} />
              </div>
              <div>
                <p style={{ ...label, marginBottom: 3 }}>Fibra (1–12)</p>
                <input type="number" min={1} max={12} value={s.entrada.fibra}
                  onChange={e => updateSplitter(s.id, { entrada: { ...s.entrada, fibra: +e.target.value } })}
                  style={{ ...fieldIn, width: 60 }} />
              </div>
              <FibraColorDot fibra={s.entrada.fibra} />
            </div>
          </div>

          <p style={{ ...label, color: '#16a34a', marginBottom: 6 }}>Saídas ({s.saidas.length} portas)</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {s.saidas.map(sd => (
              <div key={sd.porta} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 10px' }}>
                <p style={{ ...label, marginBottom: 4, color: '#86efac' }}>Porta {sd.porta}</p>
                <input value={sd.cliente} onChange={e => updateSaida(s.id, sd.porta, { cliente: e.target.value })}
                  placeholder="Nome do cliente" style={{ ...fieldIn, marginBottom: 4 }} />
                <input value={sd.obs} onChange={e => updateSaida(s.id, sd.porta, { obs: e.target.value })}
                  placeholder="Obs" style={{ ...fieldIn }} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={addSplitter} style={{ ...btnAdd, alignSelf: 'flex-start', padding: '7px 16px', fontSize: 12 }}>+ Splitter</button>
    </div>
  )
}

// ─── Aba Caminho (visualização da topologia) ──────────────────────────────────
function TopoNode({ tipo, label: lbl, sub, color }) {
  return (
    <div style={{ backgroundColor: `${color}18`, border: `1px solid ${color}55`, borderRadius: 8, padding: '6px 12px', textAlign: 'center', flexShrink: 0 }}>
      <p style={{ fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{tipo}</p>
      <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{lbl}</p>
      {sub && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{sub}</p>}
    </div>
  )
}
function Arrow() { return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16, padding: '0 6px' }}>→</span> }

function TabCaminho({ ctoData, upstream, bandejas, splitters }) {
  const capacidade = ctoData?.capacidade ?? 8

  const chain = []
  chain.push({ tipo: 'OLT', label: '—', color: '#6366f1' })
  if (upstream?.type === 'cto') {
    chain.push({ tipo: 'CTO', label: upstream.id, sub: upstream.nome !== upstream.id ? upstream.nome : null, color: '#0284c7' })
  } else if (upstream?.type === 'cdo' || ctoData.cdo_id) {
    chain.push({ tipo: upstream?.tipo ?? 'CDO/CE', label: upstream?.id ?? ctoData.cdo_id, sub: ctoData.porta_cdo != null ? `porta ${ctoData.porta_cdo}` : null, color: '#7c3aed' })
  }
  splitters.forEach(s => chain.push({ tipo: 'Splitter', label: s.tipo || s.nome || '—', color: '#f97316' }))
  chain.push({ tipo: 'CTO', label: ctoData.cto_id, sub: `${capacidade} portas`, color: '#16a34a' })

  const totalFusoes = bandejas.reduce((acc, b) => acc + (b.fusoes?.length ?? 0), 0)
  const totalClientes = splitters.reduce((acc, s) => acc + (s.saidas ?? []).filter(sd => sd.cliente?.trim()).length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={card}>
        <p style={{ ...label, marginBottom: 12, color: 'rgba(255,255,255,0.5)' }}>Cadeia de fibra</p>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 8 }}>
          {chain.map((node, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <Arrow />}
              <TopoNode tipo={node.tipo} label={node.label} sub={node.sub} color={node.color} />
            </span>
          ))}
        </div>
      </div>

      <div style={card}>
        <p style={{ ...label, marginBottom: 10, color: 'rgba(255,255,255,0.5)' }}>Resumo do diagrama</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { v: bandejas.length,  l: 'Bandejas',  c: '#2563eb' },
            { v: totalFusoes,      l: 'Fusões',     c: '#7c3aed' },
            { v: splitters.length, l: 'Splitters',  c: '#ea580c' },
            { v: totalClientes,    l: 'Clientes',   c: '#16a34a' },
          ].map(({ v, l, c }) => (
            <div key={l} style={{ textAlign: 'center', backgroundColor: `${c}11`, border: `1px solid ${c}44`, borderRadius: 8, padding: '8px 16px', minWidth: 70 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</p>
              <p style={{ ...label, color: `${c}aa` }}>{l}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <p style={{ ...label, marginBottom: 10, color: 'rgba(255,255,255,0.5)' }}>Cores ABNT NBR 14721</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {getActiveAbnt().map(c => (
            <div key={c.idx} style={{ display: 'flex', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.03)', border: `1px solid ${c.hex}44`, borderRadius: 6, padding: '4px 8px' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c.hex, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: c.hex, fontWeight: 600 }}>{c.idx} – {c.nome}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────
const TABS = ['Caminho', 'Bandejas', 'Splitters']

export default function ModalDiagrama({ ctoData, projetoId, onClose, onSaved }) {
  const abntCores = useFiberColors()
  const abntCor   = (idx) => abntCores.find(c => c.idx === idx)
  const [tab,      setTab]      = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [erro,     setErro]     = useState(null)
  const [upstream, setUpstream] = useState(null)
  const [bandejas, setBandejas] = useState([])
  const [splitters,setSplitters]= useState([])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setErro(null)
      try {
        const data = await getDiagramaCTO(ctoData.cto_id, projetoId)
        if (mounted && data) {
          setUpstream(data.upstream ?? null)
          setBandejas(data.diagrama?.bandejas  ?? [])
          setSplitters(data.diagrama?.splitters ?? [])
        }
      } catch (e) {
        if (mounted) setErro(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [ctoData.cto_id, projetoId])

  async function salvar() {
    setSaving(true)
    setErro(null)
    try {
      await saveDiagramaCTO({
        cto_id: ctoData.cto_id,
        projeto_id: projetoId,
        diagrama: { bandejas, splitters },
      })
      onSaved?.()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={overlay}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={panel} className="rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={label}>Diagrama ABNT — CTO</p>
              <p style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700 }}>
                {ctoData.nome || ctoData.cto_id}
              </p>
            </div>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 22, lineHeight: 1, padding: 4 }} className="hover:text-white transition-colors">✕</button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)} style={{
                fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
                backgroundColor: tab === i ? 'rgba(255,255,255,0.10)' : 'transparent',
                border: tab === i ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                color: tab === i ? '#e2e8f0' : 'rgba(255,255,255,0.35)',
                transition: 'all .15s',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px 0', fontSize: 13 }}>
              Carregando diagrama...
            </div>
          )}
          {erro && (
            <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 12 }}>
              {erro}
            </div>
          )}
          {!loading && (
            <>
              {tab === 0 && <TabCaminho ctoData={ctoData} upstream={upstream} bandejas={bandejas} splitters={splitters} />}
              {tab === 1 && <TabBandejas bandejas={bandejas} onChange={setBandejas} />}
              {tab === 2 && <TabSplitters splitters={splitters} onChange={setSplitters} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '8px 20px', borderRadius: 8 }}
            className="hover:bg-white/5 transition-colors">
            Fechar
          </button>
          {tab !== 0 && (
            <button onClick={salvar} disabled={saving}
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 13, padding: '8px 24px', borderRadius: 8 }}
              className="disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar Diagrama'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
