'use client'

import { useState, useTransition } from 'react'
import { getPontoByDate } from '@/actions/time-request'
import { criarAjuste } from '@/actions/time-request'
import { T, inputStyle, labelStyle, primaryBtn } from '../pontoTheme'

function fmtTime(date) {
  if (!date) return null
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const CAMPOS = [
  { value: 'entrada',      label: '🟢 Entrada',      key: 'entrada'     },
  { value: 'pausa_inicio', label: '⏸ Pausa início',  key: 'pausaInicio' },
  { value: 'pausa_fim',    label: '▶ Pausa fim',      key: 'pausaFim'    },
  { value: 'saida',        label: '🔴 Saída',          key: 'saida'       },
]

export default function AjustarPontoTab({ showToast, onSuccess }) {
  const [dataSel, setDataSel]       = useState('')
  const [dayRecord, setDayRecord]   = useState(null)
  const [loadingRec, startLoadRec]  = useTransition()

  const [tipoMarcacao, setTipoMarcacao] = useState('')
  const [novaHora, setNovaHora]         = useState('')
  const [motivo, setMotivo]             = useState('')
  const [pendingSave, startSave]        = useTransition()

  const buscarDia = () => {
    if (!dataSel) return showToast('Selecione uma data.', 'error')
    setDayRecord(null)
    setTipoMarcacao('')
    setNovaHora('')
    startLoadRec(async () => {
      const rec = await getPontoByDate(dataSel)
      if (!rec) {
        showToast('Nenhum registro encontrado para esta data.', 'error')
      } else {
        setDayRecord(rec)
      }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!tipoMarcacao) return showToast('Selecione qual marcação ajustar.', 'error')
    if (!novaHora)     return showToast('Informe a nova hora.', 'error')
    if (!motivo.trim())return showToast('Informe o motivo do ajuste.', 'error')

    startSave(async () => {
      const res = await criarAjuste({
        data:           dataSel,
        tipoMarcacao,
        horaSolicitada: novaHora,
        motivo,
      })
      if (res?.error) {
        showToast(res.error, 'error')
      } else {
        showToast('Solicitação de ajuste enviada!')
        onSuccess?.(res.request)
        setDayRecord(null)
        setDataSel('')
        setTipoMarcacao('')
        setNovaHora('')
        setMotivo('')
      }
    })
  }

  const pending = loadingRec || pendingSave

  // Campos disponíveis no registro encontrado
  const camposDisponiveis = dayRecord
    ? CAMPOS.filter(c => dayRecord[c.key])
    : []

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      {/* Passo 1 — Selecionar data */}
      <StepCard n={1} title="Selecione a data">
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="date"
            value={dataSel}
            max={todayStr()}
            onChange={e => { setDataSel(e.target.value); setDayRecord(null) }}
            style={{ ...inputStyle(T), flex: 1 }}
          />
          <button
            type="button"
            onClick={buscarDia}
            disabled={!dataSel || loadingRec}
            style={{
              padding: '12px 18px', borderRadius: 10, border: 'none',
              background: T.accent, color: '#fff', fontWeight: 700,
              fontSize: 14, cursor: !dataSel || loadingRec ? 'not-allowed' : 'pointer',
              opacity: !dataSel || loadingRec ? 0.5 : 1, whiteSpace: 'nowrap',
              fontFamily: T.ff,
            }}
          >
            {loadingRec ? '...' : 'Buscar'}
          </button>
        </div>
      </StepCard>

      {/* Passo 2 — Registros do dia */}
      {dayRecord && (
        <StepCard n={2} title="Registros do dia">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
            {CAMPOS.map(c => {
              const val = dayRecord[c.key]
              return (
                <div key={c.value} style={{
                  background: val ? 'rgba(212,98,43,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${val ? 'rgba(212,98,43,0.25)' : T.border}`,
                  borderRadius: 8, padding: '8px 12px',
                }}>
                  <div style={{ fontSize: 11, color: T.dim }}>{c.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: val ? T.text : T.dim, marginTop: 2 }}>
                    {val ? fmtTime(val) : '--:--'}
                  </div>
                </div>
              )
            })}
          </div>
        </StepCard>
      )}

      {/* Passo 3 — Formulário de ajuste */}
      {dayRecord && camposDisponiveis.length > 0 && (
        <form onSubmit={handleSubmit}>
          <StepCard n={3} title="Solicitar ajuste">
            {/* Qual marcação */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle(T)}>Qual marcação ajustar?</label>
              <select
                value={tipoMarcacao}
                onChange={e => setTipoMarcacao(e.target.value)}
                style={inputStyle(T)}
                required
              >
                <option value="">Selecione...</option>
                {camposDisponiveis.map(c => (
                  <option key={c.value} value={c.value}>{c.label} · atual: {fmtTime(dayRecord[c.key])}</option>
                ))}
              </select>
            </div>

            {/* Nova hora */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle(T)}>Nova hora</label>
              <input
                type="time"
                value={novaHora}
                onChange={e => setNovaHora(e.target.value)}
                style={inputStyle(T)}
                required
              />
            </div>

            {/* Motivo */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle(T)}>Motivo do ajuste <span style={{ color: T.danger }}>*</span></label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Descreva o motivo da correção..."
                rows={3}
                maxLength={500}
                style={{ ...inputStyle(T), resize: 'vertical', minHeight: 80 }}
                required
              />
            </div>

            <button type="submit" disabled={pending} style={primaryBtn(T, pending)}>
              {pendingSave ? 'Enviando...' : '📨  Enviar Solicitação de Ajuste'}
            </button>
          </StepCard>
        </form>
      )}

      {dayRecord && camposDisponiveis.length === 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, padding: '14px', textAlign: 'center',
          color: T.muted, fontSize: 13,
        }}>
          Nenhuma marcação encontrada neste dia para ajustar.
        </div>
      )}
    </div>
  )
}

function StepCard({ n, title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: T.accent, color: '#fff',
          fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{n}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px' }}>
        {children}
      </div>
    </div>
  )
}
