/**
 * FiberOps Map Engine — OpenLayers + OpenStreetMap
 * =================================================
 * Motor de mapa modular, framework-agnostic, pronto para produção.
 * Alta performance para centenas de pontos via VectorSource eficiente.
 *
 * ── INTEGRAÇÃO ──────────────────────────────────────────────────────────────
 *   import { initMap, renderNodes, renderLinks, clearMap } from '@/lib/olMap'
 *
 *   // 1. Monte o mapa no container React (containerRef.current)
 *   const { map } = initMap(containerElement)
 *
 *   // 2. Conecte seus dados
 *   renderNodes(ctos)
 *   renderLinks(rotasGeoJSON)
 *
 * ── CSS ─────────────────────────────────────────────────────────────────────
 *   Importe 'ol/ol.css' no componente pai (ver MapaFTTH.js)
 * ────────────────────────────────────────────────────────────────────────────
 */

import Map          from 'ol/Map'
import View         from 'ol/View'
import TileLayer    from 'ol/layer/Tile'
import VectorLayer  from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM          from 'ol/source/OSM'
import Feature      from 'ol/Feature'
import Point        from 'ol/geom/Point'
import LineString   from 'ol/geom/LineString'
import GeoJSON      from 'ol/format/GeoJSON'
import Overlay      from 'ol/Overlay'
import { Style, Circle as CircleStyle, Fill, Stroke, Text as TextStyle, Icon, RegularShape } from 'ol/style'
import { Zoom, ScaleLine }  from 'ol/control'
import { defaults as defaultControls } from 'ol/control/defaults'
import { fromLonLat } from 'ol/proj'
import XYZ      from 'ol/source/XYZ'
import Draw     from 'ol/interaction/Draw'
import Polygon  from 'ol/geom/Polygon'

// ─── Singleton do mapa ──────────────────────────────────────────────────────
let _map          = null  // ol/Map
let _nodeSource   = null  // VectorSource para pontos (CTOs, Caixas, OLTs...)
let _linkSource   = null  // VectorSource para linhas (Rotas)
let _nodeLayer    = null  // VectorLayer de pontos
let _linkLayer    = null  // VectorLayer de linhas
let _satLayer     = null  // TileLayer satélite (Esri)
let _popupEl      = null  // HTMLElement do popup
let _popupOverlay = null  // ol/Overlay para popup
let _animTimer    = null  // setInterval para animação de piscar
let _animBright   = true  // estado do piscar

// ─── Varinha: preview de rede gerada automaticamente ───────────────────────
let _previewSource = null  // VectorSource para preview (rotas + CTOs gerados)
let _previewLayer  = null  // VectorLayer de preview
let _polySource    = null  // VectorSource para o polígono desenhado
let _polyLayer     = null  // VectorLayer do polígono
let _drawInter     = null  // Draw interaction (polygon)

// ─── Mapa de visibilidade por tipo — usado na style function ────────────────
// Permite toggle granular (CTO, Caixa, Poste, OLT) sem criar N layers
let _vis = { ctos: true, caixas: true, postes: true, olts: true }

// ─── Formato GeoJSON para parsing de rotas ──────────────────────────────────
const _geoJSONFormat = new GeoJSON({
  featureProjection: 'EPSG:3857',    // projetar direto para Web Mercator
  dataProjection:    'EPSG:4326',    // entrada em WGS84 (lat/lng)
})

// ===========================================================================
// ESTILOS
// ===========================================================================

/** Cor do CTO por ocupação (pct = ocupacao/capacidade) */
function _ctoColor(pct = 0) {
  if (pct >= 0.9) return '#f43f5e'  // vermelho — cheia
  if (pct >= 0.7) return '#f59e0b'  // amarelo — alerta
  return '#22c55e'                   // verde   — normal
}

/** Cor de rota por tipo */
const _rotaColor = { BACKBONE: '#6366f1', RAMAL: '#1e293b', DROP: '#22c55e' }
const _rotaWidth = { BACKBONE: 10, RAMAL: 6, DROP: 4 }

/**
 * Estilo de nó (CTO) — chamado como função para suportar animação.
 * O OL chama a style function em cada render, permitindo atualização dinâmica.
 *
 * @param {ol/Feature} feature
 * @returns {ol/style/Style}
 */
