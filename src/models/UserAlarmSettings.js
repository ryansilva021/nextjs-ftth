/**
 * UserAlarmSettings.js
 * Preferências pessoais de despertador de ponto por usuário.
 * Permite ao backend (cron) enviar push mesmo com o app fechado.
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const alarmEntry = {
  enabled: { type: Boolean, default: false },
  time:    { type: String,  default: '08:00' },
}

const UserAlarmSettingsSchema = new Schema(
  {
    username:   { type: String, required: true, unique: true, index: true },
    projeto_id: { type: String, required: true },
    alarms: {
      entrada:       alarmEntry,
      almoco_inicio: { enabled: { type: Boolean, default: false }, time: { type: String, default: '12:00' } },
      almoco_fim:    { enabled: { type: Boolean, default: false }, time: { type: String, default: '13:00' } },
      saida:         { enabled: { type: Boolean, default: false }, time: { type: String, default: '18:00' } },
    },
  },
  {
    timestamps: true,
    collection: 'user_alarm_settings',
  }
)

export const UserAlarmSettings =
  models.UserAlarmSettings ?? model('UserAlarmSettings', UserAlarmSettingsSchema)
