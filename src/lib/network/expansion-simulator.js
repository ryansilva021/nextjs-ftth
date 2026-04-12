/**
 * expansion-simulator.js
 * AI-assisted network expansion planning.
 *
 * Algorithm overview:
 *  1. Parse polygon boundary
 *  2. Fetch existing CTOs / CDOs inside or near polygon
 *  3. Generate a demand-point grid inside the polygon
 *  4. Identify uncovered demand points (no CTO within coverageRadius)
 *  5. K-means clustering of uncovered points → candidate CTO positions
 *  6. For each candidate, find nearest anchor (CDO/OLT), run A* for route
 *  7. Return full expansion plan with costs and AI insights
 */

import { connectDB }                       from '@/lib/db';
import { CTO }                             from '@/models/CTO';
import { CaixaEmendaCDO }                  from '@/models/CaixaEmendaCDO';
import { OLT }                             from '@/models/OLT';
import { Rota }                            from '@/models/Rota';
import { haversineMeters, buildGraphFromNetwork, aStar } from './dijkstra';
import { calculateSignal, estimateFiberCost, estimateCTOCost } from './signal-calculator';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COVERAGE_RADIUS_M = 300;  // meters — CTO effective service radius
const MAX_KMEANS_ITER   = 10;
const OLT_DEFAULT_POWER = 5;    // dBm