// Resolução EPSG:3857 equivalente ao zoom 14 (~9.55 m/px).
// Postes ficam invisíveis acima desta resolução (zoom < 14).
const _POSTE_MAX_RES = 9.56

/**
 * Style function dos nós — chamada pelo OL a cada render.
 * Recebe `resolution` como segundo argumento (m/px no EPSG:3857).
 *
 * Regras de visibilidade:
 *   CTO, CE/CDO, OLT → sempre visíveis (qualquer zoom)
 *   Poste            → visível apenas zoom ≥ 14 (resolution ≤ _POSTE_MAX_RES)
 */
function _nodeStyleFn(feature, resolution) {
  const type = feature.get('_type') ?? 'cto'

  // ── Respeita toggle de visibilidade por tipo ──────────────────────────────
  const visKey = type === 'cto' ? 'ctos'
    : (type === 'ce' || type === 'cdo') ? 'caixas'
    : type === 'poste' ? 'postes'
    : 'olts'
  if (!_vis[visKey]) return []

  // ── CTO — sempre visível, cores por ocupação, pisca quando cheia ──────────
  if (type === 'cto') {
    const pct    = feature.get('pct') ?? 0
    const isFull = pct >= 1.0
    const color  = _ctoColor(pct)

    // X shape: 4-pointed star rotated 45° = X
    const icon = new RegularShape({
      points:  4,
      radius:  10,
      radius2: 3,
      angle:   Math.PI / 4,
      fill:    new Fill({ color: isFull ? '#f43f5e' : color }),
      stroke:  new Stroke({ color: '#000000', width: 2 }),
    })

    const styles = [new Style({ image: icon, zIndex: 10 })]

    if (isFull) {
      styles.unshift(new Style({
        image: new RegularShape({
          points:  4,
          radius:  18,
          radius2: 6,
          angle:   Math.PI / 4,
          fill:   new Fill({ color: _hexWithAlpha('#f43f5e', _animBright ? 0.5 : 0.0) }),
          stroke: new Stroke({ color: _hexWithAlpha('#f43f5e', _animBright ? 0.35 : 0.0), width: 1 }),
        }),
        zIndex: 9,
      }))
    }

    return [
      ...styles,
      new Style({
        text: new TextStyle({
          text:     feature.get('cto_id') ?? '',
          offsetY:  16,
          font:     'bold 11px sans-serif',
          fill:     new Fill({ color: '#0f172a' }),
          stroke:   new Stroke({ color: '#ffffff', width: 2.5 }),
          overflow: true,
        }),
        zIndex: 1,
      }),
    ]
  }

  // ── Caixa CE — sempre visível ─────────────────────────────────────────────
  if (type === 'ce') {
    return [
      new Style({
        image: new RegularShape({
          points:  4,
          radius:  9,
          angle:   Math.PI / 4,
          fill:    new Fill({ color: '#3b82f6' }),
          stroke:  new Stroke({ color: '#000', width: 1.5 }),
        }),
        zIndex: 10,
      }),
      new Style({
        text: new TextStyle({
          text:     feature.get('nome') ?? feature.get('ce_id') ?? '',
          offsetY:  14,
          font:     '10px sans-serif',
          fill:     new Fill({ color: '#0f172a' }),
          stroke:   new Stroke({ color: '#ffffff', width: 2 }),
          overflow: true,
        }),
        zIndex: 1,
      }),
    ]
  }

  // ── CDO — sempre visível ──────────────────────────────────────────────────
  if (type === 'cdo') {
    return [
      new Style({
        image: new RegularShape({
          points:  4,
          radius:  9,
          angle:   Math.PI / 4,
          fill:    new Fill({ color: '#a855f7' }),
          stroke:  new Stroke({ color: '#000', width: 1.5 }),
        }),
        zIndex: 10,
      }),
      new Style({
        text: new TextStyle({
          text:     feature.get('nome') ?? feature.get('ce_id') ?? '',
          offsetY:  14,
          font:     '10px sans-serif',
          fill:     new Fill({ color: '#0f172a' }),
          stroke:   new Stroke({ color: '#ffffff', width: 2 }),
          overflow: true,
        }),
        zIndex: 1,
      }),
    ]
  }

  // ── Poste — visível apenas em zoom ≥ 14 ──────────────────────────────────
  if (type === 'poste') {
    if (resolution > _POSTE_MAX_RES) return []
    return new Style({
      image: new CircleStyle({
        radius:  5,
        fill:    new Fill({ color: '#64748b' }),
        stroke:  new Stroke({ color: '#1e293b', width: 1.5 }),
      }),
      zIndex: 5,
    })
  }

  // ── OLT — sempre visível ──────────────────────────────────────────────────
  return [
    new Style({
      image: new CircleStyle({
        radius:  10,
        fill:    new Fill({ color: '#06b6d4' }),
        stroke:  new Stroke({ color: '#000', width: 2 }),
      }),
      zIndex: 10,
    }),
    new Style({
      text: new TextStyle({
        text:     feature.get('nome') ?? feature.get('id') ?? '',
        offsetY:  16,
        font:     'bold 11px sans-serif',
        fill:     new Fill({ color: '#0369a1' }),
        stroke:   new Stroke({ color: '#ffffff', width: 2.5 }),
        overflow: true,
      }),
      zIndex: 1,
    }),
  ]
}

