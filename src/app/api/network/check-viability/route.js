/**
 * POST /api/network/check-viability
 *
 * Finds the best available CTOs to serve a target geographic coordinate.
 *
 * Body: {
 *   lat:        number  — target latitude
 *   lng:        number  — target longitude
 *   projeto_id: string  — tenant identifier
 * }
 */

import { NextResponse }    from 'next/server';
import { checkViability }  from '@/lib/network/viability-checker';

export async function POST(req) {
  try {
    const body = await req.json();
    const { lat, lng, projeto_id } = body;

    // --- Input validation ---
    if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
      return NextResponse.json(
        { error: 'lat deve ser um número entre -90 e 90.' },
        { status: 400 }
      );
    }

    if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'lng deve ser um número entre -180 e 180.' },
        { status: 400 }
      );
    }

    if (!projeto_id || typeof projeto_id !== 'string' || projeto_id.trim() === '') {
      return NextResponse.json(
        { error: 'projeto_id é obrigatório.' },
        { status: 400 }
      );
    }

    const result = await checkViability({
      lat,
      lng,
      projeto_id: projeto_id.trim(),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[check-viability] Erro:', err);
    return NextResponse.json(
      { error: 'Erro interno ao verificar viabilidade.', detail: err.message },
      { status: 500 }
    );
  }
}
