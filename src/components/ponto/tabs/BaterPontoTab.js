'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import {
  registrarEntrada,
  registrarPausaInicio,
  registrarPausaFim,
  registrarSaida,
} from '@/actions/time-record'
import { T } from '../pontoTheme'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(date) {
  if (!date) return '--:--'
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function calcTrabalhado(record, now) {
  if (!record?.entrada) return null
  const entrada = new Date(record.entrada).getTime()
  const fim     = record.saida ? new Date(record.saida).getTime() : now
  const total   = fim - entrada
  let pausaMs = 0
  if (record.pausaInicio) {
    const pI = new Date(record.pausaInicio).getTime()
    const pF = record.pausaFim
      ? new Date(record.pausaFim).getTime()
      : (record.status === 'em_pausa' ? now : pI)
    pausaMs = pF - pI
  }
  return Math.max(0, Math.floor((total - pausaMs) / 60_000))
}

function fmtMin(min) {
  if (min === null) return '--'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h === 0 ? `${m}min` : `${h}h ${String(m).padStart(2, '0')}min`
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      () => resolve(null),
      { timeout: 6000, maximumAge: 60_000 }
    )
  })
}

const STATUS_CFG = {
  trabalhando: { label: 'Trabalhando',  dot: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)'   },
  em_pausa:    { label: 'Em Pausa',     dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
  finalizado:  { label: 'Finalizado',   dot: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)'},
  none:        { label: 'Sem registro', dot: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' },
}

const MARCACOES = [
  { icon: '🟢', label: 'Entrada',      key: 'entrada'     },
  { icon: '⏸️', label: 'Pausa início', key: 'pausaInicio' },
  { icon: '▶️', label: 'Pausa fim',    key: 'pausaFim'    },
  { icon: '🔴', label: 'Saída',         key: 'saida'       },
]

// ─────────────────────────────────────────────────────────────────────────────

export default function BaterPontoTab({ record, setRecord, showToast }) {
  const [now,     setNow]     = useState(Date.now())
  const [pending, startTrans] = useTransition()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const run = useCallback(async (action, opts = {}) => {
    startTrans(async () => {
      const result = await action(opts)
      if (result?.error) {
        showToast(result.error, 'error')
      } else if (result?.ok) {
        setRecord(result.record)
        const msgs = {
          registrarEntrada:    'Entrada registrada! Bom trabalho 💪',
          registrarPausaInicio:'Pausa iniciada. Descanse bem ☕',
          registrarPausaFim:   'Voltou da pausa. Bora! 💼',
          registrarSaida:      'Jornada encerrada. Até amanhã! 👋',
        }
        showToast(msgs[action.name] ?? 'Registro salvo!')
      }
    })
  }, [setRecord, showToast])

  const handleEntrada = async () => run(registrarEntrada, { location: await getLocation() })
  const handleSaida   = async () => run(registrarSaida,   { location: await getLocation() })

  const status  = record?.status ?? 'none'
  const cfg     = STATUS_CFG[status] ?? STATUS_CFG.none
  const trabMin = calcTrabalhado(record, now)

  const buttons = []
  if (!record) {
    buttons.push({ label: '▶  Iniciar Jornada', onClick: handleEntrada, primary: true })
  } else if (status === 'trabalhando') {
    buttons.push(
      { label: '⏸  Iniciar Pausa',    onClick: () => run(registrarPausaInicio), primary: false },
      { label: '⏹  Encerrar Jornada', onClick: handleSaida, primary: true, danger: true },
    )
  } else if (status === 'em_pausa') {
    buttons.push({ label: '▶  Voltar da Pausa', onClick: () => run(registrarPausaFim), primary: true })
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      {/* Status badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: 20, padding: '6px 14px', marginBottom: 20,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: cfg.dot,
          boxShadow: status !== 'none' ? `0 0 6px ${cfg.dot}` : 'none',
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: cfg.dot }}>{cfg.label}</span>
        {trabMin !== null && (
          <span style={{ fontSize: 11, color: T.dim, marginLeft: 4 }}>· {fmtMin(trabMin)} trabalhados</span>
        )}
      </div>

      {/* Card de marcações */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
        {MARCACOES.map((row, i) => {
          const val = record?.[row.key]
          return (
            <div key={row.key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: i < MARCACOES.length - 1 ? `1px solid ${T.border}` : 'none',
              opacity: val ? 1 : 0.4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{row.icon}</span>
                <span style={{ fontSize: 14, color: T.muted, fontWeight: 500 }}>{row.label}</span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: val ? T.text : T.dim, fontVariantNumeric: 'tabular-nums' }}>
                {fmtTime(val)}
              </span>
            </div>
          )
        })}

        {record?.saida && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 18px',
            background: 'rgba(212,98,43,0.08)', borderTop: `1px solid rgba(212,98,43,0.2)`,
          }}>
            <span style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>⏱ Jornada total</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.accent }}>{fmtMin(trabMin)}</span>
          </div>
        )}
      </div>

      {/* Localização */}
      {record?.entradaLocation && (
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 20, display: 'flex', gap: 5 }}>
          <span>📍</span>
          <span>Entrada com localização ({record.entradaLocation.lat.toFixed(4)}, {record.entradaLocation.lng.toFixed(4)})</span>
        </div>
      )}

      {/* Botões */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {buttons.map(btn => (
          <button key={btn.label} onClick={btn.onClick} disabled={pending} style={btnStyle(btn, pending, T)}>
            {pending ? '...' : btn.label}
          </button>
        ))}
        {status === 'finalizado' && (
          <div style={{
            textAlign: 'center', padding: '18px',
            background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.15)',
            borderRadius: 14, color: T.dim, fontSize: 14, fontWeight: 600,
          }}>
            ✅ Jornada de hoje concluída
          </div>
        )}
      </div>
    </div>
  )
}

function btnStyle(btn, pending, T) {
  return {
    width: '100%', padding: '18px 20px', borderRadius: 14,
    fontSize: 16, fontWeight: 700, fontFamily: T.ff,
    cursor: pending ? 'not-allowed' : 'pointer',
    transition: 'opacity .15s',
    opacity: pending ? 0.65 : 1,
    background: btn.danger ? 'rgba(239,68,68,0.15)' : btn.primary ? T.accent : 'rgba(212,98,43,0.12)',
    color: btn.danger ? '#ef4444' : btn.primary ? '#fff' : T.accent,
    border: btn.primary && !btn.danger ? 'none' : `1px solid ${btn.danger ? 'rgba(239,68,68,0.3)' : 'rgba(212,98,43,0.3)'}`,
    boxShadow: btn.primary && !btn.danger ? `0 4px 20px rgba(212,98,43,0.35)` : btn.danger ? '0 2px 12px rgba(239,68,68,0.2)' : 'none',
    letterSpacing: '0.02em',
  }
}
