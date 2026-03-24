'use client'

/**
 * DiagramaCTOEditor.js
 * Editor ABNT para CTO com bandejas de fusão, splitters e portas.
 * Fluxo: Entrada do cabo → Bandeja (fusões) → Splitter 1xN → Portas (clientes)
 *        Fusões podem também ir para CTO em cascata ou portas diretas.
 */

import { useState, useEffect } from 'react'
import { getDiagramaCTO, saveDiagramaCTO } from '@/actions/ctos'
import { useTheme } from '@/contexts/ThemeContext'

// ─── ABNT NBR 14721 ───────────────────────────────────────────────────────────
// Sequência: Verde · Amarelo · Branco · Azul · Vermelho · Violeta ·
//            Marrom · Rosa · Preto · Cinza · Laranja · Aqua
const ABNT = [
  { idx: 1,  nome: 'Verde',    hex: '#16a34a', text: '#dcfce7' },
  { idx: 2,  nome: 'Amarelo',  hex: '#ca8a04', text: '#fef9c3' },
  { idx: 3,  nome: 'Branco',   hex: '#94a3b8', text: '#f1f5f9' },
  { idx: 4,  nome: 'Azul',     hex: '#2563eb', text: '#dbeafe' },
  { idx: 5,  nome: 'Vermelho', hex: '#dc2626', text: '#fee2e2' },
  { idx: 6,  nome: 'Violeta',  hex: '#7c3aed', text: '#ede9fe' },
  { idx: 7,  nome: 'Marrom',   hex: '#92400e', text: '#fef3c7' },
  { idx: 8,  nome: 'Rosa',     hex: '#db2777', text: '#fce7f3' },
  { idx: 9,  nome: 'Preto',    hex: '#1e293b', text: '#cbd5e1' },
  { idx: 10, nome: 'Cinza',    hex: '#6b7280', text: '#f3f4f6' },
  { idx: 11, nome: 'Laranja',  hex: '#ea580c', text: '#ffedd5' },
  { idx: 12, nome: 'Aqua',     hex: '#0891b2', text: '#cffafe' },
]

const SPLITTER_TIPOS = ['1x2', '1x4', '1x8', '1x16', '1x32']
function uid() { return Math.random().toString(36).slice(2, 9) }

