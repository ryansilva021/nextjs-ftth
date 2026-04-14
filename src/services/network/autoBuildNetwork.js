/**
 * src/services/network/autoBuildNetwork.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Orquestra a geração automática de rede FTTH.
 *
 * Modos:
 *   - Modo plano (padrão):  gera apenas CTOs + rotas de infra + MST CTO↔CTO
 *   - Modo camadas (genCDOs=true):
 *       Camada 1 — Backbone:      OLT → CDOs (opcional, se olt fornecida)
 *       Camada 2 — Distribuição:  CDO → CTOs do cluster
 *       Camada 3 — CTOs posicionadas, cada uma atribuída ao CDO mais próximo
 *
 * Fluxo comum:
 *   1. Busca ruas reais do OSM (Overpass API)
 *   2. Usa as geometrias de rua como rotas de infraestrutura
 *   3. Posiciona CTOs ao longo das ruas, priorizando esquinas
 *   4. Snake-sort → numeração sequencial geográfica (CTO-1 ao lado de CTO-2)
 *   5a. [Modo plano]   MST conectando CTOs
 *   5b. [Modo camadas] Clusteriza CTOs → CDOs, backbone + distribuição por CDO
 *   6. Fallback para grade uniforme se a API falhar
 */

import { fetchStreetsInPolygon }                                from './streetFetcher'
import { planCTOsAlongStreets, planCTOs }                      from './ctoPlanner'
import { generateRoutes }                                      from './routeGenerator'
import { planOptimalRoutes, planBackboneRoutes, planDistributionRoutesByCDO } from './routePlanner'
import { planCDOsForCTOs }                                     from './cdoPlanner'

// =============================================================================
// PRINCIPAL
// =============================================================================

/**
 * @param {Array<[number,number]>} polygon
 * @param {object} [opts]
 * @param {number}   [opts.spacingM=120]       — distância entre CTOs (m)
 * @param {number}   [opts.capacidade=16]      — portas por CTO
 * @param {string}   [opts.prefix='CTO']       — prefixo dos IDs de CTO
 * @param {boolean}  [opts.genDistRoutes=true]  — gerar rotas de distribuição
 *
 * — Modo camadas (ativado com genCDOs=true) —
 * @param {boolean}  [opts.genCDOs=false]      — gerar CDOs em camada intermediária
 * @param {number}   [opts.ctosPerCdo=8]       — CTOs por CDO
 * @param {string}   [opts.cdoPrefix='CDO']    — prefixo dos IDs de CDO
 * @param {string}   [opts.oltId=null]         — ID da OLT pai (para link de topologia)
 * @param {number}   [opts.oltLat=null]        — latitude da OLT (para backbone)
 * @param {number}   [opts.oltLng=null]        — longitude da OLT (para backbone)
 *
 * @param {function} [opts.onProgress]         — callback(msg)
 * @returns {Promise<{routes, distRoutes, backboneRoutes, ctos, cdos, polygon, source, metrics}>}
 */
export async function autoBuildNetwork(polygon, opts = {}) {
  if (!polygon || polygon.length < 3) throw new Error('Polígono inválido: mínimo 3 vértices')

  const {
    spacingM      = 120,
    capacidade    = 16,
    prefix        = 'CTO',
    genDistRoutes = true,
    // camadas
    genCDOs       = false,
    ctosPerCdo    = 8,
    cdoPrefix     = 'CDO',
    oltId         = null,
    oltLat        = null,
    oltLng        = null,
    onProgress    = () => {},
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

  let ctos = streets.length > 0
    ? planCTOsAlongStreets(polygon, streets, { spacingM, capacidade, prefix })
    : planCTOs(polygon, { capacidade, prefix })

  if (ctos.length === 0 && infraRoutes.length === 0) {
    throw new Error('Área muito pequena ou sem ruas reconhecidas. Tente uma área maior.')
  }

  // ── 4a. MODO CAMADAS: CDOs + backbone + distribuição por CDO ──────────────
  let cdos           = []
  let backboneRoutes = []
  let distRoutes     = []

  if (genCDOs && ctos.length >= 1) {
    onProgress('Planejando CDOs e agrupando CTOs…')

    const layerResult = planCDOsForCTOs(ctos, streets, {
      ctosPerCdo,
      cdoPrefix,
      oltId: oltId ?? null,
    })
    cdos = layerResult.cdos
    ctos = layerResult.ctos   // CTOs agora têm cdo_id atribuído

    if (genDistRoutes && cdos.length >= 1) {
      onProgress('Calculando rotas de distribuição CDO→CTO…')
      try {
        distRoutes = planDistributionRoutesByCDO(cdos, ctos, streets)
      } catch (err) {
        console.warn('[autoBuildNetwork] Distribuição falhou:', err.message)
      }

      // Backbone OLT→CDO (somente se coordenadas da OLT fornecidas)
      if (oltLat != null && oltLng != null) {
        onProgress('Calculando backbone OLT→CDOs…')
        try {
          backboneRoutes = planBackboneRoutes(
            { lat: oltLat, lng: oltLng, id: oltId ?? 'olt' },
            cdos,
            streets
          )
        } catch (err) {
          console.warn('[autoBuildNetwork] Backbone falhou:', err.message)
        }
      }
    }

  // ── 4b. MODO PLANO: MST CTO↔CTO ──────────────────────────────────────────
  } else if (genDistRoutes && ctos.length >= 2) {
    onProgress('Calculando rotas de distribuição…')
    try {
      distRoutes = planOptimalRoutes(ctos, streets.length > 0 ? streets : [], {})
    } catch (err) {
      console.warn('[autoBuildNetwork] Falha nas rotas de distribuição:', err.message)
    }
  }

  // ── 5. Métricas ───────────────────────────────────────────────────────────
  const allRoutes    = [...infraRoutes, ...backboneRoutes, ...distRoutes]
  const totalLengthM = allRoutes.reduce((s, r) => s + _polylineLen(r.coordinates), 0)
  const distLengthM  = [...backboneRoutes, ...distRoutes].reduce((s, r) => s + _polylineLen(r.coordinates), 0)

  return {
    routes:         infraRoutes,     // rotas de infraestrutura (vias OSM / grade)
    backboneRoutes,                  // backbone OLT→CDOs (modo camadas)
    distRoutes,                      // distribuição CDO→CTOs ou MST CTO↔CTO
    ctos,
    cdos,
    polygon,
    source,
    metrics: {
      totalRoutes:   infraRoutes.length,
      distRoutes:    distRoutes.length,
      backboneRoutes: backboneRoutes.length,
      totalCTOs:     ctos.length,
      totalCDOs:     cdos.length,
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
