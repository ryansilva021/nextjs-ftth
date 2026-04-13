/**
 * src/services/network/routePlanner.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Gera rotas de distribuição de fibra conectando CTOs ao longo das ruas reais.
 *
 * Algoritmos:
 *   1. buildStreetGraph   — constrói grafo de adjacência a partir das vias OSM
 *   2. dijkstraPath       — caminho mínimo no grafo (Dijkstra com fila simples)
 *   3. buildMST           — Árvore Geradora Mínima de Prim (distância euclidiana)
 *   4. planOptimalRoutes  — MST + Dijkstra = rotas que seguem as ruas reais
 */

// =============================================================================
// GRAFO DE RUAS (adjacência)
// =============================================================================

/**
 * Constrói grafo de adjacência não-dirigido a partir dos segmentos de rua.
 * Nós = cada ponto de geometria OSM (arredondado em 5 casas decimais).
 * Arestas = segmentos consecutivos de cada via, peso = distância em metros.
 *
 * @param {Array} streets — retorno de fetchStreetsInPolygon
 * @returns {Map<string, {lng, lat, neighbors: [{key, cost}]}>}
 */
export function buildStreetGraph(streets) {
  const nodes = new Map()

  function node(key, lng, lat) {
    if (!nodes.has(key)) nodes.set(key, { lng, lat, neighbors: [] })
    return nodes.get(key)
  }

  for (const street of streets) {
    const coords = street.coordinates
    for (let i = 1; i < coords.length; i++) {
      const [lng1, lat1] = coords[i - 1]
      const [lng2, lat2] = coords[i]
      const k1 = _key(lng1, lat1)
      const k2 = _key(lng2, lat2)
      const cost = _segM(lng1, lat1, lng2, lat2)
      const n1 = node(k1, lng1, lat1)
      const n2 = node(k2, lng2, lat2)
      n1.neighbors.push({ key: k2, cost })
      n2.neighbors.push({ key: k1, cost })
    }
  }

  return nodes
}

// =============================================================================
// DIJKSTRA — caminho mínimo entre dois nós do grafo
// =============================================================================

/**
 * Retorna a sequência de coordenadas [lng, lat][] do caminho mais curto
 * entre dois nós do grafo (por chave). Retorna [] se não há caminho.
 *
 * @param {Map} graph         — grafo construído por buildStreetGraph
 * @param {string} startKey
 * @param {string} endKey
 * @param {number} [maxNodes=2000] — limita busca (evita timeout em mapas grandes)
 */
export function dijkstraPath(graph, startKey, endKey, maxNodes = 2000) {
  if (startKey === endKey || !graph.has(startKey) || !graph.has(endKey)) return []

  const dist    = new Map([[startKey, 0]])
  const prev    = new Map()
  const visited = new Set()

  // Fila simples — para grafos pequenos (<2000 nós) é suficientemente rápida
  const queue = [{ key: startKey, d: 0 }]

  while (queue.length > 0) {
    // Extrai o nó com menor distância acumulada
    let minIdx = 0
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].d < queue[minIdx].d) minIdx = i
    }
    const { key: u, d: du } = queue.splice(minIdx, 1)[0]

    if (u === endKey) break
    if (visited.has(u)) continue
    visited.add(u)
    if (visited.size > maxNodes) break   // guarda de performance

    for (const { key: v, cost } of graph.get(u)?.neighbors ?? []) {
      if (visited.has(v)) continue
      const alt = du + cost
      if (alt < (dist.get(v) ?? Infinity)) {
        dist.set(v, alt)
        prev.set(v, u)
        queue.push({ key: v, d: alt })
      }
    }
  }

  // Reconstrói o caminho de endKey → startKey, invertendo no final
  const path = []
  let cur = endKey
  let steps = 0
  while (prev.has(cur) && steps++ < 10000) {
    const [lng, lat] = cur.split(',').map(Number)
    path.push([lng, lat])
    cur = prev.get(cur)
  }
  // Adiciona o nó inicial
  const [slng, slat] = startKey.split(',').map(Number)
  path.push([slng, slat])
  path.reverse()

  return path.length >= 2 ? path : []
}

// =============================================================================
// ÁRVORE GERADORA MÍNIMA (Prim — distância euclidiana entre CTOs)
// =============================================================================

/**
 * Algoritmo de Prim: constrói a MST que conecta todas as CTOs com o menor
 * comprimento total de cabo, usando distância euclidiana como heurística.
 *
 * @param {Array} ctos
 * @returns {Array<{from: number, to: number}>} — índices em `ctos`
 */
