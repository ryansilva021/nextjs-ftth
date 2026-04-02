/**
 * CheckoutPendente — registra o estado de um checkout público iniciado em /planos.
 *
 * Ciclo de vida:
 *   1. send-verification  → cria documento com code + expiração
 *   2. verify-code        → marca verified = true
 *   3. create-subscription→ salva asaas_customer_id + asaas_subscription_id + payment_id
 *   4. webhook PAYMENT_CONFIRMED → cria Empresa + User, marca onboarding_completed = true
 *
 * TTL: documentos são deletados automaticamente 48h após a criação.
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const CheckoutPendenteSchema = new Schema(
  {
    email: {
      type:     String,
      required: true,
      trim:     true,
      lowercase: true,
    },

    empresa_nome: {
      type:     String,
      required: true,
      trim:     true,
    },

    cnpj: {
      type:    String,
      trim:    true,
      default: null,
    },

    plano: {
      type:     String,
      required: true,
      enum:     ['basico', 'pro', 'enterprise'],
    },

    // Código de verificação de 6 dígitos
    code: {
      type:     String,
      required: true,
    },

    code_expires_at: {
      type:     Date,
      required: true,
    },

    // true depois que o código for validado
    verified: {
      type:    Boolean,
      default: false,
    },

    // Preenchido após criar a assinatura no Asaas
    asaas_customer_id: {
      type:    String,
      default: null,
    },

    asaas_subscription_id: {
      type:    String,
      default: null,
    },

    // ID do primeiro pagamento (para exibir PIX/boleto)
    payment_id: {
      type:    String,
      default: null,
    },

    payment_method: {
      type:    String,
      enum:    ['PIX', 'BOLETO', 'CREDIT_CARD', null],
      default: null,
    },

    // true quando o webhook confirmou e a conta foi criada
    onboarding_completed: {
      type:    Boolean,
      default: false,
    },

    // TTL: 48h após criação o documento é removido automaticamente pelo MongoDB
    expires_at: {
      type:    Date,
      default: () => new Date(Date.now() + 48 * 60 * 60 * 1000),
      index:   { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: { createdAt: 'criado_em', updatedAt: 'updated_at' },
    collection: 'checkout_pendentes',
  }
)

CheckoutPendenteSchema.index({ email: 1 })
CheckoutPendenteSchema.index({ asaas_customer_id: 1 }, { sparse: true })

export const CheckoutPendente = models.CheckoutPendente || model('CheckoutPendente', CheckoutPendenteSchema)
