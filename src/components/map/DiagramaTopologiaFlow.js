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
  BackgroundVariant,
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
  addEdge,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { getTopologia } from '@/actions/olts'

// ── Cores ABNT NBR 14721 (12 fibras por tubo) ──────────────────────────────
const ABNT = [
  { idx: 1,  nome: 'Verde',    hex: '#22c55e' },
  { idx: 2,  nome: 'Amarelo',  hex: '#eab308' },
  { idx: 3,  nome: 'Branco',   hex: '#e2e8f0' },
  { idx: 4,  nome: 'Azul',     hex: '#3b82f6' },
  { idx: 5,  nome: 'Vermelho', hex: '#ef4444' },
  { idx: 6,  nome: 'Violeta',  hex: '#a855f7' },
  { idx: 7,  nome: 'Marrom',   hex: '#a16207' },
  { idx: 8,  nome: 'Rosa',     hex: '#ec4899' },
  { idx: 9,  nome: 'Preto',    hex: '#475569' },
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
const CDO_HEADER_H     = 44
const CDO_BANDEJA_BASE = 38   // altura base por bandeja (sem fusões)
const CDO_FUSAO_H      = 13   // altura por linha de fusão
const CDO_WIDTH        = 280
const SPL_HEADER_H  = 44
const SPL_PORT_H    = 28
const SPL_WIDTH     = 155
const OLT_WIDTH     = 175
const OLT_HEIGHT    = 100
const CTO_WIDTH     = 148
const CTO_HEIGHT    = 62
const CE_WIDTH      = 178
const CE_HEIGHT     = 88

function cdoBandejaH(fusoes) {
  return CDO_BANDEJA_BASE + (fusoes?.length ?? 0) * CDO_FUSAO_H
}
function cdoHeight(splitterCount, bandejas = []) {
  if (splitterCount === 0) return CDO_HEADER_H + 44
  let h = CDO_HEADER_H
  for (let i = 0; i < splitterCount; i++) h += cdoBandejaH(bandejas[i]?.fusoes)
  return h + 12
}
function splHeight(ratio) {
  return SPL_HEADER_H + ratio * SPL_PORT_H + 12
}

// ── 1. DATA LAYER ───────────────────────────────────────────────────────────

function buildGraphData(topologia) {
  const nodes = []
  const edges = []
  // seenNodes evita qualquer nó duplicado (CDO top-level + cascade destino)
  const seenNodes = new Set()

  // Mapa plano de todas as caixas para herança CDO→CDO
  const caixaById = {}
  // Mapa de CTOs para CTO-em-cascata
  const ctoById = {}
  for (const olt of topologia) {
    for (const c of (olt.caixas ?? [])) {
      const id = c.id ?? c._id
      if (id) caixaById[String(id)] = c
    }
    for (const caixa of (olt.caixas ?? [])) {
      for (const cto of (caixa.ctos ?? [])) {
        if (cto.cto_id) ctoById[cto.cto_id] = cto
      }
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  function addCDONode(id, caixa, destTipo) {
    if (seenNodes.has(id)) return
    seenNodes.add(id)
    const spls      = caixa?.diagrama?.splitters ?? []
    const bandejas  = caixa?.diagrama?.bandejas  ?? []
    const entrada   = caixa?.diagrama?.entrada   ?? {}
    const splFibras = spls.map((s, i) => s.entrada?.fibra ?? (i * 2 + 1))
    const isCE      = (caixa?.tipo ?? destTipo ?? 'CDO').toUpperCase() === 'CE'
    nodes.push({
      id,
      type: isCE ? 'ceNode' : 'cdoNode',
      position: { x: 0, y: 0 },
      data: {
        nome:          caixa?.nome ?? id,
        tipo:          caixa?.tipo ?? (destTipo ?? 'CDO').toUpperCase(),
        portaOlt:      entrada.porta_olt ?? caixa?.porta_olt ?? null,
        pon:           entrada.pon ?? null,
        portCount:     Math.max(12, Math.ceil(spls.length / 2) * 12),
        splitterCount: spls.length,
        splFibras,
        splitters:     spls,
        bandejas,
        ctoCount:      (caixa?.ctos ?? []).length,
      },
    })
  }

  function addCTONode(id, cto) {
    if (seenNodes.has(id)) return
    seenNodes.add(id)
    nodes.push({
      id,
      type: 'ctoNode',
      position: { x: 0, y: 0 },
      data: {
        nome:       cto?.nome ?? id,
        ctoId:      cto?.cto_id ?? id,
        capacidade: cto?.capacidade ?? null,
        ocupacao:   cto?.ocupacao   ?? 0,
      },
    })
  }

  function addSplitterOutputEdges(splNid, splSaidas, allCaixas, allCTOs) {
    for (let saIdx = 0; saIdx < splSaidas.length; saIdx++) {
      const saida    = splSaidas[saIdx]
      const destId   = saida?.cto_id ?? saida?.id
      if (!destId) continue

      const destTipo  = saida?.tipo ?? (saida?.cto_id ? 'cto' : 'passagem')
      const destNid   = `${destTipo}-${destId}`
      const portNum   = saida.num ?? saida.porta ?? (saIdx + 1)
      const portColor = fiberColor(portNum)

      if (!seenNodes.has(destNid)) {
        if (destTipo === 'cto') {
          const ctoData = allCTOs[destId] ?? null
          addCTONode(destNid, ctoData)
        } else if (destTipo === 'cdo' || destTipo === 'ce') {
          const destCaixa = allCaixas[String(destId)]
          addCDONode(destNid, destCaixa, destTipo)
        } else {
          seenNodes.add(destNid)
          nodes.push({
            id: destNid, type: 'passagemNode', position: { x: 0, y: 0 },
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

  // ── loop principal ─────────────────────────────────────────────────────────

  for (const olt of topologia) {
    const oltNid = `olt-${olt.id ?? olt._id}`
    if (!seenNodes.has(oltNid)) {
      seenNodes.add(oltNid)
      nodes.push({
        id: oltNid, type: 'oltNode', position: { x: 0, y: 0 },
        data: {
          nome: olt.nome, ip: olt.ip, modelo: olt.modelo,
          capacidade: olt.capacidade ?? 16, status: olt.status ?? 'ativo',
        },
      })
    }

    for (const caixa of (olt.caixas ?? [])) {
      const caixaNid = `cdo-${caixa.id ?? caixa._id}`
      // Adiciona CDO top-level (usa helper que respeita seenNodes)
      addCDONode(caixaNid, caixa, caixa.tipo ?? 'CDO')

      // Edge OLT → CDO
      edges.push({
        id: `e-${oltNid}-${caixaNid}`, source: oltNid, target: caixaNid,
        type: 'bezier', label: 'Backbone',
        style: { stroke: '#0891b2', strokeWidth: 2.5 },
        labelStyle: { fill: '#67e8f9', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: 'rgba(4,12,28,0.9)', rx: 4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2', width: 12, height: 12 },
      })

      const splitters = caixa.diagrama?.splitters ?? []

      for (let si = 0; si < splitters.length; si++) {
        const spl    = splitters[si]
        const splNid = `spl-${caixaNid}-${si}`
        const ratio  = parseSplitterRatio(spl.tipo)
        const fibra  = spl.entrada?.fibra ?? (si * 2 + 1)
        const tubeLabel = spl.nome ?? `T${Math.ceil(fibra / 12)}:F${((fibra - 1) % 12) + 1}`
        const edgeColor = fiberColor(fibra)

        if (!seenNodes.has(splNid)) {
          seenNodes.add(splNid)
          nodes.push({
            id: splNid, type: 'splitterNode', position: { x: 0, y: 0 },
            data: { nome: `Splitter ${si + 1}`, tipo: spl.tipo ?? '1x8', ratio, tubeLabel, colorIn: edgeColor, saidas: spl.saidas ?? [] },
          })
        }

        edges.push({
          id: `e-${caixaNid}-${splNid}`, source: caixaNid, target: splNid,
          sourceHandle: `out-${si}`, type: 'bezier', label: tubeLabel,
          style: { stroke: edgeColor, strokeWidth: 2 },
          labelStyle: { fill: edgeColor, fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 10, height: 10 },
        })

        addSplitterOutputEdges(splNid, spl.saidas ?? [], caixaById, ctoById)
      }

      // CTOs sem splitter → direto CDO→CTO
      if (splitters.length === 0) {
        for (const cto of (caixa.ctos ?? [])) {
          const ctoNid    = `cto-${cto.cto_id}`
          const portColor = fiberColor(cto.porta_cdo ?? 1)
          addCTONode(ctoNid, cto)
          edges.push({
            id: `e-${caixaNid}-${ctoNid}`, source: caixaNid, target: ctoNid,
            type: 'bezier', label: cto.porta_cdo != null ? `P${cto.porta_cdo}` : undefined,
            style: { stroke: portColor, strokeWidth: 1.5 },
            labelStyle: { fill: portColor, fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
            markerEnd: { type: MarkerType.ArrowClosed, color: portColor, width: 9, height: 9 },
          })
        }
      }

      // ── CTO em cascata: CTO com diagrama.splitters → outra CTO ────────────
      for (const cto of (caixa.ctos ?? [])) {
        const ctoSpls = cto.diagrama?.splitters ?? []
        if (ctoSpls.length === 0) continue
        const ctoNid = `cto-${cto.cto_id}`
        addCTONode(ctoNid, cto)

        for (let ci = 0; ci < ctoSpls.length; ci++) {
          const cspl    = ctoSpls[ci]
          const csplNid = `spl-${ctoNid}-${ci}`
          const ratio   = parseSplitterRatio(cspl.tipo)
          const fibra   = cspl.entrada?.fibra ?? (ci + 1)
          const edgeColor = fiberColor(fibra)

          if (!seenNodes.has(csplNid)) {
            seenNodes.add(csplNid)
            nodes.push({
              id: csplNid, type: 'splitterNode', position: { x: 0, y: 0 },
              data: { nome: cspl.nome ?? `Splitter ${ci + 1}`, tipo: cspl.tipo ?? '1x8', ratio, tubeLabel: cspl.nome ?? `F${fibra}`, colorIn: edgeColor, saidas: cspl.saidas ?? [] },
            })
          }

          edges.push({
            id: `e-${ctoNid}-${csplNid}`, source: ctoNid, target: csplNid,
            type: 'bezier', label: `Cascata F${fibra}`,
            style: { stroke: edgeColor, strokeWidth: 1.5 },
            labelStyle: { fill: edgeColor, fontSize: 9, fontWeight: 700 },
            labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 9, height: 9 },
          })

          addSplitterOutputEdges(csplNid, cspl.saidas ?? [], caixaById, ctoById)
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
    case 'cdoNode':     return { w: CDO_WIDTH, h: cdoHeight(node.data.splitterCount ?? 0, node.data.bandejas ?? []) }
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

  // Splitter → CTO: reposicionar CTOs por ordem de porta (S1 = topo, S2 = abaixo…)
  // Não remapeamos handles — s-out-0 sempre = S1 (porta 1).
  // Em vez disso, redistribuímos as posições Y dos CTOs para que o CTO de S1
  // fique no topo e o de S8 no fundo, eliminando cruzamentos.
  const splOutEdges = {}
  for (const e of edges) {
    if (e.sourceHandle?.startsWith('s-out-')) {
      if (!splOutEdges[e.source]) splOutEdges[e.source] = []
      splOutEdges[e.source].push(e)
    }
  }

  // ctoYOverride[nodeId] = novo centerY para o nó CTO
  const ctoYOverride = {}
  for (const [, grp] of Object.entries(splOutEdges)) {
    // Ordena por número de porta (S1 primeiro → topo)
    const byPort = [...grp].sort((a, b) => {
      const pA = parseInt(String(a.label ?? '').replace('S', ''), 10) || 999
      const pB = parseInt(String(b.label ?? '').replace('S', ''), 10) || 999
      return pA - pB
    })
    // Posições Y disponíveis, ordenadas de cima para baixo
    const sortedYs = [...grp].map(e => centerY[e.target] ?? 0).sort((a, b) => a - b)
    // Atribui: S1 → Y mais alto (topo), S2 → próximo, etc.
    byPort.forEach((e, i) => {
      if (sortedYs[i] !== undefined) ctoYOverride[e.target] = sortedYs[i]
    })
  }

  const remappedEdges = edges.map(e => {
    const mapped = handleMap[`${e.source}|${e.sourceHandle}`]
    return mapped ? { ...e, sourceHandle: mapped } : e
  })

  const positionedNodes = nodes.map(n => {
    const pos = g.node(n.id)
    const { w, h } = getNodeDims(n)
    const cy = ctoYOverride[n.id] ?? pos.y
    const base = {
      ...n,
      position:       { x: pos.x - w / 2, y: cy - h / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }
    // Reordena dados do CDO para coincidir com a nova ordem dos handles
    if (n.type === 'cdoNode' && dataOrder[n.id]) {
      const order    = dataOrder[n.id]
      const origFibras   = n.data.splFibras  ?? []
      const origSpls     = n.data.splitters  ?? []
      const origBandejas = n.data.bandejas   ?? []
      base.data = {
        ...n.data,
        splFibras: order.map(i => origFibras[i] ?? null),
        splitters: order.map(i => ({ ...(origSpls[i] ?? {}), _origIdx: i })),
        bandejas:  order.map(i => origBandejas[i] ?? {}),
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
  const bandejas      = data.bandejas  ?? []
  const totalH        = cdoHeight(splitterCount, bandejas)

  // Computa o offset Y central de cada bandeja para posicionar handles
  function handleTop(si) {
    let y = CDO_HEADER_H
    for (let i = 0; i < si; i++) y += cdoBandejaH(bandejas[i]?.fusoes)
    return y + cdoBandejaH(bandejas[si]?.fusoes) / 2
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
        const fibra    = splFibras[si] ?? (si * 2 + 1)
        const color    = fiberColor(fibra)
        const ratio    = parseSplitterRatio(spl.tipo)
        const saidas   = spl.saidas ?? []
        const ligadas  = saidas.filter(s => s?.cto_id).length
        const tubeIdx  = Math.floor((fibra - 1) / 12) + 1
        const fiberIdx = ((fibra - 1) % 12) + 1
        const abntNome = ABNT[fiberIdx - 1]?.nome ?? `F${fiberIdx}`
        const bandeja  = bandejas[si] ?? {}
        const fusoes   = bandeja.fusoes ?? []
        const rowH     = cdoBandejaH(fusoes)

        return (
          <div key={si} style={{
            height:       rowH,
            borderBottom: si < splitterCount - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            background:   si % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
            position:     'relative',
          }}>
            {/* Linha de cabeçalho da bandeja */}
            <div style={{
              height:    CDO_BANDEJA_BASE,
              padding:   '0 10px 0 12px',
              display:   'flex',
              alignItems:'center',
              gap:       7,
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
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: color,
                  boxShadow: `0 0 5px ${color}88`,
                  flexShrink: 0,
                }} />
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

            {/* Fusões */}
            {fusoes.map((f, fi) => {
              const entColor = fiberColor(f.entrada?.fibra)
              const saiColor = fiberColor(f.saida?.fibra)
              return (
                <div key={fi} style={{
                  height:     CDO_FUSAO_H,
                  display:    'flex',
                  alignItems: 'center',
                  paddingLeft: 32,
                  paddingRight: 10,
                  gap:        5,
                  borderTop:  '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', minWidth: 12 }}>{fi + 1}</span>
                  {/* Fibra entrada */}
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: entColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 7, color: entColor, fontFamily: 'monospace', fontWeight: 700 }}>
                    F{f.entrada?.fibra ?? '?'}
                  </span>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>→</span>
                  {/* Fibra saída */}
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: saiColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 7, color: saiColor, fontFamily: 'monospace', fontWeight: 700 }}>
                    F{f.saida?.fibra ?? '?'}
                  </span>
                  {f.obs && (
                    <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }}>
                      {f.obs}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Sem splitters */}
      {splitterCount === 0 && (
        <div style={{ padding: '14px 12px', textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>Sem splitters cadastrados</span>
        </div>
      )}

      {/* Handles de saída — um por bandeja, posicionado no centro da bandeja */}
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
        const portNum   = saida?.num ?? saida?.porta ?? (i + 1)
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

// ── Toolbar estilo CAD ────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'select',       icon: '↖',  label: 'Selecionar' },
  { id: 'addSplitter',  icon: '⚡',  label: 'Add Splitter' },
  { id: 'addCTO',       icon: '📦',  label: 'Add CTO' },
  { id: 'addCDO',       icon: '🔷',  label: 'Add CDO' },
  { id: 'delete',       icon: '🗑',  label: 'Deletar seleção' },
]

function ControlPanel({ onAutoLayout, activeTool, onToolChange, onAlign, onDeleteSelected, onMoveSelected, onSaveLayout }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow()

  const btnStyle = (active) => ({
    display:      'flex', alignItems: 'center', justifyContent: 'center',
    width:        30, height: 30,
    background:   active ? 'rgba(8,145,178,0.35)' : 'rgba(255,255,255,0.05)',
    border:       active ? '1px solid rgba(8,145,178,0.7)' : '1px solid rgba(255,255,255,0.10)',
    borderRadius: 6,
    color:        active ? '#67e8f9' : 'rgba(255,255,255,0.55)',
    fontSize:     14, cursor: 'pointer', flexShrink: 0,
  })

  const textBtnStyle = (color, bg, border) => ({
    display:      'flex', alignItems: 'center', gap: 4,
    background:   bg ?? 'rgba(255,255,255,0.05)',
    border:       `1px solid ${border ?? 'rgba(255,255,255,0.10)'}`,
    borderRadius: 6, padding: '4px 10px',
    color: color ?? 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  })

  const sep = <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

  return (
    <Panel position="top-left" style={{ margin: 0 }}>
      <div style={{
        display:      'flex', alignItems: 'center', gap: 4,
        background:   'rgba(6,10,22,0.96)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding:      '6px 10px',
        fontFamily:   'inherit',
        flexWrap:     'wrap',
      }}>
        {/* Brand */}
        <span style={{ fontSize: 12, fontWeight: 800, color: '#0891b2', marginRight: 4 }}>🌐 FiberOps</span>
        {sep}

        {/* Tool modes */}
        {TOOLS.map(t => (
          <button key={t.id}
            title={t.label}
            onClick={() => t.id === 'delete' ? onDeleteSelected() : onToolChange(t.id)}
            style={btnStyle(activeTool === t.id && t.id !== 'delete')}
          >
            {t.icon}
          </button>
        ))}
        {sep}

        {/* Mover seleção (setas) */}
        {[
          { dx:  0, dy: -25, icon: '↑', title: 'Mover cima' },
          { dx:  0, dy:  25, icon: '↓', title: 'Mover baixo' },
          { dx: -25, dy: 0,  icon: '←', title: 'Mover esquerda' },
          { dx:  25, dy: 0,  icon: '→', title: 'Mover direita' },
        ].map(a => (
          <button key={a.icon} title={a.title} onClick={() => onMoveSelected(a.dx, a.dy)} style={btnStyle(false)}>
            {a.icon}
          </button>
        ))}
        {sep}

        {/* Alinhar */}
        {[
          { id: 'left',        icon: '⊢', title: 'Alinhar esquerda' },
          { id: 'centerH',     icon: '⊣', title: 'Centralizar H' },
          { id: 'right',       icon: '⊣', title: 'Alinhar direita' },
          { id: 'top',         icon: '⊤', title: 'Alinhar topo' },
          { id: 'bottom',      icon: '⊥', title: 'Alinhar baixo' },
          { id: 'distributeH', icon: '⇔', title: 'Distribuir H' },
          { id: 'distributeV', icon: '⇕', title: 'Distribuir V' },
        ].map(a => (
          <button key={a.id} title={a.title} onClick={() => onAlign(a.id)} style={btnStyle(false)}>
            {a.icon}
          </button>
        ))}
        {sep}

        {/* Ações principais */}
        <button onClick={onAutoLayout} title="Reorganizar com Dagre" style={textBtnStyle('#67e8f9', 'rgba(8,145,178,0.15)', 'rgba(8,145,178,0.4)')}>
          ⚡ Organizar
        </button>
        <button onClick={onSaveLayout} title="Salvar posições do diagrama" style={textBtnStyle('#86efac', 'rgba(22,163,74,0.12)', 'rgba(22,163,74,0.35)')}>
          💾 Salvar
        </button>
        <button onClick={() => fitView({ padding: 0.15, duration: 500 })} style={textBtnStyle()} title="Ajustar tela">
          ☐ Ajustar
        </button>
        {[{ label: '+', fn: zoomIn }, { label: '−', fn: zoomOut }].map(({ label, fn }) => (
          <button key={label} onClick={fn} style={{ ...btnStyle(false), width: 24, height: 24, fontSize: 15, fontWeight: 700 }}>
            {label}
          </button>
        ))}
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
  const { fitView, screenToFlowPosition } = useReactFlow()
  const [activeTool, setActiveTool]      = useState('select')
  const SNAP = 25

  const buildAndLayout = useCallback((topologia, useSaved = true) => {
    const { nodes: raw, edges: rawEdges } = buildGraphData(topologia)
    const { nodes: laid, edges: laidEdges } = applyDagreLayout(raw, rawEdges)
    if (useSaved && projetoId) {
      try {
        const savedPos   = JSON.parse(localStorage.getItem(`ftth-topo-pos-${projetoId}`)   || '{}')
        const savedEdges = JSON.parse(localStorage.getItem(`ftth-topo-edges-${projetoId}`) || 'null')
        const nodesOut = Object.keys(savedPos).length > 0
          ? laid.map(n => savedPos[n.id] ? { ...n, position: savedPos[n.id] } : n)
          : laid
        const laidIds = new Set(laidEdges.map(e => e.id))
        const manualEdges = savedEdges ? savedEdges.filter(e => !laidIds.has(e.id)) : []
        setNodes(nodesOut)
        setEdges([...laidEdges, ...manualEdges])
      } catch {
        setNodes(laid); setEdges(laidEdges)
      }
    } else {
      setNodes(laid)
      setEdges(laidEdges)
    }
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
  }, [setNodes, setEdges, fitView, projetoId])

  const load = useCallback(async () => {
    if (!projetoId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await getTopologia(projetoId)
      buildAndLayout(data ?? [], false)
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
      buildAndLayout(data ?? [], false) // ignorar posições salvas ao reorganizar
    } catch {}
  }, [projetoId, buildAndLayout])

  const onConnect = useCallback((params) => {
    // Derivar cor da fibra a partir do handle de origem
    let color = '#64748b'
    const sh = params.sourceHandle
    if (sh?.startsWith('s-out-')) {
      // Splitter porta N (0-indexed) → fibra N+1
      const idx = parseInt(sh.replace('s-out-', ''), 10)
      color = fiberColor(idx + 1)
    } else if (sh?.startsWith('out-')) {
      // CDO bandeja N → usar fibra registrada no nó
      const idx = parseInt(sh.replace('out-', ''), 10)
      const srcNode = nodes.find(n => n.id === params.source)
      const fibra = srcNode?.data?.splFibras?.[idx]
      color = fibra ? fiberColor(fibra) : fiberColor(idx + 1)
    } else if (sh === 'out') {
      color = '#0891b2' // OLT backbone
    }
    setEdges(eds => addEdge({
      ...params, type: 'bezier',
      style: { stroke: color, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 9, height: 9 },
    }, eds))
  }, [setEdges, nodes])

  const handlePaneClick = useCallback((event) => {
    if (readOnly || activeTool === 'select') return
    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const snapped = { x: Math.round(pos.x / SNAP) * SNAP, y: Math.round(pos.y / SNAP) * SNAP }
    const newId = `manual-${Date.now()}`
    let newNode = null
    if (activeTool === 'addSplitter') {
      newNode = { id: newId, type: 'splitterNode', position: snapped,
        data: { nome: 'Splitter', tipo: '1x8', ratio: 8, tubeLabel: 'T1:F1', colorIn: '#3b82f6', saidas: [] } }
    } else if (activeTool === 'addCTO') {
      newNode = { id: newId, type: 'ctoNode', position: snapped,
        data: { nome: 'Nova CTO', ctoId: newId, capacidade: 16, ocupacao: 0 } }
    } else if (activeTool === 'addCDO') {
      newNode = { id: newId, type: 'cdoNode', position: snapped,
        data: { nome: 'Nova CDO', tipo: 'CDO', splitterCount: 0, splFibras: [], splitters: [] } }
    }
    if (newNode) setNodes(prev => [...prev, newNode])
  }, [readOnly, activeTool, screenToFlowPosition, setNodes])

  const handleDeleteSelected = useCallback(() => {
    const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id))
    if (selectedIds.size === 0) return
    setNodes(prev => prev.filter(n => !n.selected))
    setEdges(prev => prev.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)))
  }, [nodes, setNodes, setEdges])

  // Mover nodes selecionados por step fixo (teclas de seta)
  const handleMoveSelected = useCallback((dx, dy) => {
    setNodes(prev => prev.map(n =>
      n.selected
        ? { ...n, position: { x: Math.round((n.position.x + dx) / SNAP) * SNAP, y: Math.round((n.position.y + dy) / SNAP) * SNAP } }
        : n
    ))
  }, [setNodes])

  // Salvar layout no localStorage
  const handleSaveLayout = useCallback(() => {
    if (!projetoId) return
    const layout = {}
    nodes.forEach(n => { layout[n.id] = n.position })
    const edgeData = edges.map(e => ({ id: e.id, source: e.source, target: e.target,
      sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
      style: e.style, markerEnd: e.markerEnd, label: e.label,
      labelStyle: e.labelStyle, labelBgStyle: e.labelBgStyle, type: e.type }))
    try {
      localStorage.setItem(`ftth-topo-pos-${projetoId}`, JSON.stringify(layout))
      localStorage.setItem(`ftth-topo-edges-${projetoId}`, JSON.stringify(edgeData))
      alert('Diagrama salvo!')
    } catch {}
  }, [projetoId, nodes, edges])


  const handleAlign = useCallback((direction) => {
    const selected = nodes.filter(n => n.selected)
    if (selected.length < 2) return
    setNodes(prev => {
      const sel = prev.filter(n => n.selected)
      const posMap = {}
      if (direction === 'left') {
        const v = Math.min(...sel.map(n => n.position.x))
        sel.forEach(n => { posMap[n.id] = { x: v, y: n.position.y } })
      } else if (direction === 'right') {
        const v = Math.max(...sel.map(n => n.position.x))
        sel.forEach(n => { posMap[n.id] = { x: v, y: n.position.y } })
      } else if (direction === 'top') {
        const v = Math.min(...sel.map(n => n.position.y))
        sel.forEach(n => { posMap[n.id] = { x: n.position.x, y: v } })
      } else if (direction === 'bottom') {
        const v = Math.max(...sel.map(n => n.position.y))
        sel.forEach(n => { posMap[n.id] = { x: n.position.x, y: v } })
      } else if (direction === 'centerH') {
        const xs = sel.map(n => n.position.x)
        const v = (Math.min(...xs) + Math.max(...xs)) / 2
        sel.forEach(n => { posMap[n.id] = { x: v, y: n.position.y } })
      } else if (direction === 'centerV') {
        const ys = sel.map(n => n.position.y)
        const v = (Math.min(...ys) + Math.max(...ys)) / 2
        sel.forEach(n => { posMap[n.id] = { x: n.position.x, y: v } })
      } else if (direction === 'distributeH') {
        const sorted = [...sel].sort((a, b) => a.position.x - b.position.x)
        const minX = sorted[0].position.x
        const maxX = sorted[sorted.length - 1].position.x
        const step = sorted.length > 1 ? (maxX - minX) / (sorted.length - 1) : 0
        sorted.forEach((n, i) => { posMap[n.id] = { x: minX + i * step, y: n.position.y } })
      } else if (direction === 'distributeV') {
        const sorted = [...sel].sort((a, b) => a.position.y - b.position.y)
        const minY = sorted[0].position.y
        const maxY = sorted[sorted.length - 1].position.y
        const step = sorted.length > 1 ? (maxY - minY) / (sorted.length - 1) : 0
        sorted.forEach((n, i) => { posMap[n.id] = { x: n.position.x, y: minY + i * step } })
      }
      return prev.map(n => posMap[n.id] ? { ...n, position: posMap[n.id] } : n)
    })
  }, [nodes, setNodes])

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
    <div style={{ height: altura, background: '#060a16', borderRadius: 12, overflow: 'hidden', position: 'relative',
      cursor: activeTool === 'addSplitter' || activeTool === 'addCTO' || activeTool === 'addCDO' ? 'crosshair' : 'default' }}>
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
        snapToGrid={!readOnly}
        snapGrid={[SNAP, SNAP]}
        onConnect={!readOnly ? onConnect : undefined}
        onPaneClick={!readOnly ? handlePaneClick : undefined}
        panOnDrag={readOnly || activeTool === 'select'}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(255,255,255,0.06)"
          gap={SNAP}
          size={1}
        />

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
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onAlign={handleAlign}
            onDeleteSelected={handleDeleteSelected}
            onMoveSelected={handleMoveSelected}
            onSaveLayout={handleSaveLayout}
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
