'use client'

/**
 * DiagramaFluxo.js
 * Canvas interativo de topologia de rede óptica FTTH usando React Flow v12 (@xyflow/react).
 * Renderiza: OLT → CDO/CE (com bandeja de fusões) → Splitters → CTOs
 *
 * Funcionalidades:
 *  - Layout automático via dagre (LR)
 *  - Nós customizados com temas por tipo
 *  - Arestas coloridas por cor ABNT da fibra
 *  - Zoom/pan, minimap, controles
 *  - Toolbar com Auto Layout e Ajustar Tela
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Dagre from '@dagrejs/dagre'
import { getTopologia } from '@/actions/olts'

// ─── Tabela de cores ABNT NBR 14721 ─────────────────────────────────────────

const ABNT = [
  { idx: 1,  nome: 'Verde',    hex: '#16a34a' },
  { idx: 2,  nome: 'Amarelo',  hex: '#ca8a04' },
  { idx: 3,  nome: 'Branco',   hex: '#94a3b8' },
  { idx: 4,  nome: 'Azul',     hex: '#2563eb' },
  { idx: 5,  nome: 'Vermelho', hex: '#dc2626' },
  { idx: 6,  nome: 'Violeta',  hex: '#7c3aed' },
  { idx: 7,  nome: 'Marrom',   hex: '#92400e' },
  { idx: 8,  nome: 'Rosa',     hex: '#db2777' },
  { idx: 9,  nome: 'Preto',    hex: '#1e293b' },
  { idx: 10, nome: 'Cinza',    hex: '#6b7280' },
  { idx: 11, nome: 'Laranja',  hex: '#ea580c' },
  { idx: 12, nome: 'Ciano',    hex: '#0891b2' },
]

/** Retorna o objeto ABNT pelo índice de fibra (base-1, cicla). */
function abntByFibra(fibra) {
  if (!fibra || fibra < 1) return ABNT[0]
  return ABNT[(fibra - 1) % ABNT.length]
}

/** Retorna o hex ABNT pelo índice (base-1). */
function abntHex(fibra) {
  return abntByFibra(fibra).hex
}

// ─── Paleta do tema escuro ───────────────────────────────────────────────────

const C = {
  bg:       '#060a16',
  border:   '#21262d',
  text:     '#e6edf3',
  muted:    '#8b949e',
  // OLT
  oltBg:    '#050f1f',
  oltBdr:   '#0891b2',
  oltHdr:   '#67e8f9',
  // CDO
  cdoBg:    '#0d0820',
  cdoBdr:   '#7c3aed',
  cdoHdr:   '#c4b5fd',
  // Splitter
  splBg:    '#1a0d00',
  splBdr:   '#ea580c',
  splHdr:   '#fb923c',
  // CTO
  ctoBg:    '#052e16',
  ctoBdr:   '#16a34a',
  ctoHdr:   '#4ade80',
  // Cascata
  casBg:    '#0c0520',
  casBdr:   '#a78bfa',
  casHdr:   '#ddd6fe',
}

// ─── Estilos compartilhados ──────────────────────────────────────────────────

const nodeBase = {
  borderRadius: 10,
  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontSize: 12,
  color: C.text,
  boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
  position: 'relative',
  overflow: 'visible',
}

const hdrBase = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  fontWeight: 700,
  fontSize: 13,
  borderRadius: '8px 8px 0 0',
  letterSpacing: 0.3,
}

const bodyBase = {
  padding: '8px 12px',
}

const handleStyle = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  border: '2px solid #21262d',
}

// ─── OLTFlowNode ─────────────────────────────────────────────────────────────

