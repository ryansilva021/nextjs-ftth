/**
 * src/models/SystemConfig.js
 * Configurações globais por projeto (multi-tenant).
 * Uma entrada por projeto_id.
 */

import mongoose from 'mongoose'

// ─── Padrões de cores de fibra óptica ─────────────────────────────────────────

const FIBER_COLOR_DEFAULTS = {
  // ABNT NBR 14721 — sequência oficial brasileira
  brasil: [
    { posicao: 1,  nome: 'Verde',    hex: '#16a34a' },
    { posicao: 2,  nome: 'Amarelo',  hex: '#ca8a04' },
    { posicao: 3,  nome: 'Branco',   hex: '#94a3b8' },
    { posicao: 4,  nome: 'Azul',     hex: '#2563eb' },
    { posicao: 5,  nome: 'Vermelho', hex: '#dc2626' },
    { posicao: 6,  nome: 'Violeta',  hex: '#7c3aed' },
    { posicao: 7,  nome: 'Marrom',   hex: '#92400e' },
    { posicao: 8,  nome: 'Rosa',     hex: '#db2777' },
    { posicao: 9,  nome: 'Preto',    hex: '#1e293b' },
    { posicao: 10, nome: 'Cinza',    hex: '#6b7280' },
    { posicao: 11, nome: 'Laranja',  hex: '#ea580c' },
    { posicao: 12, nome: 'Aqua',     hex: '#0891b2' },
  ],
  eua: [
    { posicao: 1, nome: 'Blue',   hex: '#1e40af' },
    { posicao: 2, nome: 'Orange', hex: '#ea580c' },
    { posicao: 3, nome: 'Green',  hex: '#16a34a' },
    { posicao: 4, nome: 'Brown',  hex: '#92400e' },
    { posicao: 5, nome: 'Slate',  hex: '#475569' },
    { posicao: 6, nome: 'White',  hex: '#e2e8f0' },
    { posicao: 7, nome: 'Red',    hex: '#dc2626' },
    { posicao: 8, nome: 'Black',  hex: '#1c1917' },
    { posicao: 9, nome: 'Yellow', hex: '#ca8a04' },
    { posicao: 10, nome: 'Violet', hex: '#7c3aed' },
    { posicao: 11, nome: 'Rose',   hex: '#db2777' },
    { posicao: 12, nome: 'Aqua',   hex: '#0891b2' },
  ],
}

export { FIBER_COLOR_DEFAULTS }

// ─── Schema ────────────────────────────────────────────────────────────────────

const FiberColorSchema = new mongoose.Schema({
  posicao: { type: Number, required: true },
  nome:    { type: String, required: true },
  hex:     { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
}, { _id: false })

const SystemConfigSchema = new mongoose.Schema({
  projeto_id: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },

  // ── Informações da empresa ────────────────────────────────────────────────
  nome_empresa:    { type: String, default: '' },
  logo_url:        { type: String, default: '' },
  timezone:        { type: String, default: 'America/Sao_Paulo' },

  // ── Cores de fibra ────────────────────────────────────────────────────────
  padrao_fibra:    { type: String, enum: ['brasil', 'eua', 'personalizado'], default: 'brasil' },
  cores_fibra:     { type: [FiberColorSchema], default: () => FIBER_COLOR_DEFAULTS.brasil },

  // ── Notificações ──────────────────────────────────────────────────────────
  notif_nova_os:      { type: Boolean, default: true },
  notif_status_os:    { type: Boolean, default: true },
  notif_ponto:        { type: Boolean, default: true },

  // ── OS ────────────────────────────────────────────────────────────────────
  os_prazo_horas:  { type: Number, default: 48 },   // SLA padrão em horas
  os_tipos_ativos: {
    type:    [String],
    default: ['instalacao', 'manutencao', 'suporte', 'cancelamento'],
  },

  // ── Mapa ─────────────────────────────────────────────────────────────────
  mapa_lat_default: { type: Number, default: -15.7942 },
  mapa_lng_default: { type: Number, default: -47.8822 },
  mapa_zoom_default: { type: Number, default: 13 },

  updated_at: { type: Date, default: Date.now },
}, {
  collection:  'system_configs',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

export const SystemConfig = mongoose.models.SystemConfig
  ?? mongoose.model('SystemConfig', SystemConfigSchema)

/** Retorna config do projeto; cria com defaults se não existir. */
export async function getOrCreateConfig(projeto_id) {
  let cfg = await SystemConfig.findOne({ projeto_id }).lean()
  if (!cfg) {
    cfg = await SystemConfig.create({ projeto_id })
    cfg = cfg.toObject()
  }
  return cfg
}
