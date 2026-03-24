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
  { idx: 12, nome: 'Aqua',     hex: '#0891b2' },
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
const CDO_HEADER_H    = 44
const CDO_SPLITTER_H  = 34   // altura fixa por linha de splitter
const CDO_BDJ_HDR_H   = 20   // altura do header de cada bandeja
const CDO_FUSAO_H     = 16   // altura por linha de fusão
const CDO_WIDTH       = 290
const SPL_HEADER_H    = 44
const SPL_PORT_H      = 28
const SPL_WIDTH       = 155
const OLT_WIDTH       = 200
const OLT_PORT_H      = 18   // height per PON port row in OLT node
const OLT_HEADER_H    = 74   // OLT header area
const CTO_WIDTH       = 148
const CTO_HEIGHT      = 72   // header(~20) + body-min(~52, inclui OccBar)
const CE_WIDTH        = 178
const CE_HEIGHT       = 88

function cdoBandejaH(bandeja) {
  const n = bandeja?.fusoes?.length ?? 0
  return CDO_BDJ_HDR_H + n * CDO_FUSAO_H + 4
}
function cdoHeight(splitterCount, bandejas = []) {
  if (splitterCount === 0 && bandejas.length === 0) return CDO_HEADER_H + 44
  let h = CDO_HEADER_H + splitterCount * CDO_SPLITTER_H
  for (const b of bandejas) h += cdoBandejaH(b)
  return h + 10
}
function oltHeight(caixas = []) {
  return OLT_HEADER_H + Math.max(1, caixas.length) * OLT_PORT_H + 8
}
function splHeight(ratio) {
  return SPL_HEADER_H + ratio * SPL_PORT_H + 12
}
function ctoHeight(bandejas = []) {
  if (!bandejas.length) return CTO_HEIGHT
  let h = CTO_HEIGHT
  for (const b of bandejas) h += CDO_BDJ_HDR_H + (b.fusoes?.length ?? 0) * CDO_FUSAO_H + 4
  return h + 4
}
// Y absoluto (px) do centro de uma fusão dentro do CTONode
function ctoFusaoHandleTop(bandejas, targetBi, targetFi) {
  let y = CTO_HEIGHT
  for (let i = 0; i < targetBi; i++) {
    y += CDO_BDJ_HDR_H + (bandejas[i]?.fusoes?.length ?? 0) * CDO_FUSAO_H + 4
  }
  y += CDO_BDJ_HDR_H + targetFi * CDO_FUSAO_H + CDO_FUSAO_H / 2
  return y
}
// Y absoluto (px) do centro de uma fusão dentro do CDONode (seção de bandejas)
function cdoBandejaFusaoHandleTop(splitterCount, bandejas, targetBi, targetFi) {
  let y = CDO_HEADER_H + splitterCount * CDO_SPLITTER_H
  for (let i = 0; i < targetBi; i++) {
    y += cdoBandejaH(bandejas[i])
  }
  y += CDO_BDJ_HDR_H + targetFi * CDO_FUSAO_H + CDO_FUSAO_H / 2
  return y
}

// ── 1. DATA LAYER ───────────────────────────────────────────────────────────

