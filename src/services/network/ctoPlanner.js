/**
 * src/services/network/ctoPlanner.js
 * ────────────────────────────────────────────────────────────────────────────
 * Calcula posições de CTOs.
 *
 * Modo principal: planCTOsAlongStreets
 *   Caminha ao longo das geometrias reais de ruas (OSM) e posiciona
 *   uma CTO a cada `spacingM` metros, priorizando esquinas.
 *
 * Modo fallback: planCTOs (grade uniforme)
 *   Usado quando não há dados de ruas disponíveis.
 */

import { pointInPolygon, getBBox } from './routeGenerator'

// ===========================================================================
// MODO PRINCIPAL — posicionamento ao longo das ruas
// ===========================================================================

/**
 * Posiciona CTOs ao longo das ruas fornecidas.
 *
 * Algoritmo:
 *   1. Constrói um mapa de nós OSM → quantas ruas passam por ele (intersecções)
 *   2. Caminha cada rua; a cada `spacingM` metros coloca uma CTO
 *   3. Prioriza esquinas (nós compartilhados por 2+ vias)
 *   4. Ignora posições fora do polígono ou muito próximas de CTOs já colocadas
 *
 * @param {Array<[number,number]>} polygon   — polígono de área [lng, lat]
 * @param {Array}                  streets   — retorno de fetchStreetsInPolygon
 * @param {object}                 [opts]
 * @param {number}  [opts.spacingM=120]  — distância mínima entre CTOs (metros)
 * @param {number}  [opts.capacidade=16] — portas por CTO
 * @param {string}  [opts.prefix='CTO']  — prefixo do ID
 * @returns {Array<{cto_id, nome, lat, lng, capacidade, status, rua}>}
 */
export function planCTOsAlongStreets(polygon, streets, opts = {}) {
  const { spacingM = 120, capacidade = 16, prefix = 'CTO' } = opts

  if (!streets?.length) return []

  // Mínima distância em graus para o filtro "muito perto"
  // 0.7 × spacing para permitir pequena variação nas esquinas
  const minDistDeg = (spacingM * 0.7) / 111000

  const ctos   = []
  const placed = []   // [[lng, lat]] das CTOs já colocadas
  let   idx    = 1

  // ── 1. Mapa de intersecções: nó → número de ruas que passam por ele ───────
  // Nó = coordenada arredondada para 5 casas decimais (~1m)
  const nodeCount = new Map()
  for (const street of streets) {
    for (let i = 0; i < street.coordinates.length; i++) {
      const key = _nodeKey(street.coordinates[i])
      nodeCount.set(key, (nodeCount.get(key) ?? 0) + 1)
    }
  }

  // ── 2. Primeiro passe: colocar CTOs nas intersecções ─────────────────────
  for (const [key, count] of nodeCount.entries()) {
    if (count < 2) continue  // não é intersecção
    const [lng, lat] = key.split(',').map(Number)
    if (!pointInPolygon([lng, lat], polygon)) continue
    if (_tooClose(lng, lat, placed, minDistDeg)) continue
    ctos.push(_makeCTO(prefix, idx++, lat, lng, capacidade, null))
    placed.push([lng, lat])
  }

  // ── 3. Segundo passe: colocar CTOs ao longo das ruas (mid-block) ─────────
  for (const street of streets) {
    const pts = street.coordinates
    if (pts.length < 2) continue

    // distância acumulada desde a última CTO posicionada nesta rua
    // Começa em metade do espaçamento para distribuição uniforme
    let distFromLast = spacingM / 2

    for (let i = 1; i < pts.length; i++) {
      const [lng1, lat1] = pts[i - 1]
      const [lng2, lat2] = pts[i]

      const segLen = _segLenM(lng1, lat1, lng2, lat2)
      if (segLen < 0.1) continue

      let consumed = 0

      // Percorre o segmento colocando CTOs a cada `spacingM`
      while (consumed + (spacingM - distFromLast) <= segLen + 0.01) {
        consumed += spacingM - distFromLast
        const t   = Math.min(consumed / segLen, 1)
        const lng = lng1 + (lng2 - lng1) * t
        const lat = lat1 + (lat2 - lat1) * t

        if (pointInPolygon([lng, lat], polygon) && !_tooClose(lng, lat, placed, minDistDeg)) {
          ctos.push(_makeCTO(prefix, idx++, lat, lng, capacidade, street.name))
          placed.push([lng, lat])
        }
        distFromLast = 0
      }

      // Distância restante do segmento após a última CTO colocada
      distFromLast += segLen - consumed
    }
  }

  // Reordena em snake scan para numeração sequencial geográfica
  return snakeOrderCTOs(ctos, prefix, capacidade)
}

