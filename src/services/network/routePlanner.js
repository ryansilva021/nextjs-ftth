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
 *
 * Além das arestas OSM normais, adiciona "atalhos de tolerância":
 *   - Nós que estão a ≤ SNAP_TOL metros entre si ganham uma aresta virtual.
 *   - Isso corrige o caso comum no OSM em que duas ruas se cruzam mas
 *     não compartilham um nó exato (near-miss), causando desconexões no grafo.
 *   - Usa bucketing espacial → O(n) amortizado.
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

  // ── 1. Arestas reais das vias OSM ─────────────────────────────────────────
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

  // ── 2. Atalhos de tolerância (near-miss intersections) ────────────────────
  // Dois nós a ≤ 12m um do outro recebem aresta virtual (custo real).
  // Resolve: ruas adjacentes sem nó compartilhado, calçadas que quase tocam
  // uma avenida, dados OSM imprecisos.
  const SNAP_TOL   = 20      // metros — cobre near-miss em dados OSM imprecisos
  const BUCKET_DEG = 0.0003  // ~33m em latitude — garante que nós dentro de
                              // SNAP_TOL caiam no mesmo bucket ou no adjacente

  const buckets = new Map()
  for (const [key, n] of nodes.entries()) {
    const bx = Math.floor(n.lng / BUCKET_DEG)
    const by = Math.floor(n.lat / BUCKET_DEG)
    const bk = `${bx},${by}`
    if (!buckets.has(bk)) buckets.set(bk, [])
    buckets.get(bk).push(key)
  }

  for (const [key, n] of nodes.entries()) {
    const bx = Math.floor(n.lng / BUCKET_DEG)
    const by = Math.floor(n.lat / BUCKET_DEG)

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nearby = buckets.get(`${bx + dx},${by + dy}`) ?? []
        for (const otherKey of nearby) {
          if (otherKey === key) continue
          // Pula se já existe aresta direta
          if (n.neighbors.some(nb => nb.key === otherKey)) continue
          const other = nodes.get(otherKey)
          const d = _segM(n.lng, n.lat, other.lng, other.lat)
          if (d <= SNAP_TOL) {
            n.neighbors.push({ key: otherKey, cost: d })
            // O inverso será adicionado quando o loop chegar no otherKey
          }
        }
      }
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

  // ── 2. Mapa: CTO → nó virtual inserido no grafo ──────────────────────
  // _insertVirtualNode garante que Dijkstra começa/termina na posição exata
  // da CTO, sem segmentos "último milha" externos que cruzam edifícios.
  const snapCache = new Map()
  function snapCTO(cto) {
    if (snapCache.has(cto.cto_id)) return snapCache.get(cto.cto_id)
    const snap = hasGraph ? _insertVirtualNode(graph, cto.lng, cto.lat) : null
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
      const path = dijkstraPath(graph, snapA, snapB, 20000)
      // Path começa em ctoA e termina em ctoB (nós virtuais) — sem segmentos externos
      if (path.length >= 2) coords = path
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
// ROTAS DE BACKBONE — OLT → cada CDO
// =============================================================================

/**
 * Gera rotas de backbone que ligam a OLT a cada CDO,
 * seguindo o traçado das ruas reais via Dijkstra.
 *
 * @param {{ lat, lng, id }} olt
 * @param {Array}            cdos    — CDOs gerados por planCDOsForCTOs
 * @param {Array}            streets — ruas OSM
 * @returns {Array<{rota_id, nome, tipo, coordinates}>}
 */
export function planBackboneRoutes(olt, cdos, streets) {
  if (!olt || !cdos?.length) return []

  const graph    = buildStreetGraph(streets)
  const hasGraph = graph.size > 0

  // Insere OLT como nó virtual uma única vez
  const oltKey = hasGraph ? _insertVirtualNode(graph, olt.lng, olt.lat) : null

  return cdos.map((cdo, i) => {
    const cdoKey = hasGraph ? _insertVirtualNode(graph, cdo.lng, cdo.lat) : null

    let coords = [[olt.lng, olt.lat], [cdo.lng, cdo.lat]]

    if (oltKey && cdoKey && oltKey !== cdoKey) {
      const path = dijkstraPath(graph, oltKey, cdoKey, 20000)
      if (path.length >= 2) coords = path
    }

    return {
      rota_id:     `BACKBONE-${i + 1}`,
      nome:        `Backbone OLT → ${cdo.id}`,
      tipo:        'BACKBONE',
      coordinates: _dedupeCoords(coords),
    }
  })
}

// =============================================================================
// ROTAS DE DISTRIBUIÇÃO — CDO → CTOs do seu cluster (topologia estrela)
// =============================================================================

/**
 * Para cada CDO, roteia cada CTO de volta ao CDO pelo caminho mais curto
 * nas ruas reais (Dijkstra). Topologia estrela: sem arestas CTO↔CTO,
 * o que elimina rotas atravessando quarteirões.
 *
 * Algoritmo:
 *   1. Insere CDO como nó virtual no grafo (conectado aos 3 nós mais próximos)
 *   2. Para cada CTO do cluster: insere CTO como nó virtual, Dijkstra(CDO → CTO)
 *   3. Dijkstra começa e termina nas posições EXATAS do CDO/CTO — sem segmentos
 *      "último milha" que poderiam atravessar edifícios
 *   4. Se Dijkstra falha (grafo desconexo): linha reta apenas entre
 *      CDO e aquela CTO (não afeta outras)
 *
 * @param {Array} cdos    — CDOs com campo `id`
 * @param {Array} ctos    — CTOs com campo `cdo_id` atribuído
 * @param {Array} streets — ruas OSM
 * @returns {Array<{rota_id, nome, tipo, coordinates}>}
 */
export function planDistributionRoutesByCDO(cdos, ctos, streets) {
  if (!cdos?.length || !ctos?.length) return []

  const graph    = buildStreetGraph(streets)
  const hasGraph = graph.size > 0
  const routes   = []
  let routeIdx   = 1

  for (const cdo of cdos) {
    const myCtos = ctos.filter(c => c.cdo_id === cdo.id)
    if (!myCtos.length) continue

    // Insere CDO como nó virtual — conectado aos vizinhos mais próximos
    const cdoKey = hasGraph ? _insertVirtualNode(graph, cdo.lng, cdo.lat) : null

    for (const cto of myCtos) {
      let coords = [[cdo.lng, cdo.lat], [cto.lng, cto.lat]]  // fallback linha reta

      if (hasGraph && cdoKey) {
        const ctoKey = _insertVirtualNode(graph, cto.lng, cto.lat)
        if (ctoKey && ctoKey !== cdoKey) {
          const path = dijkstraPath(graph, cdoKey, ctoKey, 20000)
          // Path já começa no CDO e termina no CTO — sem segmentos externos
          if (path.length >= 2) coords = path
        }
      }

      const deduped = _dedupeCoords(coords)
      if (deduped.length < 2) continue

      routes.push({
        rota_id:     `DIST-${routeIdx++}`,
        nome:        `${cdo.id} → ${cto.cto_id ?? cto.nome ?? cto.id}`,
        tipo:        'DISTRIBUICAO',
        coordinates: deduped,
      })
    }
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

/**
 * Insere um nó virtual em (lng, lat) no grafo, conectado aos N vizinhos
 * mais próximos dentro de maxDist metros. Se o nó já existir (mesma chave
 * de 5dp), retorna a chave existente sem modificar o grafo.
 *
 * Isso elimina os segmentos "último milha" externos ao Dijkstra que poderiam
 * atravessar edifícios, pois o caminho começa e termina na posição exata.
 *
 * @param {Map}    graph
 * @param {number} lng
 * @param {number} lat
 * @param {number} [maxDist=250]  — raio máximo em metros para buscar vizinhos
 * @param {number} [maxNeighbors=4]
 * @returns {string|null}         — chave do nó virtual, ou null se grafo vazio
 */
function _insertVirtualNode(graph, lng, lat, maxDist = 250, maxNeighbors = 4) {
  if (!graph.size) return null

  const key = _key(lng, lat)

  // Nó já existe? Retorna sem alterar
  if (graph.has(key)) return key

  // Coleta vizinhos dentro do raio, ordenados por distância
  const nearby = []
  for (const [k, node] of graph.entries()) {
    const d = _segM(lng, lat, node.lng, node.lat)
    nearby.push({ key: k, cost: d })
  }
  nearby.sort((a, b) => a.cost - b.cost)

  // Pega os N mais próximos dentro do raio (sem limite se raio excedido — garante conexão)
  let connected = nearby.slice(0, maxNeighbors).filter(n => n.cost <= maxDist)
  if (connected.length === 0) connected = [nearby[0]]  // fallback: absoluto mais próximo

  // Insere nó virtual
  graph.set(key, { lng, lat, neighbors: connected.map(n => ({ key: n.key, cost: n.cost })) })

  // Adiciona arestas reversas
  for (const { key: nk, cost } of connected) {
    const n = graph.get(nk)
    if (n && !n.neighbors.some(nb => nb.key === key)) {
      n.neighbors.push({ key, cost })
    }
  }

  return key
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
