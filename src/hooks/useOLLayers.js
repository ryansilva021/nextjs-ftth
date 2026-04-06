'use client'

/**
 * useOLLayers — gerencia features (nós e links) no mapa OpenLayers
 * -----------------------------------------------------------------
 * Drop-in para useLeafletLayers.
 * Mesma assinatura: useOLLayers(map, mapLoaded, data, layerToggles, callbacks)
 *
 * Troca em MapaFTTH.js:
 *   - import { useLeafletLayers } from '@/hooks/useLeafletLayers'
 *   + import { useOLLayers }      from '@/hooks/useOLLayers'
 */

import { useEffect, useRef } from 'react'
import Feature   from 'ol/Feature'
import Point     from 'ol/geom/Point'
import GeoJSON   from 'ol/format/GeoJSON'
import { fromLonLat } from 'ol/proj'
import {
  getNodeSource,
  getLinkSource,
  setLayerToggles,
} from '@/lib/olMap'

// GeoJSON reader (reutilizado para performance)
const _geoJSONFmt = new GeoJSON({
  featureProjection: 'EPSG:3857',
  dataProjection:    'EPSG:4326',
})

/** Calcula pct de ocupação */
function _pct(node) {
  return node.pct ?? (node.capacidade > 0 ? (node.ocupacao ?? 0) / node.capacidade : 0)
}

/** Converte array de CTOs em ol/Feature[] */
function _ctosToFeatures(ctos = []) {
  return ctos
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => new Feature({
      geometry: new Point(fromLonLat([c.lng, c.lat])),
      _type:    'cto',
      ...c,
      pct: _pct(c),
    }))
}

/** Converte array de Caixas em ol/Feature[] */
function _caixasToFeatures(caixas = []) {
  return caixas
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => new Feature({
      geometry: new Point(fromLonLat([c.lng, c.lat])),
      _type:    c.tipo === 'CE' ? 'ce' : 'cdo',
      ...c,
    }))
}

/** Converte array de Postes em ol/Feature[] */
function _postesToFeatures(postes = []) {
  return postes
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => new Feature({
      geometry: new Point(fromLonLat([p.lng, p.lat])),
      _type:    'poste',
      ...p,
    }))
}

/** Converte array de OLTs em ol/Feature[] */
function _oltsToFeatures(olts = []) {
  return olts
    .filter((o) => o.lat != null && o.lng != null)
    .map((o) => new Feature({
      geometry: new Point(fromLonLat([o.lng, o.lat])),
      _type:    'olt',
      ...o,
    }))
}

// ---------------------------------------------------------------------------

/** Cor e ícone por _type para o spread panel */
const _typeStyle = {
  cto:   { cor: '#22c55e', icone: '📦' },
  ce:    { cor: '#3b82f6', icone: '📡' },
  cdo:   { cor: '#a855f7', icone: '📡' },
  poste: { cor: '#64748b', icone: '🪝' },
  olt:   { cor: '#06b6d4', icone: '🖥' },
}

/**
 * @param {ol/Map|null}   map
 * @param {boolean}       mapLoaded
 * @param {{ ctos, caixas, rotas, postes, olts }} data
 * @param {{ ctos, caixas, rotas, postes, olts, satellite }} layerToggles
 * @param {{ onClickCTO, onClickCaixa, onClickPoste, onClickOLT, onClusterClick }} [callbacks]
 */
