/**
 * Projeto.js
 * Modelo multi-tenant raiz: cada Projeto é um tenant isolado.
 * Equivalente à tabela SQL: projetos
 *
 * Campos SQL originais:
 *   projeto_id TEXT PK, nome TEXT, plano TEXT, ativo INTEGER, criado_em TEXT, config TEXT
 *
 * Planos disponíveis: basico | pro | enterprise
 * O superadmin gerencia todos os projetos; o admin só vê o seu.
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ---------------------------------------------------------------------------
// Sub-schema: configurações opcionais por projeto (campo `config` em JSON no SQL)
// ---------------------------------------------------------------------------
const ConfigSchema = new Schema(
  {
    // Limites do plano (opcionais — podem ser sobrescritos por projeto)
    maxCtos:       { type: Number, default: null },
    maxUsuarios:   { type: Number, default: null },

    // Padrão de cores de fibra óptica
    // ABNT = NBR 14721 (Brasil) | EIA_598_A = padrão internacional
    fiberColorStandard: {
      type:    String,
      enum:    ['ABNT', 'EIA_598_A'],
      default: 'ABNT',
    },

    // Feature flags
    registroPublicoAtivo: { type: Boolean, default: false },
    autoAprovarRegistro:  { type: Boolean, default: false },

    // Dados de contato do responsável
    email:    { type: String, trim: true, default: null },
    telefone: { type: String, trim: true, default: null },
  },
  { _id: false } // sub-documento embutido, sem _id próprio
);

// ---------------------------------------------------------------------------
// Schema principal
// ---------------------------------------------------------------------------
const ProjetoSchema = new Schema(
  {
    // Identificador legível e único do tenant (ex: "fibernet_lm1q2r")
    // Mantido como String para compatibilidade com o sistema atual
    projeto_id: {
      type:     String,
      required: [true, "projeto_id é obrigatório"],
      unique:   true,
      trim:     true,
      lowercase: true,
      match: [
        /^[a-z0-9_-]+$/,
        "projeto_id deve conter apenas letras minúsculas, números, _ e -",
      ],
      maxlength: [64, "projeto_id não pode exceder 64 caracteres"],
    },

    nome: {
      type:      String,
      required:  [true, "nome do projeto é obrigatório"],
      trim:      true,
      minlength: [2, "nome deve ter ao menos 2 caracteres"],
      maxlength: [120, "nome não pode exceder 120 caracteres"],
    },

    plano: {
      type:    String,
      enum:    ["basico", "pro", "enterprise"],
      default: "basico",
    },

    ativo: {
      type:    Boolean,
      default: true,
    },

    // Configurações adicionais do projeto (serializado como JSON no SQL original)
    config: {
      type:    ConfigSchema,
      default: () => ({}),
    },
  },
  {
    // createdAt mapeia para "criado_em" do SQL; updatedAt é extra
    timestamps: { createdAt: "criado_em", updatedAt: "updated_at" },
    collection:  "projetos",
  }
);

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------
// projeto_id já tem unique:true (índice automático)
ProjetoSchema.index({ ativo: 1 });
ProjetoSchema.index({ plano: 1, ativo: 1 });

// ---------------------------------------------------------------------------
// Virtuals
// ---------------------------------------------------------------------------

/**
 * Virtual: retorna o identificador como string legível para logs
 */
ProjetoSchema.virtual("label").get(function () {
  return `${this.nome} (${this.projeto_id})`;
});

// ---------------------------------------------------------------------------
// Métodos de instância
// ---------------------------------------------------------------------------

/**
 * Desativa o projeto sem excluir dados.
 * Usar antes de invalidar sessões dos usuários do tenant.
 */
ProjetoSchema.methods.desativar = function () {
  this.ativo = false;
  return this.save();
};

// ---------------------------------------------------------------------------
// Export (singleton pattern — evita re-compilação em hot reload do Next.js)
// ---------------------------------------------------------------------------
export const Projeto = models.Projeto || model("Projeto", ProjetoSchema);
