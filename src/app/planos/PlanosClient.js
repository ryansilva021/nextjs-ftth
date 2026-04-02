'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  PLAN_LABELS, PLAN_PRICES, PLAN_LIMITS, PLAN_DESCRIPTIONS, formatPlanPrice,
} from '@/lib/plan-config'

// ─── Dados dos planos ─────────────────────────────────────────────────────────

const PLANS = [
  {
    key:     'basico',
    accent:  '#16a34a',
    icon:    '🌱',
    features: ['Até 4 OLTs', 'Até 500 ONUs', 'Até 5 usuários', 'Mapa interativo', 'Topologia FTTH', 'NOC em tempo real', 'Ordens de serviço'],
  },
  {
    key:     'pro',
    accent:  '#0891b2',
    icon:    '🚀',
    popular: true,
    features: ['OLTs ilimitadas', 'Até 2.000 ONUs', 'Até 15 usuários', 'Tudo do Básico', 'Cálculo de potência', 'Importação em massa', 'Log de eventos'],
  },
  {
    key:     'enterprise',
    accent:  '#7c3aed',
    icon:    '🏢',
    features: ['OLTs ilimitadas', 'ONUs ilimitadas', 'Usuários ilimitados', 'Tudo do Pro', 'Suporte prioritário', 'Onboarding dedicado', 'SLA garantido'],
  },
]

const BILLING_ICONS  = { PIX: '⚡', BOLETO: '📄', CREDIT_CARD: '💳' }
const BILLING_LABELS = { PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de Crédito' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: '1px solid #38bdf855', background: copied ? '#38bdf818' : 'transparent', color: '#38bdf8', cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      {copied ? '✓ Copiado!' : 'Copiar'}
    </button>
  )
}

// ─── Modal overlay ────────────────────────────────────────────────────────────

function Modal({ onClose, children }) {
  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(2,8,23,.85)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16,
        padding: '32px 28px', width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20, lineHeight: 1 }}
        >×</button>
        {children}
      </div>
    </div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 8, height: 8, borderRadius: 4,
          background: i < current ? '#22c55e' : i === current ? '#38bdf8' : '#1e293b',
          transition: 'width .2s, background .2s',
        }} />
      ))}
    </div>
  )
}

// ─── Step 1: Dados da empresa ─────────────────────────────────────────────────

function StepDados({ plano, onNext, onBack }) {
  const accent = PLANS.find(p => p.key === plano)?.accent ?? '#38bdf8'
  const [nome, setNome]   = useState('')
  const [email, setEmail] = useState('')
  const [cnpj,  setCnpj]  = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    setErro(null)
    if (nome.trim().length < 2)   return setErro('Nome da empresa é obrigatório.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErro('E-mail inválido.')
    setLoading(true)
    try {
      const res = await fetch('/api/checkout/send-verification', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, empresa_nome: nome.trim(), plano, cnpj: cnpj.replace(/\D/g, '') || undefined }),
      })
      let data = {}
      try { data = await res.json() } catch { /* resposta não-JSON do servidor */ }
      if (!res.ok) return setErro(data.email_error || data.error || `Erro ${res.status}. Tente novamente.`)
      onNext({ email, empresa_nome: nome.trim() })
    } catch (err) {
      setErro(err?.message || 'Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <StepDots current={0} total={4} />
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>Dados da empresa</h2>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>
        Plano <span style={{ color: accent, fontWeight: 700 }}>{PLAN_LABELS[plano]}</span> — {formatPlanPrice(plano)}/mês
      </p>

      <Field label="Nome da empresa *" value={nome} onChange={e => setNome(e.target.value)} placeholder="Exemplo Telecom Ltda" />
      <Field label="E-mail de acesso *" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@suaempresa.com" />
      <Field label="CNPJ" value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00 (opcional)" />

      {erro && <ErrBox msg={erro} />}

      <Btn loading={loading} label="Enviar código de verificação →" />
      <BackLink onClick={onBack} />
    </form>
  )
}

