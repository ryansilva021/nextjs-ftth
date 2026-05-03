'use client'

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react'
import {
  registrarEntrada,
  registrarPausaInicio,
  registrarPausaFim,
  registrarSaida,
} from '@/actions/time-record'

// ─── Design tokens ────────────────────────────────────────────────────────────

const FO = {
  orange:      '#C45A2C',
  orangeSoft:  '#E88A5A',
  orangeGlow:  '#F4A771',
  orangeDeep:  '#8E3B1A',
  beige:       '#EDE3D2',
  cream:       '#F7F0E2',
  espresso:    '#1A120D',
  espressoUp:  '#2A1F17',
  sand:        '#C7B091',
  sandDark:    '#A08770',
  muted:       'rgba(237,227,210,0.55)',
  line:        'rgba(237,227,210,0.10)',
  lineSoft:    'rgba(237,227,210,0.06)',
  success:     '#5DBE7A',
  danger:      '#E5654A',
  warn:        '#E5A04A',
  info:        '#7CA8D9',
  mono:        "'JetBrains Mono', 'Fira Mono', monospace",
  serif:       "'Instrument Serif', Georgia, serif",
  sans:        "'Inter', system-ui, sans-serif",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0') }

function fmtTime(date) {
  if (!date) return '--:--'
  const d = new Date(date)
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function fmtMs(ms) {
  const t = Math.max(0, Math.floor(ms / 1000))
  return pad(Math.floor(t / 3600)) + 'h ' + pad(Math.floor((t % 3600) / 60)) + 'min'
}

function calcWorkMs(record, nowMs) {
  if (!record?.entrada) return 0
  const entradaMs = new Date(record.entrada).getTime()
  const fimMs = record.saida ? new Date(record.saida).getTime() : nowMs
  const totalMs = fimMs - entradaMs
  let pausaMs = 0
  if (record.pausaInicio) {
    const pI = new Date(record.pausaInicio).getTime()
    const pF = record.pausaFim
      ? new Date(record.pausaFim).getTime()
      : record.status === 'em_pausa' ? nowMs : pI
    pausaMs = pF - pI
  }
  return Math.max(0, totalMs - pausaMs)
}

function deriveStage(record) {
  if (!record?.status || record.status === 'none') return 'idle'
  if (record.status === 'trabalhando' && record.pausaFim) return 'work2'
  if (record.status === 'trabalhando') return 'work'
  if (record.status === 'em_pausa') return 'pause'
  if (record.status === 'finalizado') return 'done'
  return 'idle'
}

function getLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      () => resolve(null),
      { timeout: 6000, maximumAge: 60_000 }
    )
  })
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_CFG = {
  idle:  { label: 'Aguardando início',          badgeCls: 'idle',  btnText: 'Iniciar Jornada',    btnCls: '',       icon: 'play'  },
  work:  { label: 'Em jornada',                 badgeCls: 'work',  btnText: 'Iniciar Pausa',       btnCls: 'pause',  icon: 'pause' },
  pause: { label: 'Em pausa programada',        badgeCls: 'pause', btnText: 'Retornar da Pausa',   btnCls: 'resume', icon: 'play'  },
  work2: { label: 'Em jornada (após pausa)',    badgeCls: 'work',  btnText: 'Encerrar Jornada',    btnCls: 'end',    icon: 'stop'  },
  done:  { label: 'Jornada concluída',          badgeCls: 'idle',  btnText: 'Jornada concluída',   btnCls: '',       icon: 'check' },
}

const BADGE_STYLE = {
  idle:  { bg: 'rgba(237,227,210,0.06)', color: 'rgba(237,227,210,0.7)',  border: 'rgba(237,227,210,0.15)', dot: 'rgba(237,227,210,0.7)'  },
  work:  { bg: 'rgba(93,190,122,0.12)',  color: '#8ddba0',                border: 'rgba(93,190,122,0.3)',   dot: '#8ddba0' },
  pause: { bg: 'rgba(229,160,74,0.12)', color: '#eab87a',                border: 'rgba(229,160,74,0.3)',   dot: '#eab87a' },
}