/** Estilo de highlight (hover) — anel branco ao redor */
function _hoverStyleFn(feature) {
  const base = _nodeStyleFn(feature)
  base.setImage(
    new CircleStyle({
      radius:  13,
      fill:    new Fill({ color: 'rgba(255,255,255,0.0)' }),
      stroke:  new Stroke({ color: '#f8fafc', width: 3 }),
    })
  )
  return [base, new Style({
    image: new CircleStyle({
      radius:  13,
      fill:    new Fill({ color: 'rgba(255,255,255,0.0)' }),
      stroke:  new Stroke({ color: '#f8fafc', width: 3 }),
    }),
  })]
}

/** Estilo de linha por tipo de rota */
function _linkStyleFn(feature) {
  const tipo  = feature.get('tipo') ?? ''
  const color = _rotaColor[tipo]  ?? '#94a3b8'
  const width = _rotaWidth[tipo]  ?? 2
  const dash  = tipo === 'DROP' ? [6, 4] : undefined

  return new Style({
    stroke: new Stroke({ color, width, lineDash: dash }),
  })
}

// ── Varinha: estilos de preview ───────────────────────────────────────────

/** Estilo de rota gerada automaticamente */
function _autoRouteStyle(feature) {
  const tipo = feature.get('tipo')

  // Rotas de distribuição CTO↔CTO (MST) — âmbar tracejado
  if (tipo === 'DROP') {
    return new Style({
      stroke: new Stroke({ color: '#f59e0b', width: 2, lineDash: [5, 4] }),
      zIndex: 21,
    })
  }
  // Backbone — cyan sólido
  if (tipo === 'BACKBONE') {
    return new Style({
      stroke: new Stroke({ color: '#00e5ff', width: 4, lineDash: [8, 4] }),
      zIndex: 20,
    })
  }
  // Ramal — cyan mais fino
  return new Style({
    stroke: new Stroke({ color: '#22d3ee', width: 2.5, lineDash: [6, 4] }),
    zIndex: 19,
  })
}

/** Estilo de CTO gerada automaticamente */
function _autoCTOStyle(feature) {
  return [
    new Style({
      image: new CircleStyle({
        radius:  8,
        fill:    new Fill({ color: '#00e5ff' }),
        stroke:  new Stroke({ color: '#0f172a', width: 2 }),
      }),
      zIndex: 25,
    }),
    new Style({
      text: new TextStyle({
        text:     feature.get('nome') ?? '',
        offsetY:  -16,
        font:     'bold 9px sans-serif',
        fill:     new Fill({ color: '#00e5ff' }),
        stroke:   new Stroke({ color: '#0f172a', width: 2 }),
        overflow: true,
      }),
      zIndex: 24,
    }),
  ]
}

/** Estilo do polígono de área desenhado */
const _polygonStyle = new Style({
  stroke: new Stroke({ color: '#00e5ff', width: 2, lineDash: [6, 3] }),
  fill:   new Fill({ color: 'rgba(0,229,255,0.07)' }),
  zIndex: 18,
})

/** Estilo do Draw interaction (live drawing) */
function _drawStyle() {
  return new Style({
    stroke: new Stroke({ color: '#00e5ff', width: 2, lineDash: [5, 3] }),
    fill:   new Fill({ color: 'rgba(0,229,255,0.05)' }),
    image:  new CircleStyle({
      radius: 5,
      fill:   new Fill({ color: '#00e5ff' }),
      stroke: new Stroke({ color: '#ffffff', width: 2 }),
    }),
  })
}

