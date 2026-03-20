/**
 * CaixaEmendaCDO.js
 * Caixa de Emenda / CDO (Caixa de Distribuição Óptica) — nó intermediário da rede.
 * Recebe fibra de uma OLT e distribui para múltiplos CTOs.
 * Equivalente à tabela SQL: caixas_emenda_cdo
 *
 * Campos SQL originais:
 *   id TEXT PK, projeto_id TEXT, tipo TEXT, obs TEXT, img_url TEXT,
 *   lat REAL, lng REAL, updated_at TEXT,
 *   olt_id TEXT, porta_olt INTEGER, splitter_cdo TEXT, diagrama TEXT,
 *   nome TEXT, rua TEXT, bairro TEXT
 *
 * Topologia hierárquica: OLT → CDO/CE → CTO
 *   - olt_id   : FK para OLT (qual OLT alimenta este CDO)
 *   - porta_olt: número da porta da OLT utilizada
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ---------------------------------------------------------------------------
// Sub-schema: diagrama interno do CDO/CE
// Armazena o mapeamento de portas de saída para CTOs
// ---------------------------------------------------------------------------
const DiagramaCDOSchema = new Schema(
  {
    // Entrada: qual OLT e porta alimenta este CDO
    entrada: {
      olt_id:   { type: String, default: null },
      porta_olt: { type: Number, default: null },
    },

    // Portas de saída: mapeamento porta_numero → CTO conectado
    saidas: {
      type: Map,
      of: new Schema(
        {
          cto_id: { type: String, default: null },
          obs:    { type: String, default: null },
          ativo:  { type: Boolean, default: true },
        },
        { _id: false }
      ),
      default: () => new Map(),
    },

    // Informações do splitter (ex: "1:8 portas", "1:16 passthrough")
    splitter_info: { type: String, default: null },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Schema principal
// ---------------------------------------------------------------------------
const CaixaEmendaCDOSchema = new Schema(
  {
    // Identificador único por projeto
    // Mantido como string para compatibilidade com IDs legados
    id: {
      type:     String,
      required: [true, "id é obrigatório"],
      trim:     true,
    },

    // Multi-tenancy: obrigatório
    projeto_id: {
      type:     String,
      required: [true, "projeto_id é obrigatório"],
      trim:     true,
      default:  "default",
    },

    // Tipo da caixa: "CE" = Caixa de Emenda, "CDO" = Caixa de Distribuição Óptica
    tipo: {
      type:    String,
      trim:    true,
      default: "CDO",
      // Não usamos enum para manter flexibilidade com valores legados
    },

    nome: {
      type:    String,
      trim:    true,
      default: null,
    },

    rua: {
      type:    String,
      trim:    true,
      default: null,
    },

    bairro: {
      type:    String,
      trim:    true,
      default: null,
    },

    obs: {
      type:    String,
      trim:    true,
      default: null,
    },

    // URL da foto da caixa (hospedada externamente ou CDN)
    img_url: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Coordenadas geográficas
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

    // Topologia: OLT pai (quando alimentado diretamente por OLT)
    olt_id: {
      type:    String, // referência ao id da OLT (string, não ObjectId)
      default: null,
    },

    porta_olt: {
      type:    Number,
      default: null,
      min:     [1, "porta_olt deve ser >= 1"],
    },

    // Topologia: CDO/CE pai (quando alimentado em cascata por outra CDO/CE)
    cdo_pai_id: {
      type:    String,
      default: null,
    },

    porta_cdo_pai: {
      type:    Number,
      default: null,
      min:     [1, "porta_cdo_pai deve ser >= 1"],
    },

    // Configuração do splitter CDO (ex: "1:8", "1:16", "2:16")
    splitter_cdo: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Diagrama interno do CDO (JSON livre — armazena bandejas, splitters, fusões ABNT)
    diagrama: {
      type:    Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "caixas_emenda_cdo",
  }
);

// ---------------------------------------------------------------------------
// Índice composto único por projeto (id único dentro do tenant)
// ---------------------------------------------------------------------------
CaixaEmendaCDOSchema.index({ projeto_id: 1, id: 1 }, { unique: true });

// Índice para buscas geoespaciais
CaixaEmendaCDOSchema.index({ projeto_id: 1, lat: 1, lng: 1 });

// Índice para queries de topologia: "todos os CDOs da OLT X"
CaixaEmendaCDOSchema.index({ projeto_id: 1, olt_id: 1 });

// Índice para busca por tipo e bairro
CaixaEmendaCDOSchema.index({ projeto_id: 1, tipo: 1 });
CaixaEmendaCDOSchema.index({ projeto_id: 1, bairro: 1 });

// ---------------------------------------------------------------------------
// Virtuals
// ---------------------------------------------------------------------------

/**
 * Retorna o endereço formatado
 */
CaixaEmendaCDOSchema.virtual("endereco").get(function () {
  const partes = [this.rua, this.bairro].filter(Boolean);
  return partes.join(", ") || null;
});

/**
 * Retorna label curto: "CDO-01 (Centro)" para exibição em listas
 */
CaixaEmendaCDOSchema.virtual("label").get(function () {
  const nome  = this.nome || this.id;
  const local = this.bairro ? ` (${this.bairro})` : "";
  return `${nome}${local}`;
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const CaixaEmendaCDO =
  models.CaixaEmendaCDO || model("CaixaEmendaCDO", CaixaEmendaCDOSchema);