const BTN_STYLE = {
  '':      { from: FO.orangeSoft, mid: FO.orange, to: FO.orangeDeep, shadow: 'rgba(196,90,44,0.4)' },
  pause:   { from: '#f0c180',     mid: FO.warn,   to: '#b67a30',      shadow: 'rgba(229,160,74,0.4)' },
  resume:  { from: '#9be0ad',     mid: FO.success, to: '#327a4b',      shadow: 'rgba(93,190,122,0.35)' },
  end:     { from: '#f08e74',     mid: FO.danger,  to: '#a23720',      shadow: 'rgba(229,101,74,0.4)' },
}

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

function PlayIcon() {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M6 4.5v13l11-6.5z" fill="currentColor"/></svg>
}
function PauseIcon() {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="5" y="4" width="4" height="14" fill="currentColor"/><rect x="13" y="4" width="4" height="14" fill="currentColor"/></svg>
}
function StopIcon() {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="5" y="5" width="12" height="12" fill="currentColor"/></svg>
}
function CheckIcon() {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11l5 5 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function EditIcon() {
  return <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 11.5L11 3 12 4 3.5 12.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
}
function PauseSmIcon() {
  return <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="3" y="2.5" width="3" height="9" fill="currentColor"/><rect x="8" y="2.5" width="3" height="9" fill="currentColor"/></svg>
}
function StopSmIcon() {
  return <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="3" y="3" width="8" height="8" fill="currentColor"/></svg>
}
function ShieldIcon() {
  return <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1l5 3v4c0 2.5-2.2 4.5-5 5-2.8-.5-5-2.5-5-5V4l5-3z" stroke="currentColor" strokeWidth="1.3"/><path d="M5 7l1.5 1.5L9.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const STAGE_ICON = { play: PlayIcon, pause: PauseIcon, stop: StopIcon, check: CheckIcon }

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ record }) {
  const rows = [
    {
      key: 'entrada', cls: 'entrada', label: 'Entrada', sub: 'Início da jornada',
      icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h7M7 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      color: FO.success, bg: 'rgba(93,190,122,0.16)',
    },
    {
      key: 'pausaInicio', cls: 'pausa', label: 'Início da pausa', sub: 'Almoço / intervalo',
      icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="3" width="3" height="8" fill="currentColor"/><rect x="8" y="3" width="3" height="8" fill="currentColor"/></svg>,
      color: FO.warn, bg: 'rgba(229,160,74,0.16)',
    },
    {
      key: 'pausaFim', cls: 'retorno', label: 'Retorno da pausa', sub: 'Continuação da jornada',
      icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3.5v7L11 7z" fill="currentColor"/></svg>,
      color: FO.info, bg: 'rgba(124,168,217,0.16)',
    },
    {
      key: 'saida', cls: 'saida', label: 'Saída', sub: 'Encerramento da jornada',
      icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="3" width="8" height="8" fill="currentColor"/></svg>,
      color: FO.danger, bg: 'rgba(229,101,74,0.16)',
    },
  ]
  return (
    <div style={{ padding: '6px 22px 18px' }}>
      {rows.map(row => {
        const val = record?.[row.key]
        const filled = !!val
        return (
          <div key={row.key} style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
            gap: 14, alignItems: 'center',
            padding: '14px 8px',
            borderBottom: `1px solid ${FO.lineSoft}`,
            opacity: filled ? 1 : 0.38,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: filled ? row.bg : 'rgba(237,227,210,0.04)',
              color: filled ? row.color : 'rgba(237,227,210,0.4)',
              flexShrink: 0,
            }}>
              {row.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, color: FO.cream, fontWeight: 500 }}>{row.label}</div>
              <div style={{ fontSize: 11.5, color: FO.muted, fontWeight: 400, marginTop: 1 }}>{row.sub}</div>
            </div>
            {filled && (
              <span style={{ fontSize: 10.5, color: FO.muted, fontFamily: FO.mono, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M7 1c-2.7 0-5 2-5 4.7C2 9 7 13 7 13s5-4 5-7.3C12 3 9.7 1 7 1z" stroke="currentColor" strokeWidth="1.3"/></svg>
                SP
              </span>
            )}
            <div style={{ fontFamily: FO.mono, fontSize: 15, color: filled ? FO.cream : 'rgba(237,227,210,0.3)', fontWeight: 500, letterSpacing: '0.02em' }}>
              {fmtTime(val)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function Donut({ workMs, pauseMs }) {
  const CIRCUM = 364.4
  const goal = 8 * 3600 * 1000
  const pct = Math.min(1, workMs / goal)
  const offset = CIRCUM * (1 - pct)
  const wh = Math.floor(workMs / 3600000)
  const wm = Math.floor((workMs % 3600000) / 60000)
  const pm = Math.floor(pauseMs / 60000)
  const remMs = Math.max(0, goal - workMs)

  return (
    <div style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 22 }}>
      {/* Ring */}
      <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="fograd" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F4A771"/>
              <stop offset="1" stopColor="#C45A2C"/>
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r="58" stroke="rgba(237,227,210,0.08)" strokeWidth="14" fill="none"/>
          <circle cx="70" cy="70" r="58"
            stroke="url(#fograd)" strokeWidth="14" fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUM}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: FO.serif, fontSize: 32, lineHeight: 1, color: FO.cream, letterSpacing: '-0.02em' }}>
            {wh}<em style={{ color: FO.orangeGlow, fontStyle: 'italic', fontSize: 22 }}>h</em>
            {wm > 0 && <><span style={{ fontSize: 18 }}>{pad(wm)}</span><em style={{ color: FO.orangeGlow, fontStyle: 'italic', fontSize: 14 }}>m</em></>}
          </div>
          <div style={{ fontSize: 10.5, color: FO.muted, fontFamily: FO.mono, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>
            de 8h
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {[
          { sw: FO.orange,                  label: 'Trabalhado', val: fmtMs(workMs) },
          { sw: FO.warn,                    label: 'Em pausa',   val: fmtMs(pauseMs) },
          { sw: 'rgba(237,227,210,0.15)',    label: 'Restante',   val: fmtMs(remMs) },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
            <span style={{ color: FO.muted, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: r.sw, display: 'inline-block' }}/>
              {r.label}
            </span>
            <span style={{ color: FO.cream, fontFamily: FO.mono, fontWeight: 500 }}>{r.val}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
          <span style={{ color: FO.muted }}>Banco do mês</span>
          <span style={{ color: FO.orangeGlow, fontFamily: FO.mono, fontWeight: 500 }}>+02h 14min</span>
        </div>
      </div>
    </div>
  )
}

// ─── Week strip ───────────────────────────────────────────────────────────────

function WeekStrip() {
  const today = new Date().getDay()
  const todayIdx = (today + 6) % 7 // 0=Mon
  const labels  = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM']
  const vals    = ['08:12','08:03','07:51','08:24','08:00','—','—']

  return (
    <div style={{ padding: '18px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: FO.muted, fontFamily: FO.mono, fontWeight: 500 }}>
          Esta semana
        </span>
        <span style={{ fontFamily: FO.mono, fontSize: 12, color: FO.cream }}>
          <b style={{ color: FO.orangeGlow }}>38h 12min</b>{' '}
          <span style={{ color: FO.muted }}>/ 40h</span>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {labels.map((lbl, i) => {
          const isToday = i === todayIdx
          const isWknd  = i >= 5
          const isFuture = i > todayIdx
          const fill = isToday ? 45 : (isFuture || isWknd ? 0 : 100)
          return (
            <div key={lbl} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '10px 6px', borderRadius: 8, position: 'relative', overflow: 'hidden',
              background: isToday ? 'rgba(196,90,44,0.08)' : 'rgba(237,227,210,0.03)',
              border: `1px solid ${isToday ? FO.orange : FO.lineSoft}`,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: isToday ? FO.orangeGlow : FO.muted }}>
                {lbl}
              </span>
              <span style={{ fontFamily: FO.mono, fontSize: 12.5, color: isWknd ? 'rgba(237,227,210,0.3)' : FO.cream, fontWeight: 500 }}>
                {isToday ? <span style={{ color: FO.orangeGlow }}>●</span> : vals[i]}
              </span>
              {fill > 0 && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                  borderRadius: '0 0 6px 6px',
                  background: 'linear-gradient(90deg, #E88A5A, #C45A2C)',
                  transformOrigin: 'left', transform: `scaleX(${fill / 100})`,
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Meta cards ───────────────────────────────────────────────────────────────

function MetaCards({ record }) {
  const lat = record?.entradaLocation?.lat
  const lng = record?.entradaLocation?.lng
  const locStr = lat && lng
    ? `${lat.toFixed(2)}, ${lng.toFixed(2)}`
    : 'São Paulo · SP'

  const items = [
    {
      icon: <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M7 1c-2.7 0-5 2-5 4.7C2 9 7 13 7 13s5-4 5-7.3C12 3 9.7 1 7 1z" stroke="currentColor" strokeWidth="1.3"/><circle cx="7" cy="5.5" r="1.6" fill="currentColor"/></svg>,
      label: 'Localização', val: locStr, sub: '±9 m',
    },
    {
      icon: <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><rect x="3" y="2" width="8" height="10" rx="1.3" stroke="currentColor" strokeWidth="1.3"/><circle cx="7" cy="10" r="0.6" fill="currentColor"/></svg>,
      label: 'Dispositivo', val: 'Chrome · Web', sub: 'Trusted',
    },
    {
      icon: <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 7l3 3 7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      label: 'Escala', val: '5x2 · 08h–17h', sub: 'CLT',
    },
    {
      icon: <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M7 4v3l2 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
      label: 'Tolerância', val: '±10 min', sub: 'por evento',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 22px 22px' }}>
      {items.map(item => (
        <div key={item.label} style={{
          padding: '12px 14px', borderRadius: 9,
          background: 'rgba(237,227,210,0.03)', border: `1px solid ${FO.lineSoft}`,
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: FO.muted, fontFamily: FO.mono, display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.icon} {item.label}
          </div>
          <div style={{ marginTop: 6, fontSize: 14, color: FO.cream, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            {item.val}
            <span style={{ fontSize: 11, color: FO.muted, fontWeight: 400 }}>{item.sub}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Recent days ──────────────────────────────────────────────────────────────

const RECENT = [
  { date: '01/05', desc: 'Feriado · Dia do Trabalho',        pill: 'FOLGA',   pillCls: 'ok',    total: null     },
  { date: '30/04', desc: 'Jornada completa',                 pill: 'OK',      pillCls: 'ok',    total: '08h 12min' },
  { date: '29/04', desc: 'Saída antecipada (visita técnica)',pill: 'PARC.',   pillCls: 'short', total: '06h 48min' },
  { date: '28/04', desc: 'Jornada completa',                 pill: 'OK',      pillCls: 'ok',    total: '08h 03min' },
  { date: '27/04', desc: 'Atraso · 12 min',                 pill: 'ATRASO',  pillCls: 'late',  total: '07h 51min' },
]

const PILL_CLR = {
  ok:    { bg: 'rgba(93,190,122,0.16)',  color: '#8ddba0' },
  late:  { bg: 'rgba(229,101,74,0.16)',  color: '#f4937c' },
  short: { bg: 'rgba(229,160,74,0.16)',  color: '#eab87a' },
}

function RecentDays() {
  return (
    <div style={{ padding: '6px 12px 16px' }}>
      {RECENT.map(r => {
        const pc = PILL_CLR[r.pillCls]
        return (
          <div key={r.date} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 10px', borderRadius: 7, fontSize: 12.5, color: 'rgba(237,227,210,0.85)',
          }}>
            <span style={{ fontFamily: FO.mono, fontSize: 11, color: FO.muted, letterSpacing: '0.04em', width: 64, flexShrink: 0 }}>
              {r.date}
            </span>
            <span style={{ flex: 1 }}>{r.desc}</span>
            <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: FO.mono, background: pc.bg, color: pc.color }}>
              {r.pill}
            </span>
            {r.total && (
              <span style={{ fontFamily: FO.mono, fontWeight: 500, color: FO.cream, fontSize: 12 }}>
                {r.total}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{
      background: 'linear-gradient(160deg, rgba(42,31,23,0.85) 0%, rgba(26,18,13,0.9) 100%)',
      border: `1px solid ${FO.line}`,
      borderRadius: 14,
      backdropFilter: 'blur(8px)',
      boxShadow: '0 24px 48px rgba(0,0,0,0.3), 0 1px 0 rgba(237,227,210,0.04) inset',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardHeader({ left, right }) {
  return (
    <div style={{
      padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <span style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>
        {left}
      </span>
      {right && <span style={{ fontSize: 11.5, color: FO.muted, fontFamily: FO.mono }}>{right}</span>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BaterPontoTab({ record, setRecord, showToast }) {
  const [now,     setNow]    = useState(Date.now())
  const [tick,    setTick]   = useState(0)
  const [pending, startTrans] = useTransition()

  // 1-second tick for clock + elapsed
  useEffect(() => {
    const id = setInterval(() => { setNow(Date.now()); setTick(t => t + 1) }, 1000)
    return () => clearInterval(id)
  }, [])

  const stage    = deriveStage(record)
  const cfg      = STAGE_CFG[stage]
  const badgeClr = BADGE_STYLE[cfg.badgeCls] ?? BADGE_STYLE.idle
  const BtnIcon  = STAGE_ICON[cfg.icon] ?? PlayIcon

  const workMs  = calcWorkMs(record, now)
  const pauseMs = useMemo(() => {
    if (!record?.pausaInicio) return 0
    const pI = new Date(record.pausaInicio).getTime()
    const pF = record.pausaFim ? new Date(record.pausaFim).getTime() : (record.status === 'em_pausa' ? now : pI)
    return Math.max(0, pF - pI)
  }, [record, now])

  const d = new Date(now)
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  const colonOn = tick % 2 === 0

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

  const handlePrimary = useCallback(async () => {
    if (stage === 'idle')  return run(registrarEntrada,    { location: await getLocation() })
    if (stage === 'work')  return run(registrarPausaInicio)
    if (stage === 'pause') return run(registrarPausaFim)
    if (stage === 'work2') return run(registrarSaida,      { location: await getLocation() })
  }, [stage, run])

  const handleEnd = useCallback(async () => {
    if (stage === 'work2') return run(registrarSaida, { location: await getLocation() })
    if (stage === 'work') {
      // skip pause → encerrar direto
      await run(registrarSaida, { location: await getLocation() })
    }
  }, [stage, run])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); handlePrimary() }
      else if (e.key?.toLowerCase() === 'p' && (stage === 'work' || stage === 'work2')) {
        e.preventDefault(); run(stage === 'work' ? registrarPausaInicio : registrarPausaFim)
      }
      else if (e.key?.toLowerCase() === 'e' && (stage === 'work' || stage === 'work2')) {
        e.preventDefault(); handleEnd()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [stage, handlePrimary, handleEnd, run])

  const btnGrad = BTN_STYLE[cfg.btnCls] ?? BTN_STYLE['']
  const primaryDisabled = stage === 'done' || pending

  return (
    <>
      {/* Keyframes only (fonts loaded by parent) */}
      <style>{`
        @keyframes fo-blink{50%{opacity:0.3}}
        @keyframes fo-pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>

      {/* Two-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)',
        gap: 22, padding: '24px 30px 40px',
      }}
        className="bater-ponto-grid"
      >
        <style>{`
          @media(max-width:860px){.bater-ponto-grid{grid-template-columns:1fr !important;padding:16px 14px 24px !important}}
          @media(max-width:768px){.bater-ponto-grid{padding:12px 12px 16px !important}}
        `}</style>

        {/* ── LEFT: clock + action + timeline ──────────────────────────────── */}
        <Card style={{ display: 'flex', flexDirection: 'column' }}>
          <CardHeader
            left="Jornada de hoje"
            right={
              stage === 'idle' ? '— sem registro' :
              stage === 'work'  ? `Em jornada · entrada ${fmtTime(record?.entrada)}` :
              stage === 'pause' ? `Em pausa desde ${fmtTime(record?.pausaInicio)}` :
              stage === 'work2' ? `Retornado às ${fmtTime(record?.pausaFim)}` :
              `Jornada de ${fmtMs(workMs)}`
            }
          />

          {/* Big clock */}
          <div style={{ padding: '28px 30px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
              width: 280, height: 280,
              background: 'radial-gradient(circle, rgba(196,90,44,0.18) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              fontFamily: FO.mono, fontWeight: 500, fontSize: 74, letterSpacing: '-0.04em',
              color: FO.cream, lineHeight: 1, display: 'inline-flex', alignItems: 'baseline',
            }}
              className="big-clock"
            >
              <style>{`
                @media(max-width:860px){.big-clock{font-size:clamp(52px,15vw,68px) !important}}
                @media(max-width:480px){.big-clock{font-size:clamp(44px,13vw,58px) !important}}
                .big-clock .big-secs{font-size:0.48em !important}
                @media(max-width:480px){.big-clock .big-secs{font-size:0.44em !important}}
              `}</style>
              {hh}
              <span style={{ color: FO.orange, animation: 'fo-blink 1s steps(2) infinite', display: 'inline-block', width: '0.5em', textAlign: 'center' }}>
                :
              </span>
              {mm}
              <span className="big-secs" style={{ fontSize: 36, color: FO.orangeGlow, marginLeft: 6, display: 'inline-flex', alignItems: 'baseline' }}>
                <span style={{ color: FO.orange, animation: 'fo-blink 1s steps(2) infinite', display: 'inline-block', width: '0.5em', textAlign: 'center' }}>:</span>
                {ss}
              </span>
            </div>

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, fontSize: 12.5, color: FO.muted, flexWrap: 'wrap' }}>
              Trabalhado hoje ·{' '}
              <b style={{ color: FO.cream, fontFamily: FO.mono, fontWeight: 500 }}>{fmtMs(workMs)}</b>
              <span style={{ color: 'rgba(237,227,210,0.3)' }}>·</span>
              Meta ·{' '}
              <b style={{ color: FO.cream, fontFamily: FO.mono, fontWeight: 500 }}>08h 00min</b>
            </div>

            {/* Status badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 16px', borderRadius: 999, fontSize: 12, fontWeight: 500, letterSpacing: '0.06em',
              border: `1px solid ${badgeClr.border}`,
              background: badgeClr.bg, color: badgeClr.color,
              marginTop: 18,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4, background: badgeClr.dot,
                boxShadow: stage !== 'idle' && stage !== 'done' ? `0 0 10px ${badgeClr.dot}` : 'none',
                animation: stage === 'work' || stage === 'work2' ? 'fo-pulse 1.6s ease-out infinite' : 'none',
              }} />
              {cfg.label}
            </div>
          </div>

          {/* Big action button */}
          <div style={{ padding: '0 30px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handlePrimary}
              disabled={primaryDisabled}
              style={{
                width: '100%', maxWidth: 520, padding: '20px 28px', borderRadius: 12, border: 'none',
                background: `linear-gradient(180deg, ${btnGrad.from} 0%, ${btnGrad.mid} 45%, ${btnGrad.to} 100%)`,
                color: FO.cream, fontSize: 17, fontWeight: 600, letterSpacing: '0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                boxShadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 12px 28px ${btnGrad.shadow}`,
                cursor: primaryDisabled ? 'not-allowed' : 'pointer',
                opacity: primaryDisabled ? 0.5 : 1,
                transition: 'transform .12s, box-shadow .15s, opacity .15s',
                fontFamily: FO.sans,
              }}
            >
              {pending ? <span style={{ animation: 'fo-pulse 1s infinite' }}>…</span> : <BtnIcon />}
              {cfg.btnText}
              <span style={{ fontFamily: FO.mono, fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.18)', fontWeight: 500, letterSpacing: '0.04em' }}>
                ↵
              </span>
            </button>

            <div style={{ fontSize: 12, color: FO.muted, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldIcon />
              Localização e dispositivo verificados · IP 187.45.x.x
            </div>

            {/* Sub-actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 520 }}>
              <SubBtn
                icon={<PauseSmIcon />}
                label="Pausa"
                disabled={pending || (stage !== 'work' && stage !== 'work2')}
                onClick={() => run(stage === 'pause' ? registrarPausaFim : registrarPausaInicio)}
              />
              <SubBtn
                icon={<StopSmIcon />}
                label="Encerrar"
                disabled={pending || (stage !== 'work' && stage !== 'work2')}
                onClick={handleEnd}
              />
              <SubBtn
                icon={<EditIcon />}
                label="Solicitar ajuste"
                warn
                disabled={false}
                onClick={() => showToast('Solicitação de ajuste enviada ao gestor.')}
              />
            </div>
          </div>

          {/* Timeline */}
          <div style={{ padding: '18px 22px 6px', borderTop: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Registros</span>
            <span style={{ fontSize: 11.5, color: FO.muted, fontFamily: FO.mono }}>Sincronizado · GPS 9m</span>
          </div>
          <Timeline record={record} />
        </Card>

        {/* ── RIGHT: donut + week + meta + recent ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Card>
            <Donut workMs={workMs} pauseMs={pauseMs} />
          </Card>

          <Card>
            <WeekStrip />
          </Card>

          <Card>
            <CardHeader left="Local · Dispositivo" right="Validado" />
            <MetaCards record={record} />
          </Card>

          <Card>
            <CardHeader
              left="Últimos dias"
              right={<span style={{ color: FO.orangeGlow, cursor: 'pointer' }}>Ver tudo →</span>}
            />
            <RecentDays />
          </Card>
        </div>
      </div>

      {/* Footer keyboard hints */}
      <div style={{
        padding: '0 30px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 14, flexWrap: 'wrap', fontSize: 11, color: FO.muted, fontFamily: FO.mono,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1l5 3v4c0 2.5-2.2 4.5-5 5-2.8-.5-5-2.5-5-5V4l5-3z" stroke="currentColor" strokeWidth="1.3"/></svg>
          Os registros são imutáveis · Exportação AFD/AEJ disponível em Relatórios
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Kbd>Espaço</Kbd> bater ponto ·{' '}
          <Kbd>P</Kbd> pausa ·{' '}
          <Kbd>E</Kbd> encerrar
        </span>
      </div>
    </>
  )
}

function SubBtn({ icon, label, onClick, disabled, warn }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, minWidth: 140, padding: '11px 14px', borderRadius: 8,
        border: `1px solid ${warn ? 'rgba(229,160,74,0.3)' : FO.line}`,
        background: 'rgba(237,227,210,0.04)',
        color: warn ? '#eab87a' : 'rgba(237,227,210,0.85)',
        fontSize: 12.5, fontWeight: 500, fontFamily: FO.sans,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all .15s',
      }}
    >
      {icon} {label}
    </button>
  )
}

function Kbd({ children }) {
  return (
    <kbd style={{
      fontFamily: FO.mono, fontSize: 10, padding: '2px 7px', borderRadius: 4,
      background: 'rgba(237,227,210,0.06)', border: `1px solid ${FO.line}`,
      color: FO.cream, fontWeight: 500,
    }}>
      {children}
    </kbd>
  )
}
