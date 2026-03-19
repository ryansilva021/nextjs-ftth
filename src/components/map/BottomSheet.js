'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Configurações por tipo ────────────────────────────────────────────────────
const ROTA_TIPO_CONFIG = {
  BACKBONE: { label: 'Backbone', bg: 'rgba(99,102,241,0.18)',  border: 'rgba(99,102,241,0.5)',  color: '#a5b4fc' },
  RAMAL:    { label: 'Ramal',    bg: 'rgba(249,115,22,0.18)',   border: 'rgba(249,115,22,0.5)',   color: '#fdba74' },
  DROP:     { label: 'Drop',     bg: 'rgba(34,197,94,0.15)',    border: 'rgba(34,197,94,0.4)',    color: '#86efac' },
}
const STATUS_CONFIG = {
  ativo:         { label: 'Ativo',      bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   color: '#86efac' },
  em_manutencao: { label: 'Manutenção', bg: 'rgba(234,179,8,0.15)',   border: 'rgba(234,179,8,0.4)',   color: '#fde047' },
  inativo:       { label: 'Inativo',    bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   color: '#fca5a5' },
  removido:      { label: 'Removido',   bg: 'rgba(100,116,139,0.2)',  border: 'rgba(100,116,139,0.4)', color: '#94a3b8' },
}
const TYPE_CONFIG = {
  cto:   { label: 'CTO',      emoji: '📦', accent: '#16a34a' },
  caixa: { label: 'CE / CDO', emoji: '🔌', accent: '#7c3aed' },
  rota:  { label: 'Rota',     emoji: '〰️', accent: '#6366f1' },
  poste: { label: 'Poste',    emoji: '🏗️', accent: '#d97706' },
  olt:   { label: 'OLT',      emoji: '🖥️', accent: '#0891b2' },
}

// ─── Componentes internos ─────────────────────────────────────────────────────

function Badge({ label, bg, border, color }) {
  return (
    <span style={{ backgroundColor: bg, border: `1px solid ${border}`, color, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.04em' }}>
      {label}
    </span>
  )
}

function InfoSection({ title, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>{title}</p>
      <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono, accent }) {
  if (value == null || value === '' || value === '—' || value === 'null' || value === 'undefined') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, color: accent ?? '#e2e8f0', fontWeight: 700, fontFamily: mono ? 'monospace' : 'inherit', maxWidth: '60%', textAlign: 'right', wordBreak: 'break-word' }}>
        {String(value)}
      </span>
    </div>
  )
}

