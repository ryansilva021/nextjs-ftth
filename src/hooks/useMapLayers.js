'use client'

import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// Helpers: geração de ícones via canvas 2D
// ---------------------------------------------------------------------------

/**
 * Ícone "X" para CTO, colorido por ocupação.
 *
 * @param {string} color - cor CSS (hex)
 * @param {number} [size=40] - lado do canvas em pixels
 * @returns {ImageData}
 */
function createCTOIcon(color = '#16a34a', size = 32) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  // Dark outline for contrast
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = size * 0.30
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(size * 0.2, size * 0.2)
  ctx.lineTo(size * 0.8, size * 0.8)
  ctx.moveTo(size * 0.8, size * 0.2)
  ctx.lineTo(size * 0.2, size * 0.8)
  ctx.stroke()
  // Colored X on top
  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.18
  ctx.beginPath()
  ctx.moveTo(size * 0.2, size * 0.2)
  ctx.lineTo(size * 0.8, size * 0.8)
  ctx.moveTo(size * 0.8, size * 0.2)
  ctx.lineTo(size * 0.2, size * 0.8)
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

/**
 * Ícone quadrado preenchido para Caixa de Emenda (CE).
 *
 * @param {string} color
 * @param {number} [size=36]
 * @returns {ImageData}
 */
function createCEIcon(color = '#1d4ed8', size = 28) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const pad = size * 0.12
  // Black shadow/border
  ctx.fillStyle = '#000000'
  ctx.fillRect(pad - 2, pad - 2, size - pad * 2 + 4, size - pad * 2 + 4)
  // Main fill
  ctx.fillStyle = color
  ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2)
  // Inner highlight lines
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(pad + 4, pad + 4, size - pad * 2 - 8, size - pad * 2 - 8)
  return ctx.getImageData(0, 0, size, size)
}

/**
 * Ícone triângulo preenchido para CDO.
 *
 * @param {string} color
 * @param {number} [size=36]
 * @returns {ImageData}
 */
function createCDOIcon(color = '#7c3aed', size = 28) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  const top = size * 0.08
  const bottom = size * 0.92
  const left = size * 0.04
  const right = size * 0.96
  // Black shadow triangle
  ctx.beginPath()
  ctx.moveTo(cx, top - 2)
  ctx.lineTo(right + 2, bottom + 1)
  ctx.lineTo(left - 2, bottom + 1)
  ctx.closePath()
  ctx.fillStyle = '#000000'
  ctx.fill()
  // Main triangle
  ctx.beginPath()
  ctx.moveTo(cx, top)
  ctx.lineTo(right, bottom)
  ctx.lineTo(left, bottom)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  // Inner highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx, top + 5)
  ctx.lineTo(right - 5, bottom - 4)
  ctx.lineTo(left + 5, bottom - 4)
  ctx.closePath()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

/**
 * Ícone círculo para Poste.
 *
 * @param {string} color
 * @param {number} [size=24]
 * @returns {ImageData}
 */
function createPosteIcon(color = '#94a3b8', size = 24) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const r = size * 0.35
  ctx.fillStyle = color
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = size * 0.1
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

/**
 * Ícone diamante para OLT.
 */
function createOLTIcon(color = '#0891b2', size = 32) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2, cy = size / 2
  const r = size * 0.42
  // Shadow diamond
  ctx.beginPath()
  ctx.moveTo(cx, cy - r - 2)
  ctx.lineTo(cx + r + 2, cy)
  ctx.lineTo(cx, cy + r + 2)
  ctx.lineTo(cx - r - 2, cy)
  ctx.closePath()
  ctx.fillStyle = '#000000'
  ctx.fill()
  // Main diamond
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx + r, cy)
  ctx.lineTo(cx, cy + r)
  ctx.lineTo(cx - r, cy)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  // Highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1.5
  const ri = r * 0.65
  ctx.beginPath()
  ctx.moveTo(cx, cy - ri)
  ctx.lineTo(cx + ri, cy)
  ctx.lineTo(cx, cy + ri)
  ctx.lineTo(cx - ri, cy)
  ctx.closePath()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

