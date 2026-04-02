'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { assinarPlano, cancelarAssinatura, checkPaymentStatus } from '@/actions/assinatura'
import {
  PLAN_LABELS, PLAN_PRICES, PLAN_LIMITS, PLAN_DESCRIPTIONS, formatPlanPrice,
} from '@/lib/plan-config'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  ativo:          { label: 'Ativo',          color: '#22c55e', bg: '#22c55e18' },
  trial:          { label: 'Trial',          color: '#f59e0b', bg: '#f59e0b18' },
  vencido:        { label: 'Vencido',        color: '#ef4444', bg: '#ef444418' },
  bloqueado:      { label: 'Bloqueado',      color: '#ef4444', bg: '#ef444418' },
  trial_expirado: { label: 'Trial Expirado', color: '#ef4444', bg: '#ef444418' },
}

const BILLING_LABELS = { PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de Crédito' }
const BILLING_ICONS  = { PIX: '⚡', BOLETO: '📄', CREDIT_CARD: '💳' }

const PAYMENT_STATUS = {
  PENDING:   { label: 'Pendente',   color: '#f59e0b' },
  RECEIVED:  { label: 'Recebido',  color: '#22c55e' },
  CONFIRMED: { label: 'Confirmado', color: '#22c55e' },
  OVERDUE:   { label: 'Vencido',   color: '#ef4444' },
  REFUNDED:  { label: 'Estornado', color: '#8b949e' },
  CANCELED:  { label: 'Cancelado', color: '#8b949e' },
}

const PLAN_ACCENT = {
  basico:     '#16a34a',
  pro:        '#0891b2',
  enterprise: '#7c3aed',
  trial:      '#8b949e',
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function fmtBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

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
        border: '1px solid #0891b255', background: copied ? '#0891b218' : 'transparent',
        color: '#0891b2', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copiado!' : label}
    </button>
  )
}

// ─── Limit Item ───────────────────────────────────────────────────────────────

