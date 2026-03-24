'use client'

/**
 * DiagramaFluxo.js — Topologia FTTH com React Flow v12
 * Fluxo obrigatório: OLT → CDO/CEO → BANDEJA → SPLITTER → CTO
 * Suporta tema light/dark via ThemeContext.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ReactFlow, Controls, MiniMap, Background, BackgroundVariant,
  Panel, Handle, Position, useReactFlow, ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Dagre from '@dagrejs/dagre'
import { getTopologia } from '@/actions/olts'
import { useTheme } from '@/contexts/ThemeContext'
import { ABNT, abntHex } from '@/lib/topologia-ftth'

// ─── Mobile detection ─────────────────────────────────────────────────────────

function useMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return mobile
}

// ─── Paleta de cores (dark / light) ─────────────────────────────────────────

function mkTheme(isDark) {
  if (isDark) return {
    canvas:     '#060a16',
    bg:         '#0d1117',
    bg2:        '#161b22',
    border:     '#21262d',
    text:       '#e6edf3',
    muted:      '#8b949e',
    shadow:     '0 4px 24px rgba(0,0,0,0.6)',
    // OLT
    oltBg:  '#050f1f', oltBdr: '#0891b2', oltHdr: '#67e8f9', oltHdrBg: '#0a1929',
    // CDO
    cdoBg:  '#0d0820', cdoBdr: '#7c3aed', cdoHdr: '#c4b5fd', cdoHdrBg: '#100520',
    // Splitter
    splBg:  '#1a0d00', splBdr: '#ea580c', splHdr: '#fb923c', splHdrBg: '#1f0800',
    // CTO
    ctoBg:  '#052e16', ctoBdr: '#16a34a', ctoHdr: '#4ade80', ctoHdrBg: '#031a0e',
    // Panels
    panelBg: 'rgba(13,17,23,0.92)', panelBorder: '#21262d',
    mmBg: '#0d1117', mmMask: '#060a1688',
    // Edges
    feeder:  { stroke: '#2563eb', strokeWidth: 3 },
    distrib: { stroke: '#7c3aed', strokeWidth: 2 },
    drop:    { stroke: '#16a34a', strokeWidth: 1.5 },
  }
  return {
    canvas:     '#e2e8f0',
    bg:         '#ffffff',
    bg2:        '#f8fafc',
    border:     '#cbd5e1',
    text:       '#1e293b',
    muted:      '#64748b',
    shadow:     '0 2px 16px rgba(0,0,0,0.12)',
    // OLT
    oltBg:  '#eff6ff', oltBdr: '#0369a1', oltHdr: '#0369a1', oltHdrBg: '#dbeafe',
    // CDO
    cdoBg:  '#faf5ff', cdoBdr: '#7c3aed', cdoHdr: '#6d28d9', cdoHdrBg: '#ede9fe',
    // Splitter
    splBg:  '#fff7ed', splBdr: '#c2410c', splHdr: '#9a3412', splHdrBg: '#fed7aa',
    // CTO
    ctoBg:  '#f0fdf4', ctoBdr: '#16a34a', ctoHdr: '#166534', ctoHdrBg: '#bbf7d0',
    // Panels
    panelBg: 'rgba(255,255,255,0.94)', panelBorder: '#cbd5e1',
    mmBg: '#f8fafc', mmMask: '#e2e8f088',
    // Edges
    feeder:  { stroke: '#1d4ed8', strokeWidth: 3 },
    distrib: { stroke: '#7c3aed', strokeWidth: 2 },
    drop:    { stroke: '#15803d', strokeWidth: 1.5 },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HANDLE_BASE = {
  width: 11, height: 11, borderRadius: '50%', border: '2px solid #fff4',
}

// Dimensões base para dagre (largura fixa; altura calculada dinamicamente)
const NODE_W = { olt: 230, cdo: 310, splitter: 195, cto: 240 }
const NODE_H = { olt: 150, cdo: 200, splitter: 140, cto: 128 }

function calcCDOHeight(bandejas) {
  const total = bandejas.reduce((s, b) => s + (b.fusoes?.length ?? 0), 0)
  return Math.max(160, 64 + bandejas.length * 28 + total * 24)
}

// Splitter layout constants (must match SplitterNode DOM structure)
const SPL_HEADER_H = 38  // header bar
const SPL_ENTRY_H  = 32  // fiber entrance row
const SPL_PAD_BOT  = 6
const SPL_ROW_H    = 24  // each output row

function calcSplitterHeight(saidas) {
  return Math.max(120, SPL_HEADER_H + SPL_ENTRY_H + saidas.length * SPL_ROW_H + SPL_PAD_BOT)
}

// ─── OLT Node ────────────────────────────────────────────────────────────────

function OLTNode({ data }) {
  const { T, nome, modelo, ip, capacidade, status, ponCount } = data
  const online = status === 'ativo' || status === 'online'

  return (
    <div style={{
      background: T.oltBg, border: `2px solid ${T.oltBdr}`, borderRadius: 10,
      minWidth: NODE_W.olt, boxShadow: T.shadow, overflow: 'visible', position: 'relative',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', fontWeight: 700, fontSize: 13,
        borderRadius: '8px 8px 0 0', background: T.oltHdrBg, color: T.oltHdr,
      }}>
        <span style={{ fontSize: 15 }}>⚡</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: online ? '#22c55e' : '#ef4444',
          boxShadow: online ? '0 0 6px #22c55e88' : 'none',
        }} />
      </div>
      {/* Body */}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {modelo && <div style={{ color: T.muted, fontSize: 11 }}>{modelo}</div>}
        {ip     && <div style={{ color: T.muted, fontSize: 11, fontFamily: 'monospace' }}>{ip}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          {capacidade != null && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
              background: T.oltBdr + '22', border: `1px solid ${T.oltBdr}55`, color: T.oltHdr,
            }}>
              {capacidade} PONs
            </span>
          )}
          {ponCount > 0 && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
              background: '#22c55e22', border: '1px solid #22c55e44', color: '#22c55e',
            }}>
              {ponCount} CDO{ponCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="out"
        style={{ ...HANDLE_BASE, background: T.oltBdr, right: -6 }} />
    </div>
  )
}