function buildGraphData(topologia) {
  const nodes = []
  const edges = []
  // seenNodes evita nós duplicados; seenEdges evita arestas duplicadas
  const seenNodes = new Set()
  const seenEdges = new Set()

  function pushEdge(edge) {
    if (seenEdges.has(edge.id)) return
    seenEdges.add(edge.id)
    edges.push(edge)
  }

  // Mapa plano de todas as caixas para herança CDO→CDO (inclui cascade CDOs)
  const caixaById = {}
  // Mapa de CTOs para CTO-em-cascata
  const ctoById = {}
  for (const olt of topologia) {
    // CDOs diretos da OLT
    for (const c of (olt.caixas ?? [])) {
      const id = c.id ?? c._id
      if (id) caixaById[String(id)] = c
    }
    // ALL caixas (incluindo cascade CDOs com cdo_pai_id) — só no primeiro OLT
    for (const c of (olt._allCaixas ?? [])) {
      const id = c.id ?? c._id
      if (id && !caixaById[String(id)]) caixaById[String(id)] = c
    }
    for (const caixa of (olt.caixas ?? [])) {
      for (const cto of (caixa.ctos ?? [])) {
        if (cto.cto_id) ctoById[cto.cto_id] = cto
      }
    }
    // ALL CTOs (incluindo CTOs destino de cascatas) — só no primeiro OLT
    for (const cto of (olt._allCTOs ?? [])) {
      if (cto.cto_id && !ctoById[cto.cto_id]) ctoById[cto.cto_id] = cto
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
        placa:         entrada.placa ?? null,
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
        bandejas:   cto?.diagrama?.bandejas  ?? [],
        splitters:  cto?.diagrama?.splitters ?? [],
        entrada:    cto?.diagrama?.entrada   ?? null,
      },
    })
  }

  // Adiciona CDO + processa seus próprios splitters recursivamente
  function addCDOWithSplitters(cdoNid, caixaData, destTipo) {
    if (seenNodes.has(cdoNid)) return
    addCDONode(cdoNid, caixaData, destTipo)
    const spls = caixaData?.diagrama?.splitters ?? []
    for (let si = 0; si < spls.length; si++) {
      const spl       = spls[si]
      const splNid    = `spl-${cdoNid}-${si}`
      const ratio     = parseSplitterRatio(spl.tipo)
      const fibra     = spl.entrada?.fibra ?? (si * 2 + 1)
      const tubeLabel = spl.nome ?? `T${Math.ceil(fibra / 12)}:F${((fibra - 1) % 12) + 1}`
      const eColor    = fiberColor(fibra)
      if (!seenNodes.has(splNid)) {
        seenNodes.add(splNid)
        // Busca fusão vinculada por splitter_id para herdar PON
        const linkedFusao = (caixaData?.diagrama?.bandejas ?? [])
          .flatMap(b => b.fusoes ?? [])
          .find(f => f.splitter_id === spl.id)
        nodes.push({
          id: splNid, type: 'splitterNode', position: { x: 0, y: 0 },
          data: {
            nome: `Splitter ${si + 1}`, tipo: spl.tipo ?? '1x8', ratio, tubeLabel, colorIn: eColor,
            saidas: spl.saidas ?? [],
            pon_placa: spl.pon_placa ?? linkedFusao?.pon_placa ?? null,
            pon_porta: spl.pon_porta ?? linkedFusao?.pon_porta ?? null,
            fo_entrada: spl.entrada?.fibra ?? linkedFusao?.entrada?.fibra ?? null,
          },
        })
      }
      pushEdge({
        id: `e-${cdoNid}-${splNid}`, source: cdoNid, target: splNid,
        sourceHandle: `out-${si}`, type: 'smoothstep', label: tubeLabel,
        style: { stroke: eColor, strokeWidth: 2 },
        labelStyle: { fill: eColor, fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: eColor, width: 10, height: 10 },
      })
      addSplitterOutputEdges(splNid, spl.saidas ?? [], caixaById, ctoById)
    }
  }

  // Adiciona CTO + processa cascatas de bandejas e splitters recursivamente
  function addCTOWithCascade(ctoNid, ctoData) {
    if (seenNodes.has(ctoNid)) return
    addCTONode(ctoNid, ctoData)

    // ── splitters com saídas para CTOs (formato legado/CDO-style) ─────────────
    const ctoSpls  = ctoData?.diagrama?.splitters ?? []
    const bandejas = ctoData?.diagrama?.bandejas  ?? []
    for (let ci = 0; ci < ctoSpls.length; ci++) {
      const cspl   = ctoSpls[ci]
      // Só criar nó de splitter se tiver saídas com CTO destino
      const saidas = (cspl.saidas ?? []).filter(sd => sd?.cto_id || sd?.id)
      if (saidas.length === 0) continue          // splitter de clientes — não aparece na topologia
      const csplNid = `spl-${ctoNid}-${ci}`
      const ratio   = parseSplitterRatio(cspl.tipo)
      const fibra   = cspl.entrada?.fibra ?? (ci + 1)

      // Usa cor + handle da fusão na bandeja que referencia este splitter (se houver)
      let bdjFusao = null, bdjBi = -1, bdjFi = -1
      for (let bi = 0; bi < bandejas.length; bi++) {
        const fusoes = bandejas[bi]?.fusoes ?? []
        for (let fi = 0; fi < fusoes.length; fi++) {
          const f = fusoes[fi]
          if (f.tipo === 'splitter' && f.ref_id === cspl.id) {
            bdjFusao = f; bdjBi = bi; bdjFi = fi; break
          }
        }
        if (bdjFusao) break
      }
      const corIdx      = bdjFusao?.cor ?? fibra
      const edgeColor   = fiberColor(corIdx)
      const corNome     = ABNT[((corIdx - 1) % 12)]?.nome ?? `F${fibra}`
      const srcHandle   = bdjBi >= 0 ? `bdj-${bdjBi}-f-${bdjFi}` : 'out-0'

      if (!seenNodes.has(csplNid)) {
        seenNodes.add(csplNid)
        nodes.push({
          id: csplNid, type: 'splitterNode', position: { x: 0, y: 0 },
          data: {
            nome:      cspl.nome ?? `SPL-${ci + 1}`,
            tipo:      cspl.tipo ?? '1x8',
            ratio,
            tubeLabel: corNome,
            colorIn:   edgeColor,
            saidas:    cspl.saidas ?? [],
          },
        })
      }
      pushEdge({
        id: `e-${ctoNid}-${csplNid}`, source: ctoNid, target: csplNid,
        sourceHandle: srcHandle,
        type: 'smoothstep', label: corNome,
        style: { stroke: edgeColor, strokeWidth: 1.5 },
        labelStyle: { fill: edgeColor, fontSize: 9, fontWeight: 700 },
        labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 9, height: 9 },
      })
      addSplitterOutputEdges(csplNid, saidas, caixaById, ctoById)
    }

    // ── bandejas: fusões do tipo 'cascata' ou 'direto' → CTO ou CDO ──────────
    for (let bi = 0; bi < bandejas.length; bi++) {
      const fusoes = bandejas[bi]?.fusoes ?? []
      for (let fi = 0; fi < fusoes.length; fi++) {
        const f = fusoes[fi]
        const isCascata = f.tipo === 'cascata'
        const isDireto  = f.tipo === 'direto'
        if ((!isCascata && !isDireto) || !f.ref_id) continue
        const edgeColor = fiberColor(f.cor)
        // portNum conta apenas fusões não-splitter antes desta
        const portNum   = fusoes.slice(0, fi).filter(x => x.tipo !== 'splitter').length + 1
        // Determinar tipo do destino (cto ou cdo)
        const destTipoPrefix = f.dest_tipo ?? (ctoById[f.ref_id] ? 'cto' : caixaById[String(f.ref_id)] ? 'cdo' : 'cto')
        const destNid        = `${destTipoPrefix}-${f.ref_id}`
        if (destTipoPrefix === 'cto') {
          addCTOWithCascade(destNid, ctoById[f.ref_id] ?? null)
        } else {
          addCDOWithSplitters(destNid, caixaById[String(f.ref_id)] ?? null, 'CDO')
        }
        pushEdge({
          id:           `e-${ctoNid}-${destNid}-${f.id ?? f.ref_id}`,
          source:        ctoNid,
          target:        destNid,
          sourceHandle: `bdj-${bi}-f-${fi}`,
          type:         'bezier',
          label:        `S${portNum}`,
          style:        { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: isDireto ? '5 3' : undefined },
          labelStyle:   { fill: edgeColor, fontSize: 9, fontWeight: 700 },
          labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
          markerEnd:    { type: MarkerType.ArrowClosed, color: edgeColor, width: 9, height: 9 },
        })
      }
    }
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

      // Ocupação de fibra: usada=sólida, livre=tracejada, reserva=pontilhada
      const status    = saida?.status ?? (saida?.cto_id ? 'usada' : 'livre')
      const dashArray = status === 'usada' ? undefined : status === 'reserva' ? '2 3' : '6 3'
      const edgeOpacity = status === 'livre' ? 0.5 : 1

      if (!seenNodes.has(destNid)) {
        if (destTipo === 'cto') {
          addCTOWithCascade(destNid, allCTOs[destId] ?? null)
        } else if (destTipo === 'cdo' || destTipo === 'ce') {
          addCDOWithSplitters(destNid, allCaixas[String(destId)], destTipo)
        } else {
          seenNodes.add(destNid)
          nodes.push({
            id: destNid, type: 'passagemNode', position: { x: 0, y: 0 },
            data: { nome: saida.nome ?? destId, destId, destTipo },
          })
        }
      }

      pushEdge({
        id:           `e-${splNid}-${destNid}-p${portNum}`,
        source:       splNid,
        target:       destNid,
        sourceHandle: `s-out-${saIdx}`,
        type:         'step',
        label:        `S${portNum}`,
        style:        { stroke: portColor, strokeWidth: 1.5, strokeDasharray: dashArray, opacity: edgeOpacity },
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
          caixas: olt.caixas ?? [],
        },
      })
    }

    for (const caixa of (olt.caixas ?? [])) {
      const caixaNid = `cdo-${caixa.id ?? caixa._id}`
      // Adiciona CDO top-level (usa helper que respeita seenNodes)
      addCDONode(caixaNid, caixa, caixa.tipo ?? 'CDO')

      // Edge OLT → CDO
      pushEdge({
        id: `e-${oltNid}-${caixaNid}`, source: oltNid, target: caixaNid,
        type: 'smoothstep', label: 'Backbone',
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

        pushEdge({
          id: `e-${caixaNid}-${splNid}`, source: caixaNid, target: splNid,
          sourceHandle: `out-${si}`, type: 'smoothstep', label: tubeLabel,
          style: { stroke: edgeColor, strokeWidth: 2 },
          labelStyle: { fill: edgeColor, fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 10, height: 10 },
        })

        addSplitterOutputEdges(splNid, spl.saidas ?? [], caixaById, ctoById)
      }

      // CTOs sem splitter → direto CDO→CTO (cascade processado em addCTOWithCascade)
      if (splitters.length === 0) {
        for (const cto of (caixa.ctos ?? [])) {
          const ctoNid    = `cto-${cto.cto_id}`
          const portColor = fiberColor(cto.porta_cdo ?? 1)
          addCTOWithCascade(ctoNid, ctoById[cto.cto_id] ?? cto)
          pushEdge({
            id: `e-${caixaNid}-${ctoNid}`, source: caixaNid, target: ctoNid,
            type: 'smoothstep', label: cto.porta_cdo != null ? `P${cto.porta_cdo}` : undefined,
            style: { stroke: portColor, strokeWidth: 1.5 },
            labelStyle: { fill: portColor, fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
            markerEnd: { type: MarkerType.ArrowClosed, color: portColor, width: 9, height: 9 },
          })
        }
      }
    }
  }

  // ── Cascata CDO→CDO: processa CDOs filho (cdo_pai_id) em múltiplos passes ──
  for (let pass = 0; pass < 8; pass++) {
    let added = false
    for (const [rawId, caixa] of Object.entries(caixaById)) {
      if (!caixa.cdo_pai_id) continue
      const caixaNid = `cdo-${rawId}`
      const paiNid   = `cdo-${caixa.cdo_pai_id}`
      if (!seenNodes.has(paiNid)) continue  // pai ainda não no grafo

      // Adiciona CDO filho + seus splitters (deduplica via seenNodes)
      if (!seenNodes.has(caixaNid)) {
        addCDOWithSplitters(caixaNid, caixa, caixa.tipo ?? 'CDO')
        added = true
      }

      // Aresta pai CDO → filho CDO (deduplica via seenEdges)
      const portColor = fiberColor(caixa.porta_cdo_pai ?? 1)
      pushEdge({
        id: `e-${paiNid}-${caixaNid}`,
        source: paiNid, target: caixaNid,
        type: 'smoothstep', label: caixa.porta_cdo_pai != null ? `P${caixa.porta_cdo_pai}` : 'CDO→CDO',
        style: { stroke: portColor, strokeWidth: 2 },
        labelStyle: { fill: portColor, fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: portColor, width: 10, height: 10 },
      })

      // CTOs diretos do filho (sem splitters no filho — addCDOWithSplitters cuida dos outros)
      if ((caixa.diagrama?.splitters ?? []).length === 0) {
        for (const cto of (caixa.ctos ?? [])) {
          const ctoNid   = `cto-${cto.cto_id}`
          const ctoColor = fiberColor(cto.porta_cdo ?? 1)
          addCTOWithCascade(ctoNid, ctoById[cto.cto_id] ?? cto)
          pushEdge({
            id: `e-${caixaNid}-${ctoNid}`, source: caixaNid, target: ctoNid,
            type: 'smoothstep', label: cto.porta_cdo != null ? `P${cto.porta_cdo}` : undefined,
            style: { stroke: ctoColor, strokeWidth: 1.5 },
            labelStyle: { fill: ctoColor, fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: 'rgba(4,12,28,0.85)', rx: 4 },
            markerEnd: { type: MarkerType.ArrowClosed, color: ctoColor, width: 9, height: 9 },
          })
        }
      }
    }
    if (!added) break
  }

  return { nodes, edges }
}