// ─── Step 2: Verificação do código ────────────────────────────────────────────

function StepCodigo({ email, empresa_nome, plano, onNext, onBack }) {
  const accent = PLANS.find(p => p.key === plano)?.accent ?? '#38bdf8'
  const [code, setCode]     = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResend] = useState(false)
  const [countdown, setCd]  = useState(60)
  const [erro, setErro]     = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCd(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function submit(e) {
    e.preventDefault()
    setErro(null)
    if (code.replace(/\D/g,'').length !== 6) return setErro('Digite o código de 6 dígitos.')
    setLoading(true)
    try {
      const res  = await fetch('/api/checkout/verify-code', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, code: code.replace(/\D/g,'') }),
      })
      let data = {}
      try { data = await res.json() } catch { /* resposta não-JSON */ }
      if (!res.ok) return setErro(data.error || `Erro ${res.status}.`)
      onNext()
    } catch (err) {
      setErro(err?.message || 'Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    setResend(true)
    try {
      await fetch('/api/checkout/send-verification', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, empresa_nome, plano }),
      })
      setCd(60)
      setErro(null)
    } finally {
      setResend(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <StepDots current={1} total={4} />
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>Confirme seu e-mail</h2>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
        Enviamos um código de 6 dígitos para <strong style={{ color: '#94a3b8' }}>{email}</strong>. Verifique sua caixa de entrada.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Código de verificação *</label>
        <input
          ref={inputRef}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
          placeholder="000000"
          maxLength={6}
          style={{
            ...inputStyle,
            fontSize: 28, fontWeight: 800, letterSpacing: 10,
            textAlign: 'center', fontFamily: 'monospace',
          }}
        />
      </div>

      {erro && <ErrBox msg={erro} />}

      <Btn loading={loading} label="Confirmar código →" />

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        {countdown > 0 ? (
          <span style={{ fontSize: 12, color: '#475569' }}>Reenviar em {countdown}s</span>
        ) : (
          <button type="button" onClick={resend} disabled={resending} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#38bdf8', fontWeight: 600 }}>
            {resending ? 'Enviando...' : 'Reenviar código'}
          </button>
        )}
      </div>
      <BackLink onClick={onBack} />
    </form>
  )
}

// ─── Step 3: Método de pagamento ──────────────────────────────────────────────

function StepPagamento({ email, plano, onNext, onBack }) {
  const accent   = PLANS.find(p => p.key === plano)?.accent ?? '#38bdf8'
  const [billing, setBilling] = useState('PIX')
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState(null)

  async function submit(e) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const res  = await fetch('/api/checkout/create-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, billing_type: billing }),
      })
      let data = {}
      try { data = await res.json() } catch { /* resposta não-JSON */ }
      if (!res.ok) return setErro(data.error || `Erro ${res.status}. Tente novamente.`)
      onNext({ ...data })
    } catch (err) {
      setErro(err?.message || 'Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <StepDots current={2} total={4} />
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>Forma de pagamento</h2>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>
        Plano <span style={{ color: accent, fontWeight: 700 }}>{PLAN_LABELS[plano]}</span> — {formatPlanPrice(plano)}/mês
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {['PIX', 'BOLETO', 'CREDIT_CARD'].map(b => (
          <button
            key={b} type="button" onClick={() => setBilling(b)}
            style={{
              flex: 1, padding: '14px 6px', borderRadius: 10,
              border: `2px solid ${billing === b ? accent : '#1e293b'}`,
              background: billing === b ? `${accent}18` : '#0f172a',
              cursor: 'pointer', fontSize: 11, fontWeight: 700,
              color: billing === b ? accent : '#475569',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: 22 }}>{BILLING_ICONS[b]}</span>
            {BILLING_LABELS[b]}
          </button>
        ))}
      </div>

      {billing === 'PIX'         && <InfoBox color="#22c55e" msg="⚡ QR Code será exibido na próxima tela. Ativação imediata após pagamento." />}
      {billing === 'BOLETO'      && <InfoBox color="#f59e0b" msg="📄 Linha digitável e PDF do boleto serão exibidos. Compensação em até 3 dias úteis." />}
      {billing === 'CREDIT_CARD' && <InfoBox color="#0891b2" msg="💳 Você será redirecionado para o checkout seguro do Asaas." />}

      {erro && <ErrBox msg={erro} />}

      <Btn loading={loading} label={loading ? 'Criando assinatura...' : 'Confirmar e pagar →'} />
      <BackLink onClick={onBack} />
    </form>
  )
}

