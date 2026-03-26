/**
 * src/app/api/ctos/full/route.js
 * GET /api/ctos/full
 *
 * Returns all CTOs with full port occupancy AND joined ONU data per occupied port.
 * [{ id, name, cdo_id, lat, lng, capacidade, ocupadas, livres, pct,
 *    ports: [{ port_number, splitter_nome, status, client: { name, serial, onu_status, rx_power, signal_quality } | null }] }]
 */

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { CTO } from '@/models/CTO'
import { ONU } from '@/models/ONU'

const NOC_ALLOWED = ['superadmin', 'admin', 'noc', 'tecnico']

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  const role    = session?.user?.role ?? 'user'

  if (!NOC_ALLOWED.includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const projeto_id = session.user.projeto_id

  try {
    await connectDB()

    const [ctos, onus] = await Promise.all([
      CTO.find({ projeto_id }, 'cto_id nome cdo_id lat lng diagrama capacidade').lean(),
      ONU.find({ projeto_id, status: { $ne: 'cancelled' } }, 'serial cliente cto_id cto_port status rx_power signal_quality').lean(),
    ])

    // Build a lookup: clienteNome (lowercase) → ONU data
    const onuByCliente = new Map()
    for (const onu of onus) {
      if (onu.cliente?.trim()) {
        onuByCliente.set(onu.cliente.trim().toLowerCase(), onu)
      }
    }

    const result = ctos.map((cto) => {
      const splitters = cto.diagrama?.splitters ?? []
      const ports     = []
      let   portNum   = 0

      for (const splitter of splitters) {
        const saidas = splitter.saidas ?? []
        for (const saida of saidas) {
          portNum++
          const clienteName = saida?.cliente?.trim() || null
          let   client      = null

          if (clienteName) {
            const onu = onuByCliente.get(clienteName.toLowerCase())
            client = {
              name:          clienteName,
              serial:        onu?.serial        ?? null,
              onu_status:    onu?.status        ?? null,
              rx_power:      onu?.rx_power      ?? null,
              signal_quality: onu?.signal_quality ?? null,
            }
          }

          ports.push({
            port_number:   saida.porta ?? portNum,
            splitter_nome: splitter.nome ?? null,
            status:        clienteName ? 'OCUPADO' : 'LIVRE',
            client,
          })
        }
      }

      // Fallback: no splitters → show empty slots
      if (ports.length === 0 && cto.capacidade > 0) {
        for (let i = 1; i <= cto.capacidade; i++) {
          ports.push({ port_number: i, splitter_nome: null, status: 'LIVRE', client: null })
        }
      }

      const ocupadas = ports.filter(p => p.status === 'OCUPADO').length

      return {
        id:         cto.cto_id,
        name:       cto.nome ?? cto.cto_id,
        cdo_id:     cto.cdo_id ?? null,
        lat:        cto.lat,
        lng:        cto.lng,
        capacidade: cto.capacidade ?? ports.length,
        ocupadas,
        livres:     ports.length - ocupadas,
        pct:        ports.length > 0 ? Math.round((ocupadas / ports.length) * 100) : 0,
        ports,
      }
    })

    return Response.json(result)
  } catch (err) {
    console.error('[GET /api/ctos/full]', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
