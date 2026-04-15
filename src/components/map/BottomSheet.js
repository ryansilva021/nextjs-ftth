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
  os:    { label: 'Ordem de Serviço', emoji: '📋', accent: '#e11d48' },
}

const OS_STATUS_CONFIG = {
  aberta:        { label: 'Aberta',        bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.4)',  color: '#a5b4fc' },
  agendada:      { label: 'Agendada',      bg: 'rgba(14,165,233,0.15)',  border: 'rgba(14,165,233,0.4)',  color: '#38bdf8' },
  em_andamento:  { label: 'Em andamento',  bg: 'rgba(234,179,8,0.15)',   border: 'rgba(234,179,8,0.4)',   color: '#fde047' },
  concluida:     { label: 'Concluída',     bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   color: '#86efac' },
  cancelada:     { label: 'Cancelada',     bg: 'rgba(100,116,139,0.2)',  border: 'rgba(100,116,139,0.4)', color: '#94a3b8' },
}

const OS_TIPO_CONFIG = {
  instalacao:    { label: 'Instalação',    bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   color: '#86efac' },
  manutencao:    { label: 'Manutenção',    bg: 'rgba(234,179,8,0.15)',   border: 'rgba(234,179,8,0.4)',   color: '#fde047' },
  suporte:       { label: 'Suporte',       bg: 'rgba(14,165,233,0.15)',  border: 'rgba(14,165,233,0.4)',  color: '#38bdf8' },
  cancelamento:  { label: 'Cancelamento',  bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   color: '#fca5a5' },
}

const OS_PRIORIDADE_CONFIG = {
  baixa:   { label: 'Baixa',   bg: 'rgba(100,116,139,0.15)',  border: 'rgba(100,116,139,0.35)', color: '#94a3b8' },
  normal:  { label: 'Normal',  bg: 'rgba(14,165,233,0.15)',   border: 'rgba(14,165,233,0.35)',  color: '#38bdf8' },
  alta:    { label: 'Alta',    bg: 'rgba(234,179,8,0.15)',    border: 'rgba(234,179,8,0.35)',   color: '#fde047' },
  urgente: { label: 'Urgente', bg: 'rgba(239,68,68,0.15)',    border: 'rgba(239,68,68,0.35)',   color: '#fca5a5' },
}

// ─── Componentes internos ─────────────────────────────────────────────────────

