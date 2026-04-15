/**
 * src/lib/os-events.js
 * Global in-process event bus for OS real-time notifications (SSE).
 *
 * Uses `global` to survive Next.js hot-reload in development.
 * Works on a single Node.js server instance — not suitable for multi-replica deploys.
 */

import { EventEmitter } from 'events'

const emitter = global.__osEventsEmitter ?? new EventEmitter()
global.__osEventsEmitter = emitter
emitter.setMaxListeners(200)

export default emitter