function OLTFlowNode({ data }) {
  const { nome, modelo, ip, capacidade, status, ponCount } = data

  const statusColor = status === 'ativo' ? '#16a34a' : status === 'inativo' ? '#dc2626' : '#ca8a04'

  return (
    <div
      style={{
        ...nodeBase,
        backgroundColor: C.oltBg,
        border: `2px solid ${C.oltBdr}`,
        minWidth: 200,
      }}
    >
      {/* Header */}
      <div style={{ ...hdrBase, backgroundColor: 'rgba(8,145,178,0.15)', color: C.oltHdr }}>
        <span style={{ fontSize: 15 }}>🖥️</span>
        <span style={{ flex: 1 }}>{nome || 'OLT'}</span>
        <span
          style={{
            fontSize: 10,
            background: 'rgba(8,145,178,0.25)',
            color: C.oltHdr,
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          OLT
        </span>
      </div>

      {/* Body */}
      <div style={bodyBase}>
        {modelo && (
          <div style={{ color: C.muted, marginBottom: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#93c5fd' }}>{modelo}</span>
          </div>
        )}
        {ip && (
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, marginBottom: 4 }}>
            {ip}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          {ponCount !== undefined && (
            <span style={{ fontSize: 11, color: C.muted }}>
              <span style={{ color: C.oltHdr, fontWeight: 700 }}>{ponCount}</span> PON
            </span>
          )}
          {capacidade && (
            <span style={{ fontSize: 11, color: C.muted }}>
              Cap: <span style={{ color: C.text }}>{capacidade}</span>
            </span>
          )}
          <span
            style={{
              marginLeft: 'auto',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: statusColor,
              display: 'inline-block',
            }}
            title={status}
          />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ ...handleStyle, backgroundColor: C.oltBdr, right: -6 }}
      />
    </div>
  )
}

// ─── CDOFlowNode ─────────────────────────────────────────────────────────────

function CDOFlowNode({ data }) {
  const { nome, tipo, bandejas, splitters, entrada, isCascata } = data

  const bg    = isCascata ? C.casBg  : C.cdoBg
  const bdr   = isCascata ? C.casBdr : C.cdoBdr
  const hdr   = isCascata ? C.casHdr : C.cdoHdr
  const bdrStyle = isCascata ? 'dashed' : 'solid'

  // Bypass splitters são saídas diretas da bandeja — não mostrar como splitter real
  const realSplitters = (splitters ?? []).filter(s => !s.id?.startsWith('bypass-'))
  const splCount = realSplitters.length

  // Saídas diretas da bandeja (tipo saida_cto / saida_cdo)
  const directOuts = useMemo(() => {
    const out = []
    for (const b of bandejas ?? []) {
      for (const f of b.fusoes ?? []) {
        if ((f.tipo === 'saida_cto' || f.tipo === 'saida_cdo') && f.destino_id?.trim()) {
          out.push({ ...f, bandejaNome: b.nome })
        }
      }
    }
    return out
  }, [bandejas])

  // Fusões regulares (excluindo saídas diretas) para exibir no diagrama
  const fusoes = useMemo(() => {
    const all = []
    if (!bandejas) return all
    for (const bandeja of bandejas) {
      for (const fusao of bandeja.fusoes ?? []) {
        if (fusao.tipo === 'saida_cto' || fusao.tipo === 'saida_cdo') continue
        all.push({ ...fusao, bandejaNome: bandeja.nome })
      }
    }
    return all.slice(0, 24)
  }, [bandejas])

  // Divide em duas colunas: esquerda (inputs) e direita (outputs)
  const half   = Math.ceil(fusoes.length / 2)
  const colA   = fusoes.slice(0, half)
  const colB   = fusoes.slice(half)

  return (
    <div
      style={{
        ...nodeBase,
        backgroundColor: bg,
        border: `2px ${bdrStyle} ${bdr}`,
        minWidth: 280,
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ ...handleStyle, backgroundColor: bdr, left: -6 }}
      />

      {/* Header */}
      <div style={{ ...hdrBase, backgroundColor: `${bdr}22`, color: hdr }}>
        <span style={{ fontSize: 14 }}>{isCascata ? '🔗' : '🔌'}</span>
        <span style={{ flex: 1 }}>{nome || tipo || 'CDO'}</span>
        <span
          style={{
            fontSize: 10,
            background: `${bdr}33`,
            color: hdr,
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 700,
          }}
        >
          {isCascata ? 'CE/CDO · CASCATA' : (tipo || 'CDO')}
        </span>
      </div>

      {/* Entrada info */}
      {entrada && (
        <div
          style={{
            padding: '4px 12px',
            fontSize: 11,
            color: C.muted,
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            gap: 12,
          }}
        >
          {entrada.pon && (
            <span>PON <span style={{ color: hdr, fontWeight: 700 }}>{entrada.pon}</span></span>
          )}
          {entrada.porta_olt && (
            <span>Porta <span style={{ color: hdr }}>{entrada.porta_olt}</span></span>
          )}
        </div>
      )}

      {/* Bandeja — fusões regulares */}
      {fusoes.length > 0 && (
        <div style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Entrada</div>
            {colA.map((f, i) => <FibraRow key={f.id ?? i} pos={f.pos ?? (i + 1)} cor={f.cor} />)}
          </div>
          <div style={{ width: 1, backgroundColor: C.border, margin: '0 4px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saída</div>
            {colB.map((f, i) => <FibraRow key={f.id ?? i} pos={f.pos ?? (half + i + 1)} cor={f.cor} />)}
          </div>
        </div>
      )}

      {/* Saídas diretas da bandeja — cada uma com handle inline */}
      {directOuts.length > 0 && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: '6px 12px 8px',
        }}>
          <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
            Saída direta bandeja
          </div>
          {directOuts.map((f) => {
            const fo = ABNT[((f.entrada?.fibra ?? 1) - 1) % ABNT.length]
            return (
              <div key={f.id} style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', gap: 6,
                height: 22, paddingRight: 16,
              }}>
                {/* FO color dot */}
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: fo?.hex ?? '#22c55e',
                  border: '1px solid rgba(255,255,255,0.15)',
                }} />
                {/* Label */}
                <span style={{ fontSize: 10, color: '#e6edf3', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  FO{f.entrada?.fibra ?? 1} → <span style={{ color: '#4ade80', fontWeight: 700 }}>{f.destino_id}</span>
                </span>
                {/* Arrow badge */}
                <span style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', marginRight: 4 }}>→</span>
                {/* Inline handle at this row */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`direct-${f.id}`}
                  style={{ ...handleStyle, backgroundColor: '#22c55e', right: -6, top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Splitter count footer */}
      {splCount > 0 && (
        <div style={{ padding: '4px 12px 8px', fontSize: 11, color: C.muted, borderTop: `1px solid ${C.border}` }}>
          <span style={{ color: C.splHdr, fontWeight: 700 }}>{splCount}</span> splitter{splCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Output handles — one per real splitter */}
      {realSplitters.map((spl, idx) => {
        const total = Math.max(splCount, 1)
        const pct = total === 1 ? 50 : ((idx / (total - 1)) * 80 + 10)
        return (
          <Handle
            key={spl.id ?? idx}
            type="source"
            position={Position.Right}
            id={`spl-${spl.id ?? idx}`}
            style={{ ...handleStyle, backgroundColor: C.splBdr, right: -6, top: `${pct}%`, transform: 'translateY(-50%)' }}
          />
        )
      })}

      {/* Fallback single output handle when no splitters and no direct outs */}
      {splCount === 0 && directOuts.length === 0 && (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ ...handleStyle, backgroundColor: bdr, right: -6 }}
        />
      )}
    </div>
  )
}

/** Linha de fibra na bandeja do CDO. */
function FibraRow({ pos, cor }) {
  // cor pode ser índice ABNT (1-12) ou string hex
  const corObj = typeof cor === 'number' ? ABNT[(cor - 1) % ABNT.length] : null
  const hex    = corObj ? corObj.hex : (cor || '#374151')
  const label  = pos != null ? `FO-${String(pos).padStart(2, '0')}` : ''

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
        height: 14,
      }}
    >
      <span style={{ fontSize: 9, color: C.muted, width: 30, textAlign: 'right', fontFamily: 'monospace' }}>
        {label}
      </span>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: hex,
          border: '1px solid rgba(255,255,255,0.2)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, height: 1, backgroundColor: hex, opacity: 0.4 }} />
    </div>
  )
}

// ─── SplitterFlowNode ────────────────────────────────────────────────────────

function SplitterFlowNode({ data }) {
  const { nome, tipo, entrada, saidas } = data

  const saidaCount = saidas?.length ?? 0
  const entradaHex = entrada?.fibra ? abntHex(entrada.fibra) : '#6b7280'

  return (
    <div
      style={{
        ...nodeBase,
        backgroundColor: C.splBg,
        border: `2px solid ${C.splBdr}`,
        minWidth: 180,
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ ...handleStyle, backgroundColor: C.splBdr, left: -6 }}
      />

      {/* Header */}
      <div style={{ ...hdrBase, backgroundColor: 'rgba(234,88,12,0.15)', color: C.splHdr }}>
        <span style={{ fontSize: 13 }}>⚡</span>
        <span style={{ flex: 1 }}>Splitter</span>
        <span
          style={{
            fontSize: 11,
            background: 'rgba(234,88,12,0.3)',
            color: '#fed7aa',
            padding: '2px 7px',
            borderRadius: 4,
            fontWeight: 700,
          }}
        >
          {tipo || '1x8'}
        </span>
      </div>

      {/* Body */}
      <div style={bodyBase}>
        {nome && (
          <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>{nome}</div>
        )}

        {/* Entrada */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: entradaHex,
              border: '1px solid rgba(255,255,255,0.2)',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11, color: C.muted }}>
            {entrada?.tubo !== undefined && entrada?.fibra !== undefined
              ? `T${entrada.tubo}:F${entrada.fibra}`
              : 'Entrada'}
          </span>
        </div>

        {/* Saídas preview */}
        <div style={{ fontSize: 11, color: C.muted }}>
          <span style={{ color: C.splHdr, fontWeight: 700 }}>{saidaCount}</span> saída{saidaCount !== 1 ? 's' : ''}
        </div>

        {/* Observações das saídas */}
        {(saidas ?? []).map((sd, i) => sd.obs ? (
          <div key={i} style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
            S{sd.num}: {sd.obs}
          </div>
        ) : null)}
      </div>

      {/* Output handles — one per saida */}
      {(saidas ?? []).map((sd, idx) => {
        const total = Math.max(saidaCount, 1)
        const pct   = total === 1 ? 50 : ((idx / (total - 1)) * 80 + 10)
        const hex   = abntHex(idx + 1)
        return (
          <Handle
            key={sd.num ?? idx}
            type="source"
            position={Position.Right}
            id={`s-${sd.num ?? (idx + 1)}`}
            style={{
              ...handleStyle,
              backgroundColor: hex,
              right: -6,
              top: `${pct}%`,
              transform: 'translateY(-50%)',
            }}
          />
        )
      })}

      {/* Fallback single output handle when no saidas */}
      {saidaCount === 0 && (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ ...handleStyle, backgroundColor: C.splBdr, right: -6 }}
        />
      )}
    </div>
  )
}

