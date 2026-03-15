'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  projetoId: projetoIdProp,
  userRole: userRoleProp,
  initialCTOs   = [],
  initialCaixas = [],
  initialRotas  = null,
  initialPostes = [],
}) {
  const containerRef = useRef(null)
  const router = useRouter()

  // Suporta tanto session (legado) quanto projetoId/userRole diretos
  const projetoId = session?.user?.projeto_id ?? projetoIdProp
  const userRole  = session?.user?.role ?? userRoleProp

  // ---- Estado de reposicionamento ----
  const [reposicionandoEl, setReposicionandoEl] = useState(null) // { type, data }

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

  const reposicionandoRef = useRef(reposicionandoEl)
  reposicionandoRef.current = reposicionandoEl

  const eventCallbacks = {
    onElementClick: useCallback(({ type, data }) => {
      if (addModeRef.current) return
      if (reposicionandoRef.current) return // ignora cliques em elementos durante reposicionamento
      setSelectedElement({ type, data })
    }, []),
    onMapClick: useCallback(async (lngLat) => {
      const mode = addModeRef.current
      const repos = reposicionandoRef.current

      // Reposicionamento: salvar nova posição
      if (repos) {
        const { type, data } = repos
        try {
          if (type === 'cto') {
            await upsertCTO({ cto_id: data.cto_id, projeto_id: projetoId, lat: lngLat.lat, lng: lngLat.lng })
          } else if (type === 'caixa') {
            const ce_id = data.id ?? data.ce_id
            await upsertCaixa({ ce_id, projeto_id: projetoId, lat: lngLat.lat, lng: lngLat.lng })
          } else if (type === 'poste') {
            await upsertPoste({ poste_id: data.poste_id, projeto_id: projetoId, lat: lngLat.lat, lng: lngLat.lng })
          }
          await reloadData()
        } catch (err) {
          console.error('[MapaFTTH] Erro ao reposicionar:', err)
        }
        setReposicionandoEl(null)
        return
      }

      if (!mode) {
        setSelectedElement(null)
        return
      }
      if (mode === 'rota') {
        setAddRoutePoints((prev) => [...prev, [lngLat.lng, lngLat.lat]])
      } else {
        setAddCoords(lngLat)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projetoId]),
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
    if (!projetoId) return
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
  }, [projetoId])

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
    if (action === 'reposicionar') {
      setReposicionandoEl({ type, data })
      setSelectedElement(null)
    } else if (action === 'editar') {
      router.push('/admin/campo')
    }
  }, [router])

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

  // ---- Cursor crosshair durante add mode ou reposicionamento ----
  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.style.cursor = (addMode || reposicionandoEl) ? 'crosshair' : ''
  }, [addMode, reposicionandoEl])

  // ---- Preview de rota em tempo real ----
  useEffect(() => {
    if (!map || !mapLoaded) return
    const SOURCE = 'draw-preview-route'
    const LAYER_LINE = 'draw-preview-line'
    const LAYER_DOTS = 'draw-preview-dots'

    if (addMode !== 'rota' || addRoutePoints.length < 1) {
      // Remove preview sources/layers quando não está em modo rota
      if (map.getLayer(LAYER_LINE)) map.removeLayer(LAYER_LINE)
      if (map.getLayer(LAYER_DOTS)) map.removeLayer(LAYER_DOTS)
      if (map.getSource(SOURCE)) map.removeSource(SOURCE)
      return
    }

    const geojson = {
      type: 'FeatureCollection',
      features: [
        ...(addRoutePoints.length >= 2 ? [{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: addRoutePoints },
          properties: {},
        }] : []),
        ...addRoutePoints.map((pt) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pt },
          properties: {},
        })),
      ],
    }

    const tipoRota = addForm.tipoRota || 'RAMAL'
    const routeColor = tipoRota === 'BACKBONE' ? '#6366f1' : tipoRota === 'DROP' ? '#22c55e' : '#f97316'

    if (map.getSource(SOURCE)) {
      map.getSource(SOURCE).setData(geojson)
      if (map.getLayer(LAYER_LINE)) {
        map.setPaintProperty(LAYER_LINE, 'line-color', routeColor)
      }
    } else {
      map.addSource(SOURCE, { type: 'geojson', data: geojson })
      map.addLayer({
        id: LAYER_LINE,
        type: 'line',
        source: SOURCE,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': routeColor,
          'line-width': 3,
          'line-dasharray': [4, 2],
          'line-opacity': 0.9,
        },
      })
      map.addLayer({
        id: LAYER_DOTS,
        type: 'circle',
        source: SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': routeColor,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
    }

    return () => {
      // Cleanup ao desmontar
      if (map.getLayer(LAYER_LINE)) map.removeLayer(LAYER_LINE)
      if (map.getLayer(LAYER_DOTS)) map.removeLayer(LAYER_DOTS)
      if (map.getSource(SOURCE)) map.removeSource(SOURCE)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapLoaded, addMode, addRoutePoints, addForm.tipoRota])

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
    <div className="relative w-full h-full bg-[#0b1220]">
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

      {/* Banner de reposicionamento */}
      {reposicionandoEl && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold shadow-lg flex items-center gap-3 whitespace-nowrap"
          style={{ backgroundColor: 'rgba(8,13,28,0.95)', border: '1px solid rgba(249,115,22,0.5)', color: '#fdba74' }}
        >
          <span>📍</span>
          <span>Clique no mapa para nova posição de <strong>{reposicionandoEl.data?.nome || reposicionandoEl.data?.cto_id || reposicionandoEl.data?.poste_id || reposicionandoEl.data?.ce_id}</strong></span>
          <button onClick={() => setReposicionandoEl(null)} style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 4 }} className="hover:text-white transition-colors">✕</button>
        </div>
      )}

      {/* Bottom sheet de elemento selecionado */}
      {!addMode && !reposicionandoEl && (
        <BottomSheet
          element={selectedElement}
          onClose={handleCloseSheet}
          userRole={userRole}
          onAction={handleAction}
        />
      )}

      {/* FAB de adição — só para admin/superadmin */}
      {(userRole === 'admin' || userRole === 'superadmin') && !addMode && (
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
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-lg flex items-center gap-3 whitespace-nowrap"
          style={{ backgroundColor: 'rgba(8,13,28,0.95)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          {addMode === 'rota'
            ? <>
                <span style={{ color: '#f97316' }}>〰️</span>
                <span>{addRoutePoints.length === 0 ? 'Clique no mapa para iniciar a rota' : `${addRoutePoints.length} ${addRoutePoints.length === 1 ? 'ponto' : 'pontos'} — continue clicando`}</span>
              </>
            : addCoords
            ? <><span style={{ color: '#22c55e' }}>✓</span><span>Local selecionado — preencha os dados</span></>
            : <><span>📍</span><span>Clique no mapa para posicionar</span></>}
          <button onClick={cancelarAddMode} style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 4 }} className="hover:text-white transition-colors">✕</button>
        </div>
      )}

      {/* Painel de formulário add mode */}
      {addMode && (addCoords || (addMode === 'rota' && addRoutePoints.length >= 2)) && (
        <div
          className="absolute bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl"
          style={{ backgroundColor: 'rgba(8,13,28,0.98)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </div>

          <div className="px-4 pb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>
                {{ cto: 'Nova CTO', caixa: 'Nova CE/CDO', poste: 'Novo Poste', rota: 'Nova Rota' }[addMode]}
              </h3>
              <button onClick={cancelarAddMode} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 20, lineHeight: 1 }} className="hover:text-white transition-colors">✕</button>
            </div>

            {/* Tipo chips para rota — antes dos campos */}
            {addMode === 'rota' && (
              <div className="flex gap-2 mb-4">
                {[
                  { v: 'BACKBONE', cor: '#6366f1', desc: 'Principal' },
                  { v: 'RAMAL',    cor: '#f97316', desc: 'Distribuição' },
                  { v: 'DROP',     cor: '#22c55e', desc: 'Última milha' },
                ].map(({ v, cor, desc }) => {
                  const ativo = (addForm.tipoRota ?? 'RAMAL') === v
                  return (
                    <button key={v} type="button"
                      onClick={() => setAddForm((p) => ({ ...p, tipoRota: v }))}
                      style={{
                        flex: 1,
                        backgroundColor: ativo ? `${cor}26` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${ativo ? cor + '66' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 10, padding: '8px 4px',
                        transition: 'all .15s',
                      }}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <span style={{ color: ativo ? cor : 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: 12 }}>{v}</span>
                      <span style={{ color: ativo ? cor : 'rgba(255,255,255,0.2)', fontSize: 10 }}>{desc}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Tipo chips para caixa */}
            {addMode === 'caixa' && (
              <div className="flex gap-2 mb-4">
                {[
                  { v: 'CDO', cor: '#22c55e' },
                  { v: 'CE',  cor: '#3b82f6' },
                ].map(({ v, cor }) => {
                  const ativo = (addForm.tipo ?? 'CDO') === v
                  return (
                    <button key={v} type="button"
                      onClick={() => setAddForm((p) => ({ ...p, tipo: v }))}
                      style={{
                        flex: 1,
                        backgroundColor: ativo ? `${cor}22` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${ativo ? cor + '55' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 10, padding: '8px 4px',
                        color: ativo ? cor : 'rgba(255,255,255,0.35)',
                        fontWeight: 700, fontSize: 13,
                        transition: 'all .15s',
                      }}>
                      {v}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 4 }}>ID *</label>
                <input
                  value={addForm.id ?? ''}
                  onChange={(e) => setAddForm((p) => ({ ...p, id: e.target.value }))}
                  placeholder={addMode === 'cto' ? 'ex: CTO-001' : addMode === 'caixa' ? 'ex: CDO-001' : addMode === 'poste' ? 'ex: PT-001' : 'ex: RT-001'}
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
                  className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40"
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome</label>
                <input
                  value={addForm.nome ?? ''}
                  onChange={(e) => setAddForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Opcional"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
                  className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40"
                />
              </div>

              {addMode === 'cto' && (
                <div className="col-span-2">
                  <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 4 }}>Capacidade</label>
                  <select
                    value={addForm.capacidade ?? 16}
                    onChange={(e) => setAddForm((p) => ({ ...p, capacidade: parseInt(e.target.value) }))}
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
                    className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500/40"
                  >
                    {[8,16,24,32,48,64].map((c) => <option key={c} value={c}>{c} portas</option>)}
                  </select>
                </div>
              )}
            </div>

            {addErro && (
              <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }} className="rounded-lg px-3 py-2 text-xs text-red-400 mb-3">
                {addErro}
              </div>
            )}

            <div className="flex gap-3">
              {addMode === 'rota' && (
                <button
                  onClick={() => setAddRoutePoints((p) => p.slice(0, -1))}
                  disabled={addRoutePoints.length === 0}
                  style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}
                  className="flex-1 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  ↩ Desfazer
                </button>
              )}
              <button
                onClick={salvarAddElement}
                disabled={addSaving}
                style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700 }}
                className="flex-1 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {addSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
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