// ─── Step 4a: PIX ─────────────────────────────────────────────────────────────

function StepPix({ data, email, onDone }) {
  const [polling, setPolling] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [pollMsg, setPollMsg] = useState(null)
  const pollRef = useRef(null)

  const checkStatus = useCallback(async () => {
    setPolling(true)
    try {
      const res  = await fetch(`/api/checkout/status?email=${encodeURIComponent(email)}`)
      const json = await res.json()
      if (json.confirmed) {
        setConfirmed(true)
        setPollMsg('✅ Pagamento confirmado! Conta criada — verifique seu e-mail.')
        clearInterval(pollRef.current)
      } else {
        setPollMsg('Aguardando confirmação do pagamento...')
      }
    } catch {
      setPollMsg('Erro ao verificar. Tente novamente.')
    } finally {
      setPolling(false)
    }
  }, [email])

  // Auto-polling a cada 10s
  useEffect(() => {
    pollRef.current = setInterval(checkStatus, 10000)
    return () => clearInterval(pollRef.current)
  }, [checkStatus])

  return (
    <div>
      <StepDots current={3} total={4} />
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', letterSpacing: '.04em', marginBottom: 6 }}>⚡ PAGUE VIA PIX</div>
        {data.value && <div style={{ fontSize: 32, fontWeight: 900, color: '#22c55e' }}>{fmtBRL(data.value)}</div>}
        {data.due_date && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Vencimento: {new Date(data.due_date).toLocaleDateString('pt-BR')}</div>}
      </div>

      {data.pix_encoded_image ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: '2px solid #22c55e44' }}>
            <img src={`data:image/png;base64,${data.pix_encoded_image}`} alt="QR Code PIX" width={180} height={180} style={{ display: 'block' }} />
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#475569', fontSize: 13, marginBottom: 20 }}>QR Code indisponível — use o código abaixo.</div>
      )}

      {data.pix_payload && (
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Código PIX copia e cola</div>
          <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', wordBreak: 'break-all', flex: 1, lineHeight: 1.5, maxHeight: 52, overflow: 'hidden' }}>
              {data.pix_payload}
            </div>
            <CopyButton text={data.pix_payload} />
          </div>
        </div>
      )}

      {data.pix_expiration && (
        <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginBottom: 16 }}>
          Código válido até {new Date(data.pix_expiration).toLocaleString('pt-BR')}
        </div>
      )}

      {pollMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: confirmed ? '#22c55e18' : '#38bdf818', border: `1px solid ${confirmed ? '#22c55e44' : '#38bdf833'}`, fontSize: 12, color: confirmed ? '#22c55e' : '#38bdf8', textAlign: 'center' }}>
          {pollMsg}
        </div>
      )}

      {confirmed ? (
        <Link href="/login" style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 10, background: '#22c55e', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
          Ir para o login →
        </Link>
      ) : (
        <button
          onClick={checkStatus} disabled={polling}
          style={{ width: '100%', padding: '13px', borderRadius: 10, background: polling ? '#1e293b' : '#22c55e', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: polling ? 'not-allowed' : 'pointer' }}
        >
          {polling ? 'Verificando...' : 'Já paguei — verificar status'}
        </button>
      )}

      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#334155' }}>
        O status é verificado automaticamente a cada 10 segundos.
      </div>
    </div>
  )
}

