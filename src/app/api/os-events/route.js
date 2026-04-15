/**
 * GET /api/os-events
 * Server-Sent Events stream for real-time OS notifications.
 *
 * Each connected client receives:
 *   - `nova-os`   — when a new service order is created in the same projeto
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

  const projetoId = session.user.projeto_id
  const encoder   = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Initial heartbeat so the browser knows the connection is alive
      controller.enqueue(encoder.encode(': connected\n\n'))

      function handleNova(event) {
        if (event.projeto_id !== projetoId) return
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
