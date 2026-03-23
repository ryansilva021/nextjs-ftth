import mongoose from 'mongoose'

const EventLogSchema = new mongoose.Schema({
  tipo_acao:  { type: String, enum: ['criou', 'editou', 'excluiu'], required: true },
  entidade:   { type: String, required: true }, // 'cto' | 'caixa' | 'rota' | 'poste' | 'olt' | 'fusao' | 'usuario'
  item_id:    { type: String, required: true },
  item_nome:  { type: String, default: '' },
  user_id:    { type: String, required: true },
  username:   { type: String, default: '' },
  projeto_id: { type: String, required: true },
  timestamp:  { type: Date, default: Date.now },
}, { collection: 'event_logs' })

EventLogSchema.index({ projeto_id: 1, timestamp: -1 })

export const EventLog = mongoose.models.EventLog ?? mongoose.model('EventLog', EventLogSchema)
