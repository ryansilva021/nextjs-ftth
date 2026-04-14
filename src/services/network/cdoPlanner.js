/**
 * src/services/network/cdoPlanner.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Posicionamento automático de CDOs para geração de rede em camadas.
 *
 * Problema do algoritmo anterior:
 *   - Usava centróide do grupo + snap com raio máximo de 200m
 *   - Se não havia interseção dentro de 200m, o CDO ficava flutuando no ar
 *   - O agrupamento sequencial ignorava a topologia das ruas
 *
 * Novo algoritmo (k-means constraindo a nós de rua):
 *   1. Coleta todos os NÓS das ruas OSM (cada vértice de cada via)
 *      → Prefere interseções (nós compartilhados por ≥ 2 vias)
 *      → Usa todos os nós como fallback
 *   2. Inicializa k centros com k-means++ (maximiza cobertura)
 *      → Todos os centros iniciais são SEMPRE nós de rua reais
 *   3. Itera k-means:
 *      → Assign: cada CTO vai para o CDO mais próximo
 *      → Update: o novo centro de cada cluster = nó de rua mais próximo
 *                do centróide das CTOs daquele cluster
 *   4. CDOs ficam SEMPRE sobre ruas — nunca no centro de uma quadra
 *   5. Desduplicação: dois clusters não usam o mesmo nó de rua
 */

// =============================================================================
// PRINCIPAL
// =============================================================================

/**
 * @param {Array}  ctos           — CTOs já posicionadas (snake-sorted)
 * @param {Array}  streets        — ruas OSM (retorno de fetchStreetsInPolygon)
 * @param {object} [opts]
 * @param {number}   [opts.ctosPerCdo=8]    — CTOs por CDO (define k)
 * @param {string}   [opts.cdoPrefix='CDO'] — prefixo do ID
 * @param {string}   [opts.oltId=null]      — ID da OLT pai
 * @returns {{ cdos: Array, ctos: Array }}
 */