// ─── CTOFlowNode ─────────────────────────────────────────────────────────────

function CTOFlowNode({ data }) {
  const { nome, cto_id, capacidade, ocupacao, caboId } = data

  const cap   = capacidade || 16
  const ocu   = ocupacao   || 0
  const pct   = cap > 0 ? Math.round((ocu / cap) * 100) : 0

  // Cor da barra de ocupação
  function segColor(segIdx) {
    const segPct = ((segIdx + 1) / 10) * 100
    if (segPct > pct) return '#21262d'
    if (pct >= 100)   return '#dc2626'
    if (pct >= 80)    return '#ea580c'
    if (pct >= 50)    return '#ca8a04'
    return '#16a34a'
  }

  return (
    <div
      style={{
        ...nodeBase,
        backgroundColor: C.ctoBg,
        border: `1.5px solid ${C.ctoBdr}`,
        minWidth: 200,
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ ...handleStyle, backgroundColor: C.ctoBdr, left: -6 }}
      />

      {/* Header */}
      <div style={{ ...hdrBase, backgroundColor: 'rgba(22,163,74,0.15)', color: C.ctoHdr }}>
        <span style={{ fontSize: 13 }}>📦</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nome || cto_id || 'CTO'}
        </span>
      </div>

      {/* Body */}
      <div style={bodyBase}>
        {cto_id && (
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#86efac', marginBottom: 4 }}>
            {cto_id}
          </div>
        )}
        {caboId && (
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>
            Cabo: <span style={{ color: C.text }}>{caboId}</span>
          </div>
        )}

        {/* Occupation bar — 10 segments */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 2,
                backgroundColor: segColor(i),
                transition: 'background-color 0.2s',
              }}
            />
          ))}
        </div>

        <div style={{ fontSize: 11, color: C.muted }}>
          <span style={{ color: pct >= 100 ? '#f87171' : pct >= 80 ? '#fb923c' : C.ctoHdr, fontWeight: 700 }}>
            {ocu}
          </span>
          <span>/{cap}</span>
          <span style={{ marginLeft: 6, color: C.muted }}>({pct}%)</span>
        </div>
      </div>
    </div>
  )
}

