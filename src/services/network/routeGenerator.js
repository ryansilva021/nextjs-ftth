/**
 * src/services/network/routeGenerator.js
 * ────────────────────────────────────────────────────────────────────────────
 * Gera uma grade de rotas de fibra dentro de um polígono geográfico.
 * Todas as coordenadas em WGS84 [lng, lat].
 * Arquivo puramente client-side (sem imports server/DB).
 */

// ===========================================================================
// HELPERS GEOMÉTRICOS
// ===========================================================================

/**
 * Ray-casting: ponto dentro do polígono?
 * @param {[number,number]} point   — [lng, lat]
 * @param {Array<[number,number]>} polygon — anel fechado de [lng, lat]
 */
export function pointInPolygon([x, y], polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Bounding box do polígono */
export function getBBox(polygon) {
  let minLng = Infinity, maxLng = -Infinity
  let minLat = Infinity, maxLat = -Infinity
  for (const [lng, lat] of polygon) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { minLng, maxLng, minLat, maxLat }
}

/**
 * Corta uma sequência de pontos ao interior do polígono,
 * retornando segmentos contíguos de pontos que estão dentro.
 */
function clipToPolygon(pts, polygon) {
  const segments = []
  let current = []
  for (const pt of pts) {
    if (pointInPolygon(pt, polygon)) {
      current.push(pt)
    } else {
      if (current.length >= 2) segments.push([...current])
      current = []
    }
  }
  if (current.length >= 2) segments.push(current)
  return segments
}

// ===========================================================================
// GERADOR DE ROTAS EM GRADE
// ===========================================================================

/**
 * Gera rotas de fibra em grade (horizontal + vertical) dentro do polígono.
 *
 * @param {Array<[number,number]>} polygon — vértices [lng, lat]
 * @param {object} [opts]
 * @param {number} [opts.gridStep]      — espaçamento da grade em graus (auto calculado se omitido)
 * @param {number} [opts.sampleStep]    — resolução de amostragem para clipping (padrão gridStep/8)
 * @returns {Array<{rota_id, nome, tipo, coordinates}>}
 */
export function generateRoutes(polygon, opts = {}) {
  const bbox = getBBox(polygon)

  // Dimensões em metros para calcular passo adaptativo
  const midLat  = (bbox.minLat + bbox.maxLat) / 2
  const latM    = (bbox.maxLat - bbox.minLat) * 111000
  const lngM    = (bbox.maxLng - bbox.minLng) * 111000 * Math.cos(midLat * Math.PI / 180)
  const minDim  = Math.min(latM, lngM)

  // Alvo: ~5 divisões no menor eixo, dentro de [80 m, 400 m]
  const autoStepM  = Math.max(80, Math.min(400, minDim / 5))
  const autoStep   = autoStepM / 111000
  const gridStep   = opts.gridStep   ?? autoStep
  const sampleStep = opts.sampleStep ?? (gridStep / 8)

  const routes = []
  let idx = 0

  // ── Linhas horizontais (lat constante) ────────────────────────────────────
  for (let lat = bbox.minLat + gridStep / 2; lat < bbox.maxLat; lat += gridStep) {
    const pts = []
    for (let lng = bbox.minLng; lng <= bbox.maxLng + sampleStep * 0.5; lng += sampleStep) {
      pts.push([Math.min(lng, bbox.maxLng), lat])
    }
    const segs = clipToPolygon(pts, polygon)
    for (const seg of segs) {
      idx++
      routes.push({
        rota_id:     `AUTO-R-H${idx}`,
        nome:        `Auto Ramal H${idx}`,
        tipo:        'RAMAL',
        coordinates: decimateCoords(seg, sampleStep * 3),
      })
    }
  }

  // ── Linhas verticais (lng constante) ──────────────────────────────────────
  let vLine = 0
  for (let lng = bbox.minLng + gridStep / 2; lng < bbox.maxLng; lng += gridStep) {
    const pts = []
    for (let lat = bbox.minLat; lat <= bbox.maxLat + sampleStep * 0.5; lat += sampleStep) {
      pts.push([lng, Math.min(lat, bbox.maxLat)])
    }
    const segs = clipToPolygon(pts, polygon)
    for (const seg of segs) {
      idx++
      vLine++
      routes.push({
        rota_id:     `AUTO-R-V${idx}`,
        nome:        `Auto ${vLine === 1 ? 'Backbone' : 'Ramal'} V${idx}`,
        tipo:        vLine === 1 ? 'BACKBONE' : 'RAMAL',
        coordinates: decimateCoords(seg, sampleStep * 3),
      })
    }
  }

  return routes
}

/**
 * Reduz densidade de pontos colapsando pontos vizinhos a menos de `minDist` graus.
 * Mantém sempre o primeiro e o último ponto.
 */
function decimateCoords(pts, minDist) {
  if (pts.length <= 2) return pts
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1]
    const dx   = pts[i][0] - prev[0]
    const dy   = pts[i][1] - prev[1]
    if (Math.sqrt(dx * dx + dy * dy) >= minDist) {
      out.push(pts[i])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}
