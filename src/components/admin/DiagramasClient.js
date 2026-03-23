'use client'

/**
 * DiagramasClient.js
 * Seletor e orquestrador de diagramas CTO, CE/CDO e gerenciamento de OLTs.
 */

import { useState, useEffect, useRef } from 'react'
import DiagramaCTOEditor from '@/components/admin/DiagramaCTOEditor'
import DiagramaCDOEditor from '@/components/admin/DiagramaCDOEditor'
import { upsertOLT, deleteOLT, saveOLTDio, getOLTs } from '@/actions/olts'

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
const S = {
  container: { color: 'var(--foreground)' },
  tabBar: {
    display: 'flex', gap: '4px', marginBottom: '24px',
    borderBottom: '1px solid var(--border-color)', paddingBottom: '0',
  },
  tabAtiva: {
    backgroundColor: '#0284c7', color: '#fff',
    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    borderBottom: '2px solid #0284c7',
    borderRadius: '8px 8px 0 0', padding: '10px 24px',
    fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '-1px',
  },
  tabInativa: {
    backgroundColor: 'transparent', color: 'var(--text-muted)',
    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    borderBottom: '2px solid transparent',
    borderRadius: '8px 8px 0 0', padding: '10px 24px',
    fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginBottom: '-1px',
  },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' },
  cardItem: {
    backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px',
    padding: '14px 18px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', cursor: 'pointer',
  },
  cardItemAtivo: {
    backgroundColor: 'var(--card-bg-active)', border: '1px solid #0284c7', borderRadius: '10px',
    padding: '14px 18px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', cursor: 'pointer',
  },
  cardItemNome: { fontSize: '14px', fontWeight: '600', color: 'var(--foreground)' },
  cardItemSub:  { fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' },
  badge:      { fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--border-color)', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' },
  badgeAtivo: { fontSize: '12px', color: '#7dd3fc', backgroundColor: '#1e3a5f', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' },
  vazio:      { color: 'var(--text-muted)', fontSize: '14px', padding: '24px', textAlign: 'center', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px' },
  sectionTitle: { fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '12px' },
  inp:        { backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color-strong)', color: 'var(--foreground)', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  lbl:        { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 },
  btnSave:    { background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 13, borderRadius: 8, padding: '9px 22px', cursor: 'pointer', border: 'none' },
  btnDel:     { backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 11, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function calcOcupacaoCTO(cto) {
  let ocupadas = 0
  const portas = cto.diagrama?.portas
  if (portas) for (const p of Object.values(portas)) if (p?.cliente) ocupadas++
  return { ocupadas, total: cto.capacidade || 0 }
}

function calcOcupacaoCDO(caixa) {
  // Novo formato: splitters
  const splitters = caixa.diagrama?.splitters
  if (splitters) {
    let ligadas = 0, total = 0
    for (const s of splitters) {
      for (const sd of (s.saidas ?? [])) { total++; if (sd?.cto_id) ligadas++ }
    }
    return { utilizadas: ligadas, total }
  }
  // Legado
  let utilizadas = 0
  const saidas = caixa.diagrama?.saidas
  if (saidas) for (const s of Object.values(saidas)) if (s?.cto_id) utilizadas++
  return { utilizadas, total: caixa.capacidade || 0 }
}

// ---------------------------------------------------------------------------
// Items de lista
// ---------------------------------------------------------------------------
function ItemCTO({ cto, ativo, onClick }) {
  const { ocupadas, total } = calcOcupacaoCTO(cto)
  return (
    <div style={ativo ? S.cardItemAtivo : S.cardItem} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div>
        <p style={S.cardItemNome}>{cto.nome ?? cto.cto_id}</p>
        <p style={S.cardItemSub}>{cto.cto_id}</p>
      </div>
      <span style={ativo ? S.badgeAtivo : S.badge}>{ocupadas}/{total} portas</span>
    </div>
  )
}

function ItemCDO({ caixa, ativo, onClick }) {
  const { utilizadas, total } = calcOcupacaoCDO(caixa)
  const idCaixa = caixa.ce_id ?? caixa.id ?? ''
  return (
    <div style={ativo ? S.cardItemAtivo : S.cardItem} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div>
        <p style={S.cardItemNome}>{caixa.nome ?? idCaixa}</p>
        <p style={S.cardItemSub}>{idCaixa}{caixa.tipo ? ` · ${caixa.tipo.toUpperCase()}` : ''}</p>
      </div>
      <span style={ativo ? S.badgeAtivo : S.badge}>{utilizadas}/{total} saídas</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gerenciador de OLTs
// ---------------------------------------------------------------------------
const OLT_STATUS = ['ativo', 'inativo', 'em_manutencao']

function OLTsManager({ olts: initialOlts, projetoId, readOnly = false }) {
  const [olts, setOlts]             = useState(initialOlts)
  const [form, setForm]             = useState({ olt_id: '', nome: '', modelo: '', ip: '', capacidade: 16, status: 'ativo' })
  const [editando, setEditando]     = useState(null)
  const [adicionando, setAdicionando] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [erro, setErro]             = useState(null)
  const [sucesso, setSucesso]       = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [dioAberto, setDioAberto]   = useState(null) // olt.id com DIO expandido

  const FORM_VAZIO = { olt_id: '', nome: '', modelo: '', ip: '', capacidade: 16, status: 'ativo' }
  const STATUS_COLOR = { ativo: '#22c55e', inativo: '#ef4444', em_manutencao: '#f59e0b' }
  const STATUS_LABEL = { ativo: 'Ativo', inativo: 'Inativo', em_manutencao: 'Manutenção' }

  // Fetch fresh OLTs on mount to avoid stale data after navigation
  useEffect(() => {
    getOLTs(projetoId).then(fresh => setOlts(fresh)).catch(() => {})
  }, [projetoId])

  async function refreshOlts() {
    try {
      const fresh = await getOLTs(projetoId)
      setOlts(fresh)
    } catch (_) {}
  }

  function iniciarEdicao(olt) {
    setAdicionando(false)
    setEditando(olt.id)
    setForm({ olt_id: olt.id, nome: olt.nome ?? '', modelo: olt.modelo ?? '', ip: olt.ip ?? '', capacidade: olt.capacidade ?? 16, status: olt.status ?? 'ativo' })
    setSucesso(null); setErro(null)
  }
  function cancelar() {
    setEditando(null); setAdicionando(false)
    setForm(FORM_VAZIO); setErro(null)
  }

  async function salvarOLT(e) {
    e.preventDefault()
    if (!form.olt_id.trim() || !form.nome.trim()) { setErro('ID e Nome são obrigatórios.'); return }
    setSaving(true); setErro(null); setSucesso(null)
    try {
      const res = await upsertOLT({ olt_id: form.olt_id.trim(), nome: form.nome.trim(), modelo: form.modelo.trim() || null, ip: form.ip.trim() || null, capacidade: Number(form.capacidade) || 16, status: form.status, projeto_id: projetoId })
      setOlts(prev => { const idx = prev.findIndex(o => o.id === res.id); if (idx >= 0) { const arr = [...prev]; arr[idx] = res; return arr } return [...prev, res] })
      setSucesso(`OLT "${res.nome}" salva!`)
      setTimeout(() => setSucesso(null), 3000)
      cancelar()
    } catch (e) { setErro('Erro: ' + e.message) } finally { setSaving(false) }
  }

  async function removerOLT(oltId) {
    setSaving(true); setErro(null)
    try {
      await deleteOLT(oltId, projetoId)
      setOlts(prev => prev.filter(o => o.id !== oltId))
      setConfirmDel(null)
      if (editando === oltId) cancelar()
    } catch (e) { setErro('Erro ao remover: ' + e.message) } finally { setSaving(false) }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Equipamentos OLT</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{olts.length} OLT(s) cadastrada(s)</p>
        </div>
        {!readOnly && !adicionando && !editando && (
          <button onClick={() => setAdicionando(true)}
            style={{ background: 'linear-gradient(135deg,#0284c7,#0369a1)', color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 8, padding: '9px 20px', cursor: 'pointer', border: 'none' }}>
            + Nova OLT
          </button>
        )}
      </div>

      {/* Feedback */}
      {sucesso && <div style={{ backgroundColor: '#052e16', border: '1px solid #166534', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80', marginBottom: 12 }}>{sucesso}</div>}
      {erro    && <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 12 }}>{erro}</div>}

      {/* Form nova OLT */}
      {adicionando && (
        <div style={{ backgroundColor: 'var(--card-bg-active)', border: '1px solid #0284c7', borderRadius: 10, padding: '18px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#7dd3fc', marginBottom: 14 }}>Nova OLT</p>
          <OLTForm form={form} onChange={setForm} onSubmit={salvarOLT} onCancel={cancelar} saving={saving} />
        </div>
      )}

      {/* Lista */}
      {olts.length === 0 && !adicionando && (
        <div style={S.vazio}>Nenhuma OLT cadastrada. Clique em "+ Nova OLT".</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {olts.map(olt => {
          const stColor = STATUS_COLOR[olt.status] ?? '#94a3b8'
          const stLabel = STATUS_LABEL[olt.status] ?? olt.status
          const cap = olt.capacidade ?? 16
          return (
            <div key={olt._id ?? olt.id}>
              {editando === olt.id ? (
                <div style={{ backgroundColor: 'var(--card-bg-active)', border: '1px solid #0284c7', borderRadius: 10, padding: '18px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#7dd3fc', marginBottom: 14 }}>Editando: {olt.nome}</p>
                  <OLTForm form={form} onChange={setForm} onSubmit={salvarOLT} onCancel={cancelar} saving={saving} editMode />
                </div>
              ) : (
                <div style={{ backgroundColor: 'var(--card-bg)', border: `1px solid var(--border-color)`, borderLeft: `3px solid ${stColor}`, borderRadius: 10, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    {/* Info principal */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>{olt.nome}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: stColor, backgroundColor: `${stColor}18`, border: `1px solid ${stColor}40`, borderRadius: 4, padding: '2px 7px' }}>{stLabel}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{olt.id}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {olt.modelo && (
                          <div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Modelo</span>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{olt.modelo}</p>
                          </div>
                        )}
                        {olt.ip && (
                          <div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>IP</span>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: 1 }}>{olt.ip}</p>
                          </div>
                        )}
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Portas PON</span>
                          <p style={{ fontSize: 12, color: '#7dd3fc', fontWeight: 700, marginTop: 1 }}>{cap}</p>
                        </div>
                      </div>
                    </div>
                    {/* Ações */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0 }}>
                      <button onClick={() => setDioAberto(dioAberto === olt.id ? null : olt.id)}
                        style={{ backgroundColor: dioAberto === olt.id ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${dioAberto === olt.id ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.1)'}`,
                          color: dioAberto === olt.id ? '#f97316' : '#94a3b8',
                          fontSize: 11, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
                        DIO {dioAberto === olt.id ? '▲' : '▼'}
                      </button>
                      {!readOnly && (
                        <button onClick={() => iniciarEdicao(olt)}
                          style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 11, borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
                          Editar
                        </button>
                      )}
                      {!readOnly && (confirmDel === olt.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => removerOLT(olt.id)} disabled={saving}
                            style={{ backgroundColor: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', border: 'none' }}>
                            Confirmar
                          </button>
                          <button onClick={() => setConfirmDel(null)} style={S.btnDel}>Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(olt.id)} style={S.btnDel}>Excluir</button>
                      ))}
                    </div>
                  </div>
                  {/* DIO expandido */}
                  {dioAberto === olt.id && (
                    <OLTDioManager key={olt.id} olt={olt} projetoId={projetoId} onSaved={refreshOlts} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DIO manager por OLT
// ---------------------------------------------------------------------------
function OLTDioManager({ olt, projetoId, onSaved }) {
  const inicial    = olt.dio_config ?? { total: 48, mapa: [] }
  const [cfg, setCfg]       = useState({ total: inicial.total ?? 48, mapa: inicial.mapa ?? [] })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState(null)
  const [addPorta, setAddPorta] = useState('')

  // Sync cfg when parent refreshes olt data after save
  useEffect(() => {
    const d = olt.dio_config ?? { total: 48, mapa: [] }
    setCfg({ total: d.total ?? 48, mapa: d.mapa ?? [] })
  }, [olt.dio_config])

  const mapaIdx  = Object.fromEntries(cfg.mapa.map(m => [m.porta, m]))

  function updPorta(porta, patch) {
    const existe = cfg.mapa.find(m => m.porta === porta)
    const novo   = existe
      ? cfg.mapa.map(m => m.porta === porta ? { ...m, ...patch } : m)
      : [...cfg.mapa, { porta, pon: null, local: '', ...patch }]
    setCfg(c => ({ ...c, mapa: novo }))
  }
  function remPorta(porta) { setCfg(c => ({ ...c, mapa: c.mapa.filter(m => m.porta !== porta) })) }

  async function salvar() {
    setSaving(true); setMsg(null)
    try {
      const res = await saveOLTDio(olt.id, projetoId, cfg)
      if (res?.matched === false) {
        setMsg({ ok: false, text: `OLT "${olt.id}" não encontrada no banco. Verifique o ID.` })
      } else {
        setMsg({ ok: true, text: 'DIO salvo com sucesso!' })
        setTimeout(() => setMsg(null), 3000)
        onSaved?.()
      }
    } catch (e) { setMsg({ ok: false, text: 'Erro: ' + e.message }) } finally { setSaving(false) }
  }

  const livre = addPorta && !mapaIdx[+addPorta]

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 12, paddingTop: 14 }}>
      {/* Header DIO */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.07em' }}>DIO — Mapa de Portas</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total:</span>
            <input type="number" min={1} max={256} value={cfg.total}
              onChange={e => setCfg(c => ({ ...c, total: +e.target.value || 48 }))}
              style={{ ...S.inp, width: 60, padding: '3px 7px', fontSize: 12 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>portas</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {msg && <span style={{ fontSize: 12, color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</span>}
          <button onClick={salvar} disabled={saving}
            style={{ ...S.btnSave, padding: '6px 16px', fontSize: 12, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar DIO'}
          </button>
        </div>
      </div>

      {/* Tabela de portas configuradas */}
      {cfg.mapa.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 420 }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                <th style={{ padding: '6px 8px', color: '#f97316', fontWeight: 700, textAlign: 'center', width: 56 }}>Porta</th>
                <th style={{ padding: '6px 8px', color: '#8957e5', fontWeight: 700, textAlign: 'center', width: 80 }}>PON</th>
                <th style={{ padding: '6px 8px', color: '#58a6ff', fontWeight: 700, textAlign: 'left' }}>Local / Destino</th>
                <th style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {[...cfg.mapa].sort((a, b) => a.porta - b.porta).map(m => (
                <tr key={m.porta} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#f97316',
                      background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                      borderRadius: 5, padding: '2px 8px', fontFamily: 'monospace' }}>
                      D{m.porta}
                    </span>
                  </td>
                  <td style={{ padding: '5px 6px' }}>
                    <input type="number" min={1} value={m.pon ?? ''}
                      onChange={e => updPorta(m.porta, { pon: e.target.value ? +e.target.value : null })}
                      placeholder="PON"
                      style={{ ...S.inp, padding: '4px 6px', fontSize: 12, width: '100%',
                        borderColor: m.pon != null ? '#8957e5' : '#374151' }} />
                  </td>
                  <td style={{ padding: '5px 6px' }}>
                    <input value={m.local ?? ''} onChange={e => updPorta(m.porta, { local: e.target.value })}
                      placeholder="ex: Rua das Flores nº 120"
                      style={{ ...S.inp, padding: '4px 8px', fontSize: 12,
                        borderColor: m.local ? '#58a6ff' : '#374151' }} />
                  </td>
                  <td style={{ padding: '5px 4px' }}>
                    <button onClick={() => remPorta(m.porta)}
                      style={{ ...S.btnDel, padding: '3px 8px', fontSize: 12 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cfg.mapa.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Nenhuma porta configurada. Adicione abaixo.
        </p>
      )}

      {/* Adicionar porta */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Adicionar porta:</span>
        <select value={addPorta} onChange={e => setAddPorta(e.target.value)}
          style={{ ...S.inp, width: 90, padding: '4px 6px', fontSize: 12, borderColor: livre ? '#f97316' : '#374151' }}>
          <option value="">— D? —</option>
          {Array.from({ length: cfg.total }, (_, i) => {
            const p = i + 1
            const usado = !!mapaIdx[p]
            return <option key={p} value={p} disabled={usado}>{p}{usado ? ' [-]' : ''}</option>
          })}
        </select>
        <button onClick={() => { if (livre) { updPorta(+addPorta, {}); setAddPorta('') } }}
          disabled={!livre}
          style={{ backgroundColor: livre ? '#ea580c' : '#374151', color: '#fff', fontWeight: 700, fontSize: 12,
            borderRadius: 6, padding: '5px 14px', cursor: livre ? 'pointer' : 'default', border: 'none',
            opacity: livre ? 1 : 0.5 }}>
          + Porta
        </button>
        {addPorta && !livre && <span style={{ fontSize: 11, color: '#f87171' }}>Porta já configurada</span>}
      </div>
    </div>
  )
}

function OLTForm({ form, onChange, onSubmit, onCancel, saving, editMode }) {
  const S_FORM = {
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
  }
  return (
    <form onSubmit={onSubmit}>
      <div style={S_FORM.grid2}>
        <div>
          <label style={S.lbl}>ID da OLT *</label>
          <input value={form.olt_id} onChange={e => onChange({ ...form, olt_id: e.target.value })}
            placeholder="ex: OLT-01" style={S.inp} disabled={editMode} />
        </div>
        <div>
          <label style={S.lbl}>Nome *</label>
          <input value={form.nome} onChange={e => onChange({ ...form, nome: e.target.value })}
            placeholder="ex: OLT Central" style={S.inp} />
        </div>
      </div>
      <div style={S_FORM.grid3}>
        <div>
          <label style={S.lbl}>Modelo</label>
          <input value={form.modelo} onChange={e => onChange({ ...form, modelo: e.target.value })}
            placeholder="ex: Huawei MA5800" style={S.inp} />
        </div>
        <div>
          <label style={S.lbl}>IP de Gerência</label>
          <input value={form.ip} onChange={e => onChange({ ...form, ip: e.target.value })}
            placeholder="ex: 192.168.1.1" style={S.inp} />
        </div>
        <div>
          <label style={S.lbl}>Portas PON</label>
          <input type="number" min={1} value={form.capacidade}
            onChange={e => onChange({ ...form, capacidade: +e.target.value })} style={S.inp} />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={S.lbl}>Status</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['ativo','Ativo','#22c55e'], ['inativo','Inativo','#ef4444'], ['em_manutencao','Manutenção','#f59e0b']].map(([val, label, cor]) => (
            <button key={val} type="button" onClick={() => onChange({ ...form, status: val })}
              style={{
                fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
                backgroundColor: form.status === val ? `${cor}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${form.status === val ? cor : 'rgba(255,255,255,0.08)'}`,
                color: form.status === val ? cor : '#64748b', cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving} style={{ ...S.btnSave, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Salvando...' : editMode ? 'Atualizar OLT' : 'Adicionar OLT'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            style={{ border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 13, padding: '9px 18px', borderRadius: 8, cursor: 'pointer', backgroundColor: 'transparent' }}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Modal de edição
// ---------------------------------------------------------------------------
function EditorModal({ title, onClose, children }) {
  // Fecha com Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          width: '100%', maxWidth: 780,
          marginTop: 24, marginBottom: 24,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do modal */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--sidebar-bg)',
        }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#0284c7', margin: 0 }}>{title}</p>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border-color)', borderRadius: 8,
              color: 'var(--text-muted)', fontSize: 18, width: 32, height: 32,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 0 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function DiagramasClient({ ctos, caixas, olts = [], projetoId, tabInicial, idInicial, userRole }) {
  const readOnly = userRole === 'tecnico'
  const [aba, setAba] = useState(tabInicial ?? 'olts')
  const [ctoModal, setCTOModal]     = useState(null)   // CTO aberta no modal
  const [cdoModal, setCDOModal]     = useState(null)   // CDO/CE aberta no modal

  // Auto-seleciona item se veio via URL (ex: clique no mapa)
  useEffect(() => {
    if (!idInicial) return
    if (tabInicial === 'ctos') {
      const found = ctos.find(c => c.cto_id === idInicial)
      if (found) setCTOModal(found)
    } else if (tabInicial === 'cdos') {
      const found = caixas.find(c => (c.ce_id ?? c.id) === idInicial)
      if (found) setCDOModal(found)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const idCDOModal = cdoModal ? (cdoModal.ce_id ?? cdoModal.id ?? '') : ''

  return (
    <div style={S.container}>
      {/* Modal CTO */}
      {ctoModal && (
        <EditorModal
          title={`Editando CTO: ${ctoModal.nome ?? ctoModal.cto_id}`}
          onClose={() => setCTOModal(null)}
        >
          <DiagramaCTOEditor
            key={ctoModal.cto_id}
            ctoId={ctoModal.cto_id}
            projetoId={projetoId}
            capacidadePortas={ctoModal.capacidade ?? 0}
            initialDiagrama={ctoModal.diagrama ?? null}
          />
        </EditorModal>
      )}

      {/* Modal CDO/CE */}
      {cdoModal && (
        <EditorModal
          title={`Editando ${cdoModal.tipo ?? 'CDO'}: ${cdoModal.nome ?? idCDOModal}`}
          onClose={() => setCDOModal(null)}
        >
          <DiagramaCDOEditor
            key={idCDOModal}
            ceId={idCDOModal}
            projetoId={projetoId}
            capacidadeSaidas={cdoModal.capacidade ?? 0}
            olts={olts}
          />
        </EditorModal>
      )}

      {/* Abas */}
      <div style={S.tabBar}>
        <button style={aba === 'olts'  ? S.tabAtiva : S.tabInativa}
          onClick={() => setAba('olts')}>
          OLTs ({olts.length})
        </button>
        <button style={aba === 'cdos'  ? S.tabAtiva : S.tabInativa}
          onClick={() => setAba('cdos')}>
          CEO / CDOs ({caixas.length})
        </button>
        <button style={aba === 'ctos'  ? S.tabAtiva : S.tabInativa}
          onClick={() => setAba('ctos')}>
          CTOs ({ctos.length})
        </button>
      </div>

      {/* Aba CTOs */}
      {aba === 'ctos' && (
        <div>
          <p style={S.sectionTitle}>
            {readOnly ? 'Visualizando CTOs (somente leitura)' : 'Clique em uma CTO para editar o diagrama'}
          </p>
          {ctos.length === 0
            ? <div style={S.vazio}>Nenhuma CTO cadastrada.</div>
            : <div style={S.lista}>{ctos.map(cto => (
                <ItemCTO key={cto._id} cto={cto} ativo={false}
                  onClick={readOnly ? undefined : () => setCTOModal(cto)} />
              ))}</div>
          }
        </div>
      )}

      {/* Aba CDOs/CEs */}
      {aba === 'cdos' && (
        <div>
          <p style={S.sectionTitle}>
            {readOnly ? 'Visualizando CE/CDOs (somente leitura)' : 'Clique em uma CE/CDO para editar o diagrama'}
          </p>
          {caixas.length === 0
            ? <div style={S.vazio}>Nenhuma CE/CDO cadastrada.</div>
            : <div style={S.lista}>{caixas.map(caixa => (
                <ItemCDO key={caixa._id} caixa={caixa} ativo={false}
                  onClick={readOnly ? undefined : () => setCDOModal(caixa)} />
              ))}</div>
          }
        </div>
      )}

      {/* Aba OLTs */}
      {aba === 'olts' && (
        <OLTsManager olts={olts} projetoId={projetoId} readOnly={readOnly} />
      )}
    </div>
  )
}
