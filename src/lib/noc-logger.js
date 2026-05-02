/**
 * src/lib/noc-logger.js
 * Thin wrapper around NOCLog.log() for use in server actions and background workers.
 * Never throws — log failures are silently absorbed to avoid disrupting business logic.
 */

import { connectDB } from '@/lib/db'
import { NOCLog } from '@/models/NOCLog'

/**
 * Writes a NOCLog entry with a 24-hour TTL.
 * Safe to call from any server-side context.
 *
 * @param {string|null} projeto_id
 * @param {string} tag - Source tag (e.g. 'OLT', 'CTO', 'QUEUE', 'SYNC')
 * @param {string} message
 * @param {'info'|'warn'|'error'|'success'} nivel
 * @returns {Promise<void>}
 */
export async function nocLog(projeto_id, tag, message, nivel = 'info') {
  try {
    await connectDB()
    await NOCLog.log(projeto_id, tag, message, nivel)
  } catch (err) {
    // Log failures must never surface to the caller
    console.error('[NOCLog] Failed to write log entry:', err.message)
  }
}