// ---------------------------------------------------------------------------
// Conversores: dados do backend → GeoJSON FeatureCollection
// ---------------------------------------------------------------------------

function ctosToGeoJSON(ctos = []) {
  return {
    type: 'FeatureCollection',
    features: ctos.map((cto) => ({
      type: 'Feature',
      id: cto.cto_id,
      geometry: {
        type: 'Point',
        coordinates: [cto.lng, cto.lat],
      },
      properties: {
        ...cto,
        pct: cto.capacidade > 0 ? cto.ocupacao / cto.capacidade : 0,
      },
    })),
  }
}

function caixasToGeoJSON(caixas = []) {
  return {
    type: 'FeatureCollection',
    features: caixas.map((c) => ({
      type: 'Feature',
      id: c.ce_id,
      geometry: {
        type: 'Point',
        coordinates: [c.lng, c.lat],
      },
      properties: { ...c },
    })),
  }
}

function postesToGeoJSON(postes = []) {
  return {
    type: 'FeatureCollection',
    features: postes.map((p) => ({
      type: 'Feature',
      id: p.poste_id,
      geometry: {
        type: 'Point',
        coordinates: [p.lng, p.lat],
      },
      properties: { ...p },
    })),
  }
}

function oltsToGeoJSON(olts = []) {
  return {
    type: 'FeatureCollection',
    features: olts.filter(o => o.lat != null && o.lng != null).map((o) => ({
      type: 'Feature',
      id: o.id,
      geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
      properties: { ...o, _type: 'olt' },
    })),
  }
}

// ---------------------------------------------------------------------------
// Constantes de IDs
// ---------------------------------------------------------------------------

const SATELLITE_SOURCE = 'esri-satellite'
const SATELLITE_LAYER  = 'satellite-layer'
const SOURCES = ['ctos', 'caixas', 'rotas', 'postes', 'olts']
const LAYERS  = [
  'postes-layer',
  'rotas-layer',
  'rotas-layer-drop',
  'ctos-layer',
  'caixas-ce-layer',
  'caixas-cdo-layer',
  'olts-layer',
]

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

/**
 * Gerencia todas as sources e layers do mapa FTTH.
 *
 * @param {maplibregl.Map | null} map
 * @param {boolean} mapLoaded
 * @param {{ ctos: Array, caixas: Array, rotas: Object, postes: Array }} data
 * @param {{ ctos: boolean, caixas: boolean, rotas: boolean, postes: boolean, satellite: boolean }} layerToggles
 */