function OcupacaoBar({ ocupadas = 0, capacidade = 0, accent }) {
  if (!capacidade) return null
  const pct = Math.round((ocupadas / capacidade) * 100)
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : accent ?? '#22c55e'
  return (
    <div style={{ padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>Ocupação de Portas</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: barColor }}>{ocupadas}/{capacidade} <span style={{ fontSize: 11, fontWeight: 600 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`, borderRadius: 4, transition: 'width .5s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>0</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{capacidade}</span>
      </div>
    </div>
  )
}

// Botão de ação principal (colorido)
function ActBtn({ onClick, color, bg, border, icon, label, full }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: full ? '1 1 100%' : '1 1 calc(50% - 4px)',
        minWidth: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: hov ? bg.replace('0.12', '0.22') : bg,
        border: `1px solid ${border}`,
        borderRadius: 10, padding: '11px 10px',
        color, fontSize: 13, fontWeight: 700,
        cursor: 'pointer', transition: 'all .15s',
        transform: hov ? 'translateY(-1px)' : 'none',
        boxShadow: hov ? `0 4px 12px ${bg.replace('0.12', '0.3')}` : 'none',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// ─── Conteúdo por tipo ────────────────────────────────────────────────────────

function CTOContent({ data, isAdmin, onAction }) {
  const ocupadas = data.ocupacao ?? 0
  const capacidade = data.capacidade ?? 0
  return (
    <div>
      <OcupacaoBar ocupadas={ocupadas} capacidade={capacidade} accent="#16a34a" />

      <InfoSection title="Identificação">
        <InfoRow label="ID"    value={data.cto_id} mono accent="#7dd3fc" />
        <InfoRow label="Nome"  value={data.nome} />
        <InfoRow label="Rua"   value={data.rua} />
        <InfoRow label="Bairro" value={data.bairro} />
      </InfoSection>

      <InfoSection title="Rede Óptica">
        <InfoRow label="CDO vinculado" value={data.cdo_id}       mono accent="#c4b5fd" />
        <InfoRow label="Porta CDO"     value={data.porta_cdo} />
        <InfoRow label="Splitter CTO"  value={data.splitter_cto} />
        <InfoRow label="Capacidade"    value={data.capacidade ? `${data.capacidade} portas` : null} />
      </InfoSection>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        <ActBtn onClick={() => onAction('movimentacao')} color="#86efac" bg="rgba(34,197,94,0.12)" border="rgba(34,197,94,0.3)"  icon="👤" label="Clientes" />
        {isAdmin && <ActBtn onClick={() => onAction('fusoes')}       color="#fde68a" bg="rgba(234,179,8,0.12)"  border="rgba(234,179,8,0.3)"   icon="🧩" label="Fusões" />}
        {isAdmin && <ActBtn onClick={() => onAction('reposicionar')} color="#fdba74" bg="rgba(249,115,22,0.12)" border="rgba(249,115,22,0.3)" icon="📍" label="Reposicionar" />}
        {isAdmin && <ActBtn onClick={() => onAction('editar')}       color="#f1f5f9" bg="rgba(255,255,255,0.07)" border="rgba(255,255,255,0.15)" icon="✏️" label="Editar" />}
      </div>
    </div>
  )
}

function CaixaContent({ data, isAdmin, onAction }) {
  const TIPO_CFG = {
    CE:  { label: 'CE — Caixa de Emenda', bg: 'rgba(37,99,235,0.18)',  border: 'rgba(37,99,235,0.5)',  color: '#93c5fd' },
    CDO: { label: 'CDO — Caixa Divisora', bg: 'rgba(124,58,237,0.18)', border: 'rgba(124,58,237,0.5)', color: '#c4b5fd' },
  }
  const chip = TIPO_CFG[data.tipo?.toUpperCase()] ?? TIPO_CFG.CDO
  const caixaId = data.id ?? data.ce_id

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Badge label={chip.label} {...chip} />
      </div>

      <InfoSection title="Identificação">
        <InfoRow label="ID"    value={caixaId} mono accent="#c4b5fd" />
        <InfoRow label="Nome"  value={data.nome} />
        <InfoRow label="Rua"   value={data.rua} />
        <InfoRow label="Bairro" value={data.bairro} />
      </InfoSection>

      <InfoSection title="Conexão Óptica">
        <InfoRow label="OLT"       value={data.olt_id}    mono accent="#67e8f9" />
        <InfoRow label="Porta OLT" value={data.porta_olt} />
        <InfoRow label="Splitter"  value={data.splitter_cdo} />
      </InfoSection>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {isAdmin && <ActBtn onClick={() => onAction('fusoes')}       color="#fde68a" bg="rgba(234,179,8,0.12)"  border="rgba(234,179,8,0.3)"   icon="🧩" label="Fusões" />}
        {isAdmin && <ActBtn onClick={() => onAction('reposicionar')} color="#fdba74" bg="rgba(249,115,22,0.12)" border="rgba(249,115,22,0.3)" icon="📍" label="Reposicionar" />}
        {isAdmin && <ActBtn onClick={() => onAction('editar')}       color="#f1f5f9" bg="rgba(255,255,255,0.07)" border="rgba(255,255,255,0.15)" icon="✏️" label="Editar" />}
      </div>
    </div>
  )
}

function RotaContent({ data, isAdmin, onAction }) {
  const cfg = ROTA_TIPO_CONFIG[data.tipo] ?? ROTA_TIPO_CONFIG.RAMAL
  const ext = data.extensao_m ? `${Number(data.extensao_m).toFixed(0)} m` : null
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Badge label={cfg.label} {...cfg} />
      </div>

      <InfoSection title="Identificação">
        <InfoRow label="ID"     value={data.rota_id} mono accent="#a5b4fc" />
        <InfoRow label="Nome"   value={data.nome} />
        <InfoRow label="Extensão" value={ext} accent="#86efac" />
        <InfoRow label="Obs"    value={data.obs} />
      </InfoSection>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <ActBtn onClick={() => onAction('editar')} color="#f1f5f9" bg="rgba(255,255,255,0.07)" border="rgba(255,255,255,0.15)" icon="✏️" label="Editar dados" full />
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
        <Badge label={statusCfg.label} {...statusCfg} />
      </div>

      <InfoSection title="Identificação">
        <InfoRow label="ID"     value={data.poste_id} mono accent="#fde68a" />
        <InfoRow label="Tipo"   value={data.tipo} />
        <InfoRow label="Rua"    value={data.rua} />
        <InfoRow label="Bairro" value={data.bairro} />
      </InfoSection>

      <InfoSection title="Especificações">
        <InfoRow label="Altura"       value={data.altura ? `${data.altura} m` : null} />
        <InfoRow label="Material"     value={data.material} />
        <InfoRow label="Proprietário" value={data.proprietario} />
        <InfoRow label="Obs"          value={data.obs} />
      </InfoSection>

      {isAdmin && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <ActBtn onClick={() => onAction('reposicionar')} color="#fdba74" bg="rgba(249,115,22,0.12)" border="rgba(249,115,22,0.3)" icon="📍" label="Reposicionar" />
          <ActBtn onClick={() => onAction('editar')}       color="#f1f5f9" bg="rgba(255,255,255,0.07)" border="rgba(255,255,255,0.15)" icon="✏️" label="Editar" />
        </div>
      )}
    </div>
  )
}

function OLTContent({ data, isAdmin, onAction }) {
  const STATUS_OLT = {
    ativo:         { label: 'Ativo',      bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   color: '#86efac' },
    inativo:       { label: 'Inativo',    bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   color: '#fca5a5' },
    em_manutencao: { label: 'Manutenção', bg: 'rgba(234,179,8,0.15)',   border: 'rgba(234,179,8,0.4)',   color: '#fde047' },
  }
  const st = STATUS_OLT[data.status] ?? STATUS_OLT.ativo
  const oltId = data.id ?? data.olt_id

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Badge label={st.label} {...st} />
      </div>

      <InfoSection title="Equipamento">
        <InfoRow label="ID"     value={oltId}      mono accent="#67e8f9" />
        <InfoRow label="Nome"   value={data.nome} />
        <InfoRow label="Modelo" value={data.modelo} />
        <InfoRow label="IP"     value={data.ip}    mono accent="#86efac" />
      </InfoSection>

      <InfoSection title="Capacidade">
        <InfoRow label="Portas PON" value={data.capacidade ? `${data.capacidade} portas` : null} accent="#67e8f9" />
      </InfoSection>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <ActBtn onClick={() => onAction('editar')} color="#f1f5f9" bg="rgba(255,255,255,0.07)" border="rgba(255,255,255,0.15)" icon="✏️" label="Editar OLT" full />
        </div>
      )}
    </div>
  )
}

// ─── BottomSheet principal ─────────────────────────────────────────────────────

export default function BottomSheet({ element, onClose, session, userRole, onAction }) {
  const [visible, setVisible] = useState(false)
  const startYRef = useRef(null)
  const sheetRef  = useRef(null)

  const role    = userRole || session?.user?.role || 'user'
  const isAdmin = role === 'admin' || role === 'superadmin'

  useEffect(() => {
    if (element) requestAnimationFrame(() => setVisible(true))
    else setVisible(false)
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
    const y     = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY
    const delta = Math.max(0, y - startYRef.current)
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${delta}px)`
  }

  if (!element) return null

  const { type, data }  = element
  const cfg             = TYPE_CONFIG[type] ?? { label: type, emoji: '📍', accent: '#6366f1' }
  const name            = data?.nome || data?.cto_id || data?.rota_id || data?.poste_id || data?.id || data?.ce_id || '—'
  const handleAction    = (action) => onAction?.({ type, data, action })

  return (
    <div
      ref={sheetRef}
      className={['fixed bottom-0 left-0 right-0 z-[50]', 'lg:left-[240px]', 'transition-transform duration-300 ease-out', visible ? 'translate-y-0' : 'translate-y-full'].join(' ')}
    >
      {/* Cabeçalho arrastável */}
      <div
        style={{
          backgroundColor: 'rgba(6,10,22,0.99)',
          borderTop: `3px solid ${cfg.accent}`,
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px 20px 0 0',
          cursor: 'grab', padding: '10px 16px 12px',
          userSelect: 'none',
        }}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        {/* Handle bar */}
        <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', margin: '0 auto 12px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Ícone tipo */}
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: `${cfg.accent}20`,
              border: `1.5px solid ${cfg.accent}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
              boxShadow: `0 0 12px ${cfg.accent}20`,
            }}>
              {cfg.emoji}
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 2 }}>{cfg.label}</p>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2, margin: 0 }}>{name}</p>
            </div>
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)', fontSize: 16, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
            className="hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div style={{
        backgroundColor: 'rgba(6,10,22,0.99)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 16px 32px',
        maxHeight: '55vh', overflowY: 'auto',
      }}>
        {type === 'cto'                       && <CTOContent   data={data} isAdmin={isAdmin} onAction={handleAction} />}
        {(type === 'cdo' || type === 'caixa') && <CaixaContent data={data} isAdmin={isAdmin} onAction={handleAction} />}
        {type === 'rota'                       && <RotaContent  data={data} isAdmin={isAdmin} onAction={handleAction} />}
        {type === 'poste'                      && <PosteContent data={data} isAdmin={isAdmin} onAction={handleAction} />}
        {type === 'olt'                        && <OLTContent   data={data} isAdmin={isAdmin} onAction={handleAction} />}
      </div>
    </div>
  )
}
