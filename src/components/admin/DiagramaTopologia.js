'use client'

/**
 * DiagramaTopologia.js
 * Visualizador profissional de topologia de rede óptica: OLT → CDO/CE → CTOs
 * Inspirado no GeoSite Telecom. Mostra todos os detalhes do circuito de fibra.
 *
 * Layout: árvore vertical com conectores tipo ├── e └──
 * Sem dependências externas de mapa ou gráfico.
 */

import { useState, useEffect, useCallback } from 'react'
import { getTopologia } from '@/actions/olts'

// ─── Tabela de cores ABNT NBR 14721 ─────────────────────────────────────────
const ABNT = [
  { idx: 1,  nome: 'Verde',    hex: '#15803d', text: '#dcfce7' },
  { idx: 2,  nome: 'Amarelo',  hex: '#a16207', text: '#fef9c3' },
  { idx: 3,  nome: 'Branco',   hex: '#475569', text: '#f1f5f9' },
  { idx: 4,  nome: 'Azul',     hex: '#1d4ed8', text: '#dbeafe' },
  { idx: 5,  nome: 'Vermelho', hex: '#b91c1c', text: '#fee2e2' },
  { idx: 6,  nome: 'Violeta',  hex: '#6d28d9', text: '#ede9fe' },
  { idx: 7,  nome: 'Marrom',   hex: '#78350f', text: '#fef3c7' },
  { idx: 8,  nome: 'Rosa',     hex: '#9d174d', text: '#fce7f3' },
  { idx: 9,  nome: 'Preto',    hex: '#1e293b', text: '#cbd5e1' },
  { idx: 10, nome: 'Cinza',    hex: '#374151', text: '#e5e7eb' },
  { idx: 11, nome: 'Laranja',  hex: '#c2410c', text: '#ffedd5' },
  { idx: 12, nome: 'Ciano',    hex: '#0e7490', text: '#cffafe' },
]