/** Preview de rota em desenho (pontos + linha) */
function _previewLineStyle() {
  return new Style({ stroke: new Stroke({ color: '#6366f1', width: 3, lineDash: [5, 3] }) })
}
function _previewDotStyle(snapped = false) {
  return new Style({
    image: new CircleStyle({
      radius:  snapped ? 7 : 5,
      fill:    new Fill({ color: snapped ? '#86efac' : '#6366f1' }),
      stroke:  new Stroke({ color: '#fff', width: 2 }),
    }),
  })
}

// ===========================================================================
// UTILITÁRIOS
// ===========================================================================

/** Converte cor hex + alpha numérico para rgba() */
function _hexWithAlpha(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Cria o elemento DOM do popup e retorna ele */
function _createPopupEl() {
  if (typeof document === 'undefined') return null
  const el = document.createElement('div')
  el.style.cssText = `
    position: absolute;
    background: rgba(15,23,42,0.95);
    color: #f1f5f9;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-family: system-ui, sans-serif;
    pointer-events: auto;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.1);
    min-width: 120px;
    transform: translate(-50%, calc(-100% - 12px));
    z-index: 100;
  `
  const closer = document.createElement('button')
  closer.innerHTML = '✕'
  closer.style.cssText = `
    position: absolute; top: 4px; right: 6px;
    background: none; border: none; color: #94a3b8;
    cursor: pointer; font-size: 12px; padding: 0;
  `
  el.appendChild(closer)
  const content = document.createElement('div')
  content.id = '_ol_popup_content'
  el.appendChild(content)

  closer.addEventListener('click', () => {
    _popupOverlay?.setPosition(undefined)
  })
  return el
}

// ===========================================================================
// initMap — inicializa o mapa (singleton)
// ===========================================================================

/**
 * Inicializa o mapa OpenLayers no container fornecido.
 * Idempotente: chamadas repetidas retornam a instância existente.
 *
 * @param {HTMLElement}  container  - Elemento DOM do mapa
 * @param {object}       [opts]
 * @param {[number,number]} [opts.center=[-41.88,-22.75]] - [lng, lat] WGS84
 * @param {number}       [opts.zoom=13]
 * @returns {{ map: ol/Map, nodeSource, linkSource }}
 */
export function initMap(container, opts = {}) {
  if (_map) return { map: _map, nodeSource: _nodeSource, linkSource: _linkSource }
  if (!container) {
    console.error('[OLMap] Container não encontrado.')
    return null
  }

  const {
    center = [-41.88, -22.75],  // [lng, lat]
    zoom   = 13,
  } = opts

  // ── Sources (dados) ──────────────────────────────────────────────────────
  _linkSource = new VectorSource({ wrapX: false })
  _nodeSource = new VectorSource({ wrapX: false })

  // ── Layers ───────────────────────────────────────────────────────────────
  const osmLayer = new TileLayer({
    source: new OSM(),
    zIndex: 0,
  })

  _satLayer = new TileLayer({
    source: new XYZ({
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attributions: 'Esri World Imagery',
      maxZoom: 19,
    }),
    visible: false,
    zIndex: 1,
  })

  _linkLayer = new VectorLayer({
    source:   _linkSource,
    style:    _linkStyleFn,
    zIndex:   2,
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  })

  _nodeLayer = new VectorLayer({
    source:   _nodeSource,
    style:    _nodeStyleFn,
    zIndex:   3,
    // declutter removido: causava sumiço de CTOs ao dar zoom
    // O zIndex nos objetos Style garante ícones acima das labels
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  })

  // ── Popup overlay ────────────────────────────────────────────────────────
  _popupEl = _createPopupEl()
  _popupOverlay = new Overlay({
    element:     _popupEl,
    positioning: 'bottom-center',
    stopEvent:   true,
    autoPan:     { animation: { duration: 250 } },
  })

  // ── Mapa ─────────────────────────────────────────────────────────────────
  _map = new Map({
    target:  container,
    layers:  [osmLayer, _satLayer, _linkLayer, _nodeLayer],
    overlays: [_popupOverlay],
    view: new View({
      center:   fromLonLat(center),
      zoom,
      maxZoom:  20,
      minZoom:  3,
    }),
    controls: defaultControls({ zoom: false, attribution: true }).extend([
      new Zoom({ className: 'ol-zoom-ftth' }),
      new ScaleLine({ units: 'metric' }),
    ]),
  })

  // ── Hover: highlight + cursor ────────────────────────────────────────────
  let _hoveredFeature = null
  _map.on('pointermove', (e) => {
    if (e.dragging) return
    const pixel   = _map.getEventPixel(e.originalEvent)
    const hitNode = _map.hasFeatureAtPixel(pixel, { layerFilter: (l) => l === _nodeLayer })
    const hitLink = !hitNode && _map.hasFeatureAtPixel(pixel, { layerFilter: (l) => l === _linkLayer, hitTolerance: 6 })

    _map.getViewport().style.cursor = (hitNode || hitLink) ? 'pointer' : ''

    _map.forEachFeatureAtPixel(
      pixel,
      (feature) => {
        if (_hoveredFeature && _hoveredFeature !== feature) {
          _hoveredFeature.setStyle(null)  // restaura estilo da layer
        }
        _hoveredFeature = feature
        // Estilo de highlight: anel branco + base
        feature.setStyle(_buildHoverStyle(feature))
        return true  // para na 1ª feature
      },
      { layerFilter: (l) => l === _nodeLayer }
    )

    // Mouse saiu de cima de qualquer feature
    if (!hitNode && _hoveredFeature) {
      _hoveredFeature.setStyle(null)
      _hoveredFeature = null
    }
  })

  // ── Click: popup ou seletor de itens sobrepostos ────────────────────────
  _map.on('click', (e) => {
    // Coleta TODAS as features de nó sob o pixel clicado
    const hitFeatures = []
    _map.forEachFeatureAtPixel(
      e.pixel,
      (feature) => { hitFeatures.push(feature) },
      { layerFilter: (l) => l === _nodeLayer }
    )

    // Se não acertou nenhum nó, verifica se acertou uma rota (linha)
    if (hitFeatures.length === 0) {
      let rotaFeature = null
      _map.forEachFeatureAtPixel(
        e.pixel,
        (feature) => { rotaFeature = feature; return true },
        { layerFilter: (l) => l === _linkLayer, hitTolerance: 6 }
      )
      if (rotaFeature) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('olmap:feature-click', {
            detail: {
              feature:    rotaFeature,
              properties: { ...rotaFeature.getProperties(), _type: 'rota' },
              coordinate: e.coordinate,
            },
          }))
        }
        return
      }

      // Click em área vazia: fecha popup e emite evento de mapa
      _popupOverlay.setPosition(undefined)
      const lonLat = _toLonLat(e.coordinate)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('olmap:map-click', {
          detail: { coordinate: e.coordinate, lngLat: { lng: lonLat[0], lat: lonLat[1] } },
        }))
      }
      return
    }

    if (hitFeatures.length > 1) {
      // Múltiplas features: emite evento de cluster para o React exibir o seletor
      _popupOverlay.setPosition(undefined)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('olmap:cluster-click', {
          detail: {
            features:   hitFeatures,
            properties: hitFeatures.map((f) => f.getProperties()),
            pixel:      e.pixel,   // [x, y] em pixels do viewport
            coordinate: e.coordinate,
          },
        }))
      }
      return
    }

    // Exatamente 1 feature: emite evento — o React (bottom sheet) exibe os detalhes
    const feature = hitFeatures[0]
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('olmap:feature-click', {
        detail: { feature, properties: feature.getProperties(), coordinate: e.coordinate },
      }))
    }
  })

  // ── Animação: CTOs cheias piscam a cada 500ms ────────────────────────────
  _animTimer = setInterval(() => {
    _animBright = !_animBright
    _nodeSource?.changed()
  }, 500)

  return { map: _map, nodeSource: _nodeSource, linkSource: _linkSource }
}

