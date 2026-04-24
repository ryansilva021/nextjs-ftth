'use client'

import { Suspense, useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

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
  ink:         '#2A1F18',
  line:        'rgba(30,22,18,0.12)',
  lineDark:    'rgba(237,227,210,0.12)',
  muted:       'rgba(237,227,210,0.6)',
}

// ───────────────────────── Icons ─────────────────────────
const Icon = {
  check: (c = FO.orange) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6.5" fill={c} fillOpacity="0.12" stroke={c} strokeWidth="1"/>
      <path d="M4 7.2 L6 9.2 L10 4.8" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  user: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="2.8" stroke={c} strokeWidth="1.4"/>
      <path d="M2.5 13.5c0-2.8 2.4-4.5 5.5-4.5s5.5 1.7 5.5 4.5" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  lock: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="1.2" stroke={c} strokeWidth="1.4"/>
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke={c} strokeWidth="1.4"/>
      <circle cx="8" cy="10.5" r="1" fill={c}/>
    </svg>
  ),
  eye: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" stroke={c} strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="2" stroke={c} strokeWidth="1.4"/>
    </svg>
  ),
  eyeOff: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 2l12 12M6 6.2A2 2 0 0 0 8 10a2 2 0 0 0 1.8-1.1" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M3 9.5C2 8.7 1.5 8 1.5 8S4 3.5 8 3.5c1 0 1.9.2 2.7.5M13.2 6c.8.9 1.3 2 1.3 2s-2.5 4.5-6.5 4.5c-.6 0-1.2-.1-1.7-.2" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  arrow: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  shield: (c) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5 2 3.2v3.3c0 3 2.3 5.5 5 6 2.7-.5 5-3 5-6V3.2L7 1.5Z" stroke={c} strokeWidth="1.3"/>
    </svg>
  ),
  fiber: (c) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M2 16c4-6 8-6 12-12M2 10c4-2 8-2 12-8M2 18c5-8 10-8 15-16" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  radar: (c) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.3" strokeOpacity="0.4"/>
      <circle cx="10" cy="10" r="4" stroke={c} strokeWidth="1.3" strokeOpacity="0.7"/>
      <circle cx="10" cy="10" r="1.4" fill={c}/>
      <path d="M10 10 L16 6" stroke={c} strokeWidth="1.3"/>
    </svg>
  ),
  pulse: (c) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M2 10h3l2-5 3 10 2-5 2 3 3-3h1" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  clock: (c) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke={c} strokeWidth="1.4"/>
      <path d="M10 5.5V10l3 2" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  minimize: (c) => <svg width="12" height="12"><path d="M2 6h8" stroke={c} strokeWidth="1.3"/></svg>,
  maximize: (c) => <svg width="12" height="12" fill="none"><rect x="2" y="2" width="8" height="8" stroke={c} strokeWidth="1.3"/></svg>,
  close: (c) => <svg width="12" height="12"><path d="M2 2l8 8M10 2l-8 8" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>,
}

