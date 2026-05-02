/**
 * ServiceOrder.js
 * Ordem de Serviço (OS) — fluxo completo de provedor FTTH.
 * Tipos: instalacao, manutencao, suporte, cancelamento
 * Fluxo: aberta → agendada → em_andamento → concluida | cancelada
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

// Gera ID legível: OS-YYYYMMDD-XXXX
function gerarOsId() {
  const d = new Date()
  const data = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `OS-${data}-${rand}`
}

const ServiceOrderSchema = new Schema(
  {
    projeto_id: { type: String, required: true, trim: true },

    // Identificador legível (ex: OS-20240315-AB3C) — gerado automaticamente
    os_id: { type: String, trim: true, default: gerarOsId },

    tipo: {
      type: String,
      enum: ['instalacao', 'manutencao', 'suporte', 'cancelamento'],
      required: true,
    },

    status: {
      type: String,
      enum: ['aberta', 'agendada', 'em_andamento', 'concluida', 'cancelada'],
      default: 'aberta',
    },

    prioridade: {
      type: String,
      enum: ['baixa', 'normal', 'alta', 'urgente'],
      default: 'normal',
    },

    // Dados do cliente
    cliente_nome:     { type: String, trim: true, default: null },
    cliente_contato:  { type: String, trim: true, default: null },
    cliente_endereco: { type: String, trim: true, default: null },

    // Equipe responsável
    tecnico_nome:   { type: String, trim: true, default: null },
    tecnico_id:     { type: String, trim: true, default: null },
    auxiliar_nome:  { type: String, trim: true, default: null },
    auxiliar_id:    { type: String, trim: true, default: null },

    // Dados de rede (opcionais na abertura, preenchidos na execução)
    olt_id:     { type: String, trim: true, default: null },
    pon:        { type: String, trim: true, default: null },
    cto_id:     { type: String, trim: true, default: null },
    porta_cto:  { type: Number, default: null },
    onu_serial: { type: String, trim: true, default: null },

    // Descrição e observações
    descricao:   { type: String, trim: true, default: null },
    obs_tecnico: { type: String, trim: true, default: null },
    resultado:   { type: String, trim: true, default: null },

    // Leituras de sinal (coletadas na conclusão)
    rx_power: { type: Number, default: null },
    tx_power: { type: Number, default: null },

    // Datas do ciclo de vida
    data_abertura:    { type: Date, default: () => new Date() },
    data_agendamento: { type: Date, default: null },
    data_execucao:    { type: Date, default: null },
    data_fechamento:  { type: Date, default: null },

    // Audit
    criado_por: { type: String, trim: true, default: null },

    // ── Dados de conexão do cliente ─────────────────────────────────────
    conexao: {
      login:     { type: String, default: null },
      senha:     { type: String, default: null },
      ip:        { type: String, default: null },
      mac:       { type: String, default: null },
      onu_id:    { type: String, default: null },
      slot:      { type: String, default: null },
      pon_porta: { type: String, default: null },
      status:    { type: String, enum: ['ONLINE', 'OFFLINE', null], default: null },
    },

    // ── Plano contratado ─────────────────────────────────────────────────
    plano: {
      nome:     { type: String, default: null },
      download: { type: String, default: null },
      upload:   { type: String, default: null },
    },

    // ── Materiais utilizados / em comodato ────────────────────────────────
    materiais: [
      {
        produto_id: { type: String, default: null },
        nome:       { type: String, required: true },
        quantidade: { type: Number, default: 1 },
        tipo:       { type: String, enum: ['OS', 'COMODATO'], default: 'OS' },
        valor:      { type: Number, default: null },
      },
    ],

    // ── Geolocalização do endereço de instalação ──────────────────────────
    localizacao: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    // ── Fotos da execução ─────────────────────────────────────────────────
    fotos: [
      {
        nome:      { type: String },
        url:       { type: String },
        tamanho:   { type: Number, default: null },
        criado_em: { type: Date, default: () => new Date() },
      },
    ],

    // ── Histórico de ações / auditoria ────────────────────────────────────
    historico: [
      {
        usuario_id:   { type: String },
        usuario_nome: { type: String },
        acao:         { type: String },
        timestamp:    { type: Date, default: () => new Date() },
      },
    ],
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'service_orders',
  }
)

// Índices
ServiceOrderSchema.index({ projeto_id: 1, os_id: 1 }, { unique: true })
ServiceOrderSchema.index({ projeto_id: 1, status: 1 })
ServiceOrderSchema.index({ projeto_id: 1, tipo: 1 })
ServiceOrderSchema.index({ projeto_id: 1, created_at: -1 })
ServiceOrderSchema.index({ projeto_id: 1, tecnico_id: 1 })

// Em desenvolvimento, limpa o cache do modelo para que mudanças de schema (como
// remoção de hooks pre-save) sejam recarregadas pelo HMR sem precisar reiniciar o server.
if (process.env.NODE_ENV !== 'production' && models.ServiceOrder) {
  delete models.ServiceOrder
}

export const ServiceOrder = models.ServiceOrder || model('ServiceOrder', ServiceOrderSchema)
