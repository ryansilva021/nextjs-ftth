/**
 * src/models/WebhookLog.js
 *
 * Registra todos os eventos recebidos via webhook de provedores externos (Asaas, etc.).
 * TTL de 90 dias para manter o tamanho da coleção controlado.
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const WebhookLogSchema = new Schema(
  {
    // Provedor do webhook: 'asaas', 'stripe', etc.
    provider: {
      type:     String,
      required: true,
      index:    true,
    },

    // Tipo do evento: 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', etc.
    event_type: {
      type:     String,
      required: true,
      index:    true,
    },

    // ID do objeto no provedor (asaas payment id, subscription id, etc.)
    external_id: {
      type:    String,
      default: null,
      index:   true,
    },

    // ID da empresa afetada (quando identificável)
    empresa_id: {
      type:    String,
      default: null,
      index:   true,
    },

    // Payload completo recebido
    payload: {
      type: Schema.Types.Mixed,
    },

    // Se o evento foi processado com sucesso
    processed: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    // Mensagem de erro em caso de falha no processamento
    error: {
      type:    String,
      default: null,
    },

    // Timestamp de criação — usado pelo TTL index
    created_at: {
      type:    Date,
      default: () => new Date(),
    },
  },
  {
    collection: 'webhook_logs',
    // Sem timestamps automáticos — created_at é gerenciado manualmente para o TTL
  }
)

// TTL: remove registros após 90 dias
WebhookLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 })

// ---------------------------------------------------------------------------
// HMR cache clearing (Next.js dev mode)
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'production' && models.WebhookLog) {
  delete models.WebhookLog
}

export const WebhookLog = models.WebhookLog || model('WebhookLog', WebhookLogSchema)
