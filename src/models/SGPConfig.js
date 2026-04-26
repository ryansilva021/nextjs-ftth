/**
 * src/models/SGPConfig.js
 * Stores SGP/TMSX connection credentials.
 * Passwords are stored AES-256-CBC encrypted via aes-crypt.js.
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const SGPConfigSchema = new Schema(
  {
    // Multi-tenancy: one config per project
    projeto_id: {
      type:     String,
      required: [true, 'projeto_id é obrigatório'],
      trim:     true,
    },

    // TMSX/SGP host URL (e.g. https://sgp.isp.com.br)
    host: {
      type:    String,
      trim:    true,
      default: null,
    },

    // TMSX login username
    username: {
      type:    String,
      trim:    true,
      default: null,
    },

    // AES-256-CBC encrypted password: "${ivHex}:${cipherBase64}"
    password_enc: {
      type:    String,
      default: null,
    },

    // Whether this integration is enabled
    is_active: {
      type:    Boolean,
      default: true,
    },

    // Timestamp of last successful sync
    last_sync: {
      type:    Date,
      default: null,
    },

    // Stats from last sync run
    last_sync_stats: {
      novos:         { type: Number, default: 0 },
      cancelamentos: { type: Number, default: 0 },
      sincronizados: { type: Number, default: 0 }, // status updates (reactivations + suspensions)
      erros:         { type: Number, default: 0 },
    },

    // Lock flag while sync is running (prevents concurrent syncs)
    is_syncing: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'sgp_configs',
  }
)

// One SGP config per project
SGPConfigSchema.index({ projeto_id: 1 }, { unique: true })

export const SGPConfig = models.SGPConfig || model('SGPConfig', SGPConfigSchema)
