'use client'

import { useState, useTransition } from 'react'
import { criarInclusao } from '@/actions/time-request'
import { T, inputStyle, labelStyle, primaryBtn, cardStyle } from '../pontoTheme'

const TIPOS = [
  { value: 'entrada',      label: '🟢 Entrada'      },
  { value: 'pausa_inicio', label: '⏸ Pausa início'  },
  { value: 'pausa_fim',    label: '▶ Pausa fim'      },
  { value: 'saida',        label: '🔴 Saída'          },
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function IncluirPontoTab({ showToast, onSuccess }) {
  const [form, setForm] = useState({ data: todayStr(), hora: '', tipo: '', motivo: '' })
  const [pending, startTrans] = useTransition()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.tipo)   return showToast('Selecione o tipo de marcação.', 'error')
    if (!form.hora)   return showToast('Informe a hora.', 'error')
    if (!form.motivo.trim()) return showToast('Informe a observação.', 'error')

    startTrans(async () => {
      const res = await criarInclusao({
        data:           form.data,
        tipoMarcacao:   form.tipo,
        horaSolicitada: form.hora,
        motivo:         form.motivo,
      })
      if (res?.error) {
        showToast(res.error, 'error')
      } else {
        showToast('Solicitação enviada! Aguardando aprovação.')
        onSuccess?.(res.request)
        setForm({ data: todayStr(), hora: '', tipo: '', motivo: '' })
      }
    })
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      <InfoCard />

      <form onSubmit={handleSubmit}>
        {/* Data */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle(T)}>Data</label>
          <input
            type="date"
            value={form.data}
            max={todayStr()}
            onChange={e => set('data', e.target.value)}
            style={inputStyle(T)}
            required
          />
        </div>

        {/* Hora */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle(T)}>Hora</label>
          <input
            type="time"
            value={form.hora}
            onChange={e => set('hora', e.target.value)}
            style={inputStyle(T)}
            required
          />
        </div>

        {/* Tipo */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle(T)}>Tipo de marcação</label>
          <select
            value={form.tipo}
            onChange={e => set('tipo', e.target.value)}
            style={inputStyle(T)}
            required
          >
            <option value="">Selecione...</option>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Observação */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle(T)}>Observação / Motivo <span style={{ color: T.danger }}>*</span></label>
          <textarea
            value={form.motivo}
            onChange={e => set('motivo', e.target.value)}
            placeholder="Descreva o motivo da inclusão manual..."
            rows={3}
            maxLength={500}
            style={{ ...inputStyle(T), resize: 'vertical', minHeight: 80 }}
            required
          />
          <div style={{ fontSize: 11, color: T.dim, marginTop: 4, textAlign: 'right' }}>
            {form.motivo.length}/500
          </div>
        </div>

        <button type="submit" disabled={pending} style={primaryBtn(T, pending)}>
          {pending ? 'Enviando...' : '📨  Enviar Solicitação'}
        </button>
      </form>
    </div>
  )
}

function InfoCard() {
  return (
    <div style={{
      background: 'rgba(212,98,43,0.08)', border: '1px solid rgba(212,98,43,0.2)',
      borderRadius: 12, padding: '12px 14px', marginBottom: 24,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 16, marginTop: 1 }}>ℹ️</span>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
        A inclusão manual fica <strong style={{ color: T.accent }}>pendente</strong> até aprovação de um administrador.
        O ponto oficial não é alterado imediatamente.
      </div>
    </div>
  )
}