// ===========================================================================
// clearMap — limpa features sem destruir o mapa
// ===========================================================================

/**
 * Remove todos os elementos visuais. O mapa permanece inicializado.
 */
export function clearMap() {
  _nodeSource?.clear()
  _linkSource?.clear()
  _popupOverlay?.setPosition(undefined)
}

// ===========================================================================
// addNode — adiciona UM nó
// ===========================================================================

/**
 * Adiciona uma feature de ponto (CTO, Caixa, Poste, OLT).
 *
 * @param {object}  node
 * @param {number}  node.lat
 * @param {number}  node.lng
 * @param {string}  [node._type='cto']  - 'cto' | 'ce' | 'cdo' | 'poste' | 'olt'
 * @returns {ol/Feature}
 */
export function addNode(node) {
  if (!_nodeSource) {
    console.warn('[OLMap] Chame initMap() antes de addNode()')
    return null
  }
  if (node.lat == null || node.lng == null) return null

  const feature = new Feature({
    geometry: new Point(fromLonLat([node.lng, node.lat])),
    ...node,
  })
  _nodeSource.addFeature(feature)
  return feature
}

// ===========================================================================
// addLink — adiciona UMA linha
// ===========================================================================

/**
 * Adiciona uma feature de linha (rota/cabo).
 *
 * @param {object}           link
 * @param {Array<[lng,lat]>} link.coordinates - Coordenadas [lng, lat] (WGS84)
 * @param {string}           [link.tipo]       - BACKBONE | RAMAL | DROP
 * @returns {ol/Feature}
 */
