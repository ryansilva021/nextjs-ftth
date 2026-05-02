'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { checkLoginDisponivel, criarRegistro, iniciarCheckoutPagamento } from '@/actions/registros'

// ───────────────────────── Brand palette ─────────────────────────
const FO = {
  orange:      '#C45A2C',
  orangeDeep:  '#8E3B1A',
  orangeSoft:  '#E88A5A',
  orangeGlow:  '#F4A771',
  beige:       '#EDE3D2',
  beigeDeep:   '#D9CBB4',
  cream:       '#F7F0E2',
  espresso:    '#1A120D',
  espressoUp:  '#2A1F17',
  line:        'rgba(30,22,18,0.12)',
  lineDark:    'rgba(237,227,210,0.12)',
  muted:       'rgba(237,227,210,0.6)',
  success:     '#3f8a54',
}

// ───────────────────────── Logo ─────────────────────────
function LogoMark({ size = 40, bg = FO.orange, f = FO.espresso, stripes, radius }) {
  const r = radius ?? size * 0.22
  const stripeColor = stripes ?? (bg === FO.orange ? FO.espresso : FO.orange)
  return (
    <div style={{
      width: size, height: size, background: bg, borderRadius: r,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: bg === FO.orange
        ? '0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 10px rgba(196,90,44,0.25)'
        : '0 1px 0 rgba(255,255,255,0.06) inset',
      flexShrink: 0,
    }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 72 72" fill="none">
        <g transform="translate(18,13)">
          <path d="M4 2 L4 46 Q4 48 6 48 L10 48 Q12 48 12 46 L12 30 L26 30 Q28 30 28 28 L28 24 Q28 22 26 22 L12 22 L12 10 L30 10 L30 14 Q30 16 32 16 L34 16 Q36 16 36 14 L36 4 Q36 2 34 2 Z" fill={f}/>
          <rect x="4" y="2" width="1.8" height="46" fill={stripeColor} opacity="0.9"/>
          <rect x="10.2" y="2" width="1.8" height="46" fill={stripeColor} opacity="0.9"/>
        </g>
      </svg>
    </div>
  )
}

function Wordmark({ size = 28, color = FO.espresso, accent = FO.orange }) {
  return (
    <span style={{
      fontFamily: '"Instrument Serif", "Newsreader", Georgia, serif',
      fontSize: size, fontWeight: 400, letterSpacing: '-0.02em',
      color, lineHeight: 1, display: 'inline-flex',
    }}>
      Fiber<span style={{ fontStyle: 'italic', color: accent }}>Ops</span>
    </span>
  )
}

// ───────────────────────── TitleBar ─────────────────────────
function TitleBar() {
  return (
    <div style={{
      height: 36, background: FO.orange, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px',
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: 12, color: FO.cream,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9 }}>
        <LogoMark size={18} bg="transparent" f={FO.cream} stripes={FO.espresso} radius={4}/>
        <span className="fo-titlebar-text">FiberOps · Solicitar acesso</span>
      </div>
      <div style={{ display: 'flex', gap: 14, color: 'rgba(247,240,226,0.8)', fontSize: 11 }}>
        <Link href="/login" style={{ color: 'rgba(247,240,226,0.8)', textDecoration: 'none' }}>Entrar</Link>
      </div>
    </div>
  )
}

// ───────────────────────── Stepper ─────────────────────────
function Stepper({ step, labels }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
      {labels.map((l, i) => {
        const active = i === step
        const done   = i < step
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < labels.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 13,
                background: done ? FO.orange : active ? FO.espresso : 'transparent',
                border: `1.5px solid ${done || active ? 'transparent' : 'rgba(30,22,18,0.25)'}`,
                color: done || active ? FO.cream : 'rgba(30,22,18,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 500,
                fontFamily: '"JetBrains Mono", monospace',
                transition: 'all .25s',
              }}>
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6.2 L5 9.2 L10 3.5" stroke={FO.cream} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (i + 1)}
              </div>
              <div style={{
                fontSize: 12.5, fontWeight: active ? 600 : 400,
                color: active ? FO.espresso : 'rgba(30,22,18,0.55)',
              }} className="fo-step-label">{l}</div>
            </div>
            {i < labels.length - 1 && (
              <div style={{
                flex: 1, height: 1, margin: '0 12px',
                background: done ? FO.orange : 'rgba(30,22,18,0.12)',
                transition: 'background .25s',
              }}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ───────────────────────── Plans ─────────────────────────
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'Experimente a plataforma sem compromisso',
    price: 0, unit: '',
    trial: 'Grátis para sempre',
    features: ['50 CTOs cadastradas', '1 técnico de campo', 'Mapa interativo básico', 'Suporte por comunidade', 'Marca FiberOps nas telas'],
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitle: 'Para ISPs em expansão com múltiplas cidades',
    price: 549, unit: '/mês',
    trial: '30 dias grátis',
    popular: true,
    features: ['3.000 CTOs cadastradas', '40 técnicos de campo', 'Roteirização inteligente de campo', 'BI + dashboards customizados', 'Integração com ERP e CRM', 'Multi-unidade (filiais)', 'Suporte prioritário 8h úteis', 'Onboarding guiado'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    subtitle: 'Para grandes operadoras e ISPs com múltiplas regiões',
    price: 999, unit: '/mês',
    trial: '30 dias grátis',
    features: ['CTOs ilimitadas', 'Técnicos ilimitados', 'API dedicada + webhooks', 'SLA 99,9% contratual', 'Gerente de sucesso dedicado', 'Customizações sob demanda', 'Relatórios Anatel automáticos', 'Suporte 24/7 com engenheiro'],
  },
]

const INCLUDED = [
  {
    t: 'Mapa offline para uso em campo',
    icon: (c) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4.5L7 3l4 1.5 5-1.5v10l-5 1.5-4-1.5-5 1.5v-10z" stroke={c} strokeWidth="1.3"/><path d="M7 3v12M11 4.5v12" stroke={c} strokeWidth="1.3"/></svg>
  },
  {
    t: 'Gestão completa de CTOs e fibras',
    icon: (c) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1v6M9 17v-4M3 5l4 3M15 13l-4-3M3 13l4-3M15 5l-4 3" stroke={c} strokeWidth="1.3" strokeLinecap="round"/><circle cx="9" cy="9" r="2" fill={c}/></svg>
  },
  {
    t: 'Controle de equipe por função',
    icon: (c) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="6" cy="6" r="2.2" stroke={c} strokeWidth="1.3"/><circle cx="12" cy="7" r="1.8" stroke={c} strokeWidth="1.3"/><path d="M1.5 15c0-2.2 2-3.5 4.5-3.5s4.5 1.3 4.5 3.5M11 15c0-1.4.8-2.5 2.5-2.5s2.5 1 2.5 2.5" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>
  },
  {
    t: 'Histórico e relatórios de rede',
    icon: (c) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 15V7M6 15V4M10 15V9M14 15V2" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></svg>
  },
  {
    t: 'Atualizações contínuas sem custo',
    icon: (c) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9a6 6 0 0 1 10.5-4M15 9a6 6 0 0 1-10.5 4" stroke={c} strokeWidth="1.3" strokeLinecap="round"/><path d="M13.5 1.5v3.5h-3.5M4.5 16.5V13h3.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  },
  {
    t: 'Conformidade LGPD + ISO 27001',
    icon: (c) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1.5 2.5 4v5c0 3.5 2.7 6.5 6.5 7.5 3.8-1 6.5-4 6.5-7.5V4L9 1.5Z" stroke={c} strokeWidth="1.3"/><path d="M6 9l2 2 4-4" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  },
]

function PlanCard({ plan, selected, onSelect }) {
  return (
    <button type="button" onClick={() => onSelect(plan.id)}
      style={{
        textAlign: 'left', cursor: 'pointer', width: '100%',
        border: `1.5px solid ${selected ? FO.orange : 'rgba(30,22,18,0.12)'}`,
        background: selected
          ? `linear-gradient(135deg, ${FO.espresso} 0%, ${FO.espressoUp} 100%)`
          : '#fff',
        color: selected ? FO.cream : FO.espresso,
        borderRadius: 12, padding: '18px 20px',
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 16,
        transition: 'all .18s',
        boxShadow: selected ? `0 10px 28px rgba(26,18,13,0.25)` : '0 1px 0 rgba(0,0,0,0.02)',
        position: 'relative',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}>
      {plan.popular && (
        <span style={{
          position: 'absolute', top: -10, left: 20,
          padding: '3px 10px', borderRadius: 999,
          background: FO.orange, color: FO.cream,
          fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
          fontFamily: '"JetBrains Mono", monospace',
          boxShadow: '0 4px 10px rgba(196,90,44,0.3)',
        }}>Mais popular</span>
      )}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            fontFamily: '"Instrument Serif", serif', fontSize: 26,
            color: selected ? FO.cream : FO.espresso, letterSpacing: '-0.01em',
          }}>{plan.name}</div>
          <span style={{
            fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 4,
            background: selected ? 'rgba(244,167,113,0.15)' : 'rgba(63,138,84,0.1)',
            color: selected ? FO.orangeGlow : FO.success,
            fontFamily: '"JetBrains Mono", monospace',
          }}>{plan.trial}</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: selected ? FO.muted : 'rgba(30,22,18,0.6)' }}>{plan.subtitle}</div>
        <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 6, gridTemplateColumns: '1fr 1fr' }}>
          {(selected ? plan.features : plan.features.slice(0, 4)).map((f, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, color: selected ? 'rgba(237,227,210,0.88)' : 'rgba(30,22,18,0.75)',
              animation: selected && i >= 4 ? 'fo-fade .3s ease' : 'none',
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2 6.2 L5 9 L10 3.8" stroke={selected ? FO.orangeGlow : FO.orange} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>{f}
            </li>
          ))}
          {!selected && plan.features.length > 4 && (
            <li style={{ fontSize: 12, color: FO.orange, gridColumn: 'span 2', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke={FO.orange} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Ver +{plan.features.length - 4} recursos
            </li>
          )}
          {selected && (
            <li style={{ gridColumn: 'span 2', marginTop: 10, paddingTop: 10, borderTop: `1px solid rgba(237,227,210,0.12)`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: FO.orangeGlow, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke={FO.orangeGlow} strokeWidth="1.2"/><path d="M6 3.5v3M6 8.2v.1" stroke={FO.orangeGlow} strokeWidth="1.4" strokeLinecap="round"/></svg>
              Plano selecionado
            </li>
          )}
        </ul>
      </div>
      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 11, color: selected ? FO.muted : 'rgba(30,22,18,0.55)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
          {plan.price === null ? 'investimento' : plan.price === 0 ? 'custo' : 'a partir de'}
        </div>
        {plan.price === null ? (
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, lineHeight: 1.1, letterSpacing: '-0.01em', fontStyle: 'italic', color: selected ? FO.orangeGlow : FO.orange, marginTop: 6 }}>
            Sob<br/>consulta
          </div>
        ) : plan.price === 0 ? (
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', color: selected ? FO.cream : FO.espresso, marginTop: 4 }}>Grátis</div>
        ) : (
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em', color: selected ? FO.cream : FO.espresso, marginTop: 4 }}>
            <span style={{ fontSize: 16, verticalAlign: 'top', marginRight: 2 }}>R$</span>{plan.price}
          </div>
        )}
        <div style={{ fontSize: 12, color: selected ? FO.muted : 'rgba(30,22,18,0.5)', marginTop: 2 }}>{plan.unit}</div>
      </div>
    </button>
  )
}

// ───────────────────────── Form primitives ─────────────────────────
function FieldLabel({ label, required, hint, error, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: error ? '#dc2626' : 'rgba(30,22,18,0.55)', marginBottom: 8,
        fontFamily: '"JetBrains Mono", monospace', fontWeight: 500,
        transition: 'color .15s',
      }}>
        {label}{required && <span style={{ color: error ? '#dc2626' : FO.orange }}> *</span>}
      </div>
      {children}
      {error
        ? <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="#dc2626" strokeWidth="1.2"/><path d="M5.5 3.2v2.6M5.5 7.6v.1" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round"/></svg>
            {error}
          </div>
        : hint && <div style={{ fontSize: 11.5, color: 'rgba(30,22,18,0.5)', marginTop: 6 }}>{hint}</div>
      }
    </div>
  )
}