export function planCDOsForCTOs(ctos, streets, opts = {}) {
  const {
    ctosPerCdo = 8,
    cdoPrefix  = 'CDO',
    oltId      = null,
  } = opts

  if (!ctos?.length) return { cdos: [], ctos: [] }

  const k = Math.max(1, Math.ceil(ctos.length / ctosPerCdo))

  // ── 1. Candidatos a posição de CDO ────────────────────────────────────────
  // Prefere interseções reais; se não houver, usa todos os vértices das ruas
  const candidates = _buildCandidates(streets)

  // ── 2. Determinar posições dos CDOs ───────────────────────────────────────
  let centers
  if (candidates.length >= k) {
    centers = _kMeansOnStreets(ctos, candidates, k)
  } else if (candidates.length > 0) {
    // Menos candidatos que CDOs: usa todos os candidatos disponíveis
    // e complementa com centróides de CTO como fallback
    centers = _kMeansOnStreets(ctos, candidates, candidates.length)
    const extra = k - centers.length
    if (extra > 0) {
      // Pega CTO posições para os centros extras
      const step = Math.floor(ctos.length / (extra + 1))
      for (let i = 1; i <= extra; i++) {
        const c = ctos[i * step] ?? ctos[ctos.length - 1]
        centers.push({ lat: c.lat, lng: c.lng })
      }
    }
  } else {
    // Sem dados OSM: fallback para centróides geográficos de grupos snake
    centers = _snakeCentroids(ctos, k)
  }

  // ── 3. Montar objetos CDO ─────────────────────────────────────────────────
  const cdos = centers.map((pos, i) => {
    const pad = String(i + 1).padStart(2, '0')
    const id  = `${cdoPrefix}-${pad}`
    return {
      id,
      nome:   id,
      lat:    parseFloat(pos.lat.toFixed(7)),
      lng:    parseFloat(pos.lng.toFixed(7)),
      tipo:   'CDO',
      olt_id: oltId ?? null,
    }
  })

  // ── 4. Atribuir cada CTO ao CDO mais próximo ──────────────────────────────
  const cdoPortas = new Array(cdos.length).fill(0)
  const assignedCtos = ctos.map(cto => {
    let bestIdx = 0, bestDist = Infinity
    for (let i = 0; i < cdos.length; i++) {
      const d = _distM(cto.lat, cto.lng, cdos[i].lat, cdos[i].lng)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    cdoPortas[bestIdx]++
    return {
      ...cto,
      cdo_id:    cdos[bestIdx].id,
      porta_cdo: cdoPortas[bestIdx],
    }
  })

  return { cdos, ctos: assignedCtos }
}

// =============================================================================
// K-MEANS CONSTRAINED AOS NÓS DE RUA
// =============================================================================

/**
 * Executa k-means onde os centros devem ser sempre nós reais das ruas.
 *
 * 1. Inicializa com k-means++ (garante boa cobertura)
 * 2. Itera até convergir ou atingir maxIter
 *    - Assign: cada CTO → CDO mais próximo
 *    - Update: novo centro = nó de rua mais próximo do centróide das CTOs do cluster
 * 3. Desduplicação: cada nó de rua é usado no máximo uma vez como CDO
 *
 * @param {Array}  ctos       — CTOs [{lat, lng}]
 * @param {Array}  candidates — nós de rua [{lat, lng}] — SEMPRE sobre ruas
 * @param {number} k          — número de CDOs
 * @param {number} [maxIter]  — iterações máximas
 * @returns {Array<{lat, lng}>}
 */
function _kMeansOnStreets(ctos, candidates, k, maxIter = 6) {
  if (k <= 0 || !ctos.length || !candidates.length) return []

  const kEff = Math.min(k, candidates.length)

  // ── k-means++ initialization ──────────────────────────────────────────────
  // Sorteia o 1º centro: o nó mais "central" em relação a todas as CTOs
  const centers   = []
  const usedIdxs  = new Set()

  let firstIdx = 0, firstScore = Infinity
  for (let ci = 0; ci < candidates.length; ci++) {
    const c = candidates[ci]
    const score = ctos.reduce((s, cto) => s + _distM(cto.lat, cto.lng, c.lat, c.lng), 0)
    if (score < firstScore) { firstScore = score; firstIdx = ci }
  }
  centers.push(candidates[firstIdx])
  usedIdxs.add(firstIdx)

  // Demais centros: maximiza distância mínima às CTOs (espalhamento)
  while (centers.length < kEff) {
    // Para cada CTO, distância ao centro mais próximo já escolhido
    const ctoDist = ctos.map(cto => {
      let minD = Infinity
      for (const c of centers) minD = Math.min(minD, _distM(cto.lat, cto.lng, c.lat, c.lng))
      return minD
    })

    // Escolhe o candidato que maximiza a redução de ctoDist²
    let bestCi = -1, bestScore = -1
    for (let ci = 0; ci < candidates.length; ci++) {
      if (usedIdxs.has(ci)) continue
      const c = candidates[ci]
      let score = 0
      for (let j = 0; j < ctos.length; j++) {
        const dToC = _distM(ctos[j].lat, ctos[j].lng, c.lat, c.lng)
        score += Math.max(0, ctoDist[j] - dToC)   // redução de distância
      }
      if (score > bestScore) { bestScore = score; bestCi = ci }
    }
    if (bestCi < 0) break
    centers.push(candidates[bestCi])
    usedIdxs.add(bestCi)
  }

  // ── Iterações k-means ─────────────────────────────────────────────────────
  let currentCenters = centers.slice()

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign: cada CTO ao centro mais próximo
    const clusters = Array.from({ length: currentCenters.length }, () => [])
    for (const cto of ctos) {
      let bestIdx = 0, bestDist = Infinity
      for (let i = 0; i < currentCenters.length; i++) {
        const d = _distM(cto.lat, cto.lng, currentCenters[i].lat, currentCenters[i].lng)
        if (d < bestDist) { bestDist = d; bestIdx = i }
      }
      clusters[bestIdx].push(cto)
    }

    // Update: novo centro = nó de rua mais próximo do centróide do cluster
    const newCenters = []
    const newUsed    = new Set()
    let changed = false

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      const prevCenter = currentCenters[i]

      if (cluster.length === 0) {
        // Cluster vazio: mantém centro anterior
        newCenters.push(prevCenter)
        continue
      }

      // Centróide das CTOs do cluster
      const cLat = cluster.reduce((s, c) => s + c.lat, 0) / cluster.length
      const cLng = cluster.reduce((s, c) => s + c.lng, 0) / cluster.length

      // Nó de rua mais próximo do centróide (não usado ainda nesta iteração)
      let bestCi = -1, bestDist = Infinity
      for (let ci = 0; ci < candidates.length; ci++) {
        if (newUsed.has(ci)) continue
        const d = _distM(cLat, cLng, candidates[ci].lat, candidates[ci].lng)
        if (d < bestDist) { bestDist = d; bestCi = ci }
      }

      const newCenter = bestCi >= 0 ? candidates[bestCi] : prevCenter
      newUsed.add(bestCi >= 0 ? bestCi : -1)
      newCenters.push(newCenter)

      if (newCenter.lat !== prevCenter.lat || newCenter.lng !== prevCenter.lng) changed = true
    }

    currentCenters = newCenters
    if (!changed) break   // convergiu
  }

  return currentCenters
}

