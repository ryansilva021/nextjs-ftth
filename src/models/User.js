/**
 * User.js
 * Usuários do sistema com RBAC e multi-tenancy.
 * Equivalente à tabela SQL: users
 *
 * Campos SQL originais:
 *   username TEXT PK, password_hash TEXT, role TEXT, is_active INTEGER,
 *   created_at TEXT, updated_at TEXT, projeto_id TEXT
 *
 * Roles: superadmin | admin | tecnico | user
 *   - superadmin : acesso total a todos os projetos
 *   - admin      : gerencia o próprio projeto (usuários, dados, OLTs)
 *   - tecnico    : leitura + escrita de movimentações
 *   - user       : somente leitura
 *
 * Nota sobre senhas:
 *   O sistema legado usa PBKDF2 (pbkdf2$iter$salt$hash) ou SHA-256 simples.
 *   Para novos usuários recomenda-se PBKDF2 com 100 000 iterações via
 *   Web Crypto API ou bcrypt no Node. O campo password_hash armazena
 *   apenas a string formatada — nunca a senha em claro.
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const UserSchema = new Schema(
  {
    // Login único globalmente (PK no SQL)
    username: {
      type:      String,
      required:  [true, "username é obrigatório"],
      unique:    true,
      trim:      true,
      lowercase: true,
      minlength: [3, "username deve ter ao menos 3 caracteres"],
      maxlength: [60, "username não pode exceder 60 caracteres"],
      match: [
        /^[a-z0-9_.-]+$/,
        "username deve conter apenas letras minúsculas, números, _ . e -",
      ],
    },

    // Hash da senha: formato "pbkdf2$<iter>$<salt_b64>$<hash_b64>"
    // ou hash SHA-256 legado (64 hex chars) para contas migradas
    password_hash: {
      type:     String,
      required: [true, "password_hash é obrigatório"],
      select:   false, // nunca retorna nas queries a menos que explicitamente solicitado
    },

    role: {
      type:    String,
      enum:    ["superadmin", "admin", "tecnico", "noc", "recepcao", "user"],
      default: "user",
    },

    is_active: {
      type:    Boolean,
      default: true,
    },

    // Referência ao tenant. Superadmin pode ter projeto_id="default" ou qualquer valor.
    projeto_id: {
      type:     String,
      required: [true, "projeto_id é obrigatório"],
      trim:     true,
      default:  "default",
    },

    // Referência à empresa (gerada na aprovação do registro)
    empresa_id: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Dados opcionais de perfil
    email: {
      type:  String,
      trim:  true,
      lowercase: true,
      default: null,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "email inválido"],
      sparse: true, // permite múltiplos nulls no índice único
    },

    nome_completo: {
      type:     String,
      trim:     true,
      default:  null,
      maxlength: 120,
    },

    // Controle de senha temporária (força troca no próximo login)
    must_change_password: {
      type:    Boolean,
      default: false,
    },

    // Timestamp do último login bem-sucedido
    last_login: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "users",
  }
);

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------
// username já tem unique:true
UserSchema.index({ projeto_id: 1, is_active: 1 });
UserSchema.index({ projeto_id: 1, role: 1 });
UserSchema.index({ email: 1 }, { sparse: true });

// ---------------------------------------------------------------------------
// Virtuals
// ---------------------------------------------------------------------------

/**
 * Retorna true se o role tem permissão de escrita (admin ou acima)
 */
UserSchema.virtual("isAdmin").get(function () {
  return this.role === "admin" || this.role === "superadmin";
});

/**
 * Retorna true se o role pode escrever movimentações (tecnico ou acima)
 */
UserSchema.virtual("canWrite").get(function () {
  return ["admin", "superadmin", "tecnico"].includes(this.role);
});

// ---------------------------------------------------------------------------
// Métodos estáticos
// ---------------------------------------------------------------------------

/**
 * Busca um usuário ativo pelo username e retorna role + projeto_id.
 * Equivale à função getUserFull() do worker.js.
 *
 * @param {string} username
 * @returns {{ role: string, projeto_id: string } | null}
 */
UserSchema.statics.getFull = async function (username) {
  const user = await this.findOne(
    { username, is_active: true },
    "role projeto_id"
  ).lean();
  if (!user) return null;
  return { role: user.role || "user", projeto_id: user.projeto_id || "default" };
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
// Limpa cache do modelo em dev para garantir que mudanças de schema (enum)
// sejam recarregadas pelo HMR sem precisar reiniciar o servidor.
if (process.env.NODE_ENV !== 'production' && models.User) {
  delete models.User
}

export const User = models.User || model("User", UserSchema);
