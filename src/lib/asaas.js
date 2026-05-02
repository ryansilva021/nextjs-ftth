/**
 * src/lib/asaas.js
 *
 * Cliente REST para a API do Asaas (gateway de pagamento brasileiro).
 * Documentação: https://docs.asaas.com
 *
 * Configuração via variáveis de ambiente:
 *   ASAAS_API_KEY    — chave de API (começa com $aact_...)
 *   ASAAS_BASE_URL   — https://sandbox.asaas.com/api/v3  (sandbox)
 *                    — https://api.asaas.com/api/v3       (produção)
 */

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function request(method, path, body = null) {
  // Lido a cada chamada para garantir que o valor do .env.local seja sempre o correto
  const BASE_URL = process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3'
  const API_KEY  = process.env.ASAAS_API_KEY  || ''


  const url = `${BASE_URL}${path}`
  const headers = {
    'Content-Type':  'application/json',
    'access_token':  API_KEY,
    'User-Agent':    'FiberOps/1.0',
  }

  const init = { method, headers }
  if (body) init.body = JSON.stringify(body)

  const res = await fetch(url, init)
  const data = await res.json()

  if (!res.ok) {
    const msg = data?.errors?.[0]?.description || data?.message || `Asaas error ${res.status}`
    const err = new Error(msg)
    err.status  = res.status
    err.asaas   = data
    throw err
  }

  return data
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/**
 * Cria ou recupera cliente no Asaas pelo CPF/CNPJ ou e-mail.
 * Sempre tenta buscar antes de criar para evitar duplicatas.
 *
 * @param {{ name: string, email: string, cpfCnpj?: string, phone?: string }} params
 * @returns {Promise<{ id: string, name: string, email: string }>}
 */
export async function createCustomer({ name, email, cpfCnpj, phone } = {}) {
  if (email) {
    const existing = await request('GET', `/customers?email=${encodeURIComponent(email)}&limit=1`)
    if (existing?.data?.length > 0) {
      const customer = existing.data[0]
      // Se temos CNPJ mas o cliente existente não tem, atualiza antes de retornar
      if (cpfCnpj && !customer.cpfCnpj) {
        return request('POST', `/customers/${customer.id}`, { cpfCnpj })
      }
      return customer
    }
  }

  return request('POST', '/customers', {
    name,
    email,
    cpfCnpj:  cpfCnpj || undefined,
    mobilePhone: phone || undefined,
    notificationDisabled: true,
  })
}

/**
 * Busca um cliente pelo ID.
 * @param {string} customerId
 */
export async function getCustomer(customerId) {
  return request('GET', `/customers/${customerId}`)
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * Cria uma assinatura recorrente mensal.
 *
 * @param {string} customerId          — ID do cliente no Asaas
 * @param {string} plan                — 'basico' | 'pro' | 'enterprise'
 * @param {'PIX'|'BOLETO'|'CREDIT_CARD'} billingType
 * @param {Object} [opts]
 * @param {string} [opts.creditCardToken]  — token de cartão (se billingType === 'CREDIT_CARD')
 * @returns {Promise<{ id: string, status: string, value: number, nextDueDate: string }>}
 */
export async function createSubscription(customerId, plan, billingType, opts = {}) {
  const { PLAN_PRICES } = await import('./plan-config.js')
  const value = PLAN_PRICES[plan] / 100  // Asaas usa reais, não centavos

  const nextDueDate = new Date()
  nextDueDate.setDate(nextDueDate.getDate() + 1)
  const dueDateStr = nextDueDate.toISOString().slice(0, 10)

  const body = {
    customer:       customerId,
    billingType,
    value,
    nextDueDate:    dueDateStr,
    cycle:          'MONTHLY',
    description:    `FiberOps Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
    externalReference: plan,
  }

  if (billingType === 'CREDIT_CARD' && opts.creditCardToken) {
    body.creditCardToken = opts.creditCardToken
  }

  return request('POST', '/subscriptions', body)
}

/**
 * Busca uma assinatura pelo ID.
 * @param {string} subscriptionId
 */
export async function getSubscription(subscriptionId) {
  return request('GET', `/subscriptions/${subscriptionId}`)
}

/**
 * Cancela uma assinatura.
 * @param {string} subscriptionId
 */
export async function cancelSubscription(subscriptionId) {
  return request('DELETE', `/subscriptions/${subscriptionId}`)
}

/**
 * Atualiza o plano (valor) de uma assinatura existente.
 * @param {string} subscriptionId
 * @param {string} newPlan  — 'basico' | 'pro' | 'enterprise'
 */
export async function updateSubscriptionPlan(subscriptionId, newPlan) {
  const { PLAN_PRICES } = await import('./plan-config.js')
  const value = PLAN_PRICES[newPlan] / 100

  return request('POST', `/subscriptions/${subscriptionId}`, {
    value,
    description: `FiberOps Plano ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}`,
    externalReference: newPlan,
  })
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * Lista os pagamentos de uma assinatura.
 * @param {string} subscriptionId
 * @param {number} [limit=10]
 */
export async function listSubscriptionPayments(subscriptionId, limit = 10) {
  return request('GET', `/subscriptions/${subscriptionId}/payments?limit=${limit}`)
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * Busca um pagamento pelo ID.
 * @param {string} paymentId
 */
export async function getPayment(paymentId) {
  return request('GET', `/payments/${paymentId}`)
}

/**
 * Retorna o QR Code PIX de um pagamento.
 * @param {string} paymentId
 * @returns {Promise<{ encodedImage: string, payload: string, expirationDate: string }>}
 */
export async function getPixQrCode(paymentId) {
  return request('GET', `/payments/${paymentId}/pixQrCode`)
}

/**
 * Retorna o código de barras (linha digitável) de um boleto.
 * @param {string} paymentId
 * @returns {Promise<{ identificationField: string, nossoNumero: string }>}
 */
export async function getBoletoBarcode(paymentId) {
  return request('GET', `/payments/${paymentId}/identificationField`)
}

// ---------------------------------------------------------------------------
// Webhook validation
// ---------------------------------------------------------------------------

/**
 * Verifica se o token recebido no header é válido.
 * @param {string} receivedToken
 * @returns {boolean}
 */
export function validateWebhookToken(receivedToken) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  if (!expected) return false
  return receivedToken === expected
}