// ─── Estilos ──────────────────────────────────────────────────────────────────
function getStyles(isDark) {
  const BG    = isDark ? '#0d1117' : '#ffffff'
  const BG2   = isDark ? '#161b22' : '#f8fafc'
  const BG3   = isDark ? '#1c2333' : '#f1f5f9'
  const BR    = isDark ? '#30363d' : '#e2e8f0'
  const TEXT  = isDark ? '#e6edf3' : '#1e293b'
  const MUTED = isDark ? '#8b949e' : '#64748b'

  return {
    wrap:     { backgroundColor: BG, border: `1px solid ${BR}`, borderRadius: 12, color: TEXT, overflow: 'hidden' },
    header:   { backgroundColor: BG2, borderBottom: `1px solid ${BR}`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
    tabBar:   { backgroundColor: BG2, borderBottom: `1px solid ${BR}`, display: 'flex', overflowX: 'auto' },
    tabBtn:   (a, c) => ({ padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', backgroundColor: 'transparent', border: 'none', borderBottom: a ? `2px solid ${c}` : '2px solid transparent', color: a ? c : MUTED, whiteSpace: 'nowrap', transition: 'all .15s' }),
    body:     { padding: '20px', minHeight: 280 },
    sec:      { backgroundColor: BG2, border: `1px solid ${BR}`, borderRadius: 10, padding: '14px 16px', marginBottom: 12 },
    secTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, margin: 0 },
    inp:      { backgroundColor: BG3, border: `1px solid ${BR}`, color: TEXT, borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
    inpSm:    { backgroundColor: BG3, border: `1px solid ${BR}`, color: TEXT, borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' },
    lbl:      { fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, display: 'block', marginBottom: 3 },
    btnAdd:   { background: 'linear-gradient(135deg,#238636,#1a7f37)', color: '#fff', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' },
    btnDel:   { backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.4)', color: '#f85149', fontSize: 11, borderRadius: 6, padding: '4px 9px', cursor: 'pointer', whiteSpace: 'nowrap' },
    btnSave:  { background: 'linear-gradient(135deg,#1f6feb,#1158c7)', color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 8, padding: '9px 24px', cursor: 'pointer', border: 'none' },
    chip:     (c) => ({ backgroundColor: `${c}18`, border: `1px solid ${c}44`, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: c }),
    // expose palette for inline uses within JSX
    _BG: BG, _BG2: BG2, _BG3: BG3, _BR: BR, _TEXT: TEXT, _MUTED: MUTED,
  }
}

function FibraSelect({ value, onChange }) {
  const cur = ABNT.find(a => a.idx === Number(value)) ?? ABNT[0]
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))}
      style={{ backgroundColor: cur.hex, color: cur.text, border: `1px solid ${cur.hex}88`, borderRadius: 5, padding: '4px 6px', fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none', minWidth: 105 }}>
      {ABNT.map(c => (
        <option key={c.idx} value={c.idx} style={{ backgroundColor: c.hex, color: c.text, fontWeight: 700 }}>
          {c.idx}. {c.nome}
        </option>
      ))}
    </select>
  )
}

function BandejaCTOSvg({ fusoes, splitters, isDark }) {
  const W = 520, PAD = 16, ROW_H = 28
  const ENT_X = 30, FUS_X = 180, DEST_X = 380
  const H = PAD * 2 + Math.max(fusoes.length, 1) * ROW_H + 24
  const bg = isDark ? '#0d1117' : '#f8fafc'
  const borderC = isDark ? '#21262d' : '#e2e8f0'
  const textC = isDark ? '#8b949e' : '#64748b'

  function abntColor(cor) {
    return ABNT[(((cor ?? 1) - 1) + 12) % 12]?.hex ?? '#374151'
  }
  function tipoColor(tipo) {
    if (tipo === 'splitter') return '#7c3aed'
    if (tipo === 'cascata')  return '#0891b2'
    if (tipo === 'direto')   return '#16a34a'
    return '#374151'
  }
  function tipoLabel(f) {
    if (f.tipo === 'splitter') {
      const spl = splitters.find(s => s.id === f.ref_id)
      return spl ? `SPL ${spl.tipo}` : 'SPL ?'
    }
    if (f.tipo === 'cascata') return f.ref_id ? `CTO ${f.ref_id.slice(0, 8)}` : 'CTO ?'
    if (f.tipo === 'direto')  return 'Direta'
    return 'Livre'
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', borderRadius: 8, backgroundColor: bg, border: `1px solid ${borderC}`, maxWidth: W }}>
      <text x={ENT_X} y={12} fontSize={8} fill={textC} textAnchor="middle" fontFamily="system-ui" letterSpacing={1}>ENTRADA</text>
      <text x={FUS_X} y={12} fontSize={8} fill={textC} textAnchor="middle" fontFamily="system-ui" letterSpacing={1}>FUSÕES</text>
      <text x={DEST_X} y={12} fontSize={8} fill={textC} textAnchor="middle" fontFamily="system-ui" letterSpacing={1}>DESTINO</text>

      {fusoes.length === 0 && (
        <text x={W / 2} y={H / 2 + 4} fontSize={11} fill={textC} textAnchor="middle" fontFamily="system-ui">Sem fusões</text>
      )}

      {fusoes.map((f, i) => {
        const y = PAD + 20 + i * ROW_H + ROW_H / 2
        const entC = abntColor(f.cor)
        const midC = tipoColor(f.tipo)
        const isLivre = f.tipo === 'livre'
        const strokeW = isLivre ? 1 : 1.5
        const opacity = isLivre ? 0.35 : 1

        return (
          <g key={f.id} opacity={opacity}>
            <line x1={ENT_X + 8} y1={y} x2={FUS_X - 12} y2={y}
              stroke={entC} strokeWidth={strokeW} strokeLinecap="round" />
            <line x1={FUS_X + 12} y1={y} x2={DEST_X - 30} y2={y}
              stroke={isLivre ? '#374151' : midC} strokeWidth={strokeW} strokeLinecap="round"
              strokeDasharray={isLivre ? '4,3' : undefined} />
            <circle cx={ENT_X} cy={y} r={7} fill={entC} />
            <text x={ENT_X} y={y + 3.5} fontSize={8} fill="#fff" textAnchor="middle" fontFamily="monospace" fontWeight="bold">{f.cor ?? '?'}</text>
            <circle cx={FUS_X} cy={y} r={10} fill={isDark ? '#161b22' : '#fff'} stroke={midC} strokeWidth={2} />
            <text x={FUS_X} y={y + 3.5} fontSize={8} fill={midC} textAnchor="middle" fontFamily="monospace" fontWeight="bold">
              {f.tipo === 'splitter' ? 'S' : f.tipo === 'cascata' ? 'C' : f.tipo === 'direto' ? 'D' : '○'}
            </text>
            <text x={4} y={y + 3.5} fontSize={8} fill={textC} fontFamily="monospace">#{f.pos}</text>
            <rect x={DEST_X - 28} y={y - 9} width={80} height={18} rx={4}
              fill={isLivre ? 'transparent' : midC + '18'} stroke={isLivre ? '#37415133' : midC + '55'} />
            <text x={DEST_X - 28 + 4} y={y + 4} fontSize={9} fill={isLivre ? textC : midC} fontFamily="system-ui" fontWeight={isLivre ? 400 : 700}>
              {tipoLabel(f)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function FluxoDiagramaInterno({ bandejas, splitters, entrada, ctoId, isDark, BG, BG2, BG3, BR, TEXT, MUTED }) {
  function tipoColor(tipo) {
    if (tipo === 'splitter') return '#7c3aed'
    if (tipo === 'cascata')  return '#0891b2'
    if (tipo === 'direto')   return '#16a34a'
    return MUTED
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Cable entry card */}
      <div style={{ backgroundColor: BG2, border: '1px solid rgba(8,145,178,0.4)', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Entrada do Cabo</span>
        {entrada.cdo_id && <span style={{ fontSize: 10, color: MUTED }}>CDO: {entrada.cdo_id} · porta {entrada.porta_cdo || '?'}</span>}
        {entrada.cabo_id && <span style={{ fontSize: 10, color: MUTED }}>Cabo: {entrada.cabo_id}</span>}
      </div>

      {/* Arrow down */}
      <div style={{ textAlign: 'left', paddingLeft: 20, color: MUTED, fontSize: 12, lineHeight: 1 }}>↓</div>

      {/* Bandejas */}
      {bandejas.map(b => (
        <div key={b.id} style={{ backgroundColor: BG2, border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{b.nome}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {b.fusoes.map((f, fi) => {
              const abnt = ABNT[(((f.cor ?? 1) - 1) + 12) % 12]
              const spl = f.tipo === 'splitter' ? splitters.find(s => s.id === f.ref_id) : null
              const splIdx = spl ? splitters.indexOf(spl) + 1 : null
              const isLivre = f.tipo === 'livre'
              const col = tipoColor(f.tipo)
              const prefix = fi < b.fusoes.length - 1 ? '┣━' : '┗━'
              return (
                <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: isLivre ? 0.45 : 1 }}>
                    <span style={{ fontSize: 10, color: MUTED, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{prefix} Fusão #{f.pos}</span>
                    <span style={{ backgroundColor: abnt?.hex, color: abnt?.text ?? '#fff', borderRadius: 3, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>{abnt?.nome}</span>
                    {!isLivre && <span style={{ color: MUTED, fontSize: 10 }}>→</span>}
                    {f.tipo === 'splitter' && spl  && <span style={{ fontSize: 10, fontWeight: 700, color: col }}>SPL {splIdx} ({spl.tipo})</span>}
                    {f.tipo === 'splitter' && !spl && <span style={{ fontSize: 10, fontWeight: 700, color: '#f85149' }}>? splitter não vinculado</span>}
                    {f.tipo === 'cascata' && <span style={{ fontSize: 10, fontWeight: 700, color: col }}>CTO cascata: {f.ref_id || '?'}</span>}
                    {f.tipo === 'direto'  && <span style={{ fontSize: 10, fontWeight: 700, color: col }}>Porta direta</span>}
                    {isLivre && <span style={{ fontSize: 10, color: MUTED }}>Livre</span>}
                  </div>
                  {/* Splitter ports expanded */}
                  {f.tipo === 'splitter' && spl && spl.saidas?.length > 0 && (
                    <div style={{ marginLeft: 24, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {spl.saidas.map(sd => {
                        const occupied = sd.cliente?.trim()
                        return (
                          <div key={sd.num} style={{ backgroundColor: occupied ? 'rgba(34,197,94,0.12)' : BG3, border: `1px solid ${occupied ? '#22c55e55' : BR}`, borderRadius: 4, padding: '2px 6px', fontSize: 9, color: occupied ? '#86efac' : MUTED, fontWeight: occupied ? 600 : 400, whiteSpace: 'nowrap' }}>
                            P{sd.num}: {occupied ? sd.cliente.trim() : 'vago'}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {b.fusoes.length === 0 && <span style={{ fontSize: 10, color: MUTED, fontStyle: 'italic' }}>Sem fusões</span>}
          </div>
        </div>
      ))}
      {bandejas.length === 0 && <p style={{ fontSize: 12, color: MUTED }}>Nenhuma bandeja configurada.</p>}
    </div>
  )
}

function buildBandejaPadrao(n = 1) {
  return {
    id: uid(), nome: `Bandeja ${n}`,
    fusoes: Array.from({ length: 12 }, (_, i) => ({
      id: uid(), pos: i + 1, cor: (i % 12) + 1,
      tipo: 'livre', ref_id: null,
    })),
  }
}

export default function DiagramaCTOEditor({ ctoId, projetoId, capacidadePortas, initialDiagrama, caixas = [] }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const S = getStyles(isDark)
  const { _BG: BG, _BG2: BG2, _BG3: BG3, _BR: BR, _TEXT: TEXT, _MUTED: MUTED } = S

  const [aba, setAba] = useState('bandejas')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [carregando, setCarregando] = useState(!initialDiagrama)

  const [entrada, setEntrada] = useState({
    cabo_id: '', fibras: 12, cdo_id: '', porta_cdo: '', splitter_cto: '',
    ...(initialDiagrama?.entrada ?? {}),
  })
  const [bandejas, setBandejas] = useState(() => {
    if (initialDiagrama?.bandejas?.length) return initialDiagrama.bandejas
    return [buildBandejaPadrao(1)]
  })
  const [splitters, setSplitters] = useState(() => initialDiagrama?.splitters ?? [])
  const [visualBandejas, setVisualBandejas] = useState({})

  useEffect(() => {
    if (initialDiagrama) return
    let cancel = false
    setCarregando(true)
    getDiagramaCTO(ctoId, projetoId)
      .then(res => {
        if (cancel || !res?.diagrama) return
        const d = res.diagrama
        setEntrada(p => ({ ...p, ...(d.entrada ?? {}) }))
        if (d.bandejas?.length) setBandejas(d.bandejas)
        if (d.splitters?.length) setSplitters(d.splitters)
      })
      .catch(e => { if (!cancel) setErro(e.message) })
      .finally(() => { if (!cancel) setCarregando(false) })
    return () => { cancel = true }
  }, [ctoId, projetoId, initialDiagrama])

  async function salvar() {
    if (saving) return
    setSaving(true); setErro(null); setSucesso(null)
    try {
      // Build legacy portas for backward compat (getCTOs reads diagrama.portas)
      const portasObj = {}
      let n = 1
      for (const s of splitters) {
        for (const sd of (s.saidas ?? [])) {
          portasObj[String(n++)] = { cliente: sd.cliente?.trim() || null, obs: sd.obs || null, ativo: true }
        }
      }
      const res = await saveDiagramaCTO({
        cto_id: ctoId, projeto_id: projetoId,
        diagrama: { entrada, bandejas, splitters, portas: portasObj },
      })
      setSucesso(res?.saved ? 'Diagrama salvo!' : 'Salvo.')
      setTimeout(() => setSucesso(null), 4000)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fiberops:topologia-changed'))
    } catch (e) {
      setErro('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Operações de bandeja ──────────────────────────────────────────────────
  const addBandeja = () => setBandejas(p => [...p, buildBandejaPadrao(p.length + 1)])
  const removeBandeja = id => setBandejas(p => p.filter(b => b.id !== id))
  const renameBandeja = (id, nome) => setBandejas(p => p.map(b => b.id !== id ? b : { ...b, nome }))
  const updateFusao = (bandId, fusId, ch) =>
    setBandejas(p => p.map(b => b.id !== bandId ? b : {
      ...b, fusoes: b.fusoes.map(f => f.id !== fusId ? f : { ...f, ...ch }),
    }))
  const addFusao = bandId =>
    setBandejas(p => p.map(b => {
      if (b.id !== bandId) return b
      const pos = b.fusoes.length + 1
      return { ...b, fusoes: [...b.fusoes, { id: uid(), pos, cor: ((pos - 1) % 12) + 1, tipo: 'livre', ref_id: null }] }
    }))
  const removeFusao = (bandId, fusId) =>
    setBandejas(p => p.map(b => b.id !== bandId ? b : { ...b, fusoes: b.fusoes.filter(f => f.id !== fusId) }))

  // ── Operações de splitter ─────────────────────────────────────────────────
  const addSplitter = () =>
    setSplitters(p => [...p, {
      id: uid(), tipo: '1x8', fusao_id: null,
      saidas: Array.from({ length: 8 }, (_, i) => ({ num: i + 1, cliente: '', obs: '' })),
    }])
  const removeSplitter = id => setSplitters(p => p.filter(s => s.id !== id))
  const updateSplitter = (id, ch) => setSplitters(p => p.map(s => s.id !== id ? s : { ...s, ...ch }))
  const changeTipo = (id, tipo) => {
    const count = parseInt(tipo.split('x')[1])
    setSplitters(p => p.map(s => {
      if (s.id !== id) return s
      return { ...s, tipo, saidas: Array.from({ length: count }, (_, i) => ({ num: i + 1, cliente: s.saidas?.[i]?.cliente ?? '', obs: s.saidas?.[i]?.obs ?? '' })) }
    }))
  }
  const updateSaida = (splId, num, ch) =>
    setSplitters(p => p.map(s => s.id !== splId ? s : { ...s, saidas: s.saidas.map(sd => sd.num !== num ? sd : { ...sd, ...ch }) }))

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalPortas = splitters.reduce((s, x) => s + (x.saidas?.length ?? 0), 0)
  const portasOcupadas = splitters.reduce((s, x) => s + (x.saidas?.filter(sd => sd.cliente?.trim())?.length ?? 0), 0)

  const TABS = [
    { id: 'bandejas',  label: 'Bandejas',  cor: '#0891b2' },
    { id: 'splitters', label: 'Splitters', cor: '#7c3aed' },
    { id: 'portas',    label: 'Portas',    cor: '#16a34a' },
    { id: 'entrada',   label: 'Entrada',   cor: '#d97706' },
    { id: 'resumo',    label: 'Resumo',    cor: '#6366f1' },
    { id: 'fluxo',     label: 'Fluxo',     cor: '#0891b2' },
  ]

  if (carregando) return (
    <div style={S.wrap}><div style={S.body}>
      <p style={{ color: MUTED, fontSize: 13 }}>Carregando diagrama...</p>
    </div></div>
  )

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0 }}>Diagrama — {ctoId}</p>
          <p style={{ fontSize: 11, color: MUTED, margin: '3px 0 0' }}>
            {bandejas.length} bandeja(s) · {splitters.length} splitter(s) · {portasOcupadas}/{totalPortas} portas
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {sucesso && <span style={{ fontSize: 12, color: '#3fb950' }}>{sucesso}</span>}
          {erro    && <span style={{ fontSize: 12, color: '#f85149' }}>{erro}</span>}
          <button onClick={salvar} disabled={saving} style={{ ...S.btnSave, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setAba(t.id)} style={S.tabBtn(aba === t.id, t.cor)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={S.body}>

        {/* ─── BANDEJAS ─────────────────────────────────────────── */}
        {aba === 'bandejas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={S.secTitle}>Bandejas de fusão · {bandejas.reduce((s, b) => s + b.fusoes.length, 0)} fusão(ões)</p>
              <button onClick={addBandeja} style={S.btnAdd}>+ Bandeja</button>
            </div>
            {bandejas.length === 0 && <p style={{ color: MUTED, fontSize: 13 }}>Clique em "+ Bandeja" para adicionar.</p>}
            {bandejas.map(b => (
              <div key={b.id} style={S.sec}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <input value={b.nome} onChange={e => renameBandeja(b.id, e.target.value)}
                    style={{ ...S.inp, width: 140, fontWeight: 700, fontSize: 13 }} />
                  <span style={{ fontSize: 11, color: MUTED }}>{b.fusoes.length} fusão(ões)</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setVisualBandejas(v => ({ ...v, [b.id]: !v[b.id] }))}
                      title={visualBandejas[b.id] ? 'Vista lista' : 'Vista visual'}
                      style={{ ...S.btnAdd, background: visualBandejas[b.id] ? 'rgba(88,166,255,0.2)' : 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.3)', color: '#58a6ff', padding: '4px 8px', fontSize: 13 }}>
                      {visualBandejas[b.id] ? '📋' : '🖼️'}
                    </button>
                    <button onClick={() => addFusao(b.id)} style={S.btnAdd}>+ Fusão</button>
                    <button onClick={() => removeBandeja(b.id)} style={S.btnDel}>✕</button>
                  </div>
                </div>
                {visualBandejas[b.id] ? (
                  <div style={{ marginTop: 8, overflowX: 'auto' }}>
                    <BandejaCTOSvg fusoes={b.fusoes} splitters={splitters} isDark={isDark} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {b.fusoes.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: BG3, border: `1px solid ${BR}`, borderRadius: 7, padding: '8px 10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: MUTED, minWidth: 22, fontWeight: 700 }}>#{f.pos}</span>
                        <FibraSelect value={f.cor} onChange={v => updateFusao(b.id, f.id, { cor: v })} />
                        <select value={f.tipo} onChange={e => updateFusao(b.id, f.id, { tipo: e.target.value, ref_id: null })}
                          style={{ ...S.inpSm, width: 135 }}>
                          <option value="livre">Livre</option>
                          <option value="splitter">→ Splitter</option>
                          <option value="cascata">→ CTO Cascata</option>
                          <option value="direto">→ Porta Direta</option>
                        </select>
                        {f.tipo === 'splitter' && (
                          <select value={f.ref_id ?? ''} onChange={e => updateFusao(b.id, f.id, { ref_id: e.target.value || null })}
                            style={{ ...S.inpSm, width: 160 }}>
                            <option value="">Selecionar splitter</option>
                            {splitters.map((s, si) => (
                              <option key={s.id} value={s.id}>Splitter {si + 1} ({s.tipo})</option>
                            ))}
                          </select>
                        )}
                        {f.tipo === 'cascata' && (
                          <input value={f.ref_id ?? ''} onChange={e => updateFusao(b.id, f.id, { ref_id: e.target.value })}
                            placeholder="ID da CTO cascata" style={{ ...S.inpSm, width: 150 }} />
                        )}
                        <button onClick={() => removeFusao(b.id, f.id)} style={{ ...S.btnDel, marginLeft: 'auto' }}>✕</button>
                      </div>
                    ))}
                    {b.fusoes.length === 0 && <p style={{ color: MUTED, fontSize: 12, padding: '4px 0' }}>Nenhuma fusão. Clique em "+ Fusão".</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── SPLITTERS ────────────────────────────────────────── */}
        {aba === 'splitters' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={S.secTitle}>{splitters.length} splitter(s)</p>
              <button onClick={addSplitter} style={S.btnAdd}>+ Splitter</button>
            </div>
            {splitters.length === 0 && <p style={{ color: MUTED, fontSize: 13 }}>Clique em "+ Splitter". Cada splitter recebe 1 fusão da bandeja e distribui N portas.</p>}
            {splitters.map((s, si) => {
              const fusaoInfo = (() => {
                for (const b of bandejas) {
                  const f = b.fusoes.find(f => f.id === s.fusao_id)
                  if (f) { const c = ABNT[f.cor - 1]; return `${b.nome} · #${f.pos} ${c?.nome ?? ''}` }
                }
                return null
              })()
              const ocup = s.saidas?.filter(sd => sd.cliente?.trim()).length ?? 0
              return (
                <div key={s.id} style={S.sec}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div>
                      <label style={S.lbl}>Tipo</label>
                      <select value={s.tipo} onChange={e => changeTipo(s.id, e.target.value)} style={{ ...S.inpSm, width: 85 }}>
                        {SPLITTER_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <label style={S.lbl}>Fusão de entrada (bandeja)</label>
                      <select value={s.fusao_id ?? ''} onChange={e => updateSplitter(s.id, { fusao_id: e.target.value || null })}
                        style={{ ...S.inpSm, width: '100%' }}>
                        <option value="">Selecionar fusão</option>
                        {bandejas.map(b => b.fusoes.map(f => {
                          const c = ABNT[f.cor - 1]
                          return <option key={f.id} value={f.id}>{b.nome} / #{f.pos} — {c?.nome}</option>
                        }))}
                      </select>
                    </div>
                    {fusaoInfo && <span style={S.chip('#7c3aed')}>↑ {fusaoInfo}</span>}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: ocup > 0 ? '#86efac' : MUTED }}>{ocup}/{s.saidas?.length ?? 0} ocupadas</span>
                      <button onClick={() => removeSplitter(s.id)} style={S.btnDel}>✕ Remover</button>
                    </div>
                  </div>
                  {/* Saídas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 6 }}>
                    {(s.saidas ?? []).map(sd => (
                      <div key={sd.num} style={{ backgroundColor: sd.cliente?.trim() ? 'var(--card-bg-active)' : BG, border: `1px solid ${sd.cliente?.trim() ? '#2563eb' : BR}`, borderRadius: 7, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#7dd3fc' }}>Porta {sd.num}</span>
                          {sd.cliente?.trim() && <button onClick={() => updateSaida(s.id, sd.num, { cliente: '' })} style={{ fontSize: 10, color: MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>Limpar</button>}
                        </div>
                        <input value={sd.cliente ?? ''} onChange={e => updateSaida(s.id, sd.num, { cliente: e.target.value })}
                          placeholder="Vaga livre" style={{ ...S.inp, fontSize: 12, borderColor: sd.cliente?.trim() ? '#2563eb' : BR }} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ─── PORTAS (visão consolidada) ───────────────────────── */}
        {aba === 'portas' && (
          <div>
            <p style={{ ...S.secTitle, marginBottom: 14 }}>Todas as portas — {portasOcupadas}/{totalPortas} ocupadas</p>
            {splitters.length === 0 && <p style={{ color: MUTED, fontSize: 13 }}>Configure splitters primeiro na aba "Splitters".</p>}
            {splitters.map((s, si) => {
              const fusaoNome = (() => {
                for (const b of bandejas) {
                  const f = b.fusoes.find(f => f.id === s.fusao_id)
                  if (f) return `${b.nome} · Fusão #${f.pos}`
                }
                return 'Fusão não vinculada'
              })()
              const ocup = s.saidas?.filter(sd => sd.cliente?.trim()).length ?? 0
              return (
                <div key={s.id} style={S.sec}>
                  <p style={{ ...S.secTitle, marginBottom: 10 }}>
                    Splitter {si + 1} — {s.tipo} &nbsp;·&nbsp; {fusaoNome} &nbsp;·&nbsp; {ocup}/{s.saidas?.length ?? 0} ocupadas
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 6 }}>
                    {(s.saidas ?? []).map(sd => (
                      <div key={sd.num} style={{ backgroundColor: sd.cliente?.trim() ? 'var(--card-bg-active)' : BG, border: `1px solid ${sd.cliente?.trim() ? '#2563eb' : BR}`, borderRadius: 7, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#7dd3fc' }}>Splitter {si + 1} · Porta {sd.num}</span>
                          {sd.cliente?.trim() && <button onClick={() => updateSaida(s.id, sd.num, { cliente: '' })} style={{ fontSize: 10, color: MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>Limpar</button>}
                        </div>
                        <input value={sd.cliente ?? ''} onChange={e => updateSaida(s.id, sd.num, { cliente: e.target.value })}
                          placeholder="Vaga livre" style={{ ...S.inp, fontSize: 12, borderColor: sd.cliente?.trim() ? '#2563eb' : BR }} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ─── ENTRADA ──────────────────────────────────────────── */}
        {aba === 'entrada' && (
          <div>
            <div style={S.sec}>
              <p style={{ ...S.secTitle, marginBottom: 12 }}>Cabo de entrada</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>ID do Cabo</label>
                  <input value={entrada.cabo_id ?? ''} onChange={e => setEntrada(p => ({ ...p, cabo_id: e.target.value }))} style={S.inp} placeholder="ex: CB-001" />
                </div>
                <div>
                  <label style={S.lbl}>Nº de Fibras</label>
                  <input type="number" value={entrada.fibras ?? 12} onChange={e => setEntrada(p => ({ ...p, fibras: Number(e.target.value) }))} style={S.inp} min={1} max={144} />
                </div>
              </div>
            </div>
            <div style={S.sec}>
              <p style={{ ...S.secTitle, marginBottom: 12 }}>Vinculação CDO/CE pai</p>

              {/* CDO dropdown — se caixas disponíveis, usa select; senão input livre */}
              <div style={{ marginBottom: 12 }}>
                <label style={S.lbl}>CDO / CE pai</label>
                {caixas.length > 0 ? (
                  <select
                    value={entrada.cdo_id ?? ''}
                    onChange={e => setEntrada(p => ({ ...p, cdo_id: e.target.value, porta_cdo: '', splitter_cto: '' }))}
                    style={S.inp}
                  >
                    <option value="">— Selecionar CDO/CE —</option>
                    {caixas.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome ? `${c.nome} (${c.id})` : c.id}{c.tipo ? ` · ${c.tipo}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={entrada.cdo_id ?? ''} onChange={e => setEntrada(p => ({ ...p, cdo_id: e.target.value }))} style={S.inp} placeholder="ex: CDO-001" />
                )}
              </div>

              {/* Splitters disponíveis do CDO selecionado */}
              {(() => {
                const cdoSel = caixas.find(c => c.id === entrada.cdo_id)
                const splitters = cdoSel?.diagrama?.splitters ?? []
                if (!cdoSel || splitters.length === 0) return null

                // Portas livres de cada splitter (saídas sem cto_id, excluindo esta própria CTO)
                const portasLivres = splitters.flatMap(spl =>
                  (spl.saidas ?? [])
                    .filter(sd => !sd.cto_id?.trim() || sd.cto_id === ctoId)
                    .map(sd => ({ splNome: spl.nome ?? spl.id, splId: spl.id, porta: sd.porta, tipo: spl.tipo }))
                )

                return (
                  <div style={{ backgroundColor: `${BG3}`, border: `1px solid ${BR}`, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <p style={{ ...S.secTitle, marginBottom: 8, color: '#e3b341' }}>Saídas disponíveis em {cdoSel.nome ?? cdoSel.id}</p>
                    {portasLivres.length === 0
                      ? <p style={{ fontSize: 11, color: MUTED }}>Nenhuma saída livre nos splitters deste CDO.</p>
                      : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {portasLivres.map((p, i) => {
                            const isSel = entrada.splitter_cto === p.splNome && String(entrada.porta_cdo) === String(p.porta)
                            return (
                              <button key={i}
                                onClick={() => setEntrada(prev => ({ ...prev, splitter_cto: p.splNome, porta_cdo: p.porta }))}
                                style={{
                                  padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 5, cursor: 'pointer',
                                  border: `1px solid ${isSel ? '#e3b341' : BR}`,
                                  backgroundColor: isSel ? 'rgba(227,179,65,0.15)' : BG,
                                  color: isSel ? '#e3b341' : MUTED,
                                }}>
                                {p.splNome} S{p.porta}
                              </button>
                            )
                          })}
                        </div>
                      )
                    }
                  </div>
                )
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Porta no CDO / Splitter</label>
                  <input type="number" value={entrada.porta_cdo ?? ''} onChange={e => setEntrada(p => ({ ...p, porta_cdo: e.target.value }))} style={S.inp} min={1} placeholder="1" />
                </div>
                <div>
                  <label style={S.lbl}>Splitter CTO (referência)</label>
                  <input value={entrada.splitter_cto ?? ''} onChange={e => setEntrada(p => ({ ...p, splitter_cto: e.target.value }))} style={S.inp} placeholder="ex: 1:8 ou SPL-01" />
                </div>
              </div>

              <p style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
                ℹ️ Ao salvar, a CTO será automaticamente vinculada ao CDO informado na topologia.
              </p>
            </div>
          </div>
        )}

        {/* ─── RESUMO ───────────────────────────────────────────── */}
        {aba === 'resumo' && (() => {
          const pct = totalPortas > 0 ? Math.round((portasOcupadas / totalPortas) * 100) : 0
          const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'
          return (
            <div>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
                {[
                  ['Bandejas', bandejas.length, '#0891b2'],
                  ['Fusões', bandejas.reduce((s, b) => s + b.fusoes.length, 0), '#7c3aed'],
                  ['Splitters', splitters.length, '#d97706'],
                  ['Total portas', totalPortas, '#16a34a'],
                  ['Ocupadas', portasOcupadas, barColor],
                  ['Livres', totalPortas - portasOcupadas, 'var(--text-muted)'],
                ].map(([label, val, cor]) => (
                  <div key={label} style={{ backgroundColor: BG2, border: `1px solid ${BR}`, borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color: cor, margin: 0 }}>{val}</p>
                    <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 0' }}>{label}</p>
                  </div>
                ))}
              </div>
              {/* Barra de ocupação */}
              {totalPortas > 0 && (
                <div style={{ ...S.sec, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ocupação</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: barColor }}>{portasOcupadas}/{totalPortas} ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4 }}>
                    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: barColor, borderRadius: 4, transition: 'width .5s' }} />
                  </div>
                </div>
              )}
              {/* Diagrama de Fluxo Interno */}
              <div style={S.sec}>
                <p style={{ ...S.secTitle, marginBottom: 12 }}>Diagrama de Fluxo Interno</p>
                <FluxoDiagramaInterno
                  bandejas={bandejas}
                  splitters={splitters}
                  entrada={entrada}
                  ctoId={ctoId}
                  isDark={isDark}
                  BG={BG} BG2={BG2} BG3={BG3} BR={BR} TEXT={TEXT} MUTED={MUTED}
                />
              </div>

              {/* Fluxo visual */}
              <div style={S.sec}>
                <p style={{ ...S.secTitle, marginBottom: 12 }}>Fluxo da rede</p>
                {entrada.cdo_id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={S.chip('#0891b2')}>CDO: {entrada.cdo_id} · porta {entrada.porta_cdo || '?'}</span>
                    <span style={{ color: MUTED }}>→</span>
                    <span style={S.chip('#16a34a')}>CTO: {ctoId}</span>
                  </div>
                )}
                {bandejas.map(b => (
                  <div key={b.id} style={{ backgroundColor: 'rgba(8,145,178,0.05)', border: '1px solid rgba(8,145,178,0.15)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', margin: '0 0 7px' }}>{b.nome}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {b.fusoes.map(f => {
                        const c = ABNT[f.cor - 1]
                        const spl = f.tipo === 'splitter' ? splitters.find(s => s.id === f.ref_id) : null
                        const splIdx = splitters.indexOf(spl) + 1
                        return (
                          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 3, backgroundColor: BG3, border: `1px solid ${BR}`, borderRadius: 5, padding: '3px 7px', fontSize: 10 }}>
                            <span style={{ backgroundColor: c?.hex, color: c?.text, borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>{c?.nome}</span>
                            <span style={{ color: MUTED }}>→</span>
                            {f.tipo === 'splitter' && spl  && <span style={{ color: '#c4b5fd', fontWeight: 700 }}>Spl {splIdx} ({spl.tipo})</span>}
                            {f.tipo === 'splitter' && !spl && <span style={{ color: '#f85149', fontWeight: 700 }}>? splitter</span>}
                            {f.tipo === 'cascata' && <span style={{ color: '#86efac', fontWeight: 700 }}>CTO {f.ref_id || '?'}</span>}
                            {f.tipo === 'direto'  && <span style={{ color: '#7dd3fc', fontWeight: 700 }}>Direta</span>}
                            {f.tipo === 'livre'   && <span style={{ color: MUTED }}>Livre</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {splitters.map((s, si) => {
                  const ocup = s.saidas?.filter(sd => sd.cliente?.trim()).length ?? 0
                  return (
                    <div key={s.id} style={{ backgroundColor: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', margin: '0 0 6px' }}>Splitter {si + 1} — {s.tipo} &nbsp;·&nbsp; {ocup}/{s.saidas?.length ?? 0}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(s.saidas ?? []).map(sd => (
                          <span key={sd.num} style={{ fontSize: 10, backgroundColor: sd.cliente?.trim() ? 'var(--card-bg-active)' : BG3, border: `1px solid ${sd.cliente?.trim() ? '#2563eb' : BR}`, borderRadius: 4, padding: '2px 7px', color: sd.cliente?.trim() ? '#93c5fd' : MUTED, fontWeight: sd.cliente?.trim() ? 600 : 400 }}>
                            {sd.num}. {sd.cliente?.trim() || '—'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ─── FLUXO ────────────────────────────────────────────── */}
        {aba === 'fluxo' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={S.secTitle}>Topologia interna — visão completa</p>
              {entrada.cdo_id && (
                <span style={{ fontSize: 11, color: MUTED }}>CDO: {entrada.cdo_id} · porta {entrada.porta_cdo || '?'} → CTO: {ctoId}</span>
              )}
            </div>
            <FluxoDiagramaInterno
              bandejas={bandejas}
              splitters={splitters}
              entrada={entrada}
              ctoId={ctoId}
              isDark={isDark}
              BG={BG} BG2={BG2} BG3={BG3} BR={BR} TEXT={TEXT} MUTED={MUTED}
            />
          </div>
        )}

      </div>
    </div>
  )
}