// ===========================================================================
// ORDENAÇÃO ESPACIAL — snake scan (numeração sequencial geográfica)
// ===========================================================================

/**
 * Reordena e renumera as CTOs em varredura "snake" (zigue-zague por linhas
 * de latitude), garantindo que números consecutivos fiquem próximos no mapa.
 *
 * Lógica:
 *   - Divide o espaço em faixas horizontais de ~150 m
 *   - Dentro de cada faixa: ordena de W→E nas faixas pares, E→W nas ímpares
 *   - Reaplica o prefix e renumera 1..N em ordem
 *
 * @param {Array} ctos
 * @param {string} prefix
 * @param {number} capacidade
 * @returns {Array}
 */
export function snakeOrderCTOs(ctos, prefix, capacidade) {
  if (ctos.length === 0) return []

  const BAND_DEG = 150 / 111000   // ~150 m em graus

  const maxLat = Math.max(...ctos.map(c => c.lat))

  const sorted = [...ctos].sort((a, b) => {
    const rowA = Math.floor((maxLat - a.lat) / BAND_DEG)
    const rowB = Math.floor((maxLat - b.lat) / BAND_DEG)
    if (rowA !== rowB) return rowA - rowB
    // Alterna direção em faixas pares/ímpares
    return rowA % 2 === 0 ? a.lng - b.lng : b.lng - a.lng
  })

  return sorted.map((cto, i) => {
    const idx    = i + 1
    const pad    = String(idx).padStart(2, '0')
    const cto_id = `${prefix}-${pad}`
    return { ...cto, cto_id, nome: cto_id, capacidade: capacidade ?? cto.capacidade }
  })
}

// ===========================================================================
// MODO FALLBACK — grade uniforme (sem dados de ruas)
// ===========================================================================

/**
 * Gera CTOs distribuídas em grade dentro do polígono.
 * Usado como fallback quando não há dados OSM.
 *
 * @param {Array<[number,number]>} polygon
 * @param {object} [opts]
 * @returns {Array}
 */
export function planCTOs(polygon, opts = {}) {
  const { capacidade = 16, prefix = 'CTO' } = opts

  const bbox   = getBBox(polygon)
  const midLat = (bbox.minLat + bbox.maxLat) / 2
  const latM   = (bbox.maxLat - bbox.minLat) * 111000
  const lngM   = (bbox.maxLng - bbox.minLng) * 111000 * Math.cos(midLat * Math.PI / 180)
  const step   = opts.gridStep ?? (Math.max(80, Math.min(400, Math.min(latM, lngM) / 5)) / 111000)

  const ctos = []
  let idx = 1

  for (let lat = bbox.minLat + step / 2; lat < bbox.maxLat; lat += step) {
    for (let lng = bbox.minLng + step / 2; lng < bbox.maxLng; lng += step) {
      if (pointInPolygon([lng, lat], polygon)) {
        ctos.push(_makeCTO(prefix, idx++, lat, lng, capacidade, null))
      }
    }
  }
  return snakeOrderCTOs(ctos, prefix, capacidade)
}

// ===========================================================================
// HELPERS INTERNOS
// ===========================================================================

function _nodeKey([lng, lat]) {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`
}

function _segLenM(lng1, lat1, lng2, lat2) {
  const dlat = (lat2 - lat1) * 111000
  const dlng = (lng2 - lng1) * 111000 * Math.cos(lat1 * Math.PI / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

function _tooClose(lng, lat, placed, minDistDeg) {
  for (const [plng, plat] of placed) {
    const dx = lng - plng, dy = lat - plat
    if (Math.sqrt(dx * dx + dy * dy) < minDistDeg) return true
  }
  return false
}

function _makeCTO(prefix, idx, lat, lng, capacidade, rua) {
  const pad    = String(idx).padStart(2, '0')
  const cto_id = `${prefix}-${pad}`
  return {
    cto_id,
    nome: cto_id,
    lat:  parseFloat(lat.toFixed(7)),
    lng:  parseFloat(lng.toFixed(7)),
    capacidade,
    status: 'ativo',
    rua:  rua ?? null,
  }
}