export function addLink(link) {
  if (!_linkSource) {
    console.warn('[OLMap] Chame initMap() antes de addLink()')
    return null
  }
  const { coordinates = [], ...props } = link
  if (coordinates.length < 2) return null

  const feature = new Feature({
    geometry: new LineString(coordinates.map(([lng, lat]) => fromLonLat([lng, lat]))),
    ...props,
  })
  _linkSource.addFeature(feature)
  return feature
}

// ===========================================================================
// renderNodes — renderiza array de nós com alta performance
// ===========================================================================

/**
 * Renderiza todos os nós de uma vez (batch add — mais eficiente que N addNode).
 * Conecte aqui seus CTOs, Caixas, OLTs, Postes.
 *
 * @param {Array} nodes - Array de objetos com { lat, lng, _type, ... }
 */
export function renderNodes(nodes = []) {
  if (!_nodeSource) {
    console.warn('[OLMap] Chame initMap() antes de renderNodes()')
    return
  }

  const features = nodes
    .filter((n) => n.lat != null && n.lng != null)
    .map((n) => {
      const f = new Feature({
        geometry: new Point(fromLonLat([n.lng, n.lat])),
        ...n,
        // Garante campo pct calculado
        pct: n.pct ?? (n.capacidade > 0 ? (n.ocupacao ?? 0) / n.capacidade : 0),
      })
      return f
    })

  // addFeatures é muito mais eficiente do que N chamadas a addFeature
  _nodeSource.addFeatures(features)
}

// ===========================================================================
// renderLinks — renderiza rotas (aceita GeoJSON ou array simples)
// ===========================================================================

/**
 * Renderiza rotas de fibra.
 * Aceita GeoJSON FeatureCollection (formato do sistema) ou array simples.
 *
 * @param {object|Array} links - GeoJSON FeatureCollection ou array de { coordinates, tipo }
 */
export function renderLinks(links = []) {
  if (!_linkSource) {
    console.warn('[OLMap] Chame initMap() antes de renderLinks()')
    return
  }

  // Aceita GeoJSON FeatureCollection
  if (links?.type === 'FeatureCollection') {
    const features = _geoJSONFormat.readFeatures(links)
    _linkSource.addFeatures(features)
    return
  }

  // Array simples de { coordinates, tipo, ... }
  const arr = Array.isArray(links) ? links : []
  const features = arr
    .filter((l) => l.coordinates?.length >= 2)
    .map((l) => addLink(l))
    .filter(Boolean)
  // já adicionados via addLink
  void features
}

// ===========================================================================
// Controles de camadas
// ===========================================================================

/**
 * Mostra/oculta a camada de satélite (Esri World Imagery).
 * @param {boolean} visible
 */
export function setSatelliteVisible(visible) {
  _satLayer?.setVisible(visible)
}

/**
 * Mostra/oculta a camada de nós.
 * @param {boolean} visible
 */
export function setNodesVisible(visible) {
  _nodeLayer?.setVisible(visible)
}

/**
 * Mostra/oculta a camada de links.
 * @param {boolean} visible
 */