// =============================================================================
// BUILDERS DE CANDIDATOS
// =============================================================================

/**
 * Coleta candidatos para posição de CDO:
 *   1. Interseções reais (nós compartilhados por ≥ 2 vias) — são os mais naturais
 *   2. Se não houver interseções, usa pontos intermediários de cada rua (midpoints)
 *   3. Como último recurso, todos os vértices de todas as ruas
 *
 * Garante que os candidatos ESTÃO SOBRE AS RUAS.
 */
function _buildCandidates(streets) {
  if (!streets?.length) return []

  // Conta quantas vias passam por cada nó
  const nodeCount = new Map()
  for (const street of streets) {
    for (const [lng, lat] of street.coordinates) {
      const key = `${lng.toFixed(5)},${lat.toFixed(5)}`
      nodeCount.set(key, (nodeCount.get(key) ?? 0) + 1)
    }
  }

  // Interseções: nós com contagem ≥ 2
  const intersections = []
  for (const [key, count] of nodeCount.entries()) {
    if (count >= 2) {
      const [lng, lat] = key.split(',').map(Number)
      intersections.push({ lng, lat })
    }
  }

  if (intersections.length > 0) return intersections

  // Fallback 1: pontos médios de cada segmento de rua (sempre sobre a via)
  const midpoints = []
  const seen = new Set()
  for (const street of streets) {
    const pts = street.coordinates
    for (let i = 1; i < pts.length; i++) {
      const mlng = (pts[i - 1][0] + pts[i][0]) / 2
      const mlat = (pts[i - 1][1] + pts[i][1]) / 2
      const key  = `${mlng.toFixed(5)},${mlat.toFixed(5)}`
      if (!seen.has(key)) {
        seen.add(key)
        midpoints.push({ lng: mlng, lat: mlat })
      }
    }
  }
  if (midpoints.length > 0) return midpoints

  // Fallback 2: todos os vértices
  const allNodes = []
  const usedKeys = new Set()
  for (const street of streets) {
    for (const [lng, lat] of street.coordinates) {
      const key = `${lng.toFixed(5)},${lat.toFixed(5)}`
      if (!usedKeys.has(key)) { usedKeys.add(key); allNodes.push({ lng, lat }) }
    }
  }
  return allNodes
}

// =============================================================================
// FALLBACK SEM OSM
// =============================================================================

/**
 * Quando não há dados de ruas, usa centróides geográficos
 * de grupos snake-sorted como posições de CDO.
 */
function _snakeCentroids(ctos, k) {
  const groupSize = Math.ceil(ctos.length / k)
  const centers   = []
  for (let i = 0; i < k; i++) {
    const slice = ctos.slice(i * groupSize, (i + 1) * groupSize)
    if (!slice.length) continue
    const lat = slice.reduce((s, c) => s + c.lat, 0) / slice.length
    const lng = slice.reduce((s, c) => s + c.lng, 0) / slice.length
    centers.push({ lat, lng })
  }
  return centers
}

// =============================================================================
// HELPER GEOMÉTRICO
// =============================================================================

export function _distM(lat1, lng1, lat2, lng2) {
  const dlat = (lat2 - lat1) * 111000
  const dlng = (lng2 - lng1) * 111000 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}