function Badge({ label, bg, border, color }) {
  return (
    <span style={{ backgroundColor: bg, border: `1px solid ${border}`, color, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.04em' }}>
      {label}
    </span>
  )
}

function InfoSection({ title, children, isDark: _d }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#271204', marginBottom: 6 }}>{title}</p>
      <div style={{ backgroundColor: '#d0bfa8', border: '1px solid #8e7254', borderRadius: 10, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono, accent, isDark: _d }) {
  if (value == null || value === '' || value === '—' || value === 'null' || value === 'undefined') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid #a88e72' }}>
      <span style={{ fontSize: 11, color: '#271204', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 12, color: accent ?? '#0f0701', fontWeight: 800, fontFamily: mono ? 'monospace' : 'inherit', maxWidth: '60%', textAlign: 'right', wordBreak: 'break-word' }}>
        {String(value)}
      </span>
    </div>
  )
}

function OcupacaoBar({ ocupadas = 0, capacidade = 0, accent, isDark: _d }) {
  if (!capacidade) return null
  const pct = Math.round((ocupadas / capacidade) * 100)
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#D4622B' : accent ?? '#16a34a'
  return (
    <div style={{ padding: '12px 16px', backgroundColor: '#d0bfa8', border: '1px solid #8e7254', borderRadius: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#271204' }}>Ocupação de Portas</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: barColor }}>{ocupadas}/{capacidade} <span style={{ fontSize: 11, fontWeight: 600 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 8, backgroundColor: '#8e7254', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`, borderRadius: 4, transition: 'width .5s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: 10, color: '#3d1f04' }}>0</span>
        <span style={{ fontSize: 10, color: '#3d1f04' }}>{capacidade}</span>
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

function CTOContent({ data, isAdmin, isTecnico, onAction, onIrAte, onMedirPotencia, isDark }) {
  const ocupadas = data.ocupacao ?? 0
  const capacidade = data.capacidade ?? 0
  return (
    <div>
      <OcupacaoBar ocupadas={ocupadas} capacidade={capacidade} accent="#16a34a" isDark={isDark} />

      <InfoSection title="Identificação" isDark={isDark}>
        <InfoRow label="ID"    value={data.cto_id} mono accent="#7dd3fc" isDark={isDark} />
        <InfoRow label="Nome"  value={data.nome} isDark={isDark} />
        <InfoRow label="Rua"   value={data.rua} isDark={isDark} />
        <InfoRow label="Bairro" value={data.bairro} isDark={isDark} />
      </InfoSection>

      <InfoSection title="Rede Óptica" isDark={isDark}>
        <InfoRow label="CDO vinculado" value={data.cdo_id}       mono accent="#c4b5fd" isDark={isDark} />
        <InfoRow label="Porta CDO"     value={data.porta_cdo} isDark={isDark} />
        <InfoRow label="Splitter CTO"  value={data.splitter_cto} isDark={isDark} />
        <InfoRow label="Capacidade"    value={data.capacidade ? `${data.capacidade} portas` : null} isDark={isDark} />
      </InfoSection>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {/* Disponível para todos */}
        <ActBtn onClick={() => onAction('movimentacao')} color="#0f0701" bg="rgba(34,197,94,0.20)" border="rgba(34,197,94,0.5)"  icon="👤" label="Clientes" />
        {onIrAte && <ActBtn onClick={onIrAte}           color="#0f0701" bg="rgba(59,130,246,0.20)" border="rgba(59,130,246,0.5)" icon="🧭" label="Ir Até" />}
        {/* Admin only */}
        {isAdmin && <ActBtn onClick={() => onAction('fusoes')}       color="#0f0701" bg="rgba(234,179,8,0.25)"  border="rgba(234,179,8,0.6)"   icon="🧩" label="Fusões" />}
        {isAdmin && <ActBtn onClick={() => onAction('reposicionar')} color="#0f0701" bg="rgba(249,115,22,0.22)" border="rgba(249,115,22,0.55)" icon="📍" label="Reposicionar" />}
        {isAdmin && <ActBtn onClick={() => onAction('editar')}       color="#0f0701" bg="#c8b094" border="#8e7254" icon="✏️" label="Editar" />}
      </div>
    </div>
  )
}

function CaixaContent({ data, isAdmin, onAction, onIrAte, isDark }) {
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

      <InfoSection title="Identificação" isDark={isDark}>
        <InfoRow label="ID"    value={caixaId} mono accent="#c4b5fd" isDark={isDark} />
        <InfoRow label="Nome"  value={data.nome} isDark={isDark} />
        <InfoRow label="Rua"   value={data.rua} isDark={isDark} />
        <InfoRow label="Bairro" value={data.bairro} isDark={isDark} />
      </InfoSection>

      <InfoSection title="Conexão Óptica" isDark={isDark}>
        <InfoRow label="OLT"       value={data.olt_id}    mono accent="#67e8f9" isDark={isDark} />
        <InfoRow label="Porta OLT" value={data.porta_olt} isDark={isDark} />
        <InfoRow label="Splitter"  value={data.splitter_cdo} isDark={isDark} />
      </InfoSection>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {onIrAte && <ActBtn onClick={onIrAte} color="#0f0701" bg="rgba(59,130,246,0.20)" border="rgba(59,130,246,0.5)" icon="🧭" label="Ir Até" />}
        {isAdmin && <ActBtn onClick={() => onAction('fusoes')}       color="#0f0701" bg="rgba(234,179,8,0.25)"  border="rgba(234,179,8,0.6)"   icon="🧩" label="Fusões" />}
        {isAdmin && <ActBtn onClick={() => onAction('reposicionar')} color="#0f0701" bg="rgba(249,115,22,0.22)" border="rgba(249,115,22,0.55)" icon="📍" label="Reposicionar" />}
        {isAdmin && <ActBtn onClick={() => onAction('editar')}       color="#0f0701" bg="#c8b094" border="#8e7254" icon="✏️" label="Editar" />}
      </div>
    </div>
  )
}

function RotaContent({ data, isAdmin, onAction, isDark }) {
  const cfg = ROTA_TIPO_CONFIG[data.tipo] ?? ROTA_TIPO_CONFIG.RAMAL
  const ext = data.extensao_m ? `${Number(data.extensao_m).toFixed(0)} m` : null
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Badge label={cfg.label} {...cfg} />
      </div>

      <InfoSection title="Identificação" isDark={isDark}>
        <InfoRow label="ID"     value={data.rota_id} mono accent="#a5b4fc" isDark={isDark} />
        <InfoRow label="Nome"   value={data.nome} isDark={isDark} />
        <InfoRow label="Extensão" value={ext} accent="#86efac" isDark={isDark} />
        <InfoRow label="Obs"    value={data.obs} isDark={isDark} />
      </InfoSection>

      {isAdmin && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <ActBtn onClick={() => onAction('editar_pontos')} color="#0f0701" bg="rgba(99,102,241,0.22)" border="rgba(99,102,241,0.55)" icon="🖊️" label="Mover pontos" />
          <ActBtn onClick={() => onAction('editar')} color="#0f0701" bg="#c8b094" border="#8e7254" icon="✏️" label="Editar dados" />
        </div>
      )}
    </div>
  )
}

function PosteContent({ data, isAdmin, onAction, onIrAte, isDark }) {
  const statusCfg = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.ativo
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Badge label={statusCfg.label} {...statusCfg} />
      </div>

      <InfoSection title="Identificação" isDark={isDark}>
        <InfoRow label="ID"     value={data.poste_id} mono accent="#fde68a" isDark={isDark} />
        <InfoRow label="Tipo"   value={data.tipo} isDark={isDark} />
        <InfoRow label="Rua"    value={data.rua} isDark={isDark} />
        <InfoRow label="Bairro" value={data.bairro} isDark={isDark} />
      </InfoSection>

      <InfoSection title="Especificações" isDark={isDark}>
        <InfoRow label="Altura"       value={data.altura ? `${data.altura} m` : null} isDark={isDark} />
        <InfoRow label="Material"     value={data.material} isDark={isDark} />
        <InfoRow label="Proprietário" value={data.proprietario} isDark={isDark} />
        <InfoRow label="Obs"          value={data.obs} isDark={isDark} />
      </InfoSection>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {onIrAte && <ActBtn onClick={onIrAte} color="#0f0701" bg="rgba(59,130,246,0.20)" border="rgba(59,130,246,0.5)" icon="🧭" label="Ir Até" />}
        {isAdmin && <ActBtn onClick={() => onAction('reposicionar')} color="#0f0701" bg="rgba(249,115,22,0.22)" border="rgba(249,115,22,0.55)" icon="📍" label="Reposicionar" />}
        {isAdmin && <ActBtn onClick={() => onAction('editar')}       color="#0f0701" bg="#c8b094" border="#8e7254" icon="✏️" label="Editar" />}
      </div>
    </div>
  )
}

function OLTContent({ data, isAdmin, isNoc, onAction, onIrAte, isDark }) {
  const [stats,      setStats]      = useState(null)
  const [statsLoad,  setStatsLoad]  = useState(false)

  const STATUS_OLT = {
    ativo:         { label: 'Ativo',      bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   color: '#86efac' },
    inativo:       { label: 'Inativo',    bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   color: '#fca5a5' },
    em_manutencao: { label: 'Manutenção', bg: 'rgba(234,179,8,0.15)',   border: 'rgba(234,179,8,0.4)',   color: '#fde047' },
  }
  const st    = STATUS_OLT[data.status] ?? STATUS_OLT.ativo
  const oltId = data.id ?? data.olt_id

  // Fetch live stats on mount
  useEffect(() => {
    if (!oltId) return
    let cancelled = false
    setStatsLoad(true)
    import('@/actions/olts').then(m => m.getOltStats(oltId))
      .then(s => { if (!cancelled) { setStats(s); setStatsLoad(false) } })
      .catch(() => { if (!cancelled) setStatsLoad(false) })
    return () => { cancelled = true }
  }, [oltId])

  function openTopologia() {
    window.location.href = `/admin/topologia`
  }

  const muted     = '#271204'
  const cardBg    = '#d0bfa8'
  const cardBord  = '#8e7254'

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Badge label={st.label} {...st} />
      </div>

      {/* Equipment info */}
      <InfoSection title="Equipamento" isDark={isDark}>
        <InfoRow label="ID"     value={oltId}       mono accent="#67e8f9" isDark={isDark} />
        <InfoRow label="Nome"   value={data.nome}   isDark={isDark} />
        <InfoRow label="Modelo" value={data.modelo} isDark={isDark} />
        <InfoRow label="IP"     value={data.ip}     mono accent="#86efac" isDark={isDark} />
        <InfoRow label="Portas PON" value={data.capacidade ? `${data.capacidade} portas` : null} accent="#67e8f9" isDark={isDark} />
      </InfoSection>

      {/* Live stats */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: muted, marginBottom: 6 }}>
          Status da Rede
        </p>

        {statsLoad && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            backgroundColor: cardBg, border: `1px solid ${cardBord}`, borderRadius: 10, fontSize: 12, color: muted }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, border: `2px solid ${cardBord}`, borderTopColor: '#0891b2', borderRadius: '50%', animation: 'bs-spin 0.7s linear infinite' }} />
            Carregando dados da OLT…
          </div>
        )}

        {stats && !statsLoad && (
          <>
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
              {[
                { label: 'Total ONUs', value: stats.total,   color: '#67e8f9' },
                { label: 'Online',     value: stats.online,  color: '#86efac' },
                { label: 'Offline',    value: stats.offline, color: stats.offline > 0 ? '#f87171' : muted },
              ].map((s, i) => (
                <div key={i} style={{
                  backgroundColor: cardBg, border: `1px solid ${cardBord}`, borderRadius: 8,
                  padding: '8px 10px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: 9, color: muted, marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Network health */}
            <div style={{
              backgroundColor: cardBg, border: `1px solid ${cardBord}`,
              borderRadius: 10, overflow: 'hidden', marginBottom: 10,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderBottom: `1px solid ${cardBord}`,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Saúde da Rede
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderBottom: `1px solid ${cardBord}` }}>
                <span style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Sinal médio (RX)</span>
                <span style={{
                  fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                  color: stats.avgRx == null ? muted
                    : stats.avgRx > -20 ? '#22c55e'
                    : stats.avgRx >= -25 ? '#4ade80'
                    : stats.avgRx >= -28 ? '#D4622B' : '#ef4444',
                }}>
                  {stats.avgRx != null ? `${stats.avgRx} dBm` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px' }}>
                <span style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Alertas ativos</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: stats.alerts.length > 0 ? '#f87171' : '#86efac' }}>
                  {stats.alerts.length}
                </span>
              </div>
            </div>

            {/* PON ports */}
            {stats.ponPorts.length > 0 && (
              <div style={{ backgroundColor: cardBg, border: `1px solid ${cardBord}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, margin: 0, padding: '7px 12px', borderBottom: `1px solid ${cardBord}` }}>
                  Portas PON
                </p>
                {stats.ponPorts.slice(0, 8).map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 12px', borderBottom: i < Math.min(stats.ponPorts.length, 8) - 1 ? `1px solid ${cardBord}` : 'none',
                  }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#0891b2', fontWeight: 700 }}>{p.pon}</span>
                    <span style={{ fontSize: 11, color: muted }}>{p.count} ONUs{p.offline > 0 ? ` · ` : ''}{p.offline > 0 && <span style={{ color: '#f87171' }}>{p.offline} offline</span>}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Alerts */}
            {stats.alerts.length > 0 && (
              <div style={{
                backgroundColor: '#fde8e8',
                border: '1px solid #f87171',
                borderRadius: 10, padding: '10px 12px', marginBottom: 10,
              }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                  🚨 Alertas
                </p>
                {stats.alerts.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: i < stats.alerts.length - 1 ? 5 : 0 }}>
                    <span style={{ fontSize: 10, flexShrink: 0 }}>{a.nivel === 'critico' ? '🔴' : '📴'}</span>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#1c1208' }}>{a.cto_id}</span>
                      <span style={{ fontSize: 10, color: muted, marginLeft: 5 }}>— {a.problema}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {/* Topologia — available to admin and noc role */}
        {(isAdmin || isNoc) && (
          <ActBtn onClick={openTopologia} color="#0f0701" bg="rgba(14,165,233,0.22)" border="rgba(14,165,233,0.55)" icon="🌐" label="Ver Topologia" full />
        )}
        {onIrAte && (
          <ActBtn onClick={onIrAte} color="#0f0701" bg="rgba(14,165,233,0.22)" border="rgba(14,165,233,0.55)" icon="🧭" label="Ir Até" />
        )}
        {isAdmin && (
          <ActBtn onClick={() => onAction('reposicionar')} color="#0f0701" bg="rgba(251,191,36,0.25)" border="rgba(251,191,36,0.60)" icon="📍" label="Reposicionar" />
        )}
        {isAdmin && (
          <ActBtn onClick={() => onAction('editar')} color="#0f0701" bg="#c8b094" border="#8e7254" icon="✏️" label="Editar OLT" />
        )}
      </div>

      <style>{`@keyframes bs-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function CopyBtn({ text, isDark: _d }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(String(text ?? '')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button
      onClick={copy}
      style={{
        marginLeft: 8, padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 6,
        backgroundColor: copied ? 'rgba(34,197,94,0.18)' : '#c8b094',
        border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : '#8e7254'}`,
        color: copied ? '#15803d' : '#271204',
        cursor: 'pointer', transition: 'all .2s', flexShrink: 0,
      }}
    >
      {copied ? '✓' : 'Copiar'}
    </button>
  )
}

function InfoRowCopy({ label, value, mono, accent, isDark: _d }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid #a88e72' }}>
      <span style={{ fontSize: 11, color: '#271204', fontWeight: 700, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', maxWidth: '65%', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 12, color: accent ?? '#0f0701', fontWeight: 800, fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-word' }}>
          {String(value)}
        </span>
        <CopyBtn text={value} />
      </div>
    </div>
  )
}

function OSContent({ data, isAdmin, isTecnico, onAction, onIrAte, isDark }) {
  const statusCfg    = OS_STATUS_CONFIG[data.status]     ?? OS_STATUS_CONFIG.aberta
  const tipoCfg      = OS_TIPO_CONFIG[data.tipo]         ?? OS_TIPO_CONFIG.suporte
  const priorCfg     = OS_PRIORIDADE_CONFIG[data.prioridade] ?? OS_PRIORIDADE_CONFIG.normal

  const agendamento  = data.data_agendamento
    ? new Date(data.data_agendamento).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : null

  const abertura = data.data_abertura
    ? new Date(data.data_abertura).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : null

  const coordStr = (data.localizacao?.lat != null && data.localizacao?.lng != null)
    ? `${Number(data.localizacao.lat).toFixed(6)}, ${Number(data.localizacao.lng).toFixed(6)}`
    : null

  return (
    <div>
      {/* Badges de status/tipo/prioridade */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <Badge label={tipoCfg.label}    {...tipoCfg} />
        <Badge label={statusCfg.label}  {...statusCfg} />
        <Badge label={priorCfg.label}   {...priorCfg} />
      </div>

      {/* Identificação */}
      <InfoSection title="Identificação" isDark={isDark}>
        <InfoRow label="Nº OS"    value={data.os_id}       mono accent="#f472b6" isDark={isDark} />
        <InfoRow label="Motivo"   value={data.descricao}   isDark={isDark} />
        <InfoRow label="Abertura" value={abertura}          isDark={isDark} />
        {agendamento && <InfoRow label="Agendado para" value={agendamento} accent="#fde047" isDark={isDark} />}
      </InfoSection>

      {/* Cliente */}
      <InfoSection title="Cliente" isDark={isDark}>
        <InfoRow     label="Nome"       value={data.cliente_nome}    isDark={isDark} />
        <InfoRowCopy label="Endereço"   value={data.cliente_endereco} isDark={isDark} />
        <InfoRowCopy label="Contato"    value={data.cliente_contato}  mono isDark={isDark} />
        {coordStr && <InfoRowCopy label="Lat / Lng" value={coordStr} mono isDark={isDark} />}
      </InfoSection>

      {/* Problema / Observações */}
      {(data.obs_tecnico || data.resultado) && (
        <InfoSection title="Informações Técnicas" isDark={isDark}>
          <InfoRow label="Problema"    value={data.obs_tecnico} isDark={isDark} />
          <InfoRow label="Resultado"   value={data.resultado}   isDark={isDark} />
        </InfoSection>
      )}

      {/* Rede */}
      {(data.olt_id || data.cto_id || data.pon) && (
        <InfoSection title="Rede Óptica" isDark={isDark}>
          <InfoRow label="OLT"      value={data.olt_id}     mono accent="#67e8f9" isDark={isDark} />
          <InfoRow label="CTO"      value={data.cto_id}     mono accent="#86efac" isDark={isDark} />
          <InfoRow label="PON"      value={data.pon}         mono isDark={isDark} />
          <InfoRow label="Porta CTO" value={data.porta_cto != null ? String(data.porta_cto) : null} isDark={isDark} />
          <InfoRow label="ONU"      value={data.onu_serial}  mono isDark={isDark} />
        </InfoSection>
      )}

      {/* Equipe */}
      {(data.tecnico_nome || data.auxiliar_nome) && (
        <InfoSection title="Equipe" isDark={isDark}>
          <InfoRow label="Técnico"   value={data.tecnico_nome}   isDark={isDark} />
          <InfoRow label="Auxiliar"  value={data.auxiliar_nome}  isDark={isDark} />
        </InfoSection>
      )}

      {/* Sinal */}
      {(data.rx_power != null || data.tx_power != null) && (
        <InfoSection title="Leitura de Sinal" isDark={isDark}>
          <InfoRow label="RX Power" value={data.rx_power != null ? `${data.rx_power} dBm` : null}
            accent={data.rx_power != null ? (data.rx_power >= -25 ? '#86efac' : data.rx_power >= -28 ? '#fde047' : '#f87171') : undefined}
            mono isDark={isDark} />
          <InfoRow label="TX Power" value={data.tx_power != null ? `${data.tx_power} dBm` : null} mono isDark={isDark} />
        </InfoSection>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        <ActBtn
          onClick={() => onAction('abrir_os')}
          color="#0f0701" bg="rgba(225,29,72,0.20)" border="rgba(225,29,72,0.50)"
          icon="📋" label="Ver OS completa" full
        />
        {onIrAte && (
          <ActBtn onClick={onIrAte} color="#0f0701" bg="rgba(59,130,246,0.20)" border="rgba(59,130,246,0.5)" icon="🧭" label="Ir Até" />
        )}
        {(isAdmin || isTecnico) && (
          <ActBtn onClick={() => onAction('editar')} color="#0f0701" bg="#c8b094" border="#8e7254" icon="✏️" label="Editar OS" />
        )}
      </div>
    </div>
  )
}

// ─── BottomSheet principal ─────────────────────────────────────────────────────

export default function BottomSheet({ element, onClose, session, userRole, onAction }) {
  const [visible, setVisible] = useState(false)
  const startYRef = useRef(null)
  const sheetRef  = useRef(null)

  const isDark = false

  const role      = userRole || session?.user?.role || 'user'
  const isAdmin   = role === 'admin' || role === 'superadmin'
  const isTecnico = role === 'tecnico'

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
  const name            = data?.nome || data?.os_id || data?.cto_id || data?.rota_id || data?.poste_id || data?.id || data?.ce_id || '—'
  const handleAction    = (action) => onAction?.({ type, data, action })

  // "Ir Até" — abre navegação nativa para a posição do elemento
  function irAte() {
    const lat = data?.lat ?? data?.localizacao?.lat
    const lng = data?.lng ?? data?.localizacao?.lng
    if (lat == null || lng == null) return
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const temCoordenadas = (data?.lat != null && data?.lng != null) || (data?.localizacao?.lat != null && data?.localizacao?.lng != null)

  return (
    <div
      ref={sheetRef}
      className={['fixed bottom-0 left-0 right-0 z-[50]', 'lg:left-[240px]', 'transition-transform duration-300 ease-out', visible ? 'translate-y-0' : 'translate-y-full'].join(' ')}
    >
      {/* Cabeçalho arrastável */}
      <div
        style={{
          backgroundColor: '#9e8a6e',
          borderTop: `3px solid ${cfg.accent}`,
          borderLeft: '1px solid #8e7254',
          borderRight: '1px solid #8e7254',
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
        <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#8e7254', margin: '0 auto 12px' }} />

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
              <p style={{ fontSize: 10, color: '#3d1f04', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 2 }}>{cfg.label}</p>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#0f0701', lineHeight: 1.2, margin: 0 }}>{name}</p>
            </div>
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: '#c8b094',
              border: '1px solid #8e7254',
              color: '#0f0701', fontSize: 16, lineHeight: 1,
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
        backgroundColor: '#d0bfa8',
        borderLeft: '1px solid #8e7254',
        borderRight: '1px solid #8e7254',
        padding: '12px 16px 32px',
        maxHeight: '55vh', overflowY: 'auto',
      }}>
        {type === 'cto'                       && <CTOContent   data={data} isAdmin={isAdmin} isTecnico={isTecnico} onAction={handleAction} onIrAte={temCoordenadas ? irAte : null} onMedirPotencia={() => handleAction('medir_potencia')} isDark={isDark} />}
        {(type === 'cdo' || type === 'caixa') && <CaixaContent data={data} isAdmin={isAdmin} onAction={handleAction} onIrAte={temCoordenadas ? irAte : null} isDark={isDark} />}
        {type === 'rota'                       && <RotaContent  data={data} isAdmin={isAdmin} onAction={handleAction} isDark={isDark} />}
        {type === 'poste'                      && <PosteContent data={data} isAdmin={isAdmin} onAction={handleAction} onIrAte={temCoordenadas ? irAte : null} isDark={isDark} />}
        {type === 'olt'                        && <OLTContent   data={data} isAdmin={isAdmin} isNoc={role === 'noc'} onAction={handleAction} onIrAte={temCoordenadas ? irAte : null} isDark={isDark} />}
        {type === 'os'                         && <OSContent    data={data} isAdmin={isAdmin} isTecnico={isTecnico} onAction={handleAction} onIrAte={temCoordenadas ? irAte : null} isDark={isDark} />}
      </div>
    </div>
  )
}
