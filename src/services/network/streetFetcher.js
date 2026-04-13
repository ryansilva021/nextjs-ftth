/**
 * src/services/network/streetFetcher.js
 * ────────────────────────────────────────────────────────────────────────────
 * Busca ruas do OpenStreetMap via Overpass API dentro de um polígono.
 * Apenas client-side — sem imports de servidor.
 *
 * Mapeamento de tipos OSM → tipo de rota FiberOps:
 *   primary / secondary / trunk          → BACKBONE
 *   tertiary / residential / unclassified
 *   service / living_street / road       → RAMAL
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const FETCH_TIMEOUT_MS = 20000

// Tipos de via que queremos (FTTH urbano — inclui ruelas e passagens)
const HIGHWAY_FILTER =
  'primary|primary_link|secondary|secondary_link|trunk|trunk_link|' +
  'tertiary|tertiary_link|residential|unclassified|service|' +
  'living_street|road|pedestrian|footway|path|cycleway|alley'

// OSM highway → tipo de rota FiberOps
function _tipoRota(highway = '') {
  if (/^(primary|secondary|trunk)/.test(highway)) return 'BACKBONE'
  return 'RAMAL'
}

/**
 * Busca ruas do OSM dentro do polígono informado.
 *
 * @param {Array<[number,number]>} polygon — vértices [lng, lat] WGS84
 * @param {{ maxWays?: number }} [opts]
 * @returns {Promise<Array<{
 *   osm_id: number,
 *   highway: string,
 *   name: string|null,
 *   tipo: 'BACKBONE'|'RAMAL',
 *   coordinates: Array<[number,number]>   — [lng, lat]
 * }>>}
 */
export async function fetchStreetsInPolygon(polygon, opts = {}) {
  const { maxWays = 300 } = opts

  // Overpass polygon: "lat1 lng1 lat2 lng2 …"  (atenção: lat antes de lng!)
  const polyStr = polygon.map(([lng, lat]) => `${lat.toFixed(6)} ${lng.toFixed(6)}`).join(' ')

  const query =
    `[out:json][timeout:18];` +
    `(way["highway"~"^(${HIGHWAY_FILTER})$"](poly:"${polyStr}"););` +
    `out geom;`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let data
  try {
    const resp = await fetch(OVERPASS_URL, {
      method:  'POST',
      body:    'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal:  controller.signal,
    })
    if (!resp.ok) throw new Error(`Overpass API retornou ${resp.status}`)
    data = await resp.json()
  } finally {
    clearTimeout(timer)
  }

  const elements = (data?.elements ?? [])
    .filter(el => el.type === 'way' && el.geometry?.length >= 2)
    .slice(0, maxWays)

  return elements
    .map(el => {
      // Overpass API retorna { lat, lon } (não "lng"!) — converter para [lng, lat]
      const coordinates = el.geometry
        .map(({ lat, lon }) => [lon, lat])
        .filter(([lng, lat]) => lng != null && lat != null && isFinite(lng) && isFinite(lat))

      if (coordinates.length < 2) return null

      return {
        osm_id:  el.id,
        highway: el.tags?.highway ?? 'unclassified',
        name:    el.tags?.name ?? null,
        tipo:    _tipoRota(el.tags?.highway),
        coordinates,
      }
    })
    .filter(Boolean)
}