// ─── Step 4b: Boleto ──────────────────────────────────────────────────────────

function StepBoleto({ data, email }) {
  const [polling, setPolling] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [pollMsg, setPollMsg] = useState(null)
  const pollRef = useRef(null)

  const checkStatus = useCallback(async () => {
    setPolling(true)
    try {
      const res  = await fetch(`/api/checkout/status?email=${encodeURIComponent(email)}`)
      const json = await res.json()
      if (json.confirmed) { setConfirmed(true); setPollMsg('✅ Pagamento confirmado! Verifique seu e-mail.'); clearInterval(pollRef.current) }
      else setPollMsg('Aguardando compensação do boleto...')
    } catch { setPollMsg('Erro ao verificar.') }
    finally { setPolling(false) }
  }, [email])

  useEffect(() => {
    pollRef.current = setInterval(checkStatus, 15000)
    return () => clearInterval(pollRef.current)
  }, [checkStatus])

  return (
    <div>
      <StepDots current={3} total={4} />
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', letterSpacing: '.04em', marginBottom: 6 }}>📄 BOLETO BANCÁRIO</div>
        {data.value && <div style={{ fontSize: 32, fontWeight: 900, color: '#f59e0b' }}>{fmtBRL(data.value)}</div>}
        {data.due_date && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Vencimento: {new Date(data.due_date).toLocaleDateString('pt-BR')}</div>}
      </div>

      {data.boleto_barcode ? (
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Linha digitável</div>
          <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8', wordBreak: 'break-all', flex: 1, lineHeight: 1.6 }}>{data.boleto_barcode}</div>
            <CopyButton text={data.boleto_barcode} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', marginBottom: 20 }}>Use o link abaixo para acessar o boleto.</div>
      )}

      {(data.boleto_pdf_url || data.invoice_url) && (
        <a
          href={data.boleto_pdf_url ?? data.invoice_url}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 10, background: '#f59e0b', color: '#020817', fontWeight: 800, fontSize: 14, textDecoration: 'none', marginBottom: 16 }}
        >
          Abrir / baixar boleto →
        </a>
      )}

      <InfoBox color="#f59e0b" msg="Após o pagamento, a compensação pode levar até 3 dias úteis. Sua conta será criada automaticamente." />

      {pollMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: confirmed ? '#22c55e18' : '#38bdf818', border: `1px solid ${confirmed ? '#22c55e44' : '#38bdf833'}`, fontSize: 12, color: confirmed ? '#22c55e' : '#38bdf8', textAlign: 'center' }}>
          {pollMsg}
        </div>
      )}

      {confirmed && (
        <Link href="/login" style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 10, background: '#22c55e', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
          Ir para o login →
        </Link>
      )}
    </div>
  )
}

// ─── Step 4c: Cartão ──────────────────────────────────────────────────────────

