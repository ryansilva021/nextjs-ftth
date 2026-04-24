'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const FO = {
  espresso:     '#1A120D',
  orange:       '#C45A2C',
  orangeLight:  '#F4A771',
  orangeBg:     'rgba(196,90,44,0.10)',
  beige:        '#EDE3D2',
  cream:        '#F7F0E2',
  border:       '#C8B89A',
  text:         '#1A120D',
  textMuted:    '#7A5C46',
  textLight:    '#5A3E2E',
}

const CHECKLIST = [
  { id: 'network',   label: 'Configurar rede OLT',          done: false },
  { id: 'cto',       label: 'Cadastrar primeira CTO',        done: false },
  { id: 'tecnico',   label: 'Adicionar técnico à equipe',    done: false },
  { id: 'os',        label: 'Criar ordem de serviço piloto', done: false },
]

const SAMPLE_ALERTS = [
  { id: 1, severity: 'critical', msg: 'ONU sem sinal — CTO-07 / Cliente: João Silva',  time: 'há 3 min' },
  { id: 2, severity: 'warning',  msg: 'Potência abaixo do limiar — OLT-02 Port 4',     time: 'há 12 min' },
  { id: 3, severity: 'info',     msg: 'OS #142 concluída pelo técnico Rafael',          time: 'há 28 min' },
]

function SeverityDot({ severity }) {
  const colors = {
    critical: '#ef4444',
    warning:  '#f59e0b',
    info:     '#22c55e',
  }
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      backgroundColor: colors[severity] ?? '#94a3b8',
      boxShadow: `0 0 6px ${colors[severity] ?? '#94a3b8'}`,
      display: 'inline-block', marginTop: 2,
    }} />
  )
}

