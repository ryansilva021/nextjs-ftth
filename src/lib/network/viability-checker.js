/**
 * viability-checker.js
 * Finds the best CTO(s) to serve a target geographic coordinate.
 *
 * Scoring heuristic:
 *   score = (1000 / distanceMeters) + (10 * availablePorts) - (totalLoss * 5)
 *
 * Higher score = better option. Top 5 results are returned.
 */

import { connectDB }       from '@/lib/db';
import { CTO }             from '@/models/CTO';
import { haversineMeters } from './dijkstra';
import { calculateSignal } from './signal-calculator';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RANGE_M      = 2000;  // meters — maximum search radius
const OLT_DEFAULT_POWER = 5;    // dBm — typical GPON OLT transmit power
const DEFAULT_SPLITTER  = '1:16';
const TOP_N_RESULTS     = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Counts occupied ports in a CTO diagrama.
 * Supports both legacy and current schema shapes.
 *
 * @param {object} cto - CTO document (plain object)
 * @returns {number}
 */
function countOcupacao(cto) {
  // Fast path: explicit field
  if (typeof cto.ocupacao === 'number') return cto.ocupacao;

  const diagrama = cto.diagrama;
  if (!diagrama) return 0;

  // Current format: diagrama.portas is a Map or plain object
  if (diagrama.portas) {
    const portas = diagrama.portas instanceof Map
      ? [...diagrama.portas.values()]
      : Object.values(diagrama.portas);
    return portas.filter((p) => p && p.cliente).length;
  }

  // Alternate format: diagrama.splitters[*].portas[*].status
  if (Array.isArray(diagrama.splitters)) {
    let count = 0;
    for (const splitter of diagrama.splitters) {
      if (Array.isArray(splitter.portas)) {
        for (const porta of splitter.portas) {
          if (porta?.status && porta.status !== 'livre') count++;
        }
      }
    }
    return count;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// checkViability
// ---------------------------------------------------------------------------

/**
 * Finds and ranks the best available CTOs to serve a target location.
 *
 * @param {{ lat: number, lng: number, projeto_id: string }} params
 * @returns {Promise<{
 *   viable:          boolean,
 *   target:          { lat: number, lng: number },
 *   recommendations: object[],
 *   bestCTO:         object | null,
 *   maxRange:        number
 * }>}
 */
export async function checkViability({ lat, lng, projeto_id }) {
  await connectDB();

  const allCTOs = await CTO.find({ projeto_id }).lean();

  // Filter 1: geographic range
  const nearby = allCTOs.filter((cto) => {
    if (cto.lat == null || cto.lng == null) return false;
    return haversineMeters(lat, lng, cto.lat, cto.lng) <= MAX_RANGE_M;
  });

  // Filter 2: has available ports
  const viable = nearby.filter((cto) => {
    const ocupacao       = countOcupacao(cto);
    const capacidade     = cto.capacidade ?? 0;
    return capacidade > 0 && ocupacao < capacidade;
  });

  // Compute per-CTO metrics and score
  const recommendations = viable.map((cto) => {
    const distanceMeters = haversineMeters(lat, lng, cto.lat, cto.lng);
    const ocupacao       = countOcupacao(cto);
    const availablePorts = (cto.capacidade ?? 0) - ocupacao;
    const splitterRatio  = cto.splitter_cto ?? DEFAULT_SPLITTER;
    const distanceKm     = distanceMeters / 1000;

    const signalResult = calculateSignal({
      oltPower:      OLT_DEFAULT_POWER,
      splitterRatio,
      distanceKm,
      numConnectors: 4,
      numSplices:    2,
    });

    // Penalize heavily if signal is critical
    const signalPenalty = signalResult.status === 'CRITICAL' ? 200 : 0;

    const score =
      (1000 / Math.max(distanceMeters, 1)) +
      (10 * availablePorts) -
      (signalResult.totalLoss * 5) -
      signalPenalty;

    return {
      cto: {
        _id:         cto._id,
        cto_id:      cto.cto_id,
        nome:        cto.nome,
        lat:         cto.lat,
        lng:         cto.lng,
        capacidade:  cto.capacidade,
        splitter_cto: cto.splitter_cto,
        cdo_id:      cto.cdo_id,
      },
      distanceMeters:  Math.round(distanceMeters),
      availablePorts,
      signalResult,
      score:           Math.round(score * 100) / 100,
    };
  });

  // Sort by score descending, take top N
  recommendations.sort((a, b) => b.score - a.score);
  const top = recommendations.slice(0, TOP_N_RESULTS);

  return {
    viable:          top.length > 0,
    target:          { lat, lng },
    recommendations: top,
    bestCTO:         top[0] ?? null,
    maxRange:        MAX_RANGE_M,
  };
}
