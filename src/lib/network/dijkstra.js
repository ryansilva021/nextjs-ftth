/**
 * dijkstra.js
 * Dijkstra + A* algorithms for fiber route optimization.
 *
 * Graph format:
 *   {
 *     nodes: { [nodeId]: { id, lat, lng, type } },
 *     edges: { [nodeId]: [ { to, weight, distance, isReuse } ] }
 *   }
 *
 * Edge weight = base_distance × type_multiplier × reuse_bonus
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_MULTIPLIERS = {
  aerea:       1.0,
  subterranea: 1.8,
  duto:        1.5,
};
const DEFAULT_MULTIPLIER = 1.2;
const REUSE_BONUS        = 0.65; // existing fiber reuse discount
const MAX_DIRECT_EDGE_M  = 2000; // meters — maximum distance for virtual direct edges

// ---------------------------------------------------------------------------
// Haversine distance in meters
// ---------------------------------------------------------------------------

/**
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance in meters
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R    = 6_371_000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Min-heap (priority queue) for Dijkstra / A*
// ---------------------------------------------------------------------------

class MinHeap {
  constructor() {
    this._data = [];
  }

  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }

  pop() {
    const top  = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) {
      this._data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() {
    return this._data.length;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this._data[parent].priority <= this._data[i].priority) break;
      [this._data[parent], this._data[i]] = [this._data[i], this._data[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this._data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this._data[l].priority < this._data[smallest].priority) smallest = l;
      if (r < n && this._data[r].priority < this._data[smallest].priority) smallest = r;
      if (smallest === i) break;
      [this._data[smallest], this._data[i]] = [this._data[i], this._data[smallest]];
      i = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function edgeWeight(distanceMeters, tipo, isReuse) {
  const multiplier  = TYPE_MULTIPLIERS[tipo] ?? DEFAULT_MULTIPLIER;
  const reuseBonus  = isReuse ? REUSE_BONUS : 1.0;
  return distanceMeters * multiplier * reuseBonus;
}

function reconstructPath(prev, endId) {
  const path = [];
  let current = endId;
  while (current !== undefined) {
    path.unshift(current);
    current = prev[current];
  }
  return path;
}

// ---------------------------------------------------------------------------
// Dijkstra
// ---------------------------------------------------------------------------

/**
 * Classic Dijkstra shortest path.
 *
 * @param {{ nodes: object, edges: object }} graph
 * @param {string} startId
 * @param {string} endId
 * @returns {{ path: string[], distance: number, cost: number } | null}
 */
export function dijkstra(graph, startId, endId) {
  const { edges } = graph;

  const dist = {};
  const cost = {};
  const prev = {};
  const visited = new Set();
  const heap = new MinHeap();

  for (const nodeId of Object.keys(edges)) {
    dist[nodeId] = Infinity;
    cost[nodeId] = Infinity;
  }

  dist[startId] = 0;
  cost[startId] = 0;
  heap.push({ id: startId, priority: 0 });

  while (heap.size > 0) {
    const { id: current } = heap.pop();

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endId) break;

    const neighbors = edges[current] ?? [];
    for (const edge of neighbors) {
      if (visited.has(edge.to)) continue;

      const newDist = dist[current] + edge.distance;
      const newCost = cost[current] + edge.weight;

      if (newCost < cost[edge.to]) {
        dist[edge.to] = newDist;
        cost[edge.to] = newCost;
        prev[edge.to] = current;
        heap.push({ id: edge.to, priority: newCost });
      }
    }
  }

  if (dist[endId] === Infinity) return null;

  return {
    path:     reconstructPath(prev, endId),
    distance: dist[endId],
    cost:     cost[endId],
  };
}

// ---------------------------------------------------------------------------
// A*
// ---------------------------------------------------------------------------

/**
 * A* with Haversine heuristic for geographic graphs.
 *
 * @param {{ nodes: object, edges: object }} graph
 * @param {string} startId
 * @param {string} endId
 * @param {{ [nodeId]: { lat: number, lng: number } }} nodes - must include start/end
 * @returns {{ path: string[], distance: number, cost: number } | null}
 */
export function aStar(graph, startId, endId, nodes) {
  const { edges } = graph;
  const endNode   = nodes[endId];

  if (!endNode) return dijkstra(graph, startId, endId);

  const heuristic = (nodeId) => {
    const n = nodes[nodeId];
    if (!n) return 0;
    return haversineMeters(n.lat, n.lng, endNode.lat, endNode.lng);
  };

  const gScore  = {};
  const fScore  = {};
  const prev    = {};
  const visited = new Set();
  const heap    = new MinHeap();

  for (const nodeId of Object.keys(edges)) {
    gScore[nodeId] = Infinity;
    fScore[nodeId] = Infinity;
  }

  gScore[startId] = 0;
  fScore[startId] = heuristic(startId);
  heap.push({ id: startId, priority: fScore[startId] });

  while (heap.size > 0) {
    const { id: current } = heap.pop();

    if (current === endId) break;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = edges[current] ?? [];
    for (const edge of neighbors) {
      if (visited.has(edge.to)) continue;

      const tentativeG = gScore[current] + edge.weight;
      if (tentativeG < (gScore[edge.to] ?? Infinity)) {
        prev[edge.to]   = current;
        gScore[edge.to] = tentativeG;
        fScore[edge.to] = tentativeG + heuristic(edge.to);
        heap.push({ id: edge.to, priority: fScore[edge.to] });
      }
    }
  }

  if ((gScore[endId] ?? Infinity) === Infinity) return null;

  // Compute actual geographic distance along path
  const path     = reconstructPath(prev, endId);
  let totalDist  = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = nodes[path[i]];
    const b = nodes[path[i + 1]];
    if (a && b) totalDist += haversineMeters(a.lat, a.lng, b.lat, b.lng);
  }

  return {
    path,
    distance: totalDist,
    cost:     gScore[endId],
  };
}