export function setLinksVisible(visible) {
  _linkLayer?.setVisible(visible)
}

/**
 * Aplica toggles de visibilidade granulares por tipo de elemento.
 * Atualiza `_vis` (usado na style function) e força re-render.
 *
 * @param {{ ctos?, caixas?, rotas?, postes?, olts?, satellite? }} toggles
 */
export function setLayerToggles(toggles = {}) {
  if (!_nodeSource) return

  // Atualiza mapa de visibilidade por tipo (usado em _nodeStyleFn)
  if (toggles.ctos    !== undefined) _vis.ctos   = !!toggles.ctos
  if (toggles.caixas  !== undefined) _vis.caixas = !!toggles.caixas
  if (toggles.postes  !== undefined) _vis.postes = !!toggles.postes
  if (toggles.olts    !== undefined) _vis.olts   = !!toggles.olts

  // Força re-render do nodeLayer via invalidação da source
  _nodeSource.changed()

  // Rotas e satélite são layers inteiras — toggle direto
  if (toggles.rotas    !== undefined) _linkLayer?.setVisible(!!toggles.rotas)
  if (toggles.satellite !== undefined) _satLayer?.setVisible(!!toggles.satellite)
}

/**
 * Voa até coordenadas [lng, lat].
 * @param {[number,number]} lonLat - [lng, lat]
 * @param {number}          [zoom]
 * @param {number}          [durationMs=1200]
 */
export function flyTo(lonLat, zoom, durationMs = 1200) {
  if (!_map) return
  _map.getView().animate({
    center:   fromLonLat(lonLat),
    zoom:     zoom ?? _map.getView().getZoom(),
    duration: durationMs,
  })
}

/**
 * Encaixa o viewport em um extent [minLng, minLat, maxLng, maxLat].
 * @param {[number,number,number,number]} extent - WGS84
 * @param {number} [padding=100]
 */
export function fitExtent(extent, padding = 100) {
  if (!_map) return
  const [minLng, minLat, maxLng, maxLat] = extent
  const olExtent = [
    ...fromLonLat([minLng, minLat]),
    ...fromLonLat([maxLng, maxLat]),
  ]
  _map.getView().fit(olExtent, { padding: [padding, padding, padding, padding], duration: 600 })
}

// ===========================================================================
// Getters
// ===========================================================================

export function getMap()        { return _map }
export function getNodeSource() { return _nodeSource }
export function getLinkSource() { return _linkSource }
export function getNodeLayer()  { return _nodeLayer }
export function getLinkLayer()  { return _linkLayer }

// ===========================================================================
// Varinha — preview de rede gerada e desenho de polígono
// ===========================================================================

/**
 * Garante que as layers de preview existem e estão adicionadas ao mapa.
 */
function _ensurePreviewLayers() {
  if (!_map) return

  if (!_polySource) {
    _polySource = new VectorSource({ wrapX: false })
    _polyLayer  = new VectorLayer({ source: _polySource, style: _polygonStyle, zIndex: 18 })
    _map.addLayer(_polyLayer)
  }
  if (!_previewSource) {
    _previewSource = new VectorSource({ wrapX: false })
    _previewLayer  = new VectorLayer({
      source: _previewSource,
      style:  (f) => f.get('_isCTO') ? _autoCTOStyle(f) : _autoRouteStyle(f),
      zIndex: 20,
    })
    _map.addLayer(_previewLayer)
  }
}

/**
 * Renderiza polígono de área (preview enquanto configura a rede).
 * @param {Array<[number,number]>} coords — [lng, lat][]
 */
export function renderPolygonPreview(coords) {
  if (!_map || !coords?.length) return
  _ensurePreviewLayers()
  _polySource.clear()
  if (coords.length >= 3) {
    const ring   = [...coords, coords[0]]
    const olRing = ring.map(([lng, lat]) => fromLonLat([lng, lat]))
    _polySource.addFeature(new Feature({ geometry: new Polygon([olRing]) }))
  }
}

/**
 * Renderiza a rede gerada automaticamente (rotas neon + CTOs cyan).
 * @param {{ routes: Array, ctos: Array }} network
 */