function buildMST(ctos) {
  const n = ctos.length
  if (n <= 1) return []

  const inTree = new Set([0])
  const edges  = []

  while (inTree.size < n) {
    let best = null, bestD = Infinity

    for (const i of inTree) {
      for (let j = 0; j < n; j++) {
        if (inTree.has(j)) continue
        const d = _euclidM(ctos[i], ctos[j])
        if (d < bestD) { bestD = d; best = { from: i, to: j } }
      }
    }
    if (!best) break
    inTree.add(best.to)
    edges.push(best)
  }

  return edges
}

// =============================================================================
// ROTEAMENTO PRINCIPAL
// =============================================================================

/**
 * Gera rotas de distribuição que conectam todas as CTOs usando:
 *   1. MST (Prim) para decidir QUAIS CTOs conectar (mínimo de cabo)
 *   2. Dijkstra para decidir COMO chegar (seguindo as ruas reais)
 *
 * @param {Array} ctos    — CTOs já ordenadas (snake sort)
 * @param {Array} streets — ruas do OSM
 * @param {object} [opts]
 * @returns {Array<{rota_id, nome, tipo, coordinates}>}
 */
export function planOptimalRoutes(ctos, streets, opts = {}) {
  if (ctos.length < 2) return []

  // ── 1. Grafo de ruas ────────────────────────────────────────��──────────
  const graph    = buildStreetGraph(streets)
  const hasGraph = graph.size > 0

  // ── 2. Mapa: CTO → nó mais próximo no grafo de ruas ───────────────────
  const snapCache = new Map()
  function snapCTO(cto) {
    if (snapCache.has(cto.cto_id)) return snapCache.get(cto.cto_id)
    const snap = hasGraph ? _nearestNode(graph, cto.lng, cto.lat) : null
    snapCache.set(cto.cto_id, snap)
    return snap
  }

  // ── 3. MST de CTOs (distância euclidiana) ─────────────────────────────
  const mstEdges = buildMST(ctos)

  // ── 4. Para cada aresta da MST: rota que segue as ruas reais ──────────
  const routes    = []
  const seenPairs = new Set()   // evita rotas duplicadas A↔B
  let   routeIdx  = 1

  for (const { from, to } of mstEdges) {
    const ctoA = ctos[from]
    const ctoB = ctos[to]

    // Deduplica pares (ordem não importa)
    const pairKey = [ctoA.cto_id, ctoB.cto_id].sort().join('|')
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)

    const snapA = snapCTO(ctoA)
    const snapB = snapCTO(ctoB)

    let coords = [[ctoA.lng, ctoA.lat], [ctoB.lng, ctoB.lat]]  // fallback linha reta

    if (snapA && snapB && snapA !== snapB) {
      const path = dijkstraPath(graph, snapA, snapB)
      if (path.length >= 2) {
        coords = [
          [ctoA.lng, ctoA.lat],
          ...path,
          [ctoB.lng, ctoB.lat],
        ]
      }
    }

    const deduped = _dedupeCoords(coords)
    if (deduped.length < 2) continue   // descarta segmentos degenerados

    routes.push({
      rota_id:     `DIST-${routeIdx++}`,
      nome:        `Dist. ${ctoA.cto_id} → ${ctoB.cto_id}`,
      tipo:        'DROP',
      coordinates: deduped,
    })
  }

  return routes
}

// =============================================================================
// HELPERS INTERNOS
// =============================================================================

function _key(lng, lat) {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`
}

function _segM(lng1, lat1, lng2, lat2) {
  const dlat = (lat2 - lat1) * 111000
  const dlng = (lng2 - lng1) * 111000 * Math.cos((lat1 + lat2) / 2 * Math.PI / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

function _euclidM(a, b) {
  return _segM(a.lng, a.lat, b.lng, b.lat)
}

/** Nó do grafo mais próximo de [lng, lat] */
function _nearestNode(graph, lng, lat) {
  let bestKey = null, bestDist = Infinity
  for (const [key, node] of graph.entries()) {
    const d = _segM(lng, lat, node.lng, node.lat)
    if (d < bestDist) { bestDist = d; bestKey = key }
  }
  return bestKey
}

/** Remove coordenadas duplicadas consecutivas */
function _dedupeCoords(coords) {
  if (coords.length <= 1) return coords
  const out = [coords[0]]
  for (let i = 1; i < coords.length; i++) {
    const [lx, ly] = coords[i]
    const [px, py] = out[out.length - 1]
    if (Math.abs(lx - px) > 1e-7 || Math.abs(ly - py) > 1e-7) out.push(coords[i])
  }
  return out
}
