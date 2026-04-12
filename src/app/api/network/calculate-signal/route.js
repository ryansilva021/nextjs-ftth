/**
 * POST /api/network/calculate-signal
 *
 * Computes optical power budget for a given fiber path.
 *
 * Body: {
 *   oltPower:      number   — OLT transmit power in dBm (e.g. 5)
 *   splitterRatio: string   — e.g. "1:8", "1:16", "1:32"
 *   distanceKm:    number   — total fiber span in km
 *   numConnectors: number?  — connector pairs (default 4)
 *   numSplices:    number?  — field splices (default 2)
 * }
 */

import { NextResponse }      from 'next/server';
import { calculateSignal, SPLITTER_LOSSES } from '@/lib/network/signal-calculator';

const VALID_SPLITTERS = Object.keys(SPLITTER_LOSSES);

export async function POST(req) {
  try {
    const body = await req.json();

    const { oltPower, splitterRatio, distanceKm, numConnectors, numSplices } = body;

    // --- Input validation ---
    if (typeof oltPower !== 'number' || isNaN(oltPower)) {
      return NextResponse.json(
        { error: 'oltPower deve ser um número (dBm).' },
        { status: 400 }
      );
    }

    if (!splitterRatio || !VALID_SPLITTERS.includes(splitterRatio)) {
      return NextResponse.json(
        { error: `splitterRatio inválido. Valores aceitos: ${VALID_SPLITTERS.join(', ')}.` },
        { status: 400 }
      );
    }

    if (typeof distanceKm !== 'number' || isNaN(distanceKm) || distanceKm < 0) {
      return NextResponse.json(
        { error: 'distanceKm deve ser um número positivo.' },
        { status: 400 }
      );
    }

    if (numConnectors !== undefined && (typeof numConnectors !== 'number' || numConnectors < 0)) {
      return NextResponse.json(
        { error: 'numConnectors deve ser um número inteiro >= 0.' },
        { status: 400 }
      );
    }

    if (numSplices !== undefined && (typeof numSplices !== 'number' || numSplices < 0)) {
      return NextResponse.json(
        { error: 'numSplices deve ser um número inteiro >= 0.' },
        { status: 400 }
      );
    }

    const result = calculateSignal({
      oltPower,
      splitterRatio,
      distanceKm,
      numConnectors: numConnectors ?? 4,
      numSplices:    numSplices    ?? 2,
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[calculate-signal] Erro:', err);
    return NextResponse.json(
      { error: 'Erro interno ao calcular sinal óptico.', detail: err.message },
      { status: 500 }
    );
  }
}
