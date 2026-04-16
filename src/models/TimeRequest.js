/**
 * TimeRequest.js
 * Solicitações de ajuste/inclusão/ausência de ponto.
 * Nunca altera o TimeRecord diretamente — requer aprovação de admin.
 * Collection: time_requests
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const TimeRequestSchema = new Schema(
  {
    userId:     { type: String, required: true, index: true },
    projeto_id: { type: String, required: true, index: true },

    // Tipo da solicitação
    type: {
      type:     String,
      enum:     ['inclusao', 'ajuste', 'ausencia'],
      required: true,
    },

    // Data principal (YYYY-MM-DD)
    data: { type: String, required: true },

    // Data fim (só para ausências com intervalo)
    dataFim: { type: String, default: null },

    // Para inclusao/ajuste: qual marcação está sendo solicitada
    tipoMarcacao: {
      type: String,
      enum: ['entrada', 'pausa_inicio', 'pausa_fim', 'saida', null],
      default: null,
    },

    // Para ausência: qual tipo
    tipoAusencia: {
      type: String,
      enum: ['falta', 'atestado', 'folga', null],
      default: null,
    },

    // Hora solicitada no formato HH:mm (inclusao/ajuste)
    horaSolicitada: { type: String, default: null },

    // Snapshot dos dados originais no momento do pedido (para ajuste)
    dadosOriginais: { type: Schema.Types.Mixed, default: null },

    // Motivo / observação obrigatório
    motivo: { type: String, required: [true, 'Motivo é obrigatório'], maxlength: 500 },

    // Status da análise
    status: {
      type:    String,
      enum:    ['pendente', 'aprovado', 'rejeitado'],
      default: 'pendente',
      index:   true,
    },

    // Quem aprovou/rejeitou e quando
    resolvidoPor: { type: String, default: null },
    resolvidoEm:  { type: Date,   default: null },
    observacaoAdmin: { type: String, default: null },
  },
  {
    timestamps:  true,
    collection:  'time_requests',
  }
)

export const TimeRequest = models.TimeRequest || model('TimeRequest', TimeRequestSchema)
