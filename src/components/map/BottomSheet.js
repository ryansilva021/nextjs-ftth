'use client'

import { useEffect, useRef, useState } from 'react'

const ROTA_TIPO_CONFIG = {
  BACKBONE: { label: 'Backbone', bg: 'rgba(99,102,241,0.2)',  border: 'rgba(99,102,241,0.5)',  color: '#a5b4fc' },
  RAMAL:    { label: 'Ramal',    bg: 'rgba(249,115,22,0.2)',   border: 'rgba(249,115,22,0.5)',   color: '#fdba74' },
  DROP:     { label: 'Drop',     bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',    color: '#86efac' },
}

const STATUS_CONFIG = {
  ativo:          { label: 'Ativo',        bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.4)',   color: '#86efac' },
  em_manutencao:  { label: 'Manutenção',   bg: 'rgba(234,179,8,0.15)',  border: 'rgba(234,179,8,0.4)',   color: '#fde047' },
  inativo:        { label: 'Inativo',      bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',   color: '#fca5a5' },
  removido:       { label: 'Removido',     bg: 'rgba(100,116,139,0.2)', border: 'rgba(100,116,139,0.4)', color: '#94a3b8' },
}

function Chip({ label, bg, border, color }) {
  return (
    <span style={{ backgroundColor: bg, border: `1px solid ${border}`, color, fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>
      {label}
    </span>
  )
}

function InfoRow({ label, value }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, textAlign: 'right' }}>{String(value)}</span>
    </div>
  )
}

function ActionBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: 600,
        padding: '7px 14px',
        borderRadius: 8,
        transition: 'all .15s',
      }}
      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#cbd5e1' }}
    >
      {children}
    </button>
  )
}

// Barra de ocupação compacta
function OcupacaoBar({ ocupadas = 0, capacidade = 0 }) {
  const pct = capacidade > 0 ? Math.round((ocupadas / capacidade) * 100) : 0
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Ocupação</span>
        <span style={{ fontSize: 12, color: barColor, fontWeight: 700 }}>{ocupadas}/{capacidade} ({pct}%)</span>
      </div>
      <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: barColor, borderRadius: 4, transition: 'width .4s' }} />
      </div>
    </div>
  )
}

function CTOContent({ data, isAdmin, onAction }) {
  return (
    <div>
      <OcupacaoBar ocupadas={data.ocupacao ?? 0} capacidade={data.capacidade ?? 8} />
      <InfoRow label="ID" value={data.cto_id} />
      <InfoRow label="Nome" value={data.nome} />
      <InfoRow label="Rua" value={data.rua} />
      <InfoRow label="Bairro" value={data.bairro} />
      <InfoRow label="Capacidade" value={data.capacidade ? `${data.capacidade} portas` : null} />
      <InfoRow label="Splitter" value={data.splitter_cto} />
      <InfoRow label="CDO pai" value={data.cdo_id} />
      <InfoRow label="Porta CDO" value={data.porta_cdo} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {isAdmin && (
          <ActionBtn onClick={() => onAction('reposicionar')}>📍 Reposicionar</ActionBtn>
        )}
        {isAdmin && (
          <ActionBtn onClick={() => onAction('editar')}>✏️ Editar dados</ActionBtn>
        )}
      </div>
    </div>
  )
}

function CaixaContent({ data, isAdmin, onAction }) {
  const TIPO_CHIP = {
    CE:  { bg: 'rgba(37,99,235,0.2)',  border: 'rgba(37,99,235,0.5)',  color: '#93c5fd' },
    CDO: { bg: 'rgba(124,58,237,0.2)', border: 'rgba(124,58,237,0.5)', color: '#c4b5fd' },
  }
  const chip = TIPO_CHIP[data.tipo] ?? TIPO_CHIP.CDO
  const caixaId = data.id ?? data.ce_id
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Chip label={data.tipo || 'CDO'} {...chip} />
      </div>
      <InfoRow label="ID" value={caixaId} />
      <InfoRow label="Nome" value={data.nome} />
      <InfoRow label="Rua" value={data.rua} />
      <InfoRow label="Bairro" value={data.bairro} />
      <InfoRow label="Splitter" value={data.splitter_cdo} />
      <InfoRow label="OLT" value={data.olt_id} />
      <InfoRow label="Porta OLT" value={data.porta_olt} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {isAdmin && (
          <ActionBtn onClick={() => onAction('reposicionar')}>📍 Reposicionar</ActionBtn>
        )}
        {isAdmin && (
          <ActionBtn onClick={() => onAction('editar')}>✏️ Editar dados</ActionBtn>
        )}
      </div>
    </div>
  )
}

