'use client'

/**
 * src/components/map/VarinhaNetworkTool.js
 * Painel de geração automática de rede FTTH — tema do projeto (amber/brown).
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
import { importCTOs, importCDOsBulk, importRotas } from '@/actions/imports'
import { getOLTs } from '@/actions/olts'

// ── Tema do projeto ──────────────────────────────────────────────
const T = {
  canvas:       '#2a2218',
  panelBg:      'rgba(38,28,16,0.98)',
  panelBorder:  '#ff800055',
  accent:       '#ff8000',
  accentDim:    '#ff800033',
  accentHover:  'rgba(255,128,0,0.18)',
  text:         '#f0e4d0',
  muted:        '#c8a878',
  subtle:       '#7a6040',
  inputBg:      'rgba(255,255,255,0.05)',
  inputBorder:  '#ff800033',
  danger:       '#ef4444',
  dangerDim:    'rgba(239,68,68,0.12)',
  success:      '#22c55e',
  cdoColor:     '#ff8000',
  ctoColor:     '#22d3ee',
  distColor:    '#c084fc',
  bbColor:      '#ff8000',
}

const STEPS = {
  IDLE:       'idle',
  DRAWING:    'drawing',
  FETCHING:   'fetching',
  GENERATING: 'generating',
  PREVIEW:    'preview',
  SAVING:     'saving',
}

export default function VarinhaNetworkTool({ projetoId, onSaved, onClose }) {
  const [step,          setStep]         = useState(STEPS.IDLE)
  const [network,       setNetwork]      = useState(null)
  const [error,         setError]        = useState(null)
  const [progress,      setProgress]     = useState('')

  const [prefix,        setPrefix]       = useState('CTO')
  const [capac,         setCapac]        = useState(16)
  const [spacingM,      setSpacingM]     = useState(80)
  const [genDistRoutes, setGenDistRoutes] = useState(true)
  const [mode,          setMode]         = useState('ctos')
  const [cdoPrefix,     setCdoPrefix]    = useState('CDO')
  const [ctosPerCdo,    setCtosPerCdo]   = useState(8)
  const [selectedOlt,   setSelectedOlt]  = useState(null)
  const [olts,          setOlts]         = useState([])
  const [oltsLoading,   setOltsLoading]  = useState(false)

  const networkRef = useRef(null)

  useEffect(() => {
    if (mode !== 'layers' || !projetoId || olts.length > 0) return
    setOltsLoading(true)
    getOLTs(projetoId)
      .then(data => setOlts(data ?? []))
      .catch(() => setOlts([]))
      .finally(() => setOltsLoading(false))
  }, [mode, projetoId])

  useEffect(() => () => { disablePolygonDraw(); clearPreview() }, [])

  function handleStartDraw() {
    setStep(STEPS.DRAWING)
    setError(null)
    setNetwork(null)
    clearPreview()
    enablePolygonDraw(handlePolygonComplete)
  }

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
      const layersMode = mode === 'layers'
      const result = await autoBuildNetwork(coords, {
        spacingM,
        capacidade: capac,
        prefix,
        genDistRoutes,
        genCDOs:    layersMode,
        ctosPerCdo: layersMode ? ctosPerCdo : 8,
        cdoPrefix:  layersMode ? cdoPrefix  : 'CDO',
        oltId:      layersMode && selectedOlt ? selectedOlt.id  : null,
        oltLat:     layersMode && selectedOlt ? selectedOlt.lat : null,
        oltLng:     layersMode && selectedOlt ? selectedOlt.lng : null,
        onProgress: (msg) => {
          setProgress(msg)
          if (msg.includes('posicionando') || msg.includes('CTOs') ||
              msg.includes('distribuição') || msg.includes('CDO')) {
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
      renderPreviewNetwork({
        routes:         result.routes,
        backboneRoutes: result.backboneRoutes,
        distRoutes:     result.distRoutes,
        ctos:           result.ctos,
        cdos:           result.cdos,
      })
      setStep(STEPS.PREVIEW)
    } catch (e) {
      setStep(STEPS.IDLE)
      setError(e.message ?? 'Erro ao gerar rede.')
      clearPreview()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capac, prefix, spacingM, genDistRoutes, mode, cdoPrefix, ctosPerCdo, selectedOlt])

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
        cdo_id: c.cdo_id ?? null, porta_cdo: c.porta_cdo ?? null,
      }))
      const allRoutes    = [...net.routes, ...net.backboneRoutes, ...net.distRoutes]
      const rotaFeatures = allRoutes.map(r => ({
        rota_id: r.rota_id, nome: r.nome, tipo: r.tipo, coordinates: r.coordinates,
      }))

      const promises = [
        importCTOs(ctoRows, projetoId),
        rotaFeatures.length > 0
          ? importRotas(rotaFeatures, projetoId)
          : Promise.resolve({ inserted: 0, modified: 0 }),
      ]
      if (net.cdos?.length > 0) promises.push(importCDOsBulk(net.cdos, projetoId))

      const [ctoRes, rotaRes, cdoRes] = await Promise.all(promises)
      clearPreview()
      setStep(STEPS.IDLE)
      setNetwork(null)
      networkRef.current = null
      onSaved?.({
        ctos:   ctoRes.inserted + ctoRes.modified,
        routes: rotaRes.inserted + rotaRes.modified,
        cdos:   cdoRes ? cdoRes.inserted + cdoRes.modified : 0,
      })
    } catch (e) {
      setError(e.message)
      setStep(STEPS.PREVIEW)
    }
  }

  function handleDiscard() {
    disablePolygonDraw(); clearPreview()
    setStep(STEPS.IDLE); setNetwork(null)
    networkRef.current = null; setError(null); setProgress('')
  }

  const isBusy   = step === STEPS.FETCHING || step === STEPS.GENERATING || step === STEPS.SAVING
  const isLayers = mode === 'layers'

  return (
    <div style={{
      position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 55, width: 360,
      background: T.panelBg,
      border: `1.5px solid ${T.panelBorder}`,
      borderRadius: 14,
      boxShadow: `0 0 32px ${T.accentDim}, 0 8px 32px rgba(0,0,0,0.7)`,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      overflow: 'hidden',
    }}>
      <style>{`@keyframes vr-spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px',
        background: `linear-gradient(135deg, rgba(255,128,0,0.12), rgba(255,128,0,0.04))`,
        borderBottom: `1px solid ${T.panelBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,128,0,0.15)', border: `1px solid ${T.panelBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>🪄</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, letterSpacing: '0.04em' }}>
              Varinha de Rede
            </div>
            <div style={{ fontSize: 10, color: T.subtle }}>OSM + geração automática</div>
          </div>
        </div>
        <button onClick={() => { handleDiscard(); onClose?.() }} disabled={isBusy} style={{
          background: 'none', border: 'none', color: T.subtle,
          cursor: isBusy ? 'not-allowed' : 'pointer', fontSize: 16, padding: '3px 5px',
          borderRadius: 5, lineHeight: 1,
        }}>✕</button>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Erro ── */}
        {error && (
          <div style={{
            background: T.dangerDim, border: `1px solid ${T.danger}44`,
            borderRadius: 8, padding: '8px 12px', fontSize: 12,
            color: '#fca5a5', lineHeight: 1.5,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* ── IDLE ── */}
        {step === STEPS.IDLE && (
          <>
            {/* Seletor de modo */}
            <div style={{
              display: 'flex', gap: 4,
              background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.panelBorder}`,
              borderRadius: 9, padding: 3,
            }}>
              {[
                { value: 'ctos',   label: '📡 Só CTOs'    },
                { value: 'layers', label: '🏗 Em Camadas' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setMode(opt.value)} style={{
                  flex: 1, padding: '6px 10px', borderRadius: 6, border: 'none',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: mode === opt.value ? T.accentHover : 'transparent',
                  color:      mode === opt.value ? T.accent : T.subtle,
                  transition: 'all 0.15s',
                  boxShadow:  mode === opt.value ? `inset 0 0 0 1px ${T.panelBorder}` : 'none',
                }}>{opt.label}</button>
              ))}
            </div>

            {/* Config comum */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <ConfigRow label="Prefixo CTO">
                <input value={prefix}
                  onChange={e => setPrefix(e.target.value.trim().toUpperCase() || 'CTO')}
                  maxLength={10} style={inputSt} />
              </ConfigRow>
              <ConfigRow label="Portas / CTO">
                <select value={capac} onChange={e => setCapac(Number(e.target.value))} style={selectSt}>
                  {[8, 16, 32].map(n => <option key={n} value={n} style={{ background: '#1a1208' }}>{n} portas</option>)}
                </select>
              </ConfigRow>
              <ConfigRow label="Espaç. entre CTOs">
                <select value={spacingM} onChange={e => setSpacingM(Number(e.target.value))} style={selectSt}>
                  {[40, 60, 80, 100, 120, 150, 200].map(m => (
                    <option key={m} value={m} style={{ background: '#1a1208' }}>~{m} m</option>
                  ))}
                </select>
              </ConfigRow>
            </div>

            {/* Config camadas */}
            {isLayers && (
              <div style={{
                background: 'rgba(255,128,0,0.06)',
                border: `1px solid ${T.panelBorder}`,
                borderRadius: 10, padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: T.accent, marginBottom: 1,
                }}>
                  ◆ Camada CDO
                </div>

                <ConfigRow label="Prefixo CDO">
                  <input value={cdoPrefix}
                    onChange={e => setCdoPrefix(e.target.value.trim().toUpperCase() || 'CDO')}
                    maxLength={10} style={inputSt} />
                </ConfigRow>

                <ConfigRow label="CTOs por CDO">
                  <select value={ctosPerCdo} onChange={e => setCtosPerCdo(Number(e.target.value))} style={selectSt}>
                    {[4, 6, 8, 12, 16, 24].map(n => (
                      <option key={n} value={n} style={{ background: '#1a1208' }}>{n} CTOs</option>
                    ))}
                  </select>
                </ConfigRow>

                <ConfigRow label="OLT (backbone)">
                  {oltsLoading
                    ? <span style={{ fontSize: 11, color: T.subtle }}>carregando…</span>
                    : (
                      <select
                        value={selectedOlt?.id ?? ''}
                        onChange={e => {
                          const olt = olts.find(o => o.id === e.target.value) ?? null
                          setSelectedOlt(olt ? { id: olt.id, nome: olt.nome, lat: olt.lat, lng: olt.lng } : null)
                        }}
                        style={selectSt}
                      >
                        <option value="" style={{ background: '#1a1208' }}>— sem backbone —</option>
                        {olts.map(o => (
                          <option key={o.id ?? o._id} value={o.id} style={{ background: '#1a1208' }}>
                            {o.nome ?? o.id}
                          </option>
                        ))}
                      </select>
                    )
                  }
                </ConfigRow>

                {/* Diagrama de camadas */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
                  background: 'rgba(0,0,0,0.25)', borderRadius: 7,
                  padding: '7px 10px', marginTop: 2,
                }}>
                  {selectedOlt && (
                    <>
                      <LayerTag color="#22d3ee" label="OLT" />
                      <FlowArrow color={T.bbColor} label="backbone" />
                    </>
                  )}
                  <LayerTag color={T.cdoColor} label="CDO" />
                  <FlowArrow color={T.distColor} label="dist." />
                  <LayerTag color={T.ctoColor} label="CTO" />
                  <FlowArrow color="#4ade80" label="ramal" />
                  <LayerTag color="#86efac" label="ONUs" />
                </div>
              </div>
            )}

            {/* Toggle rotas distribuição (modo plano) */}
            {!isLayers && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Toggle active={genDistRoutes} onToggle={() => setGenDistRoutes(v => !v)} />
                <span style={{ fontSize: 11, color: genDistRoutes ? T.muted : T.subtle }}>
                  Gerar rotas de distribuição (MST)
                </span>
              </div>
            )}

            <button onClick={handleStartDraw} style={primaryBtnSt}>
              ✏ Desenhar Área no Mapa
            </button>
          </>
        )}

        {/* ── DRAWING ── */}
        {step === STEPS.DRAWING && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: T.accentHover, border: `1px solid ${T.panelBorder}`,
              borderRadius: 9, padding: '10px 13px',
            }}>
              <span style={{ fontSize: 20, lineHeight: 1, marginTop: 1 }}>✏️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, marginBottom: 3 }}>
                  Modo de desenho ativo
                </div>
                <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.55 }}>
                  Clique para adicionar vértices.<br/>
                  <strong style={{ color: T.text }}>Duplo-clique</strong> para fechar e gerar.
                </div>
              </div>
            </div>
            <button onClick={handleDiscard} style={cancelBtnSt}>Cancelar</button>
          </div>
        )}

        {/* ── FETCHING / GENERATING ── */}
        {(step === STEPS.FETCHING || step === STEPS.GENERATING) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: `2.5px solid ${T.accentDim}`, borderTopColor: T.accent,
                animation: 'vr-spin 0.8s linear infinite', flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: T.muted }}>{progress || 'Processando…'}</span>
            </div>
            <div style={{ height: 3, background: 'rgba(0,0,0,0.3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2, transition: 'width 0.5s ease',
                background: `linear-gradient(90deg, ${T.accent}, #fbbf24)`,
                width: `${step === STEPS.GENERATING ? 75 : 35}%`,
              }} />
            </div>
            <div style={{ fontSize: 10, color: T.subtle }}>
              {step === STEPS.FETCHING ? 'Consultando OpenStreetMap…' : 'Calculando camadas de rede…'}
            </div>
          </div>
        )}

        {/* ── PREVIEW / SAVING ── */}
        {(step === STEPS.PREVIEW || step === STEPS.SAVING) && network && (
          <>
            {/* Badge fonte */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
              background: T.accentHover, border: `1px solid ${T.panelBorder}`,
              borderRadius: 20, padding: '3px 11px', fontSize: 10, fontWeight: 700, color: T.accent,
            }}>
              {network.source === 'osm' ? '🗺 Ruas reais (OSM) + IA' : '⊞ Grade automática'}
            </div>

            {/* Métricas */}
            <div style={{
              background: 'rgba(0,0,0,0.25)', border: `1px solid ${T.panelBorder}`,
              borderRadius: 10, padding: '12px 14px',
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 8px',
            }}>
              {network.metrics.totalCDOs > 0 && (
                <Metric label="CDOs"      value={network.metrics.totalCDOs}    icon="◆" color={T.cdoColor} />
              )}
              <Metric label="CTOs"        value={network.metrics.totalCTOs}    icon="●" color={T.ctoColor} />
              <Metric label="Vias"        value={network.metrics.totalRoutes}  icon="〰" color={T.muted} />
              {network.metrics.backboneRoutes > 0
                ? <Metric label="Backbone" value={network.metrics.backboneRoutes} icon="⚡" color={T.accent} />
                : network.metrics.distRoutes > 0
                  ? <Metric label="Dist." value={network.metrics.distRoutes} icon="⟁" color={T.distColor} />
                  : null
              }
              <Metric
                label="Cabo total"
                value={network.metrics.totalLengthM >= 1000
                  ? `${(network.metrics.totalLengthM / 1000).toFixed(1)} km`
                  : `${network.metrics.totalLengthM} m`}
                icon="📏" color={T.muted}
              />
              <Metric label="Cap. máx." value={`${network.metrics.totalClients}`} icon="👥" color={T.subtle} />
            </div>

            {/* Legenda */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {network.metrics.backboneRoutes > 0 && (
                <LegendLine color={T.bbColor}   label="Backbone OLT→CDO" />
              )}
              {network.metrics.totalCDOs > 0 && (
                <>
                  <LegendLine color={T.distColor} label="Distribuição CDO→CTO" dashed />
                  <LegendDot  color={T.cdoColor}  label="CDOs" diamond />
                </>
              )}
              {network.metrics.distRoutes > 0 && network.metrics.totalCDOs === 0 && (
                <LegendLine color="#f59e0b" label="Distribuição" dashed />
              )}
              <LegendLine color={T.ctoColor} label="Vias / Infra" dashed />
              <LegendDot  color={T.ctoColor} label="CTOs" />
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={handleConfirm} disabled={step === STEPS.SAVING} style={{
                ...primaryBtnSt,
                opacity: step === STEPS.SAVING ? 0.65 : 1,
                cursor:  step === STEPS.SAVING ? 'not-allowed' : 'pointer',
              }}>
                {step === STEPS.SAVING ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-block', width: 13, height: 13, borderRadius: '50%',
                      border: `2px solid ${T.accentDim}`, borderTopColor: T.accent,
                      animation: 'vr-spin 0.8s linear infinite',
                    }} />
                    Salvando…
                  </span>
                ) : '💾 Confirmar e Salvar'}
              </button>
              <button onClick={handleDiscard} disabled={step === STEPS.SAVING} style={{
                ...cancelBtnSt, opacity: step === STEPS.SAVING ? 0.4 : 1,
              }}>
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

function Metric({ label, value, icon, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#7a6040', marginBottom: 2 }}>{icon} {label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function ConfigRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 11, color: '#7a6040', minWidth: 112 }}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ active, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
      background: active ? T.accent : '#3a2c18',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 2, left: active ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

function LayerTag({ color, label }) {
  return (
    <div style={{
      padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
      background: color + '22', border: `1px solid ${color}55`, color, flexShrink: 0,
    }}>
      {label}
    </div>
  )
}

function FlowArrow({ color, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <div style={{ fontSize: 8, color, marginBottom: 1, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ color, fontSize: 11, lineHeight: 1 }}>→</div>
    </div>
  )
}

function LegendLine({ color, label, dashed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <svg width={20} height={8}>
        <line x1={0} y1={4} x2={20} y2={4}
          stroke={color} strokeWidth={dashed ? 1.5 : 2}
          strokeDasharray={dashed ? '5,3' : undefined} />
      </svg>
      <span style={{ fontSize: 9, color: T.subtle }}>{label}</span>
    </div>
  )
}

function LegendDot({ color, label, diamond }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {diamond
        ? <svg width={12} height={12} viewBox="-6 -6 12 12">
            <polygon points="0,-5 5,0 0,5 -5,0" fill={color} stroke="#1a1208" strokeWidth="1.5" />
          </svg>
        : <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, border: '1.5px solid #1a1208' }} />
      }
      <span style={{ fontSize: 9, color: T.subtle }}>{label}</span>
    </div>
  )
}

// ─── Estilos inline reutilizáveis ─────────────────────────────────

const inputSt = {
  flex: 1, background: T.inputBg,
  border: `1px solid ${T.inputBorder}`, borderRadius: 6,
  color: T.text, fontSize: 12, padding: '5px 8px', outline: 'none',
}

const selectSt = {
  flex: 1, background: '#1a1208',
  border: `1px solid ${T.inputBorder}`, borderRadius: 6,
  color: T.text, fontSize: 12, padding: '5px 8px', outline: 'none', cursor: 'pointer',
}

const primaryBtnSt = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '11px 16px', borderRadius: 10, width: '100%',
  background: T.accentHover, border: `1.5px solid ${T.accent}88`,
  color: T.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  transition: 'all 0.15s',
}

const cancelBtnSt = {
  padding: '9px 16px', borderRadius: 10, width: '100%',
  background: T.dangerDim, border: `1px solid ${T.danger}33`,
  color: '#fca5a5', fontSize: 12, fontWeight: 600, cursor: 'pointer',
}
