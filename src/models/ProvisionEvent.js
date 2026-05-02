/**
 * src/models/ProvisionEvent.js
 * Event queue for ONU install/cancel operations.
 * The NOC worker processes events in FIFO order.
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const ProvisionEventSchema = new Schema(
  {
    // Multi-tenancy
    projeto_id: {
      type:     String,
      required: [true, 'projeto_id é obrigatório'],
      trim:     true,
    },

    // Operation type
    tipo: {
      type:     String,
      enum:     ['install', 'cancel'],
      required: [true, 'tipo é obrigatório'],
    },

    // Lifecycle status of this event
    status: {
      type:    String,
      enum:    ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
    },

    cliente: {
      type:    String,
      trim:    true,
      default: null,
    },

    // ONU serial number target of this event
    serial: {
      type:    String,
      trim:    true,
      uppercase: true,
      default: null,
    },

    // Target OLT id (optional — auto-resolved from CTO topology if not set)
    olt_id: {
      type:    String,
      default: null,
    },

    // Target PON port on the OLT
    pon_port: {
      type:    Number,
      default: null,
    },

    // Target CTO id for port allocation
    cto_id: {
      type:    String,
      default: null,
    },

    // Retry counter for failed events
    attempts: {
      type:    Number,
      default: 0,
    },

    // Error message from last failed attempt
    last_error: {
      type:    String,
      default: null,
    },

    // When the event was moved to done/failed
    processed_at: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'provision_events',
  }
)

// Worker polling index: find oldest pending events for a project
ProvisionEventSchema.index({ projeto_id: 1, status: 1, tipo: 1 })

// FIFO ordering by creation time
ProvisionEventSchema.index({ createdAt: 1 })

export const ProvisionEvent = models.ProvisionEvent || model('ProvisionEvent', ProvisionEventSchema)
