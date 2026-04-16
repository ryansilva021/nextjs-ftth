'use client'

import { useState, useTransition } from 'react'
import { criarAusencia } from '@/actions/time-request'
import { T, inputStyle, labelStyle, primaryBtn } from '../pontoTheme'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const TIPOS_AUSENCIA = [
  { value: 'falta',    label: '❌ Falta',    color: '#ef4444' },
  { value: 'atestado', label: '🏥 Atestado', color: '#3b82f6' },
  { value: 'folga',    label: '🌴 Folga',    color: '#22c55e' },
]

export default function JustificarAusenciaTab({ showToast, onSuccess }) {
  const [form, setForm] = useState({
    data:         todayStr(),
    dataFim:      '',
    intervalo:    false,
    tipoAusencia: '',
    motivo:       '',
  })
  const [pending, startTrans] = useTransition()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.tipoAusencia)  return showToast('Selecione o tipo de ausência.', 'error')
    if (!form.motivo.trim()) return showToast('Descreva o motivo da ausência.', 'error')
    if (form.intervalo && form.dataFim && form.dataFim < form.data) {
      return showToast('Data fim deve ser igual ou posterior à data início.', 'error')
    }

    startTrans(async () => {
      const res = await criarAusencia({
        data:         form.data,
        dataFim:      form.intervalo ? form.dataFim : null,
        tipoAusencia: form.tipoAusencia,
        motivo:       form.motivo,
      })
      if (res?.error) {
        showToast(res.error, 'error')
      } else {
        showToast('Justificativa enviada! Aguardando aprovação.')
        onSuccess?.(res.request)
        setForm({ data: todayStr(), dataFim: '', intervalo: false, tipoAusencia: '', motivo: '' })
      }
    })
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      <form onSubmit={handleSubmit}>

        {/* Tipo de ausência — seleção visual */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(T)}>Tipo de ausência <span style={{ color: T.danger }}>*</span></label>
          <div style={{ display: 'flex', gap: 10 }}>
            {TIPOS_AUSENCIA.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('tipoAusencia', t.value)}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 10,
                  border: `2px solid ${form.tipoAusencia === t.value ? t.color : T.border}`,
                  background: form.tipoAusencia === t.value
                    ? `${t.color}20`
                    : T.card,
                  color: form.tipoAusencia === t.value ? t.color : T.dim,
                  fontSize: 12, fontWeight: 700, fontFamily: T.ff,
                  cursor: 'pointer', transition: 'all .15s',
                  textAlign: 'center',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle: dia único vs intervalo */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle(T)}>Período</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[{ v: false, l: 'Dia único' }, { v: true, l: 'Intervalo' }].map(opt => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => set('intervalo', opt.v)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  border: `1px solid ${form.intervalo === opt.v ? T.accent : T.border}`,
                  background: form.intervalo === opt.v ? 'rgba(212,98,43,0.12)' : T.card,
                  color: form.intervalo === opt.v ? T.accent : T.dim,
                  fontSize: 13, fontWeight: 600, fontFamily: T.ff, cursor: 'pointer',
                }}
              >
                {opt.l}
              </button>
            ))}
          </div>

          {/* Datas */}
          <div style={{ display: 'grid', gridTemplateColumns: form.intervalo ? '1fr 1fr' : '1fr', gap: 10 }}>
            <div>
              {form.intervalo && <div style={{ fontSize: 11, color: T.dim, marginBottom: 4 }}>Data início</div>}
              <input
                type="date"
                value={form.data}
                max={todayStr()}
                onChange={e => set('data', e.target.value)}
                style={inputStyle(T)}
                required
              />
            </div>
            {form.intervalo && (
              <div>
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 4 }}>Data fim</div>
                <input
                  type="date"
                  value={form.dataFim}
                  min={form.data}
                  max={todayStr()}
                  onChange={e => set('dataFim', e.target.value)}
                  style={inputStyle(T)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Descrição */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle(T)}>Descrição / Motivo <span style={{ color: T.danger }}>*</span></label>
          <textarea
            value={form.motivo}
            onChange={e => set('motivo', e.target.value)}
            placeholder={
              form.tipoAusencia === 'atestado'
                ? 'Ex: Atestado médico — consulta odontológica'
                : form.tipoAusencia === 'folga'
                  ? 'Ex: Folga compensatória acordada com supervisor'
                  : 'Descreva o motivo da ausência...'
            }
            rows={4}
            maxLength={500}
            style={{ ...inputStyle(T), resize: 'vertical', minHeight: 90 }}
            required
          />
          <div style={{ fontSize: 11, color: T.dim, marginTop: 4, textAlign: 'right' }}>
            {form.motivo.length}/500
          </div>
        </div>

        {/* Nota sobre atestado */}
        {form.tipoAusencia === 'atestado' && (
          <div style={{
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10, padding: '10px 12px', marginBottom: 20,
            fontSize: 12, color: '#93c5fd', lineHeight: 1.5,
          }}>
            📎 Caso tenha o arquivo do atestado, entregue ao seu supervisor para anexo no sistema.
          </div>
        )}

        <button type="submit" disabled={pending} style={primaryBtn(T, pending)}>
          {pending ? 'Enviando...' : '📨  Enviar Justificativa'}
        </button>
      </form>
    </div>
  )
}