function StepCartao({ data, email }) {
  const url = data.credit_card_url ?? data.invoice_url
  const [polling, setPolling]   = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [pollMsg, setPollMsg]   = useState(null)
  const pollRef = useRef(null)

  useEffect(() => {
    if (url) {
      const t = setTimeout(() => window.open(url, '_blank'), 600)
      return () => clearTimeout(t)
    }
  }, [url])

  const checkStatus = useCallback(async () => {
    setPolling(true)
    try {
      const res  = await fetch(`/api/checkout/status?email=${encodeURIComponent(email)}`)
      const json = await res.json()
      if (json.confirmed) {
        setConfirmed(true)
        setPollMsg('✅ Pagamento confirmado! Verifique seu e-mail.')
        clearInterval(pollRef.current)
      } else {
        setPollMsg('Aguardando confirmação do pagamento...')
      }
    } catch {
      setPollMsg('Erro ao verificar. Tente novamente.')
    } finally {
      setPolling(false)
    }
  }, [email])

  // Auto-polling a cada 10s
  useEffect(() => {
    pollRef.current = setInterval(checkStatus, 10000)
    return () => clearInterval(pollRef.current)
  }, [checkStatus])

  return (
    <div style={{ textAlign: 'center' }}>
      <StepDots current={3} total={4} />
      <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>Checkout seguro</h3>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
        Você será redirecionado para o checkout seguro do Asaas. Após o pagamento, suas credenciais de acesso serão enviadas por e-mail.
      </p>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 10, background: '#0891b2', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 20 }}
        >
          Ir para o checkout →
        </a>
      )}

      {pollMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: confirmed ? '#22c55e18' : '#38bdf818', border: `1px solid ${confirmed ? '#22c55e44' : '#38bdf833'}`, fontSize: 12, color: confirmed ? '#22c55e' : '#38bdf8', textAlign: 'center' }}>
          {pollMsg}
        </div>
      )}

      {confirmed ? (
        <Link href="/login" style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 10, background: '#22c55e', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
          Ir para o login →
        </Link>
      ) : (
        <button
          onClick={checkStatus} disabled={polling}
          style={{ width: '100%', padding: '13px', borderRadius: 10, background: polling ? '#1e293b' : '#0891b2', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: polling ? 'not-allowed' : 'pointer', marginTop: url ? 0 : 0 }}
        >
          {polling ? 'Verificando...' : 'Já paguei — verificar status'}
        </button>
      )}

      <div style={{ fontSize: 11, color: '#334155', marginTop: 10 }}>
        Processamento seguro via Asaas · TLS · verificação automática a cada 10s
      </div>
    </div>
  )
}

// ─── Checkout Modal (state machine) ──────────────────────────────────────────

