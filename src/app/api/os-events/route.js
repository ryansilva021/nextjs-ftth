/**
 * GET /api/os-events
 * Server-Sent Events stream for real-time OS notifications.
 *
 * Delivery rules:
 *   - admin / superadmin / recepcao / noc → receive ALL new OS in the projeto
 *   - tecnico → receives ONLY OS where tecnico_id or auxiliar_id matches their username
 *
 * Each connected client receives:
 *   - `nova-os`   — when a new service order is created (filtered per role)
 *   - `: ping`    — heartbeat every 25 s to keep the connection alive
 */

import { auth } from '@/lib/auth'
import emitter  from '@/lib/os-events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { projeto_id: projetoId, role, username } = session.user
  const isTecnico = role === 'tecnico'
  const encoder   = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Initial heartbeat so the browser knows the connection is alive
      controller.enqueue(encoder.encode(': connected\n\n'))

      function handleNova(event) {
        // Always filter by project
        if (event.projeto_id !== projetoId) return

        // Técnicos only see OS assigned to them
        if (isTecnico) {
          const isAssigned =
            event.tecnico_id  === username ||
            event.auxiliar_id === username
          if (!isAssigned) return
        }

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch (_) {
          // Controller already closed
        }
      }

      emitter.on('nova-os', handleNova)

      // Heartbeat every 25 s
      const hbInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch (_) {
          clearInterval(hbInterval)
        }
      }, 25_000)

      // Cleanup when client disconnects
      request.signal.addEventListener('abort', () => {
        emitter.off('nova-os', handleNova)
        clearInterval(hbInterval)
        try { controller.close() } catch (_) {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  })
}
