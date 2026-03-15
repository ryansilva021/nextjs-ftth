'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMap }        from '@/hooks/useMap'
import { useMapLayers }  from '@/hooks/useMapLayers'
import { useMapEvents }  from '@/hooks/useMapEvents'
import { useGPS }        from '@/hooks/useGPS'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'

import BottomSheet   from '@/components/map/BottomSheet'
import LayerToggles  from '@/components/map/LayerToggles'

import { getCTOs, upsertCTO }   from '@/actions/ctos'
import { getCaixas, upsertCaixa } from '@/actions/caixas'
import { getRotas, upsertRota }  from '@/actions/rotas'
import { getPostes, upsertPoste } from '@/actions/postes'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DEFAULT_LAYER_TOGGLES = {
  ctos:      true,
  caixas:    true,
  rotas:     true,
  postes:    true,
  satellite: false,
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Mapa interativo FTTH com MapLibre GL.
 *
 * @param {{
 *   session: import('next-auth').Session,
 *   initialCTOs:   Array,
 *   initialCaixas: Array,
 *   initialRotas:  { type: 'FeatureCollection', features: Array },
 *   initialPostes: Array,
 * }} props
 */
export default function MapaFTTH({
  session,
  initialCTOs   = [],
  initialCaixas = [],
  initialRotas  = null,
  initialPostes = [],
}) {
  const containerRef = useRef(null)

  // ---- Dados do mapa (hidratados pelo servidor; recarregados após mutações) ----
  const [ctos,   setCTOs]   = useState(initialCTOs)
  const [caixas, setCaixas] = useState(initialCaixas)
  const [rotas,  setRotas]  = useState(initialRotas)
  const [postes, setPostes] = useState(initialPostes)
  const [loadingData, setLoadingData] = useState(false)

  // ---- Estado de UI ----
  const [selectedElement, setSelectedElement] = useState(null)
  const [layerToggles, setLayerToggles]       = useState(DEFAULT_LAYER_TOGGLES)

  // ---- Modo de adição de elementos no mapa ----
  const [addMode, setAddMode]           = useState(null) // null | 'cto' | 'caixa' | 'poste' | 'rota'
  const [addCoords, setAddCoords]       = useState(null) // { lng, lat } para ponto
  const [addRoutePoints, setAddRoutePoints] = useState([]) // [[lng,lat]...] para rota
  const [addForm, setAddForm]           = useState({})
  const [addFabOpen, setAddFabOpen]     = useState(false)
  const [addSaving, setAddSaving]       = useState(false)
  const [addErro, setAddErro]           = useState(null)

  // ---- Hooks do mapa ----
  const { map, mapLoaded } = useMap(containerRef, {
    center: [-46.633308, -23.55052],
    zoom:   14,
  })

  useMapLayers(map, mapLoaded, { ctos, caixas, rotas, postes }, layerToggles)

  const addModeRef = useRef(addMode)
  addModeRef.current = addMode

  const eventCallbacks = {
    onElementClick: useCallback(({ type, data }) => {
      if (addModeRef.current) return // ignora cliques em elementos durante add mode
      setSelectedElement({ type, data })
    }, []),
    onMapClick: useCallback((lngLat) => {
      const mode = addModeRef.current
      if (!mode) {
        setSelectedElement(null)
        return
      }
      if (mode === 'rota') {
        setAddRoutePoints((prev) => [...prev, [lngLat.lng, lngLat.lat]])
      } else {
        setAddCoords(lngLat)
      }
    }, []),
  }
  useMapEvents(map, mapLoaded, eventCallbacks)

  // ---- GPS ----
  const {
    tracking,
    error:       gpsError,
    followMode,
    setFollowMode,
    startTracking,
    stopTracking,
  } = useGPS(map)

  // ---- Offline queue ----
  const { isOnline, queueSize } = useOfflineQueue()

  // ---- Funções de dados ----
  const reloadData = useCallback(async () => {
    if (!session?.user?.projeto_id) return
    const projetoId = session.user.projeto_id
    setLoadingData(true)
    try {
      const [newCTOs, newCaixas, newRotas, newPostes] = await Promise.all([
        getCTOs(projetoId),
        getCaixas(projetoId),
        getRotas(projetoId),
        getPostes(projetoId),
      ])
      setCTOs(newCTOs)
      setCaixas(newCaixas)
      setRotas(newRotas)
      setPostes(newPostes)
    } catch (err) {
      console.error('[MapaFTTH] Erro ao recarregar dados:', err)
    } finally {
      setLoadingData(false)
    }
  }, [session])

  // ---- Toggles de camada ----
  const handleLayerToggle = useCallback((key, value) => {
    setLayerToggles((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSatelliteToggle = useCallback(() => {
    setLayerToggles((prev) => ({ ...prev, satellite: !prev.satellite }))
  }, [])

  // ---- Fechar bottom sheet ----
  const handleCloseSheet = useCallback(() => setSelectedElement(null), [])

  // ---- Ações disparadas pelo BottomSheet ----
  const handleAction = useCallback(({ type, data, action }) => {
    // Extensão futura: abrir modais de diagrama, reposicionamento, etc.
    console.info('[MapaFTTH] action:', action, type, data)
  }, [])

  // ---- GPS toggle handler ----
  const handleGPSToggle = useCallback(() => {
    if (tracking) {
      stopTracking()
    } else {
      startTracking()
      setFollowMode(true) // ativa follow mode junto para continuar seguindo após o flyTo
    }
  }, [tracking, startTracking, stopTracking, setFollowMode])

  const handleFollowToggle = useCallback(() => {
    setFollowMode((prev) => !prev)
  }, [setFollowMode])

  // ---- GPS automático: centraliza na localização do usuário ao abrir o mapa ----
  useEffect(() => {
    if (mapLoaded && !tracking) {
      startTracking()
      setFollowMode(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded])

  // ---- Recarregar dados do servidor ao montar (garante dados frescos após mutações) ----
  useEffect(() => {
    reloadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Cursor crosshair durante add mode (no container, não no canvas) ----
  // useMapEvents controla o cursor do canvas diretamente; aqui usamos o containerDiv
  // como fallback: quando canvas.cursor='', herda 'crosshair' do pai.
  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.style.cursor = addMode ? 'crosshair' : ''
  }, [addMode])

  // ---- Funções de add mode ----
  function enterAddMode(type) {
    setAddMode(type)
    setAddCoords(null)
    setAddRoutePoints([])
    setAddForm({ tipo: type === 'caixa' ? 'CDO' : undefined, capacidade: 16, tipoRota: 'RAMAL' })
    setAddErro(null)
    setAddFabOpen(false)
    setSelectedElement(null)
  }

  function cancelarAddMode() {
    setAddMode(null)
    setAddCoords(null)
    setAddRoutePoints([])
    setAddForm({})
    setAddErro(null)
  }

  async function salvarAddElement() {
    if (!addForm.id?.trim()) { setAddErro('ID obrigatório'); return }
    const projetoId = session?.user?.projeto_id
    setAddSaving(true)
    setAddErro(null)
    try {
      if (addMode === 'cto') {
        await upsertCTO({
          cto_id: addForm.id.trim(),
          projeto_id: projetoId,
          lat: addCoords.lat,
          lng: addCoords.lng,
          nome: addForm.nome || null,
          capacidade: addForm.capacidade || 16,
        })
      } else if (addMode === 'caixa') {
        await upsertCaixa({
          ce_id: addForm.id.trim(),
          projeto_id: projetoId,
          lat: addCoords.lat,
          lng: addCoords.lng,
          nome: addForm.nome || null,
          tipo: addForm.tipo || 'CDO',
        })
      } else if (addMode === 'poste') {
        await upsertPoste({
          poste_id: addForm.id.trim(),
          projeto_id: projetoId,
          lat: addCoords.lat,
          lng: addCoords.lng,
          nome: addForm.nome || null,
          tipo: 'simples',
          status: 'ativo',
        })
      } else if (addMode === 'rota') {
        await upsertRota({
          rota_id: addForm.id.trim(),
          projeto_id: projetoId,
          nome: addForm.nome || null,
          tipo: addForm.tipoRota || 'RAMAL',
          coordinates: addRoutePoints,
        })
      }
      await reloadData()
      cancelarAddMode()
    } catch (e) {
      setAddErro(e.message)
    } finally {
      setAddSaving(false)
    }
  }

  return (
    <div className="relative w-full h-full bg-[#0b1220]" style={{ minHeight: '100dvh' }}>
      {/* Container do mapa */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" aria-label="Mapa FTTH" role="application" />

      {/* Overlay: indicador offline */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-40
                     flex items-center gap-2 px-3 py-1.5 rounded-full
                     bg-yellow-500/90 text-yellow-950 text-xs font-semibold shadow"
        >
          <span className="w-2 h-2 rounded-full bg-yellow-950/60 inline-block" />
          Offline
          {queueSize > 0 && <span className="ml-1">({queueSize} na fila)</span>}
        </div>
      )}

      {/* Overlay: loading de dados */}
      {loadingData && (
        <div
          role="status"
          aria-label="Carregando dados do mapa"
          className="absolute top-3 right-14 z-40
                     px-3 py-1.5 rounded-full bg-zinc-900/80 text-zinc-300 text-xs shadow"
        >
          Carregando...
        </div>
      )}

      {/* Controles superiores: satélite + recarregar */}
      <div className="absolute top-3 left-3 z-40 flex flex-col gap-2 pointer-events-auto">
        {/* Toggle satélite */}
        <button
          onClick={handleSatelliteToggle}
          aria-pressed={layerToggles.satellite}
          aria-label="Alternar camada satélite"
          className={[
            'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shadow transition-all',
            layerToggles.satellite
              ? 'bg-sky-600/90 text-white border-sky-400'
              : 'bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-zinc-500',
          ].join(' ')}
        >
          <SatelliteIcon />
          Satélite
        </button>

        {/* Botão recarregar */}
        <button
          onClick={reloadData}
          disabled={loadingData}
          aria-label="Recarregar dados do mapa"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shadow transition-all
                     bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-zinc-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshIcon spin={loadingData} />
          Recarregar
        </button>
      </div>

      {/* Toggles de camadas - canto inferior esquerdo (acima do scale) */}
      <div className="absolute bottom-10 left-0 z-40 pointer-events-auto">
        <LayerToggles toggles={layerToggles} onToggle={handleLayerToggle} />
      </div>

      {/* Botões GPS - canto inferior direito */}
      <div className="absolute bottom-20 right-3 z-40 flex flex-col gap-2 pointer-events-auto">
        {/* Follow mode (só visível quando tracking) */}
        {tracking && (
          <button
            onClick={handleFollowToggle}
            aria-pressed={followMode}
            aria-label={followMode ? 'Parar de seguir posição' : 'Seguir posição'}
            className={[
              'w-10 h-10 flex items-center justify-center rounded-full shadow-lg border transition-all',
              followMode
                ? 'bg-blue-600 text-white border-blue-400'
                : 'bg-zinc-900/90 text-zinc-300 border-zinc-700 hover:border-zinc-500',
            ].join(' ')}
          >
            <FollowIcon />
          </button>
        )}

        {/* GPS on/off */}
        <button
          onClick={handleGPSToggle}
          aria-pressed={tracking}
          aria-label={tracking ? 'Parar rastreamento GPS' : 'Iniciar rastreamento GPS'}
          className={[
            'w-10 h-10 flex items-center justify-center rounded-full shadow-lg border transition-all',
            tracking
              ? 'bg-blue-600 text-white border-blue-400 animate-pulse'
              : 'bg-zinc-900/90 text-zinc-300 border-zinc-700 hover:border-zinc-500',
          ].join(' ')}
        >
          <GPSIcon />
        </button>

        {/* Erro GPS */}
        {gpsError && (
          <div
            role="alert"
            className="absolute bottom-full mb-2 right-0 w-48
                       bg-red-900/90 text-red-200 text-xs px-3 py-2 rounded-lg shadow"
          >
            {gpsError}
          </div>
        )}
      </div>

      {/* Bottom sheet de elemento selecionado */}
      {!addMode && (
        <BottomSheet
          element={selectedElement}
          onClose={handleCloseSheet}
          session={session}
          onAction={handleAction}
        />
      )}

      {/* FAB de adição — só para admin/superadmin */}
      {(session?.user?.role === 'admin' || session?.user?.role === 'superadmin') && !addMode && (
        <div className="absolute bottom-36 right-3 z-40 flex flex-col items-end gap-2 pointer-events-auto">
          {addFabOpen && (
            <div className="flex flex-col gap-1.5 mb-1">
              {[
                { type: 'cto',   label: 'CTO',    color: '#0284c7' },
                { type: 'caixa', label: 'CE/CDO',  color: '#7c3aed' },
                { type: 'poste', label: 'Poste',   color: '#d97706' },
                { type: 'rota',  label: 'Rota',    color: '#059669' },
              ].map(({ type, label, color }) => (
                <button
                  key={type}
                  onClick={() => enterAddMode(type)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg"
                  style={{ backgroundColor: color }}
                >
                  + {label}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setAddFabOpen((v) => !v)}
            aria-label="Adicionar elemento no mapa"
            className="w-12 h-12 flex items-center justify-center rounded-full shadow-xl text-white text-xl font-bold transition-all"
            style={{ backgroundColor: addFabOpen ? '#475569' : '#0284c7', border: '2px solid rgba(255,255,255,0.2)' }}
          >
            {addFabOpen ? '✕' : '+'}
          </button>
        </div>
      )}

      {/* Banner de instrução durante add mode */}
      {addMode && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-lg flex items-center gap-3"
          style={{ backgroundColor: 'rgba(2,132,199,0.95)', border: '1px solid #0369a1' }}
        >
          {addMode === 'rota'
            ? `🗺️ Clique no mapa para traçar a rota • ${addRoutePoints.length} pontos`
            : addCoords
            ? '✓ Local selecionado — preencha os dados abaixo'
            : '📍 Clique no mapa para posicionar'}
          <button onClick={cancelarAddMode} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Painel de formulário add mode */}
      {addMode && (addCoords || (addMode === 'rota' && addRoutePoints.length >= 2)) && (
        <div
          className="absolute bottom-0 left-0 right-0 z-50 p-4 rounded-t-2xl shadow-2xl"
          style={{ backgroundColor: '#111827', borderTop: '1px solid #1f2937' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">
              {{ cto: 'Nova CTO', caixa: 'Nova CE/CDO', poste: 'Novo Poste', rota: 'Nova Rota' }[addMode]}
            </h3>
            <button onClick={cancelarAddMode} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase">ID *</label>
              <input
                value={addForm.id ?? ''}
                onChange={(e) => setAddForm((p) => ({ ...p, id: e.target.value }))}
                placeholder={addMode === 'cto' ? 'ex: CTO-001' : addMode === 'caixa' ? 'ex: CDO-001' : addMode === 'poste' ? 'ex: PT-001' : 'ex: RT-001'}
                className="rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                style={{ backgroundColor: '#0b1220', border: '1px solid #1f2937' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase">Nome</label>
              <input
                value={addForm.nome ?? ''}
                onChange={(e) => setAddForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Opcional"
                className="rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                style={{ backgroundColor: '#0b1220', border: '1px solid #1f2937' }}
              />
            </div>

            {addMode === 'cto' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase">Capacidade</label>
                <select
                  value={addForm.capacidade ?? 16}
                  onChange={(e) => setAddForm((p) => ({ ...p, capacidade: parseInt(e.target.value) }))}
                  className="rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  style={{ backgroundColor: '#0b1220', border: '1px solid #1f2937' }}
                >
                  {[8,16,24,32,48,64].map((c) => <option key={c} value={c}>{c} portas</option>)}
                </select>
              </div>
            )}

            {addMode === 'caixa' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase">Tipo</label>
                <select
                  value={addForm.tipo ?? 'CDO'}
                  onChange={(e) => setAddForm((p) => ({ ...p, tipo: e.target.value }))}
                  className="rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  style={{ backgroundColor: '#0b1220', border: '1px solid #1f2937' }}
                >
                  <option value="CDO">CDO</option>
                  <option value="CE">CE</option>
                </select>
              </div>
            )}

            {addMode === 'rota' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase">Tipo</label>
                <select
                  value={addForm.tipoRota ?? 'RAMAL'}
                  onChange={(e) => setAddForm((p) => ({ ...p, tipoRota: e.target.value }))}
                  className="rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  style={{ backgroundColor: '#0b1220', border: '1px solid #1f2937' }}
                >
                  <option value="BACKBONE">BACKBONE</option>
                  <option value="RAMAL">RAMAL</option>
                  <option value="DROP">DROP</option>
                </select>
              </div>
            )}
          </div>

          {addErro && (
            <p className="text-xs text-red-400 mb-3">{addErro}</p>
          )}

          <div className="flex gap-3">
            {addMode === 'rota' && (
              <button
                onClick={() => setAddRoutePoints((p) => p.slice(0, -1))}
                disabled={addRoutePoints.length === 0}
                className="flex-1 py-2 rounded-lg text-sm text-slate-300 disabled:opacity-40"
                style={{ border: '1px solid #1f2937' }}
              >
                Desfazer ponto
              </button>
            )}
            <button
              onClick={salvarAddElement}
              disabled={addSaving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#0284c7' }}
            >
              {addSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ícones SVG inline (sem dependência de lib de ícones)
// ---------------------------------------------------------------------------

function SatelliteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m17 3 4 4-9.95 9.95-4-4L17 3Z" />
      <path d="M7 13.95 3 18l4 4 4.04-4.04" />
      <path d="m14 7 3 3" />
      <path d="m3 21 3-3" />
      <path d="M16 6 8.5 13.5" />
    </svg>
  )
}

function RefreshIcon({ spin }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      aria-hidden="true"
      style={spin ? { animation: 'spin 1s linear infinite' } : undefined}
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </svg>
  )
}

function GPSIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  )
}

function FollowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  )
}