function CheckoutModal({ plano, onClose }) {
  // steps: 'dados' | 'codigo' | 'pagamento' | 'pix' | 'boleto' | 'cartao'
  const [step, setStep] = useState('dados')
  const [ctx,  setCtx]  = useState({ plano })

  function goNext(extra = {}) {
    setCtx(c => ({ ...c, ...extra }))
    setStep(s => {
      if (s === 'dados')     return 'codigo'
      if (s === 'codigo')    return 'pagamento'
      if (s === 'pagamento') return 'pix' // será sobrescrito pelo onNext
      return s
    })
  }

  function goBack() {
    setStep(s => {
      if (s === 'codigo')    return 'dados'
      if (s === 'pagamento') return 'codigo'
      return s
    })
  }

  function handlePaymentResult(data) {
    setCtx(c => ({ ...c, ...data }))
    const bt = data.billing_type
    setStep(bt === 'PIX' ? 'pix' : bt === 'BOLETO' ? 'boleto' : 'cartao')
  }

  const isPaying = ['pix', 'boleto', 'cartao'].includes(step)

  return (
    <Modal onClose={isPaying ? undefined : onClose}>
      {step === 'dados' && (
        <StepDados plano={ctx.plano} onNext={({ email, empresa_nome }) => { setCtx(c => ({ ...c, email, empresa_nome })); setStep('codigo') }} onBack={onClose} />
      )}
      {step === 'codigo' && (
        <StepCodigo email={ctx.email} empresa_nome={ctx.empresa_nome} plano={ctx.plano} onNext={() => setStep('pagamento')} onBack={() => setStep('dados')} />
      )}
      {step === 'pagamento' && (
        <StepPagamento email={ctx.email} plano={ctx.plano} onNext={handlePaymentResult} onBack={() => setStep('codigo')} />
      )}
      {step === 'pix'    && <StepPix    data={ctx} email={ctx.email} onDone={onClose} />}
      {step === 'boleto' && <StepBoleto data={ctx} email={ctx.email} />}
      {step === 'cartao' && <StepCartao data={ctx} email={ctx.email} />}
    </Modal>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function FeatureRow({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
      <span style={{ color: '#22c55e', fontSize: 13, flexShrink: 0 }}>✓</span>
      <span style={{ fontSize: 13, color: '#94a3b8' }}>{text}</span>
    </div>
  )
}

function PlanCard({ plan, logado, isAdmin, onAssinar }) {
  const { key, accent, icon, popular, features } = plan

  const ctaAction = logado
    ? () => window.location.href = '/admin/assinatura'
    : () => onAssinar(key)
  const ctaLabel = logado ? 'Acessar assinatura' : 'Assinar agora'

  return (
    <div
      style={{
        position: 'relative', border: `2px solid ${popular ? accent : '#1e293b'}`,
        borderRadius: 16, padding: '32px 28px', background: popular ? `${accent}0d` : '#0f172a',
        display: 'flex', flexDirection: 'column', transition: 'transform .15s, border-color .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = accent }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = popular ? accent : '#1e293b' }}
    >
      {popular && (
        <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: accent, color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 16px', borderRadius: 20, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
          MAIS POPULAR
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>{PLAN_LABELS[key]}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{PLAN_DESCRIPTIONS[key]}</div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 38, fontWeight: 900, color: accent, lineHeight: 1 }}>{formatPlanPrice(key)}</span>
        {PLAN_PRICES[key] > 0 && <span style={{ fontSize: 13, color: '#64748b', marginLeft: 4 }}>/mês</span>}
      </div>

      <div style={{ marginBottom: 28, flex: 1 }}>
        {features.map(f => <FeatureRow key={f} text={f} />)}
      </div>

      <div style={{ borderTop: `1px solid ${accent}33`, paddingTop: 16, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        {[{ l: 'OLTs', v: PLAN_LIMITS[key].olts }, { l: 'ONUs', v: PLAN_LIMITS[key].onus }, { l: 'Users', v: PLAN_LIMITS[key].users }].map(({ l, v }) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: v === null ? '#22c55e' : accent }}>{v === null ? '∞' : v}</div>
            <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em' }}>{l}</div>
          </div>
        ))}
      </div>

      <button
        onClick={ctaAction}
        style={{
          width: '100%', padding: '13px', borderRadius: 10, cursor: 'pointer',
          background: popular ? accent : 'transparent',
          border: `2px solid ${accent}`,
          color: popular ? '#fff' : accent,
          fontWeight: 700, fontSize: 14, transition: 'background .15s, color .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={e => { e.currentTarget.style.background = popular ? accent : 'transparent'; e.currentTarget.style.color = popular ? '#fff' : accent }}
      >
        {ctaLabel} →
      </button>
    </div>
  )
}

// ─── Shared micro-components ──────────────────────────────────────────────────

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14, border: '1px solid #1e293b', background: '#0a1628', color: '#f1f5f9', boxSizing: 'border-box', outline: 'none' }

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} />
    </div>
  )
}

function ErrBox({ msg }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: '#ef444414', border: '1px solid #ef444433', fontSize: 12, color: '#ef4444' }}>
      ⚠️ {msg}
    </div>
  )
}

function InfoBox({ msg, color = '#38bdf8' }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 18, background: `${color}14`, border: `1px solid ${color}33`, fontSize: 12, color, lineHeight: 1.5 }}>
      {msg}
    </div>
  )
}

function Btn({ loading, label }) {
  return (
    <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: 10, background: loading ? '#1e293b' : '#38bdf8', color: loading ? '#475569' : '#020817', fontWeight: 800, fontSize: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .15s', marginTop: 4 }}>
      {loading ? 'Aguarde...' : label}
    </button>
  )
}