// ─── CDO Node ─────────────────────────────────────────────────────────────────

function CDONode({ data }) {
  const { T, nome, tipo, entrada, bandejas = [], ponFusoes = [] } = data

  return (
    <div style={{
      background: T.cdoBg, border: `2px solid ${T.cdoBdr}`, borderRadius: 10,
      minWidth: NODE_W.cdo, boxShadow: T.shadow, overflow: 'visible', position: 'relative',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      {/* Input handle */}
      <Handle type="target" position={Position.Left} id="in"
        style={{ ...HANDLE_BASE, background: T.cdoBdr, left: -6 }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', fontWeight: 700, fontSize: 13,
        borderRadius: '8px 8px 0 0', background: T.cdoHdrBg, color: T.cdoHdr,
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>📦</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
            {nome}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {tipo && (
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700,
              background: T.cdoBdr + '33', color: T.cdoHdr, border: `1px solid ${T.cdoBdr}55`,
            }}>
              {tipo}
            </span>
          )}
          {entrada?.pon != null && (
            <span style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>
              PON {entrada.pon}
            </span>
          )}
        </div>
      </div>

      {/* Bandejas com fusões */}
      {bandejas.length > 0 && (
        <div style={{ padding: '5px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {bandejas.map(bdj => {
            const ponRows = (bdj.fusoes ?? []).filter(f => f.tipo === 'pon')
            return (
              <div key={bdj.id} style={{
                borderRadius: 6, border: `1px solid ${T.border}`,
                background: T.bg2 + '88', overflow: 'visible',
              }}>
                {/* Cabeçalho bandeja */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '3px 8px', borderBottom: `1px solid ${T.border}`,
                  fontSize: 9, fontWeight: 700, color: T.muted, textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  <span>{bdj.nome}</span>
                  <span>{ponRows.length} PON{ponRows.length !== 1 ? 's' : ''}</span>
                </div>
                {/* Linhas de fusão */}
                {(bdj.fusoes ?? []).map(f => {
                  const entHex = abntHex(f.entrada?.fibra)
                  const saiHex = abntHex(f.saida?.fibra ?? f.entrada?.fibra)
                  const isPon  = f.tipo === 'pon'
                  return (
                    <div key={f.id} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', position: 'relative', overflow: 'visible',
                      fontSize: 10,
                      background: isPon && f.splitter_id ? T.cdoBdr + '08' : 'transparent',
                      borderBottom: `1px solid ${T.border}18`,
                    }}>
                      {/* Dot entrada */}
                      <span style={{
                        width: 9, height: 9, borderRadius: '50%', background: entHex,
                        display: 'inline-block', flexShrink: 0,
                        boxShadow: `0 0 4px ${entHex}77`,
                        border: `1px solid ${T.border}`,
                      }} />
                      <span style={{ color: T.muted, fontSize: 9 }}>F{f.entrada?.fibra ?? '?'}</span>
                      <span style={{ color: T.border, fontSize: 9 }}>→</span>
                      {/* Dot saída */}
                      <span style={{
                        width: 9, height: 9, borderRadius: '50%', background: saiHex,
                        display: 'inline-block', flexShrink: 0,
                        boxShadow: `0 0 4px ${saiHex}77`,
                        border: `1px solid ${T.border}`,
                      }} />
                      <span style={{ color: saiHex, fontSize: 9, fontWeight: 700 }}>
                        F{f.saida?.fibra ?? f.entrada?.fibra ?? '?'}
                      </span>
                      {isPon && (
                        <span style={{ color: T.cdoBdr, fontSize: 9, marginLeft: 2 }}>
                          PON{f.pon_porta ? `/${f.pon_porta}` : ''}
                          {f.splitter_id ? ' →SPL' : ' ⚠'}
                        </span>
                      )}
                      {/* Handle inline — alinhado à linha de fusão, sai para o splitter */}
                      {isPon && f.splitter_id && (
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`spl-${f.splitter_id}`}
                          style={{
                            ...HANDLE_BASE,
                            width: 12, height: 12,
                            position: 'absolute', right: -16, top: '50%',
                            transform: 'translateY(-50%)',
                            background: saiHex,
                            boxShadow: `0 0 7px ${saiHex}aa`,
                            zIndex: 10,
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Sem bandejas: handle genérico */}
      {bandejas.length === 0 && (
        <div style={{ padding: '8px 12px', color: T.muted, fontSize: 11 }}>
          Sem bandejas configuradas
        </div>
      )}

      {/* Fallback handle — visível só quando não há ponFusões com splitter */}
      <Handle type="source" position={Position.Right} id="out"
        style={{
          ...HANDLE_BASE, background: T.cdoBdr, right: -6,
          opacity: ponFusoes.length > 0 ? 0 : 1,
        }} />
    </div>
  )
}

// ─── Splitter Node ───────────────────────────────────────────────────────────

function SplitterNode({ data }) {
  const { T, nome, tipo, entrada, saidas = [] } = data
  const ligadas = saidas.filter(s => s.cto_id?.trim()).length

  return (
    <div style={{
      background: T.splBg, border: `2px solid ${T.splBdr}`, borderRadius: 10,
      minWidth: NODE_W.splitter, boxShadow: T.shadow, overflow: 'visible', position: 'relative',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      <Handle type="target" position={Position.Left} id="in"
        style={{ ...HANDLE_BASE, background: T.splBdr, left: -6 }} />

      {/* Header — height = SPL_HEADER_H (38px) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', fontWeight: 700, fontSize: 13, height: SPL_HEADER_H,
        borderRadius: '8px 8px 0 0', background: T.splHdrBg, color: T.splHdr,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span style={{ fontSize: 13, flexShrink: 0 }}>🔀</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nome}
          </span>
        </div>
        {tipo && (
          <span style={{
            fontSize: 10, padding: '1px 7px', borderRadius: 4, fontWeight: 700, flexShrink: 0,
            background: T.splBdr + '33', border: `1px solid ${T.splBdr}55`, color: T.splHdr,
          }}>
            {tipo}
          </span>
        )}
      </div>

      {/* Fiber entrance row — height = SPL_ENTRY_H (32px) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 12px', height: SPL_ENTRY_H, boxSizing: 'border-box',
        borderBottom: `1px solid ${T.border}40`,
      }}>
        {entrada?.fibra != null ? (
          <>
            <span style={{
              width: 9, height: 9, borderRadius: '50%', background: abntHex(entrada.fibra),
              display: 'inline-block', boxShadow: `0 0 5px ${abntHex(entrada.fibra)}88`,
              border: `1px solid ${abntHex(entrada.fibra)}aa`, flexShrink: 0,
            }} />
            <span style={{ color: T.muted, fontSize: 11 }}>Entrada F{entrada.fibra}</span>
          </>
        ) : (
          <span style={{ color: T.muted, fontSize: 11 }}>{saidas.length} portas · {ligadas} ligadas</span>
        )}
        {entrada?.fibra != null && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 700,
            color: ligadas === saidas.length ? T.ctoBdr : ligadas > 0 ? '#f59e0b' : T.muted,
          }}>
            {ligadas}/{saidas.length}
          </span>
        )}
      </div>

      {/* Output rows — each SPL_ROW_H (24px), handle inline per row */}
      {saidas.map((s, idx) => {
        const porta   = s.porta ?? s.num ?? (idx + 1)
        const hasLink = !!s.cto_id?.trim()
        const hex     = abntHex(porta)
        const label   = s.cto_id?.trim() || (s.obs?.trim() || 'livre')
        return (
          <div
            key={porta}
            title={`S${porta} (${ABNT[(porta - 1) % 12]?.nome ?? ''}) → ${label}`}
            style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', gap: 5,
              height: SPL_ROW_H, padding: '0 14px 0 10px',
              boxSizing: 'border-box',
              borderBottom: idx < saidas.length - 1 ? `1px solid ${T.border}20` : 'none',
              background: hasLink ? `${hex}08` : 'transparent',
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: hasLink ? hex : 'transparent',
              border: `2px solid ${hex}`,
              boxShadow: hasLink ? `0 0 4px ${hex}66` : 'none',
            }} />
            <span style={{ fontSize: 9, color: hex, fontWeight: 700, minWidth: 18, flexShrink: 0 }}>
              S{porta}
            </span>
            <span style={{
              fontSize: 9, color: hasLink ? T.text : T.muted,
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
            {/* Handle inline — alinhado à linha da porta, na direita */}
            <Handle
              type="source"
              position={Position.Right}
              id={`s-${porta}`}
              style={{
                ...HANDLE_BASE,
                width: 10, height: 10,
                position: 'absolute', right: -6, top: '50%',
                transform: 'translateY(-50%)',
                background: hex,
                boxShadow: `0 0 5px ${hex}77`,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Passagem Node ───────────────────────────────────────────────────────────

function PassagemNode({ data }) {
  const { T, nome, label } = data
  return (
    <div style={{
      background: T.bg2, border: `2px dashed ${T.muted}`, borderRadius: 8,
      minWidth: 140, boxShadow: T.shadow, overflow: 'visible', position: 'relative',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      <Handle type="target" position={Position.Left} id="in"
        style={{ ...HANDLE_BASE, background: T.muted, left: -6 }} />
      <Handle type="source" position={Position.Right} id="out"
        style={{ ...HANDLE_BASE, background: T.muted, right: -6 }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 12px', fontSize: 11,
      }}>
        <span style={{ fontSize: 13 }}>↔</span>
        <div>
          <div style={{ fontWeight: 700, color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Passagem</div>
          <div style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{nome || label || '—'}</div>
        </div>
      </div>
    </div>
  )
}

// ─── CTO Node ────────────────────────────────────────────────────────────────

function CTONode({ data }) {
  const { T, nome, cto_id, capacidade = 16, ocupacao = 0, fibraEntrada,
          bandejas = [], splitters = [] } = data
  const pct     = Math.min(1, ocupacao / Math.max(1, capacidade))
  const livres  = capacidade - ocupacao
  const cheio   = livres <= 0
  const alertC  = cheio ? '#ef4444' : pct > 0.8 ? '#f59e0b' : T.ctoBdr
  const segs    = Math.min(capacidade, 16)
  const filled  = Math.round(pct * segs)

  return (
    <div style={{
      background: T.ctoBg, borderRadius: 10,
      border: `2px solid ${alertC}`,
      minWidth: NODE_W.cto, boxShadow: cheio
        ? `0 0 16px #ef444455, ${T.shadow}`
        : T.shadow,
      overflow: 'visible', position: 'relative',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      <Handle type="target" position={Position.Left} id="in"
        style={{ ...HANDLE_BASE, background: alertC, left: -6 }} />
      <Handle type="source" position={Position.Right} id="out"
        style={{ ...HANDLE_BASE, background: alertC, right: -6 }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', fontWeight: 700, fontSize: 12,
        borderRadius: '8px 8px 0 0', background: T.ctoHdrBg, color: alertC,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13 }}>📡</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
            {nome}
          </span>
        </div>
        {cto_id && (
          <span style={{ fontSize: 9, color: T.muted, fontFamily: 'monospace', flexShrink: 0 }}>
            {cto_id}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* Badge fibra de entrada (identidade da FO) */}
        {fibraEntrada != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
              background: abntHex(fibraEntrada),
              boxShadow: `0 0 4px ${abntHex(fibraEntrada)}88`,
              border: `1px solid ${abntHex(fibraEntrada)}aa`,
            }} />
            <span style={{ color: T.muted }}>F{fibraEntrada} {ABNT[(fibraEntrada - 1) % 12]?.nome ?? ''}</span>
          </div>
        )}
        {/* Barra de ocupação */}
        <div style={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: segs }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 6, borderRadius: 2,
              background: i < filled ? alertC : T.border,
              boxShadow: i < filled && cheio ? `0 0 3px ${alertC}99` : 'none',
            }} />
          ))}
        </div>
        {/* Contador */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
          <span style={{ color: T.muted }}>{ocupacao}/{capacidade} portas</span>
          <span style={{ color: alertC, fontWeight: 700 }}>
            {cheio ? '🔴 CHEIO' : `${livres} livre${livres !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* ── Bandejas + Splitters internos ── */}
      {(bandejas.length > 0 || splitters.length > 0) && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: '4px 10px 8px' }}>

          {bandejas.map(b => {
            const fusoes = b.fusoes ?? []
            const ativas = fusoes.filter(f => f.tipo !== 'livre').length
            return (
              <div key={b.id} style={{ marginBottom: 5 }}>
                {/* Bandeja header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: T.bg2, borderRadius: '4px 4px 0 0',
                  padding: '3px 6px', marginBottom: 1,
                  borderBottom: `1px solid ${T.border}`,
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#0891b2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                    🗂 {b.nome}
                  </span>
                  <span style={{ fontSize: 8, color: ativas > 0 ? T.ctoBdr : T.muted, fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>
                    {ativas}/{fusoes.length}
                  </span>
                </div>

                {/* Uma linha por fusão — visual igual ao editor */}
                <div style={{
                  backgroundColor: T.bg, border: `1px solid ${T.border}`,
                  borderTop: 'none', borderRadius: '0 0 4px 4px', padding: '2px 4px',
                }}>
                  {fusoes.map(f => {
                    const hex      = abntHex(f.cor)
                    const abntNome = ABNT[(f.cor - 1) % 12]?.nome ?? ''
                    const vivo     = f.tipo !== 'livre'

                    // Resolve target legível (igual ao editor)
                    const splObj = f.tipo === 'splitter'
                      ? splitters.find(s => s.id === f.ref_id)
                      : null
                    const splNome = splObj
                      ? `${splObj.nome ?? `Splitter ${splitters.indexOf(splObj) + 1}`} (${splObj.tipo})`
                      : null
                    const target =
                      f.tipo === 'splitter' ? (splNome ?? f.ref_id ?? '?') :
                      f.tipo === 'cascata'  ? (f.ref_id ?? '?') :
                      f.tipo === 'direto'   ? 'Porta direta' : null

                    const tipoText =
                      f.tipo === 'splitter' ? '→ Splitter' :
                      f.tipo === 'cascata'  ? '→ Cascata'  :
                      f.tipo === 'direto'   ? '→ Direto'   : 'livre'
                    const tipoColor =
                      f.tipo === 'splitter' ? '#7c3aed' :
                      f.tipo === 'cascata'  ? '#0891b2' :
                      f.tipo === 'direto'   ? '#16a34a' : T.muted

                    return (
                      <div
                        key={f.id}
                        title={`#${f.pos} F${f.cor} ${abntNome} · ${f.tipo}${target ? ` → ${target}` : ''}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '2px 2px', marginBottom: 1,
                          borderRadius: 3,
                          backgroundColor: vivo ? `${tipoColor}0c` : 'transparent',
                          opacity: vivo ? 1 : 0.45,
                        }}
                      >
                        {/* #pos */}
                        <span style={{ fontSize: 7, color: T.muted, fontWeight: 700, minWidth: 14, textAlign: 'right', flexShrink: 0 }}>
                          #{f.pos}
                        </span>

                        {/* Badge colorido (como o select do editor) */}
                        <span style={{
                          backgroundColor: hex, color: '#fff',
                          borderRadius: 3, padding: '0 5px',
                          fontSize: 8, fontWeight: 700,
                          whiteSpace: 'nowrap', flexShrink: 0,
                          lineHeight: '14px',
                        }}>
                          {f.cor}. {abntNome}
                        </span>

                        {/* → Tipo + target */}
                        <span style={{
                          fontSize: 7, color: tipoColor, fontWeight: vivo ? 700 : 400,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flex: 1, lineHeight: 1,
                        }}>
                          {tipoText}{target ? `: ${target}` : ''}
                        </span>
                      </div>
                    )
                  })}
                  {fusoes.length === 0 && (
                    <span style={{ fontSize: 8, color: T.muted, padding: '2px 4px', display: 'block', fontStyle: 'italic' }}>
                      Sem fusões
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {splitters.length > 0 && (
            <div style={{ marginTop: bandejas.length > 0 ? 4 : 0 }}>
              {splitters.map((spl, si) => {
                const ocup  = (spl.saidas ?? []).filter(sd => sd.cliente?.trim()).length
                const total = (spl.saidas ?? []).length
                const p     = total > 0 ? ocup / total : 0
                const barC  = p >= 0.9 ? '#ef4444' : p >= 0.7 ? '#f59e0b' : '#16a34a'
                return (
                  <div key={spl.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: si < splitters.length - 1 ? 3 : 0 }}>
                    <span style={{ fontSize: 9, color: T.muted, minWidth: 46, whiteSpace: 'nowrap' }}>🔀 {spl.tipo}</span>
                    <div style={{ flex: 1, height: 4, backgroundColor: T.border, borderRadius: 2 }}>
                      <div style={{ width: `${p * 100}%`, height: '100%', backgroundColor: barC, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 9, color: barC, fontWeight: 700, minWidth: 26, textAlign: 'right' }}>
                      {ocup}/{total}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Registro de node types ───────────────────────────────────────────────────

const NODE_TYPES = { olt: OLTNode, cdo: CDONode, splitter: SplitterNode, cto: CTONode, passagem: PassagemNode }

// ─── buildGraph ───────────────────────────────────────────────────────────────

function buildGraph(topologia, T) {
  if (!topologia?.length) return { nodes: [], edges: [] }

  const nodes = []
  const edges = []
  const ctoSet   = new Set()   // tracks cto-* node ids
  const cdoSet   = new Set()   // tracks cdo-* node ids (by caixa.id)
  const miscSet  = new Set()   // tracks passagem-* and other misc node ids
  const allCTOs   = topologia[0]._allCTOs   ?? []
  const allCaixas = topologia[0]._allCaixas ?? []

  let ei = 0
  function edge(src, tgt, style, opts = {}) {
    edges.push({ id: `e${ei++}`, source: src, target: tgt, style, type: 'smoothstep', ...opts })
  }

  function lookupCTO(id) {
    return allCTOs.find(c => String(c.cto_id) === String(id) || String(c._id) === String(id))
  }

  function lookupCDO(id) {
    return allCaixas.find(c => String(c.id) === String(id) || String(c._id) === String(id))
  }

  // parentSrcHandle: handle no nó pai de onde sai a aresta
  //   'out' → OLT (ou CDO sem splitter específico)
  //   's-N' → porta N do SplitterNode
  function processCDO(caixa, parentId, parentStyle, parentSrcHandle = 'out', extraEdgeOpts = {}) {
    if (cdoSet.has(String(caixa.id))) return
    cdoSet.add(String(caixa.id))

    const cdoId   = `cdo-${caixa.id}`
    const diag    = caixa.diagrama ?? {}
    const bandejas  = diag.bandejas  ?? []
    const splitters = diag.splitters ?? []
    const entrada   = diag.entrada   ?? {}

    // Fusões PON de todas as bandejas → mapeamento splitter_id → fusão
    const allFusoes = bandejas.flatMap(b => (b.fusoes ?? []).map(f => ({ ...f })))
    const ponFusoes = allFusoes.filter(f => f.tipo === 'pon' && f.splitter_id)
    const ponMap    = new Map(ponFusoes.map(f => [String(f.splitter_id), f]))

    nodes.push({
      id: cdoId, type: 'cdo', position: { x: 0, y: 0 },
      data: { T, nome: caixa.nome, tipo: caixa.tipo, entrada, bandejas, ponFusoes },
    })

    // Edge: parent → CDO — PON label só faz sentido quando vem diretamente da OLT
    const ponLabel = parentSrcHandle === 'out' && entrada?.pon != null ? `PON ${entrada.pon}` : undefined
    edge(parentId, cdoId, parentStyle, {
      sourceHandle: parentSrcHandle, targetHandle: 'in',
      ...(ponLabel ? {
        label: ponLabel,
        labelStyle: { fill: T.oltHdr, fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: T.oltHdrBg + 'cc', borderRadius: 3 },
      } : {}),
      ...extraEdgeOpts,
    })

    // Processar cada splitter
    for (const spl of splitters) {
      const splNodeId = `spl-${caixa.id}-${spl.id}`
      const saidas    = spl.saidas ?? []
      const ponFusao  = ponMap.get(String(spl.id))
      // Fibra real: vem da fusão PON → saida.fibra, ou da entrada do splitter
      const splFibra  = ponFusao?.saida?.fibra ?? ponFusao?.entrada?.fibra ?? spl.entrada?.fibra
      const splHex    = abntHex(splFibra)

      nodes.push({
        id: splNodeId, type: 'splitter', position: { x: 0, y: 0 },
        data: { T, nome: spl.nome, tipo: spl.tipo, entrada: spl.entrada, saidas },
      })

      // Edge CDO → Splitter (usa handle inline da bandeja se há fusão PON vinculada)
      const srcHandle = ponFusao ? `spl-${spl.id}` : 'out'
      const fLabel    = splFibra != null ? `F${splFibra}` : undefined
      const eStyle    = { ...T.distrib, stroke: splHex || T.distrib.stroke }
      edge(cdoId, splNodeId, eStyle, {
        sourceHandle: srcHandle, targetHandle: 'in',
        ...(fLabel ? {
          label: fLabel,
          labelStyle: { fill: splHex, fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: T.cdoBg + 'cc', borderRadius: 3 },
        } : {}),
      })

      // Edges Splitter → destinos (CTO | CDO | Passagem)
      // Ordenar por porta para que Dagre posicione F1 em cima, F2 abaixo, etc.
      const saidasOrdenadas = saidas.slice().sort((a, b) => (a.porta ?? a.num ?? 0) - (b.porta ?? b.num ?? 0))
      for (let idx = 0; idx < saidasOrdenadas.length; idx++) {
        const s       = saidasOrdenadas[idx]
        const porta   = s.porta ?? s.num ?? (idx + 1)
        const destTipo = s.tipo ?? 'cto'           // tipo da saída (cto|cdo|passagem|pon|conector|…)

        if (!s.cto_id?.trim()) continue            // sem destino configurado

        const portaHex = abntHex(porta)
        const edgeLabelOpts = {
          label: `F${porta}`,
          labelStyle:   { fill: portaHex, fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: T.ctoBg + 'cc', borderRadius: 3 },
        }

        // ── CDO/CE como destino ──
        if (destTipo === 'cdo' || destTipo === 'ce') {
          const cdoKey  = String(s.cto_id)
          const eStyle  = { ...T.drop, stroke: portaHex, strokeWidth: 2 }
          if (!cdoSet.has(cdoKey)) {
            const cdoData = lookupCDO(s.cto_id)
            if (cdoData) {
              // CDO encontrado no DB — processa recursivo com handle e label corretos
              processCDO(cdoData, splNodeId, eStyle, `s-${porta}`, edgeLabelOpts)
            } else {
              // CDO não encontrado → stub visual
              cdoSet.add(cdoKey)
              nodes.push({
                id: `cdo-${cdoKey}`, type: 'cdo', position: { x: 0, y: 0 },
                data: { T, nome: s.obs?.trim() || `CDO ${s.cto_id}`, tipo: 'CDO', entrada: {}, bandejas: [], ponFusoes: [] },
              })
              edge(splNodeId, `cdo-${cdoKey}`, eStyle,
                { sourceHandle: `s-${porta}`, targetHandle: 'in', ...edgeLabelOpts }
              )
            }
          } else {
            // CDO já no grafo — adiciona apenas a aresta deste splitter
            edge(splNodeId, `cdo-${cdoKey}`, eStyle,
              { sourceHandle: `s-${porta}`, targetHandle: 'in', ...edgeLabelOpts }
            )
          }
          continue
        }

        // ── Passagem ──
        if (destTipo === 'passagem') {
          const miscId = `passagem-${String(s.cto_id)}`
          if (!miscSet.has(miscId)) {
            miscSet.add(miscId)
            nodes.push({
              id: miscId, type: 'passagem', position: { x: 0, y: 0 },
              data: { T, nome: s.obs?.trim() || s.cto_id, label: s.cto_id },
            })
          }
          edge(splNodeId, miscId,
            { ...T.drop, stroke: portaHex, strokeWidth: 1.5, strokeDasharray: '5,3' },
            { sourceHandle: `s-${porta}`, targetHandle: 'in', ...edgeLabelOpts }
          )
          continue
        }

        // ── Tipos não gráficos (pon, conector, fusao_bandeja) ── skip visual
        if (destTipo !== 'cto' && destTipo !== 'ce') continue

        // ── CTO (padrão) ──
        const ctoKey = String(s.cto_id)
        if (!ctoSet.has(ctoKey)) {
          ctoSet.add(ctoKey)
          const ctoData = lookupCTO(s.cto_id) ?? { cto_id: s.cto_id, nome: s.obs?.trim() || `CTO ${s.cto_id}` }
          nodes.push({
            id: `cto-${ctoKey}`, type: 'cto', position: { x: 0, y: 0 },
            data: {
              T,
              nome:         ctoData.nome,
              cto_id:       ctoData.cto_id ?? s.cto_id,
              capacidade:   ctoData.capacidade  ?? 16,
              ocupacao:     ctoData.ocupacao    ?? 0,
              fibraEntrada: porta,
              bandejas:     ctoData.diagrama?.bandejas  ?? [],
              splitters:    ctoData.diagrama?.splitters ?? [],
            },
          })
        }

        edge(splNodeId, `cto-${ctoKey}`,
          { ...T.drop, stroke: portaHex, strokeWidth: 2 },
          { sourceHandle: `s-${porta}`, targetHandle: 'in', ...edgeLabelOpts }
        )
      }
    }
  }

  for (const olt of topologia) {
    const oltId  = `olt-${olt.id}`
    const caixas = olt.caixas ?? []

    nodes.push({
      id: oltId, type: 'olt', position: { x: 0, y: 0 },
      data: { T, nome: olt.nome, modelo: olt.modelo, ip: olt.ip,
              capacidade: olt.capacidade, status: olt.status, ponCount: caixas.length },
    })

    for (const caixa of caixas) {
      processCDO(caixa, oltId, T.feeder)
    }
  }

  return { nodes, edges }
}

// ─── Layout Dagre ─────────────────────────────────────────────────────────────

function calcCTOHeight(bandejas = [], splitters = []) {
  if (!bandejas.length && !splitters.length) return NODE_H.cto
  // Per-bandeja: 22px header + n_fusoes * 15px (badge row + margin) + 8px gap
  let h = 96
  for (const b of bandejas) {
    const n = Math.max(1, b.fusoes?.length ?? 0)
    h += 22 + n * 15 + 8
  }
  // Splitters section: 4px top margin + 16px per splitter
  if (splitters.length > 0) h += 4 + splitters.length * 16
  return Math.max(NODE_H.cto, h)
}

function calcH(node) {
  if (node.type === 'cdo')      return calcCDOHeight(node.data?.bandejas ?? [])
  if (node.type === 'splitter') return calcSplitterHeight(node.data?.saidas ?? [])
  if (node.type === 'cto')      return calcCTOHeight(node.data?.bandejas ?? [], node.data?.splitters ?? [])
  return NODE_H[node.type] ?? 140
}

function dagreLayout(nodes, edges) {
  const g = new Dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 55, ranksep: 200, edgesep: 30 })

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_W[n.type] ?? 220, height: calcH(n) })
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target)
  }

  Dagre.layout(g)

  const laid = nodes.map(n => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: {
        x: pos.x - (NODE_W[n.type] ?? 220) / 2,
        y: pos.y - calcH(n) / 2,
      },
    }
  })

  // Pós-processamento: ordenar CTOs dentro de cada coluna por porta (F1→F8)
  // Dagre já tenta minimizar cruzamentos, mas não garante ordenação por fibraEntrada.
  const ctoNodes = laid.filter(n => n.type === 'cto')
  if (ctoNodes.length > 1) {
    // Agrupar CTOs pela mesma coluna (mesmo X, tolerância de 20px)
    const groups = new Map()
    for (const n of ctoNodes) {
      const xKey = Math.round(n.position.x / 20) * 20
      if (!groups.has(xKey)) groups.set(xKey, [])
      groups.get(xKey).push(n)
    }
    for (const group of groups.values()) {
      if (group.length <= 1) continue
      // Y positions ocupadas por este grupo, ordenadas de cima para baixo
      const ys = group.map(n => n.position.y).sort((a, b) => a - b)
      // Ordenar o grupo por fibraEntrada (porta), depois redistribuir os Ys
      const sorted = group.slice().sort((a, b) =>
        (a.data?.fibraEntrada ?? 99) - (b.data?.fibraEntrada ?? 99)
      )
      sorted.forEach((n, i) => {
        const node = laid.find(l => l.id === n.id)
        if (node) node.position.y = ys[i]
      })
    }
  }

  return laid
}

// ─── Painel de legenda ────────────────────────────────────────────────────────

function LegendPanel({ T }) {
  return (
    <div style={{
      background: T.panelBg, border: `1px solid ${T.panelBorder}`,
      borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(6px)',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", minWidth: 180,
    }}>
      {/* Tipos de enlace */}
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: T.muted, marginBottom: 6 }}>
        Tipos de enlace
      </div>
      {[
        { label: 'Feeder  OLT → CDO',    color: T.feeder.stroke,  w: 3 },
        { label: 'Distribuição  CDO → SPL', color: T.distrib.stroke, w: 2 },
        { label: 'Drop  SPL → CTO',      color: T.drop.stroke,    w: 1.5 },
      ].map(it => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <svg width={28} height={10} style={{ flexShrink: 0 }}>
            <line x1={0} y1={5} x2={28} y2={5} stroke={it.color} strokeWidth={it.w} />
          </svg>
          <span style={{ fontSize: 10, color: T.muted }}>{it.label}</span>
        </div>
      ))}
      {/* Fibras ABNT */}
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: T.muted, marginTop: 8, marginBottom: 6,
        borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>
        Fibras ABNT NBR 14721
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {ABNT.map(f => (
          <div key={f.idx}
            title={`F${f.idx} — ${f.nome}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
              background: f.hex + '28', border: `1px solid ${f.hex}55`,
              color: f.hex,
            }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: f.hex, display: 'inline-block' }} />
            F{f.idx}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Inner component (needs ReactFlow context) ────────────────────────────────

function DiagramaFluxoInner({ projetoId }) {
  const { theme } = useTheme()
  const isDark    = theme === 'dark'
  const T         = useMemo(() => mkTheme(isDark), [isDark])

  const isMobile = useMobile()
  const [legendOpen, setLegendOpen] = useState(false)

  const [nodes,   setNodes]   = useState([])
  const [edges,   setEdges]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [stats,   setStats]   = useState(null)

  const { fitView } = useReactFlow()

  const runLayout = useCallback((ns, es) => {
    const laid = dagreLayout(ns, es)
    setNodes(laid)
    setEdges(es)
    setTimeout(() => fitView({ padding: 0.12, duration: 500 }), 80)
  }, [fitView])

  const load = useCallback(() => {
    if (!projetoId) return
    setLoading(true)
    setError(null)
    getTopologia(projetoId)
      .then(topo => {
        const { nodes: ns, edges: es } = buildGraph(topo, T)
        setStats({
          olts:      ns.filter(n => n.type === 'olt').length,
          cdos:      ns.filter(n => n.type === 'cdo').length,
          splitters: ns.filter(n => n.type === 'splitter').length,
          ctos:      ns.filter(n => n.type === 'cto').length,
        })
        runLayout(ns, es)
      })
      .catch(e => setError(e?.message ?? 'Erro ao carregar topologia'))
      .finally(() => setLoading(false))
  }, [projetoId, T, runLayout])

  useEffect(() => { load() }, [load])

  // Auto-reload when editor saves diagram data
  useEffect(() => {
    const handler = () => load()
    window.addEventListener('fiberops:topologia-changed', handler)
    return () => window.removeEventListener('fiberops:topologia-changed', handler)
  }, [load])

  // Re-theme all nodes when theme changes (without reload)
  useEffect(() => {
    if (nodes.length === 0) return
    setNodes(prev => prev.map(n => ({ ...n, data: { ...n.data, T } })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T])

  const handleOrganize = useCallback(() => runLayout(nodes, edges), [nodes, edges, runLayout])
  const handleFitView  = useCallback(() => fitView({ padding: 0.12, duration: 500 }), [fitView])

  const btnStyle = {
    padding: '7px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
    border: `1px solid ${T.panelBorder}`, background: T.panelBg,
    color: T.text, backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', gap: 5,
  }

  // ── Loading ──
  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: T.canvas, color: T.muted,
      gap: 10, fontSize: 14, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: `2px solid ${T.border}`, borderTopColor: T.feeder.stroke,
        animation: 'spin .8s linear infinite',
      }} />
      Carregando topologia...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Error ──
  if (error) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      height: '100%', background: T.canvas, gap: 10,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      <span style={{ fontSize: 28 }}>⚠️</span>
      <span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span>
      <button onClick={load} style={{ ...btnStyle, marginTop: 8, color: T.feeder.stroke }}>
        ↻ Tentar novamente
      </button>
    </div>
  )

  // ── Empty ──
  if (nodes.length === 0) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: T.canvas, color: T.muted, fontSize: 14, flexDirection: 'column', gap: 8,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      <span style={{ fontSize: 32 }}>📡</span>
      <span>Nenhuma topologia configurada.</span>
      <span style={{ fontSize: 12 }}>Configure OLTs e CE/CDOs para visualizar o diagrama.</span>
    </div>
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      fitView
      minZoom={0.08}
      maxZoom={2.5}
      style={{ background: T.canvas }}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        color={isDark ? '#21262d' : '#cbd5e1'}
        gap={20}
        size={1.5}
      />
      <Controls
        style={{
          background: T.panelBg, border: `1px solid ${T.panelBorder}`,
          borderRadius: 8, backdropFilter: 'blur(4px)',
        }}
      />
      {/* MiniMap — desktop only (hides on mobile to maximise diagram space) */}
      {!isMobile && (
        <MiniMap
          style={{ background: T.mmBg, border: `1px solid ${T.panelBorder}` }}
          maskColor={T.mmMask}
          nodeColor={n => {
            if (n.type === 'olt')      return T.oltBdr
            if (n.type === 'cdo')      return T.cdoBdr
            if (n.type === 'splitter') return T.splBdr
            if (n.type === 'cto')      return T.ctoBdr
            if (n.type === 'passagem') return T.muted
            return T.muted
          }}
        />
      )}

      {/* Toolbar */}
      <Panel position="top-left">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6,
          fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
          <div style={{ display: 'flex', gap: isMobile ? 4 : 6, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <button onClick={handleOrganize} style={{ ...btnStyle, padding: isMobile ? '5px 10px' : '7px 14px', fontSize: isMobile ? 11 : 12 }}>⚡ Organizar</button>
            <button onClick={handleFitView}  style={{ ...btnStyle, padding: isMobile ? '5px 10px' : '7px 14px', fontSize: isMobile ? 11 : 12 }}>⊡ Ajustar</button>
            <button onClick={load} style={{ ...btnStyle, color: T.muted, padding: isMobile ? '5px 10px' : '7px 14px', fontSize: isMobile ? 11 : 12 }}>↻ Atualizar</button>
          </div>
          {/* Badges de contagem — hidden on mobile */}
          {stats && !isMobile && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {[
                { label: 'OLT',  val: stats.olts,      c: T.oltBdr },
                { label: 'CDO',  val: stats.cdos,      c: T.cdoBdr },
                { label: 'SPL',  val: stats.splitters, c: T.splBdr },
                { label: 'CTO',  val: stats.ctos,      c: T.ctoBdr },
              ].map(s => (
                <div key={s.label} style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: T.panelBg, border: `1px solid ${s.c}55`, color: s.c,
                  backdropFilter: 'blur(4px)',
                }}>
                  {s.val} {s.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {/* Legenda — desktop only */}
      {!isMobile && (
        <Panel position="bottom-left">
          <LegendPanel T={T} />
        </Panel>
      )}
    </ReactFlow>

    {/* Mobile FAB + bottom sheet legend */}
    {isMobile && (
      <>
        {/* FAB button */}
        <button
          onClick={() => setLegendOpen(o => !o)}
          style={{
            position: 'absolute', right: 14, bottom: 80, zIndex: 50,
            width: 48, height: 48, borderRadius: '50%',
            background: T.feeder.stroke, color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          }}
        >
          🔗
        </button>

        {/* Bottom sheet */}
        {legendOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setLegendOpen(false)}
              style={{
                position: 'absolute', inset: 0, zIndex: 51,
                background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
              }}
            />
            {/* Sheet */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 52,
              background: T.panelBg, borderTop: `2px solid ${T.panelBorder}`,
              borderRadius: '16px 16px 0 0',
              padding: '16px 20px 32px',
              maxHeight: '60vh', overflowY: 'auto',
              fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
            }}>
              {/* Handle bar */}
              <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>Legenda da Topologia</span>
                <button onClick={() => setLegendOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: 20, color: T.muted, cursor: 'pointer', lineHeight: 1 }}>
                  ✕
                </button>
              </div>
              {/* Tipos de enlace */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted, marginBottom: 10 }}>
                  Tipos de enlace
                </div>
                {[
                  { label: 'Feeder — OLT → CDO',       color: T.feeder.stroke,  w: 3 },
                  { label: 'Distribuição — CDO → SPL',  color: T.distrib.stroke, w: 2 },
                  { label: 'Drop — SPL → CTO',          color: T.drop.stroke,    w: 1.5 },
                ].map(it => (
                  <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <svg width={36} height={12} style={{ flexShrink: 0 }}>
                      <line x1={0} y1={6} x2={36} y2={6} stroke={it.color} strokeWidth={it.w} />
                    </svg>
                    <span style={{ fontSize: 14, color: T.text }}>{it.label}</span>
                  </div>
                ))}
              </div>
              {/* Fibras ABNT */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted, marginBottom: 10 }}>
                  Fibras ABNT NBR 14721
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {ABNT.map(f => (
                    <div key={f.idx} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 8,
                      background: f.hex + '22', border: `1px solid ${f.hex}55`,
                    }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: f.hex, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: f.hex }}>F{f.idx}</span>
                      <span style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </>
    )}
    </div>
  )
}

// ─── Wrapper com Provider ─────────────────────────────────────────────────────

export default function DiagramaFluxo({ projetoId, altura = '100%' }) {
  return (
    <div style={{ width: '100%', height: altura }}>
      <ReactFlowProvider>
        <DiagramaFluxoInner projetoId={projetoId} />
      </ReactFlowProvider>
    </div>
  )
}
