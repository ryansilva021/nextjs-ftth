/**
 * POST /api/network/optimize-route
 *
 * Finds the optimal fiber path between two geographic coordinates using A*.
 *
 * Body: {
 *   startLat:   number
 *   startLng:   number
 *   endLat:     number
 *   endLng:     number
 *   projeto_id: string
 * }
 *
 * Returns:
 * {
 *   ok:          boolean
 *   path:        Array<{ id, lat, lng, type }>
 *   totalMeters: number
 *   totalCost:   number   — weighted cost (not BRL)
 *   routeType:   string   — predominant fiber type on path
 *   fiberCost:   object   — BRL cost estimate
 * }
 */

import { NextResponse }         from 'next/server';
import { connectDB }            from '@/lib/db';
import { CTO }                  from '@/models/CTO';
import { CaixaEmendaCDO }       from '@/models/CaixaEmendaCDO';
import { OLT }                  from '@/models/OLT';
import { Rota }                 from '@/models/Rota';
import {
  buildGraphFromNetwork,
  aStar,
  haversineMeters,
} from '@/lib/network/dijkstra';
import { estimateFiberCost }    from '@/lib/network/signal-calculator';

// How close a virtual node must connect to existing nodes (meters)
const VIRTUAL_CONNECT_RADIUS = 1500;

export async function POST(req) {
  try {
    const body = await req.json();
    const { startLat, startLng, endLat, endLng, projeto_id } = body;

    // --- Input validation ---
    const coordFields = { startLat, startLng, endLat, endLng };
    for (const [key, val] of Object.entries(coordFields)) {
      if (typeof val !== 'number' || isNaN(val)) {
        return NextResponse.json(
          { error: `${key} deve ser um número.` },
          { status: 400 }
        );
      }
    }

    if (startLat < -90 || startLat > 90 || endLat < -90 || endLat > 90) {
      return NextResponse.json({ error: 'Latitude fora do intervalo [-90, 90].' }, { status: 400 });
    }
    if (startLng < -180 || startLng > 180 || endLng < -180 || endLng > 180) {
      return NextResponse.json({ error: 'Longitude fora do intervalo [-180, 180].' }, { status: 400 });
    }

    if (!projeto_id || typeof projeto_id !== 'string' || projeto_id.trim() === '') {
      return NextResponse.json({ error: 'projeto_id é obrigatório.' }, { status: 400 });
    }

    // --- Fetch network data ---
    await connectDB();

    const pid = projeto_id.trim();
    const [ctos, cdos, olts, rotas] = await Promise.all([
      CTO.find({ projeto_id: pid }).lean(),
      CaixaEmendaCDO.find({ projeto_id: pid }).lean(),
      OLT.find({ projeto_id: pid }).lean(),
      Rota.find({ projeto_id: pid }).lean(),
    ]);

    // --- Build graph ---
    const { graph, nodes } = buildGraphFromNetwork(ctos, cdos, olts, rotas);

    // --- Add virtual start/end nodes ---
    const startId = '__route_start__';
    const endId   = '__route_end__';

    nodes[startId] = { id: startId, lat: startLat, lng: startLng, type: 'virtual' };
    nodes[endId]   = { id: endId,   lat: endLat,   lng: endLng,   type: 'virtual' };
    graph.edges[startId] = [];
    graph.edges[endId]   = [];

    // Connect virtual nodes to nearby existing nodes
    for (const [nid, ndata] of Object.entries(nodes)) {
      if (nid === startId || nid === endId) continue;

      const dStart = haversineMeters(startLat, startLng, ndata.lat, ndata.lng);
      if (dStart <= VIRTUAL_CONNECT_RADIUS) {
        graph.edges[startId].push({ to: nid, weight: dStart, distance: dStart, isReuse: false });
        if (!graph.edges[nid]) graph.edges[nid] = [];
        graph.edges[nid].push({ to: startId, weight: dStart, distance: dStart, isReuse: false });
      }

      const dEnd = haversineMeters(endLat, endLng, ndata.lat, ndata.lng);
      if (dEnd <= VIRTUAL_CONNECT_RADIUS) {
        graph.edges[endId].push({ to: nid, weight: dEnd, distance: dEnd, isReuse: false });
        if (!graph.edges[nid]) graph.edges[nid] = [];
        graph.edges[nid].push({ to: endId, weight: dEnd, distance: dEnd, isReuse: false });
      }
    }

    // Direct edge between start and end as fallback
    const directDist = haversineMeters(startLat, startLng, endLat, endLng);
    graph.edges[startId].push({ to: endId, weight: directDist, distance: directDist, isReuse: false });
    graph.edges[endId].push({ to: startId, weight: directDist, distance: directDist, isReuse: false });

    // --- Run A* ---
    const routeResult = aStar(graph, startId, endId, nodes);

    if (!routeResult) {
      return NextResponse.json(
        { ok: false, error: 'Nenhuma rota encontrada entre os pontos informados.' },
        { status: 404 }
      );
    }

    // --- Build path with coordinates ---
    const pathWithCoords = routeResult.path.map((nodeId) => {
      const n = nodes[nodeId];
      return {
        id:   nodeId,
        lat:  n?.lat  ?? null,
        lng:  n?.lng  ?? null,
        type: n?.type ?? 'unknown',
      };
    });

    // --- Determine predominant route type ---
    const ctosMap = {};
    for (const cto of ctos) ctosMap[`cto:${cto.cto_id}`] = true;

    const routeType = routeResult.path.some((id) => id.startsWith('cto:'))
      ? 'rede_distribuicao'
      : 'backbone';

    const fiberCost = estimateFiberCost(routeResult.distance);

    return NextResponse.json({
      ok:          true,
      path:        pathWithCoords,
      totalMeters: Math.round(routeResult.distance),
      totalCost:   Math.round(routeResult.cost * 100) / 100,
      routeType,
      fiberCost,
    });
  } catch (err) {
    console.error('[optimize-route] Erro:', err);
    return NextResponse.json(
      { error: 'Erro interno ao calcular rota otimizada.', detail: err.message },
      { status: 500 }
    );
  }
}
