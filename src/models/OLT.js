/**
 * OLT.js
 * Optical Line Terminal — equipamento raiz da rede GPON/FTTH.
 * É o topo da hierarquia: OLT → CDO/CE → CTO → Cliente.
 * Equivalente à tabela SQL: olts
 *
 * Campos SQL originais:
 *   id TEXT PK, projeto_id TEXT, nome TEXT, modelo TEXT, ip TEXT,
 *   capacidade INTEGER DEFAULT 16, obs TEXT, lat REAL, lng REAL, updated_at TEXT
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const OLTSchema = new Schema(
  {
    // Identificador único por projeto (ex: "olt_lm1q2r", "OLT-CENTRAL")
    id: {
      type:     String,
      required: [true, "id é obrigatório"],
      trim:     true,
    },

    // Multi-tenancy
    projeto_id: {
      type:     String,
      required: [true, "projeto_id é obrigatório"],
      trim:     true,
      default:  "default",
    },

    nome: {
      type:     String,
      required: [true, "nome da OLT é obrigatório"],
      trim:     true,
    },

    // Modelo do equipamento (ex: "Huawei MA5800-X7", "ZTE C320", "FiberHome AN5516")
    modelo: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Endereço IP de gerência (IPv4 ou IPv6)
    ip: {
      type:    String,
      trim:    true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true; // permite null
          // Valida IPv4 simples ou formato de endereço básico
          return /^[\d.:a-fA-F/]+$/.test(v);
        },
        message: "ip inválido",
      },
    },

    // Credenciais SSH de gerência
    ssh_user: {
      type:    String,
      trim:    true,
      default: 'admin',
    },

    ssh_pass: {
      type:    String,
      default: '',
    },

    // Porta SSH (padrão 22; simulador usa 2222)
    ssh_port: {
      type:    Number,
      default: 22,
      min:     [1, "ssh_port deve ser >= 1"],
      max:     [65535, "ssh_port deve ser <= 65535"],
    },

    // Número total de portas PON disponíveis
    capacidade: {
      type:    Number,
      default: 16,
      min:     [1, "capacidade deve ser >= 1"],
    },

    obs: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Coordenadas geográficas (localização física da OLT)
    lat: {
      type:    Number,
      default: null,
      min:     [-90,  "latitude deve estar entre -90 e 90"],
      max:     [90,   "latitude deve estar entre -90 e 90"],
    },

    lng: {
      type:    Number,
      default: null,
      min:     [-180, "longitude deve estar entre -180 e 180"],
      max:     [180,  "longitude deve estar entre -180 e 180"],
    },

    // Status operacional da OLT
    status: {
      type:    String,
      enum:    ["ativo", "inativo", "em_manutencao"],
      default: "ativo",
    },

    // URL da API REST do simulador (ex: http://localhost:3002)
    // Presente apenas em OLTs conectadas ao provedor-virtual
    rest_url: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Protocolo de gerência utilizado para esta OLT
    protocolo: {
      type:    String,
      enum:    ['ssh', 'telnet', 'api'],
      default: 'ssh',
    },

    // Tipo/fabricante da OLT
    tipo: {
      type:    String,
      enum:    ['simulator', 'huawei', 'zte', 'fiberhome', 'datacom', 'intelbras'],
      default: 'huawei',
    },

    // Porta Telnet (padrão 23)
    telnet_port: {
      type:    Number,
      default: 23,
      min:     [1,     'telnet_port deve ser >= 1'],
      max:     [65535, 'telnet_port deve ser <= 65535'],
    },

    // Token de autenticação para OLTs com protocolo 'api'
    api_token: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Estado da última verificação de conectividade
    link_status: {
      type:    String,
      enum:    ['online', 'offline', 'unknown'],
      default: 'unknown',
    },

    // Timestamp da última verificação de link
    link_tested_at: {
      type:    Date,
      default: null,
    },

    // Mensagem de erro da última verificação de link (null se OK)
    link_error: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Mapa DIO (Distribution Input/Output): porta física → PON → local alimentado
    // Formato: { total: 48, mapa: [{ porta, pon, local }], placas: [] }
    dio_config: {
      type:    Object,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "olts",
    id: false, // evita conflito do virtual `id` do Mongoose com o campo `id` do schema
  }
);

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

// Identificador único por projeto
OLTSchema.index({ projeto_id: 1, id: 1 }, { unique: true });

// Índice geoespacial para exibição no mapa
OLTSchema.index({ projeto_id: 1, lat: 1, lng: 1 });

// Índice para ordenação por nome (padrão do SELECT ORDER BY nome do legado)
OLTSchema.index({ projeto_id: 1, nome: 1 });

// ---------------------------------------------------------------------------
// Virtuals
// ---------------------------------------------------------------------------

/**
 * Label curto para UI: "OLT Central (192.168.1.1)"
 */
OLTSchema.virtual("label").get(function () {
  return this.ip ? `${this.nome} (${this.ip})` : this.nome;
});

// ---------------------------------------------------------------------------
// Métodos estáticos
// ---------------------------------------------------------------------------

/**
 * Busca todas as OLTs de um projeto ordenadas por nome.
 * Equivale ao SELECT * FROM olts WHERE projeto_id=? ORDER BY nome do legado.
 *
 * @param {string} projeto_id
 */
OLTSchema.statics.listarPorProjeto = function (projeto_id) {
  return this.find({ projeto_id }).sort({ nome: 1 }).lean();
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const OLT = models.OLT || model("OLT", OLTSchema);
