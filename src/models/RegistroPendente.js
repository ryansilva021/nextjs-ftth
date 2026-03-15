/**
 * RegistroPendente.js
 * Auto-cadastros públicos aguardando aprovação do superadmin.
 * Equivalente à tabela SQL: registros_pendentes
 *
 * Campos utilizados pelo fluxo atual (cadastro.page.js + registros.js):
 *   username, password_hash, projeto_id, empresa, nome_completo,
 *   email, telefone, status, motivo_rejeicao,
 *   solicitado_em (via timestamps criado_em), processado_em, processado_por
 *
 * Fluxo:
 *   1. Usuário preenche formulário público → cria RegistroPendente (status: "pendente")
 *   2. Superadmin aprova → cria User no projeto → status: "aprovado"
 *   3. Superadmin rejeita → status: "rejeitado"
 *
 * Segurança: password_hash armazena PBKDF2, NUNCA a senha em claro.
 * O hash é reutilizado ao criar o User na aprovação.
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const RegistroPendenteSchema = new Schema(
  {
    // Username do usuário que está solicitando acesso
    username: {
      type:      String,
      required:  [true, "username é obrigatório"],
      trim:      true,
      lowercase: true,
      minlength: [3, "username deve ter ao menos 3 caracteres"],
      maxlength: [60, "username não pode exceder 60 caracteres"],
      match: [
        /^[a-z0-9_.-]+$/,
        "username deve conter apenas letras minúsculas, números, _ . e -",
      ],
    },

    // Hash PBKDF2 da senha (nunca a senha em claro)
    password_hash: {
      type:     String,
      required: [true, "password_hash é obrigatório"],
      select:   false, // não retorna por padrão em queries
    },

    // ID do projeto gerado na aprovação (null enquanto pendente)
    projeto_id: {
      type:    String,
      default: null,
    },

    // Plano escolhido no cadastro
    plano: {
      type:    String,
      enum:    ['starter', 'pro', 'enterprise'],
      default: 'pro',
    },

    // Nome da empresa/ISP ou nome completo do solicitante
    empresa: {
      type:      String,
      trim:      true,
      default:   null,
      maxlength: [120, "empresa não pode exceder 120 caracteres"],
    },

    // Nome completo do solicitante (opcional)
    nome_completo: {
      type:      String,
      trim:      true,
      default:   null,
      maxlength: [120, "nome_completo não pode exceder 120 caracteres"],
    },

    // Dados de contato (opcionais)
    email: {
      type:      String,
      trim:      true,
      lowercase: true,
      default:   null,
      match:     [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "email inválido"],
    },

    telefone: {
      type:      String,
      trim:      true,
      default:   null,
      maxlength: 30,
    },

    // Estado do registro
    status: {
      type:    String,
      enum:    ["pendente", "aprovado", "rejeitado"],
      default: "pendente",
    },

    // Auditoria de processamento (aprovação ou rejeição)
    processado_em: {
      type:    Date,
      default: null,
    },

    // Username do superadmin que processou o registro
    processado_por: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Motivo da rejeição (opcional)
    motivo_rejeicao: {
      type:    String,
      trim:    true,
      default: null,
    },
  },
  {
    // solicitado_em mapeia para createdAt; updated_at para updatedAt
    timestamps: { createdAt: "solicitado_em", updatedAt: "updated_at" },
    collection: "registros_pendentes",
  }
);

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

// Busca de registros pendentes por username (verificação de duplicatas)
RegistroPendenteSchema.index({ username: 1, status: 1 });

// Busca por projeto
RegistroPendenteSchema.index({ projeto_id: 1, status: 1 });

// Listagem por status e data de criação (padrão do painel superadmin)
RegistroPendenteSchema.index({ status: 1, solicitado_em: -1 });

// ---------------------------------------------------------------------------
// Métodos estáticos
// ---------------------------------------------------------------------------

/**
 * Verifica se já existe um registro pendente para um username.
 *
 * @param {string} username
 * @returns {Promise<boolean>}
 */
RegistroPendenteSchema.statics.loginEmPendencia = async function (username) {
  const doc = await this.findOne({ username, status: "pendente" }).lean();
  return !!doc;
};

// ---------------------------------------------------------------------------
// Export — força recompilação em dev para refletir mudanças de schema
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'development' && models['RegistroPendente']) {
  delete models['RegistroPendente']
}
export const RegistroPendente = model("RegistroPendente", RegistroPendenteSchema);
