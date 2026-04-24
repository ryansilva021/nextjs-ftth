'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { assinarPlano, cancelarAssinatura, checkPaymentStatus } from '@/actions/assinatura'
import {
  PLAN_LABELS, PLAN_PRICES, PLAN_LIMITS, PLAN_DESCRIPTIONS, PLAN_FEATURES,
  PLAN_POPULAR, PLAN_ORDER, formatPlanPrice,
} from '@/lib/plan-config'

// ─── Brand constants ──────────────────────────────────────────────────────────

const FO = {
  espresso:    '#1A120D',
  orange:      '#C45A2C',
  orangeLight: '#F4A771',
  orangeBg:    'rgba(196,90,44,0.10)',
  orangeBorder:'rgba(196,90,44,0.25)',
  beige:       '#EDE3D2',
  cream:       '#F7F0E2',
  border:      '#C8B89A',
  text:        '#1A120D',
  textMuted:   '#7A5C46',
  textLight:   '#5A3E2E',
  green:       '#16a34a',
  greenBg:     'rgba(22,163,74,0.08)',
  greenBorder: 'rgba(22,163,74,0.2)',
  red:         '#dc2626',
  redBg:       'rgba(220,38,38,0.08)',
  redBorder:   'rgba(220,38,38,0.2)',
  amber:       '#f59e0b',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  ativo:          { label: 'Ativo',          color: FO.green,  bg: FO.greenBg,  border: FO.greenBorder },
  trial:          { label: 'Trial',          color: FO.amber,  bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  vencido:        { label: 'Vencido',        color: FO.red,    bg: FO.redBg,    border: FO.redBorder },
  bloqueado:      { label: 'Bloqueado',      color: FO.red,    bg: FO.redBg,    border: FO.redBorder },
  trial_expirado: { label: 'Trial Expirado', color: FO.red,    bg: FO.redBg,    border: FO.redBorder },
}

const BILLING_LABELS = { PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de Crédito' }
const BILLING_ICONS  = { PIX: '⚡', BOLETO: '📄', CREDIT_CARD: '💳' }

const PAYMENT_STATUS = {
  PENDING:   { label: 'Pendente',   color: FO.amber },
  RECEIVED:  { label: 'Recebido',   color: FO.green },
  CONFIRMED: { label: 'Confirmado', color: FO.green },
  OVERDUE:   { label: 'Vencido',    color: FO.red },
  REFUNDED:  { label: 'Estornado',  color: FO.textMuted },
  CANCELED:  { label: 'Cancelado',  color: FO.textMuted },
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function fmtBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copiar' }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      style={{
        padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
        border: `1px solid ${FO.orangeBorder}`, background: copied ? FO.orangeBg : 'transparent',
        color: FO.orange, cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copiado!' : label}
    </button>
  )
}

// ─── Renewal Banner (forced when expired) ─────────────────────────────────────

function RenewalBanner({ status, onSelectPlan }) {
  const isExpired = status === 'vencido' || status === 'trial_expirado'
  if (!isExpired) return null

  const isTrial = status === 'trial_expirado'

  return (
    <div style={{
      background: FO.espresso,
      borderRadius: 14,
      padding: '24px 28px',
      marginBottom: 28,
      border: `1px solid rgba(220,38,38,0.35)`,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: FO.redBg, border: `1px solid ${FO.redBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          🔒
        </div>
        <div>
          <p style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: 16 }}>
            {isTrial ? 'Período de avaliação encerrado' : 'Assinatura vencida'}
          </p>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.5 }}>
            {isTrial
              ? 'Seu trial de 14 dias terminou. Escolha um plano para continuar usando o FiberOps.'
              : 'Seu acesso está suspenso. Renove sua assinatura para reativar todas as funcionalidades.'
            }
          </p>
        </div>
      </div>
      <button
        onClick={onSelectPlan}
        style={{
          alignSelf: 'flex-start',
          background: FO.orange, color: '#fff',
          border: 'none', borderRadius: 10,
          padding: '11px 28px', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', transition: 'opacity .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.87'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        Escolher plano e renovar →
      </button>
    </div>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ planKey, currentPlan, onSelect, disabled }) {
  const isCurrentPlan = planKey === currentPlan
  const isPopular     = PLAN_POPULAR[planKey]
  const limits        = PLAN_LIMITS[planKey] ?? {}
  const features      = PLAN_FEATURES[planKey] ?? []
  const price         = PLAN_PRICES[planKey]

  function LimitBadge({ label, val }) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 11, padding: '2px 0',
        color: FO.textMuted,
      }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: val === null ? FO.green : FO.text }}>
          {val === null ? '∞' : val}
        </span>
      </div>
    )
  }

  return (
    <div
      onClick={() => !disabled && !isCurrentPlan && onSelect(planKey)}
      style={{
        borderRadius: 14,
        border: `2px solid ${isCurrentPlan ? FO.orange : FO.border}`,
        background: isCurrentPlan ? FO.orangeBg : FO.cream,
        padding: '22px 20px',
        cursor: disabled || isCurrentPlan ? 'default' : 'pointer',
        position: 'relative',
        opacity: disabled && !isCurrentPlan ? 0.55 : 1,
        transition: 'border-color .15s, background .15s',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}
      onMouseEnter={e => {
        if (!disabled && !isCurrentPlan) e.currentTarget.style.borderColor = FO.orange
      }}
      onMouseLeave={e => {
        if (!isCurrentPlan) e.currentTarget.style.borderColor = isCurrentPlan ? FO.orange : FO.border
      }}
    >
      {/* Badges */}
      <div style={{ position: 'absolute', top: -12, left: 14, display: 'flex', gap: 6 }}>
        {isCurrentPlan && (
          <span style={{
            background: FO.orange, color: '#fff',
            fontSize: 9, fontWeight: 700, padding: '3px 10px',
            borderRadius: 20, letterSpacing: '.06em',
          }}>
            PLANO ATUAL
          </span>
        )}
        {isPopular && !isCurrentPlan && (
          <span style={{
            background: FO.espresso, color: FO.orangeLight,
            fontSize: 9, fontWeight: 700, padding: '3px 10px',
            borderRadius: 20, letterSpacing: '.06em',
          }}>
            MAIS POPULAR
          </span>
        )}
      </div>

      {/* Name */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: FO.text }}>{PLAN_LABELS[planKey]}</div>
        <div style={{ fontSize: 11, color: FO.textMuted, marginTop: 2, lineHeight: 1.4 }}>
          {PLAN_DESCRIPTIONS[planKey]}
        </div>
      </div>

      {/* Price */}
      <div style={{ marginTop: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: FO.text }}>
          {price === null ? 'Sob consulta' : price === 0 ? 'Grátis' : formatPlanPrice(planKey)}
        </span>
        {price > 0 && (
          <span style={{ fontSize: 12, color: FO.textMuted, marginLeft: 4 }}>/mês</span>
        )}
      </div>

      {/* Limits */}
      <div style={{
        borderTop: `1px solid ${FO.border}`, borderBottom: `1px solid ${FO.border}`,
        padding: '10px 0', marginBottom: 12,
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        <LimitBadge label="CTOs"      val={limits.ctos} />
        <LimitBadge label="ONUs"      val={limits.onus} />
        <LimitBadge label="OLTs"      val={limits.olts} />
        <LimitBadge label="Técnicos"  val={limits.tecnicos} />
        <LimitBadge label="Usuários"  val={limits.users} />
      </div>

      {/* Features */}
      {features.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: FO.textLight }}>
              <span style={{ color: FO.green, flexShrink: 0, marginTop: 1 }}>✓</span>
              {f}
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      {!isCurrentPlan && !disabled && (
        <div style={{
          marginTop: 'auto',
          textAlign: 'center', padding: '9px',
          borderRadius: 9,
          background: isPopular ? FO.orange : FO.espresso,
          color: '#fff', fontSize: 12, fontWeight: 700,
        }}>
          Selecionar plano
        </div>
      )}
    </div>
  )
}

// ─── Checkout Form ────────────────────────────────────────────────────────────

function CheckoutForm({ planoSelecionado, onBack, onSuccess }) {
  const [billing,  setBilling]      = useState('PIX')
  const [cpfCnpj,  setCpfCnpj]      = useState('')
  const [pending,  startTransition] = useTransition()
  const [erro,     setErro]         = useState(null)

  function submit() {
    setErro(null)
    startTransition(async () => {
      const res = await assinarPlano({
        plano:        planoSelecionado,
        billing_type: billing,
        cpf_cnpj:     cpfCnpj.replace(/\D/g, '') || undefined,
      })
      if (res.success) {
        onSuccess(res)
      } else {
        setErro(res.message)
      }
    })
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: FO.textMuted, fontSize: 13, padding: 0,
          marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Voltar
      </button>

      {/* Selected plan summary */}
      <div style={{
        borderRadius: 12, padding: '16px 20px', marginBottom: 24,
        background: FO.orangeBg, border: `1px solid ${FO.orangeBorder}`,
      }}>
        <div style={{ fontSize: 12, color: FO.textMuted, marginBottom: 2 }}>Plano selecionado</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: FO.text }}>
          {PLAN_LABELS[planoSelecionado]}
          <span style={{ fontSize: 13, fontWeight: 400, color: FO.textMuted, marginLeft: 8 }}>
            {formatPlanPrice(planoSelecionado)}/mês
          </span>
        </div>
      </div>

      {/* Payment method */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FO.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Forma de pagamento
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {['PIX', 'BOLETO', 'CREDIT_CARD'].map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              style={{
                flex: 1, padding: '12px 6px', borderRadius: 10,
                border:     `2px solid ${billing === b ? FO.orange : FO.border}`,
                background: billing === b ? FO.orangeBg : FO.cream,
                cursor:     'pointer', fontSize: 11, fontWeight: 700,
                color:      billing === b ? FO.orange : FO.textMuted,
                display:    'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 20 }}>{BILLING_ICONS[b]}</span>
              {BILLING_LABELS[b]}
            </button>
          ))}
        </div>
      </div>

      {/* CPF/CNPJ */}
      <div style={{ marginBottom: 20 }}>
        <label style={{
          fontSize: 11, fontWeight: 700, color: FO.textMuted,
          display: 'block', marginBottom: 6,
          textTransform: 'uppercase', letterSpacing: '.06em',
        }}>
          CPF / CNPJ <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span>
        </label>
        <input
          value={cpfCnpj}
          onChange={e => setCpfCnpj(e.target.value)}
          placeholder="00.000.000/0000-00"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 9, fontSize: 13,
            border: `1px solid ${FO.border}`, background: '#fff',
            color: FO.text, boxSizing: 'border-box', outline: 'none',
          }}
        />
      </div>

      {/* Info banner per billing type */}
      {billing === 'PIX' && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 18, background: FO.greenBg, border: `1px solid ${FO.greenBorder}`, fontSize: 12, color: FO.green }}>
          ⚡ O QR Code PIX será exibido na próxima tela. A ativação é automática após pagamento.
        </div>
      )}
      {billing === 'BOLETO' && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 18, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: FO.amber }}>
          📄 O código de barras e link do boleto serão exibidos na próxima tela. Compensação em até 3 dias úteis.
        </div>
      )}
      {billing === 'CREDIT_CARD' && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 18, background: FO.orangeBg, border: `1px solid ${FO.orangeBorder}`, fontSize: 12, color: FO.orange }}>
          💳 Você será redirecionado para o checkout seguro do Asaas para inserir os dados do cartão.
        </div>
      )}

      {erro && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: FO.redBg, border: `1px solid ${FO.redBorder}`, fontSize: 12, color: FO.red }}>
          ⚠️ {erro}
        </div>
      )}

      <button
        onClick={submit}
        disabled={pending}
        style={{
          width: '100%', padding: '13px', borderRadius: 10,
          background: pending ? FO.border : FO.orange,
          color: '#fff', fontWeight: 700, fontSize: 14,
          border: 'none', cursor: pending ? 'not-allowed' : 'pointer',
          transition: 'background .15s',
        }}
      >
        {pending ? 'Criando assinatura...' : `Confirmar — ${formatPlanPrice(planoSelecionado)}/mês`}
      </button>
    </div>
  )
}

// ─── PIX Payment Screen ───────────────────────────────────────────────────────

function PixPaymentScreen({ resultado, onVerify, verifying, confirmed }) {
  const { pix_encoded_image, pix_payload, pix_expiration, invoice_url, due_date, value } = resultado

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: FO.green, letterSpacing: '.04em', marginBottom: 8 }}>
          ⚡ PAGAMENTO VIA PIX
        </div>
        <div style={{ fontSize: 13, color: FO.textMuted }}>
          Escaneie o QR Code ou copie o código PIX para pagar.
          {due_date && ` Vencimento: ${fmt(due_date)}.`}
        </div>
        {value && (
          <div style={{ fontSize: 28, fontWeight: 900, color: FO.green, marginTop: 8 }}>
            {fmtBRL(value)}
          </div>
        )}
      </div>

      {pix_encoded_image ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            background: '#fff', padding: 16, borderRadius: 12,
            border: `2px solid ${FO.greenBorder}`, display: 'inline-block',
          }}>
            <img
              src={`data:image/png;base64,${pix_encoded_image}`}
              alt="QR Code PIX"
              width={200} height={200}
              style={{ display: 'block' }}
            />
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: 20, fontSize: 13, color: FO.textMuted }}>
          QR Code indisponível — use o código abaixo.
        </div>
      )}

      {pix_payload && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: FO.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Chave Pix copia e cola
          </div>
          <div style={{
            background: FO.cream, border: `1px solid ${FO.border}`,
            borderRadius: 8, padding: '10px 12px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <div style={{
              fontSize: 11, fontFamily: 'monospace', color: FO.textMuted,
              wordBreak: 'break-all', flex: 1, lineHeight: 1.5,
              maxHeight: 60, overflow: 'hidden',
            }}>
              {pix_payload}
            </div>
            <CopyButton text={pix_payload} label="Copiar chave" />
          </div>
        </div>
      )}

      {pix_expiration && (
        <div style={{ fontSize: 12, color: FO.textMuted, marginBottom: 20, textAlign: 'center' }}>
          Código válido até {new Date(pix_expiration).toLocaleString('pt-BR')}
        </div>
      )}

      {invoice_url && (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <a
            href={invoice_url}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: FO.orange, textDecoration: 'none', fontWeight: 600 }}
          >
            Abrir fatura completa →
          </a>
        </div>
      )}

      <button
        onClick={onVerify}
        disabled={verifying || confirmed}
        style={{
          width: '100%', padding: '12px', borderRadius: 10,
          background: confirmed ? FO.green : verifying ? FO.border : FO.green,
          color: '#fff', fontWeight: 700, fontSize: 14,
          border: 'none', cursor: verifying || confirmed ? 'not-allowed' : 'pointer',
        }}
      >
        {confirmed ? '✓ Pagamento confirmado!' : verifying ? 'Verificando...' : 'Verificar pagamento'}
      </button>

      <div style={{ marginTop: 10, fontSize: 11, color: FO.textMuted, textAlign: 'center' }}>
        O status é atualizado automaticamente. Use este botão para checar imediatamente.
      </div>
    </div>
  )
}

// ─── Boleto Payment Screen ────────────────────────────────────────────────────

function BoletoPaymentScreen({ resultado, onVerify, verifying, confirmed }) {
  const { boleto_barcode, boleto_pdf_url, invoice_url, due_date, value } = resultado

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: FO.amber, letterSpacing: '.04em', marginBottom: 8 }}>
          📄 BOLETO BANCÁRIO
        </div>
        <div style={{ fontSize: 13, color: FO.textMuted }}>
          Pague o boleto via internet banking, app ou lotérica.
          {due_date && ` Vencimento: ${fmt(due_date)}.`}
        </div>
        {value && (
          <div style={{ fontSize: 28, fontWeight: 900, color: FO.amber, marginTop: 8 }}>
            {fmtBRL(value)}
          </div>
        )}
      </div>

      {boleto_barcode ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: FO.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Linha digitável
          </div>
          <div style={{
            background: FO.cream, border: `1px solid ${FO.border}`,
            borderRadius: 8, padding: '12px 14px',
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <div style={{
              fontSize: 12, fontFamily: 'monospace', color: FO.text,
              wordBreak: 'break-all', flex: 1, lineHeight: 1.6,
            }}>
              {boleto_barcode}
            </div>
            <CopyButton text={boleto_barcode} label="Copiar" />
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20, fontSize: 13, color: FO.textMuted, textAlign: 'center' }}>
          Código de barras não disponível ainda — use o link para acessar o boleto.
        </div>
      )}

      {(boleto_pdf_url || invoice_url) && (
        <div style={{ marginBottom: 20 }}>
          <a
            href={boleto_pdf_url ?? invoice_url}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'block', textAlign: 'center',
              padding: '11px', borderRadius: 10,
              background: FO.amber, color: '#fff', fontWeight: 700, fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Abrir / baixar boleto →
          </a>
        </div>
      )}

      <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 20, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: FO.amber }}>
        Após o pagamento, a compensação pode levar até 3 dias úteis. Seu plano será ativado automaticamente.
      </div>

      <button
        onClick={onVerify}
        disabled={verifying || confirmed}
        style={{
          width: '100%', padding: '12px', borderRadius: 10,
          background: confirmed ? FO.green : verifying ? FO.border : FO.amber,
          color: '#fff', fontWeight: 700, fontSize: 14,
          border: 'none', cursor: verifying || confirmed ? 'not-allowed' : 'pointer',
        }}
      >
        {confirmed ? '✓ Pagamento confirmado!' : verifying ? 'Verificando...' : 'Verificar status do pagamento'}
      </button>
    </div>
  )
}

// ─── Credit Card Payment Screen ───────────────────────────────────────────────

function CreditCardPaymentScreen({ resultado }) {
  const { credit_card_url, invoice_url } = resultado
  const checkoutUrl = credit_card_url ?? invoice_url

  if (checkoutUrl && typeof window !== 'undefined') {
    setTimeout(() => { window.open(checkoutUrl, '_blank') }, 800)
  }

  return (
    <div style={{ maxWidth: 440, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: FO.text }}>
        Checkout seguro
      </h3>
      <p style={{ fontSize: 13, color: FO.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
        Você será redirecionado para o checkout seguro do Asaas para inserir os dados do cartão de crédito.
        O plano será ativado imediatamente após a confirmação.
      </p>

      {checkoutUrl ? (
        <a
          href={checkoutUrl}
          target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-block', padding: '13px 32px', borderRadius: 10,
            background: FO.orange, color: '#fff', fontWeight: 700, fontSize: 14,
            textDecoration: 'none', marginBottom: 12,
          }}
        >
          Ir para o checkout →
        </a>
      ) : (
        <div style={{ fontSize: 12, color: FO.textMuted }}>
          Link de checkout indisponível. Tente novamente.
        </div>
      )}

      <div style={{ fontSize: 11, color: FO.textMuted, marginTop: 12 }}>
        Processamento seguro via Asaas · Dados criptografados (TLS)
      </div>
    </div>
  )
}

// ─── Post-Checkout Screen ─────────────────────────────────────────────────────

function ResultadoScreen({ resultado, onBack }) {
  const router                    = useRouter()
  const [verifying, startVerify]  = useTransition()
  const [confirmed, setConfirmed] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState(null)

  const handleVerify = useCallback(() => {
    if (!resultado.payment_id) return
    startVerify(async () => {
      const res = await checkPaymentStatus(resultado.payment_id)
      if (res.confirmed) {
        setConfirmed(true)
        setVerifyMsg('Pagamento confirmado! Recarregando...')
        setTimeout(() => router.refresh(), 1500)
      } else if (res.success) {
        setVerifyMsg(`Status atual: ${res.status === 'PENDING' ? 'Aguardando pagamento' : res.status}`)
      } else {
        setVerifyMsg(res.message)
      }
    })
  }, [resultado.payment_id, router])

  const billingType = resultado.billing_type

  return (
    <div style={{ padding: 0 }}>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: FO.textMuted, fontSize: 13, padding: 0,
          marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Voltar para assinatura
      </button>

      {billingType === 'PIX' && (
        <PixPaymentScreen
          resultado={resultado}
          onVerify={handleVerify}
          verifying={verifying}
          confirmed={confirmed}
        />
      )}

      {billingType === 'BOLETO' && (
        <BoletoPaymentScreen
          resultado={resultado}
          onVerify={handleVerify}
          verifying={verifying}
          confirmed={confirmed}
        />
      )}

      {billingType === 'CREDIT_CARD' && (
        <CreditCardPaymentScreen resultado={resultado} />
      )}

      {verifyMsg && (
        <div style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8,
          background: confirmed ? FO.greenBg : 'rgba(245,158,11,0.08)',
          border: `1px solid ${confirmed ? FO.greenBorder : 'rgba(245,158,11,0.2)'}`,
          fontSize: 12, color: confirmed ? FO.green : FO.amber,
          textAlign: 'center',
        }}>
          {verifyMsg}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AssinaturaClient({ dados, erro: erroInicial }) {
  const router                            = useRouter()
  const [planoSelecionado, setPlano]      = useState(null)
  const [resultado, setResultado]         = useState(null)
  const [cancelPending, startCancel]      = useTransition()
  const [cancelErro, setCancelErro]       = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showPlans, setShowPlans]         = useState(false)

  if (erroInicial) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ padding: '14px 18px', borderRadius: 8, background: FO.redBg, border: `1px solid ${FO.redBorder}`, color: FO.red, fontSize: 14 }}>
          ⚠️ {erroInicial}
        </div>
      </div>
    )
  }

  const { plano, status, trial_expira_em, data_vencimento, tem_assinatura, metodo_pagamento, pagamentos } = dados
  const statusMeta  = STATUS_META[status] ?? STATUS_META.trial
  const isExpired   = status === 'vencido' || status === 'trial_expirado'
  const limits      = PLAN_LIMITS[plano] ?? {}

  function handleCancel() {
    setCancelErro(null)
    startCancel(async () => {
      const res = await cancelarAssinatura()
      if (res.success) {
        setConfirmCancel(false)
        router.refresh()
      } else {
        setCancelErro(res.message)
      }
    })
  }

  // Post-checkout screen
  if (resultado) {
    return (
      <div style={{
        padding: 32, maxWidth: 560,
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        background: FO.beige, minHeight: '100%',
      }}>
        <ResultadoScreen resultado={resultado} onBack={() => { setResultado(null); setPlano(null) }} />
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
        .fo-serif { font-family: 'Instrument Serif', Georgia, serif; }
        .fo-plans-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 900px) {
          .fo-plans-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .fo-plans-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ background: FO.beige, minHeight: '100%', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>

        {/* TitleBar */}
        <div style={{
          background: FO.espresso,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <svg width="22" height="22" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
            <rect width="30" height="30" rx="6" fill="#C45A2C"/>
            <text x="6" y="22" fontFamily="Georgia,serif" fontSize="20" fontWeight="700" fill="white">F</text>
            <rect x="18" y="8"  width="7" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
            <rect x="18" y="12" width="7" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
            <rect x="18" y="16" width="5" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
          </svg>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 500 }}>
            FiberOps · Assinatura
          </span>
        </div>

        <div style={{ padding: '28px 28px 40px', maxWidth: 960, margin: '0 auto' }}>

          {/* Breadcrumb */}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: FO.textMuted, marginBottom: 18 }}>
            CONFIGURAÇÕES · ASSINATURA
          </p>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 className="fo-serif" style={{ fontSize: 30, color: FO.text, margin: 0, lineHeight: 1.15 }}>
              Gerencie sua <em style={{ color: FO.orange, fontStyle: 'italic' }}>assinatura</em>
            </h1>
            <p style={{ fontSize: 13, color: FO.textMuted, marginTop: 4 }}>
              Plano atual, limites do sistema e opções de upgrade.
            </p>
          </div>

          {/* Forced renewal banner */}
          <RenewalBanner
            status={status}
            onSelectPlan={() => { setPlano(null); setShowPlans(true) }}
          />

          {/* Checkout form */}
          {planoSelecionado ? (
            <div style={{
              background: FO.cream, borderRadius: 14,
              border: `1px solid ${FO.border}`, padding: '28px 32px',
              marginBottom: 28,
            }}>
              <CheckoutForm
                planoSelecionado={planoSelecionado}
                onBack={() => setPlano(null)}
                onSuccess={res => setResultado(res)}
              />
            </div>
          ) : (
            <>
              {/* Current plan card */}
              <div style={{
                background: FO.cream, borderRadius: 14,
                border: `1px solid ${FO.border}`,
                padding: '22px 24px', marginBottom: 24,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: FO.textMuted, margin: '0 0 16px', textTransform: 'uppercase' }}>
                  PLANO ATIVO
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>

                  {/* Plan name + status */}
                  <div style={{ flex: '1 1 180px', minWidth: 160 }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: FO.text }}>
                      {PLAN_LABELS[plano] ?? plano}
                    </div>
                    <div style={{ fontSize: 12, color: FO.textMuted, marginTop: 2 }}>
                      {PLAN_DESCRIPTIONS[plano] ?? ''}
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      marginTop: 10, padding: '5px 12px', borderRadius: 20,
                      background: statusMeta.bg, border: `1px solid ${statusMeta.border}`,
                      color: statusMeta.color, fontWeight: 700, fontSize: 12,
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusMeta.color, display: 'inline-block' }} />
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Expiry */}
                  <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                    <div style={{ fontSize: 11, color: FO.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {status === 'trial' ? 'Trial expira em' : 'Próximo vencimento'}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: FO.text }}>
                      {status === 'trial' ? fmt(trial_expira_em) : fmt(data_vencimento)}
                    </div>
                  </div>

                  {/* Payment method */}
                  {metodo_pagamento && (
                    <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                      <div style={{ fontSize: 11, color: FO.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        Método
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: FO.text }}>
                        {BILLING_ICONS[metodo_pagamento]} {BILLING_LABELS[metodo_pagamento]}
                      </div>
                    </div>
                  )}

                  {/* Limits */}
                  <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <div style={{ fontSize: 11, color: FO.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Limites do plano
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        ['CTOs',     limits.ctos],
                        ['ONUs',     limits.onus],
                        ['OLTs',     limits.olts],
                        ['Técnicos', limits.tecnicos],
                        ['Usuários', limits.users],
                      ].map(([label, val]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: FO.textMuted }}>{label}</span>
                          <span style={{ fontWeight: 700, color: val === null ? FO.green : FO.text }}>
                            {val === null ? 'Ilimitado' : val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Upgrade / Change plan button */}
                {!isExpired && (
                  <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${FO.border}` }}>
                    <button
                      onClick={() => setShowPlans(v => !v)}
                      style={{
                        padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                        background: showPlans ? FO.orangeBg : FO.espresso,
                        color: showPlans ? FO.orange : '#fff',
                        border: showPlans ? `1px solid ${FO.orangeBorder}` : 'none',
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                    >
                      {showPlans ? '↑ Ocultar planos' : 'Fazer upgrade de plano →'}
                    </button>
                  </div>
                )}
              </div>

              {/* Plans grid */}
              {(showPlans || isExpired) && (
                <div style={{ marginBottom: 28 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: FO.textMuted, margin: '0 0 16px', textTransform: 'uppercase' }}>
                    ESCOLHA UM PLANO
                  </p>
                  <div className="fo-plans-grid">
                    {PLAN_ORDER.map(p => (
                      <PlanCard
                        key={p}
                        planKey={p}
                        currentPlan={plano}
                        onSelect={setPlano}
                        disabled={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Payment history */}
              {pagamentos?.length > 0 && (
                <div style={{
                  background: FO.cream, borderRadius: 14,
                  border: `1px solid ${FO.border}`,
                  overflow: 'hidden', marginBottom: 24,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: FO.textMuted, margin: 0, padding: '16px 22px', borderBottom: `1px solid ${FO.border}`, textTransform: 'uppercase' }}>
                    ÚLTIMOS PAGAMENTOS
                  </p>
                  {pagamentos.map((p, i) => {
                    const st = PAYMENT_STATUS[p.status] ?? { label: p.status, color: FO.textMuted }
                    return (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '13px 22px', gap: 12,
                        borderBottom: i < pagamentos.length - 1 ? `1px solid ${FO.border}` : 'none',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: FO.text }}>
                            {p.description || 'Mensalidade'}
                          </div>
                          <div style={{ fontSize: 11, color: FO.textMuted, marginTop: 2 }}>
                            Venc.: {fmt(p.dueDate)} · {BILLING_LABELS[p.billingType] ?? p.billingType}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: FO.text }}>
                            {fmtBRL(p.value)}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                        </div>
                        {(p.invoiceUrl || p.bankSlipUrl) && ['PENDING', 'OVERDUE'].includes(p.status) && (
                          <a
                            href={p.invoiceUrl ?? p.bankSlipUrl}
                            target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: FO.orange, textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            Pagar →
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Cancel subscription */}
              {tem_assinatura && (
                <div style={{
                  paddingTop: 24, borderTop: `1px solid ${FO.border}`,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: FO.red, margin: '0 0 12px', textTransform: 'uppercase' }}>
                    ZONA DE PERIGO
                  </p>
                  {!confirmCancel ? (
                    <button
                      onClick={() => setConfirmCancel(true)}
                      style={{
                        padding: '8px 18px', borderRadius: 8, fontSize: 13,
                        border: `1px solid ${FO.redBorder}`, background: 'transparent',
                        color: FO.red, cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      Cancelar assinatura
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: FO.red, fontWeight: 600 }}>
                        Tem certeza? O acesso será suspenso imediatamente.
                      </span>
                      <button
                        onClick={handleCancel}
                        disabled={cancelPending}
                        style={{
                          padding: '7px 16px', borderRadius: 8, fontSize: 12,
                          background: FO.red, color: '#fff', border: 'none',
                          cursor: cancelPending ? 'not-allowed' : 'pointer', fontWeight: 700,
                        }}
                      >
                        {cancelPending ? 'Cancelando...' : 'Confirmar cancelamento'}
                      </button>
                      <button
                        onClick={() => setConfirmCancel(false)}
                        style={{
                          padding: '7px 14px', borderRadius: 8, fontSize: 12,
                          background: 'none', border: `1px solid ${FO.border}`,
                          cursor: 'pointer', color: FO.textMuted,
                        }}
                      >
                        Voltar
                      </button>
                      {cancelErro && <span style={{ fontSize: 12, color: FO.red }}>{cancelErro}</span>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