// ───────────────────────── Logo ─────────────────────────
function LogoMark({ size = 32, bg = FO.orange, f = FO.espresso, stripes = null, radius }) {
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

function Wordmark({ size = 28, color = FO.cream, accent = FO.orangeGlow }) {
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

function LogoLockup({ markSize = 36, textSize = 28, dark = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <LogoMark size={markSize} bg={FO.orange} f={FO.espresso} stripes={FO.espresso}/>
      <Wordmark size={textSize} color={dark ? FO.cream : FO.espresso} accent={dark ? FO.orangeGlow : FO.orange}/>
    </div>
  )
}

// ───────────────────────── Left Panel ─────────────────────────
function LeftPanel() {
  const features = [
    'Gestão completa da rede FTTH e FTTX',
    'Monitoramento de OLTs e ONUs em tempo real',
    'Controle de provisionamento e desativação',
    'Notificações por SLA sem abrir o sistema',
    'Relatórios e dashboards operacionais',
  ]

  const stats = [
    { v: '120+',  t: 'Provedores',       icon: Icon.fiber(FO.orangeGlow),  tone: FO.orange },
    { v: '50k+',  t: 'ONUs monitoradas', icon: Icon.radar(FO.orangeGlow),  tone: FO.orangeDeep },
    { v: '99,9%', t: 'Uptime garantido', icon: Icon.pulse(FO.orangeGlow),  tone: FO.orangeDeep },
    { v: '24/7',  t: 'Suporte técnico',  icon: Icon.clock(FO.orangeGlow),  tone: FO.orange },
  ]

  const modules = [
    {
      tag: 'NOC · tempo real',
      title: 'Alertas antes do cliente ligar',
      body: 'Detecção automática de queda de sinal óptico, reboots de ONU e degradação de PON — com triagem por impacto no SLA.',
    },
    {
      tag: 'Provisionamento',
      title: 'Autorização de ONU em 8 segundos',
      body: 'Fluxo unificado Huawei, ZTE, Datacom, Parks e Furukawa. Menos chamado em campo, mais SLA cumprido.',
    },
    {
      tag: 'Financeiro integrado',
      title: 'Cobrança + rede na mesma tela',
      body: 'Bloqueio automático por inadimplência, PIX com baixa em tempo real e réguas de cobrança por WhatsApp.',
    },
    {
      tag: 'LGPD · Anatel',
      title: 'Relatórios regulatórios automáticos',
      body: 'SGMU, ICC e Anatel gerados com 1 clique. Trilha de auditoria e retenção de logs conformes.',
    },
  ]

  const integrations = ['Huawei', 'ZTE', 'Datacom', 'Mikrotik', 'Parks', 'Furukawa']

  const [modIdx, setModIdx] = useState(0)
  useEffect(() => {
    setModIdx(Math.floor(Math.random() * modules.length))
  }, [])
  useEffect(() => {
    const t = setInterval(() => setModIdx((i) => (i + 1) % modules.length), 6000)
    return () => clearInterval(t)
  }, [])
  const mod = modules[modIdx]

  return (
    <div className="fo-left" style={{
      position: 'relative',
      height: '100%',
      background: `radial-gradient(120% 80% at 10% 0%, ${FO.espressoUp} 0%, ${FO.espresso} 60%)`,
      color: FO.cream,
      display: 'flex', flexDirection: 'column',
      overflow: 'auto',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      {/* fiber lines */}
      <svg width="100%" height="100%" viewBox="0 0 600 900" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, opacity: 0.08, pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="fl" x1="0" x2="1">
            <stop offset="0" stopColor={FO.orangeGlow} stopOpacity="0"/>
            <stop offset="0.5" stopColor={FO.orangeGlow} stopOpacity="1"/>
            <stop offset="1" stopColor={FO.orangeGlow} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0.1,0.22,0.35,0.5,0.62,0.78,0.9].map((y, i) => (
          <path key={i} d={`M-50 ${y*900} Q300 ${y*900 - 80*(i%2?1:-1)} 650 ${y*900 + 40}`} stroke="url(#fl)" strokeWidth="1" fill="none"/>
        ))}
      </svg>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <LogoLockup markSize={40} textSize={32} dark/>
      </div>

      <div style={{ position: 'relative', zIndex: 2, marginTop: 40 }}>
        <div className="fo-pill" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px 6px 10px',
          border: `1px solid ${FO.lineDark}`,
          borderRadius: 999,
          fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: FO.orangeGlow,
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: FO.orangeGlow, boxShadow: `0 0 8px ${FO.orangeGlow}` }}/>
          Cloud · FTTH · FTTX
        </div>

        <h1 className="fo-title" style={{
          margin: '18px 0 0',
          fontFamily: '"Instrument Serif", "Newsreader", Georgia, serif',
          fontWeight: 400, letterSpacing: '-0.02em',
          color: FO.cream, textWrap: 'balance',
        }}>
          Gestão completa para o{' '}
          <span style={{ fontStyle: 'italic', color: FO.orangeGlow, whiteSpace: 'nowrap' }}>seu ISP.</span>
        </h1>

        <p className="fo-intro-p" style={{
          margin: '18px 0 0', maxWidth: 440,
          fontSize: 14.5, lineHeight: 1.6,
          color: FO.muted,
        }}>
          Uma plataforma única para provisionamento, monitoramento em tempo real
          e operação da sua rede óptica — do NOC à última milha.
        </p>

        <ul className="fo-features" style={{ margin: '24px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
          {features.map((f, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'rgba(237,227,210,0.86)' }}>
              {Icon.check(FO.orangeGlow)}
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="fo-stats" style={{
          marginTop: 28,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          maxWidth: 440,
        }}>
          {stats.map((s, i) => (
            <div key={i} className="fo-stat-card" style={{
              border: `1px solid ${FO.lineDark}`,
              borderRadius: 8,
              padding: '14px',
              background: 'rgba(237,227,210,0.02)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div className="fo-stat-icon" style={{
                width: 36, height: 36, borderRadius: 8,
                background: `linear-gradient(135deg, ${s.tone}, ${FO.orangeDeep})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 6px 14px ${s.tone}40`,
                flexShrink: 0,
              }}>{s.icon}</div>
              <div>
                <div className="fo-stat-v" style={{
                  fontFamily: '"Instrument Serif", serif',
                  fontSize: 22, lineHeight: 1, color: FO.cream, letterSpacing: '-0.01em',
                }}>{s.v}</div>
                <div className="fo-stat-t" style={{ fontSize: 11, color: FO.muted, marginTop: 3 }}>{s.t}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Rotating module */}
        <div className="fo-rotator" style={{
          marginTop: 22, maxWidth: 440,
          padding: '16px 18px',
          borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(196,90,44,0.14), rgba(237,227,210,0.02))',
          border: `1px solid ${FO.lineDark}`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: FO.orangeGlow, fontFamily: '"JetBrains Mono", monospace',
            marginBottom: 8,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: FO.orangeGlow }}/>
            {mod.tag}
          </div>
          <div key={modIdx} style={{ animation: 'fo-fade .55s ease' }}>
            <div style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: 20, lineHeight: 1.2, color: FO.cream, letterSpacing: '-0.01em',
            }}>{mod.title}</div>
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55, color: FO.muted }}>{mod.body}</div>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
            {modules.map((_, i) => (
              <button key={i} onClick={() => setModIdx(i)} aria-label={`Módulo ${i+1}`}
                style={{
                  width: i === modIdx ? 18 : 5, height: 5, borderRadius: 3,
                  border: 'none', cursor: 'pointer', padding: 0,
                  background: i === modIdx ? FO.orangeGlow : 'rgba(237,227,210,0.25)',
                  transition: 'width .3s, background .3s',
                }}/>
            ))}
          </div>
        </div>

        {/* Quote */}
        <div className="fo-quote" style={{
          marginTop: 18, maxWidth: 440,
          padding: '14px 18px 14px 20px',
          borderLeft: `2px solid ${FO.orange}`,
          fontFamily: '"Instrument Serif", serif',
          fontSize: 16, lineHeight: 1.45, fontStyle: 'italic',
          color: 'rgba(237,227,210,0.88)',
        }}>
          "Reduzimos 62% dos chamados em campo no primeiro trimestre."
          <div style={{
            marginTop: 8, fontSize: 11, fontStyle: 'normal',
            fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em',
            color: 'rgba(237,227,210,0.5)', textTransform: 'uppercase',
          }}>
            Renata A. · NOC Manager · Provedor parceiro
          </div>
        </div>

        {/* Integrations */}
        <div className="fo-integrations" style={{ marginTop: 22, maxWidth: 440 }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
            color: 'rgba(237,227,210,0.45)', fontFamily: '"JetBrains Mono", monospace',
            marginBottom: 10,
          }}>Integrações nativas</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {integrations.map((x) => (
              <span key={x} style={{
                padding: '5px 10px', borderRadius: 999,
                border: `1px solid ${FO.lineDark}`,
                fontSize: 11, color: 'rgba(237,227,210,0.75)',
                fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.03em',
              }}>{x}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fo-left-footer" style={{
        position: 'relative', zIndex: 2, marginTop: 'auto', paddingTop: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        fontSize: 11, color: 'rgba(237,227,210,0.45)',
        fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: '#4ade80', boxShadow: '0 0 6px #4ade80' }}/>
          Plataforma operacional · online
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>LGPD</span><span style={{ opacity: 0.4 }}>·</span>
          <span>ISO 27001</span><span style={{ opacity: 0.4 }}>·</span>
          <span>Anatel</span>
        </span>
        <span>© 2026 FiberOps</span>
      </div>
    </div>
  )
}

