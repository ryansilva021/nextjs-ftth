'use client'

/**
 * DiagramaTopologiaFlow.js
 * Diagrama de topologia FTTH no estilo profissional:
 *   OLT → CDO (grade de fibras) → Splitter (por saída) → CTO
 *
 * Usa @xyflow/react + @dagrejs/dagre para layout automático LR.
 */

import { useEffect, useState, useCallback, memo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { getTopologia } from '@/actions/olts'

// ── Cores ABNT NBR 14721 (12 fibras por tubo) ──────────────────────────────
const ABNT = [
  { idx: 1,  nome: 'Verde',    hex: '#22c55e' },
  { idx: 2,  nome: 'Amarelo',  hex: '#eab308' },
  { idx: 3,  nome: 'Branco',   hex: '#cbd5e1' },
  { idx: 4,  nome: 'Azul',     hex: '#3b82f6' },
  { idx: 5,  nome: 'Vermelho', hex: '#ef4444' },
  { idx: 6,  nome: 'Violeta',  hex: '#a855f7' },
  { idx: 7,  nome: 'Marrom',   hex: '#a16207' },
  { idx: 8,  nome: 'Rosa',     hex: '#ec4899' },
  { idx: 9,  nome: 'Preto',    hex: '#6b7280' },
  { idx: 10, nome: 'Cinza',    hex: '#94a3b8' },
  { idx: 11, nome: 'Laranja',  hex: '#f97316' },
  { idx: 12, nome: 'Ciano',    hex: '#06b6d4' },
]

function fiberColor(idx) {
  if (!idx || idx < 1) return '#475569'
  return ABNT[((idx - 1) % 12)].hex
}

function parseSplitterRatio(tipo) {
  if (!tipo) return 8
  const m = String(tipo).match(/(\d+)\s*[xX×]\s*(\d+)/)
  return m ? parseInt(m[2]) : 8
}

// ── Dimensões dos nodes ─────────────────────────────────────────────────────
const CDO_HEADER_H  = 44
const CDO_BANDEJA_H = 50
const CDO_WIDTH     = 280
const SPL_HEADER_H  = 44
const SPL_PORT_H    = 28
const SPL_WIDTH     = 155
const OLT_WIDTH     = 175
const OLT_HEIGHT    = 100
const CTO_WIDTH     = 148
const CTO_HEIGHT    = 62
const CE_WIDTH      = 178
const CE_HEIGHT     = 88

function cdoHeight(splitterCount) {
  if (splitterCount === 0) return CDO_HEADER_H + 44
  return CDO_HEADER_H + splitterCount * CDO_BANDEJA_H + 12
}
function splHeight(ratio) {
  return SPL_HEADER_H + ratio * SPL_PORT_H + 12
}

// ── 1. DATA LAYER ───────────────────────────────────────────────────────────

function buildGraphData(topologia) {
  const nodes = []
  const edges = []
  const seenCTOs = new Set()

  for (const olt of topologia) {
    const oltNid = `olt-${olt.id ?? olt._id}`

    nodes.push({
      id: oltNid,
      type: 'oltNode',
      position: { x: 0, y: 0 },
      data: {
        nome:       olt.nome,
        ip:         olt.ip,
        modelo:     olt.modelo,
        capacidade: olt.capacidade ?? 16,
        status:     olt.status ?? 'ativo',
      },
    })

    const caixas = olt.caixas ?? []

    for (const caixa of caixas) {
      const caixaNid  = `cdo-${caixa.id ?? caixa._id}`
      const isCE      = caixa.tipo?.toUpperCase() === 'CE'
      const splitters = caixa.diagrama?.splitters ?? []
      const entrada   = caixa.diagrama?.entrada   ?? {}

      // Calcula portCount para visualização da grade de fibras
      const portCount = Math.max(12, Math.ceil(splitters.length / 2) * 12)

      // Fibras de entrada de cada splitter (para posicionar handles no CDO)
      const splFibras = splitters.map((s, i) => s.entrada?.fibra ?? (i * 2 + 1))

      nodes.push({
        id: caixaNid,
        type: isCE ? 'ceNode' : 'cdoNode',
        position: { x: 0, y: 0 },
        data: {
          nome:          caixa.nome ?? caixa.id,
          tipo:          caixa.tipo ?? 'CDO',
          portaOlt:      entrada.porta_olt ?? caixa.porta_olt ?? null,
          pon:           entrada.pon       ?? null,
          portCount,
          splitterCount: splitters.length,
          splFibras,
          splitters,     // dados completos para bandejas
          ctoCount:      (caixa.ctos ?? []).length,
        },
      })

      // Edge OLT → CDO
      edges.push({
        id:     `e-${oltNid}-${caixaNid}`,
        source: oltNid,
        target: caixaNid,
        type:   'bezier',
        label:  'Backbone',
        style:  { stroke: '#0891b2', strokeWidth: 2.5 },
        labelStyle:   { fill: '#67e8f9', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: 'rgba(4,12,28,0.9)', rx: 4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2', width: 12, height: 12 },
      })

      // Splitters
      for (let si = 0; si < splitters.length; si++) {
        const spl    = splitters[si]
        const splNid = `spl-${caixaNid}-${si}`
        const ratio  = parseSplitterRatio(spl.tipo)
        const fibra  = spl.entrada?.fibra ?? (si * 2 + 1)
        const tubeLabel = spl.nome
          ? spl.nome
          : `T${Math.ceil(fibra / 12)}:F${((fibra - 1) % 12) + 1}`
        const edgeColor = fiberColor(fibra)

        nodes.push({
          id:   splNid,
          type: 'splitterNode',
          position: { x: 0, y: 0 },
          data: {
            nome:        `Splitter ${si + 1}`,
            tipo:        spl.tipo ?? '1x8',
            ratio,
            tubeLabel,
            colorIn:     edgeColor,
            saidas:      spl.saidas ?? [],
          },
        })

        // Edge CDO → Splitter
        edges.push({
          id:           `e-${caixaNid}-${splNid}`,
          source:       caixaNid,
          target:       splNid,
          sourceHandle: `out-${si}`,
          type:         'bezier',
          label:        tubeLabel,
          style:        { stroke: edgeColor, strokeWidth: 2 },
          labelStyle:   { fill: edgeColor, fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 10, height: 10 },
        })

        // Saídas do splitter → destinos (CTO, passagem ou outro)
        const saidas = spl.saidas ?? []
        for (let saIdx = 0; saIdx < saidas.length; saIdx++) {
          const saida   = saidas[saIdx]
          const destId  = saida?.cto_id ?? saida?.id
          if (!destId) continue

          const destTipo = saida?.tipo ?? (saida?.cto_id ? 'cto' : 'passagem')
          const destNid  = `${destTipo}-${destId}`
          const portNum  = saida.num ?? (saIdx + 1)
          const portColor = fiberColor(portNum)

          if (!seenCTOs.has(destNid)) {
            seenCTOs.add(destNid)
            if (destTipo === 'cto') {
              const ctoData = (caixa.ctos ?? []).find(
                c => (c.cto_id ?? c._id) === destId
              )
              nodes.push({
                id:   destNid,
                type: 'ctoNode',
                position: { x: 0, y: 0 },
                data: {
                  nome:       ctoData?.nome ?? destId,
                  ctoId:      destId,
                  capacidade: ctoData?.capacidade ?? null,
                  ocupacao:   ctoData?.ocupacao   ?? 0,
                },
              })
            } else {
              // Passagem / outro elemento de rede
              nodes.push({
                id:   destNid,
                type: 'passagemNode',
                position: { x: 0, y: 0 },
                data: { nome: saida.nome ?? destId, destId, destTipo },
              })
            }
          }

          edges.push({
            id:           `e-${splNid}-${destNid}-p${portNum}`,
            source:       splNid,
            target:       destNid,
            sourceHandle: `s-out-${saIdx}`,
            type:         'bezier',
            label:        `S${portNum}`,
            style:        { stroke: portColor, strokeWidth: 1.5 },
            labelStyle:   { fill: portColor, fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
            markerEnd: { type: MarkerType.ArrowClosed, color: portColor, width: 9, height: 9 },
          })
        }
      }

      // CTOs sem splitter → conexão direta CDO→CTO
      if (splitters.length === 0) {
        for (const cto of (caixa.ctos ?? [])) {
          const ctoNid   = `cto-${cto.cto_id}`
          const portColor = fiberColor(cto.porta_cdo ?? 1)

          if (!seenCTOs.has(ctoNid)) {
            seenCTOs.add(ctoNid)
            nodes.push({
              id:   ctoNid,
              type: 'ctoNode',
              position: { x: 0, y: 0 },
              data: {
                nome:       cto.nome ?? cto.cto_id,
                ctoId:      cto.cto_id,
                capacidade: cto.capacidade ?? null,
                ocupacao:   cto.ocupacao   ?? 0,
              },
            })
          }

          edges.push({
            id:     `e-${caixaNid}-${ctoNid}`,
            source: caixaNid,
            target: ctoNid,
            type:   'bezier',
            label:  cto.porta_cdo != null ? `P${cto.porta_cdo}` : undefined,
            style:  { stroke: portColor, strokeWidth: 1.5 },
            labelStyle:   { fill: portColor, fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
            markerEnd: { type: MarkerType.ArrowClosed, color: portColor, width: 9, height: 9 },
          })
        }
      }
    }
  }

  return { nodes, edges }
}

// ── 2. LAYOUT LAYER ─────────────────────────────────────────────────────────

function getNodeDims(node) {
  switch (node.type) {
    case 'oltNode':     return { w: OLT_WIDTH, h: OLT_HEIGHT }
    case 'cdoNode':     return { w: CDO_WIDTH, h: cdoHeight(node.data.splitterCount ?? 0) }
    case 'ceNode':      return { w: CE_WIDTH,  h: CE_HEIGHT }
    case 'splitterNode':return { w: SPL_WIDTH, h: splHeight(parseSplitterRatio(node.data.tipo)) }
    case 'ctoNode':     return { w: CTO_WIDTH, h: CTO_HEIGHT }
    default:            return { w: 160, h: 80 }
  }
}

function applyDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 200, nodesep: 60, edgesep: 40, marginx: 80, marginy: 80 })

  for (const n of nodes) {
    const { w, h } = getNodeDims(n)
    g.setNode(n.id, { width: w, height: h })
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target)
  }

  dagre.layout(g)

  // Captura Y central de cada nó após o layout
  const centerY = {}
  for (const n of nodes) {
    const pos = g.node(n.id)
    if (pos) centerY[n.id] = pos.y
  }

  // --- Evitar cruzamento: agrupar arestas com handles customizados ---
  // Reordena handles de CDO→Splitter (out-N) e Splitter→CTO (s-out-N)
  // para que o handle mais alto sempre aponte para o nó mais acima no layout.
  const handleMap = {}   // `${srcId}|${origHandle}` → newHandle
  const dataOrder  = {}  // cdoId → [originalIdx] sorted top→bottom

  // CDO → Splitter: handles out-0, out-1, …
  const cdoOutEdges = {}
  for (const e of edges) {
    if (e.sourceHandle?.startsWith('out-')) {
      if (!cdoOutEdges[e.source]) cdoOutEdges[e.source] = []
      cdoOutEdges[e.source].push(e)
    }
  }
  for (const [cdoId, grp] of Object.entries(cdoOutEdges)) {
    const sorted = [...grp].sort((a, b) => (centerY[a.target] ?? 0) - (centerY[b.target] ?? 0))
    const order = []
    sorted.forEach((e, newIdx) => {
      handleMap[`${cdoId}|${e.sourceHandle}`] = `out-${newIdx}`
      order[newIdx] = parseInt(e.sourceHandle.replace('out-', ''), 10)
    })
    dataOrder[cdoId] = order
  }

  // Splitter → CTO: handles s-out-0, s-out-1, …
  const splOutEdges = {}
  for (const e of edges) {
    if (e.sourceHandle?.startsWith('s-out-')) {
      if (!splOutEdges[e.source]) splOutEdges[e.source] = []
      splOutEdges[e.source].push(e)
    }
  }
  for (const [splId, grp] of Object.entries(splOutEdges)) {
    const sorted = [...grp].sort((a, b) => (centerY[a.target] ?? 0) - (centerY[b.target] ?? 0))
    sorted.forEach((e, newIdx) => {
      handleMap[`${splId}|${e.sourceHandle}`] = `s-out-${newIdx}`
    })
  }

  const remappedEdges = edges.map(e => {
    const mapped = handleMap[`${e.source}|${e.sourceHandle}`]
    return mapped ? { ...e, sourceHandle: mapped } : e
  })

  const positionedNodes = nodes.map(n => {
    const pos = g.node(n.id)
    const { w, h } = getNodeDims(n)
    const base = {
      ...n,
      position:       { x: pos.x - w / 2, y: pos.y - h / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }
    // Reordena dados do CDO para coincidir com a nova ordem dos handles
    if (n.type === 'cdoNode' && dataOrder[n.id]) {
      const order = dataOrder[n.id]
      const origFibras = n.data.splFibras ?? []
      const origSpls   = n.data.splitters ?? []
      base.data = {
        ...n.data,
        splFibras: order.map(i => origFibras[i] ?? null),
        splitters: order.map(i => ({ ...(origSpls[i] ?? {}), _origIdx: i })),
      }
    }
    return base
  })

  return { nodes: positionedNodes, edges: remappedEdges }
}

// ── 3. RENDER LAYER — custom nodes ──────────────────────────────────────────

// Barra de ocupação
function OccBar({ ocupacao = 0, capacidade = 0 }) {
  if (!capacidade) return null
  const pct   = Math.min(1, ocupacao / capacidade)
  const color = pct >= 0.9 ? '#ef4444' : pct >= 0.7 ? '#eab308' : '#22c55e'
  const segs  = Math.round(pct * 10)
  return (
    <div style={{ marginTop: 5 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 1,
            backgroundColor: i < segs ? color : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{ocupacao}/{capacidade}</span>
        <span style={{ fontSize: 8, color, fontWeight: 700 }}>{Math.round(pct * 100)}%</span>
      </div>
    </div>
  )
}

// ── OLT Node ──────────────────────────────────────────────────────────────────
const OLTNode = memo(({ data }) => {
  const statusColor = data.status === 'ativo' ? '#22c55e' : '#ef4444'
  return (
    <div style={{
      background:   '#050f1f',
      border:       '2px solid #0891b2',
      borderRadius: 10,
      width:        OLT_WIDTH,
      fontFamily:   'inherit',
      overflow:     'hidden',
      boxShadow:    '0 0 0 1px rgba(8,145,178,0.15), 0 4px 20px rgba(8,145,178,0.15)',
    }}>
      {/* Header */}
      <div style={{
        background:   'rgba(8,145,178,0.15)',
        borderBottom: '1px solid rgba(8,145,178,0.2)',
        padding:      '7px 11px',
        display:      'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🖥️</span>
        <div>
          <div style={{ fontSize: 8, color: '#0891b2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>OLT</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e0f2fe', lineHeight: 1.2 }}>{data.nome}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '7px 11px 10px' }}>
        {data.modelo && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>{data.modelo}</div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {data.ip && (
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#67e8f9',
              background: 'rgba(8,145,178,0.12)', padding: '1px 6px', borderRadius: 4 }}>
              {data.ip}
            </span>
          )}
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
            GPON · {data.capacidade} portas
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block' }} />
          <span style={{ fontSize: 9, color: statusColor, fontWeight: 700 }}>{data.status ?? 'ativo'}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="out"
        style={{ background: '#0891b2', border: 'none', width: 9, height: 9 }} />
    </div>
  )
})
OLTNode.displayName = 'OLTNode'

// ── CDO Node (bandejas de fusão) ──────────────────────────────────────────────
const CDONode = memo(({ data }) => {
  const splitterCount = data.splitterCount ?? 0
  const splFibras     = data.splFibras ?? []
  const splitters     = data.splitters ?? []
  const totalH        = cdoHeight(splitterCount)

  function handleTop(si) {
    return CDO_HEADER_H + si * CDO_BANDEJA_H + CDO_BANDEJA_H / 2
  }

  return (
    <div style={{
      background:   '#060e1d',
      border:       '2px solid #0891b2',
      borderRadius: 8,
      width:        CDO_WIDTH,
      height:       totalH,
      fontFamily:   'inherit',
      overflow:     'hidden',
      boxShadow:    '0 0 0 1px rgba(8,145,178,0.12)',
      position:     'relative',
    }}>
      {/* Handle de entrada */}
      <Handle type="target" position={Position.Left} id="in"
        style={{ background: '#0891b2', border: 'none', width: 9, height: 9, top: '50%' }} />

      {/* Header */}
      <div style={{
        background:   'rgba(8,145,178,0.12)',
        borderBottom: '1px solid rgba(8,145,178,0.2)',
        padding:      '6px 12px',
        display:      'flex', alignItems: 'center', justifyContent: 'space-between',
        height:       CDO_HEADER_H,
        boxSizing:    'border-box',
      }}>
        <div>
          <div style={{ fontSize: 8, color: '#0891b2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            {data.tipo ?? 'CDO'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e0f2fe', marginTop: 1, lineHeight: 1.2 }}>
            {data.nome}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          {data.pon != null && (
            <span style={{ fontSize: 9, color: '#67e8f9', background: 'rgba(8,145,178,0.15)',
              padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              PON {data.pon}
            </span>
          )}
          {data.portaOlt != null && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
              Porta {data.portaOlt}
            </span>
          )}
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>
            {splitterCount} splitter{splitterCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Bandejas */}
      {splitters.map((spl, si) => {
        const fibra  = splFibras[si] ?? (si * 2 + 1)
        const color  = fiberColor(fibra)
        const ratio  = parseSplitterRatio(spl.tipo)
        const saidas = spl.saidas ?? []
        const ligadas = saidas.filter(s => s?.cto_id).length
        const tubeIdx = Math.floor((fibra - 1) / 12) + 1
        const fiberIdx = ((fibra - 1) % 12) + 1
        const abntNome = ABNT[fiberIdx - 1]?.nome ?? `F${fiberIdx}`

        return (
          <div key={si} style={{
            height:       CDO_BANDEJA_H,
            borderBottom: si < splitterCount - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            padding:      '6px 10px 6px 12px',
            display:      'flex',
            alignItems:   'center',
            gap:          7,
            background:   si % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
            position:     'relative',
          }}>
            {/* Bandeja label */}
            <span style={{
              fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.25)',
              fontFamily: 'monospace', minWidth: 20, letterSpacing: '0.04em',
            }}>
              B{(spl?._origIdx !== undefined ? spl._origIdx : si) + 1}
            </span>

            {/* Linha de fibra */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
              {/* Ponto de fibra ABNT */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: color,
                boxShadow: `0 0 5px ${color}88`,
                flexShrink: 0,
              }} />
              {/* Tube:Fiber */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', lineHeight: 1 }}>
                  T{tubeIdx}·F{fiberIdx}
                </span>
                <span style={{ fontSize: 7, color: color, lineHeight: 1, fontWeight: 600 }}>
                  {abntNome}
                </span>
              </div>
            </div>

            {/* Splitter embutido */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{
                fontSize: 8, fontWeight: 800, color: '#f97316',
                background: 'rgba(249,115,22,0.12)',
                border: '1px solid rgba(249,115,22,0.3)',
                padding: '1px 5px', borderRadius: 4,
              }}>
                {spl.tipo ?? `1×${ratio}`}
              </span>
              <span style={{ fontSize: 7, color: ligadas > 0 ? '#86efac' : 'rgba(255,255,255,0.2)' }}>
                {ligadas}/{ratio} CTOs
              </span>
            </div>
          </div>
        )
      })}

      {/* Sem splitters */}
      {splitterCount === 0 && (
        <div style={{ padding: '14px 12px', textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>Sem splitters cadastrados</span>
        </div>
      )}

      {/* Handles de saída — um por bandeja */}
      {Array.from({ length: splitterCount }, (_, si) => (
        <Handle
          key={si}
          type="source"
          position={Position.Right}
          id={`out-${si}`}
          style={{
            background:  fiberColor(splFibras[si] ?? (si * 2 + 1)),
            border:      'none',
            width:       9,
            height:      9,
            top:         handleTop(si),
            right:       -5,
            transform:   'none',
          }}
        />
      ))}

      {splitterCount === 0 && (
        <Handle type="source" position={Position.Right} id="out-0"
          style={{ background: '#0891b2', border: 'none', width: 9, height: 9, top: '50%' }} />
      )}
    </div>
  )
})
CDONode.displayName = 'CDONode'

// ── CE Node (cascata) ─────────────────────────────────────────────────────────
const CENode = memo(({ data }) => (
  <div style={{
    background:    '#0a0520',
    border:        '2px dashed #7c3aed',
    borderRadius:  10,
    width:         CE_WIDTH,
    fontFamily:    'inherit',
    overflow:      'hidden',
    boxShadow:     '0 0 0 1px rgba(124,58,237,0.1)',
  }}>
    <Handle type="target" position={Position.Left} id="in"
      style={{ background: '#7c3aed', border: 'none', width: 9, height: 9 }} />

    <div style={{
      background:   'rgba(124,58,237,0.12)',
      borderBottom: '1px solid rgba(124,58,237,0.2)',
      padding:      '7px 11px',
    }}>
      <div style={{ fontSize: 8, color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        CI/CDO · CASCATA
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#e9d5ff', marginTop: 2 }}>
        {data.nome}
      </div>
    </div>

    <div style={{ padding: '7px 11px 10px' }}>
      {data.pon != null && (
        <span style={{ fontSize: 10, color: '#c4b5fd', background: 'rgba(124,58,237,0.12)',
          padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>
          PON {data.pon}
        </span>
      )}
      {data.portaOlt != null && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
          Porta OLT: {data.portaOlt}
        </div>
      )}
    </div>

    <Handle type="source" position={Position.Right} id="out-0"
      style={{ background: '#7c3aed', border: 'none', width: 9, height: 9 }} />
  </div>
))
CENode.displayName = 'CENode'

// ── Splitter Node ──────────────────────────────────────────────────────────────
const SplitterNode = memo(({ data }) => {
  const ratio  = parseSplitterRatio(data.tipo)
  const totalH = splHeight(ratio)

  return (
    <div style={{
      background:   '#0c0e1c',
      border:       '2px solid #f97316',
      borderRadius: 8,
      width:        SPL_WIDTH,
      height:       totalH,
      fontFamily:   'inherit',
      overflow:     'hidden',
      position:     'relative',
      boxShadow:    '0 0 0 1px rgba(249,115,22,0.12)',
    }}>
      {/* Handle de entrada */}
      <Handle type="target" position={Position.Left} id="in"
        style={{ background: data.colorIn ?? '#f97316', border: 'none', width: 9, height: 9, top: SPL_HEADER_H / 2 }} />

      {/* Header */}
      <div style={{
        background:   'rgba(249,115,22,0.12)',
        borderBottom: '1px solid rgba(249,115,22,0.2)',
        padding:      '6px 10px',
        display:      'flex', alignItems: 'center', justifyContent: 'space-between',
        height:       SPL_HEADER_H,
        boxSizing:    'border-box',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fed7aa' }}>{data.nome}</div>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#f97316',
          background: 'rgba(249,115,22,0.15)', padding: '2px 8px', borderRadius: 10 }}>
          {data.tipo ?? `1×${ratio}`}
        </span>
      </div>

      {/* Portas de saída */}
      {Array.from({ length: ratio }, (_, i) => {
        const saida     = data.saidas?.[i]
        const portNum   = saida?.num ?? (i + 1)
        const portColor = fiberColor(portNum)
        const yCenter   = SPL_HEADER_H + i * SPL_PORT_H + SPL_PORT_H / 2

        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center',
            height: SPL_PORT_H, padding: '0 10px',
            borderBottom: i < ratio - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            {/* Ponto colorido */}
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: portColor,
              boxShadow: `0 0 4px ${portColor}88`, marginRight: 6, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', fontWeight: 600 }}>
              S{portNum}
            </span>

            {/* Handle de saída posicionado nesta linha */}
            <Handle
              type="source"
              position={Position.Right}
              id={`s-out-${i}`}
              style={{
                position:  'absolute',
                right:     -5,
                top:       yCenter,
                background: portColor,
                border:    'none',
                width:     8,
                height:    8,
                transform: 'none',
              }}
            />
          </div>
        )
      })}
    </div>
  )
})
SplitterNode.displayName = 'SplitterNode'

// ── CTO Node ──────────────────────────────────────────────────────────────────
const CTONode = memo(({ data }) => (
  <div style={{
    background:   '#041209',
    border:       '1.5px solid #16a34a',
    borderRadius: 8,
    width:        CTO_WIDTH,
    fontFamily:   'inherit',
    overflow:     'hidden',
    boxShadow:    '0 0 0 1px rgba(22,163,74,0.1)',
  }}>
    <Handle type="target" position={Position.Left} id="in"
      style={{ background: '#16a34a', border: 'none', width: 8, height: 8 }} />

    <div style={{
      background:   'rgba(22,163,74,0.12)',
      borderBottom: '1px solid rgba(22,163,74,0.2)',
      padding:      '5px 10px',
      display:      'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 8, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>CTO</span>
      {data.capacidade != null && (
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{data.capacidade}p</span>
      )}
    </div>

    <div style={{ padding: '6px 10px 8px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#86efac', lineHeight: 1.2 }}>
        {data.nome}
      </div>
      {data.ctoId && data.ctoId !== data.nome && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginTop: 2 }}>
          {data.ctoId}
        </div>
      )}
      {data.capacidade != null && (
        <OccBar ocupacao={data.ocupacao ?? 0} capacidade={data.capacidade} />
      )}
    </div>
  </div>
))
CTONode.displayName = 'CTONode'

// ── Passagem Node (caixa de passagem / ponto genérico) ────────────────────────
const PassagemNode = memo(({ data }) => (
  <div style={{
    background:   '#0a0f1e',
    border:       '1.5px dashed #64748b',
    borderRadius: 8,
    width:        CTO_WIDTH,
    fontFamily:   'inherit',
    overflow:     'hidden',
    boxShadow:    '0 0 0 1px rgba(100,116,139,0.1)',
  }}>
    <Handle type="target" position={Position.Left} id="in"
      style={{ background: '#64748b', border: 'none', width: 8, height: 8 }} />
    <div style={{
      background:   'rgba(100,116,139,0.1)',
      borderBottom: '1px solid rgba(100,116,139,0.2)',
      padding:      '5px 10px',
      display:      'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {data.destTipo ?? 'PASSAGEM'}
      </span>
    </div>
    <div style={{ padding: '6px 10px 8px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', lineHeight: 1.2 }}>
        {data.nome}
      </div>
    </div>
  </div>
))
PassagemNode.displayName = 'PassagemNode'

// ── Mapa de tipos de node ─────────────────────────────────────────────────────
const NODE_TYPES = {
  oltNode:      OLTNode,
  cdoNode:      CDONode,
  ceNode:       CENode,
  splitterNode: SplitterNode,
  ctoNode:      CTONode,
  passagemNode: PassagemNode,
}

function minimapColor(node) {
  switch (node.type) {
    case 'oltNode':      return '#0891b2'
    case 'cdoNode':      return '#1d4ed8'
    case 'ceNode':       return '#7c3aed'
    case 'splitterNode': return '#f97316'
    case 'ctoNode':      return '#16a34a'
    case 'passagemNode': return '#64748b'
    default:             return '#475569'
  }
}

// ── Painel de controle ───────────────────────────────────────────────────────
function ControlPanel({ onAutoLayout, nodeCount, edgeCount, zoom }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow()

  return (
    <Panel position="top-left" style={{ margin: 0 }}>
      <div style={{
        display:      'flex', alignItems: 'center', gap: 8,
        background:   'rgba(6,10,22,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding:      '8px 14px',
        fontFamily:   'inherit',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
          <span style={{ fontSize: 16 }}>🌐</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#0891b2', letterSpacing: '0.05em' }}>
            FiberOps
          </span>
        </div>

        {/* Botão Auto Layout */}
        <button
          onClick={onAutoLayout}
          style={{
            display:      'flex', alignItems: 'center', gap: 5,
            background:   'rgba(8,145,178,0.15)',
            border:       '1px solid rgba(8,145,178,0.4)',
            borderRadius: 6, padding: '4px 10px',
            color: '#67e8f9', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          ⚡ Auto Layout
        </button>

        {/* Botão Ajustar */}
        <button
          onClick={() => fitView({ padding: 0.15, duration: 500 })}
          style={{
            display:      'flex', alignItems: 'center', gap: 5,
            background:   'rgba(255,255,255,0.05)',
            border:       '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6, padding: '4px 10px',
            color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ☐ Ajustar
        </button>

        {/* Zoom +/- */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { label: '+', fn: zoomIn },
            { label: '−', fn: zoomOut },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn} style={{
              width: 28, height: 28,
              background:   'rgba(255,255,255,0.05)',
              border:       '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
              color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  )
}

// ── Barra de status (rodapé) ─────────────────────────────────────────────────
function StatusBar({ nodeCount, edgeCount }) {
  return (
    <Panel position="bottom-center" style={{ margin: 0 }}>
      <div style={{
        background:   'rgba(6,10,22,0.85)',
        border:       '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px 8px 0 0',
        padding:      '4px 16px',
        fontSize:     10,
        color:        'rgba(255,255,255,0.3)',
        display:      'flex', gap: 16,
        fontFamily:   'inherit',
      }}>
        <span>Arrastar = mover nó</span>
        <span>·</span>
        <span>Scroll = zoom</span>
        <span>·</span>
        <span>Nós: <strong style={{ color: 'rgba(255,255,255,0.55)' }}>{nodeCount}</strong></span>
        <span>·</span>
        <span>Arestas: <strong style={{ color: 'rgba(255,255,255,0.55)' }}>{edgeCount}</strong></span>
      </div>
    </Panel>
  )
}

// ── Componente interno (precisa de ReactFlowProvider) ────────────────────────
function FlowInner({ projetoId, userRole, altura }) {
  const readOnly = userRole === 'tecnico'
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [loading, setLoading]            = useState(true)
  const [error,   setError]              = useState(null)
  const { fitView }                      = useReactFlow()

  const buildAndLayout = useCallback((topologia) => {
    const { nodes: raw, edges: rawEdges } = buildGraphData(topologia)
    const { nodes: laid, edges: laidEdges } = applyDagreLayout(raw, rawEdges)
    setNodes(laid)
    setEdges(laidEdges)
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
  }, [setNodes, setEdges, fitView])

  const load = useCallback(async () => {
    if (!projetoId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await getTopologia(projetoId)
      buildAndLayout(data ?? [])
    } catch (e) {
      setError(e?.message ?? 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [projetoId, buildAndLayout])

  useEffect(() => { load() }, [load])

  const handleAutoLayout = useCallback(async () => {
    if (!projetoId) return
    try {
      const data = await getTopologia(projetoId)
      buildAndLayout(data ?? [])
    } catch {}
  }, [projetoId, buildAndLayout])

  if (loading) return (
    <div style={{ height: altura, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#060a16', borderRadius: 12 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(8,145,178,0.3)',
          borderTop: '3px solid #0891b2', borderRadius: '50%',
          margin: '0 auto 10px', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color: '#475569', fontSize: 13 }}>Carregando topologia...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ height: altura, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#060a16', borderRadius: 12 }}>
      <div style={{ textAlign: 'center', padding: '20px 28px',
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 10 }}>
        <div style={{ color: '#f87171', fontWeight: 700, marginBottom: 6 }}>Erro ao carregar</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 12 }}>{error}</div>
        <button onClick={load} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#f87171', cursor: 'pointer' }}>
          Tentar novamente
        </button>
      </div>
    </div>
  )

  if (nodes.length === 0) return (
    <div style={{ height: altura, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#060a16', borderRadius: 12 }}>
      <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 12 }}>🌐</div>
      <div style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 600, fontSize: 14 }}>
        Nenhuma topologia configurada
      </div>
      <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: 12, marginTop: 6 }}>
        Vincule OLTs, CDOs e CTOs para visualizar
      </div>
    </div>
  )

  return (
    <div style={{ height: altura, background: '#060a16', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.08}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#060a16' }}
        defaultEdgeOptions={{ type: 'bezier' }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
      >
        <Background color="#0d1f35" gap={28} size={1} />

        <Controls
          showInteractive={false}
          style={{
            background:   'rgba(6,10,22,0.9)',
            border:       '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
          }}
        />

        <MiniMap
          nodeColor={minimapColor}
          maskColor="rgba(6,10,22,0.8)"
          style={{
            background:   'rgba(6,10,22,0.9)',
            border:       '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
          }}
        />

        {!readOnly && (
          <ControlPanel
            onAutoLayout={handleAutoLayout}
            nodeCount={nodes.length}
            edgeCount={edges.length}
          />
        )}

        <StatusBar nodeCount={nodes.length} edgeCount={edges.length} />
      </ReactFlow>
    </div>
  )
}

// ── Export principal (com ReactFlowProvider) ─────────────────────────────────
export default function DiagramaTopologiaFlow({ projetoId, userRole, altura = 600 }) {
  return (
    <ReactFlowProvider>
      <FlowInner projetoId={projetoId} userRole={userRole} altura={altura} />
    </ReactFlowProvider>
  )
}
