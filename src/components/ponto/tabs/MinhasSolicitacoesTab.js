'use client'

import { T } from '../pontoTheme'

// ─── Config de tipos e status ─────────────────────────────────────────────────

const TYPE_CFG = {
  inclusao: { label: 'Inclusão de ponto', icon: '➕', color: '#c084fc' },
  ajuste:   { label: 'Ajuste de ponto',   icon: '✏️', color: '#60a5fa' },
  ausencia: { label: 'Justif. Ausência',  icon: '📋', color: '#fb923c' },
}

const STATUS_CFG = {
  pendente:  { label: 'Pendente',  bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b',  border: 'rgba(245,158,11,0.3)'  },
  aprovado:  { label: 'Aprovado',  bg: 'rgba(34,197,94,0.12)',   color: '#22c55e',  border: 'rgba(34,197,94,0.3)'   },
  rejeitado: { label: 'Rejeitado', bg: 'rgba(239,68,68,0.12)',   color: '#ef4444',  border: 'rgba(239,68,68,0.3)'   },
}

const MARCACAO_LABELS = {
  entrada:      'Entrada',
  pausa_inicio: 'Pausa início',
  pausa_fim:    'Pausa fim',
  saida:        'Saída',
}

const AUSENCIA_LABELS = {
  falta:    '❌ Falta',
  atestado: '🏥 Atestado',
  folga:    '🌴 Folga',
}

function fmtDateBR(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

function fmtDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function MinhasSolicitacoesTab({ requests }) {
  if (!requests || requests.length === 0) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
        <div style={{ color: T.muted, fontSize: 14, fontWeight: 600 }}>Nenhuma solicitação encontrada</div>
        <div style={{ color: T.dim, fontSize: 12, marginTop: 6 }}>
          Suas solicitações de inclusão, ajuste e ausência aparecerão aqui.
        </div>
      </div>
    )
  }

  // Agrupa por status para mostrar pendentes primeiro
  const sorted = [...requests].sort((a, b) => {
    const order = { pendente: 0, aprovado: 1, rejeitado: 2 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3) ||
           new Date(b.createdAt) - new Date(a.createdAt)
  })

  // Contadores
  const counts = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>
      {/* Resumo de status */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {Object.entries(STATUS_CFG).map(([k, cfg]) => (
          <div key={k} style={{
            flex: 1, background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 10, padding: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: cfg.color }}>{counts[k] ?? 0}</div>
            <div style={{ fontSize: 10, color: cfg.color, fontWeight: 600 }}>{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(req => {
          const tc  = TYPE_CFG[req.type]   ?? { label: req.type,   icon: '📄', color: T.muted }
          const sc  = STATUS_CFG[req.status] ?? STATUS_CFG.pendente

          // Linha de detalhe
          let detalhe = ''
          if (req.type === 'ausencia') {
            detalhe = AUSENCIA_LABELS[req.tipoAusencia] ?? req.tipoAusencia
            if (req.dataFim && req.dataFim !== req.data) {
              detalhe += ` · ${fmtDateBR(req.data)} – ${fmtDateBR(req.dataFim)}`
            } else {
              detalhe += ` · ${fmtDateBR(req.data)}`
            }
          } else {
            detalhe = `${MARCACAO_LABELS[req.tipoMarcacao] ?? req.tipoMarcacao} · ${req.horaSolicitada ?? ''} · ${fmtDateBR(req.data)}`
          }

          return (
            <div key={req._id} style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 12, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderBottom: `1px solid ${T.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 800,
                    color: tc.color,
                  }}>
                    {tc.icon} {tc.label}
                  </span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                }}>
                  {sc.label}
                </span>
              </div>

              {/* Body */}
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>
                  {detalhe}
                </div>
                <div style={{
                  fontSize: 12, color: T.dim,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  💬 {req.motivo}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '6px 14px', borderTop: `1px solid ${T.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 10, color: T.dim }}>
                  Enviado em {fmtDateTime(req.createdAt)}
                </span>
                {req.observacaoAdmin && (
                  <span style={{ fontSize: 10, color: T.muted }}>
                    📝 {req.observacaoAdmin}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
