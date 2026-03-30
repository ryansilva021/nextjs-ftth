/**
 * src/models/Empresa.js
 *
 * Empresa — entidade multi-tenant de nível superior.
 * Cada Empresa agrupa um ou mais Projetos e controla o status de assinatura.
 *
 * status_assinatura possíveis:
 *   ativo          — conta paga e dentro do prazo
 *   trial          — período de avaliação gratuita
 *   vencido        — assinatura expirada, aguardando pagamento
 *   bloqueado      — suspenso manualmente pelo superadmin
 *
 * Fluxo de verificação de acesso:
 *   1. Se status === 'bloqueado'                         → negar
 *   2. Se status === 'vencido'                           → negar
 *   3. Se status === 'trial' && trial_expira_em < agora → negar (trial expirado)
 *   4. Caso contrário                                    → permitir
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const EmpresaSchema = new Schema(
  {
    // Razão social da empresa (nome legal)
    razao_social: {
      type:      String,
      required:  [true, 'razao_social é obrigatória'],
      trim:      true,
      minlength: [2,   'razao_social deve ter ao menos 2 caracteres'],
      maxlength: [200, 'razao_social não pode exceder 200 caracteres'],
    },

    // Slug único — usado em URLs e no JWT
    // Ex: "fibernet-sao-paulo", "isp-norte"
    slug: {
      type:      String,
      required:  [true, 'slug é obrigatório'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match: [
        /^[a-z0-9_-]+$/,
        'slug deve conter apenas letras minúsculas, números, _ e -',
      ],
      maxlength: [64, 'slug não pode exceder 64 caracteres'],
    },

    // CNPJ (opcional, somente dígitos para facilitar comparação)
    cnpj: {
      type:    String,
      trim:    true,
      default: null,
      match:   [/^\d{14}$/, 'CNPJ deve ter exatamente 14 dígitos (sem pontuação)'],
      sparse:  true,
    },

    // Status da assinatura — campo central para controle de acesso
    status_assinatura: {
      type:    String,
      enum:    ['ativo', 'trial', 'vencido', 'bloqueado'],
      default: 'trial',
      index:   true,
    },

    // Data de vencimento da assinatura paga
    data_vencimento: {
      type:    Date,
      default: null,
    },

    // Data de expiração do período trial
    trial_expira_em: {
      type:    Date,
      default: null,
    },

    // Motivo do bloqueio (exibido na tela de acesso negado)
    motivo_bloqueio: {
      type:    String,
      trim:    true,
      default: null,
      maxlength: [500, 'motivo_bloqueio não pode exceder 500 caracteres'],
    },

    // Plano contratado
    plano: {
      type:    String,
      enum:    ['basico', 'pro', 'enterprise'],
      default: 'basico',
    },

    // Dados de contato
    email_contato: {
      type:      String,
      trim:      true,
      lowercase: true,
      default:   null,
    },

    telefone_contato: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Projetos vinculados a esta empresa (array de projeto_id strings)
    // Mantido como array de strings por compatibilidade com o campo projeto_id legado
    projetos: {
      type:    [String],
      default: [],
    },

    // Empresa ativa no sistema (soft delete)
    is_active: {
      type:    Boolean,
      default: true,
      index:   true,
    },

    // ── Asaas Billing ───────────────────────────────────────────────────────

    // ID do cliente no Asaas (criado automaticamente na 1ª assinatura)
    asaas_customer_id: {
      type:    String,
      default: null,
      sparse:  true,
    },

    // ID da assinatura recorrente no Asaas
    asaas_subscription_id: {
      type:    String,
      default: null,
      sparse:  true,
    },

    // Forma de pagamento usada na assinatura
    asaas_payment_method: {
      type:    String,
      enum:    ['PIX', 'BOLETO', 'CREDIT_CARD', null],
      default: null,
    },

    // ── Controle de e-mails ─────────────────────────────────────────────────

    // Última vez que o lembrete de trial expirando foi enviado (idempotência)
    last_trial_reminder_sent: {
      type:    Date,
      default: null,
    },

    // Último tipo de evento de e-mail disparado
    last_email_event: {
      type:    String,
      default: null,
    },

    // ── Onboarding ──────────────────────────────────────────────────────────

    // Lista de etapas do onboarding com status de conclusão
    onboarding_steps: {
      type: [
        {
          step:         { type: String, required: true },
          completed:    { type: Boolean, default: false },
          completed_at: { type: Date, default: null },
        },
      ],
      default: () => [
        { step: 'empresa_criada',   completed: true,  completed_at: new Date() },
        { step: 'primeira_olt',     completed: false, completed_at: null },
        { step: 'primeira_cto',     completed: false, completed_at: null },
        { step: 'primeiro_tecnico', completed: false, completed_at: null },
        { step: 'integracao_sgp',   completed: false, completed_at: null },
      ],
    },

    // true quando o usuário dispensou ou concluiu o onboarding
    onboarding_completed: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'criado_em', updatedAt: 'updated_at' },
    collection: 'empresas',
  }
)

// ---------------------------------------------------------------------------
// Índices compostos
// ---------------------------------------------------------------------------

EmpresaSchema.index({ status_assinatura: 1, is_active: 1 })
EmpresaSchema.index({ plano: 1, status_assinatura: 1 })

// ---------------------------------------------------------------------------
// Virtuals
// ---------------------------------------------------------------------------

/**
 * Retorna true se a empresa pode operar normalmente.
 * Leva em conta todas as condições de bloqueio.
 */
EmpresaSchema.virtual('ativa').get(function () {
  if (!this.is_active)                        return false
  if (this.status_assinatura === 'bloqueado') return false
  if (this.status_assinatura === 'vencido')   return false
  if (
    this.status_assinatura === 'trial' &&
    this.trial_expira_em &&
    this.trial_expira_em < new Date()
  ) return false
  return true
})

// ---------------------------------------------------------------------------
// Métodos estáticos
// ---------------------------------------------------------------------------

/**
 * Verifica o status operacional de uma empresa pelo _id.
 * Retorna { ativa, status, motivo } sem lançar exceção.
 *
 * @param {string} empresaId
 * @returns {Promise<{ ativa: boolean, status: string, motivo?: string }>}
 */
EmpresaSchema.statics.verificarStatus = async function (empresaId) {
  const empresa = await this.findById(
    empresaId,
    'status_assinatura data_vencimento trial_expira_em motivo_bloqueio is_active'
  ).lean()

  if (!empresa) return { ativa: false, status: 'inexistente' }
  if (!empresa.is_active) return { ativa: false, status: 'bloqueado', motivo: 'Empresa desativada.' }

  const status = empresa.status_assinatura

  if (status === 'bloqueado') {
    return { ativa: false, status, motivo: empresa.motivo_bloqueio || 'Acesso bloqueado.' }
  }
  if (status === 'vencido') {
    return { ativa: false, status, motivo: 'Assinatura vencida.' }
  }
  if (status === 'trial' && empresa.trial_expira_em && empresa.trial_expira_em < new Date()) {
    return { ativa: false, status: 'trial_expirado', motivo: 'Período de teste encerrado.' }
  }

  return { ativa: true, status }
}

// ---------------------------------------------------------------------------
// Export (singleton pattern — evita re-compilação em hot reload do Next.js)
// ---------------------------------------------------------------------------

export const Empresa = models.Empresa || model('Empresa', EmpresaSchema)