// ─── Registro de tipos de nó ─────────────────────────────────────────────────

const nodeTypes = {
  olt:      OLTFlowNode,
  cdo:      CDOFlowNode,
  splitter: SplitterFlowNode,
  cto:      CTOFlowNode,
}

// ─── Auto-layout com dagre ───────────────────────────────────────────────────

/** Larguras/alturas estimadas por tipo de nó para o dagre. */
const NODE_DIMS = {
  olt:      { width: 200, height: 130 },
  cdo:      { width: 280, height: 220 },
  splitter: { width: 180, height: 140 },
  cto:      { width: 200, height: 110 },
}

function layoutGraph(nodes, edges) {
  const g = new Dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir:  'LR',
    nodesep:  60,
    ranksep:  120,
    marginx:  50,
    marginy:  50,
  })

  nodes.forEach((n) => {
    const dims = NODE_DIMS[n.type] ?? { width: 200, height: 120 }
    g.setNode(n.id, { width: n.width ?? dims.width, height: n.height ?? dims.height })
  })
  edges.forEach((e) => g.setEdge(e.source, e.target))

  Dagre.layout(g)

  return nodes.map((n) => {
    const pos  = g.node(n.id)
    const dims = NODE_DIMS[n.type] ?? { width: 200, height: 120 }
    const w    = n.width  ?? dims.width
    const h    = n.height ?? dims.height
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - h / 2 } }
  })
}