function KpiCard({ label, value, icon, delta, deltaUp }) {
  return (
    <div style={{
      background: FO.cream, borderRadius: 12,
      border: `1px solid ${FO.border}`,
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: FO.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <p style={{ fontSize: 28, fontWeight: 700, color: FO.text, lineHeight: 1, margin: 0 }}>{value}</p>
      {delta && (
        <p style={{ fontSize: 11, color: deltaUp ? '#16a34a' : '#dc2626', margin: 0 }}>
          {deltaUp ? '▲' : '▼'} {delta}
        </p>
      )}
    </div>
  )
}

export default function VisaoGeralPage() {
  const { data: session } = useSession()
  const [liveCount, setLiveCount] = useState(0)
  const empresa = session?.user?.projeto_nome ?? session?.user?.projeto_id ?? 'sua empresa'
  const username = session?.user?.username ?? ''

  useEffect(() => {
    const id = setInterval(() => setLiveCount(c => (c + 1) % 999), 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
        .fo-serif { font-family: 'Instrument Serif', Georgia, serif; }
        .fo-overview-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .fo-overview-grid { grid-template-columns: 1fr; }
        }
        .fo-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 900px) {
          .fo-kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .fo-kpi-grid { grid-template-columns: 1fr 1fr; }
        }
        @keyframes fo-pulse-live {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>

      <div style={{ background: FO.beige, minHeight: '100%' }}>
        {/* TitleBar */}
        <div style={{
          background: FO.espresso,
          borderBottom: `1px solid rgba(255,255,255,0.07)`,
          padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* LogoMark small */}
          <svg width="22" height="22" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
            <rect width="30" height="30" rx="6" fill="#C45A2C"/>
            <text x="6" y="22" fontFamily="Georgia,serif" fontSize="20" fontWeight="700" fill="white">F</text>
            <rect x="18" y="8"  width="7" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
            <rect x="18" y="12" width="7" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
            <rect x="18" y="16" width="5" height="2" rx="1" fill="rgba(255,255,255,0.6)"/>
          </svg>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 500 }}>
            FiberOps · Painel de operações
          </span>
          <span style={{
            marginLeft: 'auto',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            padding: '3px 10px', borderRadius: 99,
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.25)',
            color: '#4ade80',
          }}>
            SESSÃO ATIVA
          </span>
        </div>

        <div style={{ padding: '28px 28px 40px' }}>
          {/* Breadcrumb */}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: FO.textMuted, marginBottom: 18 }}>
            PAINEL · AGORA
          </p>

          {/* Welcome heading */}
          <div style={{ marginBottom: 24 }}>
            <h1 className="fo-serif" style={{ fontSize: 30, color: FO.text, margin: 0, lineHeight: 1.15 }}>
              Bem-vindo,{' '}
              <em style={{ color: FO.orange, fontStyle: 'italic' }}>{empresa}</em>
            </h1>
            {username && (
              <p style={{ fontSize: 13, color: FO.textMuted, marginTop: 4 }}>
                Logado como <strong style={{ color: FO.textLight }}>{username}</strong>
              </p>
            )}
          </div>

          {/* Onboarding banner */}
          <div style={{
            background: FO.espresso,
            borderRadius: 12, padding: '20px 24px',
            marginBottom: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            flexWrap: 'wrap',
            border: `1px solid rgba(255,255,255,0.07)`,
          }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 15, margin: 0 }}>
                Vamos conectar sua primeira OLT
              </p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                Configure sua infraestrutura e comece a monitorar ONUs em tempo real.
              </p>
            </div>
            <Link
              href="/admin/topologia"
              style={{
                background: FO.orange, color: 'white',
                fontSize: 12, fontWeight: 700, padding: '9px 20px',
                borderRadius: 8, textDecoration: 'none', flexShrink: 0,
                transition: 'opacity 0.15s',
              }}
            >
              Configurar agora →
            </Link>
          </div>

          {/* KPI grid */}
          <div className="fo-kpi-grid" style={{ marginBottom: 24 }}>
            <KpiCard label="ONUs Online"      value="—"  icon="◉" />
            <KpiCard label="CTOs"             value="—"  icon="⬡" />
            <KpiCard label="Alertas ativos"   value="—"  icon="▲" />
            <KpiCard label="Técnicos online"  value="—"  icon="◎" />
          </div>

          {/* Bottom grid */}
          <div className="fo-overview-grid">
            {/* Checklist */}
            <div style={{
              background: FO.cream, borderRadius: 12,
              border: `1px solid ${FO.border}`, padding: '20px 24px',
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', color: FO.textMuted, marginBottom: 16, marginTop: 0 }}>
                CONFIGURE SEU AMBIENTE
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {CHECKLIST.map((item, i) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8,
                    background: item.done ? 'rgba(22,163,74,0.08)' : FO.beige,
                    border: `1px solid ${item.done ? 'rgba(22,163,74,0.2)' : FO.border}`,
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: item.done ? '1.5px solid #16a34a' : `1.5px solid ${FO.border}`,
                      background: item.done ? '#16a34a' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {item.done && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{
                      fontSize: 13, color: item.done ? FO.textMuted : FO.text,
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}>
                      {item.label}
                    </span>
                    {i === 0 && !item.done && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                        padding: '2px 7px', borderRadius: 99,
                        background: FO.orangeBg, color: FO.orange,
                        border: `1px solid rgba(196,90,44,0.25)`,
                      }}>PRÓXIMO</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts feed */}
            <div style={{
              background: FO.cream, borderRadius: 12,
              border: `1px solid ${FO.border}`, padding: '20px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', color: FO.textMuted, margin: 0 }}>
                  ALERTAS RECENTES
                </p>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                  padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#ef4444',
                  animation: 'fo-pulse-live 1.8s ease-in-out infinite',
                }}>
                  LIVE
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SAMPLE_ALERTS.map(alert => (
                  <div key={alert.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    background: FO.beige, border: `1px solid ${FO.border}`,
                  }}>
                    <SeverityDot severity={alert.severity} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: FO.text, margin: 0, lineHeight: 1.4 }}>
                        {alert.msg}
                      </p>
                      <p style={{ fontSize: 10, color: FO.textMuted, margin: '3px 0 0' }}>
                        {alert.time}
                      </p>
                    </div>
                  </div>
                ))}
                {SAMPLE_ALERTS.length === 0 && (
                  <p style={{ fontSize: 12, color: FO.textMuted, textAlign: 'center', padding: '20px 0' }}>
                    Nenhum alerta ativo
                  </p>
                )}
              </div>
              <Link href="/" style={{
                display: 'block', textAlign: 'center', marginTop: 14,
                fontSize: 11, color: FO.orange, fontWeight: 600, textDecoration: 'none',
              }}>
                Ver no mapa →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