// ---------------------------------------------------------------------------
// Build graph from network data
// ---------------------------------------------------------------------------

/**
 * Snaps LineString coordinates to the nearest known network node within
 * snapThreshold meters; returns the node ID or null.
 */
function snapToNode(coordLng, coordLat, nodesMap, snapThreshold = 150) {
  let bestId   = null;
  let bestDist = snapThreshold;

  for (const [id, node] of Object.entries(nodesMap)) {
    const d = haversineMeters(coordLat, coordLng, node.lat, node.lng);
    if (d < bestDist) {
      bestDist = d;
      bestId   = id;
    }
  }
  return bestId;
}

/**
 * Adds a bidirectional edge to the adjacency list.
 */
function addEdge(edges, fromId, toId, distM, tipo, isReuse) {
  const w = edgeWeight(distM, tipo, isReuse);
  if (!edges[fromId]) edges[fromId] = [];
  if (!edges[toId])   edges[toId]   = [];

  // Avoid duplicate edges
  const exists = edges[fromId].some((e) => e.to === toId);
  if (!exists) {
    edges[fromId].push({ to: toId, weight: w, distance: distM, isReuse });
    edges[toId].push({ to: fromId, weight: w, distance: distM, isReuse });
  }
}

/**
 * Builds a routing graph from FTTH network entities.
 *
 * @param {object[]} ctos   - CTO documents
 * @param {object[]} cdos   - CaixaEmendaCDO documents
 * @param {object[]} olts   - OLT documents
 * @param {object[]} rotas  - Rota documents
 * @returns {{ graph: { nodes: object, edges: object }, nodes: object }}
 */
export function buildGraphFromNetwork(ctos, cdos, olts, rotas) {
  const nodesMap = {};  // nodeId → { id, lat, lng, type }
  const edges    = {};  // nodeId → [ edge ]

  // --- Add nodes ---
  for (const cto of ctos) {
    if (cto.lat == null || cto.lng == null) continue;
    const nodeId = `cto:${cto.cto_id}`;
    nodesMap[nodeId] = { id: nodeId, lat: cto.lat, lng: cto.lng, type: 'cto', ref: cto.cto_id };
    edges[nodeId] = [];
  }

  for (const cdo of cdos) {
    if (cdo.lat == null || cdo.lng == null) continue;
    const nodeId = `cdo:${cdo.id}`;
    nodesMap[nodeId] = { id: nodeId, lat: cdo.lat, lng: cdo.lng, type: 'cdo', ref: cdo.id };
    edges[nodeId] = [];
  }

  for (const olt of olts) {
    if (olt.lat == null || olt.lng == null) continue;
    const nodeId = `olt:${olt.id}`;
    nodesMap[nodeId] = { id: nodeId, lat: olt.lat, lng: olt.lng, type: 'olt', ref: olt.id };
    edges[nodeId] = [];
  }

  // --- Add edges from existing rotas (real fiber runs) ---
  for (const rota of rotas) {
    const coords = rota.geojson?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;

    const tipo    = rota.tipo ?? 'aerea';
    const isReuse = true; // existing routes = reusable fiber

    // Walk the LineString snapping intermediate points to nodes
    // and accumulating segment distances between consecutive snapped anchors
    let prevNodeId  = null;
    let accDist     = 0;
    let prevCoord   = null;

    for (let i = 0; i < coords.length; i++) {
      const [lng, lat] = coords[i]; // GeoJSON order
      const snapped    = snapToNode(lng, lat, nodesMap);

      if (prevCoord) {
        const [pLng, pLat] = prevCoord;
        accDist += haversineMeters(pLat, pLng, lat, lng);
      }

      if (snapped) {
        if (prevNodeId && prevNodeId !== snapped) {
          const dist = accDist > 0 ? accDist : haversineMeters(
            nodesMap[prevNodeId].lat, nodesMap[prevNodeId].lng,
            nodesMap[snapped].lat,    nodesMap[snapped].lng
          );
          addEdge(edges, prevNodeId, snapped, dist, tipo, isReuse);
        }
        prevNodeId = snapped;
        accDist    = 0;
      }

      prevCoord = [lng, lat];
    }

    // Fallback: if LineString has snap_ids on the rota, use stored endpoint info
    if (rota.snap_ids?.length >= 2 && rota.comprimento_m) {
      const [a, b] = rota.snap_ids;
      // snap_ids are like "cdo:CDO-001", "cto:CTO-001"
      const fromId = Object.keys(nodesMap).find(
        (k) => k === a || nodesMap[k].ref === a.split(':')[1]
      );
      const toId = Object.keys(nodesMap).find(
        (k) => k === b || nodesMap[k].ref === b.split(':')[1]
      );
      if (fromId && toId) {
        addEdge(edges, fromId, toId, rota.comprimento_m, tipo, isReuse);
      }
    }
  }

  // --- Add direct virtual edges for nearby nodes (potential new connections) ---
  const nodeIds = Object.keys(nodesMap);
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const a   = nodesMap[nodeIds[i]];
      const b   = nodesMap[nodeIds[j]];
      const d   = haversineMeters(a.lat, a.lng, b.lat, b.lng);
      if (d <= MAX_DIRECT_EDGE_M) {
        addEdge(edges, nodeIds[i], nodeIds[j], d, 'aerea', false);
      }
    }
  }

  const graph = { nodes: nodesMap, edges };
  return { graph, nodes: nodesMap };
}