function LimitItem({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: value === null ? '#22c55e' : 'var(--text-primary)' }}>
        {value === null ? 'Ilimitado' : String(value)}
      </span>
    </div>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ planKey, currentPlan, onSelect, disabled }) {
  const isCurrentPlan = planKey === currentPlan
  const accent        = PLAN_ACCENT[planKey] ?? '#8b949e'
  const limits        = PLAN_LIMITS[planKey]

  return (
    <div
      onClick={() => !disabled && !isCurrentPlan && onSelect(planKey)}
      style={{
        border:       `2px solid ${isCurrentPlan ? accent : 'var(--border-color)'}`,
        borderRadius: 12,
        padding:      '20px 18px',
        cursor:       disabled || isCurrentPlan ? 'default' : 'pointer',
        position:     'relative',
        background:   isCurrentPlan ? `${accent}0d` : 'var(--card-bg)',
        transition:   'border-color .15s, background .15s',
        opacity:      disabled && !isCurrentPlan ? 0.5 : 1,
      }}
      onMouseEnter={e => { if (!disabled && !isCurrentPlan) e.currentTarget.style.borderColor = accent }}
      onMouseLeave={e => { if (!isCurrentPlan) e.currentTarget.style.borderColor = isCurrentPlan ? accent : 'var(--border-color)' }}
    >
      {isCurrentPlan && (
        <span style={{
          position: 'absolute', top: -11, left: 14,
          background: accent, color: '#fff',
          fontSize: 10, fontWeight: 700, padding: '2px 10px',
          borderRadius: 20, letterSpacing: '.04em',
        }}>
          PLANO ATUAL
        </span>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: accent }}>{PLAN_LABELS[planKey]}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{PLAN_DESCRIPTIONS[planKey]}</div>
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
        {formatPlanPrice(planKey)}
        {PLAN_PRICES[planKey] > 0 && (
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>/mês</span>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
        <LimitItem label="OLTs"     value={limits.olts} />
        <LimitItem label="ONUs"     value={limits.onus} />
        <LimitItem label="Usuários" value={limits.users} />
      </div>

      {!isCurrentPlan && !disabled && (
        <div style={{
          marginTop: 14, textAlign: 'center', padding: '7px',
          borderRadius: 8, background: accent, color: '#fff',
          fontSize: 12, fontWeight: 700,
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
  const accent                      = PLAN_ACCENT[planoSelecionado] ?? '#0891b2'

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
    <div style={{ maxWidth: 440 }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        ← Voltar
      </button>

      <div style={{
        borderRadius: 12, padding: '18px 20px', marginBottom: 24,
        background: `${accent}0d`, border: `1px solid ${accent}33`,
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>Plano selecionado</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: accent }}>
          {PLAN_LABELS[planoSelecionado]}
          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
            {formatPlanPrice(planoSelecionado)}/mês
          </span>
        </div>
      </div>

      {/* Método de pagamento */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Forma de pagamento
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {['PIX', 'BOLETO', 'CREDIT_CARD'].map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              style={{
                flex: 1, padding: '12px 6px', borderRadius: 10,
                border:     `2px solid ${billing === b ? accent : 'var(--border-color)'}`,
                background: billing === b ? `${accent}18` : 'var(--card-bg)',
                cursor:     'pointer', fontSize: 11, fontWeight: 700,
                color:      billing === b ? accent : 'var(--text-muted)',
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
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          CPF / CNPJ <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional — melhora o registro no Asaas)</span>
        </label>
        <input
          value={cpfCnpj}
          onChange={e => setCpfCnpj(e.target.value)}
          placeholder="00.000.000/0000-00"
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--border-color)', background: 'var(--input-bg)',
            color: 'var(--text-primary)', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Info por tipo */}
      {billing === 'PIX' && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 18, background: '#22c55e14', border: '1px solid #22c55e33', fontSize: 12, color: '#22c55e' }}>
          ⚡ O QR Code PIX será exibido na próxima tela. A ativação é automática após pagamento.
        </div>
      )}
      {billing === 'BOLETO' && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 18, background: '#f59e0b14', border: '1px solid #f59e0b33', fontSize: 12, color: '#f59e0b' }}>
          📄 O código de barras e link do boleto serão exibidos na próxima tela. Compensação em até 3 dias úteis.
        </div>
      )}
      {billing === 'CREDIT_CARD' && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 18, background: '#0891b214', border: '1px solid #0891b233', fontSize: 12, color: '#0891b2' }}>
          💳 Você será redirecionado para o checkout seguro do Asaas para inserir os dados do cartão.
        </div>
      )}

      {erro && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: '#ef444414', border: '1px solid #ef444433', fontSize: 12, color: '#ef4444' }}>
          ⚠️ {erro}
        </div>
      )}

      <button
        onClick={submit}
        disabled={pending}
        style={{
          width: '100%', padding: '13px', borderRadius: 10,
          background: pending ? 'var(--border-color)' : accent,
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

// ─── Payment Screen — PIX ─────────────────────────────────────────────────────

function PixPaymentScreen({ resultado, onVerify, verifying, confirmed }) {
  const { pix_encoded_image, pix_payload, pix_expiration, invoice_url, due_date, value } = resultado

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', letterSpacing: '.04em', marginBottom: 8 }}>
          ⚡ PAGAMENTO VIA PIX
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Escaneie o QR Code ou copie o código PIX para pagar.
          {due_date && ` Vencimento: ${fmt(due_date)}.`}
        </div>
        {value && (
          <div style={{ fontSize: 28, fontWeight: 900, color: '#22c55e', marginTop: 8 }}>
            {fmtBRL(value)}
          </div>
        )}
      </div>

      {pix_encoded_image ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            background: '#fff', padding: 16, borderRadius: 12,
            border: '2px solid #22c55e55', display: 'inline-block',
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
        <div style={{ textAlign: 'center', marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          QR Code indisponível — use o código abaixo.
        </div>
      )}

      {pix_payload && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Chave Pix copia e cola
          </div>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border-color)',
            borderRadius: 8, padding: '10px 12px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <div style={{
              fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)',
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
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, textAlign: 'center' }}>
          Código válido até {new Date(pix_expiration).toLocaleString('pt-BR')}
        </div>
      )}

      {invoice_url && (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <a
            href={invoice_url}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#0891b2', textDecoration: 'none', fontWeight: 600 }}
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
          background: confirmed ? '#22c55e' : verifying ? 'var(--border-color)' : '#22c55e',
          color: '#fff', fontWeight: 700, fontSize: 14,
          border: 'none', cursor: verifying || confirmed ? 'not-allowed' : 'pointer',
        }}
      >
        {confirmed ? '✓ Pagamento confirmado!' : verifying ? 'Verificando...' : 'Verificar pagamento'}
      </button>

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        O status é atualizado automaticamente. Use este botão para checar imediatamente.
      </div>
    </div>
  )
}

