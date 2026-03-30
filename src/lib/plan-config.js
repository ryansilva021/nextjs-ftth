/**
 * src/lib/plan-config.js
 *
 * Fonte única de verdade para planos do FiberOps SaaS.
 * Usado em: server actions, middleware, UI de assinatura, enforcement de limites.
 *
 * Compatível com Edge Runtime (sem imports de Node.js).
 */

// ---------------------------------------------------------------------------
// Limites por plano
// null = ilimitado
// ---------------------------------------------------------------------------

export const PLAN_LIMITS = {
  trial: {
    olts:  1,
    onus:  50,
    users: 3,
  },
  basico: {
    olts:  4,
    onus:  500,
    users: 5,
  },
  pro: {
    olts:  null,
    onus:  2000,
    users: 15,
  },
  enterprise: {
    olts:  null,
    onus:  null,
    users: null,
  },
}

// ---------------------------------------------------------------------------
// Preços em centavos (BRL)
// ---------------------------------------------------------------------------

export const PLAN_PRICES = {
  trial:      0,
  basico:     29900,
  pro:        59900,
  enterprise: 149900,
}

// ---------------------------------------------------------------------------
// Labels e descrições
// ---------------------------------------------------------------------------

export const PLAN_LABELS = {
  trial:      'Trial',
  basico:     'Básico',
  pro:        'Pro',
  enterprise: 'Enterprise',
}

export const PLAN_DESCRIPTIONS = {
  trial:      'Avaliação gratuita por 14 dias',
  basico:     'Ideal para ISPs pequenos — até 500 clientes',
  pro:        'ISPs médios — até 2.000 ONUs, usuários ilimitados',
  enterprise: 'ISPs grandes e redes neutras — tudo ilimitado',
}

// ---------------------------------------------------------------------------
// Próximo plano para upgrade (CTA de upsell)
// ---------------------------------------------------------------------------

export const NEXT_PLAN = {
  trial:  'basico',
  basico: 'pro',
  pro:    'enterprise',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retorna o preço formatado em BRL.
 * @param {string} plan
 * @returns {string}  Ex: "R$ 299,00" ou "Grátis"
 */
export function formatPlanPrice(plan) {
  const price = PLAN_PRICES[plan]
  if (!price) return 'Grátis'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price / 100)
}

/**
 * Verifica se um recurso está dentro do limite do plano.
 * @param {string} plan
 * @param {'olts'|'onus'|'users'} resource
 * @param {number} current  quantidade atual
 * @returns {{ allowed: boolean, limit: number|null, current: number }}
 */
export function isWithinLimit(plan, resource, current) {
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial
  const limit = limits[resource] ?? null
  return {
    allowed: limit === null || current < limit,
    limit,
    current,
  }
}