// ─── Construção do grafo a partir da topologia ───────────────────────────────

function buildGraphFromTopologia(topologia) {
  const nodes       = []
  const edges       = []
  const ctoNodeSet  = new Set() // evita duplicatas de CTO

  for (const olt of topologia) {
    const oltNodeId = `olt-${olt.id}`

    // --- Nó OLT ---
    nodes.push({
      id:   oltNodeId,
      type: 'olt',
      position: { x: 0, y: 0 },
      data: {
        nome:       olt.nome,
        modelo:     olt.modelo,
        ip:         olt.ip,
        capacidade: olt.capacidade,
        status:     olt.status,
        ponCount:   (olt.caixas ?? []).length,
      },
    })

    for (const cdo of (olt.caixas ?? [])) {
      const cdoNodeId = `cdo-${cdo.id}`
      const isCascata = cdo.tipo === 'CE'
      const diagrama  = cdo.diagrama ?? {}
      const splitters = diagrama.splitters ?? []
      const bandejas  = diagrama.bandejas  ?? []
      const entrada   = diagrama.entrada   ?? {}

      // --- Nó CDO/CE ---
      nodes.push({
        id:   cdoNodeId,
        type: 'cdo',
        position: { x: 0, y: 0 },
        data: {
          nome:       cdo.nome,
          tipo:       cdo.tipo,
          isCascata,
          bandejas,
          splitters,
          entrada,
        },
      })

      // --- Aresta OLT → CDO ---
      const ponLabel = entrada?.pon ? `PON ${entrada.pon}` : 'Backbone'
      edges.push({
        id:     `e-olt-${cdo.id}`,
        source: oltNodeId,
        target: cdoNodeId,
        sourceHandle: 'out',
        targetHandle: 'in',
        label:  ponLabel,
        type:   'smoothstep',
        style:  { stroke: '#0891b2', strokeWidth: 2 },
        labelStyle: { fill: '#67e8f9', fontSize: 11, fontWeight: 600 },
        labelBgStyle: { fill: '#050f1f', fillOpacity: 0.85 },
      })

      // --- Nós Splitter e arestas CDO → Splitter (apenas splitters reais) ---
      const realSplitters = splitters.filter(s => !s.id?.startsWith('bypass-'))
      for (const spl of realSplitters) {
        const splNodeId = `spl-${spl.id}`
        const saidas    = spl.saidas ?? []

        nodes.push({
          id:   splNodeId,
          type: 'splitter',
          position: { x: 0, y: 0 },
          data: {
            nome:   spl.nome,
            tipo:   spl.tipo,
            entrada: spl.entrada,
            saidas,
          },
        })

        // Cor da aresta baseada na fibra de entrada do splitter
        const edgeFibraHex = spl.entrada?.fibra ? abntHex(spl.entrada.fibra) : '#7c3aed'
        const edgeLabel    = spl.entrada?.tubo !== undefined && spl.entrada?.fibra !== undefined
          ? `T${spl.entrada.tubo}:F${spl.entrada.fibra}`
          : undefined

        edges.push({
          id:           `e-cdo-spl-${cdo.id}-${spl.id}`,
          source:       cdoNodeId,
          target:       splNodeId,
          sourceHandle: `spl-${spl.id}`,
          targetHandle: 'in',
          label:        edgeLabel,
          type:         'smoothstep',
          style:        { stroke: edgeFibraHex, strokeWidth: 2 },
          labelStyle:   { fill: edgeFibraHex, fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: '#0d0820', fillOpacity: 0.85 },
        })

        // --- Nós CTO e arestas Splitter → CTO ---
        for (const saida of saidas) {
          if (!saida.cto_id) continue

          const ctoNodeId = `cto-${saida.cto_id}`

          // Encontra o CTO nos dados da CDO
          const ctoData = (cdo.ctos ?? []).find((c) => c.cto_id === saida.cto_id)

          if (!ctoNodeSet.has(ctoNodeId)) {
            ctoNodeSet.add(ctoNodeId)
            nodes.push({
              id:   ctoNodeId,
              type: 'cto',
              position: { x: 0, y: 0 },
              data: {
                nome:       ctoData?.nome        ?? saida.cto_id,
                cto_id:     saida.cto_id,
                capacidade: ctoData?.capacidade,
                ocupacao:   ctoData?.ocupacao,
                caboId:     ctoData?.diagrama?.entrada?.cabo_id,
              },
            })
          }

          const saidaNum   = saida.num ?? 1
          const edgeColor  = abntHex(saidaNum)

          edges.push({
            id:           `e-spl-cto-${spl.id}-${saida.cto_id}`,
            source:       splNodeId,
            target:       ctoNodeId,
            sourceHandle: `s-${saidaNum}`,
            targetHandle: 'in',
            label:        `S${saidaNum}`,
            type:         'smoothstep',
            style:        { stroke: edgeColor, strokeWidth: 1.5 },
            labelStyle:   { fill: edgeColor, fontSize: 10, fontWeight: 600 },
            labelBgStyle: { fill: '#052e16', fillOpacity: 0.8 },
          })
        }
      }

      // --- Saídas diretas da bandeja (saida_cto / saida_cdo): aresta CDO → CTO sem splitter ---
      for (const bandeja of bandejas) {
        for (const fusao of (bandeja.fusoes ?? [])) {
          if (fusao.tipo !== 'saida_cto' && fusao.tipo !== 'saida_cdo') continue
          if (!fusao.destino_id?.trim()) continue

          const destId    = fusao.destino_id.trim()
          const ctoNodeId = `cto-${destId}`
          const ctoData   = (cdo.ctos ?? []).find(c => c.cto_id === destId)
          const fibraHex  = fusao.entrada?.fibra ? abntHex(fusao.entrada.fibra) : '#22c55e'
          const foLabel   = fusao.entrada?.fibra != null
            ? `T${fusao.entrada?.tubo ?? 1}:F${fusao.entrada.fibra}`
            : 'direto'

          if (!ctoNodeSet.has(ctoNodeId)) {
            ctoNodeSet.add(ctoNodeId)
            nodes.push({
              id:   ctoNodeId,
              type: fusao.tipo === 'saida_cdo' ? 'cdo' : 'cto',
              position: { x: 0, y: 0 },
              data: {
                nome:       ctoData?.nome ?? destId,
                cto_id:     destId,
                capacidade: ctoData?.capacidade,
                ocupacao:   ctoData?.ocupacao,
              },
            })
          }

          edges.push({
            id:           `e-direct-${cdo.id}-${fusao.id}`,
            source:       cdoNodeId,
            target:       ctoNodeId,
            sourceHandle: `direct-${fusao.id}`,
            targetHandle: 'in',
            label:        foLabel,
            type:         'smoothstep',
            animated:     false,
            style:        { stroke: fibraHex, strokeWidth: 2 },
            labelStyle:   { fill: fibraHex, fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: '#060a16', fillOpacity: 0.85 },
          })
        }
      }

      // --- CTOs sem splitter: aresta direta CDO → CTO (gray dashed) ---
      const ctoIdsComSplitter = new Set([
        ...realSplitters.flatMap(spl => (spl.saidas ?? []).map(sd => sd.cto_id).filter(Boolean)),
        ...bandejas.flatMap(b => (b.fusoes ?? [])
          .filter(f => f.tipo === 'saida_cto' && f.destino_id?.trim())
          .map(f => f.destino_id.trim())),
      ])

      for (const cto of (cdo.ctos ?? [])) {
        if (ctoIdsComSplitter.has(cto.cto_id)) continue

        const ctoNodeId = `cto-${cto.cto_id}`

        if (!ctoNodeSet.has(ctoNodeId)) {
          ctoNodeSet.add(ctoNodeId)
          nodes.push({
            id:   ctoNodeId,
            type: 'cto',
            position: { x: 0, y: 0 },
            data: {
              nome:       cto.nome,
              cto_id:     cto.cto_id,
              capacidade: cto.capacidade,
              ocupacao:   cto.ocupacao,
              caboId:     cto.diagrama?.entrada?.cabo_id,
            },
          })
        }

        edges.push({
          id:           `e-cdo-cto-direct-${cdo.id}-${cto.cto_id}`,
          source:       cdoNodeId,
          target:       ctoNodeId,
          sourceHandle: 'out',
          targetHandle: 'in',
          type:         'smoothstep',
          style:        { stroke: '#6b7280', strokeWidth: 1.5, strokeDasharray: '5,4' },
          labelStyle:   { fill: '#6b7280', fontSize: 10 },
          labelBgStyle: { fill: '#060a16', fillOpacity: 0.8 },
        })
      }
    }
  }

  return { nodes, edges }
}

