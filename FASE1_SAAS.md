# FiberOps SaaS — Fase 1: Lançar como produto vendável

> **Sprint:** 0–4 semanas · **Objetivo:** Billing automático, e-mails transacionais, onboarding self-service e enforcement de limites por plano.

---

## Contexto arquitetural

| Decisão | Resolução |
|---------|-----------|
| **Nomes de plano** | Migrar de `starter/pro/enterprise` → `basico/pro/enterprise` com preços R$299/R$599/R$1499. Atualizar enum em `RegistroPendente` e `cadastro/page.js`. |
| **IDs Asaas** | Armazenar `asaas_customer_id`, `asaas_subscription_id` direto no modelo `Empresa` (relação 1:1). |
| **Webhook security** | Validar header `asaas-access-token` via `ASAAS_WEBHOOK_TOKEN`. Usar `route.js` (não server action). |
| **Cron no Next.js** | Rota `GET /api/cron/trial-check?secret=` protegida por `CRON_SECRET`. Compatível com Vercel Cron e schedulers externos. |
| **E-mail** | `resend` SDK + `@react-email/components`. Templates em `src/emails/`. |
| **Onboarding** | Aprovação automática cria `Empresa` + `Projeto` + `User` direto (sem fila). `RegistroPendente` mantida só para auditoria. |
| **Limites** | Baseados em OLTs / ONUs / usuários por empresa (substituem `maxCtos`). `null` = ilimitado. |

---

## Variáveis de ambiente necessárias

```env
# Asaas
ASAAS_API_KEY=
ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3
ASAAS_WEBHOOK_TOKEN=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=FiberOps <noreply@fiberops.com.br>

# Cron
CRON_SECRET=
```

---

## Pilar 1 — Billing com Asaas

### Tarefas

- [ ] **1.1** `src/models/Empresa.js` — adicionar campos `asaas_customer_id` (String, sparse unique), `asaas_subscription_id` (String), `asaas_payment_method` (enum: pix/boleto/credit_card) · _S_
- [ ] **1.2** `src/lib/asaas.js` _(novo)_ — cliente REST da API Asaas com funções: `createCustomer`, `createSubscription`, `getSubscription`, `cancelSubscription`. Usa `fetch` nativo, suporta sandbox/prod via env vars · _M_
- [ ] **1.3** `src/lib/plan-config.js` _(novo)_ — fonte única de verdade: `PLAN_LIMITS`, `PLAN_PRICES` (em centavos), `PLAN_LABELS` · _S_

  ```js
  PLAN_LIMITS = {
    trial:      { olts: 1,    onus: 50,   users: 3  },
    basico:     { olts: 4,    onus: 500,  users: 5  },
    pro:        { olts: null, onus: 2000, users: 15 },
    enterprise: { olts: null, onus: null, users: null },
  }
  ```

- [ ] **1.4** `src/app/api/webhooks/asaas/route.js` _(novo)_ — handler `POST`. Valida token, mapeia eventos: `PAYMENT_CONFIRMED/RECEIVED` → `status='ativo'`, `PAYMENT_OVERDUE` → `status='vencido'`, `SUBSCRIPTION_DELETED` → `status='vencido'`. Grava em `WebhookLog`. Dispara e-mail (Pilar 2). Retorna 200 sempre · _L_
- [ ] **1.5** `src/models/WebhookLog.js` _(novo)_ — campos: `provider`, `event_type`, `payload` (Mixed), `processed`, `error`, `created_at`. TTL: 90 dias · _S_
- [ ] **1.6** `src/actions/billing.js` _(novo)_ — `createSubscriptionForEmpresa`, `cancelSubscription`, `getSubscriptionStatus`, `changePlan`. Requer role admin ou superadmin · _L_
- [ ] **1.7** `src/app/superadmin/billing/page.js` + `src/components/superadmin/BillingClient.js` _(novos)_ — tabela de empresas com status de assinatura, plano, último pagamento, ações manuais de ativar/suspender/trocar plano · _M_
- [ ] **1.8** `src/app/admin/assinatura/page.js` + `src/components/admin/AssinaturaClient.js` _(novos)_ — plano atual, uso vs limites, histórico de pagamentos, botões de upgrade, seleção de forma de pagamento (PIX/boleto/cartão) · _M_
- [ ] **1.9** `src/app/(auth)/cadastro/page.js` + `src/models/RegistroPendente.js` — atualizar array `PLANOS` e enum para `basico/pro/enterprise` com novos preços · _S_

---

## Pilar 2 — E-mails transacionais com Resend

### Tarefas