// ── 2. LAYOUT LAYER ─────────────────────────────────────────────────────────

function getNodeDims(node) {
  switch (node.type) {
    case 'oltNode':     return { w: OLT_WIDTH, h: oltHeight(node.data.caixas ?? []) }
    case 'cdoNode':     return { w: CDO_WIDTH, h: cdoHeight(node.data.splitterCount ?? 0, node.data.bandejas ?? []) }
    case 'ceNode':      return { w: CE_WIDTH,  h: CE_HEIGHT }
    case 'splitterNode':return { w: SPL_WIDTH, h: splHeight(parseSplitterRatio(node.data.tipo)) }
    case 'ctoNode':     return { w: CTO_WIDTH, h: ctoHeight(node.data.bandejas ?? []) }
    default:            return { w: 160, h: 80 }
  }
}

function applyDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 360, nodesep: 130, edgesep: 80, marginx: 160, marginy: 160 })

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

  // CDO/CTO bandeja → destino direto: alinhar Y do alvo com o handle de origem
  const bdjOutEdges = {}
  for (const e of edges) {
    if (e.sourceHandle?.startsWith('bdj-')) {
      if (!bdjOutEdges[e.source]) bdjOutEdges[e.source] = []
      bdjOutEdges[e.source].push(e)
    }
  }
  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]))
  for (const [srcId, grp] of Object.entries(bdjOutEdges)) {
    const srcNode = nodeById[srcId]
    if (!srcNode) continue
    const { h: srcH } = getNodeDims(srcNode)
    const srcTopY = (centerY[srcId] ?? 0) - srcH / 2
    for (const e of grp) {
      const m = e.sourceHandle.match(/^bdj-(\d+)-f-(\d+)$/)
      if (!m) continue
      const bi = parseInt(m[1], 10)
      const fi = parseInt(m[2], 10)
      let handleOffsetY
      if (srcNode.type === 'cdoNode') {
        handleOffsetY = cdoBandejaFusaoHandleTop(srcNode.data.splitterCount ?? 0, srcNode.data.bandejas ?? [], bi, fi)
      } else if (srcNode.type === 'ctoNode') {
        handleOffsetY = ctoFusaoHandleTop(srcNode.data.bandejas ?? [], bi, fi)
      } else continue
      // Só sobrescrever se não foi já definido pela lógica de splitter
      if (ctoYOverride[e.target] === undefined) {
        ctoYOverride[e.target] = srcTopY + handleOffsetY
      }
    }
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
      const origFibras = n.data.splFibras ?? []
      const origSpls   = n.data.splitters ?? []
      base.data = {
        ...n.data,
        splFibras: order.map(i => origFibras[i] ?? null),
        splitters: order.map(i => ({ ...(origSpls[i] ?? {}), _origIdx: i })),
        // bandejas mantidas em ordem original (independente da ordem dos splitters)
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
  const caixas = data.caixas ?? []
  // Sort by porta_olt for DIO/PON display
  const sorted = [...caixas].sort((a, b) => (a.porta_olt ?? 999) - (b.porta_olt ?? 999))
  const totalH = oltHeight(caixas)

  return (
    <div style={{
      background:   '#050f1f',
      border:       '2px solid #0891b2',
      borderRadius: 10,
      width:        OLT_WIDTH,
      height:       totalH,
      fontFamily:   'inherit',
      overflow:     'hidden',
      boxShadow:    '0 0 0 1px rgba(8,145,178,0.15), 0 4px 20px rgba(8,145,178,0.15)',
      position:     'relative',
    }}>
      {/* Header */}
      <div style={{
        background:   'rgba(8,145,178,0.15)',
        borderBottom: '1px solid rgba(8,145,178,0.2)',
        padding:      '7px 11px',
        height:       OLT_HEADER_H,
        boxSizing:    'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>🖥️</span>
          <div>
            <div style={{ fontSize: 8, color: '#0891b2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>OLT · GPON</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e0f2fe', lineHeight: 1.2 }}>{data.nome}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {data.ip && !data._mobile && (
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#67e8f9',
              background: 'rgba(8,145,178,0.12)', padding: '1px 5px', borderRadius: 4 }}>
              {data.ip}
            </span>
          )}
          {data.modelo && !data._mobile && (
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{data.modelo}</span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block' }} />
            <span style={{ fontSize: 8, color: statusColor, fontWeight: 700 }}>{data.status ?? 'ativo'}</span>
          </span>
        </div>
      </div>

      {/* Portas DIO/PON */}
      {sorted.length === 0 ? (
        <div style={{ padding: '6px 10px', fontSize: 8, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
          {data.capacidade} portas PON disponíveis
        </div>
      ) : (
        sorted.map((caixa, i) => {
          const porta = caixa.porta_olt ?? (i + 1)
          const color = fiberColor(porta)
          return (
            <div key={caixa.id ?? i} style={{
              height:      OLT_PORT_H,
              display:     'flex', alignItems: 'center',
              padding:     '0 10px',
              gap:         5,
              borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background:  i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
            }}>
              <span style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', minWidth: 24 }}>
                P{porta}
              </span>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 4px ${color}88`, flexShrink: 0 }} />
              <span style={{ fontSize: 8.5, color: '#cbd5e1', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {caixa.nome ?? caixa.id}
              </span>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                {caixa.tipo ?? 'CDO'}
              </span>
            </div>
          )
        })
      )}

      <Handle type="source" position={Position.Right} id="out"
        style={{ background: '#0891b2', border: 'none', width: 9, height: 9 }} />
    </div>
  )
})
OLTNode.displayName = 'OLTNode'

// ── CDO Node (splitters + bandejas de fusão) ──────────────────────────────────
const CDONode = memo(({ data }) => {
  const splitterCount = data.splitterCount ?? 0
  const splFibras     = data.splFibras ?? []
  const splitters     = data.splitters ?? []
  const bandejas      = data.bandejas  ?? []
  const totalH        = cdoHeight(splitterCount, bandejas)

  // Handle Y position: always in the splitter section (fixed height per splitter row)
  function handleTop(si) {
    return CDO_HEADER_H + si * CDO_SPLITTER_H + CDO_SPLITTER_H / 2
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
          {(data.placa != null || data.pon != null) && (
            <span style={{ fontSize: 9, color: '#67e8f9', background: 'rgba(8,145,178,0.15)',
              padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {data.placa != null ? `Pl${data.placa} ` : ''}PON {data.pon ?? '?'}
            </span>
          )}
          {data.portaOlt != null && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>Porta {data.portaOlt}</span>
          )}
          {!data._mobile && (
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>
              {splitterCount} spl · {bandejas.length} bdj
            </span>
          )}
        </div>
      </div>

      {/* ── Seção Splitters (compacta, altura fixa por splitter) ── */}
      {splitters.map((spl, si) => {
        const fibra    = splFibras[si] ?? (si * 2 + 1)
        const color    = fiberColor(fibra)
        const ratio    = parseSplitterRatio(spl.tipo)
        const saidas   = spl.saidas ?? []
        const ligadas  = saidas.filter(s => s?.cto_id).length
        const tubeIdx  = Math.floor((fibra - 1) / 12) + 1
        const fiberIdx = ((fibra - 1) % 12) + 1
        const abntNome = ABNT[fiberIdx - 1]?.nome ?? `F${fiberIdx}`

        return (
          <div key={si} style={{
            height:       CDO_SPLITTER_H,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            padding:      '0 10px 0 12px',
            display:      'flex', alignItems: 'center', gap: 7,
            background:   si % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.22)', fontFamily: 'monospace', minWidth: 20 }}>
              B{(spl?._origIdx !== undefined ? spl._origIdx : si) + 1}
            </span>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 4px ${color}88`, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', lineHeight: 1 }}>
                T{tubeIdx}·F{fiberIdx}
              </span>
              <span style={{ fontSize: 7, color, lineHeight: 1.2, fontWeight: 600 }}>{abntNome}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <span style={{ fontSize: 8, fontWeight: 800, color: '#f97316',
                background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                padding: '1px 4px', borderRadius: 4 }}>
                {spl.tipo ?? `1×${ratio}`}
              </span>
              <span style={{ fontSize: 7, color: ligadas > 0 ? '#86efac' : 'rgba(255,255,255,0.18)' }}>
                {ligadas}/{ratio}
              </span>
              {(spl.pon_placa != null || spl.pon_porta != null) && (
                <span style={{ fontSize: 6, color: '#a78bfa', fontFamily: 'monospace', fontWeight: 700,
                  background: 'rgba(139,92,246,0.12)', padding: '0px 3px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                  {spl.pon_placa != null ? `Pl${spl.pon_placa}·` : ''}P{spl.pon_porta ?? '?'}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {splitterCount === 0 && bandejas.length === 0 && (
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>Sem splitters</span>
        </div>
      )}

      {/* ── Seção Bandejas (com fusões — fonte única de verdade) ── */}
      {bandejas.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(8,145,178,0.15)' }}>
          {bandejas.map((bdj, bi) => {
            const fusoes = bdj.fusoes ?? []
            const rowH   = cdoBandejaH(bdj)
            return (
              <div key={bdj.id ?? bi} style={{
                height:       rowH,
                borderBottom: bi < bandejas.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                background:   bi % 2 === 0 ? 'rgba(0,180,255,0.02)' : 'transparent',
              }}>
                {/* Bandeja header */}
                <div style={{
                  height:     CDO_BDJ_HDR_H,
                  display:    'flex', alignItems: 'center',
                  padding:    '0 10px 0 12px', gap: 6,
                }}>
                  <span style={{ fontSize: 8, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                    🗂 {bdj.nome ?? `Bandeja ${bi + 1}`}
                  </span>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>
                    {fusoes.length} fusões
                  </span>
                </div>
                {/* Fusões */}
                {fusoes.map((f, fi) => {
                  const entColor = fiberColor(f.entrada?.fibra)
                  const saiColor = fiberColor(f.saida?.fibra)
                  const tipo = (f.tipo ?? '').toLowerCase()
                  // Visual config per tipo — usa valores por-fusão (pon_placa/pon_porta) quando disponíveis
                  const ponPlaca = f.pon_placa ?? data.placa
                  const ponPorta = f.pon_porta ?? data.pon
                  const tipoVisual = tipo === 'pon'
                    ? { label: `◉${ponPlaca != null ? ' Pl' + ponPlaca : ''} PON${ponPorta != null ? ' ' + ponPorta : ''}`, color: '#60a5fa', bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.4)', title: `PON — OLT: ${data.nome ?? ''} Placa ${ponPlaca ?? '?'} Porta ${ponPorta ?? '?'}` }
                    : tipo === 'conector'
                    ? { label: '⊣ CON', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', title: 'Conector (≈0.3 dB)' }
                    : tipo === 'pass' || tipo === 'passagem'
                    ? { label: '—— ', color: '#94a3b8', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)', title: 'Passagem direta' }
                    : null
                  return (
                    <div key={fi} style={{
                      height:      CDO_FUSAO_H,
                      display:     'flex', alignItems: 'center',
                      paddingLeft: 20, paddingRight: 8, gap: 4,
                      borderTop:   '1px solid rgba(255,255,255,0.03)',
                      background:  tipo === 'pon' ? 'rgba(59,130,246,0.04)' : 'transparent',
                    }}>
                      <span style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace', minWidth: 10 }}>{fi + 1}</span>
                      {f.porta_dio != null && (
                        <span style={{ fontSize: 6, fontWeight: 800, color: '#f97316', fontFamily: 'monospace',
                          background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                          borderRadius: 3, padding: '0px 3px', lineHeight: 1.4, flexShrink: 0 }}>
                          D{f.porta_dio}
                        </span>
                      )}
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: entColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 7, color: entColor, fontFamily: 'monospace', fontWeight: 700 }}>F{f.entrada?.fibra ?? '?'}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>→</span>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: saiColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 7, color: saiColor, fontFamily: 'monospace', fontWeight: 700 }}>F{f.saida?.fibra ?? '?'}</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
                        {f.obs && !tipoVisual && (
                          <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.18)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 40 }}>
                            {f.obs}
                          </span>
                        )}
                        {tipoVisual && (
                          <span title={tipoVisual.title} style={{
                            fontSize: 6, fontWeight: 800, padding: '1px 4px', borderRadius: 3,
                            color: tipoVisual.color, background: tipoVisual.bg, border: `1px solid ${tipoVisual.border}`,
                            whiteSpace: 'nowrap', letterSpacing: '0.02em',
                          }}>
                            {tipoVisual.label}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Handles de saída — um por splitter, posição fixa na seção de splitters */}
      {Array.from({ length: splitterCount }, (_, si) => (
        <Handle key={si} type="source" position={Position.Right} id={`out-${si}`}
          style={{
            background: fiberColor(splFibras[si] ?? (si * 2 + 1)),
            border: 'none', width: 9, height: 9,
            top: handleTop(si), right: -5, transform: 'none',
          }}
        />
      ))}
      {splitterCount === 0 && (
        <Handle type="source" position={Position.Right} id="out-0"
          style={{ background: '#0891b2', border: 'none', width: 9, height: 9, top: '50%' }} />
      )}

      {/* Source handles por fusão das bandejas (permite conexões saindo da bandeja) */}
      {bandejas.flatMap((bdj, bi) =>
        (bdj.fusoes ?? []).map((f, fi) => {
          const top   = cdoBandejaFusaoHandleTop(splitterCount, bandejas, bi, fi)
          const color = fiberColor(f.saida?.fibra ?? f.entrada?.fibra)
          return (
            <Handle
              key={`bdj-${bi}-f-${fi}`}
              type="source"
              position={Position.Right}
              id={`bdj-${bi}-f-${fi}`}
              style={{
                background: color, border: `1px solid ${color}`, width: 7, height: 7,
                position: 'absolute', right: -3.5, top, transform: 'none',
                boxShadow: `0 0 4px ${color}88`,
              }}
            />
          )
        })
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
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fed7aa' }}>{data.nome}</div>
          {(data.pon_placa != null || data.pon_porta != null) && (
            <span style={{ fontSize: 8, color: '#a78bfa', background: 'rgba(139,92,246,0.15)',
              padding: '1px 5px', borderRadius: 8, fontWeight: 700, display: 'inline-block', marginTop: 1 }}>
              {data.pon_placa != null ? `Pl${data.pon_placa} ` : ''}PON {data.pon_porta ?? '?'}
              {data.fo_entrada != null && ` · FO${data.fo_entrada}`}
            </span>
          )}
        </div>
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
const CTONode = memo(({ data }) => {
  const bandejas = data.bandejas ?? []
  const entrada  = data.entrada  ?? null

  return (
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

      {/* Header */}
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

      {/* Body — minHeight garante alinhamento dos handles com as rows das bandejas */}
      <div style={{ padding: '6px 10px 8px', minHeight: 52 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#86efac', lineHeight: 1.2 }}>
          {data.nome}
        </div>
        {!data._mobile && data.ctoId && data.ctoId !== data.nome && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginTop: 2 }}>
            {data.ctoId}
          </div>
        )}
        {/* FO de entrada */}
        {!data._mobile && entrada?.cdo_id && (
          <div style={{ fontSize: 7.5, color: 'rgba(100,220,140,0.5)', marginTop: 3, display: 'flex', gap: 3, alignItems: 'center' }}>
            <span>↑</span>
            <span style={{ fontFamily: 'monospace' }}>{entrada.cdo_id}</span>
            {entrada.porta_cdo != null && (
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>P{entrada.porta_cdo}</span>
            )}
            {entrada.splitter_cto && (
              <span style={{ color: 'rgba(249,115,22,0.6)', fontFamily: 'monospace' }}>{entrada.splitter_cto}</span>
            )}
          </div>
        )}
        {data.capacidade != null && (
          <OccBar ocupacao={data.ocupacao ?? 0} capacidade={data.capacidade} />
        )}
      </div>

      {/* Bandejas */}
      {bandejas.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(22,163,74,0.15)' }}>
          {bandejas.map((bdj, bi) => {
            const fusoes = bdj.fusoes ?? []
            return (
              <div key={bdj.id ?? bi} style={{
                borderBottom: bi < bandejas.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                background:   bi % 2 === 0 ? 'rgba(22,163,74,0.02)' : 'transparent',
              }}>
                {/* Bandeja header */}
                <div style={{
                  height: CDO_BDJ_HDR_H, display: 'flex', alignItems: 'center',
                  padding: '0 8px 0 10px', gap: 4,
                }}>
                  <span style={{ fontSize: 7.5, fontWeight: 800, color: '#86efac', fontFamily: 'monospace' }}>
                    {bdj.nome ?? `B${bi + 1}`}
                  </span>
                  <span style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>
                    {fusoes.length}f
                  </span>
                </div>
                {/* Fusões */}
                {fusoes.map((f, fi) => {
                  const color   = fiberColor(f.cor)
                  // splitter mostra "SPL-N tipo"; demais contam posições não-splitter
                  const portNum = fusoes.slice(0, fi).filter(x => x.tipo !== 'splitter').length + 1
                  const splIdx  = f.tipo === 'splitter'
                    ? (data.splitters ?? []).findIndex(s => s.id === f.ref_id)
                    : -1
                  const spl     = splIdx >= 0 ? (data.splitters ?? [])[splIdx] : null
                  const label   = f.tipo === 'splitter'
                    ? splIdx >= 0 && spl
                      ? `SPL-${splIdx + 1} ${spl.tipo || ''}`.trim()
                      : 'SPL-?'
                    : f.tipo === 'direto'
                    ? `→S${portNum}`
                    : `S${portNum}`

                  return (
                    <div key={f.id ?? fi} style={{
                      height: CDO_FUSAO_H, display: 'flex', alignItems: 'center',
                      paddingLeft: 16, paddingRight: 6, gap: 4,
                      borderTop: '1px solid rgba(255,255,255,0.03)',
                    }}>
                      <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace', minWidth: 10 }}>{fi + 1}</span>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color, flexShrink: 0,
                        boxShadow: `0 0 3px ${color}88` }} />
                      <span style={{ fontSize: 6.5, color, fontFamily: 'monospace', fontWeight: 700, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Source handle padrão — usado quando não há bandejas com saídas */}
      <Handle type="source" position={Position.Right} id="out-0"
        style={{ background: '#16a34a', border: 'none', width: 8, height: 8,
          ...(bandejas.length > 0 ? { opacity: 0, pointerEvents: 'none' } : {}) }} />

      {/* Handles individuais por fusão (cascata / splitter) */}
      {bandejas.flatMap((bdj, bi) =>
        (bdj.fusoes ?? []).map((f, fi) => {
          if (f.tipo !== 'cascata' && f.tipo !== 'splitter' && f.tipo !== 'direto') return null
          const top    = ctoFusaoHandleTop(bandejas, bi, fi)
          const color  = fiberColor(f.cor)
          const isSpl  = f.tipo === 'splitter'
          return (
            <Handle
              key={`bdj-${bi}-f-${fi}`}
              type="source"
              position={Position.Right}
              id={`bdj-${bi}-f-${fi}`}
              style={{
                background: color, border: `1px solid ${color}`, width: 7, height: 7,
                position: 'absolute', right: -3.5, top, transform: 'none',
                boxShadow: `0 0 4px ${color}88`,
                ...(isSpl ? { opacity: 0, pointerEvents: 'none' } : {}),
              }}
            />
          )
        })
      )}
    </div>
  )
})
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
  { id: 'select', icon: '↖', label: 'Selecionar' },
  { id: 'delete', icon: '🗑', label: 'Deletar seleção' },
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
function StatusBar({ nodeCount, edgeCount, isMobile }) {
  return (
    <Panel position="bottom-center" style={{ margin: 0, width: isMobile ? '100%' : 'auto' }}>
      <div style={{
        background:   'rgba(6,10,22,0.85)',
        border:       '1px solid rgba(255,255,255,0.06)',
        borderRadius: isMobile ? 0 : '8px 8px 0 0',
        padding:      '4px 12px',
        fontSize:     10,
        color:        'rgba(255,255,255,0.3)',
        display:      'flex', gap: isMobile ? 8 : 16, flexWrap: 'wrap',
        fontFamily:   'inherit',
        justifyContent: isMobile ? 'center' : 'flex-start',
      }}>
        {!isMobile && <><span>Arrastar = mover nó</span><span>·</span><span>Scroll = zoom</span><span>·</span></>}
        <span>Nós: <strong style={{ color: 'rgba(255,255,255,0.55)' }}>{nodeCount}</strong></span>
        <span>·</span>
        <span>Arestas: <strong style={{ color: 'rgba(255,255,255,0.55)' }}>{edgeCount}</strong></span>
        <span>·</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#94a3b8" strokeWidth="2"/></svg>usada
          <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 3"/></svg>livre
          <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#94a3b8" strokeWidth="2" strokeDasharray="2 3"/></svg>reserva
        </span>
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
  const [isMobile, setIsMobile]          = useState(false)
  const SNAP = 25

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 480) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const buildAndLayout = useCallback((topologia, useSaved = true) => {
    const { nodes: raw, edges: rawEdges } = buildGraphData(topologia)
    const { nodes: laid, edges: laidEdges } = applyDagreLayout(raw, rawEdges)
    const isMob = typeof window !== 'undefined' && window.innerWidth < 480
    const mLaid = isMob ? laid.map(n => ({ ...n, data: { ...n.data, _mobile: true } })) : laid
    if (useSaved && projetoId) {
      try {
        const savedPos   = JSON.parse(localStorage.getItem(`ftth-topo-pos-${projetoId}`)   || '{}')
        const savedEdges = JSON.parse(localStorage.getItem(`ftth-topo-edges-${projetoId}`) || 'null')
        const nodesOut = Object.keys(savedPos).length > 0
          ? mLaid.map(n => savedPos[n.id] ? { ...n, position: savedPos[n.id] } : n)
          : mLaid
        const laidIds = new Set(laidEdges.map(e => e.id))
        const manualEdges = savedEdges ? savedEdges.filter(e => !laidIds.has(e.id)) : []
        setNodes(nodesOut)
        setEdges([...laidEdges, ...manualEdges])
      } catch {
        setNodes(mLaid); setEdges(laidEdges)
      }
    } else {
      setNodes(mLaid)
      setEdges(laidEdges)
    }
    setTimeout(() => fitView({ padding: isMob ? 0.5 : 0.2, duration: 500 }), 80)
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

  // Atualizar flag _mobile nos nós quando isMobile muda (resize)
  useEffect(() => {
    setNodes(prev => prev.map(n => ({ ...n, data: { ...n.data, _mobile: isMobile } })))
  }, [isMobile, setNodes])

  // Auto-refresh quando fusão ou diagrama são salvos em outro componente
  useEffect(() => {
    function handleExternalChange() { load() }
    window.addEventListener('fiberops:topologia-changed', handleExternalChange)
    return () => window.removeEventListener('fiberops:topologia-changed', handleExternalChange)
  }, [load])

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
      ...params, type: 'smoothstep',
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

  const containerH = isMobile ? Math.min(altura, (typeof window !== 'undefined' ? window.innerHeight : 600) * 0.75) : altura

  return (
    <div style={{ height: containerH, background: '#060a16', borderRadius: 12, overflow: 'hidden', position: 'relative',
      border: '1px solid var(--border-color)',
      cursor: activeTool === 'addSplitter' || activeTool === 'addCTO' || activeTool === 'addCDO' ? 'crosshair' : 'default',
      touchAction: 'none' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: isMobile ? 0.4 : 0.2 }}
        minZoom={0.03}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#060a16' }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly && !isMobile}
        elementsSelectable={!readOnly}
        snapToGrid={!readOnly && !isMobile}
        snapGrid={[SNAP, SNAP]}
        onConnect={!readOnly && !isMobile ? onConnect : undefined}
        onPaneClick={!readOnly && !isMobile ? handlePaneClick : undefined}
        panOnDrag={true}
        panOnScroll={false}
        zoomOnScroll={!isMobile}
        zoomOnPinch={true}
        selectionOnDrag={false}
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
            '--xy-controls-button-background-color': 'rgba(255,255,255,0.06)',
            '--xy-controls-button-color': 'rgba(255,255,255,0.7)',
            ...(isMobile ? { transform: 'scale(1.7)', transformOrigin: 'bottom left' } : {}),
          }}
        />

        {!isMobile && (
          <MiniMap
            nodeColor={minimapColor}
            maskColor="rgba(6,10,22,0.8)"
            style={{
              background:   'rgba(6,10,22,0.9)',
              border:       '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
            }}
          />
        )}

        {!readOnly && !isMobile && (
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

        {!readOnly && isMobile && (
          <Panel position="top-left" style={{ margin: 0 }}>
            <div style={{ display: 'flex', gap: 6, padding: '6px 8px',
              background: 'rgba(6,10,22,0.96)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={handleAutoLayout} style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(8,145,178,0.5)',
                background: 'rgba(8,145,178,0.15)', color: '#67e8f9', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ⚡ Organizar
              </button>
              <button onClick={() => fitView({ padding: 0.4, duration: 500 })} style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ☐ Ajustar
              </button>
              <button onClick={handleSaveLayout} style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(22,163,74,0.4)',
                background: 'rgba(22,163,74,0.12)', color: '#86efac', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                💾 Salvar
              </button>
            </div>
          </Panel>
        )}

        <StatusBar nodeCount={nodes.length} edgeCount={edges.length} isMobile={isMobile} />
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
