'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMap }        from '@/hooks/useMap'
import { useMapLayers }  from '@/hooks/useMapLayers'
import { useMapEvents }  from '@/hooks/useMapEvents'
import { useGPS }        from '@/hooks/useGPS'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'

import BottomSheet        from '@/components/map/BottomSheet'
import LayerToggles       from '@/components/map/LayerToggles'
import ModalMovimentacao  from '@/components/map/ModalMovimentacao'
import ModalDiagrama      from '@/components/map/ModalDiagrama'
import ModalDiagramaCDO   from '@/components/map/ModalDiagramaCDO'
import ModalTopologia from '@/components/map/ModalTopologia'

import { getCTOs, upsertCTO }   from '@/actions/ctos'
import { getCaixas, upsertCaixa } from '@/actions/caixas'
import { getRotas, upsertRota }  from '@/actions/rotas'
import { getPostes, upsertPoste } from '@/actions/postes'
import { getOLTs }               from '@/actions/olts'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DEFAULT_LAYER_TOGGLES = {
  ctos:      true,
  caixas:    true,
  rotas:     true,
  postes:    true,
  olts:      true,
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
  initialOLTs   = [],
}) {
  const containerRef = useRef(null)
  const router = useRouter()

  // Suporta tanto session (legado) quanto projetoId/userRole diretos
  const projetoId = session?.user?.projeto_id ?? projetoIdProp
  const userRole  = session?.user?.role ?? userRoleProp

  // ---- Estado de reposicionamento ----
  const [reposicionandoEl, setReposicionandoEl] = useState(null) // { type, data }

  // ---- Modais de CTO ----
  const [movimentacaoEl, setMovimentacaoEl] = useState(null)  // data da CTO
  const [diagramaEl, setDiagramaEl]         = useState(null)  // data da CTO

  // ---- Modal de Diagrama ABNT para CDO/CE ----
  const [diagramaCDOEl, setDiagramaCDOEl]   = useState(null)  // data da caixa

  const [mostrarTopologia, setMostrarTopologia] = useState(false)

  // ---- Dados do mapa (hidratados pelo servidor; recarregados após mutações) ----
  const [ctos,   setCTOs]   = useState(initialCTOs)
  const [caixas, setCaixas] = useState(initialCaixas)
  const [rotas,  setRotas]  = useState(initialRotas)
  const [postes, setPostes] = useState(initialPostes)
  const [olts,   setOLTs]   = useState(initialOLTs)
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

  useMapLayers(map, mapLoaded, { ctos, caixas, rotas, postes, olts }, layerToggles)

  const addModeRef = useRef(addMode)
  addModeRef.current = addMode

  const reposicionandoRef = useRef(reposicionandoEl)
  reposicionandoRef.current = reposicionandoEl

  const eventCallbacks = {
    onElementClick: useCallback(({ type, data }) => {
      if (addModeRef.current) return
      if (reposicionandoRef.current) return
      setSelectedElement({ type, data })
    }, []),
    onMapClick: useCallback(async (lngLat) => {
      const mode = addModeRef.current
      const repos = reposicionandoRef.current

      // Reposicionamento: salvar nova posição (online) ou enfileirar (offline)
      if (repos) {
        const { type, data } = repos
        if (!isOnline) {
          if (type === 'cto') {
            enqueue({ type: 'reposicionar_cto', payload: { cto_id: data.cto_id, projeto_id: projetoId, lat: lngLat.lat, lng: lngLat.lng } })
          } else if (type === 'caixa') {
            enqueue({ type: 'reposicionar_caixa', payload: { ce_id: data.id ?? data.ce_id, projeto_id: projetoId, lat: lngLat.lat, lng: lngLat.lng } })
          } else if (type === 'poste') {
            enqueue({ type: 'reposicionar_poste', payload: { poste_id: data.poste_id, projeto_id: projetoId, lat: lngLat.lat, lng: lngLat.lng } })
          }
        } else {
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
  const syncHandler = useCallback(async (op) => {
    const p = op.payload
    if (op.type === 'reposicionar_cto')   await upsertCTO(p)
    else if (op.type === 'reposicionar_caixa') await upsertCaixa(p)
    else if (op.type === 'reposicionar_poste') await upsertPoste(p)
    else if (op.type === 'add_cto')   await upsertCTO(p)
    else if (op.type === 'add_caixa') await upsertCaixa(p)
    else if (op.type === 'add_poste') await upsertPoste(p)
    else if (op.type === 'add_rota')  await upsertRota(p)
  }, [])
  const { isOnline, queueSize, enqueue } = useOfflineQueue(syncHandler)

  // ---- Funções de dados ----
  const reloadData = useCallback(async () => {
    if (!projetoId) return
    setLoadingData(true)
    try {
      const [newCTOs, newCaixas, newRotas, newPostes, newOLTs] = await Promise.all([
        getCTOs(projetoId),
        getCaixas(projetoId),
        getRotas(projetoId),
        getPostes(projetoId),
        getOLTs(projetoId),
      ])
      setCTOs(newCTOs)
      setCaixas(newCaixas)
      setRotas(newRotas)
      setPostes(newPostes)
      setOLTs(newOLTs)
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
    } else if (action === 'movimentacao') {
      setMovimentacaoEl(data)
      setSelectedElement(null)
    } else if (action === 'diagrama') {
      const id = data?.cto_id ?? data?.id ?? ''
      if ((userRole === 'admin' || userRole === 'superadmin') && id) {
        router.push(`/admin/diagramas?tab=ctos&id=${encodeURIComponent(id)}`)
      } else {
        setDiagramaEl(data)
      }
      setSelectedElement(null)
    } else if (action === 'diagrama_abnt') {
      setDiagramaCDOEl(data)
      setSelectedElement(null)
    } else if (action === 'fusoes') {
      const id = type === 'cto'
        ? (data?.cto_id ?? data?.id ?? '')
        : (data?.ce_id ?? data?.id ?? '')
      const tipo = type === 'cto' ? 'cto' : 'cdo'
      router.push(`/admin/diagramas?tipo=${tipo}&id=${encodeURIComponent(id)}`)
      setSelectedElement(null)
    } else if (action === 'topologia') {
      setMostrarTopologia(true)
      setSelectedElement(null)
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

  // ---- Recarregar dados do servidor ao montar (garante dados frescos após mutações) ----
  useEffect(() => {
    reloadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- GPS pelo menu lateral (evento global) ----
  useEffect(() => {
    function handleGPSCenter() {
      startTracking()
      setFollowMode(true)
    }
    window.addEventListener('fiberops:gps-center', handleGPSCenter)
    return () => window.removeEventListener('fiberops:gps-center', handleGPSCenter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTracking, setFollowMode])

  // ---- Fly-to por busca de cliente no sidebar ----
  useEffect(() => {
    function handleFlyTo(e) {
      const { lat, lng } = e.detail ?? {}
      if (lat == null || lng == null || !map) return
      map.flyTo({ center: [lng, lat], zoom: 17, duration: 1200 })
    }
    window.addEventListener('fiberops:fly-to', handleFlyTo)
    return () => window.removeEventListener('fiberops:fly-to', handleFlyTo)
  }, [map])

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
    setAddSaving(false)
  }

  async function salvarAddElement() {
    if (!addForm.id?.trim()) { setAddErro('ID obrigatório'); return }
    setAddSaving(true)
    setAddErro(null)

    const payloads = {
      cto:   { cto_id: addForm.id.trim(), projeto_id: projetoId, lat: addCoords.lat, lng: addCoords.lng, nome: addForm.nome || null, capacidade: addForm.capacidade || 16 },
      caixa: { ce_id: addForm.id.trim(), projeto_id: projetoId, lat: addCoords.lat, lng: addCoords.lng, nome: addForm.nome || null, tipo: addForm.tipo || 'CDO' },
      poste: { poste_id: addForm.id.trim(), projeto_id: projetoId, lat: addCoords.lat, lng: addCoords.lng, nome: addForm.nome || null, tipo: 'simples', status: 'ativo' },
      rota:  { rota_id: addForm.id.trim(), projeto_id: projetoId, nome: addForm.nome || null, tipo: addForm.tipoRota || 'RAMAL', coordinates: addRoutePoints },
    }

    if (!isOnline) {
      enqueue({ type: `add_${addMode}`, payload: payloads[addMode] })
      cancelarAddMode()
      return
    }

    try {
      if (addMode === 'cto')   await upsertCTO(payloads.cto)
      else if (addMode === 'caixa') await upsertCaixa(payloads.caixa)
      else if (addMode === 'poste') await upsertPoste(payloads.poste)
      else if (addMode === 'rota')  await upsertRota(payloads.rota)
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

      {/* Status de conexão — sempre visível no mobile */}
      <div
        role="status"
        aria-live="polite"
        className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg pointer-events-none"
        style={{
          background:  isOnline ? 'rgba(22,101,52,0.92)' : 'rgba(180,83,9,0.95)',
          border:      `1px solid ${isOnline ? 'rgba(34,197,94,0.4)' : 'rgba(251,191,36,0.5)'}`,
          backdropFilter: 'blur(8px)',
          minWidth: 90,
          justifyContent: 'center',
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: isOnline ? '#4ade80' : '#fbbf24',
          display: 'inline-block',
          boxShadow: isOnline ? '0 0 6px #4ade80' : '0 0 6px #fbbf24',
          animation: !isOnline ? 'gps-pulse 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: isOnline ? '#bbf7d0' : '#fef3c7' }}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
        {!isOnline && queueSize > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: 'rgba(0,0,0,0.3)',
            color: '#fde68a',
            padding: '1px 6px', borderRadius: 10,
          }}>
            {queueSize} na fila
          </span>
        )}
      </div>

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

      {/* Indicador GPS + botão Seguir */}
      {tracking && (
        <div className="absolute top-24 right-2.5 z-40 pointer-events-auto flex flex-col items-end gap-1">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
            style={{ background: 'rgba(37,99,235,0.25)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
            GPS ativo
          </div>
          <button
            onClick={handleFollowToggle}
            className="px-2 py-1 rounded-full text-xs font-semibold transition-all"
            style={{
              background: followMode ? 'rgba(37,99,235,0.75)' : 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(59,130,246,0.5)',
              color: followMode ? '#fff' : '#93c5fd',
              cursor: 'pointer',
            }}
          >
            {followMode ? '📍 Seguindo' : '📍 Seguir'}
          </button>
        </div>
      )}
      {gpsError && (
        <div role="alert" className="absolute top-28 right-2.5 z-40 w-48 bg-red-900/90 text-red-200 text-xs px-3 py-2 rounded-lg shadow">
          {gpsError}
        </div>
      )}

      {/* Modal Movimentação de Clientes */}
      {movimentacaoEl && (
        <ModalMovimentacao
          ctoData={movimentacaoEl}
          projetoId={projetoId}
          onClose={() => setMovimentacaoEl(null)}
          onSaved={() => reloadData()}
        />
      )}

      {/* Modal Diagrama de Fibra CTO */}
      {diagramaEl && (
        <ModalDiagrama
          ctoData={diagramaEl}
          projetoId={projetoId}
          onClose={() => setDiagramaEl(null)}
        />
      )}

      {/* Modal Diagrama ABNT CDO/CE */}
      {diagramaCDOEl && (
        <ModalDiagramaCDO
          caixaData={diagramaCDOEl}
          projetoId={projetoId}
          onClose={() => setDiagramaCDOEl(null)}
          onSaved={() => reloadData()}
        />
      )}

      {/* Modal Topologia */}
      {mostrarTopologia && (
        <ModalTopologia
          projetoId={projetoId}
          onClose={() => setMostrarTopologia(false)}
        />
      )}

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

      {/* FAB de adição — canto inferior direito, isolado das ferramentas GPS */}
      {(userRole === 'admin' || userRole === 'superadmin') && !addMode && !selectedElement && (
        <div className="absolute bottom-6 right-4 z-40 flex flex-col items-end gap-2 pointer-events-auto">
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
