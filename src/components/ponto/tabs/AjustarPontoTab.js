'use client'

import { useState, useTransition } from 'react'
import { getPontoByDate, criarAjuste } from '@/actions/time-request'

const FO = {
  orange: '#C45A2C', orangeSoft: '#E88A5A', orangeGlow: '#F4A771', orangeDeep: '#8E3B1A',
  cream: '#F7F0E2', muted: 'rgba(237,227,210,0.55)',
  line: 'rgba(237,227,210,0.10)', lineSoft: 'rgba(237,227,210,0.06)',
  success: '#5DBE7A', danger: '#E5654A', warn: '#E5A04A',
  mono: "'JetBrains Mono','Fira Mono',monospace",
  serif: "'Instrument Serif',Georgia,serif",
  card: 'linear-gradient(160deg,rgba(42,31,23,0.85) 0%,rgba(26,18,13,0.9) 100%)',
}

const PILL_CLR = { ok: '#8ddba0', late: '#f4937c', short: '#eab87a' }
const PILL_BG  = { ok: 'rgba(93,190,122,0.16)', late: 'rgba(229,101,74,0.16)', short: 'rgba(229,160,74,0.16)' }

const ESPELHO = [
  { data: '02/05 sáb', entrada: '—', pausa: '—', retorno: '—', saida: '—', total: '—', status: 'ok', statusTxt: 'FOLGA', flagged: false },
  { data: '01/05 sex', entrada: '—', pausa: '—', retorno: '—', saida: '—', total: '—', status: 'ok', statusTxt: 'FERIADO', flagged: false },
  { data: '30/04 qui', entrada: '07:58', pausaEdit: true, pausa: '12:03', retorno: '13:00', saida: '17:14', total: '08:12', status: 'short', statusTxt: 'EM ANÁLISE', flagged: true, adjId: 'ADJ-218', entradaEdit: true },
  { data: '29/04 qua', entrada: '08:02', pausa: '12:05', retorno: '13:01', saida: '17:51', total: '08:43', status: 'ok', statusTxt: 'OK', flagged: false },
  { data: '28/04 ter', entrada: '08:00', pausa: '12:00', retorno: '12:55', retornoEdit: true, saida: '17:00', total: '08:05', status: 'short', statusTxt: 'EM ANÁLISE', flagged: true, adjId: 'ADJ-217' },
  { data: '27/04 seg', entrada: '08:14', pausa: '12:01', retorno: '13:00', saida: '17:05', total: '07:51', status: 'late', statusTxt: 'ATRASO', flagged: false },
  { data: '24/04 sex', entrada: '08:00', pausa: '12:00', retorno: '13:02', saida: '17:08', total: '08:06', status: 'ok', statusTxt: 'OK', flagged: false },
  { data: '23/04 qui', entrada: '07:58', pausa: '12:00', retorno: '13:00', saida: '17:00', total: '08:02', status: 'ok', statusTxt: 'OK', flagged: false },
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtTime(date) {
  if (!date) return null
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const CAMPOS = [
  { value: 'entrada',      label: 'Entrada',       key: 'entrada'     },
  { value: 'pausa_inicio', label: 'Início de pausa', key: 'pausaInicio' },
  { value: 'pausa_fim',    label: 'Retorno da pausa', key: 'pausaFim'  },
  { value: 'saida',        label: 'Saída',          key: 'saida'       },
]

const inp = {
  height: 34, padding: '0 12px', borderRadius: 7,
  border: `1px solid ${FO.line}`, background: 'rgba(237,227,210,0.04)',
  color: FO.cream, fontSize: 12.5, fontFamily: 'inherit', outline: 'none',
}

export default function AjustarPontoTab({ showToast, onSuccess }) {
  const [dataSel, setDataSel] = useState('')
  const [statusSel, setStatusSel] = useState('')
  const [dayRecord, setDayRecord] = useState(null)
  const [loadingRec, startLoadRec] = useTransition()

  const [tipoMarcacao, setTipoMarcacao] = useState('')
  const [novaHora, setNovaHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [pendingSave, startSave] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [formRow, setFormRow] = useState(null)

  const buscarDia = () => {
    if (!dataSel) return showToast('Selecione uma data.', 'error')
    setDayRecord(null)
    startLoadRec(async () => {
      const rec = await getPontoByDate(dataSel)
      if (!rec) {
        showToast('Nenhum registro para esta data.', 'error')
      } else {
        setDayRecord(rec)
      }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!tipoMarcacao) return showToast('Selecione a marcação.', 'error')
    if (!novaHora)     return showToast('Informe a nova hora.', 'error')
    if (!motivo.trim())return showToast('Informe o motivo.', 'error')
    startSave(async () => {
      const res = await criarAjuste({ data: dataSel, tipoMarcacao, horaSolicitada: novaHora, motivo })
      if (res?.error) {
        showToast(res.error, 'error')
      } else {
        showToast('Ajuste enviado para aprovação!')
        onSuccess?.(res.request)
        setShowForm(false)
        setFormRow(null)
        setTipoMarcacao(''); setNovaHora(''); setMotivo('')
      }
    })
  }

  const openAdjust = (row) => {
    setFormRow(row)
    setShowForm(true)
    setDataSel(row?.dataISO || todayStr())
    setTipoMarcacao('')
    setNovaHora('')
    setMotivo('')
  }

  return (
    <div>
      <style>{`
        .adj-trow{display:grid;grid-template-columns:1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 0.8fr;gap:10px;align-items:center;padding:10px 14px;border-radius:7px;font-size:12.5px;color:rgba(237,227,210,0.85)}
        .adj-trow:not(.adj-thead):hover{background:rgba(237,227,210,0.03)}
        .adj-trow.adj-thead{font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${FO.muted};font-family:${FO.mono};font-weight:500;border-bottom:1px solid ${FO.lineSoft};border-radius:0;padding-bottom:8px;margin-bottom:4px}
        .adj-trow.adj-flagged{background:rgba(229,160,74,0.05);border-left:2px solid ${FO.warn}}
        .adj-diffgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .adj-subbtn{padding:6px 10px;border-radius:6px;border:1px solid ${FO.line};background:rgba(237,227,210,0.04);color:rgba(237,227,210,0.85);font-size:11.5px;font-weight:500;cursor:pointer;font-family:inherit;white-space:nowrap}
        .adj-subbtn:hover{background:rgba(237,227,210,0.08)}
        @media(max-width:860px){.adj-diffgrid{grid-template-columns:1fr 1fr!important}}
        @media(max-width:680px){.adj-trow{grid-template-columns:1fr 0.8fr 0.8fr 0.8fr 0.8fr!important;font-size:11px!important}}
      `}</style>

      <div style={{ padding: '24px 30px 40px' }}>
        {/* vhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: FO.orangeGlow, fontFamily: FO.mono, fontWeight: 500 }}>Correção de marcação</div>
            <h2 style={{ margin: '6px 0 4px', fontFamily: FO.serif, fontWeight: 400, fontSize: 32, letterSpacing: '-0.02em', color: FO.cream }}>
              Ajustar <em style={{ color: FO.orangeGlow, fontStyle: 'italic' }}>marcações</em> existentes
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: FO.muted, maxWidth: 580, lineHeight: 1.55 }}>
              Solicite alteração de horários já registrados. O ponto original permanece auditável; o ajuste fica vinculado ao registro como anexo legal.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={dataSel} onChange={e => { setDataSel(e.target.value); setDayRecord(null) }} style={inp} />
            <select value={statusSel} onChange={e => setStatusSel(e.target.value)} style={inp}>
              <option value="">Todos os status</option>
              <option value="pendente">Pendentes</option>
              <option value="aprovado">Aprovados</option>
              <option value="rejeitado">Rejeitados</option>
            </select>
          </div>
        </div>

        {/* Espelho table */}
        <div style={{ background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, marginBottom: 24, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Espelho de ponto · últimos 14 dias</div>
            <div style={{ fontSize: 11.5, color: FO.muted, fontFamily: FO.mono }}>2 ajustes pendentes</div>
          </div>
          <div style={{ padding: '6px 6px 14px' }}>
            <div className="adj-trow adj-thead">
              <span>Data</span><span>Entrada</span><span>Pausa</span><span>Retorno</span><span>Saída</span><span>Total</span><span>Status</span><span></span>
            </div>
            {ESPELHO.map((row, i) => (
              <div key={i} className={`adj-trow${row.flagged ? ' adj-flagged' : ''}`}>
                <span>{row.data}</span>
                <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: row.entradaEdit ? FO.orangeGlow : FO.cream }}>{row.entrada}{row.entradaEdit && ' ✎'}</span>
                <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: FO.cream }}>{row.pausa}</span>
                <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: row.retornoEdit ? FO.orangeGlow : FO.cream }}>{row.retorno}{row.retornoEdit && ' ✎'}</span>
                <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: FO.cream }}>{row.saida}</span>
                <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: FO.cream }}>{row.total}</span>
                <span>
                  <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: FO.mono, background: PILL_BG[row.status] || 'rgba(237,227,210,0.06)', color: PILL_CLR[row.status] || FO.muted }}>
                    {row.statusTxt}
                  </span>
                </span>
                <span>
                  {row.flagged ? (
                    <button className="adj-subbtn" onClick={() => showToast(`Detalhes do ajuste #${row.adjId}`)}>Ver</button>
                  ) : row.entrada !== '—' ? (
                    <button className="adj-subbtn" onClick={() => openAdjust(row)}>Ajustar</button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ajuste em andamento */}
        <div style={{ background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, marginBottom: 24, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Ajuste em andamento · #ADJ-218</div>
            <div style={{ fontSize: 11.5, color: FO.muted, fontFamily: FO.mono }}>30/04 · pendente do gestor</div>
          </div>
          <div style={{ padding: '18px 22px' }}>
            <div className="adj-diffgrid">
              {[
                { k: 'Marcação', v: 'Entrada', hl: false },
                { k: 'Original', v: '08:24', hl: false, mono: true },
                { k: 'Ajustado', v: '07:58', hl: true, mono: true, color: FO.orangeGlow },
                { k: 'Δ', v: '−26 min', hl: false, mono: true, color: '#5DBE7A' },
              ].map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 7, background: d.hl ? 'rgba(196,90,44,0.06)' : 'rgba(237,227,210,0.03)', border: `1px solid ${d.hl ? 'rgba(196,90,44,0.4)' : FO.lineSoft}` }}>
                  <span style={{ fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: FO.muted, fontFamily: FO.mono }}>{d.k}</span>
                  <span style={{ fontSize: 14, color: d.color || FO.cream, fontWeight: 500, fontFamily: d.mono ? FO.mono : 'inherit' }}>{d.v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '0 22px 18px', fontSize: 13, color: 'rgba(237,227,210,0.78)', lineHeight: 1.55 }}>
            <b style={{ color: FO.cream }}>Justificativa:</b> Sistema de ponto offline entre 07:55 e 08:30 (chamado #FO-2102). Registro reconstituído pelo log do crachá NFC.
          </div>
        </div>

        {/* Form to adjust (shown when clicking Ajustar) */}
        {showForm && (
          <div style={{ background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Nova solicitação de ajuste</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: FO.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: FO.muted, fontFamily: FO.mono, fontWeight: 500 }}>
                <span>Data</span>
                <input type="date" value={dataSel} max={todayStr()} onChange={e => setDataSel(e.target.value)} style={{ ...inp, height: 40 }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: FO.muted, fontFamily: FO.mono, fontWeight: 500 }}>
                  <span>Qual marcação ajustar?</span>
                  <select value={tipoMarcacao} onChange={e => setTipoMarcacao(e.target.value)} style={{ ...inp, height: 40 }} required>
                    <option value="">Selecione...</option>
                    {CAMPOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: FO.muted, fontFamily: FO.mono, fontWeight: 500 }}>
                  <span>Nova hora</span>
                  <input type="time" value={novaHora} onChange={e => setNovaHora(e.target.value)} style={{ ...inp, height: 40 }} required />
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: FO.muted, fontFamily: FO.mono, fontWeight: 500 }}>
                <span>Motivo do ajuste</span>
                <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} placeholder="Descreva o motivo da correção..." style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} required />
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '9px 16px', borderRadius: 7, border: `1px solid ${FO.line}`, background: 'rgba(237,227,210,0.04)', color: 'rgba(237,227,210,0.85)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={pendingSave} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 7, border: 'none', background: `linear-gradient(180deg,${FO.orangeSoft} 0%,${FO.orange} 45%,${FO.orangeDeep} 100%)`, color: FO.cream, fontSize: 12.5, fontWeight: 500, cursor: pendingSave ? 'not-allowed' : 'pointer', opacity: pendingSave ? 0.6 : 1, fontFamily: 'inherit' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {pendingSave ? 'Enviando...' : 'Enviar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