- [ ] **2.1** Instalar dependências + `src/lib/email.js` _(novo)_ — `npm install resend @react-email/components`. Wrapper `sendEmail(to, subject, component)` com `RESEND_API_KEY` · _S_
- [ ] **2.2** Templates react-email _(novos em `src/emails/`)_:
  - `welcome.jsx` — boas-vindas + acesso imediato
  - `trial-starting.jsx` — início do trial de 14 dias
  - `trial-expiring.jsx` — expira em 3 dias
  - `trial-expired.jsx` — trial encerrado
  - `payment-confirmed.jsx` — pagamento confirmado
  - `payment-failed.jsx` — pagamento falhou / inadimplente
  - `account-suspended.jsx` — conta suspensa

  _M (todos juntos)_

- [ ] **2.3** `src/lib/email-triggers.js` _(novo)_ — funções nomeadas para cada situação: `sendWelcomeEmail`, `sendTrialStartingEmail`, `sendTrialExpiringEmail`, `sendTrialExpiredEmail`, `sendPaymentConfirmedEmail`, `sendPaymentFailedEmail`, `sendAccountSuspendedEmail`. Resolvem destinatário de `empresa.email_contato` · _M_
- [ ] **2.4** `src/app/api/cron/trial-check/route.js` _(novo)_ — `GET` protegido por `CRON_SECRET`. Busca empresas em trial, envia `trial-expiring` se expira em ≤3 dias (idempotente via `last_trial_reminder_sent`), e `trial-expired` + suspende se já venceu · _M_
- [ ] **2.5** `src/models/Empresa.js` — adicionar `last_trial_reminder_sent` (Date), `last_email_event` (String) para controle de idempotência · _S_

---

## Pilar 3 — Onboarding self-service

### Tarefas

- [ ] **3.1** `src/actions/registros.js` — refatorar `criarRegistro`: criar `Empresa` (status `trial`, `trial_expira_em = now + 14d`) + `Projeto` + `User` (role `admin`) diretamente. Manter `RegistroPendente` com status `aprovado` para auditoria · _M_
- [ ] **3.2** `src/app/(auth)/cadastro/page.js` — mudar mensagem de sucesso: "Conta criada! Faça login agora" (remover "aguardando aprovação"). Campo e-mail obrigatório. Trial fixo em 14 dias · _S_
- [ ] **3.3** `src/models/Empresa.js` — adicionar `onboarding_steps: [{ step, completed, completed_at }]` com steps padrão: `empresa_criada`, `primeira_olt`, `primeira_cto`, `primeiro_tecnico`, `integracao_sgp`. Campo `onboarding_completed` (Boolean, default false) · _S_
- [ ] **3.4** `src/actions/onboarding.js` _(novo)_ — `getOnboardingStatus`, `completeOnboardingStep`, `checkAndUpdateOnboarding` (conta recursos reais), `dismissOnboarding` · _M_
- [ ] **3.5** `src/components/dashboard/OnboardingChecklist.js` _(novo)_ — card com progresso, links para cada recurso a cadastrar, barra de progresso "X de 5 concluídos", botão dispensar. Renderiza só quando `onboarding_completed === false` para role admin · _M_
- [ ] **3.6** `src/app/(dashboard)/page.js` — integrar `OnboardingChecklist` acima do mapa (só para admin) · _S_
- [ ] **3.7** `src/components/dashboard/WelcomeTour.js` _(novo)_ — modal multi-step (3–4 slides) explicando funcionalidades-chave. Flag em `localStorage` para exibir só no primeiro login do admin · _M_
- [ ] **3.8** `src/actions/olts.js`, `src/actions/ctos.js`, `src/actions/usuarios.js` — após criação bem-sucedida de OLT/CTO/User técnico, chamar `completeOnboardingStep` de forma não-bloqueante (`.catch(() => {})`) · _S_
- [ ] **3.9** `src/actions/registros.js` — após criar empresa, disparar `sendWelcomeEmail` + `sendTrialStartingEmail` de forma não-bloqueante · _S_

---

## Pilar 4 — Enforcement de limites por plano

### Tarefas

- [ ] **4.1** `src/lib/plan-limits.js` _(novo)_ — `checkLimit(empresaId, resource)`. Busca plano da empresa, conta registros atuais, retorna `{ allowed, limit, current, resource }`. Se `limit === null`, sempre permitido. Em caso de bloqueio: `{ error: 'LIMIT_REACHED', resource, limit, current }` · _M_
- [ ] **4.2** `src/actions/olts.js` — antes de criar nova OLT, chamar `checkLimit(empresaId, 'olts')`. Retornar erro estruturado se negado. Superadmin isento · _S_
- [ ] **4.3** `src/actions/noc.js` (ou onde ONUs são criadas) — mesmo padrão para recurso `'onus'` · _S_
- [ ] **4.4** `src/actions/usuarios.js` — mesmo padrão para recurso `'users'` · _S_
- [ ] **4.5** `src/components/shared/LimitReachedBanner.js` _(novo)_ — banner de aviso "Limite atingido — Faça upgrade para o plano {próximo}" com CTA para `/admin/assinatura`. Props: `resource`, `limit`, `current` · _S_
- [ ] **4.6** `src/components/admin/OltMgmtTab.js` (e similares de ONU/Usuário) — capturar erro `LIMIT_REACHED` das actions e renderizar `LimitReachedBanner`. Ocultar botão "Adicionar" quando no limite · _M_
- [ ] **4.7** `src/components/admin/UsageSummary.js` _(novo)_ — card de uso atual vs limites do plano (ex: "OLTs: 3/4", "ONUs: 450/500") com barras de progresso coloridas (verde/amarelo/vermelho). Link para upgrade quando próximo do limite · _M_

