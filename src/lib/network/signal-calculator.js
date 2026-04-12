/**
 * signal-calculator.js
 * Optical power budget calculator for GPON/FTTH networks.
 *
 * Reference standard: ITU-T G.984 (GPON), SMF fiber at 1310 nm downstream.
 */

// ---------------------------------------------------------------------------
// Physical constants
// ---------------------------------------------------------------------------

export const FIBER_ATTENUATION_DB_KM = 0.35;  // dB/km — SMF at 1310 nm
export const CONNECTOR_LOSS_DB       = 0.5;   // dB per connector pair
export const SPLICE_LOSS_DB          = 0.1;   // dB per mechanical splice
export const ONU_SENSITIVITY_MIN     = -27.0; // dBm — GPON minimum receive power
export const ONU_SENSITIVITY_MAX     = -8.0;  // dBm — ONU overload threshold

export const SPLITTER_LOSSES = {
  '1:2':  3.5,
  '1:4':  7.0,
  '1:8':  10.5,
  '1:16': 13.5,
  '1:32': 16.8,
  '1:64': 20.3,
};

export const COST_PER_METER        = 3.50; // BRL — fiber material cost per meter
export const LABOR_COST_PER_METER  = 8.00; // BRL — installation labor per meter

const CTO_EQUIPMENT_COSTS = {
  '1:8':  280,
  '1:16': 450,
  '1:32': 780,
};
const DEFAULT_CTO_COST = 450;

// ---------------------------------------------------------------------------
// calculateSignal
// ---------------------------------------------------------------------------

/**
 * Computes end-to-end optical power budget for a single ONU path.
 *
 * @param {object} params
 * @param {number} params.oltPower       - OLT transmit power in dBm (e.g. 5)
 * @param {string} params.splitterRatio  - e.g. '1:8', '1:16', '1:32'
 * @param {number} params.distanceKm     - fiber span in km
 * @param {number} [params.numConnectors=4] - number of connector pairs in path
 * @param {number} [params.numSplices=2]    - number of field splices
 * @returns {{
 *   finalPower:    number,
 *   totalLoss:     number,
 *   splitterLoss:  number,
 *   fiberLoss:     number,
 *   connectorLoss: number,
 *   spliceLoss:    number,
 *   status:        'GOOD'|'WARNING'|'CRITICAL',
 *   statusLabel:   string,
 *   margin:        number
 * }}
 */
export function calculateSignal({
  oltPower,
  splitterRatio,
  distanceKm,
  numConnectors = 4,
  numSplices    = 2,
}) {
  const splitterLoss  = SPLITTER_LOSSES[splitterRatio] ?? SPLITTER_LOSSES['1:16'];
  const fiberLoss     = FIBER_ATTENUATION_DB_KM * distanceKm;
  const connectorLoss = CONNECTOR_LOSS_DB * numConnectors;
  const spliceLoss    = SPLICE_LOSS_DB    * numSplices;

  const totalLoss  = splitterLoss + fiberLoss + connectorLoss + spliceLoss;
  const finalPower = oltPower - totalLoss;

  const margin = finalPower - ONU_SENSITIVITY_MIN;

  let status, statusLabel;
  if (finalPower > ONU_SENSITIVITY_MAX || finalPower < ONU_SENSITIVITY_MIN) {
    status      = 'CRITICAL';
    statusLabel = finalPower > ONU_SENSITIVITY_MAX ? 'Potência excessiva' : 'Sinal insuficiente';
  } else if (finalPower < -24.0) {
    status      = 'WARNING';
    statusLabel = 'Sinal fraco — verificar';
  } else {
    status      = 'GOOD';
    statusLabel = 'Sinal dentro do padrão';
  }

  return {
    finalPower:    Math.round(finalPower * 100) / 100,
    totalLoss:     Math.round(totalLoss  * 100) / 100,
    splitterLoss,
    fiberLoss:     Math.round(fiberLoss     * 100) / 100,
    connectorLoss: Math.round(connectorLoss * 100) / 100,
    spliceLoss:    Math.round(spliceLoss    * 100) / 100,
    status,
    statusLabel,
    margin:        Math.round(margin * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// classifySignal
// ---------------------------------------------------------------------------

/**
 * Classifies a received optical power level.
 *
 * @param {number} powerDbm - received power in dBm
 * @returns {{ status: string, label: string, color: string }}
 */
export function classifySignal(powerDbm) {
  if (powerDbm > ONU_SENSITIVITY_MAX || powerDbm < ONU_SENSITIVITY_MIN) {
    const label = powerDbm > ONU_SENSITIVITY_MAX
      ? 'Potência excessiva'
      : 'Sem sinal / abaixo do limiar';
    return { status: 'CRITICAL', label, color: '#ef4444' };
  }

  if (powerDbm < -24.0) {
    return { status: 'WARNING', label: 'Sinal fraco', color: '#ff8000' };
  }

  return { status: 'GOOD', label: 'Sinal OK', color: '#22c55e' };
}

// ---------------------------------------------------------------------------
// estimateFiberCost
// ---------------------------------------------------------------------------

/**
 * Estimates the cost to deploy a given fiber span.
 *
 * @param {number} meters - fiber span length in meters
 * @returns {{ fiberCost: number, laborCost: number, totalCost: number }}
 */
export function estimateFiberCost(meters) {
  const fiberCost = Math.round(meters * COST_PER_METER * 100) / 100;
  const laborCost = Math.round(meters * LABOR_COST_PER_METER * 100) / 100;
  return {
    fiberCost,
    laborCost,
    totalCost: Math.round((fiberCost + laborCost) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// estimateCTOCost
// ---------------------------------------------------------------------------

/**
 * Returns estimated equipment cost for a CTO based on splitter ratio.
 *
 * @param {string} splitterRatio - e.g. '1:8', '1:16', '1:32'
 * @returns {number} cost in BRL
 */
export function estimateCTOCost(splitterRatio) {
  return CTO_EQUIPMENT_COSTS[splitterRatio] ?? DEFAULT_CTO_COST;
}