// ─── Payment Screen — Boleto ──────────────────────────────────────────────────

function BoletoPaymentScreen({ resultado, onVerify, verifying, confirmed }) {
  const { boleto_barcode, boleto_pdf_url, invoice_url, due_date, value } = resultado

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', letterSpacing: '.04em', marginBottom: 8 }}>
          📄 BOLETO BANCÁRIO
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Pague o boleto via internet banking, app ou lotérica.
          {due_date && ` Vencimento: ${fmt(due_date)}.`}
        </div>
        {value && (
          <div style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b', marginTop: 8 }}>
            {fmtBRL(value)}
          </div>
        )}
      </div>

      {boleto_barcode ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Linha digitável
          </div>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border-color)',
            borderRadius: 8, padding: '12px 14px',
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <div style={{
              fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)',
              wordBreak: 'break-all', flex: 1, lineHeight: 1.6,
            }}>
              {boleto_barcode}
            </div>
            <CopyButton text={boleto_barcode} label="Copiar" />
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          Código de barras não disponível ainda — use o link para acessar o boleto.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {(boleto_pdf_url || invoice_url) && (
          <a
            href={boleto_pdf_url ?? invoice_url}
            target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, display: 'block', textAlign: 'center',
              padding: '11px', borderRadius: 10,
              background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Abrir / baixar boleto →
          </a>
        )}
      </div>

      <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 20, background: '#f59e0b14', border: '1px solid #f59e0b33', fontSize: 12, color: '#f59e0b' }}>
        Após o pagamento, a compensação pode levar até 3 dias úteis. Seu plano será ativado automaticamente.
      </div>

      <button
        onClick={onVerify}
        disabled={verifying || confirmed}
        style={{
          width: '100%', padding: '12px', borderRadius: 10,
          background: confirmed ? '#22c55e' : verifying ? 'var(--border-color)' : '#f59e0b',
          color: '#fff', fontWeight: 700, fontSize: 14,
          border: 'none', cursor: verifying || confirmed ? 'not-allowed' : 'pointer',
        }}
      >
        {confirmed ? '✓ Pagamento confirmado!' : verifying ? 'Verificando...' : 'Verificar status do pagamento'}
      </button>
    </div>
  )
}

// ─── Payment Screen — Credit Card ─────────────────────────────────────────────