// ───────────────────────── Form Field ─────────────────────────
function FieldLabel({ label, children }) {
  return (
    <div style={{ display: 'block', marginBottom: 14 }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: 'rgba(30,22,18,0.55)', marginBottom: 8,
        fontFamily: '"JetBrains Mono", monospace', fontWeight: 500,
      }}>{label}</div>
      {children}
    </div>
  )
}

function TextInput({ icon, right, type = 'text', placeholder, value, onChange, autoComplete, hasError }) {
  const [focus, setFocus] = useState(false)
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: 48,
      borderRadius: 6,
      border: `1px solid ${hasError ? '#C45A2C' : focus ? FO.orange : FO.line}`,
      background: '#fff',
      boxShadow: focus ? `0 0 0 3px ${FO.orange}20` : hasError ? `0 0 0 3px ${FO.orange}15` : 'none',
      transition: 'all .15s',
      overflow: 'hidden',
    }}>
      {icon && (
        <div style={{ paddingLeft: 14, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {icon(focus ? FO.orange : hasError ? FO.orange : 'rgba(30,22,18,0.45)')}
        </div>
      )}
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        autoComplete={autoComplete}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          padding: '0 14px', fontSize: 14, color: FO.espresso,
          fontFamily: 'inherit',
        }}
      />
      {right && <div style={{ paddingRight: 10, display: 'flex', alignItems: 'center', flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

// ───────────────────────── Login Form (auth) ─────────────────────────
function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl  = searchParams.get('callbackUrl') || '/'

  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [remember,   setRemember]   = useState(true)
  const [erro,       setErro]       = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [success,    setSuccess]    = useState(false)

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 6)  return 'Boa madrugada · NOC 24h'
    if (h < 12) return 'Bom dia · Operação'
    if (h < 18) return 'Boa tarde · Operação'
    return 'Boa noite · NOC 24h'
  })()

  async function handleSubmit(e) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      const result = await signIn('credentials', { username, password, redirect: false, callbackUrl })
      if (result?.error) {
        const msg = result.error
        setErro(msg.includes('rate_limited')
          ? (msg.split(':')[2] || 'Muitas tentativas. Tente novamente mais tarde.')
          : 'Usuário ou senha inválidos.')
      } else if (result?.ok) {
        setSuccess(true)
        setTimeout(() => { router.push(callbackUrl); router.refresh() }, 600)
      }
    } catch {
      setErro('Erro inesperado. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="fo-right" style={{
      height: '100%',
      background: `linear-gradient(180deg, ${FO.cream} 0%, ${FO.beige} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Inter", system-ui, sans-serif',
      position: 'relative',
    }}>
      {/* paper grain */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5, pointerEvents: 'none' }}>
        <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/></filter>
        <rect width="100%" height="100%" filter="url(#n)" opacity="0.06"/>
      </svg>

      <form onSubmit={handleSubmit} className="fo-form" style={{ width: '100%', maxWidth: 380, position: 'relative' }}>
        {/* Mobile-only logo */}
        <div className="fo-mobile-logo">
          <LogoLockup markSize={36} textSize={28} dark={false}/>
        </div>

        {/* Ornamental divider */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <span style={{ width: 28, height: 1, background: FO.line }}/>
          <svg width="18" height="18" viewBox="0 0 72 72" fill="none">
            <g transform="translate(18,13)">
              <path d="M4 2 L4 46 Q4 48 6 48 L10 48 Q12 48 12 46 L12 30 L26 30 Q28 30 28 28 L28 24 Q28 22 26 22 L12 22 L12 10 L30 10 L30 14 Q30 16 32 16 L34 16 Q36 16 36 14 L36 4 Q36 2 34 2 Z" fill={FO.orange} opacity="0.85"/>
            </g>
          </svg>
          <span style={{ width: 28, height: 1, background: FO.line }}/>
        </div>

        {/* Greeting */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            fontSize: 10.5, letterSpacing: '0.3em', textTransform: 'uppercase',
            color: 'rgba(30,22,18,0.5)',
            fontFamily: '"JetBrains Mono", monospace', fontWeight: 500,
          }}>{greeting}</div>
          <h2 style={{
            margin: '10px 0 0',
            fontFamily: '"Instrument Serif", serif', fontWeight: 400,
            fontSize: 30, color: FO.espresso, letterSpacing: '-0.02em', lineHeight: 1.1,
          }}>
            Entre na <span style={{ fontStyle: 'italic', color: FO.orange }}>plataforma</span>
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(30,22,18,0.6)' }}>
            Sem acesso?{' '}
            <Link href="/cadastro" style={{ color: FO.orange, fontWeight: 500, textDecoration: 'none', borderBottom: `1px solid ${FO.orange}50` }}>
              Fale com nossa equipe
            </Link>
          </p>
        </div>

        {/* Error banner */}
        {erro && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 6,
            background: 'rgba(196,90,44,0.08)', border: `1px solid ${FO.orange}40`,
            fontSize: 13, color: FO.orangeDeep, lineHeight: 1.4,
          }}>{erro}</div>
        )}

        <FieldLabel label="Usuário">
          <TextInput
            icon={Icon.user}
            placeholder="usuario@provedor.com.br"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            hasError={!!erro}
          />
        </FieldLabel>

        <FieldLabel label="Senha">
          <TextInput
            icon={Icon.lock}
            type={showPass ? 'text' : 'password'}
            placeholder="••••••••••"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            hasError={!!erro}
            right={
              <button type="button" onClick={() => setShowPass(v => !v)}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  padding: 8, borderRadius: 4, display: 'flex', alignItems: 'center',
                  color: 'rgba(30,22,18,0.5)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30,22,18,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPass ? Icon.eyeOff('currentColor') : Icon.eye('currentColor')}
              </button>
            }
          />
        </FieldLabel>

        {/* Remember + Forgot */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          margin: '4px 0 18px',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'rgba(30,22,18,0.7)' }}>
            <span
              onClick={() => setRemember(r => !r)}
              style={{
                width: 16, height: 16, borderRadius: 4,
                border: `1.5px solid ${remember ? FO.orange : 'rgba(30,22,18,0.3)'}`,
                background: remember ? FO.orange : 'transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s', flexShrink: 0,
              }}>
              {remember && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.2L4 7.2L8 2.8" stroke={FO.cream} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            Lembrar de mim
          </label>
          <a href="#" style={{ fontSize: 13, color: 'rgba(30,22,18,0.65)', textDecoration: 'none' }}
            onMouseEnter={(e) => e.currentTarget.style.color = FO.orange}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(30,22,18,0.65)'}>
            Esqueci minha senha
          </a>
        </div>

        {/* Submit */}
        <button type="submit" disabled={carregando || success}
          style={{
            width: '100%', height: 50, border: 'none',
            cursor: carregando || success ? 'not-allowed' : 'pointer',
            borderRadius: 6,
            background: success
              ? 'linear-gradient(180deg, #22c55e, #16a34a)'
              : carregando
                ? FO.orangeDeep
                : `linear-gradient(180deg, ${FO.orangeSoft} 0%, ${FO.orange} 45%, ${FO.orangeDeep} 100%)`,
            color: FO.cream,
            fontSize: 15, fontWeight: 500, letterSpacing: '0.01em',
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 1px 0 rgba(255,255,255,0.25) inset, 0 8px 20px rgba(196,90,44,0.3)',
            transition: 'transform .08s, box-shadow .2s',
          }}
          onMouseDown={(e) => { if (!carregando && !success) e.currentTarget.style.transform = 'translateY(1px)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          {success ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Acesso autorizado!
            </>
          ) : carregando ? (
            <>
              <span style={{
                width: 14, height: 14, borderRadius: 7,
                border: `2px solid ${FO.cream}60`, borderTopColor: FO.cream,
                display: 'inline-block',
                animation: 'fo-spin 0.7s linear infinite',
              }}/>
              Autenticando…
            </>
          ) : (
            <>Entrar na plataforma {Icon.arrow(FO.cream)}</>
          )}
        </button>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          margin: '22px 0 14px',
          color: 'rgba(30,22,18,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3em',
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          <div style={{ flex: 1, height: 1, background: FO.line }}/>
          ou
          <div style={{ flex: 1, height: 1, background: FO.line }}/>
        </div>

        {/* Secondary action */}
        <Link href="/cadastro"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', height: 48, cursor: 'pointer',
            borderRadius: 6,
            border: `1px solid ${FO.espresso}`,
            background: 'transparent',
            color: FO.espresso,
            fontSize: 14, fontWeight: 500,
            fontFamily: 'inherit',
            textDecoration: 'none',
            transition: 'all .15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = FO.espresso; e.currentTarget.style.color = FO.cream }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = FO.espresso }}
        >
          Solicitar acesso
        </Link>

        {/* Security footer */}
        <div style={{
          marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 11, color: 'rgba(30,22,18,0.5)',
          fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em',
        }}>
          {Icon.shield('currentColor')}
          Conexão criptografada · LGPD · ISO 27001
        </div>
      </form>
    </div>
  )
}

// ───────────────────────── WhatsApp FAB ─────────────────────────
function WhatsAppButton() {
  const [hover, setHover] = useState(false)
  const wa = '#25D366'
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 50,
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <div style={{
        background: FO.espresso, color: FO.cream,
        padding: '8px 14px', borderRadius: 999,
        fontSize: 12.5, letterSpacing: '0.01em',
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        opacity: hover ? 1 : 0,
        transform: hover ? 'translateX(0)' : 'translateX(8px)',
        transition: 'all .18s',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>Fale com o suporte</div>
      <a href="https://wa.me/" target="_blank" rel="noreferrer"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'relative',
          width: 56, height: 56, borderRadius: 28,
          background: wa,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 24px rgba(37,211,102,0.45), 0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.25)',
          textDecoration: 'none', cursor: 'pointer',
          transform: hover ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform .15s',
        }}
        aria-label="Suporte via WhatsApp"
      >
        <span style={{
          position: 'absolute', width: 56, height: 56, borderRadius: 28,
          border: `2px solid ${wa}`, opacity: 0.6,
          animation: 'fo-wa-pulse 2s ease-out infinite',
          pointerEvents: 'none',
        }}/>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="#fff">
          <path d="M16.003 3C8.82 3 3 8.82 3 16.003c0 2.29.6 4.523 1.74 6.49L3 29l6.69-1.74A12.92 12.92 0 0 0 16.003 29C23.186 29 29 23.186 29 16.003 29 8.82 23.186 3 16.003 3Zm7.49 18.09c-.32.89-1.87 1.74-2.6 1.84-.66.09-1.48.13-2.39-.15-.55-.17-1.26-.41-2.17-.8-3.82-1.65-6.32-5.5-6.51-5.75-.19-.26-1.55-2.06-1.55-3.94 0-1.87.98-2.79 1.33-3.17.35-.38.76-.48 1.02-.48s.51 0 .73.01c.23.01.54-.09.85.65.32.76 1.08 2.63 1.17 2.82.09.19.15.41.03.67-.12.26-.18.41-.35.63-.18.22-.38.5-.54.67-.18.18-.37.38-.16.74.21.36.93 1.54 2 2.49 1.37 1.22 2.53 1.6 2.9 1.78.36.19.58.15.79-.09.22-.26.91-1.06 1.16-1.42.25-.37.5-.3.84-.19.35.11 2.21 1.04 2.59 1.23.38.19.63.28.72.44.09.16.09.92-.23 1.81Z"/>
        </svg>
      </a>
    </div>
  )
}

// ───────────────────────── Page ─────────────────────────
export default function LoginPage() {
  return (
    <Suspense>
      <div style={{
        width: '100vw', minHeight: '100dvh',
        display: 'flex', flexDirection: 'column',
        background: FO.espresso,
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap');

          @keyframes fo-spin { to { transform: rotate(360deg); } }
          @keyframes fo-fade {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes fo-wa-pulse {
            0%       { transform: scale(1); opacity: 0.5; }
            80%, 100%{ transform: scale(1.6); opacity: 0; }
          }
          * { box-sizing: border-box; }
          body { margin: 0; }
          input::placeholder { color: rgba(30,22,18,0.35); }
          ::selection { background: ${FO.orange}; color: ${FO.cream}; }

          .fo-shell { display: grid; grid-template-columns: 1.05fr 1fr; flex: 1; min-height: 0; overflow: hidden; }
          .fo-left  { padding: 36px 48px 28px; }
          .fo-right { padding: 40px 56px; }
          .fo-title { font-size: 44px; line-height: 1.1; }
          .fo-mobile-logo { display: none; }

          @media (max-width: 1024px) {
            .fo-shell  { grid-template-columns: 1fr 1fr; }
            .fo-left   { padding: 28px 32px 20px; }
            .fo-right  { padding: 32px 32px; }
            .fo-title  { font-size: 36px; }
            .fo-intro-p { font-size: 13.5px; }
            .fo-features li { font-size: 12.5px !important; }
          }

          @media (max-width: 768px) {
            .fo-left        { display: none !important; }
            .fo-shell       { grid-template-columns: 1fr; overflow: auto; }
            .fo-right       { padding: 40px 28px 56px; min-height: 100dvh; justify-content: flex-start !important; padding-top: 48px; }
            .fo-mobile-logo { display: flex !important; justify-content: center; margin-bottom: 32px; }
            .fo-form        { max-width: 100% !important; }
          }

          @media (max-width: 420px) {
            .fo-right { padding: 32px 20px 48px; }
          }

          @media (max-height: 640px) and (min-width: 769px) {
            .fo-title { font-size: 32px; }
            .fo-features li:nth-child(n+4) { display: none; }
            .fo-left { padding-top: 22px; padding-bottom: 18px; }
          }
        `}</style>

        <div className="fo-shell" style={{ flex: 1, minHeight: 0 }}>
          <LeftPanel/>
          <LoginForm/>
        </div>

        <WhatsAppButton/>
      </div>
    </Suspense>
  )
}
