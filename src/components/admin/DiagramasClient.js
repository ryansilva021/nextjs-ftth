'use client'

/**
 * DiagramasClient.js
 * Seletor e orquestrador de diagramas CTO, CE/CDO e gerenciamento de OLTs.
 */

import { useState } from 'react'
import DiagramaCTOEditor from '@/components/admin/DiagramaCTOEditor'
import DiagramaCDOEditor from '@/components/admin/DiagramaCDOEditor'
import { upsertOLT, deleteOLT } from '@/actions/olts'

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
const S = {
  container: { color: '#f1f5f9' },
  tabBar: {
    display: 'flex', gap: '4px', marginBottom: '24px',
    borderBottom: '1px solid #1f2937', paddingBottom: '0',
  },
  tabAtiva: {
    backgroundColor: '#0284c7', color: '#fff',
    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    borderBottom: '2px solid #0284c7',
    borderRadius: '8px 8px 0 0', padding: '10px 24px',
    fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '-1px',
  },
  tabInativa: {
    backgroundColor: 'transparent', color: '#64748b',
    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    borderBottom: '2px solid transparent',
    borderRadius: '8px 8px 0 0', padding: '10px 24px',
    fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginBottom: '-1px',
  },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' },
  cardItem: {
    backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px',
    padding: '14px 18px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', cursor: 'pointer',
  },
  cardItemAtivo: {
    backgroundColor: '#0c1a2e', border: '1px solid #0284c7', borderRadius: '10px',
    padding: '14px 18px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', cursor: 'pointer',
  },
  cardItemNome: { fontSize: '14px', fontWeight: '600', color: '#f1f5f9' },
  cardItemSub:  { fontSize: '12px', color: '#64748b', marginTop: '2px' },
  badge:      { fontSize: '12px', color: '#94a3b8', backgroundColor: '#1f2937', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' },
  badgeAtivo: { fontSize: '12px', color: '#7dd3fc', backgroundColor: '#1e3a5f', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' },
  vazio:      { color: '#64748b', fontSize: '14px', padding: '24px', textAlign: 'center', backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px' },
  sectionTitle: { fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569', marginBottom: '12px' },
  inp:        { backgroundColor: '#0b1220', border: '1px solid #374151', color: '#f1f5f9', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  lbl:        { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 },
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

function OLTsManager({ olts: initialOlts, projetoId }) {
  const [olts, setOlts]           = useState(initialOlts)
  const [form, setForm]           = useState({ olt_id: '', nome: '', modelo: '', ip: '', capacidade: 16, status: 'ativo' })
  const [editando, setEditando]   = useState(null) // olt.id sendo editado
  const [saving, setSaving]       = useState(false)
  const [erro, setErro]           = useState(null)
  const [sucesso, setSucesso]     = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const FORM_VAZIO = { olt_id: '', nome: '', modelo: '', ip: '', capacidade: 16, status: 'ativo' }

  function iniciarEdicao(olt) {
    setEditando(olt.id)
    setForm({ olt_id: olt.id, nome: olt.nome ?? '', modelo: olt.modelo ?? '', ip: olt.ip ?? '', capacidade: olt.capacidade ?? 16, status: olt.status ?? 'ativo' })
    setSucesso(null)
    setErro(null)
  }

  function cancelarEdicao() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setErro(null)
  }

  async function salvarOLT(e) {
    e.preventDefault()
    if (!form.olt_id.trim() || !form.nome.trim()) {
      setErro('ID e Nome são obrigatórios.')
      return
    }
    setSaving(true)
    setErro(null)
    setSucesso(null)
    try {
      const res = await upsertOLT({
        olt_id:     form.olt_id.trim(),
        nome:       form.nome.trim(),
        modelo:     form.modelo.trim() || null,
        ip:         form.ip.trim()     || null,
        capacidade: Number(form.capacidade) || 16,
        status:     form.status,
        projeto_id: projetoId,
      })
      // Atualiza lista local
      setOlts(prev => {
        const idx = prev.findIndex(o => o.id === res.id)
        if (idx >= 0) { const arr = [...prev]; arr[idx] = res; return arr }
        return [...prev, res]
      })
      setSucesso(`OLT "${res.nome}" salva com sucesso!`)
      setTimeout(() => setSucesso(null), 4000)
      setEditando(null)
      setForm(FORM_VAZIO)
    } catch (e) {
      setErro('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function removerOLT(oltId) {
    setSaving(true)
    setErro(null)
    try {
      await deleteOLT(oltId, projetoId)
      setOlts(prev => prev.filter(o => o.id !== oltId))
      setConfirmDel(null)
      if (editando === oltId) cancelarEdicao()
    } catch (e) {
      setErro('Erro ao remover: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const STATUS_COLOR = { ativo: '#22c55e', inativo: '#ef4444', em_manutencao: '#f59e0b' }
  const STATUS_LABEL = { ativo: 'Ativo', inativo: 'Inativo', em_manutencao: 'Manutenção' }

  return (
    <div>
      <p style={S.sectionTitle}>OLTs Cadastradas — {olts.length} equipamento(s)</p>

      {/* Feedback */}
      {sucesso && <div style={{ backgroundColor: '#052e16', border: '1px solid #166534', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80', marginBottom: 12 }}>{sucesso}</div>}
      {erro    && <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 12 }}>{erro}</div>}

      {/* Lista de OLTs */}
      {olts.length === 0 && editando === null && (
        <div style={S.vazio}>Nenhuma OLT cadastrada. Use o formulário abaixo para adicionar.</div>
      )}

      <div style={S.lista}>
        {olts.map(olt => (
          <div key={olt._id ?? olt.id}>
            {editando === olt.id ? (
              // Formulário de edição inline
              <div style={{ backgroundColor: '#0c1a2e', border: '1px solid #0284c7', borderRadius: 10, padding: '16px 18px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#7dd3fc', marginBottom: 12 }}>Editando OLT: {olt.nome}</p>
                <OLTForm form={form} onChange={setForm} onSubmit={salvarOLT} onCancel={cancelarEdicao} saving={saving} editMode />
              </div>
            ) : (
              // Card normal
              <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={S.cardItemNome}>{olt.nome}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[olt.status] ?? '#94a3b8', backgroundColor: `${STATUS_COLOR[olt.status] ?? '#94a3b8'}18`, border: `1px solid ${STATUS_COLOR[olt.status] ?? '#94a3b8'}40`, borderRadius: 4, padding: '2px 6px' }}>
                      {STATUS_LABEL[olt.status] ?? olt.status}
                    </span>
                  </div>
                  <p style={S.cardItemSub}>
                    {olt.id}
                    {olt.modelo ? ` · ${olt.modelo}` : ''}
                    {olt.ip     ? ` · ${olt.ip}` : ''}
                    {` · ${olt.capacidade ?? 16} portas PON`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => iniciarEdicao(olt)}
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', fontSize: 11, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                    ✏️ Editar
                  </button>
                  {confirmDel === olt.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => removerOLT(olt.id)} disabled={saving}
                        style={{ backgroundColor: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', border: 'none' }}>
                        Confirmar
                      </button>
                      <button onClick={() => setConfirmDel(null)}
                        style={{ ...S.btnDel }}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(olt.id)} style={S.btnDel}>🗑️</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Formulário para nova OLT */}
      {editando === null && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 10, padding: '16px 18px' }}>
          <p style={{ ...S.sectionTitle, color: '#0284c7', marginBottom: 14 }}>+ Adicionar Nova OLT</p>
          <OLTForm form={form} onChange={setForm} onSubmit={salvarOLT} saving={saving} />
        </div>
      )}
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
            style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#64748b', fontSize: 13, padding: '9px 18px', borderRadius: 8, cursor: 'pointer', backgroundColor: 'transparent' }}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function DiagramasClient({ ctos, caixas, olts = [], projetoId }) {
  const [aba, setAba] = useState('ctos')
  const [ctoSelecionada, setCTOSelecionada]     = useState(null)
  const [caixaSelecionada, setCaixaSelecionada] = useState(null)

  const idCaixaSelecionada = caixaSelecionada
    ? (caixaSelecionada.ce_id ?? caixaSelecionada.id ?? '')
    : ''

  return (
    <div style={S.container}>
      {/* Abas */}
      <div style={S.tabBar}>
        <button style={aba === 'ctos'  ? S.tabAtiva : S.tabInativa}
          onClick={() => { setAba('ctos'); setCTOSelecionada(null) }}>
          CTOs ({ctos.length})
        </button>
        <button style={aba === 'cdos'  ? S.tabAtiva : S.tabInativa}
          onClick={() => { setAba('cdos'); setCaixaSelecionada(null) }}>
          CE / CDOs ({caixas.length})
        </button>
        <button style={aba === 'olts'  ? S.tabAtiva : S.tabInativa}
          onClick={() => setAba('olts')}>
          OLTs ({olts.length})
        </button>
      </div>

      {/* Aba CTOs */}
      {aba === 'ctos' && (
        <div>
          <p style={S.sectionTitle}>Selecione uma CTO para editar o diagrama</p>
          {ctos.length === 0
            ? <div style={S.vazio}>Nenhuma CTO cadastrada.</div>
            : <div style={S.lista}>{ctos.map(cto => (
                <ItemCTO key={cto._id} cto={cto} ativo={ctoSelecionada?._id === cto._id} onClick={() => setCTOSelecionada(prev => prev?._id === cto._id ? null : cto)} />
              ))}</div>
          }
          {ctoSelecionada && (
            <div>
              <p style={{ ...S.sectionTitle, color: '#0284c7', marginBottom: '16px' }}>
                Editando: {ctoSelecionada.nome ?? ctoSelecionada.cto_id}
              </p>
              <DiagramaCTOEditor
                key={ctoSelecionada.cto_id}
                ctoId={ctoSelecionada.cto_id}
                projetoId={projetoId}
                capacidadePortas={ctoSelecionada.capacidade ?? 0}
                initialDiagrama={ctoSelecionada.diagrama ?? null}
              />
            </div>
          )}
        </div>
      )}

      {/* Aba CDOs/CEs */}
      {aba === 'cdos' && (
        <div>
          <p style={S.sectionTitle}>Selecione uma CE/CDO para editar o diagrama</p>
          {caixas.length === 0
            ? <div style={S.vazio}>Nenhuma CE/CDO cadastrada.</div>
            : <div style={S.lista}>{caixas.map(caixa => (
                <ItemCDO key={caixa._id} caixa={caixa} ativo={caixaSelecionada?._id === caixa._id} onClick={() => setCaixaSelecionada(prev => prev?._id === caixa._id ? null : caixa)} />
              ))}</div>
          }
          {caixaSelecionada && (
            <div>
              <p style={{ ...S.sectionTitle, color: '#0284c7', marginBottom: '16px' }}>
                Editando: {caixaSelecionada.nome ?? idCaixaSelecionada}
              </p>
              <DiagramaCDOEditor
                key={idCaixaSelecionada}
                ceId={idCaixaSelecionada}
                projetoId={projetoId}
                capacidadeSaidas={caixaSelecionada.capacidade ?? 0}
                initialDiagrama={caixaSelecionada.diagrama ?? null}
              />
            </div>
          )}
        </div>
      )}

      {/* Aba OLTs */}
      {aba === 'olts' && (
        <OLTsManager olts={olts} projetoId={projetoId} />
      )}
    </div>
  )
}