function BackLink({ onClick }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 16 }}>
      <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 12, fontWeight: 600 }}>
        ← Voltar
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PlanosClient({ logado, isAdmin }) {
  const [checkout, setCheckout] = useState(null) // plano selecionado para checkout

  return (
    <div style={{ minHeight: '100vh', background: '#020817', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", color: '#f1f5f9' }}>

      {checkout && !logado && (
        <CheckoutModal plano={checkout} onClose={() => setCheckout(null)} />
      )}

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, background: '#020817cc', backdropFilter: 'blur(10px)', zIndex: 100 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontWeight: 900, fontSize: 18, color: '#38bdf8', letterSpacing: '-.02em' }}>Fiber<span style={{ color: '#f1f5f9' }}>Ops</span></span>
        </Link>
        <Link href={logado ? '/admin/assinatura' : '/login'} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, background: '#38bdf8', color: '#020817', fontWeight: 700, textDecoration: 'none' }}>
          {logado ? 'Minha assinatura' : 'Entrar'}
        </Link>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '72px 24px 56px' }}>
        <div style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 20, background: '#38bdf818', border: '1px solid #38bdf833', fontSize: 12, fontWeight: 700, color: '#38bdf8', letterSpacing: '.06em', marginBottom: 20 }}>
          PLANOS E PREÇOS
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15 }}>
          O plano certo para o<br /><span style={{ color: '#38bdf8' }}>seu provedor</span>
        </h1>
        <p style={{ fontSize: 16, color: '#64748b', maxWidth: 480, margin: '0 auto 12px' }}>
          Gerencie sua rede FTTH com mapa interativo, topologia, NOC em tempo real e ordens de serviço. Sem contrato de fidelidade.
        </p>
        <div style={{ fontSize: 13, color: '#475569' }}>
          ✓ Cobrança via Asaas &nbsp;·&nbsp; ✓ PIX, Boleto ou Cartão &nbsp;·&nbsp; ✓ Cancele quando quiser
        </div>
      </div>

      {/* Plan Cards */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {PLANS.map(plan => (
          <PlanCard
            key={plan.key}
            plan={plan}
            logado={logado}
            isAdmin={isAdmin}
            onAssinar={plano => setCheckout(plano)}
          />
        ))}
      </div>

      {/* CTA login para usuários existentes */}
      {!logado && (
        <div style={{ maxWidth: 640, margin: '0 auto 80px', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ border: '1px solid #1e293b', borderRadius: 16, padding: '32px 28px', background: '#0f172a' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Já tem uma conta?</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>
              Acesse o painel para gerenciar sua assinatura, trocar de plano ou atualizar sua forma de pagamento.
            </p>
            <Link href="/login" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 10, background: '#38bdf8', color: '#020817', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
              Entrar no painel →
            </Link>
          </div>
        </div>
      )}

      {/* FAQ */}
      <div style={{ maxWidth: 640, margin: '0 auto 80px', padding: '0 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, marginBottom: 28 }}>Perguntas frequentes</h2>
        {[
          { q: 'Como funciona a criação da conta?',       r: 'Após o pagamento ser confirmado pelo Asaas, criamos automaticamente sua empresa e enviamos as credenciais de acesso por e-mail.' },
          { q: 'Posso trocar de plano depois?',           r: 'Sim. Acesse o painel em /admin/assinatura a qualquer momento para fazer upgrade ou downgrade.' },
          { q: 'Quais formas de pagamento são aceitas?',  r: 'PIX, boleto bancário e cartão de crédito — todos processados pelo Asaas de forma segura.' },
          { q: 'O que acontece se o pagamento atrasar?',  r: 'Você receberá um aviso por e-mail. Após 7 dias sem pagamento, o acesso é suspenso temporariamente. Seus dados são preservados.' },
          { q: 'Preciso de contrato?',                    r: 'Não. A assinatura é mensal e pode ser cancelada a qualquer momento sem multa.' },
        ].map(({ q, r }) => (
          <div key={q} style={{ marginBottom: 12, border: '1px solid #1e293b', borderRadius: 10, padding: '16px 20px', background: '#0f172a' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', marginBottom: 6 }}>{q}</div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{r}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px', borderTop: '1px solid #1e293b', color: '#475569', fontSize: 12 }}>
        © {new Date().getFullYear()} FiberOps · Todos os direitos reservados
      </div>
    </div>
  )
}