const DEMAND_SPACING = {
  low:    200, // meters between demand grid points
  medium: 150,
  high:   100,
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Point-in-polygon test using ray casting.
 *
 * @param {{ lat: number, lng: number }} point
 * @param {Array<{ lat: number, lng: number }>} polygon
 * @returns {boolean}
 */
function pointInPolygon(point, polygon) {
  const { lat: px, lng: py } = point;
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Bounding box of a polygon.
 */
function boundingBox(polygon) {
  const lats = polygon.map((p) => p.lat);
  const lngs = polygon.map((p) => p.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

/**
 * Converts meter spacing to approximate degree delta at a given latitude.
 */
function metersToDegrees(meters, lat) {
  const latDeg = meters / 111_320;
  const lngDeg = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { latDeg, lngDeg };
}

/**
 * Generates demand points on a regular grid inside the polygon.
 */
function generateDemandGrid(polygon, spacingM) {
  const bb  = boundingBox(polygon);
  const mid = (bb.minLat + bb.maxLat) / 2;
  const { latDeg, lngDeg } = metersToDegrees(spacingM, mid);

  const points = [];
  for (let lat = bb.minLat; lat <= bb.maxLat; lat += latDeg) {
    for (let lng = bb.minLng; lng <= bb.maxLng; lng += lngDeg) {
      const p = { lat, lng };
      if (pointInPolygon(p, polygon)) {
        points.push(p);
      }
    }
  }
  return points;
}

// ---------------------------------------------------------------------------
// K-means clustering
// ---------------------------------------------------------------------------

function kmeans(points, k) {
  if (points.length === 0) return [];

  // Initialise centroids by spreading evenly across the points array
  let centroids = [];
  const step = Math.max(1, Math.floor(points.length / k));
  for (let i = 0; i < k; i++) {
    centroids.push({ ...points[Math.min(i * step, points.length - 1)] });
  }

  let assignments = new Array(points.length).fill(0);

  for (let iter = 0; iter < MAX_KMEANS_ITER; iter++) {
    // Assign each point to nearest centroid
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      let bestCluster = 0;
      let bestDist    = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = haversineMeters(
          points[i].lat, points[i].lng,
          centroids[c].lat, centroids[c].lng
        );
        if (d < bestDist) { bestDist = d; bestCluster = c; }
      }
      if (assignments[i] !== bestCluster) { assignments[i] = bestCluster; changed = true; }
    }
    if (!changed) break;

    // Recompute centroids
    const sums   = centroids.map(() => ({ lat: 0, lng: 0, count: 0 }));
    for (let i = 0; i < points.length; i++) {
      const c = assignments[i];
      sums[c].lat   += points[i].lat;
      sums[c].lng   += points[i].lng;
      sums[c].count += 1;
    }
    centroids = sums.map((s) =>
      s.count > 0
        ? { lat: s.lat / s.count, lng: s.lng / s.count }
        : centroids[sums.indexOf(s)]
    );
  }

  // Build cluster objects: centroid + member points
  const clusters = centroids.map((centroid, ci) => ({
    centroid,
    members: points.filter((_, i) => assignments[i] === ci),
  }));

  return clusters.filter((c) => c.members.length > 0);
}

// ---------------------------------------------------------------------------
// Splitter ratio suggestion
// ---------------------------------------------------------------------------

function suggestSplitterRatio(clusterSize) {
  if (clusterSize <= 4)  return '1:4';
  if (clusterSize <= 8)  return '1:8';
  if (clusterSize <= 16) return '1:16';
  if (clusterSize <= 32) return '1:32';
  return '1:64';
}

// ---------------------------------------------------------------------------
// simulateExpansion
// ---------------------------------------------------------------------------

/**
 * @param {{ polygon: Array<{lat,lng}>, projeto_id: string, demandDensity?: string }} params
 * @returns {Promise<object>}
 */
export async function simulateExpansion({ polygon, projeto_id, demandDensity = 'medium' }) {
  await connectDB();

  // --- 1. Fetch existing network ---
  const [allCTOs, allCDOs, allOLTs, allRotas] = await Promise.all([
    CTO.find({ projeto_id }).lean(),
    CaixaEmendaCDO.find({ projeto_id }).lean(),
    OLT.find({ projeto_id }).lean(),
    Rota.find({ projeto_id }).lean(),
  ]);

  // Filter to only those with valid coordinates
  const ctos  = allCTOs.filter((c) => c.lat != null && c.lng != null);
  const cdos  = allCDOs.filter((c) => c.lat != null && c.lng != null);
  const olts  = allOLTs.filter((o) => o.lat != null && o.lng != null);

  // --- 2. Generate demand grid ---
  const spacingM      = DEMAND_SPACING[demandDensity] ?? DEMAND_SPACING.medium;
  const demandPoints  = generateDemandGrid(polygon, spacingM);
  const totalDemand   = demandPoints.length;

  // --- 3. Find uncovered demand points ---
  const covered = (point) =>
    ctos.some(
      (cto) => haversineMeters(point.lat, point.lng, cto.lat, cto.lng) <= COVERAGE_RADIUS_M
    );

  const uncovered = demandPoints.filter((p) => !covered(p));

  const uncoveredPercent =
    totalDemand > 0 ? Math.round((uncovered.length / totalDemand) * 100) : 0;

  // --- 4. K-means clustering of uncovered points ---
  // 1 cluster per ~400 m² area (approx from bounding box)
  const bb          = boundingBox(polygon);
  const widthM      = haversineMeters(bb.minLat, bb.minLng, bb.minLat, bb.maxLng);
  const heightM     = haversineMeters(bb.minLat, bb.minLng, bb.maxLat, bb.minLng);
  const areaM2      = widthM * heightM;
  const kRaw        = Math.max(1, Math.ceil(areaM2 / 400_000));
  const k           = Math.min(kRaw, 10, uncovered.length || 1);

  const clusters = uncovered.length > 0 ? kmeans(uncovered, k) : [];

  // --- 5. Build routing graph ---
  const { graph, nodes } = buildGraphFromNetwork(ctos, cdos, olts, allRotas);

  // Collect anchor nodes (CDOs + OLTs as injection points)
  const anchorNodes = [
    ...cdos.map((c) => ({ id: `cdo:${c.id}`, lat: c.lat, lng: c.lng, nome: c.nome ?? c.id })),
    ...olts.map((o) => ({ id: `olt:${o.id}`, lat: o.lat, lng: o.lng, nome: o.nome })),
  ];

  // --- 6. Per-cluster plan ---
  const suggestedCTOs = [];
  let totalNewFiberM   = 0;
  let totalFiberCost   = 0;
  let totalLaborCost   = 0;
  let totalEquipCost   = 0;

  for (const cluster of clusters) {
    const { centroid, members } = cluster;
    const clusterSize           = members.length;
    const splitterRatio         = suggestSplitterRatio(clusterSize);

    // Find nearest anchor node
    let nearestAnchor   = null;
    let nearestAnchorDist = Infinity;
    for (const anchor of anchorNodes) {
      const d = haversineMeters(centroid.lat, centroid.lng, anchor.lat, anchor.lng);
      if (d < nearestAnchorDist) {
        nearestAnchorDist = d;
        nearestAnchor     = anchor;
      }
    }

    // Virtual node IDs for the new CTO position
    const newNodeId = `new_cto:${suggestedCTOs.length}`;
    nodes[newNodeId] = { id: newNodeId, lat: centroid.lat, lng: centroid.lng, type: 'new_cto' };
    graph.edges[newNodeId] = [];

    let routeResult  = null;
    let distanceM    = nearestAnchorDist;

    if (nearestAnchor && nearestAnchorDist < 5000) {
      const anchorNodeId = nearestAnchor.id;

      // Connect virtual node to anchor and existing nodes within 1 km
      for (const [nid, ndata] of Object.entries(nodes)) {
        if (nid === newNodeId) continue;
        const d = haversineMeters(centroid.lat, centroid.lng, ndata.lat, ndata.lng);
        if (d <= 1000) {
          const w = d * 1.0;
          graph.edges[newNodeId].push({ to: nid, weight: w, distance: d, isReuse: false });
          if (!graph.edges[nid]) graph.edges[nid] = [];
          graph.edges[nid].push({ to: newNodeId, weight: w, distance: d, isReuse: false });
        }
      }

      routeResult = aStar(graph, anchorNodeId, newNodeId, nodes);
      if (routeResult) distanceM = routeResult.distance;
    }

    // Cost estimation
    const fiberCosts = estimateFiberCost(distanceM);
    const equipCost  = estimateCTOCost(splitterRatio);

    totalNewFiberM   += distanceM;
    totalFiberCost   += fiberCosts.fiberCost;
    totalLaborCost   += fiberCosts.laborCost;
    totalEquipCost   += equipCost;

    const signalResult = calculateSignal({
      oltPower:      OLT_DEFAULT_POWER,
      splitterRatio,
      distanceKm:    distanceM / 1000,
      numConnectors: 4,
      numSplices:    2,
    });

    suggestedCTOs.push({
      lat:            centroid.lat,
      lng:            centroid.lng,
      splitterRatio,
      clusterSize,
      nearestAnchor:  nearestAnchor
        ? { id: nearestAnchor.id, nome: nearestAnchor.nome }
        : null,
      route:          routeResult?.path ?? null,
      distanceM:      Math.round(distanceM),
      estimatedCost: {
        fiber:     fiberCosts.fiberCost,
        labor:     fiberCosts.laborCost,
        equipment: equipCost,
        total:     Math.round((fiberCosts.fiberCost + fiberCosts.laborCost + equipCost) * 100) / 100,
      },
      signalResult,
    });
  }

  // --- 7. AI insights ---
  const aiInsights = buildInsights({
    ctos, cdos, olts, suggestedCTOs, uncoveredPercent, demandDensity, totalNewFiberM,
  });

  // Coverage improvement estimate
  const newlyCovered       = uncovered.filter((p) =>
    suggestedCTOs.some(
      (sc) => haversineMeters(p.lat, p.lng, sc.lat, sc.lng) <= COVERAGE_RADIUS_M
    )
  ).length;
  const coverageImprovement =
    uncovered.length > 0 ? Math.round((newlyCovered / totalDemand) * 100) : 0;

  return {
    polygon,
    existingNetwork: {
      ctos: ctos.length,
      cdos: cdos.length,
    },
    uncoveredArea:    uncoveredPercent,
    suggestedCTOs,
    totalNewFiber:    Math.round(totalNewFiberM),
    totalCost: {
      fiber:     Math.round(totalFiberCost * 100) / 100,
      labor:     Math.round(totalLaborCost * 100) / 100,
      equipment: Math.round(totalEquipCost * 100) / 100,
      total:     Math.round((totalFiberCost + totalLaborCost + totalEquipCost) * 100) / 100,
    },
    aiInsights,
    coverageImprovement,
  };
}

// ---------------------------------------------------------------------------
// AI insights builder
// ---------------------------------------------------------------------------

function buildInsights({ ctos, cdos, olts, suggestedCTOs, uncoveredPercent, demandDensity, totalNewFiberM }) {
  const insights = [];

  if (uncoveredPercent > 50) {
    insights.push(
      `Alta área descoberta (${uncoveredPercent}%). Considere expandir antes de saturar CTOs existentes.`
    );
  } else if (uncoveredPercent < 10) {
    insights.push(
      `Cobertura já é boa (${uncoveredPercent}% descoberto). Foque em otimizar capacidade das CTOs existentes.`
    );
  }

  if (cdos.length === 0 && olts.length === 0) {
    insights.push(
      'Nenhum CDO ou OLT encontrado na área. Planeje a infraestrutura de backbone antes das CTOs.'
    );
  }

  if (suggestedCTOs.length > 0) {
    const avgDist = Math.round(
      suggestedCTOs.reduce((acc, c) => acc + c.distanceM, 0) / suggestedCTOs.length
    );
    insights.push(
      `${suggestedCTOs.length} nova(s) CTO(s) sugerida(s). Distância média ao ponto de injeção: ${avgDist} m.`
    );
  }

  const criticalCount = suggestedCTOs.filter(
    (c) => c.signalResult?.status === 'CRITICAL'
  ).length;
  if (criticalCount > 0) {
    insights.push(
      `${criticalCount} ponto(s) com orçamento óptico crítico. Considere amplificadores ou divisão de rota.`
    );
  }

  if (totalNewFiberM > 5000) {
    insights.push(
      `Expansão exige ${(totalNewFiberM / 1000).toFixed(1)} km de fibra nova. Avalie concessão de duto existente.`
    );
  }

  if (demandDensity === 'high') {
    insights.push(
      'Densidade alta configurada — use splitters 1:32 nas CTOs principais para maximizar retorno por ponto.'
    );
  }

  return insights;
}
