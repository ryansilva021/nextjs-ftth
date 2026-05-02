/**
 * src/lib/plan-config.js
 * Fonte única de verdade para planos do FiberOps SaaS.
 * Compatível com Edge Runtime (sem imports de Node.js).
 */

// ---------------------------------------------------------------------------
// Limites por plano — null = ilimitado
// ---------------------------------------------------------------------------
export const PLAN_LIMITS = {
  trial: {
    ctos:     50,
    olts:     1,
    onus:     50,
    users:    3,
    tecnicos: 1,
  },
  free: {
    ctos:     50,
    olts:     0,
    onus:     0,
    users:    1,
    tecnicos: 1,
  },
  starter: {
    ctos:     200,
    olts:     1,
    onus:     500,
    users:    5,
    tecnicos: 3,
  },
  pro: {
    ctos:     1000,
    olts:     null,
    onus:     2000,
    users:    15,
    tecnicos: 15,
  },
  business: {
    ctos:     3000,
    olts:     null,
    onus:     null,
    users:    40,
    tecnicos: 40,
  },
  enterprise: {
    ctos:     null,
    olts:     null,
    onus:     null,
    users:    null,
    tecnicos: null,
  },
  carrier: {
    ctos:     null,
    olts:     null,
    onus:     null,
    users:    null,
    tecnicos: null,
  },
  // backward-compat aliases
  basico: {
    ctos:     200,
    olts:     4,
    onus:     500,
    users:    5,
    tecnicos: 3,
  },
}

// ---------------------------------------------------------------------------
// Preços em centavos (BRL) — null = sob consulta
// ---------------------------------------------------------------------------
export const PLAN_PRICES = {
  trial:      0,
  free:       0,
  starter:    14900,
  pro:        54900,
  business:   54900,
  enterprise: 99900,
  carrier:    null,
  // backward-compat
  basico:     14900,
}

// ---------------------------------------------------------------------------
// Labels, subtítulos e features
// ---------------------------------------------------------------------------
export const PLAN_LABELS = {
  trial:      'Trial',
  free:       'Free',
  starter:    'Starter',
  pro:        'Pro',
  business:   'Business',
  enterprise: 'Enterprise',
  carrier:    'Carrier',
  basico:     'Básico',
}

export const PLAN_DESCRIPTIONS = {
  trial:      'Avaliação gratuita por 14 dias',
  free:       'Experimente a plataforma sem compromisso',
  starter:    'Para ISPs iniciando a gestão digital',
  pro:        'O mais escolhido pelos ISPs regionais',
  business:   'Para ISPs em expansão com múltiplas cidades',
  enterprise: 'Para grandes operadoras e ISPs com múltiplas regiões',
  carrier:    'Para concessionárias e redes neutras de grande porte',
  basico:     'Ideal para ISPs pequenos',
}

export const PLAN_FEATURES = {
  free: [
    '50 CTOs cadastradas',
    '1 técnico de campo',
    'Mapa interativo básico',
    'Suporte por comunidade',
    'Marca FiberOps nas telas',
  ],
  starter: [
    '200 CTOs cadastradas',
    '3 técnicos de campo',
    'Mapa interativo offline',
    'Diagrama de fibra',
    'Suporte por e-mail',
    'Integração com 1 OLT',
  ],
  pro: [
    '1.000 CTOs cadastradas',
    '15 técnicos de campo',
    'Mapa interativo offline',
    'Financeiro integrado + PIX',
    'Multi-fabricante (Huawei, ZTE, Datacom)',
    'Gestão de postes e rotas',
    'Notificações push de campo',
    'Suporte prioritário 12h',
  ],
  business: [
    '3.000 CTOs cadastradas',
    '40 técnicos de campo',
    'Roteirização inteligente de campo',
    'BI + dashboards customizados',
    'Integração com ERP e CRM',
    'Multi-unidade (filiais)',
    'Suporte prioritário 8h úteis',
    'Onboarding guiado',
  ],
  enterprise: [
    'CTOs ilimitadas',
    'Técnicos ilimitados',
    'API dedicada + webhooks',
    'SLA 99,9% contratual',
    'Gerente de sucesso dedicado',
    'Customizações sob demanda',
    'Relatórios Anatel automáticos',
    'Suporte 24/7 com engenheiro',
  ],
  carrier: [
    'Infraestrutura multi-tenant',
    'Deploy on-premise ou nuvem dedicada',
    'Integração com OSS/BSS legados',
    'Engenharia dedicada in-house',
    'Contrato Anatel customizado',
    'Suporte 24/7 com NOC compartilhado',
  ],
  trial: [
    '50 CTOs de teste',
    '1 técnico de campo',
    'Todas as funcionalidades Pro',
    'Sem necessidade de cartão',
  ],
  basico: [
    '200 CTOs cadastradas',
    '3 técnicos de campo',
    'Mapa interativo offline',
    'Diagrama de fibra',
    'Suporte por e-mail',
  ],
}

// Planos "populares" (badge)
export const PLAN_POPULAR = { pro: true }

// Planos disponíveis para assinatura (na ordem exibida)
export const PLAN_ORDER = ['free', 'starter', 'pro', 'business', 'enterprise', 'carrier']

// Próximo plano para upgrade (CTA de upsell)
export const NEXT_PLAN = {
  trial:      'starter',
  free:       'starter',
  starter:    'pro',
  pro:        'business',
  business:   'enterprise',
  basico:     'pro',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Preço formatado em BRL. Ex: "R$ 299,00" | "Grátis" | "Sob consulta" */
export function formatPlanPrice(plan) {
  const price = PLAN_PRICES[plan]
  if (price === null) return 'Sob consulta'
  if (!price) return 'Grátis'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price / 100)
}

/** Verifica se um recurso está dentro do limite do plano. */
export function isWithinLimit(plan, resource, current) {
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial
  const limit  = limits[resource] ?? null
  return { allowed: limit === null || current < limit, limit, current }
}