export function renderPreviewNetwork({ routes = [], ctos = [] } = {}) {
  if (!_map) return
  _ensurePreviewLayers()
  _previewSource.clear()

  for (const r of routes) {
    if (!r.coordinates || r.coordinates.length < 2) continue
    const f = new Feature({
      geometry: new LineString(r.coordinates.map(([lng, lat]) => fromLonLat([lng, lat]))),
      tipo:     r.tipo,
      nome:     r.nome,
    })
    _previewSource.addFeature(f)
  }

  for (const c of ctos) {
    if (c.lat == null || c.lng == null) continue
    const f = new Feature({
      geometry: new Point(fromLonLat([c.lng, c.lat])),
      nome:     c.nome,
      _isCTO:   true,
    })
    _previewSource.addFeature(f)
  }
}

/**
 * Limpa o preview (rotas geradas + polígono de área).
 */
export function clearPreview() {
  _previewSource?.clear()
  _polySource?.clear()
}

/**
 * Ativa o modo de desenho de polígono no mapa.
 * @param {function} onComplete — chamada com Array<[lng,lat]> ao fechar o polígono
 */
export function enablePolygonDraw(onComplete) {
  if (!_map) return
  disablePolygonDraw()

  const tmpSource = new VectorSource({ wrapX: false })
  _drawInter = new Draw({
    source: tmpSource,
    type:   'Polygon',
    style:  _drawStyle(),
  })

  _drawInter.on('drawend', (e) => {
    // Obter coordenadas e converter EPSG:3857 → WGS84
    const ring   = e.feature.getGeometry().getCoordinates()[0]
    const lngLats = ring.map(c => _toLonLat(c))
    // Drop last point (OL fecha o anel duplicando o primeiro)
    const open = lngLats.slice(0, -1)
    if (typeof onComplete === 'function') onComplete(open)
  })

  _map.addInteraction(_drawInter)
  _map.getViewport().style.cursor = 'crosshair'
}

/**
 * Desativa o modo de desenho de polígono.
 */
export function disablePolygonDraw() {
  if (_drawInter && _map) {
    try { _map.removeInteraction(_drawInter) } catch (_) {}
    _drawInter = null
    if (_map?.getViewport()) _map.getViewport().style.cursor = ''
  }
}

// ===========================================================================
// destroyMap — cleanup completo (chame no unmount do componente React)
// ===========================================================================

export function destroyMap() {
  if (_animTimer) { clearInterval(_animTimer); _animTimer = null }
  disablePolygonDraw()
  if (_map) {
    if (_previewLayer) try { _map.removeLayer(_previewLayer) } catch (_) {}
    if (_polyLayer)    try { _map.removeLayer(_polyLayer)    } catch (_) {}
    try { _map.setTarget(null) } catch (_) {}
    _map = null
  }
  _nodeSource = _linkSource = _nodeLayer = _linkLayer = _satLayer = null
  _popupEl = _popupOverlay = null
  _previewSource = _previewLayer = _polySource = _polyLayer = null
  _animBright = true
  // Reseta toggles para que o próximo initMap comece com tudo visível
  _vis = { ctos: true, caixas: true, postes: true, olts: true }
}

// ===========================================================================
// Helpers internos
// ===========================================================================

/** Converte coordenada EPSG:3857 → [lng, lat] */
function _toLonLat(coord) {
  // import dinâmico para evitar ciclo (ol/proj já está importado via fromLonLat)
  const x = coord[0] / 20037508.34 * 180
  let   y = coord[1] / 20037508.34 * 180
  y = (180 / Math.PI) * (2 * Math.atan(Math.exp(y * Math.PI / 180)) - Math.PI / 2)
  return [x, y]
}

/** Estilo de hover: anel branco ao redor do ícone base.
 *  Achata o array retornado por _nodeStyleFn antes de adicionar o anel,
 *  evitando array aninhado [[Style,Style], Style] que o OL não processa. */
function _buildHoverStyle(feature) {
  // Obtém resolução atual para que postes sigam a mesma regra de zoom
  const resolution = _map?.getView().getResolution() ?? 1
  const base = _nodeStyleFn(feature, resolution)
  const baseArr = Array.isArray(base) ? base : (base ? [base] : [])

  return [
    ...baseArr,
    new Style({
      image: new CircleStyle({
        radius:  14,
        fill:    new Fill({ color: 'rgba(248,250,252,0)' }),
        stroke:  new Stroke({ color: '#f8fafc', width: 3 }),
      }),
      zIndex: 20,
    }),
  ]
}
