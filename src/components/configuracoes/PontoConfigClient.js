'use client'

import { useState, useTransition } from 'react'
import { saveTimeSettings } from '@/actions/time-settings'

const FIELD_STYLE = {
  width: '100%', padding: '10px 12px',
  background: 'var(--input-bg, #1e293b)',
  border: '1px solid var(--border-color, #334155)',
  borderRadius: 10, color: 'var(--foreground)',
  fontSize: 16, fontFamily: 'inherit',
  outline: 'none',
}

const CARD = {
  background: 'var(--card-bg, #0f172a)',
  border: '1px solid var(--border-color, #1e293b)',
  borderRadius: 16, overflow: 'hidden',
}

function Row({ label, desc, fieldKey, value, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px', borderBottom: '1px solid var(--border-color, #1e293b)',
      gap: 12, flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
      </div>
      <input
        type="time"
        value={value}
        onChange={e => onChange(fieldKey, e.target.value)}
        style={{ ...FIELD_STYLE, width: 130 }}
      />
    </div>
  )
}

function Toggle({ label, fieldKey, value, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 18px', borderBottom: '1px solid var(--border-color, #1e293b)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(fieldKey, !value)}
        style={{
          width: 44, height: 24, borderRadius: 99, border: 'none',
          background: value ? '#ea580c' : '#374151',
          cursor: 'pointer', position: 'relative', transition: 'background .2s',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, borderRadius: '50%',
          width: 18, height: 18, background: '#fff',
          left: value ? 23 : 3, transition: 'left .2s',
        }} />
      </button>
    </div>
  )
}

const DEFAULTS = {
  entrada: '08:00', almoco_inicio: '12:00', almoco_fim: '13:00', saida: '18:00',
  alerta_entrada: true, alerta_almoco_inicio: true, alerta_almoco_fim: true, alerta_saida: true,
}

export default function PontoConfigClient({ initialSettings }) {
  const [form, setForm] = useState({ ...DEFAULTS, ...(initialSettings ?? {}) })
  const [toast, setToast] = useState(null)
  const [pending, startTrans] = useTransition()

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSave = () => {
    startTrans(async () => {
      const res = await saveTimeSettings(form)
      if (res?.error) showToast(res.error, 'error')
      else showToast('Configurações salvas com sucesso!')
    })
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--background)',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      color: 'var(--foreground)', padding: '24px 16px',
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Configurações
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>⏰ Horários de Ponto</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Defina os horários padrão da jornada. Os técnicos receberão alertas automáticos no app.
          </p>
        </div>

        {/* Horários */}
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Horários da Jornada
        </div>
        <div style={{ ...CARD, marginBottom: 24 }}>
          <Row label="Entrada" desc="Início do expediente" fieldKey="entrada" value={form.entrada} onChange={set} />
          <Row label="Início do Almoço" desc="Pausa para almoço" fieldKey="almoco_inicio" value={form.almoco_inicio} onChange={set} />
          <Row label="Fim do Almoço" desc="Retorno do almoço" fieldKey="almoco_fim" value={form.almoco_fim} onChange={set} />
          <Row label="Saída" desc="Encerramento do expediente" fieldKey="saida" value={form.saida} onChange={set} />
        </div>

        {/* Alertas */}
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Alertas Ativos
        </div>
        <div style={{ ...CARD, marginBottom: 28 }}>
          <Toggle label="Alerta de entrada" fieldKey="alerta_entrada" value={form.alerta_entrada} onChange={set} />
          <Toggle label="Alerta de início do almoço" fieldKey="alerta_almoco_inicio" value={form.alerta_almoco_inicio} onChange={set} />
          <Toggle label="Alerta de fim do almoço" fieldKey="alerta_almoco_fim" value={form.alerta_almoco_fim} onChange={set} />
          <Toggle label="Alerta de saída" fieldKey="alerta_saida" value={form.alerta_saida} onChange={set} />
        </div>

        {/* Preview */}
        <div style={{ ...CARD, marginBottom: 28, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Preview dos alertas
          </div>
          {[
            { time: form.entrada,       msg: '⏰ Hora de iniciar sua jornada!',     active: form.alerta_entrada },
            { time: form.almoco_inicio, msg: '🍽 Hora de ir para o almoço!',         active: form.alerta_almoco_inicio },
            { time: form.almoco_fim,    msg: '▶ Hora de retornar do almoço!',        active: form.alerta_almoco_fim },
            { time: form.saida,         msg: '🔴 Hora de encerrar seu expediente!',  active: form.alerta_saida },
          ].map(({ time, msg, active }) => (
            <div key={time + msg} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0', borderBottom: '1px solid var(--border-color, #1e293b)',
              opacity: active ? 1 : 0.35,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 800, color: '#ea580c',
                fontVariantNumeric: 'tabular-nums', minWidth: 42,
              }}>{time}</span>
              <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{msg}</span>
              {!active && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>desativado</span>}
            </div>
          ))}
        </div>

        {/* Salvar */}
        <button
          onClick={handleSave}
          disabled={pending}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: pending ? '#374151' : '#ea580c',
            color: '#fff', fontSize: 16, fontWeight: 700, cursor: pending ? 'not-allowed' : 'pointer',
            transition: 'background .15s', fontFamily: 'inherit',
            boxShadow: pending ? 'none' : '0 4px 20px rgba(234,88,12,0.35)',
          }}
        >
          {pending ? 'Salvando…' : '💾 Salvar Configurações'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#ef4444' : '#22c55e',
          color: '#fff', borderRadius: 12, padding: '12px 20px',
          fontSize: 14, fontWeight: 600, zIndex: 9999,
          maxWidth: 340, textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