function CreditCardPaymentScreen({ resultado }) {
  const { credit_card_url, invoice_url } = resultado
  const checkoutUrl = credit_card_url ?? invoice_url

  if (checkoutUrl) {
    // Redirect automático após breve delay
    if (typeof window !== 'undefined') {
      setTimeout(() => { window.open(checkoutUrl, '_blank') }, 800)
    }
  }

  return (
    <div style={{ maxWidth: 440, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
        Checkout seguro
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
        Você será redirecionado para o checkout seguro do Asaas para inserir os dados do cartão de crédito.
        O plano será ativado imediatamente após a confirmação.
      </p>

      {checkoutUrl ? (
        <a
          href={checkoutUrl}
          target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-block', padding: '13px 32px', borderRadius: 10,
            background: '#0891b2', color: '#fff', fontWeight: 700, fontSize: 14,
            textDecoration: 'none', marginBottom: 12,
          }}
        >
          Ir para o checkout →
        </a>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Link de checkout indisponível. Tente novamente.
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
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
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}
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
          background: confirmed ? '#22c55e18' : '#f59e0b18',
          border: `1px solid ${confirmed ? '#22c55e33' : '#f59e0b33'}`,
          fontSize: 12, color: confirmed ? '#22c55e' : '#f59e0b',
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
  const router                          = useRouter()
  const [planoSelecionado, setPlano]    = useState(null)
  const [resultado, setResultado]       = useState(null)
  const [cancelPending, startCancel]    = useTransition()
  const [cancelErro, setCancelErro]     = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (erroInicial) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ padding: '14px 18px', borderRadius: 8, background: '#ef444414', border: '1px solid #ef444433', color: '#ef4444', fontSize: 14 }}>
          ⚠️ {erroInicial}
        </div>
      </div>
    )
  }

  const { plano, status, trial_expira_em, data_vencimento, tem_assinatura, metodo_pagamento, pagamentos } = dados
  const statusMeta = STATUS_META[status] ?? STATUS_META.trial

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

  // ── Tela pós-checkout ──
  if (resultado) {
    return (
      <div style={{ padding: 24, maxWidth: 560, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
        <ResultadoScreen resultado={resultado} onBack={() => { setResultado(null); setPlano(null) }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 920, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Assinatura
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Gerencie seu plano e forma de pagamento
        </p>
      </div>

      {/* ── Status Card ── */}
      <div style={{
        border: '1px solid var(--border-color)', borderRadius: 12,
        padding: '18px 22px', marginBottom: 28, background: 'var(--card-bg)',
        display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>Plano atual</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: PLAN_ACCENT[plano] ?? 'var(--text-primary)' }}>
            {PLAN_LABELS[plano] ?? plano}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {PLAN_DESCRIPTIONS[plano] ?? ''}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Status</div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20,
            background: statusMeta.bg, color: statusMeta.color,
            fontWeight: 700, fontSize: 12,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusMeta.color, display: 'inline-block' }} />
            {statusMeta.label}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {status === 'trial' ? 'Trial expira em' : 'Próximo vencimento'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {status === 'trial' ? fmt(trial_expira_em) : fmt(data_vencimento)}
          </div>
        </div>

        {metodo_pagamento && (
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>Método</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {BILLING_ICONS[metodo_pagamento]} {BILLING_LABELS[metodo_pagamento]}
            </div>
          </div>
        )}
      </div>

      {/* ── Checkout Form ou Planos ── */}
      {planoSelecionado ? (
        <CheckoutForm
          planoSelecionado={planoSelecionado}
          onBack={() => setPlano(null)}
          onSuccess={res => setResultado(res)}
        />
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Escolha um plano
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 14, marginBottom: 32,
          }}>
            {['basico', 'pro', 'enterprise'].map(p => (
              <PlanCard
                key={p}
                planKey={p}
                currentPlan={plano}
                onSelect={setPlano}
                disabled={false}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Histórico de pagamentos ── */}
      {!planoSelecionado && pagamentos?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Últimos pagamentos
          </div>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--card-bg)' }}>
            {pagamentos.map((p, i) => {
              const st = PAYMENT_STATUS[p.status] ?? { label: p.status, color: 'var(--text-muted)' }
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 18px', gap: 12,
                  borderBottom: i < pagamentos.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.description || 'Mensalidade'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Venc.: {fmt(p.dueDate)} · {BILLING_LABELS[p.billingType] ?? p.billingType}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {fmtBRL(p.value)}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                  </div>
                  {(p.invoiceUrl || p.bankSlipUrl) && ['PENDING', 'OVERDUE'].includes(p.status) && (
                    <a
                      href={p.invoiceUrl ?? p.bankSlipUrl}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#0891b2', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Pagar →
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Cancelar assinatura ── */}
      {!planoSelecionado && tem_assinatura && (
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Zona de perigo
          </div>
          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13,
                border: '1px solid #ef444455', background: 'transparent',
                color: '#ef4444', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Cancelar assinatura
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
                Tem certeza? O acesso será suspenso imediatamente.
              </span>
              <button
                onClick={handleCancel}
                disabled={cancelPending}
                style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, background: '#ef4444', color: '#fff', border: 'none', cursor: cancelPending ? 'not-allowed' : 'pointer', fontWeight: 700 }}
              >
                {cancelPending ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, background: 'none', border: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                Voltar
              </button>
              {cancelErro && <span style={{ fontSize: 12, color: '#ef4444' }}>{cancelErro}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
