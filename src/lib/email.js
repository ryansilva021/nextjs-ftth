/**
 * src/lib/email.js
 *
 * Envio de e-mail via Resend SDK.
 * Variável necessária no .env.local: RESEND_API_KEY
 */

import { Resend } from 'resend'

const FROM = 'FiberOps <register@fiberops.com.br>'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

async function send({ to, subject, html, text }) {
  const resend = getResend()

  console.log('[email] Enviando para:', to)
  console.log('[email] API Key presente:', !!process.env.RESEND_API_KEY)

  const result = await resend.emails.send({
    from: "FiberOps <register@fiberops.com.br>",
    to,
    subject,
    ...(html  && { html }),
    ...(text  && { text }),
  })

  console.log('[email] Resultado:', result)

  if (result.error) {
    console.error('[email] Erro Resend:', result.error)
    throw new Error(result.error.message || JSON.stringify(result.error))
  }

  return result
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function sendVerificationCode({ to, code, plano, empresa_nome }) {
  const { PLAN_LABELS } = await import('@/lib/plan-config')
  const planoLabel = PLAN_LABELS[plano] ?? plano

  return send({
    to: Array.isArray(to) ? to : [to],
    subject: `${code} — Código de verificação FiberOps`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff">
        <div style="font-size:22px;font-weight:900;color:#0891b2;margin-bottom:4px">FiberOps</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:32px">Gestão de Rede FTTH</div>

        <h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">
          Confirme seu e-mail
        </h2>
        <p style="font-size:14px;color:#475569;margin:0 0 24px;line-height:1.6">
          Olá, <strong>${empresa_nome}</strong>! Use o código abaixo para confirmar
          seu e-mail e continuar a assinatura do plano <strong>${planoLabel}</strong>.
        </p>

        <div style="background:#f1f5f9;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
          <div style="font-size:48px;font-weight:900;letter-spacing:12px;color:#0f172a;font-family:monospace">${code}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:10px">Válido por 15 minutos</div>
        </div>

        <p style="font-size:12px;color:#94a3b8;line-height:1.5">
          Se você não solicitou este código, ignore este e-mail. Nenhuma conta será criada.
        </p>
      </div>
    `,
  })
}

export async function sendWelcomeEmail({ to, empresa_nome, username, temp_password, plano }) {
  const { PLAN_LABELS } = await import('@/lib/plan-config')
  const planoLabel = PLAN_LABELS[plano] ?? plano
  const loginUrl   = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  return send({
    to: Array.isArray(to) ? to : [to],
    subject: `Bem-vindo ao FiberOps — suas credenciais de acesso`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff">
        <div style="font-size:22px;font-weight:900;color:#0891b2;margin-bottom:4px">FiberOps</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:32px">Gestão de Rede FTTH</div>

        <h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">
          Conta criada com sucesso! 🎉
        </h2>
        <p style="font-size:14px;color:#475569;margin:0 0 24px;line-height:1.6">
          Olá, <strong>${empresa_nome}</strong>! Seu pagamento foi confirmado e sua
          conta no plano <strong>${planoLabel}</strong> está ativa.
          Use as credenciais abaixo para fazer o primeiro acesso:
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:20px">
          <div style="margin-bottom:14px">
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Usuário</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;font-family:monospace">${username}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Senha temporária</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;font-family:monospace">${temp_password}</div>
          </div>
        </div>

        <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#854d0e">
          ⚠️ Por segurança, você será solicitado a criar uma nova senha no primeiro acesso.
        </div>

        <a href="${loginUrl}/login"
           style="display:inline-block;padding:13px 32px;border-radius:10px;background:#0891b2;color:#ffffff;font-weight:800;font-size:14px;text-decoration:none">
          Acessar o painel →
        </a>
      </div>
    `,
  })
}

export async function sendPaymentConfirmedEmail(empresa) {
  if (!empresa?.email_contato) return
  return send({
    to:      [empresa.email_contato],
    subject: 'Pagamento confirmado — FiberOps',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff">
        <div style="font-size:22px;font-weight:900;color:#0891b2;margin-bottom:32px">FiberOps</div>
        <h2 style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 12px">✅ Pagamento confirmado</h2>
        <p style="font-size:14px;color:#475569;line-height:1.6">
          Seu pagamento foi recebido e a assinatura de <strong>${empresa.razao_social}</strong> está ativa. Obrigado!
        </p>
      </div>
    `,
  })
}

export async function sendPaymentFailedEmail(empresa) {
  if (!empresa?.email_contato) return
  const loginUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return send({
    to:      [empresa.email_contato],
    subject: 'Pagamento vencido — FiberOps',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff">
        <div style="font-size:22px;font-weight:900;color:#0891b2;margin-bottom:32px">FiberOps</div>
        <h2 style="font-size:18px;font-weight:800;color:#ef4444;margin:0 0 12px">⚠️ Pagamento vencido</h2>
        <p style="font-size:14px;color:#475569;line-height:1.6">
          Identificamos que o pagamento de <strong>${empresa.razao_social}</strong> está vencido.
          Acesse o painel para regularizar e manter seu acesso ativo.
        </p>
        <a href="${loginUrl}/admin/assinatura"
           style="display:inline-block;margin-top:20px;padding:12px 28px;border-radius:10px;background:#ef4444;color:#fff;font-weight:800;font-size:14px;text-decoration:none">
          Regularizar agora →
        </a>
      </div>
    `,
  })
}

export async function sendAccountSuspendedEmail(empresa) {
  if (!empresa?.email_contato) return
  return send({
    to:      [empresa.email_contato],
    subject: 'Assinatura cancelada — FiberOps',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff">
        <div style="font-size:22px;font-weight:900;color:#0891b2;margin-bottom:32px">FiberOps</div>
        <h2 style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 12px">Assinatura encerrada</h2>
        <p style="font-size:14px;color:#475569;line-height:1.6">
          Sua assinatura foi cancelada. Seus dados estão preservados por 30 dias.
          Para reativar, acesse o painel e escolha um novo plano.
        </p>
      </div>
    `,
  })
}
