'use client'

/**
 * src/components/map/VarinhaNetworkTool.js
 * ─────────────────────────────────────────────────────────────────
 * Painel flutuante da Varinha de Criação Automática de Rede.
 *
 * Máquina de estados:
 *   idle → drawing → fetching → generating → preview → saving → idle
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  enablePolygonDraw,
  disablePolygonDraw,
  renderPolygonPreview,
  renderPreviewNetwork,
  clearPreview,
} from '@/lib/olMap'
import { autoBuildNetwork } from '@/services/network/autoBuildNetwork'
import { importCTOs, importRotas } from '@/actions/imports'

// ─────────────────────────────────────────────────────────────────
const STEPS = {
  IDLE:       'idle',
  DRAWING:    'drawing',
  FETCHING:   'fetching',
  GENERATING: 'generating',
  PREVIEW:    'preview',
  SAVING:     'saving',
}

// ─────────────────────────────────────────────────────────────────
export default function VarinhaNetworkTool({ projetoId, onSaved, onClose }) {
  const [step,          setStep]         = useState(STEPS.IDLE)
  const [network,       setNetwork]      = useState(null)
  const [error,         setError]        = useState(null)
  const [progress,      setProgress]     = useState('')
  const [prefix,        setPrefix]       = useState('CTO')
  const [capac,         setCapac]        = useState(16)
  const [spacingM,      setSpacingM]     = useState(80)
  const [genDistRoutes, setGenDistRoutes] = useState(true)
  const networkRef = useRef(null)

  useEffect(() => () => { disablePolygonDraw(); clearPreview() }, [])

  // ── Iniciar desenho ───────────────────────────────────────────
  function handleStartDraw() {
    setStep(STEPS.DRAWING)
    setError(null)
    setNetwork(null)
    clearPreview()
    enablePolygonDraw(handlePolygonComplete)
  }

  // ── Polígono desenhado ─────────────────────────────────────────
  const handlePolygonComplete = useCallback(async (coords) => {
    disablePolygonDraw()
    if (coords.length < 3) {
      setStep(STEPS.IDLE)
      setError('Polígono precisa de pelo menos 3 vértices.')
      return
    }

    setStep(STEPS.FETCHING)
    setProgress('Buscando ruas no OpenStreetMap…')
    renderPolygonPreview(coords)

    try {
      const result = await autoBuildNetwork(coords, {
        spacingM,
        capacidade: capac,
        prefix,
        genDistRoutes,
        onProgress: (msg) => {
          setProgress(msg)
          if (msg.includes('posicionando') || msg.includes('CTOs') || msg.includes('distribuição')) {
            setStep(STEPS.GENERATING)
          }
        },
      })

      if (result.ctos.length === 0 && result.routes.length === 0) {
        setStep(STEPS.IDLE)
        setError('Área muito pequena ou sem ruas. Tente uma área maior.')
        clearPreview()
        return
      }

      networkRef.current = result
      setNetwork(result)

      // Preview: infra routes + dist routes + CTOs
      renderPreviewNetwork({
        routes: [...result.routes, ...result.distRoutes],
        ctos:   result.ctos,
      })
      setStep(STEPS.PREVIEW)
    } catch (e) {
      setStep(STEPS.IDLE)
      setError(e.message ?? 'Erro ao gerar rede.')
      clearPreview()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capac, prefix, spacingM, genDistRoutes])

  // ── Confirmar e salvar ────────────────────────────────────────
  async function handleConfirm() {
    const net = networkRef.current
    if (!net || !projetoId) return
    setStep(STEPS.SAVING)
    setError(null)

    try {
      const ctoRows = net.ctos.map(c => ({
        cto_id: c.cto_id, nome: c.nome,
        lat: c.lat, lng: c.lng,
        capacidade: c.capacidade, status: c.status ?? 'ativo',
      }))

      // Salvar rotas de infraestrutura + rotas de distribuição
      const allRoutes = [...net.routes, ...net.distRoutes]
      const rotaFeatures = allRoutes.map(r => ({
        rota_id: r.rota_id, nome: r.nome,
        tipo: r.tipo, coordinates: r.coordinates,
      }))

      const [ctoRes, rotaRes] = await Promise.all([
        importCTOs(ctoRows, projetoId),
        rotaFeatures.length > 0 ? importRotas(rotaFeatures, projetoId) : Promise.resolve({ inserted: 0, modified: 0 }),
      ])

      clearPreview()
      setStep(STEPS.IDLE)
      setNetwork(null)
      networkRef.current = null
      onSaved?.({ ctos: ctoRes.inserted + ctoRes.modified, routes: rotaRes.inserted + rotaRes.modified })
    } catch (e) {
      setError(e.message)
      setStep(STEPS.PREVIEW)
    }
  }

  function handleDiscard() {
    disablePolygonDraw()
    clearPreview()
    setStep(STEPS.IDLE)
    setNetwork(null)
    networkRef.current = null
    setError(null)
    setProgress('')
  }

  const isBusy = step === STEPS.FETCHING || step === STEPS.GENERATING || step === STEPS.SAVING

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 55, width: 340,
      background: 'rgba(10,18,36,0.97)',
      border: '1.5px solid #00e5ff44', borderRadius: 14,
      boxShadow: '0 0 32px rgba(0,229,255,0.15), 0 8px 32px rgba(0,0,0,0.6)',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      <style>{`@keyframes varinha-spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(0,229,255,0.06)', borderBottom: '1px solid #00e5ff22',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🪄</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#00e5ff', letterSpacing: '0.05em' }}>
              Varinha de Rede
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>OSM + IA de roteamento</div>
          </div>
        </div>
        <button onClick={() => { handleDiscard(); onClose?.() }} disabled={isBusy}
          style={{ background: 'none', border: 'none', color: '#64748b',
            cursor: isBusy ? 'not-allowed' : 'pointer', fontSize: 16, padding: '2px 4px' }}>
          ✕
        </button>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Erro */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#fca5a5', lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        {/* ── IDLE: configuração ── */}
        {step === STEPS.IDLE && (
          <>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              Desenhe uma área e a IA posicionará CTOs nas <strong style={{ color: '#e2e8f0' }}>ruas reais</strong> (OSM),
              priorizando esquinas e cobrindo toda a área. Numeração sequencial geográfica.
            </p>

            {/* Configurações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="Prefixo CTO">
                <input value={prefix}
                  onChange={e => setPrefix(e.target.value.trim().toUpperCase() || 'CTO')}
                  maxLength={10} style={inputStyle} />
              </Row>
              <Row label="Portas / CTO">
                <select value={capac} onChange={e => setCapac(Number(e.target.value))} style={selectStyle}>
                  {[8, 16, 32].map(n => <option key={n} value={n} style={{ background: '#0a1224' }}>{n} portas</option>)}
                </select>
              </Row>
              <Row label="Espaç. entre CTOs">
                <select value={spacingM} onChange={e => setSpacingM(Number(e.target.value))} style={selectStyle}>
                  {[40, 60, 80, 100, 120, 150, 200].map(m => (
                    <option key={m} value={m} style={{ background: '#0a1224' }}>~{m} m</option>
                  ))}
                </select>
              </Row>

              {/* Toggle rotas de distribuição */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => setGenDistRoutes(v => !v)}
                  style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: genDistRoutes ? '#f59e0b' : '#1e293b',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, left: genDistRoutes ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s',
                  }} />
                </button>
                <span style={{ fontSize: 11, color: genDistRoutes ? '#fbbf24' : '#475569' }}>
                  Gerar rotas de distribuição (MST)
                </span>
              </div>
              {genDistRoutes && (
                <div style={{ fontSize: 10, color: '#475569', paddingLeft: 46, marginTop: -4 }}>
                  Calcula o menor caminho de fibra para conectar todas as CTOs.
                </div>
              )}
            </div>

            <button onClick={handleStartDraw} style={primaryBtn}>
              <span style={{ fontSize: 15 }}>✏️</span>
              Desenhar Área no Mapa
            </button>
          </>
        )}

        {/* ── DRAWING ── */}
        {step === STEPS.DRAWING && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10,
              background: 'rgba(0,229,255,0.08)', border: '1px solid #00e5ff33',
              borderRadius: 8, padding: '10px 12px' }}>
              <span style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>✏️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#00e5ff', marginBottom: 3 }}>
                  Modo de desenho ativo
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                  Clique para adicionar vértices.<br/>
                  <strong style={{ color: '#e2e8f0' }}>Duplo-clique</strong> para fechar e gerar.
                </div>
              </div>
            </div>
            <button onClick={handleDiscard} style={cancelBtn}>Cancelar</button>
          </div>
        )}

        {/* ── FETCHING / GENERATING ── */}
        {(step === STEPS.FETCHING || step === STEPS.GENERATING) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2.5px solid #00e5ff33', borderTop: '2.5px solid #00e5ff',
                animation: 'varinha-spin 0.8s linear infinite', flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{progress || 'Processando…'}</span>
            </div>
            <ProgressBar pct={step === STEPS.GENERATING ? 75 : 35} />
            <div style={{ fontSize: 10, color: '#475569' }}>
              {step === STEPS.FETCHING ? 'Consultando OpenStreetMap…' : 'Algoritmo MST + Dijkstra…'}
            </div>
          </div>
        )}

        {/* ── PREVIEW / SAVING ── */}
        {(step === STEPS.PREVIEW || step === STEPS.SAVING) && network && (
          <>
            {/* Badge de fonte */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
              background: network.source === 'osm' ? 'rgba(0,229,255,0.1)' : 'rgba(99,102,241,0.1)',
              border: `1px solid ${network.source === 'osm' ? '#00e5ff44' : '#6366f144'}`,
              borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700,
              color: network.source === 'osm' ? '#00e5ff' : '#818cf8',
            }}>
              {network.source === 'osm' ? '🗺 Ruas reais (OSM) + IA' : '⊞ Grade + IA'}
            </div>

            {/* Métricas — grid 2×3 */}
            <div style={{
              background: 'rgba(0,229,255,0.05)', border: '1px solid #00e5ff22',
              borderRadius: 10, padding: '12px 14px',
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 8px',
            }}>
              <MetricItem label="CTOs"        value={network.metrics.totalCTOs}    icon="📡" color="#00e5ff" />
              <MetricItem label="Vias"        value={network.metrics.totalRoutes}  icon="〰️" color="#22d3ee" />
              {network.metrics.distRoutes > 0
                ? <MetricItem label="Dist."   value={network.metrics.distRoutes}   icon="🔀" color="#f59e0b" />
                : <MetricItem label="Cap. máx" value={`${network.metrics.totalClients}`} icon="👥" color="#a5f3fc" />
              }
              <MetricItem
                label="Total fibra"
                value={network.metrics.totalLengthM >= 1000
                  ? `${(network.metrics.totalLengthM / 1000).toFixed(1)} km`
                  : `${network.metrics.totalLengthM} m`}
                icon="📏" color="#67e8f9"
              />
              {network.metrics.distRoutes > 0 && (
                <MetricItem
                  label="Fibra dist."
                  value={network.metrics.distLengthM >= 1000
                    ? `${(network.metrics.distLengthM / 1000).toFixed(1)} km`
                    : `${network.metrics.distLengthM} m`}
                  icon="🔀" color="#fbbf24"
                />
              )}
              <MetricItem label="Cap. máx." value={`${network.metrics.totalClients} cli.`} icon="👥" color="#a5f3fc" />
            </div>

            {/* Legenda de cores */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <LegendItem color="#00e5ff" label="Via / Backbone" />
              <LegendItem color="#22d3ee" label="Ramal" dashed />
              {network.distRoutes?.length > 0 && (
                <LegendItem color="#f59e0b" label="Distribuição CTO" dashed />
              )}
              <LegendItem color="#00e5ff" circle label="CTOs" />
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={handleConfirm} disabled={step === STEPS.SAVING}
                style={{ ...primaryBtn, opacity: step === STEPS.SAVING ? 0.6 : 1,
                  cursor: step === STEPS.SAVING ? 'not-allowed' : 'pointer' }}>
                {step === STEPS.SAVING ? (
                  <>
                    <div style={{ width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid #00e5ff33', borderTop: '2px solid #00e5ff',
                      animation: 'varinha-spin 0.8s linear infinite' }} />
                    Salvando…
                  </>
                ) : <>💾 Confirmar e Salvar</>}
              </button>
              <button onClick={handleDiscard} disabled={step === STEPS.SAVING}
                style={{ ...cancelBtn, opacity: step === STEPS.SAVING ? 0.4 : 1 }}>
                🗑 Descartar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────
function MetricItem({ label, value, icon, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{icon} {label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 11, color: '#64748b', minWidth: 110 }}>{label}</label>
      {children}
    </div>
  )
}

function ProgressBar({ pct }) {
  return (
    <div style={{ height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 2, transition: 'width 0.5s ease',
        background: 'linear-gradient(90deg, #00e5ff, #22d3ee)', width: `${pct}%` }} />
    </div>
  )
}

function LegendItem({ color, label, dashed, circle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {circle ? (
        <div style={{ width: 10, height: 10, borderRadius: '50%',
          background: color, border: '2px solid #0f172a', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 20, height: 2, flexShrink: 0,
          background: color, opacity: dashed ? 0.7 : 1,
          borderTop: dashed ? `2px dashed ${color}` : `2px solid ${color}`, borderRadius: 1 }} />
      )}
      <span style={{ fontSize: 9, color: '#64748b' }}>{label}</span>
    </div>
  )
}

// ─── Estilos reutilizáveis ────────────────────────────────────────
const inputStyle = {
  flex: 1, background: 'rgba(255,255,255,0.05)',
  border: '1px solid #1e40af55', borderRadius: 6,
  color: '#e2e8f0', fontSize: 12, padding: '5px 8px', outline: 'none',
}
const selectStyle = {
  flex: 1, background: '#0d1526',
  border: '1px solid #1e40af55', borderRadius: 6,
  color: '#e2e8f0', fontSize: 12, padding: '5px 8px', outline: 'none', cursor: 'pointer',
}
const primaryBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '11px 16px', borderRadius: 10,
  background: 'rgba(0,229,255,0.12)', border: '1.5px solid #00e5ff66',
  color: '#00e5ff', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%',
  transition: 'all 0.15s',
}
const cancelBtn = {
  padding: '9px 16px', borderRadius: 10,
  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
  color: '#fca5a5', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%',
}
