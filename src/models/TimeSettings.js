/**
 * TimeSettings.js
 * Configurações de horários de ponto por projeto (configuradas pelo admin).
 * Collection: time_settings
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const TimeSettingsSchema = new Schema(
  {
    // Isolamento multi-tenant — um registro por projeto
    projeto_id: {
      type:     String,
      required: [true, 'projeto_id é obrigatório'],
      unique:   true,
      index:    true,
    },

    // Horários no formato 'HH:mm'
    entrada:       { type: String, default: '08:00' },
    almoco_inicio: { type: String, default: '12:00' },
    almoco_fim:    { type: String, default: '13:00' },
    saida:         { type: String, default: '18:00' },

    // Alertas opcionais (pode desativar cada um)
    alerta_entrada:       { type: Boolean, default: true },
    alerta_almoco_inicio: { type: Boolean, default: true },
    alerta_almoco_fim:    { type: Boolean, default: true },
    alerta_saida:         { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'time_settings',
  }
)

export const TimeSettings = models.TimeSettings || model('TimeSettings', TimeSettingsSchema)
