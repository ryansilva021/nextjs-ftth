/**
 * TimeRecord.js
 * Registros de ponto dos usuários (controle de jornada).
 * Collection: time_records
 * Regra: um registro por usuário por dia (índice único userId + date).
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

// Sub-schema de localização (opcional — capturado via Geolocation API)
const LocationSchema = new Schema(
  {
    lat:      { type: Number, required: true },
    lng:      { type: Number, required: true },
    accuracy: { type: Number },           // metros
  },
  { _id: false }
)

const TimeRecordSchema = new Schema(
  {
    // Identificação do usuário (username — chave usada em todo o projeto)
    userId: {
      type:     String,
      required: [true, 'userId é obrigatório'],
      index:    true,
    },

    // Isolamento multi-tenant
    projeto_id: {
      type:     String,
      required: [true, 'projeto_id é obrigatório'],
      index:    true,
    },

    // Data no formato 'YYYY-MM-DD' — facilita queries por dia sem fuso
    date: {
      type:     String,
      required: [true, 'date é obrigatório'],
      match:    [/^\d{4}-\d{2}-\d{2}$/, 'date deve estar no formato YYYY-MM-DD'],
    },

    // ── Marcações de tempo ────────────────────────────────────────────────────
    entrada:     { type: Date, default: null },
    pausaInicio: { type: Date, default: null },
    pausaFim:    { type: Date, default: null },
    saida:       { type: Date, default: null },

    // ── Localização (entrada e saída) ─────────────────────────────────────────
    entradaLocation: { type: LocationSchema, default: null },
    saidaLocation:   { type: LocationSchema, default: null },

    // ── Status atual do dia ───────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['trabalhando', 'em_pausa', 'finalizado'],
      default: 'trabalhando',
    },
  },
  {
    timestamps:  true,
    collection:  'time_records',
  }
)

// Um registro por usuário por dia
TimeRecordSchema.index({ userId: 1, date: 1 }, { unique: true })

export const TimeRecord = models.TimeRecord || model('TimeRecord', TimeRecordSchema)