export function useMapLayers(map, mapLoaded, data, layerToggles, darkMode = true) {
  const { ctos = [], caixas = [], rotas = null, postes = [], olts = [] } = data ?? {}
  const layersReady = useRef(false)
  // Mapa sempre claro (positron) — labels sempre escuros, halos brancos
  const haloColor = '#ffffff'

  // ---------- Setup inicial das sources + layers ----------
  useEffect(() => {
    if (!map || !mapLoaded) return

    // Registrar ícones
    map.addImage('cto-green',  createCTOIcon('#16a34a'))
    map.addImage('cto-yellow', createCTOIcon('#ca8a04'))
    map.addImage('cto-red',    createCTOIcon('#dc2626'))
    map.addImage('ce-icon',    createCEIcon('#1d4ed8'))
    map.addImage('cdo-icon',   createCDOIcon('#7c3aed'))
    map.addImage('poste-icon', createPosteIcon('#94a3b8'))
    map.addImage('olt-icon',   createOLTIcon('#0891b2'))

    // Fonte satélite (Esri)
    map.addSource(SATELLITE_SOURCE, {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Esri World Imagery',
    })
    // Satellite layer — inserido abaixo de todos os layers do estilo vetorial
    // para que labels e estradas apareçam sobre a imagem de satélite
    const firstLayerId = map.getStyle()?.layers?.[0]?.id
    map.addLayer({
      id: SATELLITE_LAYER,
      type: 'raster',
      source: SATELLITE_SOURCE,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 1 },
    }, firstLayerId)

    // Source + layer: Postes
    map.addSource('postes', {
      type: 'geojson',
      data: postesToGeoJSON(postes),
    })
    map.addLayer({
      id: 'postes-layer',
      type: 'symbol',
      source: 'postes',
      layout: {
        'icon-image': 'poste-icon',
        'icon-size': 0.9,
        'icon-allow-overlap': false,
        'text-field': ['get', 'poste_id'],
        'text-size': 9,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-optional': true,
        'text-font': ['Noto Sans Regular'],
      },
      paint: {
        'text-color': '#475569',
        'text-halo-color': haloColor,
        'text-halo-width': 1.5,
      },
    })

    // Source + layer: Rotas de fibra
    map.addSource('rotas', {
      type: 'geojson',
      data: rotas ?? { type: 'FeatureCollection', features: [] },
    })
    // Rotas não-DROP (sem dasharray)
    map.addLayer({
      id: 'rotas-layer',
      type: 'line',
      source: 'rotas',
      filter: ['!=', ['get', 'tipo'], 'DROP'],
      paint: {
        'line-color': [
          'match', ['get', 'tipo'],
          'BACKBONE', '#6366f1',
          'RAMAL',    '#000000',
          '#94a3b8',
        ],
        'line-width': [
          'match', ['get', 'tipo'],
          'BACKBONE', 9,
          'RAMAL',    4,
          2,
        ],
      },
    })
    // Rotas DROP (tracejadas)
    map.addLayer({
      id: 'rotas-layer-drop',
      type: 'line',
      source: 'rotas',
      filter: ['==', ['get', 'tipo'], 'DROP'],
      paint: {
        'line-color': '#22c55e',
        'line-width': 1.5,
        'line-dasharray': [2, 2],
      },
    })

    // Source + layer: CTOs
    map.addSource('ctos', {
      type: 'geojson',
      data: ctosToGeoJSON(ctos),
    })
    map.addLayer({
      id: 'ctos-layer',
      type: 'symbol',
      source: 'ctos',
      layout: {
        'icon-image': [
          'case',
          ['>=', ['get', 'pct'], 0.9], 'cto-red',
          ['>=', ['get', 'pct'], 0.7], 'cto-yellow',
          'cto-green',
        ],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.45, 14, 0.65, 17, 0.85],
        'icon-allow-overlap': true,
        'text-field': ['get', 'cto_id'],
        'text-size': 10,
        'text-offset': [0, 1.6],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-optional': true,
        'text-font': ['Noto Sans Regular'],
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': haloColor,
        'text-halo-width': 1.5,
      },
    })

    // Source + layers: Caixas CE / CDO (mesma source, layers distintos por tipo)
    map.addSource('caixas', {
      type: 'geojson',
      data: caixasToGeoJSON(caixas),
    })
    map.addLayer({
      id: 'caixas-ce-layer',
      type: 'symbol',
      source: 'caixas',
      filter: ['==', ['get', 'tipo'], 'CE'],
      layout: {
        'icon-image': 'ce-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 14, 0.7, 17, 0.9],
        'icon-allow-overlap': true,
        'text-field': ['coalesce', ['get', 'nome'], ['get', 'id']],
        'text-size': 10,
        'text-offset': [0, 1.6],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-optional': true,
        'text-font': ['Noto Sans Regular'],
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': haloColor,
        'text-halo-width': 1.5,
      },
    })
    map.addLayer({
      id: 'caixas-cdo-layer',
      type: 'symbol',
      source: 'caixas',
      filter: ['!=', ['get', 'tipo'], 'CE'],
      layout: {
        'icon-image': 'cdo-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 14, 0.7, 17, 0.9],
        'icon-allow-overlap': true,
        'text-field': ['coalesce', ['get', 'nome'], ['get', 'id']],
        'text-size': 10,
        'text-offset': [0, 1.6],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-optional': true,
        'text-font': ['Noto Sans Regular'],
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': haloColor,
        'text-halo-width': 1.5,
      },
    })

    // Source + layer: OLTs
    map.addSource('olts', {
      type: 'geojson',
      data: oltsToGeoJSON(olts),
    })
    map.addLayer({
      id: 'olts-layer',
      type: 'symbol',
      source: 'olts',
      layout: {
        'icon-image': 'olt-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 0.9, 17, 1.1],
        'icon-allow-overlap': true,
        'text-field': ['coalesce', ['get', 'nome'], ['get', 'id']],
        'text-size': 11,
        'text-offset': [0, 1.8],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-optional': true,
        'text-font': ['Noto Sans Regular'],
      },
      paint: {
        'text-color': '#0369a1',
        'text-halo-color': haloColor,
        'text-halo-width': 2,
      },
    })

    layersReady.current = true

    return () => {
      // Cleanup: remover layers + sources + imagens ao desmontar
      if (!map || !map.loaded()) return
      try {
        LAYERS.forEach((id)  => { if (map.getLayer(id))   map.removeLayer(id) })
        if (map.getLayer(SATELLITE_LAYER))  map.removeLayer(SATELLITE_LAYER)
        SOURCES.forEach((id) => { if (map.getSource(id))  map.removeSource(id) })
        if (map.getSource(SATELLITE_SOURCE)) map.removeSource(SATELLITE_SOURCE)
        ;['cto-green','cto-yellow','cto-red','ce-icon','cdo-icon','poste-icon','olt-icon'].forEach(
          (name) => { if (map.hasImage(name)) map.removeImage(name) }
        )
      } catch (_) {
        // O mapa pode já ter sido destruído; ignorar erros de cleanup
      }
      layersReady.current = false
    }
    // Intencionalmente sem deps de data — os dados são atualizados no effect abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapLoaded])

  // ---------- Atualização de dados ----------
  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return
    const src = map.getSource('ctos')
    if (src) src.setData(ctosToGeoJSON(ctos))
  }, [map, mapLoaded, ctos])

  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return
    const src = map.getSource('caixas')
    if (src) src.setData(caixasToGeoJSON(caixas))
  }, [map, mapLoaded, caixas])

  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return
    const src = map.getSource('rotas')
    if (src) src.setData(rotas ?? { type: 'FeatureCollection', features: [] })
  }, [map, mapLoaded, rotas])

  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return
    const src = map.getSource('postes')
    if (src) src.setData(postesToGeoJSON(postes))
  }, [map, mapLoaded, postes])

  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return
    const src = map.getSource('olts')
    if (src) src.setData(oltsToGeoJSON(olts))
  }, [map, mapLoaded, olts])

  // ---------- Visibilidade das layers ----------
  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return

    const setVis = (layerId, visible) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
      }
    }

    const satelliteOn = layerToggles?.satellite === true
    setVis(SATELLITE_LAYER, satelliteOn)
    setVis('ctos-layer',       layerToggles?.ctos      !== false)
    setVis('caixas-ce-layer',  layerToggles?.caixas    !== false)
    setVis('caixas-cdo-layer', layerToggles?.caixas    !== false)
    setVis('rotas-layer',      layerToggles?.rotas     !== false)
    setVis('rotas-layer-drop', layerToggles?.rotas     !== false)
    setVis('postes-layer',     layerToggles?.postes    !== false)
    setVis('olts-layer',       layerToggles?.olts      !== false)
  }, [map, mapLoaded, layerToggles])
}