function RotaContent({ data, isAdmin, onAction }) {
  const cfg = ROTA_TIPO_CONFIG[data.tipo] ?? ROTA_TIPO_CONFIG.RAMAL
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Chip label={cfg.label} {...cfg} />
      </div>
      <InfoRow label="ID" value={data.rota_id} />
      <InfoRow label="Nome" value={data.nome} />
      <InfoRow label="Obs" value={data.obs} />
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <ActionBtn onClick={() => onAction('editar')}>✏️ Editar dados</ActionBtn>
        </div>
      )}
    </div>
  )
}

function PosteContent({ data, isAdmin, onAction }) {
  const statusCfg = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.ativo
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Chip label={statusCfg.label} {...statusCfg} />
      </div>
      <InfoRow label="ID" value={data.poste_id} />
      <InfoRow label="Tipo" value={data.tipo} />
      <InfoRow label="Altura" value={data.altura} />
      <InfoRow label="Material" value={data.material} />
      <InfoRow label="Proprietário" value={data.proprietario} />
      <InfoRow label="Rua" value={data.rua} />
      <InfoRow label="Bairro" value={data.bairro} />
      <InfoRow label="Obs" value={data.obs} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {isAdmin && (
          <ActionBtn onClick={() => onAction('reposicionar')}>📍 Reposicionar</ActionBtn>
        )}
        {isAdmin && (
          <ActionBtn onClick={() => onAction('editar')}>✏️ Editar dados</ActionBtn>
        )}
      </div>
    </div>
  )
}

const TYPE_EMOJI = { cto: '📦', caixa: '🔌', rota: '〰️', poste: '🏗️' }
const TYPE_LABELS = { cto: 'CTO', caixa: 'CE / CDO', rota: 'Rota', poste: 'Poste' }
const TYPE_COLOR = {
  cto:   '#16a34a',
  caixa: '#7c3aed',
  rota:  '#6366f1',
  poste: '#d97706',
}

export default function BottomSheet({ element, onClose, session, userRole, onAction }) {
  const [visible, setVisible] = useState(false)
  const startYRef = useRef(null)
  const sheetRef = useRef(null)

  const role = userRole || session?.user?.role || 'user'
  const isAdmin = role === 'admin' || role === 'superadmin'

  useEffect(() => {
    if (element) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [element])

  const handleDragStart = (e) => {
    startYRef.current = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY
  }

  const handleDragEnd = (e) => {
    if (startYRef.current === null) return
    const endY = e.type === 'touchend' ? e.changedTouches[0].clientY : e.clientY
    if (endY - startYRef.current > 80) onClose?.()
    startYRef.current = null
    if (sheetRef.current) sheetRef.current.style.transform = ''
  }

  const handleDragMove = (e) => {
    if (startYRef.current === null) return
    const y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY
    const delta = Math.max(0, y - startYRef.current)
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${delta}px)`
  }

  if (!element) return null

  const { type, data } = element
  const accentColor = TYPE_COLOR[type] ?? '#6366f1'
  const emoji = TYPE_EMOJI[type] ?? '📍'
  const typeLabel = TYPE_LABELS[type] ?? type
  const name = data?.nome || data?.cto_id || data?.rota_id || data?.poste_id || data?.id || data?.ce_id || data?._id || 'Sem nome'

  const handleAction = (action) => onAction?.({ type, data, action })

  return (
    <div
      ref={sheetRef}
      className={[
        'fixed bottom-0 left-0 right-0 z-50',
        'transition-transform duration-300 ease-out',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
    >
      {/* Handle / título */}
      <div
        style={{
          backgroundColor: 'rgba(8,14,30,0.98)',
          borderTop: `3px solid ${accentColor}`,
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px 20px 0 0',
          cursor: 'grab',
          padding: '10px 16px 8px',
        }}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 auto 10px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${accentColor}22`, border: `1px solid ${accentColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {emoji}
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{typeLabel}</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>{name}</p>
            </div>
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            style={{ color: 'rgba(255,255,255,0.3)', fontSize: 20, lineHeight: 1, padding: 4 }}
            className="hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div
        style={{
          backgroundColor: 'rgba(8,14,30,0.98)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '8px 16px 28px',
          maxHeight: '55vh',
          overflowY: 'auto',
        }}
      >
        {type === 'cto' && <CTOContent data={data} isAdmin={isAdmin} onAction={handleAction} />}
        {(type === 'cdo' || type === 'caixa') && <CaixaContent data={data} isAdmin={isAdmin} onAction={handleAction} />}
        {type === 'rota' && <RotaContent data={data} isAdmin={isAdmin} onAction={handleAction} />}
        {type === 'poste' && <PosteContent data={data} isAdmin={isAdmin} onAction={handleAction} />}
      </div>
    </div>
  )
}