function FInput({ placeholder, value, onChange, type = 'text', autoFocus, right, hasError, onFocus: onFocusProp, onBlur: onBlurProp }) {
  const [focus, setFocus] = useState(false)
  const borderColor = hasError && !focus ? '#dc2626' : focus ? FO.orange : FO.line
  const shadow      = focus ? `0 0 0 3px ${hasError ? '#dc262620' : FO.orange + '20'}` : hasError ? '0 0 0 2px #dc262618' : 'none'
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: 44, borderRadius: 6,
      border: `1px solid ${borderColor}`,
      background: hasError && !focus ? '#fff8f8' : '#fff',
      boxShadow: shadow,
      transition: 'all .15s', overflow: 'hidden',
    }}>
      <input
        type={type} placeholder={placeholder} value={value || ''}
        onFocus={() => { setFocus(true); onFocusProp?.() }}
        onBlur={() => { setFocus(false); onBlurProp?.() }}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          padding: '0 14px', fontSize: 14, color: FO.espresso,
          fontFamily: 'inherit', height: '100%', boxSizing: 'border-box',
        }}
      />
      {right && <div style={{ paddingRight: 10, flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

function FSelect({ value, onChange, options, hasError }) {
  return (
    <select
      value={value || ''} onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', height: 44, padding: '0 14px',
        borderRadius: 6, border: `1px solid ${hasError ? '#dc2626' : FO.line}`,
        background: hasError ? '#fff8f8' : '#fff',
        fontSize: 14, color: FO.espresso,
        fontFamily: 'inherit', outline: 'none', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'><path d='M1 1l5 5 5-5' stroke='%231A120D' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
        paddingRight: 36, boxSizing: 'border-box',
        transition: 'border-color .15s, background .15s',
      }}>
      <option value="" disabled>Selecione…</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ───────────────────────── Step 1 — Plan ─────────────────────────
function Step1Plan({ data, setData }) {
  return (
    <>
      <div style={{ display: 'grid', gap: 14 }}>
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} selected={data.plan === p.id} onSelect={(id) => setData({ ...data, plan: id })}/>
        ))}
      </div>

      <div style={{
        marginTop: 22, padding: '18px 20px', borderRadius: 10,
        border: `1px solid ${FO.line}`, background: FO.cream,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase',
          color: 'rgba(30,22,18,0.55)', marginBottom: 12,
          fontFamily: '"JetBrains Mono", monospace', fontWeight: 500,
        }}>Incluso em todos os planos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }} className="fo-included">
          {INCLUDED.map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(30,22,18,0.78)' }}>
              <div style={{
                width: 30, height: 30, borderRadius: 7,
                background: '#fff', border: `1px solid ${FO.line}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{x.icon(FO.orange)}</div>
              {x.t}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ───────────────────────── Step 2 — Company ─────────────────────────
function Step2Company({ data, setData, errors = {}, requireCnpj = false }) {
  const sizes  = ['1–500 clientes', '500–2.000', '2.000–10.000', '10.000–50.000', '50.000+']
  const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

  function formatCNPJ(v) {
    const d = v.replace(/\D/g, '').slice(0, 14)
    if (d.length <= 2)  return d
    if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="fo-two-col">
        <FieldLabel label="Razão social" required error={errors.empresa}>
          <FInput autoFocus placeholder="Ex.: Conecta Fibra LTDA" value={data.empresa} hasError={!!errors.empresa}
            onChange={(v) => setData({ ...data, empresa: v })}/>
        </FieldLabel>
        <FieldLabel label="CNPJ" required={requireCnpj} error={errors.cnpj}
          hint={!errors.cnpj && !requireCnpj ? 'Necessário para pagamento via PIX' : undefined}>
          <FInput placeholder="00.000.000/0000-00" value={data.cnpj ?? ''} hasError={!!errors.cnpj}
            onChange={(v) => setData({ ...data, cnpj: formatCNPJ(v) })}/>
        </FieldLabel>
        <FieldLabel label="Base de clientes" required error={errors.size}>
          <FSelect value={data.size} hasError={!!errors.size} onChange={(v) => setData({ ...data, size: v })} options={sizes}/>
        </FieldLabel>
        <FieldLabel label="Fabricante de OLT" required error={errors.vendor}>
          <FSelect value={data.vendor} hasError={!!errors.vendor} onChange={(v) => setData({ ...data, vendor: v })} options={['Huawei','ZTE','Datacom','Parks','Furukawa','Multi-fabricante','Outro']}/>
        </FieldLabel>
        <FieldLabel label="Estado" required error={errors.state}>
          <FSelect value={data.state} hasError={!!errors.state} onChange={(v) => setData({ ...data, state: v })} options={states}/>
        </FieldLabel>
        <FieldLabel label="Cidade" required error={errors.city}>
          <FInput placeholder="Ex.: Goiânia" value={data.city} hasError={!!errors.city}
            onChange={(v) => setData({ ...data, city: v })}/>
        </FieldLabel>
      </div>
      <FieldLabel label="Website ou rede social">
        <FInput placeholder="https://" value={data.site} onChange={(v) => setData({ ...data, site: v })}/>
      </FieldLabel>
    </>
  )
}

// ───────────────────────── Step 3 — Contact + Credentials ─────────────────────────
function Step3Contact({ data, setData, loginDisponivel, setLoginDisponivel, verificandoLogin, setVerificandoLogin, errors = {} }) {
  async function verificarLogin(valor) {
    if (!valor || valor.length < 3) { setLoginDisponivel(null); return }
    setVerificandoLogin(true)
    try {
      const res = await checkLoginDisponivel(valor)
      setLoginDisponivel(res.disponivel)
    } catch {
      setLoginDisponivel(null)
    } finally {
      setVerificandoLogin(false)
    }
  }

  function forcaSenha(s) {
    if (!s) return 0
    let score = 0
    if (s.length >= 6)  score++
    if (s.length >= 10) score++
    if (/[A-Z]/.test(s)) score++
    if (/[0-9]/.test(s))  score++
    if (/[^A-Za-z0-9]/.test(s)) score++
    return score
  }
  const forca      = forcaSenha(data.password || '')
  const forcaLabel = ['', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Muito forte'][forca] ?? ''
  const forcaCor   = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'][forca] ?? ''

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="fo-two-col">
        <FieldLabel label="Nome completo" required error={errors.nome}>
          <FInput placeholder="Seu nome" value={data.nome} hasError={!!errors.nome}
            onChange={(v) => setData({ ...data, nome: v })}/>
        </FieldLabel>
        <FieldLabel label="Cargo" required error={errors.cargo}>
          <FSelect value={data.cargo} hasError={!!errors.cargo}
            onChange={(v) => setData({ ...data, cargo: v })}
            options={['Diretor / Sócio','Gerente de NOC','Gerente de operações','TI / Infra','Financeiro','Outro']}/>
        </FieldLabel>
        <FieldLabel label="E-mail corporativo" required error={errors.email}>
          <FInput type="email" placeholder="nome@empresa.com.br" value={data.email} hasError={!!errors.email}
            onChange={(v) => setData({ ...data, email: v })}/>
        </FieldLabel>
        <FieldLabel label="WhatsApp" required error={errors.phone}>
          <FInput placeholder="(00) 00000-0000" value={data.phone} hasError={!!errors.phone}
            onChange={(v) => setData({ ...data, phone: v })}/>
        </FieldLabel>
      </div>

      <FieldLabel label="Melhor horário para contato">
        <FSelect value={data.when} onChange={(v) => setData({ ...data, when: v })}
          options={['Manhã (8h–12h)', 'Tarde (12h–18h)', 'Noite (18h–21h)', 'Qualquer horário']}/>
      </FieldLabel>

      {/* Separator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, margin: '8px 0 16px',
        color: 'rgba(30,22,18,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3em',
        fontFamily: '"JetBrains Mono", monospace',
      }}>
        <div style={{ flex: 1, height: 1, background: FO.line }}/>
        Credenciais de acesso
        <div style={{ flex: 1, height: 1, background: FO.line }}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="fo-two-col">
        <FieldLabel label="Usuário" required error={errors.username}
          hint={!errors.username ? 'Letras minúsculas, números e _ . -' : undefined}>
          <FInput
            placeholder="ex: joao.silva"
            value={data.username}
            hasError={!!errors.username || loginDisponivel === false}
            onChange={(v) => { setData({ ...data, username: v }); setLoginDisponivel(null) }}
            right={
              <div style={{ fontSize: 14, paddingRight: 4 }}>
                {verificandoLogin && <span style={{ color: 'rgba(30,22,18,0.4)', fontSize: 12 }}>…</span>}
                {!verificandoLogin && loginDisponivel === true  && <span style={{ color: FO.success }}>✓</span>}
                {!verificandoLogin && loginDisponivel === false && <span style={{ color: '#ef4444' }}>✗</span>}
              </div>
            }
          />
          {!errors.username && loginDisponivel === false && <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="#ef4444" strokeWidth="1.2"/><path d="M5.5 3.2v2.6M5.5 7.6v.1" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round"/></svg>
            Usuário já em uso.
          </div>}
          {loginDisponivel === true && <div style={{ fontSize: 11.5, color: FO.success, marginTop: 5 }}>Disponível!</div>}
        </FieldLabel>

        <FieldLabel label="Senha" required error={errors.password}>
          <FInput
            type={data.showPass ? 'text' : 'password'}
            placeholder="mínimo 6 caracteres"
            value={data.password}
            hasError={!!errors.password}
            onChange={(v) => setData({ ...data, password: v })}
            right={
              <button type="button"
                onClick={() => setData({ ...data, showPass: !data.showPass })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(30,22,18,0.5)', padding: '0 4px' }}>
                {data.showPass ? 'Ocultar' : 'Mostrar'}
              </button>
            }
          />
          {!errors.password && (data.password || '').length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {[1,2,3,4,5].map((n) => (
                  <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= forca ? forcaCor : 'rgba(30,22,18,0.1)', transition: 'background .2s' }}/>
                ))}
              </div>
              <div style={{ fontSize: 11, marginTop: 4, color: forcaCor }}>{forcaLabel}</div>
            </div>
          )}
        </FieldLabel>
      </div>

      <FieldLabel label="Confirmar senha" required error={errors.senhaConfirm}>
        <FInput
          type="password"
          placeholder="repita a senha"
          value={data.senhaConfirm}
          hasError={!!errors.senhaConfirm || (!errors.senhaConfirm && !!data.senhaConfirm && data.password !== data.senhaConfirm)}
          onChange={(v) => setData({ ...data, senhaConfirm: v })}
        />
        {!errors.senhaConfirm && data.senhaConfirm && data.password !== data.senhaConfirm && (
          <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="#ef4444" strokeWidth="1.2"/><path d="M5.5 3.2v2.6M5.5 7.6v.1" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round"/></svg>
            As senhas não coincidem.
          </div>
        )}
      </FieldLabel>

      <FieldLabel label="Mensagem (opcional)" hint="Conte o que mais importa: migração, multi-unidade, API, etc.">
        <textarea
          value={data.note || ''} onChange={(e) => setData({ ...data, note: e.target.value })}
          rows={3} placeholder="Opcional"
          style={{
            width: '100%', padding: '12px 14px',
            borderRadius: 6, border: `1px solid ${FO.line}`,
            background: '#fff', fontSize: 14, color: FO.espresso,
            fontFamily: 'inherit', outline: 'none', resize: 'vertical',
            boxSizing: 'border-box',
          }}/>
      </FieldLabel>

      <label style={{
        display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8, cursor: 'pointer',
        fontSize: 13, color: errors.consent ? '#dc2626' : 'rgba(30,22,18,0.75)',
        padding: errors.consent ? '10px 12px' : '0',
        borderRadius: errors.consent ? 6 : 0,
        background: errors.consent ? 'rgba(220,38,38,0.04)' : 'transparent',
        border: errors.consent ? '1px solid #dc262630' : 'none',
        transition: 'all .15s',
      }}>
        <input
          type="checkbox"
          checked={!!data.consent}
          onChange={(e) => setData({ ...data, consent: e.target.checked })}
          style={{ marginTop: 3, accentColor: FO.orange, width: 15, height: 15 }}/>
        <span>Autorizo o contato da FiberOps por e-mail/WhatsApp conforme LGPD. Uso apenas operacional, sem compartilhamento com terceiros.</span>
      </label>
      {errors.consent && (
        <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="#dc2626" strokeWidth="1.2"/><path d="M5.5 3.2v2.6M5.5 7.6v.1" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round"/></svg>
          {errors.consent}
        </div>
      )}
    </>
  )
}

// ───────────────────────── Step 4 — Review ─────────────────────────
function Step4Review({ data, erro }) {
  const plan = PLANS.find((p) => p.id === data.plan) || PLANS[2]
  return (
    <>
      <div style={{
        padding: '20px 22px', borderRadius: 12,
        background: `linear-gradient(135deg, ${FO.espresso} 0%, ${FO.espressoUp} 100%)`,
        color: FO.cream, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: FO.orangeGlow, fontFamily: '"JetBrains Mono", monospace' }}>Plano selecionado</div>
            <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 32, marginTop: 6, letterSpacing: '-0.01em' }}>
              {plan.name} <span style={{ fontStyle: 'italic', color: FO.orangeGlow, fontSize: 20 }}>· {plan.trial}</span>
            </div>
            <div style={{ fontSize: 13, color: FO.muted, marginTop: 4 }}>{plan.subtitle}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {plan.price === null ? (
              <>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 28, lineHeight: 1, fontStyle: 'italic', color: FO.orangeGlow }}>Sob consulta</div>
                <div style={{ fontSize: 12, color: FO.muted, marginTop: 6 }}>Orçamento personalizado</div>
              </>
            ) : plan.price === 0 ? (
              <>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 36, lineHeight: 1 }}>Grátis</div>
                <div style={{ fontSize: 12, color: FO.muted, marginTop: 4 }}>Para sempre</div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 36, lineHeight: 1 }}>
                  <span style={{ fontSize: 16 }}>R$</span>{plan.price}
                </div>
                <div style={{ fontSize: 12, color: FO.muted }}>{plan.unit} · após o teste</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="fo-two-col">
        <SummaryBlock title="Empresa" items={[
          ['Razão social', data.empresa],
          ['CNPJ', data.cnpj],
          ['Localização', [data.city, data.state].filter(Boolean).join(' · ')],
          ['Base', data.size],
          ['OLT', data.vendor],
        ]}/>
        <SummaryBlock title="Acesso" items={[
          ['Nome', data.nome],
          ['Cargo', data.cargo],
          ['E-mail', data.email],
          ['WhatsApp', data.phone],
          ['Usuário', data.username],
        ]}/>
      </div>

      {data.note && (
        <div style={{
          marginTop: 14, padding: '14px 18px', borderRadius: 10,
          background: FO.cream, border: `1px solid ${FO.line}`,
          fontSize: 13.5, color: 'rgba(30,22,18,0.8)', lineHeight: 1.5,
          fontStyle: 'italic', fontFamily: '"Instrument Serif", serif',
        }}>"{data.note}"</div>
      )}

      {erro && (
        <div style={{
          marginTop: 14, padding: '12px 16px', borderRadius: 8,
          background: 'rgba(196,90,44,0.08)', border: `1px solid ${FO.orange}40`,
          fontSize: 13, color: FO.orangeDeep, lineHeight: 1.4,
        }}>{erro}</div>
      )}

      <div style={{
        marginTop: 18, display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 12.5, color: 'rgba(30,22,18,0.65)',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5 2 4v4.5c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V4L8 1.5Z" stroke={FO.orange} strokeWidth="1.4"/></svg>
        Acesso instantâneo: ao enviar, sua conta é criada e você entra <b style={{ color: FO.espresso, fontWeight: 600 }}>direto no painel FiberOps</b>, sem espera.
      </div>
    </>
  )
}

function SummaryBlock({ title, items }) {
  return (
    <div style={{ padding: '14px 18px', borderRadius: 10, border: `1px solid ${FO.line}`, background: '#fff' }}>
      <div style={{
        fontSize: 10.5, letterSpacing: '0.28em', textTransform: 'uppercase',
        color: 'rgba(30,22,18,0.5)', fontFamily: '"JetBrains Mono", monospace',
        fontWeight: 500, marginBottom: 10,
      }}>{title}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map(([k, v], i) => v ? (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
            <span style={{ color: 'rgba(30,22,18,0.55)' }}>{k}</span>
            <span style={{ color: FO.espresso, fontWeight: 500, textAlign: 'right', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
          </div>
        ) : null)}
      </div>
    </div>
  )
}

// ───────────────────────── Step 5 — Payment ─────────────────────────
function Step5Payment({ data, onPaid }) {
  const plan = PLANS.find((p) => p.id === data.plan) || PLANS[2]

  const [loading,  setLoading]  = useState(null)  // 'PIX' | 'CREDIT_CARD' | null
  const [error,    setError]    = useState(null)
  const [waiting,  setWaiting]  = useState(false)  // true after redirect — polling active

  const pollRef = useRef(null)

  useEffect(() => () => clearInterval(pollRef.current), [])

  function startPolling() {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/checkout/status?email=${encodeURIComponent(data.email)}`)
        const json = await res.json()
        if (json.confirmed) {
          clearInterval(pollRef.current)
          onPaid(json.payment_method)
        }
      } catch {}
    }, 4000)
  }

  async function pay(billing_type) {
    setLoading(billing_type)
    setError(null)
    try {
      const res  = await fetch('/api/checkout/create-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: data.email, billing_type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar cobrança')

      const url = json.invoice_url || json.credit_card_url || json.pix_url
      if (!url) throw new Error('Link de pagamento não retornado pelo Asaas.')

      window.open(url, '_blank', 'noopener')
      setWaiting(true)
      startPolling()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  const OPTIONS = [
    {
      id:    'PIX',
      title: 'PIX',
      desc:  'Aprovação instantânea · Qualquer banco',
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M8 8l8 8-8 8M24 8l-8 8 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      id:    'CREDIT_CARD',
      title: 'Cartão de crédito',
      desc:  'Visa, Mastercard, Elo e outros',
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="2" y="7" width="28" height="18" rx="3" stroke="currentColor" strokeWidth="2"/>
          <path d="M2 13h28" stroke="currentColor" strokeWidth="2"/>
          <rect x="6" y="18" width="8" height="3" rx="1" fill="currentColor"/>
        </svg>
      ),
    },
  ]

  return (
    <div>
      {/* Plan summary */}
      <div style={{
        padding: '18px 22px', borderRadius: 12, marginBottom: 28,
        background: `linear-gradient(135deg, ${FO.espresso} 0%, ${FO.espressoUp} 100%)`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: FO.orangeGlow, fontFamily: '"JetBrains Mono", monospace' }}>Plano selecionado</div>
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 26, color: FO.cream, marginTop: 4, letterSpacing: '-0.01em' }}>
            {plan.name} <span style={{ fontStyle: 'italic', color: FO.orangeGlow, fontSize: 16 }}>· {plan.trial}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 34, color: FO.cream, lineHeight: 1 }}>
            <span style={{ fontSize: 15, verticalAlign: 'top', marginRight: 2 }}>R$</span>{plan.price}
          </div>
          <div style={{ fontSize: 12, color: FO.muted, marginTop: 2 }}>{plan.unit} · após o teste</div>
        </div>
      </div>

      {/* Payment options */}
      {!waiting ? (
        <>
          <div style={{ fontSize: 13, color: 'rgba(30,22,18,0.6)', marginBottom: 16, textAlign: 'center' }}>
            Escolha como deseja pagar — você será redirecionado para a página segura do Asaas.
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {OPTIONS.map(({ id, title, desc, icon }) => {
              const isLoading = loading === id
              return (
                <button key={id} type="button" onClick={() => pay(id)} disabled={!!loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 18,
                    padding: '20px 22px', borderRadius: 12, border: `1.5px solid ${FO.line}`,
                    background: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading && !isLoading ? 0.5 : 1,
                    textAlign: 'left', fontFamily: 'inherit',
                    transition: 'all .18s',
                    boxShadow: '0 1px 3px rgba(26,18,13,0.04)',
                  }}
                  onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = FO.orange; e.currentTarget.style.boxShadow = `0 0 0 3px ${FO.orange}18, 0 4px 14px rgba(26,18,13,0.08)` }}}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = FO.line; e.currentTarget.style.boxShadow = '0 1px 3px rgba(26,18,13,0.04)' }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                    background: FO.cream, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: FO.espresso,
                  }}>
                    {isLoading
                      ? <span style={{ width: 22, height: 22, borderRadius: 11, border: `2.5px solid ${FO.beige}`, borderTopColor: FO.orange, display: 'inline-block', animation: 'fo-spin .7s linear infinite' }}/>
                      : icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: FO.espresso }}>{title}</div>
                    <div style={{ fontSize: 13, color: 'rgba(30,22,18,0.55)', marginTop: 2 }}>{desc}</div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: 'rgba(30,22,18,0.3)', flexShrink: 0 }}>
                    <path d="M6 4l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )
            })}
          </div>

          {error && (
            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: 8,
              background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)',
              fontSize: 13, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7.5" cy="7.5" r="6" stroke="#dc2626" strokeWidth="1.3"/>
                <path d="M7.5 4.5v3.5M7.5 10v.1" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <div style={{
            marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
            fontSize: 11.5, color: 'rgba(30,22,18,0.45)',
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5 1.5 3.5v4c0 2.5 2 4.5 5 5 3-0.5 5-2.5 5-5v-4L6.5 1.5Z" stroke="currentColor" strokeWidth="1.2"/></svg>
            Pagamento processado com segurança pelo Asaas
          </div>
        </>
      ) : (
        /* Waiting state — user went to Asaas, polling for confirmation */
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28, margin: '0 auto 20px',
            background: FO.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ width: 28, height: 28, borderRadius: 14, border: `3px solid ${FO.beige}`, borderTopColor: FO.orange, display: 'inline-block', animation: 'fo-spin .9s linear infinite' }}/>
          </div>
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 22, color: FO.espresso }}>
            Aguardando confirmação…
          </div>
          <div style={{ marginTop: 8, fontSize: 13.5, color: 'rgba(30,22,18,0.6)', lineHeight: 1.6 }}>
            Complete o pagamento na aba do Asaas.<br/>
            Esta página confirma automaticamente assim que for aprovado.
          </div>
          <button type="button" onClick={() => { setWaiting(false); clearInterval(pollRef.current) }}
            style={{
              marginTop: 24, padding: '10px 20px', borderRadius: 6,
              background: 'transparent', border: `1px solid ${FO.line}`,
              color: 'rgba(30,22,18,0.6)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            ← Escolher outro método
          </button>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Success screen ─────────────────────────
function SuccessScreen({ data, autoLogged }) {
  const plan = PLANS.find((p) => p.id === data.plan) || PLANS[2]
  const router = useRouter()
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const tick = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    const go   = setTimeout(() => router.push(autoLogged ? '/' : '/login'), 3000)
    return () => { clearInterval(tick); clearTimeout(go) }
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        maxWidth: 540, width: '100%', textAlign: 'center',
        padding: '44px 36px', borderRadius: 14,
        background: '#fff', border: `1px solid ${FO.line}`,
        boxShadow: '0 10px 40px rgba(26,18,13,0.08)',
      }}>
        {/* Icon with pulse ring */}
        <div style={{
          width: 72, height: 72, borderRadius: 36, margin: '0 auto 18px',
          background: `linear-gradient(135deg, ${FO.orangeSoft}, ${FO.orange})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 22px rgba(196,90,44,0.3)',
          position: 'relative',
        }}>
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <path d="M6 16.5 13 23.5 26 9" stroke={FO.cream} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{
            position: 'absolute', inset: -6, borderRadius: 40,
            border: `2px solid ${FO.orange}`, opacity: 0.35,
            animation: 'fo-pulse 1.4s ease-out infinite',
          }}/>
        </div>

        <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 38, color: FO.espresso, letterSpacing: '-0.02em' }}>
          Conta <span style={{ fontStyle: 'italic', color: FO.orange }}>criada.</span>
        </div>

        <p style={{ marginTop: 10, color: 'rgba(30,22,18,0.7)', fontSize: 14.5, lineHeight: 1.6 }}>
          {autoLogged ? (
            <>Seu ambiente <b style={{ color: FO.espresso }}>{plan.name}</b> foi provisionado agora.<br/>
            Redirecionando para o painel em <b style={{ color: FO.orange }}>{countdown}s</b>…</>
          ) : (
            <>Conta criada! Redirecionando para o login em <b style={{ color: FO.orange }}>{countdown}s</b>…<br/>
            Nossa equipe ativa seu <b style={{ color: FO.espresso }}>{plan.trial}</b> em breve.</>
          )}
        </p>

        {/* Progress bar */}
        <div style={{ marginTop: 20, height: 4, background: FO.beige, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: '100%',
            background: `linear-gradient(90deg, ${FO.orangeSoft}, ${FO.orange})`,
            animation: 'fo-progress 3s linear forwards',
            transformOrigin: 'left',
          }}/>
        </div>

        <div style={{
          marginTop: 20, fontSize: 12, color: 'rgba(30,22,18,0.55)',
          fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em',
        }}>
          SESSÃO ATIVA · {data.email || data.username || 'usuário'}
        </div>

        <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href={autoLogged ? '/' : '/login'} style={{
            padding: '12px 22px', borderRadius: 6,
            background: `linear-gradient(180deg, ${FO.orangeSoft} 0%, ${FO.orange} 45%, ${FO.orangeDeep} 100%)`,
            color: FO.cream, fontSize: 14, fontWeight: 500, textDecoration: 'none',
            boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 18px rgba(196,90,44,0.3)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            {autoLogged ? 'Entrar agora' : 'Ir para o login'}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7 3l4 4-4 4" stroke={FO.cream} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Validation ─────────────────────────
function validateStep(step, data, { requireCnpj = false } = {}) {
  const errs = {}
  if (step === 1) {
    if (!data.empresa?.trim())  errs.empresa = 'Razão social é obrigatória'
    if (!data.size)             errs.size    = 'Selecione a base de clientes'
    if (!data.vendor)           errs.vendor  = 'Selecione o fabricante de OLT'
    if (!data.state)            errs.state   = 'Selecione o estado'
    if (!data.city?.trim())     errs.city    = 'Informe a cidade'

    if (requireCnpj) {
      const digits = (data.cnpj ?? '').replace(/\D/g, '')
      if (!digits)        errs.cnpj = 'CNPJ é obrigatório para planos pagos'
      else if (digits.length !== 14) errs.cnpj = 'CNPJ incompleto — 14 dígitos'
    }
  }
  if (step === 2) {
    if (!data.nome?.trim())    errs.nome  = 'Nome completo é obrigatório'
    if (!data.cargo)           errs.cargo = 'Selecione seu cargo'
    if (!data.email?.trim())   errs.email = 'E-mail é obrigatório'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = 'E-mail inválido'
    if (!data.phone?.trim())   errs.phone = 'WhatsApp é obrigatório'

    const u = data.username?.toLowerCase().trim() || ''
    if (!u)                                        errs.username = 'Usuário é obrigatório'
    else if (u.length < 3)                         errs.username = 'Mínimo 3 caracteres'
    else if (!/^[a-z0-9_.-]+$/.test(u))            errs.username = 'Use letras minúsculas, números e _ . -'

    if (!data.password)                            errs.password = 'Senha é obrigatória'
    else if (data.password.length < 6)             errs.password = 'Mínimo 6 caracteres'

    if (!data.senhaConfirm)                        errs.senhaConfirm = 'Confirme sua senha'
    else if (data.password !== data.senhaConfirm)  errs.senhaConfirm = 'As senhas não coincidem'

    if (!data.consent) errs.consent = 'Autorização LGPD é necessária para continuar'
  }
  return errs
}

// ───────────────────────── Page ─────────────────────────
export default function CadastroPage() {
  const router = useRouter()

  const [step,        setStep]        = useState(0)
  const [submitted,   setSubmitted]   = useState(false)
  const [autoLogged,  setAutoLogged]  = useState(false)
  const [enviando,    setEnviando]    = useState(false)
  const [erro,        setErro]        = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const wizardRef = useRef(null)

  const [data, setData] = useState({ plan: 'pro' })

  const [loginDisponivel,  setLoginDisponivel]  = useState(null)
  const [verificandoLogin, setVerificandoLogin] = useState(false)

  // Clear field errors when user edits any field
  function updateData(next) {
    setData(next)
    if (Object.keys(fieldErrors).length > 0) setFieldErrors({})
  }

  const plan       = PLANS.find((p) => p.id === data.plan) || PLANS[2]
  const hasPayment = plan.price > 0
  const labels     = hasPayment
    ? ['Plano', 'Empresa', 'Contato', 'Confirmar', 'Pagamento']
    : ['Plano', 'Empresa', 'Contato', 'Confirmar']
  const LAST_STEP  = labels.length - 1

  const isPaymentStep     = hasPayment && step === LAST_STEP
  const isLastActionStep  = hasPayment ? step === LAST_STEP - 1 : step === LAST_STEP

  const ctaLabel = step === 0
    ? `Continuar com plano ${plan.name}`
    : isLastActionStep && hasPayment
      ? (enviando ? 'Iniciando…' : 'Ir para pagamento →')
    : isLastActionStep && !hasPayment
      ? (enviando ? 'Criando conta…' : 'Criar conta e acessar')
    : 'Continuar'

  async function handleNext() {
    if (isPaymentStep) return

    // Validate current step before advancing
    const errs = validateStep(step, data, { requireCnpj: hasPayment })
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setFieldErrors({})

    if (!isLastActionStep) {
      setErro(null)
      setStep((s) => s + 1)
      return
    }

    setErro(null)
    setEnviando(true)
    try {
      if (hasPayment) {
        // Init checkout record before showing payment step
        await iniciarCheckoutPagamento({
          email:    data.email,
          empresa:  data.empresa,
          cnpj:     data.cnpj,
          plano:    data.plan,
          username: data.username,
          password: data.password,
        })
        setStep((s) => s + 1)
      } else {
        // Free / Carrier: create account directly
        await criarRegistro({
          username:      data.username,
          password:      data.password,
          empresa:       data.empresa,
          plano:         data.plan,
          nome_completo: data.nome || data.empresa,
          email:         data.email,
          telefone:      data.phone,
        })
        const result = await signIn('credentials', {
          username: data.username,
          password: data.password,
          redirect: false,
          callbackUrl: '/',
        })
        setAutoLogged(!!result?.ok)
        setSubmitted(true)
      }
    } catch (e) {
      setErro(e.message || 'Erro ao processar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  async function handlePaid() {
    // Payment confirmed — account was already created server-side; just sign in
    try {
      const result = await signIn('credentials', {
        username: data.username,
        password: data.password,
        redirect: false,
        callbackUrl: '/',
      })
      setAutoLogged(!!result?.ok)
    } catch {
      setAutoLogged(false)
    }
    setSubmitted(true)
  }

  return (
    <div style={{
      width: '100vw', minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap');
        @keyframes fo-fade     { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fo-spin     { to { transform: rotate(360deg); } }
        @keyframes fo-pulse    { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes fo-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes fo-shake    { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        input::placeholder, textarea::placeholder { color: rgba(30,22,18,0.35); }
        ::selection { background: ${FO.orange}; color: ${FO.cream}; }
        @media (max-width: 640px) {
          .fo-two-col   { grid-template-columns: 1fr !important; }
          .fo-included  { grid-template-columns: 1fr !important; }
          .fo-step-label { display: none; }
          .fo-wizard-card { padding: 22px 20px !important; }
          .fo-titlebar-text { display: none; }
        }
      `}</style>

      <TitleBar/>

      {submitted ? (
        <div style={{ flex: 1, background: `linear-gradient(180deg, ${FO.cream} 0%, ${FO.beige} 100%)`, display: 'flex', flexDirection: 'column' }}>
          <SuccessScreen data={data} autoLogged={autoLogged}/>
        </div>
      ) : (
        <div style={{
          flex: 1, overflow: 'auto',
          background: `radial-gradient(130% 80% at 50% 0%, ${FO.cream} 0%, ${FO.beige} 70%, ${FO.beigeDeep} 100%)`,
          padding: '32px 20px 40px',
        }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            {/* Brand header */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                <LogoMark size={44} bg={FO.orange} f={FO.espresso} stripes={FO.espresso} radius={11}/>
                <Wordmark size={34}/>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(30,22,18,0.6)' }}>
                Plataforma de gestão de redes FTTH/FTTX para ISPs
              </div>
            </div>

            {/* Wizard card */}
            <div ref={wizardRef} className="fo-wizard-card" style={{
              background: '#fff', borderRadius: 14,
              border: `1px solid ${FO.line}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 20px 50px rgba(26,18,13,0.08)',
              padding: '28px 32px',
            }}>
              <Stepper step={step} labels={labels}/>

              {/* Validation error banner */}
              {Object.keys(fieldErrors).length > 0 && (
                <div style={{
                  marginBottom: 18, padding: '12px 16px', borderRadius: 8,
                  background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  animation: 'fo-shake .4s ease',
                  fontSize: 13, color: '#b91c1c',
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="6.5" stroke="#dc2626" strokeWidth="1.4"/>
                    <path d="M8 5v3.5M8 10.5v.1" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>
                    Preencha os campos obrigatórios destacados em vermelho antes de continuar.
                  </span>
                </div>
              )}

              {/* Step heading */}
              <div style={{ marginBottom: 20 }}>
                <h1 style={{
                  margin: 0, fontFamily: '"Instrument Serif", serif',
                  fontWeight: 400, fontSize: 32, color: FO.espresso, letterSpacing: '-0.02em',
                }}>
                  {[
                    <>Escolha seu <span style={{ fontStyle: 'italic', color: FO.orange }}>plano</span></>,
                    <>Sobre sua <span style={{ fontStyle: 'italic', color: FO.orange }}>empresa</span></>,
                    <>Quem podemos <span style={{ fontStyle: 'italic', color: FO.orange }}>chamar?</span></>,
                    <>Revise e <span style={{ fontStyle: 'italic', color: FO.orange }}>confirme</span></>,
                    <>Finalize o <span style={{ fontStyle: 'italic', color: FO.orange }}>pagamento</span></>,
                  ][step]}
                </h1>
                <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(30,22,18,0.65)' }}>
                  {[
                    'Todos os planos começam com teste grátis. Sem cartão de crédito.',
                    'Precisamos entender o porte da operação para ativar o ambiente certo.',
                    'Preencha seu contato e crie suas credenciais de acesso.',
                    'Confira as informações antes de enviar.',
                    `Pague via PIX ou cartão para ativar seu plano ${plan.name}.`,
                  ][step]}
                </p>
              </div>

              {/* Step body */}
              <div key={step} style={{ animation: 'fo-fade .25s ease' }}>
                {step === 0 && <Step1Plan data={data} setData={updateData}/>}
                {step === 1 && <Step2Company data={data} setData={updateData} errors={fieldErrors} requireCnpj={hasPayment}/>}
                {step === 2 && (
                  <Step3Contact
                    data={data} setData={updateData}
                    loginDisponivel={loginDisponivel} setLoginDisponivel={setLoginDisponivel}
                    verificandoLogin={verificandoLogin} setVerificandoLogin={setVerificandoLogin}
                    errors={fieldErrors}
                  />
                )}
                {step === 3 && <Step4Review data={data} erro={erro}/>}
                {step === 4 && <Step5Payment data={data} onPaid={handlePaid}/>}
              </div>

              {/* Actions */}
              {!isPaymentStep && (
                <div style={{
                  marginTop: 24, display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  borderTop: `1px solid ${FO.line}`, paddingTop: 20,
                }}>
                  <button type="button" onClick={() => { setErro(null); setStep((s) => Math.max(0, s - 1)) }}
                    disabled={step === 0}
                    style={{
                      padding: '10px 16px', borderRadius: 6,
                      background: 'transparent', border: 'none',
                      color: step === 0 ? 'rgba(30,22,18,0.3)' : 'rgba(30,22,18,0.7)',
                      cursor: step === 0 ? 'not-allowed' : 'pointer',
                      fontSize: 14, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3 L4 7 L9 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Voltar
                  </button>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(30,22,18,0.5)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em' }}>
                      {step + 1} / {labels.length}
                    </span>
                    <button type="button" onClick={handleNext} disabled={enviando}
                      style={{
                        padding: '12px 22px', borderRadius: 6, border: 'none',
                        background: `linear-gradient(180deg, ${FO.orangeSoft} 0%, ${FO.orange} 45%, ${FO.orangeDeep} 100%)`,
                        color: FO.cream, fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                        cursor: enviando ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 18px rgba(196,90,44,0.3)',
                        opacity: enviando ? 0.75 : 1,
                      }}>
                      {enviando ? (
                        <>
                          <span style={{ width: 14, height: 14, borderRadius: 7, border: `2px solid ${FO.cream}60`, borderTopColor: FO.cream, display: 'inline-block', animation: 'fo-spin .7s linear infinite' }}/>
                          Aguarde…
                        </>
                      ) : (
                        <>
                          {ctaLabel}
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke={FO.cream} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer links */}
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, color: 'rgba(30,22,18,0.65)' }}>
              Já tem conta?{' '}
              <Link href="/login" style={{ color: FO.orange, fontWeight: 500, textDecoration: 'none', borderBottom: `1px solid ${FO.orange}50` }}>
                Entrar
              </Link>
            </div>

            <div style={{
              marginTop: 22, display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap',
              fontSize: 11, color: 'rgba(30,22,18,0.5)',
              fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <span>LGPD</span><span>·</span><span>ISO 27001</span><span>·</span><span>Anatel</span><span>·</span><span>Dados criptografados</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
