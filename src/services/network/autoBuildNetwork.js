/**
 * src/services/network/autoBuildNetwork.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Orquestra a geração automática de rede FTTH.
 *
 * Fluxo:
 *   1. Busca ruas reais do OSM (Overpass API)
 *   2. Usa as geometrias de rua como rotas de infraestrutura
 *   3. Posiciona CTOs ao longo das ruas, priorizando esquinas
 *   4. Aplica snake-sort → numeração sequencial geográfica (CTO-1 ao lado de CTO-2)
 *   5. [Opcional] Gera rotas de distribuição conectando CTOs via MST + Dijkstra
 *   6. Fallback para grade uniforme se a API falhar
 */

import { fetchStreetsInPolygon }             from './streetFetcher'
import { planCTOsAlongStreets, planCTOs }    from './ctoPlanner'
import { generateRoutes }                    from './routeGenerator'
import { planOptimalRoutes, buildStreetGraph } from './routePlanner'

// =============================================================================
// PRINCIPAL
// =============================================================================

/**
 * @param {Array<[number,number]>} polygon
 * @param {object} [opts]
 * @param {number}   [opts.spacingM=120]      — distância entre CTOs (m)
 * @param {number}   [opts.capacidade=16]     — portas por CTO
 * @param {string}   [opts.prefix='CTO']      — prefixo dos IDs
 * @param {boolean}  [opts.genDistRoutes=true] — gerar rotas de distribuição
 * @param {function} [opts.onProgress]         — callback(msg)
 * @returns {Promise<{routes, distRoutes, ctos, polygon, source, metrics}>}
 */
export async function autoBuildNetwork(polygon, opts = {}) {
  if (!polygon || polygon.length < 3) throw new Error('Polígono inválido: mínimo 3 vértices')

  const {
    spacingM       = 120,
    capacidade     = 16,
    prefix         = 'CTO',
    genDistRoutes  = true,
    onProgress     = () => {},
  } = opts

  onProgress('Buscando ruas no OpenStreetMap…')

  // ── 1. Buscar ruas do OSM ─────────────────────────────────────────────────
  let streets = []
  let source  = 'osm'

  try {
    streets = await fetchStreetsInPolygon(polygon)
  } catch (err) {
    console.warn('[autoBuildNetwork] Overpass falhou, usando grade:', err.message)
    source = 'grid'
  }

  // ── 2. Rotas de infraestrutura (vias OSM ou grade geométrica) ─────────────
  let infraRoutes

  if (streets.length > 0) {
    onProgress(`${streets.length} ruas encontradas — posicionando CTOs…`)
    infraRoutes = streets.map((s, i) => ({
      rota_id:     `OSM-${s.osm_id ?? i}`,
      nome:        s.name ?? `Rua ${i + 1}`,
      tipo:        s.tipo,
      coordinates: s.coordinates,
    }))
  } else {
    onProgress('Sem ruas encontradas — usando grade automática…')
    infraRoutes = generateRoutes(polygon, opts)
    source = 'grid'
  }

  // ── 3. Posicionamento de CTOs ─────────────────────────────────────────────
  onProgress('Calculando posições das CTOs…')

  const ctos = streets.length > 0
    ? planCTOsAlongStreets(polygon, streets, { spacingM, capacidade, prefix })
    : planCTOs(polygon, { capacidade, prefix })

  if (ctos.length === 0 && infraRoutes.length === 0) {
    throw new Error('Área muito pequena ou sem ruas reconhecidas. Tente uma área maior.')
  }

  // ── 4. Rotas de distribuição (MST + Dijkstra entre CTOs) ──────────────────
  let distRoutes = []

  if (genDistRoutes && ctos.length >= 2) {
    onProgress('Calculando rotas de distribuição…')
    try {
      distRoutes = planOptimalRoutes(ctos, streets.length > 0 ? streets : [], {})
    } catch (err) {
      console.warn('[autoBuildNetwork] Falha nas rotas de distribuição:', err.message)
    }
  }

  // ── 5. Métricas ───────────────────────────────────────────────────────────
  const allRoutes     = [...infraRoutes, ...distRoutes]
  const totalLengthM  = allRoutes.reduce((s, r) => s + _polylineLen(r.coordinates), 0)
  const distLengthM   = distRoutes.reduce((s, r) => s + _polylineLen(r.coordinates), 0)

  return {
    routes:      infraRoutes,   // rotas de infraestrutura (vias OSM / grade)
    distRoutes,                 // rotas de distribuição (MST entre CTOs)
    ctos,
    polygon,
    source,
    metrics: {
      totalRoutes:   infraRoutes.length,
      distRoutes:    distRoutes.length,
      totalCTOs:     ctos.length,
      totalLengthM:  Math.round(totalLengthM),
      distLengthM:   Math.round(distLengthM),
      totalClients:  ctos.length * capacidade,
    },
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function _polylineLen(coords = []) {
  let len = 0
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1]
    const [lng2, lat2] = coords[i]
    const dlat = (lat2 - lat1) * 111000
    const dlng = (lng2 - lng1) * 111000 * Math.cos(lat1 * Math.PI / 180)
    len += Math.sqrt(dlat * dlat + dlng * dlng)
  }
  return len
}
