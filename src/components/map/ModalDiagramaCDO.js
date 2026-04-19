'use client'

import { useEffect, useState } from 'react'
import { getDiagramaCaixa, saveDiagramaCaixa } from '@/actions/caixas'
import { useFiberColors } from '@/contexts/FiberColorContext'

const SPLITTER_TIPOS = ['1x2', '1x4', '1x8', '1x16', '1x32']

// ---------------------------------------------------------------------------
// Estilos base
// ---------------------------------------------------------------------------
const overlay  = { backgroundColor: 'rgba(0,0,0,0.88)' }
const panel    = { backgroundColor: 'rgba(8,13,28,0.99)', border: '1px solid rgba(255,255,255,0.08)', width: 'min(720px,100%)', maxHeight: '92vh' }
const label    = { fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }
const fieldIn  = { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', fontSize: 12, outline: 'none', borderRadius: 6, padding: '5px 8px', width: '100%' }
const card     = { backgroundColor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }
const btnAdd   = { background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '5px 12px' }
const btnDel   = { backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 11, borderRadius: 6, padding: '4px 8px' }

function uid() { return Math.random().toString(36).slice(2, 9) }

// ---------------------------------------------------------------------------
// Seletor de cor ABNT
// ---------------------------------------------------------------------------
function ColorPicker({ value, onChange }) {
  const abntCores = useFiberColors()
  const cor = abntCores.find(c => c.idx === value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {abntCores.map(c => (
        <button
          key={c.idx}
          title={`${c.idx} – ${c.nome}`}
          onClick={() => onChange(c.idx)}
          style={{
            width: 18, height: 18, borderRadius: '50%',
            backgroundColor: c.hex,
            border: value === c.idx ? '2px solid #fff' : '2px solid transparent',
            outline: value === c.idx ? `2px solid ${c.hex}` : 'none',
            flexShrink: 0,
            transition: 'transform .1s',
            transform: value === c.idx ? 'scale(1.25)' : 'scale(1)',
          }}
        />
      ))}
      {cor && (
        <span style={{ ...label, marginLeft: 4, color: cor.hex, fontWeight: 700 }}>
          {cor.idx} – {cor.nome}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aba: Bandejas
// ---------------------------------------------------------------------------
function TabBandejas({ bandejas, onChange }) {
  function addBandeja() {
    onChange([...bandejas, { id: uid(), nome: `Bandeja ${bandejas.length + 1}`, fusoes: [] }])
  }
  function removeBandeja(id) {
    onChange(bandejas.filter(b => b.id !== id))
  }
  function updateBandeja(id, patch) {
    onChange(bandejas.map(b => b.id === id ? { ...b, ...patch } : b))
  }
  function addFusao(bId) {
    const b = bandejas.find(b => b.id === bId)
    const nova = { id: uid(), entrada: { tubo: 1, fibra: 1 }, saida: { tubo: 1, fibra: 1 }, tipo: 'fusao', obs: '' }
    updateBandeja(bId, { fusoes: [...b.fusoes, nova] })
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
        <p style={{ ...label, textAlign: 'center', padding: '24px 0' }}>Nenhuma bandeja. Clique em "+ Bandeja" para adicionar.</p>
      )}
      {bandejas.map((b, bi) => (
        <div key={b.id} style={card}>
          {/* Header da bandeja */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ ...label, color: 'rgba(255,255,255,0.6)', minWidth: 70 }}>Bandeja {bi + 1}</span>
            <input
              value={b.nome}
              onChange={e => updateBandeja(b.id, { nome: e.target.value })}
              placeholder="Nome da bandeja"
              style={{ ...fieldIn, flex: 1 }}
            />
            <button onClick={() => addFusao(b.id)} style={btnAdd}>+ Fusão</button>
            <button onClick={() => removeBandeja(b.id)} style={btnDel}>✕</button>
          </div>

          {/* Cabeçalho das colunas */}
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

          {/* Linhas de fusão */}
          {b.fusoes.map((f, fi) => (
            <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 80px 1fr 1fr 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              {/* Número */}
              <span style={{ ...label, textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>{fi + 1}</span>

              {/* Entrada: tubo */}
              <input
                type="number" min={1} max={99}
                value={f.entrada.tubo}
                onChange={e => updateFusao(b.id, f.id, { entrada: { ...f.entrada, tubo: +e.target.value } })}
                style={{ ...fieldIn, textAlign: 'center' }}
              />

              {/* Entrada: fibra / cor ABNT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  type="number" min={1} max={12}
                  value={f.entrada.fibra}
                  onChange={e => updateFusao(b.id, f.id, { entrada: { ...f.entrada, fibra: +e.target.value } })}
                  style={{ ...fieldIn, textAlign: 'center' }}
                />
                <FibraColorDot fibra={f.entrada.fibra} />
              </div>

              {/* Tipo */}
              <select
                value={f.tipo}
                onChange={e => updateFusao(b.id, f.id, { tipo: e.target.value })}
                style={{ ...fieldIn, textAlign: 'center' }}
              >
                <option value="fusao">Fusão</option>
                <option value="conector">Conector</option>
                <option value="passthrough">Pass</option>
              </select>

              {/* Saída: tubo */}
              <input
                type="number" min={1} max={99}
                value={f.saida.tubo}
                onChange={e => updateFusao(b.id, f.id, { saida: { ...f.saida, tubo: +e.target.value } })}
                style={{ ...fieldIn, textAlign: 'center' }}
              />

              {/* Saída: fibra / cor ABNT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  type="number" min={1} max={12}
                  value={f.saida.fibra}
                  onChange={e => updateFusao(b.id, f.id, { saida: { ...f.saida, fibra: +e.target.value } })}
                  style={{ ...fieldIn, textAlign: 'center' }}
                />
                <FibraColorDot fibra={f.saida.fibra} />
              </div>

              {/* Remover fusão */}
              <button onClick={() => removeFusao(b.id, f.id)} style={{ ...btnDel, padding: '4px 6px' }}>✕</button>
            </div>
          ))}

          {b.fusoes.length === 0 && (
            <p style={{ ...label, textAlign: 'center', padding: '8px 0' }}>Sem fusões. Clique em "+ Fusão".</p>
          )}
        </div>
      ))}

      <button onClick={addBandeja} style={{ ...btnAdd, alignSelf: 'flex-start', padding: '7px 16px', fontSize: 12 }}>
        + Bandeja
      </button>
    </div>
  )
}

// Ponto colorido que mostra a cor ABNT da fibra
function FibraColorDot({ fibra }) {
  const abntCores = useFiberColors()
  const cor = abntCores.find(c => c.idx === fibra)
  if (!cor) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cor.hex, display: 'inline-block', flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
      <span style={{ ...label, color: cor.hex }}>{cor.nome}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aba: Splitters
// ---------------------------------------------------------------------------
function TabSplitters({ splitters, onChange }) {
  function addSplitter() {
    const saidas = Array.from({ length: 8 }, (_, i) => ({ porta: i + 1, cto_id: '', obs: '' }))
    onChange([...splitters, { id: uid(), nome: `Splitter ${splitters.length + 1}`, tipo: '1x8', entrada: { tubo: 1, fibra: 1 }, saidas }])
  }
  function removeSplitter(id) {
    onChange(splitters.filter(s => s.id !== id))
  }
  function updateSplitter(id, patch) {
    onChange(splitters.map(s => s.id === id ? { ...s, ...patch } : s))
  }
  function changeTipo(id, tipo) {
    const qtd = parseInt(tipo.split('x')[1])
    const saidas = Array.from({ length: qtd }, (_, i) => ({ porta: i + 1, cto_id: '', obs: '' }))
    updateSplitter(id, { tipo, saidas })
  }
  function updateSaida(sId, porta, patch) {
    const s = splitters.find(s => s.id === sId)
    updateSplitter(sId, { saidas: s.saidas.map(sd => sd.porta === porta ? { ...sd, ...patch } : sd) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {splitters.length === 0 && (
        <p style={{ ...label, textAlign: 'center', padding: '24px 0' }}>Nenhum splitter. Clique em "+ Splitter" para adicionar.</p>
      )}
      {splitters.map((s, si) => (
        <div key={s.id} style={card}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ ...label, color: 'rgba(255,255,255,0.6)', minWidth: 60 }}>Splitter {si + 1}</span>
            <input
              value={s.nome}
              onChange={e => updateSplitter(s.id, { nome: e.target.value })}
              placeholder="Nome"
              style={{ ...fieldIn, flex: 1, minWidth: 100 }}
            />
            <select
              value={s.tipo}
              onChange={e => changeTipo(s.id, e.target.value)}
              style={{ ...fieldIn, width: 80 }}
            >
              {SPLITTER_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => removeSplitter(s.id)} style={btnDel}>✕</button>
          </div>

          {/* Entrada */}
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

          {/* Saídas */}
          <p style={{ ...label, color: '#16a34a', marginBottom: 6 }}>Saídas ({s.saidas.length} portas)</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {s.saidas.map(sd => (
              <div key={sd.porta} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 10px' }}>
                <p style={{ ...label, marginBottom: 4, color: '#86efac' }}>Porta {sd.porta}</p>
                <input
                  value={sd.cto_id}
                  onChange={e => updateSaida(s.id, sd.porta, { cto_id: e.target.value })}
                  placeholder="ID da CTO"
                  style={{ ...fieldIn, marginBottom: 4 }}
                />
                <input
                  value={sd.obs}
                  onChange={e => updateSaida(s.id, sd.porta, { obs: e.target.value })}
                  placeholder="Obs"
                  style={{ ...fieldIn }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button onClick={addSplitter} style={{ ...btnAdd, alignSelf: 'flex-start', padding: '7px 16px', fontSize: 12 }}>
        + Splitter
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aba: Resumo
// ---------------------------------------------------------------------------
function TabResumo({ caixaData, bandejas, splitters }) {
  const totalFusoes = bandejas.reduce((acc, b) => acc + b.fusoes.length, 0)
  const totalSaidas = splitters.reduce((acc, s) => acc + s.saidas.filter(sd => sd.cto_id).length, 0)
  const totalPortas = splitters.reduce((acc, s) => acc + s.saidas.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Identidade */}
      <div style={card}>
        <p style={{ ...label, marginBottom: 10, color: 'rgba(255,255,255,0.5)' }}>Informações da Caixa</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Row label="ID" value={caixaData.id ?? caixaData.ce_id} />
          <Row label="Nome" value={caixaData.nome} />
          <Row label="Tipo" value={caixaData.tipo} />
          <Row label="Splitter" value={caixaData.splitter_cdo} />
          <Row label="OLT" value={caixaData.olt_id} />
          <Row label="Porta OLT" value={caixaData.porta_olt} />
        </div>
      </div>

      {/* Estatísticas do diagrama */}
      <div style={card}>
        <p style={{ ...label, marginBottom: 10, color: 'rgba(255,255,255,0.5)' }}>Diagrama</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Stat value={bandejas.length} label="Bandejas" color="#2563eb" />
          <Stat value={totalFusoes} label="Fusões" color="#7c3aed" />
          <Stat value={splitters.length} label="Splitters" color="#ea580c" />
          <Stat value={`${totalSaidas}/${totalPortas}`} label="Portas Ligadas" color="#16a34a" />
        </div>
      </div>

      {/* Topologia */}
      <div style={card}>
        <p style={{ ...label, marginBottom: 10, color: 'rgba(255,255,255,0.5)' }}>Topologia</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
          <TopoNode label="OLT" color="#6366f1" sub={caixaData.olt_id ? `Porta ${caixaData.porta_olt ?? '—'}` : null} />
          <Arrow />
          <TopoNode label={caixaData.tipo || 'CDO'} color="#7c3aed" sub={caixaData.nome || caixaData.id || caixaData.ce_id} />
          {splitters.map(s => (
            <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <Arrow />
              <TopoNode label={s.nome || `Splitter ${s.tipo}`} color="#ea580c" sub={s.tipo} />
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 4 }}>
                {s.saidas.filter(sd => sd.cto_id).map(sd => (
                  <span key={sd.porta} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <Arrow small />
                    <TopoNode label="CTO" color="#16a34a" sub={sd.cto_id} small />
                  </span>
                ))}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Legenda ABNT */}
      <div style={card}>
        <p style={{ ...label, marginBottom: 10, color: 'rgba(255,255,255,0.5)' }}>Cores ABNT NBR 14721</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {abntCores.map(c => (
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

function Row({ label: l, value }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>
      <span style={{ ...label }}>{l}</span>
      <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{String(value)}</span>
    </div>
  )
}

function Stat({ value, label: l, color }) {
  return (
    <div style={{ textAlign: 'center', backgroundColor: `${color}11`, border: `1px solid ${color}44`, borderRadius: 8, padding: '8px 16px', minWidth: 70 }}>
      <p style={{ fontSize: 20, fontWeight: 800, color }}>{value}</p>
      <p style={{ ...label, color: `${color}aa` }}>{l}</p>
    </div>
  )
}

function TopoNode({ label: l, color, sub, small }) {
  return (
    <div style={{ backgroundColor: `${color}18`, border: `1px solid ${color}55`, borderRadius: 8, padding: small ? '4px 8px' : '6px 12px', textAlign: 'center', flexShrink: 0 }}>
      <p style={{ fontSize: small ? 8 : 9, color, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{l}</p>
      {sub && <p style={{ color: '#e2e8f0', fontSize: small ? 9 : 11, fontWeight: 700 }}>{sub}</p>}
    </div>
  )
}

function Arrow({ small }) {
  return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: small ? 12 : 16, padding: '0 4px' }}>→</span>
}

// ---------------------------------------------------------------------------
// Modal principal
// ---------------------------------------------------------------------------
const TABS = ['Bandejas', 'Splitters', 'Resumo']

export default function ModalDiagramaCDO({ caixaData, projetoId, onClose, onSaved }) {
  const abntCores = useFiberColors()
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState(null)

  const [bandejas, setBandejas] = useState([])
  const [splitters, setSplitters] = useState([])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setErro(null)
      try {
        const data = await getDiagramaCaixa(caixaData.id ?? caixaData.ce_id, projetoId)
        if (mounted && data?.diagrama) {
          setBandejas(data.diagrama.bandejas ?? [])
          setSplitters(data.diagrama.splitters ?? [])
        }
      } catch (e) {
        if (mounted) setErro(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [caixaData.id, caixaData.ce_id, projetoId])

  async function salvar() {
    setSaving(true)
    setErro(null)
    try {
      await saveDiagramaCaixa({
        ce_id: caixaData.id ?? caixaData.ce_id,
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

  const ctoId = caixaData.id ?? caixaData.ce_id

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
              <p style={label}>Diagrama ABNT — {caixaData.tipo || 'CDO/CE'}</p>
              <p style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700 }}>
                {caixaData.nome || ctoId}
              </p>
            </div>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 22, lineHeight: 1, padding: 4 }} className="hover:text-white transition-colors">✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
                  backgroundColor: tab === i ? 'rgba(255,255,255,0.10)' : 'transparent',
                  border: tab === i ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                  color: tab === i ? '#e2e8f0' : 'rgba(255,255,255,0.35)',
                  transition: 'all .15s',
                }}
              >
                {t}
              </button>
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
              {tab === 0 && <TabBandejas bandejas={bandejas} onChange={setBandejas} />}
              {tab === 1 && <TabSplitters splitters={splitters} onChange={setSplitters} />}
              {tab === 2 && <TabResumo caixaData={caixaData} bandejas={bandejas} splitters={splitters} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '8px 20px', borderRadius: 8 }}
            className="hover:bg-white/5 transition-colors"
          >
            Fechar
          </button>
          {tab !== 2 && (
            <button
              onClick={salvar}
              disabled={saving}
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 13, padding: '8px 24px', borderRadius: 8 }}
              className="disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Diagrama'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