export function useOLLayers(map, mapLoaded, data, layerToggles, callbacks = {}) {
  const { ctos = [], caixas = [], rotas = null, postes = [], olts = [] } = data ?? {}
  const callbacksRef = useRef(callbacks)
  useEffect(() => { callbacksRef.current = callbacks }, [callbacks])

  // ── Feature click único → callback por tipo ────────────────────────────
  useEffect(() => {
    if (!map || !mapLoaded) return

    function handleFeatureClick(e) {
      const { properties } = e.detail
      const type = properties._type ?? 'cto'
      if (type === 'cto')   callbacksRef.current?.onClickCTO?.(properties)
      if (type === 'ce' || type === 'cdo') callbacksRef.current?.onClickCaixa?.(properties)
      if (type === 'poste') callbacksRef.current?.onClickPoste?.(properties)
      if (type === 'olt')   callbacksRef.current?.onClickOLT?.(properties)
      if (type === 'rota')  callbacksRef.current?.onClickRota?.(properties)
    }

    window.addEventListener('olmap:feature-click', handleFeatureClick)
    return () => window.removeEventListener('olmap:feature-click', handleFeatureClick)
  }, [map, mapLoaded])

  // ── Cluster click (itens sobrepostos) → spread panel ──────────────────
  useEffect(() => {
    if (!map || !mapLoaded) return

    function handleClusterClick(e) {
      const { properties, pixel } = e.detail
      const items = properties.map((props) => {
        const type  = props._type ?? 'cto'
        const ts    = _typeStyle[type] ?? { cor: '#94a3b8', icone: '📍' }
        const nome  = props.nome ?? props.cto_id ?? props.ce_id ?? props.id ?? type.toUpperCase()
        // Mapeia type para o formato esperado pelo handleElementClick em MapaFTTH
        const itemType = (type === 'ce' || type === 'cdo') ? 'caixa' : type
        return { type: itemType, data: props, nome, cor: ts.cor, icone: ts.icone }
      })
      callbacksRef.current?.onClusterClick?.(items, { x: pixel[0], y: pixel[1] })
    }

    window.addEventListener('olmap:cluster-click', handleClusterClick)
    return () => window.removeEventListener('olmap:cluster-click', handleClusterClick)
  }, [map, mapLoaded])

  // ── CTOs ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const src = getNodeSource()
    if (!src || !mapLoaded) return
    // Remove apenas CTOs existentes (mantém outros tipos)
    src.getFeatures()
      .filter((f) => f.get('_type') === 'cto')
      .forEach((f) => src.removeFeature(f))
    src.addFeatures(_ctosToFeatures(ctos))
  }, [mapLoaded, ctos])

  // ── Caixas ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const src = getNodeSource()
    if (!src || !mapLoaded) return
    src.getFeatures()
      .filter((f) => f.get('_type') === 'ce' || f.get('_type') === 'cdo')
      .forEach((f) => src.removeFeature(f))
    src.addFeatures(_caixasToFeatures(caixas))
  }, [mapLoaded, caixas])

  // ── Postes ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const src = getNodeSource()
    if (!src || !mapLoaded) return
    src.getFeatures()
      .filter((f) => f.get('_type') === 'poste')
      .forEach((f) => src.removeFeature(f))
    src.addFeatures(_postesToFeatures(postes))
  }, [mapLoaded, postes])

  // ── OLTs ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const src = getNodeSource()
    if (!src || !mapLoaded) return
    src.getFeatures()
      .filter((f) => f.get('_type') === 'olt')
      .forEach((f) => src.removeFeature(f))
    src.addFeatures(_oltsToFeatures(olts))
  }, [mapLoaded, olts])

  // ── Rotas (GeoJSON FeatureCollection) ───────────────────────────────────
  useEffect(() => {
    const src = getLinkSource()
    if (!src || !mapLoaded) return
    src.clear()
    if (!rotas?.features?.length) return
    const features = _geoJSONFmt.readFeatures(rotas)
    src.addFeatures(features)
  }, [mapLoaded, rotas])

  // ── Toggle de visibilidade granular por tipo ─────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return
    setLayerToggles({
      ctos:      layerToggles?.ctos      !== false,
      caixas:    layerToggles?.caixas    !== false,
      postes:    layerToggles?.postes    !== false,
      olts:      layerToggles?.olts      !== false,
      rotas:     layerToggles?.rotas     !== false,
      satellite: layerToggles?.satellite === true,
    })
  }, [mapLoaded, layerToggles])
}