// ─── Paleta de cores do tema escuro ─────────────────────────────────────────
const C = {
  bg:       'var(--card-bg-active)',
  card:     '#0d1117',
  card2:    '#161b22',
  border:   '#21262d',
  text:     '#e6edf3',
  muted:    '#8b949e',
  oltBg:    '#050f1f',
  oltBdr:   '#0891b2',
  oltHdr:   '#67e8f9',
  cdoBg:    '#0d0820',
  cdoBdr:   '#7c3aed',
  cdoHdr:   '#c4b5fd',
  ceBg:     '#060d1f',
  ceBdr:    '#2563eb',
  ceHdr:    '#93c5fd',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Encontra a cor ABNT da fibra que liga uma CDO a uma CTO específica */
function getFibraParaCTO(caixa, ctoId) {
  if (!caixa.diagrama?.splitters) return null
  for (const spl of caixa.diagrama.splitters) {
    const saida = (spl.saidas ?? []).find(s => s.cto_id === ctoId)
    if (saida) {
      const fibra = spl.entrada?.fibra
      if (fibra != null) return ABNT.find(a => a.idx === fibra) ?? null
      return null
    }
  }
  return null
}

/** Encontra a porta (num) do splitter da CDO que serve a CTO */
function getPortaParaCTO(caixa, ctoId, ctoPortaCdo) {
  if (caixa.diagrama?.splitters) {
    for (const spl of caixa.diagrama.splitters) {
      const saida = (spl.saidas ?? []).find(s => s.cto_id === ctoId)
      if (saida) return saida.num
    }
  }
  return ctoPortaCdo ?? null
}

/** Retorna informações do splitter da CDO que serve esta CTO */
function getSplitterParaCTO(caixa, ctoId) {
  if (!caixa.diagrama?.splitters) return null
  for (const spl of caixa.diagrama.splitters) {
    const saida = (spl.saidas ?? []).find(s => s.cto_id === ctoId)
    if (saida) return spl
  }
  return null
}

/** Calcula cor da barra de ocupação */
function barColor(pct) {
  if (pct === 0)   return '#374151'
  if (pct < 50)    return '#16a34a'
  if (pct < 80)    return '#ca8a04'
  if (pct < 100)   return '#ea580c'
  return '#dc2626'
}

/** Formata uma string de ID legível */
function fmt(v) {
  return v == null || v === '' || v === 'null' ? null : String(v)
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────
const S = {
  badge: (bg, color) => ({
    display: 'inline-flex', alignItems: 'center',
    padding: '1px 7px', borderRadius: 10,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    backgroundColor: bg, color,
  }),
  mono: { fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" },
  row: { display: 'flex', alignItems: 'center', gap: 6 },
}

// ─── Barra de ocupação ────────────────────────────────────────────────────────
function OccBar({ ocupacao = 0, capacidade = 0 }) {
  if (capacidade <= 0) return null
  const pct = Math.min(100, Math.round((ocupacao / capacidade) * 100))
  const color = barColor(pct)
  const filled = Math.round(pct / 10)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {/* Mini pixel bar */}
      <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            style={{
              width: 5, height: 10, borderRadius: 1,
              backgroundColor: i < filled ? color : 'rgba(255,255,255,0.07)',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 10, color: color, fontWeight: 700, ...S.mono, whiteSpace: 'nowrap' }}>
        {ocupacao}/{capacidade}
      </span>
      <span style={{ fontSize: 9, color: C.muted, whiteSpace: 'nowrap' }}>
        ({pct}%)
      </span>
    </div>
  )
}

// ─── Conector de árvore (vertical) ───────────────────────────────────────────
function TreeLine({ isLast, color = '#21262d', height = '100%' }) {
  return (
    <div className="diag-tree-v" style={{
      position: 'absolute', left: 0, top: 0,
      width: 1, height: isLast ? '50%' : height,
      backgroundColor: color, opacity: 0.5,
    }} />
  )
}

// ─── Cartão OLT ──────────────────────────────────────────────────────────────
function OLTCard({ olt, expanded, onToggle }) {
  const caixasCount = (olt.caixas ?? []).length
  const statusColor = olt.status === 'ativo' ? '#16a34a' : '#dc2626'
  const statusBg    = olt.status === 'ativo' ? '#052e16' : '#450a0a'

  return (
    <div
      onClick={onToggle}
      style={{
        backgroundColor: C.oltBg,
        border: `2px solid ${C.oltBdr}`,
        borderRadius: 10,
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: `0 0 0 1px rgba(8,145,178,0.15), 0 4px 24px rgba(8,145,178,0.12)`,
        transition: 'box-shadow .15s',
        userSelect: 'none',
      }}
    >
      {/* Header strip */}
      <div style={{
        backgroundColor: 'rgba(8,145,178,0.12)',
        borderBottom: `1px solid rgba(8,145,178,0.2)`,
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🖥️</span>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.oltBdr, marginBottom: 1 }}>OLT</div>
            <div className="diag-node-title" style={{ fontSize: 15, fontWeight: 800, color: C.oltHdr, lineHeight: 1.2 }}>{olt.nome ?? olt.id}</div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {fmt(olt.modelo) && (
            <span style={{ ...S.badge('rgba(8,145,178,0.12)', C.muted) }}>{olt.modelo}</span>
          )}
          {fmt(olt.ip) && (
            <span style={{ ...S.badge('#0c1a1f', '#67e8f9'), ...S.mono, fontSize: 10 }}>{olt.ip}</span>
          )}
          <span style={{ ...S.badge('#0a1628', '#93c5fd') }}>{olt.capacidade ?? 16} PON</span>
          {fmt(olt.status) && (
            <span style={{ ...S.badge(statusBg, statusColor) }}>{olt.status}</span>
          )}
        </div>
        <div className="diag-secondary" style={{ fontSize: 10, color: C.muted }}>
          {caixasCount === 0 ? 'Nenhuma CE/CDO vinculada' : `${caixasCount} CE/CDO${caixasCount !== 1 ? 's' : ''} vinculada${caixasCount !== 1 ? 's' : ''}`}
        </div>
      </div>
    </div>
  )
}

// ─── Cartão CDO / CE ─────────────────────────────────────────────────────────
function CDOCard({ caixa, expanded, onToggle }) {
  const isCE  = caixa.tipo?.toUpperCase() === 'CE'
  const color = isCE ? C.ceBdr : C.cdoBdr
  const hdr   = isCE ? C.ceHdr : C.cdoHdr
  const bg    = isCE ? C.ceBg  : C.cdoBg

  const entrada   = caixa.diagrama?.entrada ?? {}
  const splitters = caixa.diagrama?.splitters ?? []
  const ctoCount  = (caixa.ctos ?? []).length

  // Coleta info dos splitters da CDO
  const splitterInfo = splitters.length > 0
    ? splitters.map(s => s.tipo ?? s.nome).filter(Boolean).join(', ')
    : null

  return (
    <div
      onClick={onToggle}
      style={{
        backgroundColor: bg,
        border: `1.5px solid ${color}`,
        borderRadius: 8,
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: `0 2px 12px rgba(0,0,0,0.3)`,
        transition: 'box-shadow .15s',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div style={{
        backgroundColor: `rgba(${isCE ? '37,99,235' : '124,58,237'},0.10)`,
        borderBottom: `1px solid rgba(${isCE ? '37,99,235' : '124,58,237'},0.18)`,
        padding: '8px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🔌</span>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color, marginBottom: 1 }}>
              {caixa.tipo ?? 'CDO'}
            </div>
            <div className="diag-node-title" style={{ fontSize: 13, fontWeight: 700, color: hdr, lineHeight: 1.2 }}>
              {caixa.nome ?? caixa.id}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 11, color: C.muted }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          {entrada.pon != null && (
            <span style={{ ...S.badge('#0a1628', '#38bdf8') }}>PON {entrada.pon}</span>
          )}
          {entrada.porta_olt != null && (
            <span style={{ ...S.badge('var(--card-bg)', C.muted) }}>Porta OLT: {entrada.porta_olt}</span>
          )}
          {splitterInfo && (
            <span style={{ ...S.badge('#1a0a30', '#a78bfa') }}>Split {splitterInfo}</span>
          )}
        </div>
        <div className="diag-secondary" style={{ fontSize: 10, color: C.muted }}>
          {ctoCount === 0 ? 'Sem CTOs vinculadas' : `${ctoCount} CTO${ctoCount !== 1 ? 's' : ''} conectada${ctoCount !== 1 ? 's' : ''}`}
        </div>
      </div>
    </div>
  )
}

// ─── Linha de CTO ─────────────────────────────────────────────────────────────
function CTORow({ cto, caixa, isLast, onSelect, selected }) {
  const ctoId   = cto.cto_id ?? cto._id
  const fibra   = getFibraParaCTO(caixa, ctoId)
  const porta   = getPortaParaCTO(caixa, ctoId, cto.porta_cdo)
  const ocupacao = cto.ocupacao ?? 0
  const cap      = cto.capacidade ?? 0
  const pct      = cap > 0 ? Math.round((ocupacao / cap) * 100) : 0
  const isFull   = cap > 0 && pct >= 100
  const caboId   = fmt(cto.diagrama?.entrada?.cabo_id)

  return (
    <div
      onClick={() => onSelect(cto)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center',
        padding: '5px 8px 5px 20px',
        borderRadius: 6,
        cursor: 'pointer',
        gap: 8,
        backgroundColor: selected ? 'rgba(22,163,74,0.08)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(22,163,74,0.35)' : 'transparent'}`,
        transition: 'background .12s, border .12s',
      }}
    >
      {/* Tree connector line */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 20,
        display: 'flex', alignItems: 'center',
        flexShrink: 0,
      }}>
        {/* Vertical line (only if not last) */}
        {!isLast && (
          <div className="diag-tree-v" style={{
            position: 'absolute', left: 7, top: 0, bottom: 0,
            width: 1, backgroundColor: '#21262d',
          }} />
        )}
        {/* Half vertical + horizontal */}
        <div className="diag-tree-v" style={{
          position: 'absolute', left: 7, top: 0, height: '50%',
          width: 1, backgroundColor: '#21262d',
        }} />
        <div className="diag-tree-h" style={{
          position: 'absolute', left: 7, top: '50%',
          width: 13, height: 1, backgroundColor: '#21262d',
        }} />
      </div>

      {/* Port label */}
      {porta != null && (
        <span style={{
          fontSize: 10, fontWeight: 800, color: 'var(--text-muted)',
          ...S.mono, flexShrink: 0, minWidth: 28,
        }}>
          P.{porta}
        </span>
      )}

      {/* Fiber color dot */}
      {fibra ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          flexShrink: 0,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: fibra.hex,
            boxShadow: `0 0 0 1px ${fibra.hex}55`,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 9, color: fibra.text, backgroundColor: fibra.hex + '33', padding: '0 4px', borderRadius: 3, fontWeight: 600 }}>
            {fibra.nome}
          </span>
        </span>
      ) : (
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#374151', flexShrink: 0 }} />
      )}

      {/* Splitter badge */}
      {fmt(cto.splitter_cto) && (
        <span style={{ ...S.badge('#1a0a30', '#a78bfa'), flexShrink: 0 }}>
          {cto.splitter_cto}
        </span>
      )}

      {/* CTO name */}
      <div style={{ minWidth: 0, flexShrink: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#86efac', ...S.mono }}>
          {cto.nome ?? ctoId}
        </span>
        {fmt(cto.nome) && fmt(ctoId) && cto.nome !== ctoId && (
          <span style={{ fontSize: 9, color: C.muted, marginLeft: 4 }}>{ctoId}</span>
        )}
      </div>

      {/* Cable */}
      {caboId && (
        <span className="diag-secondary" style={{ fontSize: 9, color: '#f59e0b', ...S.mono, flexShrink: 0 }}>
          {caboId}
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Full warning */}
      {isFull && (
        <span style={{ fontSize: 12, flexShrink: 0 }} title="CTO lotada">⚠️</span>
      )}

      {/* Occupation bar */}
      <OccBar ocupacao={ocupacao} capacidade={cap} />
    </div>
  )
}

// ─── Painel de detalhes da CTO ────────────────────────────────────────────────
function DetalheCTO({ cto, caixa, onClose }) {
  if (!cto) return null

  const ctoId    = cto.cto_id ?? cto._id
  const fibra    = getFibraParaCTO(caixa, ctoId)
  const splitter = getSplitterParaCTO(caixa, ctoId)
  const porta    = getPortaParaCTO(caixa, ctoId, cto.porta_cdo)
  const entrada  = cto.diagrama?.entrada ?? {}
  const cap      = cto.capacidade ?? 0
  const ocupacao = cto.ocupacao ?? 0
  const pct      = cap > 0 ? Math.round((ocupacao / cap) * 100) : 0

  const rows = [
    ['ID',           fmt(ctoId)],
    ['Nome',         fmt(cto.nome)],
    ['CDO vinculada',fmt(cto.cdo_id)],
    ['Porta CDO',    porta != null ? `P.${porta}` : null],
    ['Splitter CTO', fmt(cto.splitter_cto)],
    ['Cabo',         fmt(entrada.cabo_id)],
    ['Fibras',       entrada.fibras != null ? String(entrada.fibras) : null],
    ['Capacidade',   cap > 0 ? `${cap} portas` : null],
    ['Ocupacao',     cap > 0 ? `${ocupacao}/${cap} (${pct}%)` : null],
    ['Fibra ABNT',   fibra ? `${fibra.idx} – ${fibra.nome}` : null],
    ['Split CDO',    splitter ? `${splitter.tipo ?? splitter.nome} (${splitter.nome ?? ''})`.trim() : null],
  ].filter(([, v]) => v != null)

  // Saidas do splitter da CDO para esta CTO (clientes conectados)
  const saidas = splitter?.saidas ?? []
  const saidaDestaCTO = saidas.find(s => s.cto_id === ctoId)

  // Clientes no diagrama da própria CTO
  const clientesCTO = (() => {
    const spls = cto.diagrama?.splitters ?? []
    const list = []
    for (const spl of spls) {
      for (const s of (spl.saidas ?? [])) {
        if (s?.cliente?.trim()) list.push({ porta: s.num, cliente: s.cliente })
      }
    }
    return list
  })()

  return (
    <div style={{
      backgroundColor: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'rgba(22,163,74,0.10)',
        borderBottom: `1px solid rgba(22,163,74,0.18)`,
        padding: '9px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📦</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#86efac' }}>
            {cto.nome ?? ctoId}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 14, padding: '0 2px' }}
        >
          ✕
        </button>
      </div>

      {/* Fields */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '4px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`, gap: 8,
          }}>
            <span style={{ fontSize: 10, color: C.muted, whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ fontSize: 10, color: C.text, fontWeight: 700, textAlign: 'right', wordBreak: 'break-all', ...S.mono }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Occupation bar */}
      {cap > 0 && (
        <div style={{ padding: '6px 12px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <OccBar ocupacao={ocupacao} capacidade={cap} />
        </div>
      )}

      {/* Clientes */}
      {clientesCTO.length > 0 && (
        <div style={{ padding: '0 12px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, marginBottom: 6 }}>
            Clientes ({clientesCTO.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {clientesCTO.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: C.muted, ...S.mono, minWidth: 24 }}>P.{c.porta}</span>
                <span style={{ fontSize: 10, color: C.text }}>{c.cliente}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CDO splitter saida info */}
      {saidaDestaCTO?.obs && (
        <div style={{ padding: '0 12px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, marginBottom: 4 }}>
            Observacao (splitter CDO)
          </div>
          <div style={{ fontSize: 10, color: '#fbbf24' }}>{saidaDestaCTO.obs}</div>
        </div>
      )}
    </div>
  )
}

// ─── Bloco CDO com suas CTOs ──────────────────────────────────────────────────
function CDOSection({ caixa, isLast, selectedCTO, onSelectCTO }) {
  const [expanded, setExpanded] = useState(true)
  const ctos = caixa.ctos ?? []

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 0 }}>
      {/* Vertical tree line from OLT column */}
      <div style={{
        position: 'absolute', left: -20, top: 0,
        width: 20, height: isLast ? '50%' : '100%',
        pointerEvents: 'none',
      }}>
        {!isLast && (
          <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 1, backgroundColor: '#21262d' }} />
        )}
        <div style={{ position: 'absolute', left: 7, top: 0, height: '50%', width: 1, backgroundColor: '#21262d' }} />
        <div style={{ position: 'absolute', left: 7, top: '50%', width: 13, height: 1, backgroundColor: '#21262d' }} />
      </div>

      {/* Main content column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <CDOCard
          caixa={caixa}
          expanded={expanded}
          onToggle={() => setExpanded(e => !e)}
        />

        {expanded && (
          <div style={{ marginTop: 4, marginLeft: 16, position: 'relative' }}>
            {ctos.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 11, color: '#374151', fontStyle: 'italic' }}>
                Sem CTOs vinculadas
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {ctos.map((cto, i) => {
                  const ctoId = cto.cto_id ?? cto._id
                  return (
                    <CTORow
                      key={cto._id ?? ctoId}
                      cto={cto}
                      caixa={caixa}
                      isLast={i === ctos.length - 1}
                      onSelect={(c) => onSelectCTO(c, caixa)}
                      selected={selectedCTO?.cto?.cto_id === ctoId || selectedCTO?.cto?._id === ctoId}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bloco OLT com suas CDOs ──────────────────────────────────────────────────
function OLTSection({ olt, selectedCTO, onSelectCTO }) {
  const [expanded, setExpanded] = useState(true)
  const caixas = olt.caixas ?? []

  return (
    <div style={{
      backgroundColor: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* OLT card */}
      <div style={{ padding: 12 }}>
        <OLTCard olt={olt} expanded={expanded} onToggle={() => setExpanded(e => !e)} />
      </div>

      {/* CDOs */}
      {expanded && (
        <div style={{
          padding: '0 12px 12px 32px',
          position: 'relative',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Main vertical line from OLT */}
          <div style={{
            position: 'absolute', left: 20, top: 0,
            width: 1, height: '100%',
            backgroundColor: '#21262d',
          }} />

          {caixas.length === 0 ? (
            <div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic', padding: '4px 0' }}>
              Nenhuma CE/CDO vinculada a esta OLT
            </div>
          ) : (
            caixas.map((caixa, i) => (
              <CDOSection
                key={caixa._id ?? caixa.id}
                caixa={caixa}
                isLast={i === caixas.length - 1}
                selectedCTO={selectedCTO}
                onSelectCTO={onSelectCTO}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Barra de resumo ─────────────────────────────────────────────────────────
function SummaryBar({ topologia }) {
  let totalOLTs  = topologia.length
  let totalCDOs  = 0
  let totalCTOs  = 0
  let totalCap   = 0
  let totalOcup  = 0

  for (const olt of topologia) {
    for (const caixa of (olt.caixas ?? [])) {
      totalCDOs++
      for (const cto of (caixa.ctos ?? [])) {
        totalCTOs++
        totalCap  += cto.capacidade ?? 0
        totalOcup += cto.ocupacao   ?? 0
      }
    }
  }

  const avgPct = totalCap > 0 ? Math.round((totalOcup / totalCap) * 100) : 0
  const avgColor = barColor(avgPct)

  const items = [
    { label: 'OLTs',  value: totalOLTs,  color: C.oltHdr },
    { label: 'CDOs',  value: totalCDOs,  color: C.cdoHdr },
    { label: 'CTOs',  value: totalCTOs,  color: '#86efac' },
    { label: 'Ocupacao media', value: `${avgPct}%`, color: avgColor },
  ]

  return (
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: `1px solid ${C.border}`,
      backgroundColor: C.card2,
    }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            flex: 1, padding: '8px 14px',
            borderRight: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── CTOs sem vínculo ────────────────────────────────────────────────────────
function OrphansSection({ topologia }) {
  // Coleta todos os cto_ids que aparecem em alguma caixa
  const linked = new Set()
  for (const olt of topologia) {
    for (const caixa of (olt.caixas ?? [])) {
      for (const cto of (caixa.ctos ?? [])) {
        linked.add(cto.cto_id ?? cto._id)
      }
    }
  }

  // Por ora não temos acesso às CTOs órfãs fora da árvore (elas simplesmente não aparecem em caixas.ctos)
  // Se no futuro getTopologia incluir um array orphans, consumir aqui.
  return null
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DiagramaTopologia({ projetoId, altura = 600 }) {
  const [topologia, setTopologia]       = useState([])
  const [carregando, setCarregando]     = useState(true)
  const [erro, setErro]                 = useState(null)
  const [selectedCTO, setSelectedCTO]   = useState(null) // { cto, caixa }

  useEffect(() => {
    if (!projetoId) return
    let cancelado = false
    setCarregando(true)
    setErro(null)
    getTopologia(projetoId)
      .then(data  => { if (!cancelado) setTopologia(data ?? []) })
      .catch(e    => { if (!cancelado) setErro(e.message) })
      .finally(() => { if (!cancelado) setCarregando(false) })
    return () => { cancelado = true }
  }, [projetoId])

  const handleSelectCTO = useCallback((cto, caixa) => {
    setSelectedCTO(prev => {
      const ctoId = cto.cto_id ?? cto._id
      if ((prev?.cto?.cto_id ?? prev?.cto?._id) === ctoId) return null
      return { cto, caixa }
    })
  }, [])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <>
        <style>{`@keyframes _spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{
          height: altura, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: C.bg, borderRadius: 12, border: `1px solid ${C.border}`,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 32, height: 32,
              border: `3px solid ${C.oltBdr}`, borderTopColor: 'transparent',
              borderRadius: '50%', animation: '_spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }} />
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Carregando topologia...</p>
          </div>
        </div>
      </>
    )
  }

  // ── Erro ───────────────────────────────────────────────────────────────────
  if (erro) {
    return (
      <div style={{
        height: altura, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.bg, borderRadius: 12, border: '1px solid #7f1d1d',
        flexDirection: 'column', gap: 8,
      }}>
        <span style={{ fontSize: 28 }}>⚠️</span>
        <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>Erro ao carregar topologia</p>
        <p style={{ color: '#7f1d1d', fontSize: 11, margin: 0, ...S.mono }}>{erro}</p>
      </div>
    )
  }

  // ── Vazio ──────────────────────────────────────────────────────────────────
  if (topologia.length === 0) {
    return (
      <div style={{
        height: altura, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.bg, borderRadius: 12, border: `1px solid ${C.border}`,
        flexDirection: 'column', gap: 10,
      }}>
        <span style={{ fontSize: 40 }}>🌐</span>
        <p style={{ color: C.muted, fontSize: 14, fontWeight: 600, margin: 0 }}>Nenhuma topologia configurada</p>
        <p style={{ color: '#374151', fontSize: 12, margin: 0 }}>Cadastre OLTs e vincule CDOs/CTOs no campo</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
    <style>{`
      @media (max-width: 480px) {
        .diag-tree-v { width: 2px !important; opacity: 0.75 !important; }
        .diag-tree-h { height: 2px !important; opacity: 0.75 !important; }
        .diag-secondary { display: none !important; }
        .diag-node-title { font-size: 16px !important; }
      }
    `}</style>
    <div style={{
      backgroundColor: C.bg,
      borderRadius: 12,
      border: `1px solid ${C.border}`,
      overflow: 'hidden',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      {/* Summary bar */}
      <SummaryBar topologia={topologia} />

      {/* Main layout: diagram + detail panel */}
      <div style={{ display: 'flex', minHeight: 0 }}>

        {/* Diagram scroll area */}
        <div style={{
          flex: 1, overflowY: 'auto', overflowX: 'auto',
          maxHeight: altura - 52, // subtract summary bar height
          padding: 16,
        }}>
          {topologia.map(olt => (
            <OLTSection
              key={olt._id ?? olt.id}
              olt={olt}
              selectedCTO={selectedCTO}
              onSelectCTO={handleSelectCTO}
            />
          ))}
          <OrphansSection topologia={topologia} />
        </div>

        {/* Detail panel — shown when a CTO is selected */}
        {selectedCTO && (
          <div style={{
            width: 260, flexShrink: 0,
            borderLeft: `1px solid ${C.border}`,
            overflowY: 'auto',
            maxHeight: altura - 52,
            padding: 12,
            backgroundColor: C.bg,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, marginBottom: 8 }}>
              Detalhes da CTO
            </div>
            <DetalheCTO
              cto={selectedCTO.cto}
              caixa={selectedCTO.caixa}
              onClose={() => setSelectedCTO(null)}
            />
          </div>
        )}
      </div>
    </div>
    </>
  )
}