---

## Ordem de implementação

```
Semana 1 — Foundation (sem dependências, podem ser paralelas)
  1.3  plan-config.js
  1.1 + 2.5 + 3.3  → atualizar Empresa model (agrupar)
  1.5  WebhookLog model
  2.1  Resend email client

Semana 2 — Lógica central
  1.2  Asaas client library
  2.2  Email templates (requer 2.1)
  2.3  Email trigger functions (requer 2.2)
  4.1  plan-limits.js (requer 1.3)
  1.6  billing server actions (requer 1.1, 1.2, 1.3)
  3.1  Auto-approve registration (requer 1.3)
  3.4  Onboarding server actions (requer 3.3)

Semana 3 — Integrações
  1.4  Webhook Asaas (requer 1.1, 2.3)
  2.4  Cron trial-check (requer 2.3, 2.5)
  3.2 + 1.9  Atualizar UIs de cadastro (requer 3.1)
  3.9  Emails no registro (requer 2.3, 3.1)
  4.2 + 4.3 + 4.4  Enforcement de limites (requer 4.1)
  3.8  Auto-complete onboarding (requer 3.4)

Semana 4 — UI & polimento
  1.7  Superadmin billing page (requer 1.6)
  1.8  Admin assinatura page (requer 1.3, 1.6)
  3.5 + 3.6  OnboardingChecklist + dashboard (requer 3.4)
  3.7  WelcomeTour (standalone)
  4.5 + 4.6  LimitReachedBanner + integração UIs (requer 1.8)
  4.7  UsageSummary (requer 1.3, 4.1)
```

---

## Resumo de arquivos

### Novos (23 arquivos)

| Arquivo | Pilar |
|---------|-------|
| `src/lib/plan-config.js` | 1 |
| `src/lib/asaas.js` | 1 |
| `src/lib/plan-limits.js` | 4 |
| `src/lib/email.js` | 2 |
| `src/lib/email-triggers.js` | 2 |
| `src/models/WebhookLog.js` | 1 |
| `src/emails/welcome.jsx` | 2 |
| `src/emails/trial-starting.jsx` | 2 |
| `src/emails/trial-expiring.jsx` | 2 |
| `src/emails/trial-expired.jsx` | 2 |
| `src/emails/payment-confirmed.jsx` | 2 |
| `src/emails/payment-failed.jsx` | 2 |
| `src/emails/account-suspended.jsx` | 2 |
| `src/app/api/webhooks/asaas/route.js` | 1 |
| `src/app/api/cron/trial-check/route.js` | 2 |
| `src/actions/billing.js` | 1 |
| `src/actions/onboarding.js` | 3 |
| `src/app/superadmin/billing/page.js` + `BillingClient.js` | 1 |
| `src/app/admin/assinatura/page.js` + `AssinaturaClient.js` | 1 |
| `src/components/dashboard/OnboardingChecklist.js` | 3 |
| `src/components/dashboard/WelcomeTour.js` | 3 |
| `src/components/shared/LimitReachedBanner.js` | 4 |
| `src/components/admin/UsageSummary.js` | 4 |

### Modificados (9 arquivos)

| Arquivo | O que muda |
|---------|------------|
| `src/models/Empresa.js` | Campos Asaas, campos e-mail, campos onboarding |
| `src/models/RegistroPendente.js` | Enum de plano: `basico/pro/enterprise` |
| `src/actions/registros.js` | Auto-aprovação + envio de e-mails |
| `src/actions/olts.js` | Limit check + auto-complete onboarding |
| `src/actions/noc.js` | Limit check de ONUs |
| `src/actions/usuarios.js` | Limit check + auto-complete onboarding |
| `src/app/(auth)/cadastro/page.js` | Planos atualizados, UX de acesso imediato |
| `src/app/(dashboard)/page.js` | Integração OnboardingChecklist |
| `src/components/admin/OltMgmtTab.js` (e similares) | LimitReachedBanner |

---

## Projeção financeira (meta Fase 1)

| Marco | Clientes | MRR |
|-------|----------|-----|
| Mês 3 | 10 | R$ 7.790 |
| Mês 6 | 30 | R$ 22.470 |
| Mês 12 | 80 | R$ 59.935 |

---

_Documento gerado com base em `FIBEROPS_SAAS_PLANO.html` · FiberOps v1 · Março 2026_