// ─── Componente interno com acesso ao ReactFlow context ──────────────────────

function DiagramaFluxoInner({ projetoId, altura }) {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const { fitView } = useReactFlow()

  // Carrega e constrói o grafo
  useEffect(() => {
    if (!projetoId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    getTopologia(projetoId)
      .then((topologia) => {
        if (!topologia || topologia.length === 0) {
          setNodes([])
          setEdges([])
          return
        }
        const { nodes: rawNodes, edges: rawEdges } = buildGraphFromTopologia(topologia)
        const laid = layoutGraph(rawNodes, rawEdges)
        setNodes(laid)
        setEdges(rawEdges)
        // fitView after state settles
        setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 80)
      })
      .catch((err) => {
        console.error('[DiagramaFluxo] Erro ao carregar topologia:', err)
        setError(err?.message ?? 'Erro ao carregar topologia')
      })
      .finally(() => setLoading(false))
  }, [projetoId, fitView])

  // Auto layout manual
  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return
    const laid = layoutGraph(nodes, edges)
    setNodes(laid)
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 60)
  }, [nodes, edges, fitView])

  // Ajustar tela
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.15, duration: 400 })
  }, [fitView])

  return (
    <>
      {/* Override React Flow default styles for dark theme */}
      <style>{`
        .react-flow__controls button {
          background-color: #161b22 !important;
          border-color: #21262d !important;
          color: #e6edf3 !important;
        }
        .react-flow__controls button:hover {
          background-color: #21262d !important;
        }
        .react-flow__controls button svg {
          fill: #e6edf3 !important;
        }
        .react-flow__minimap {
          background-color: #0d1117 !important;
          border: 1px solid #21262d !important;
          border-radius: 8px !important;
          overflow: hidden !important;
        }
        .react-flow__edge-path {
          filter: drop-shadow(0 0 3px rgba(0,0,0,0.8));
        }
        .react-flow__edge-label {
          font-size: 11px !important;
        }
        .react-flow__node {
          border-radius: 10px !important;
        }
      `}</style>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.15}
        maxZoom={2.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 2 },
        }}
        style={{ backgroundColor: C.bg }}
        proOptions={{ hideAttribution: true }}
      >
        {/* Controls */}
        <Controls
          style={{
            backgroundColor: '#161b22',
            border: '1px solid #21262d',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        />

        {/* MiniMap */}
        <MiniMap
          style={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: 8 }}
          nodeColor={(n) => {
            if (n.type === 'olt')      return C.oltBdr
            if (n.type === 'cdo')      return n.data?.isCascata ? C.casBdr : C.cdoBdr
            if (n.type === 'splitter') return C.splBdr
            if (n.type === 'cto')      return C.ctoBdr
            return '#21262d'
          }}
          maskColor="rgba(6,10,22,0.7)"
        />

        {/* Background dots */}
        <Background color="#21262d" gap={20} size={1} variant={BackgroundVariant.Dots} />

        {/* Toolbar */}
        <Panel position="top-left">
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              background: 'rgba(13,17,23,0.92)',
              border: '1px solid #21262d',
              borderRadius: 8,
              padding: '6px 10px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <button
              onClick={handleAutoLayout}
              style={{
                background: 'rgba(234,88,12,0.15)',
                border: '1px solid rgba(234,88,12,0.4)',
                color: '#fb923c',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>⚡</span> Auto Layout
            </button>

            <button
              onClick={handleFitView}
              style={{
                background: 'rgba(8,145,178,0.12)',
                border: '1px solid rgba(8,145,178,0.35)',
                color: '#67e8f9',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>⊡</span> Ajustar
            </button>

            {loading && (
              <span
                style={{
                  fontSize: 11,
                  color: '#8b949e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#0891b2',
                    animation: 'pulse 1.2s infinite',
                  }}
                />
                Carregando...
              </span>
            )}

            {error && (
              <span style={{ fontSize: 11, color: '#f87171' }}>
                Erro: {error}
              </span>
            )}
          </div>
        </Panel>

        {/* Legend */}
        <Panel position="bottom-right">
          <div
            style={{
              background: 'rgba(13,17,23,0.92)',
              border: '1px solid #21262d',
              borderRadius: 8,
              padding: '8px 12px',
              backdropFilter: 'blur(8px)',
              fontSize: 11,
              color: '#8b949e',
              minWidth: 130,
            }}
          >
            <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: 6, fontSize: 11 }}>
              Legenda
            </div>
            {[
              { color: C.oltBdr, label: 'OLT' },
              { color: C.cdoBdr, label: 'CDO' },
              { color: C.casBdr, label: 'CE/Cascata', dashed: true },
              { color: C.splBdr, label: 'Splitter' },
              { color: C.ctoBdr, label: 'CTO' },
            ].map(({ color, label, dashed }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
                    flexShrink: 0,
                  }}
                />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </Panel>
      </ReactFlow>
    </>
  )
}

// ─── Componente exportado — auto-wrapped em ReactFlowProvider ────────────────

/**
 * DiagramaFluxo
 * Canvas interativo de topologia FTTH com React Flow v12.
 *
 * @param {Object} props
 * @param {string} props.projetoId - ID do projeto para buscar a topologia
 * @param {number} [props.altura=700] - Altura do canvas em pixels
 */
export default function DiagramaFluxo({ projetoId, altura = 700 }) {
  return (
    <div
      style={{
        height: altura,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
        position: 'relative',
      }}
    >
      <ReactFlowProvider>
        <DiagramaFluxoInner projetoId={projetoId} altura={altura} />
      </ReactFlowProvider>
    </div>
  )
}
