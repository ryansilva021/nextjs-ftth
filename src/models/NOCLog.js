/**
 * src/models/NOCLog.js
 * Real-time log entries streamed to the NOC dashboard via SSE.
 * Entries are automatically purged after 24 hours via MongoDB TTL index.
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const NOCLogSchema = new Schema(
  {
    // Multi-tenancy
    projeto_id: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Log entry timestamp
    ts: {
      type:    Date,
      default: () => new Date(),
    },

    // Source tag for grouping (e.g. 'OLT', 'CTO', 'QUEUE', 'SYNC')
    tag: {
      type:    String,
      trim:    true,
      default: 'SYSTEM',
    },

    // Human-readable message
    message: {
      type:     String,
      required: [true, 'message é obrigatório'],
      trim:     true,
    },

    // Severity level
    nivel: {
      type:    String,
      enum:    ['info', 'warn', 'error', 'success'],
      default: 'info',
    },

    // TTL field — MongoDB removes the document after this date
    expireAt: {
      type:    Date,
      default: null,
    },
  },
  {
    // No timestamps needed; we use ts for ordering
    collection: 'noc_logs',
  }
)

// TTL index — automatically removes entries 0 seconds after expireAt
NOCLogSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

// SSE streaming index: latest logs first, filtered by project
NOCLogSchema.index({ projeto_id: 1, ts: -1 })

// ─── Static helper ────────────────────────────────────────────────────────────

/**
 * Creates a NOCLog entry with a 24-hour TTL.
 *
 * @param {string|null} projeto_id
 * @param {string} tag
 * @param {string} message
 * @param {'info'|'warn'|'error'|'success'} nivel
 * @returns {Promise<import('mongoose').Document>}
 */
NOCLogSchema.statics.log = function (projeto_id, tag, message, nivel = 'info') {
  const now = new Date()
  const expireAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return this.create({ projeto_id, tag, message, nivel, ts: now, expireAt })
}

export const NOCLog = models.NOCLog || model('NOCLog', NOCLogSchema)
