'use client'

import 'ol/ol.css'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOLMap }    from '@/hooks/useOLMap'
import { useOLLayers } from '@/hooks/useOLLayers'
import { useOLEvents } from '@/hooks/useOLEvents'
import { useOLGPS }    from '@/hooks/useOLGPS'

// OpenLayers primitives usados nos blocos de edição e preview
import Feature      from 'ol/Feature'
import Point        from 'ol/geom/Point'
import LineString   from 'ol/geom/LineString'
import VectorSource from 'ol/source/Vector'
import VectorLayer  from 'ol/layer/Vector'
import { Modify }   from 'ol/interaction'
import { Style, Circle as OLCircle, Fill, Stroke } from 'ol/style'
import { fromLonLat, toLonLat } from 'ol/proj'
import { flyTo as olFlyTo, fitExtent as olFitExtent } from '@/lib/olMap'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useModoCampo }  from '@/hooks/useModoCampo'
import BottomSheet        from '@/components/map/BottomSheet'
// LayerToggles moved into map side panel
import ModalMovimentacao  from '@/components/map/ModalMovimentacao'
import ModalDiagrama      from '@/components/map/ModalDiagrama'
import ModalDiagramaCDO   from '@/components/map/ModalDiagramaCDO'
import ModalTopologia     from '@/components/map/ModalTopologia'
import BuscaMapa          from '@/components/map/BuscaMapa'
import WeatherWidget      from '@/components/map/WeatherWidget'
import RegistroPotencia   from '@/components/map/RegistroPotencia'
import VarinhaNetworkTool from '@/components/map/VarinhaNetworkTool'

import { getCTOs, upsertCTO }   from '@/actions/ctos'
import { getCaixas, upsertCaixa, addCaboToItem } from '@/actions/caixas'
import { getRotas, upsertRota }  from '@/actions/rotas'
import { getPostes, upsertPoste } from '@/actions/postes'
import { getOLTs, upsertOLT }    from '@/actions/olts'

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
  const userRoleRef = useRef(userRole)
  useEffect(() => { userRoleRef.current = userRole }, [userRole])

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
  const [layerToggles, setLayerToggles]       = useState(() => {
    try {
      const saved = typeof window !== 'undefined' && localStorage.getItem('fiberops_layers')
      return saved ? { ...DEFAULT_LAYER_TOGGLES, ...JSON.parse(saved) } : DEFAULT_LAYER_TOGGLES
    } catch { return DEFAULT_LAYER_TOGGLES }
  })

  // ---- Modo de adição de elementos no mapa ----
  const [addMode, setAddMode]           = useState(null) // null | 'cto' | 'caixa' | 'poste' | 'rota'
  const [addCoords, setAddCoords]       = useState(null) // { lng, lat } para ponto
  const [addRoutePoints, setAddRoutePoints] = useState([]) // [[lng,lat]...] para rota
  const [addRouteLinks, setAddRouteLinks]   = useState([]) // [{ pointIndex, type, id, nome }]
  const [routeFinalized, setRouteFinalized] = useState(false) // true = parou de coletar pontos
  const [addForm, setAddForm]           = useState({})
  const [addFabOpen, setAddFabOpen]     = useState(false) // kept to avoid stale refs, unused after FAB removal
  const [gpsExpanded, setGpsExpanded]   = useState(false) // GPS widget: minimizado = só ícone
  const [addSaving, setAddSaving]       = useState(false)
  const [addErro, setAddErro]           = useState(null)

  // ---- Edição de rota existente (drag de pontos) ----
  const [editingRota, setEditingRota]   = useState(null) // { rota_id, coordinates: [[lng,lat],...] }
  const [editRotaSaving, setEditRotaSaving] = useState(false)
  const [editRotaErro, setEditRotaErro]     = useState(null)
  const editMarkersRef = useRef([]) // instâncias MapLibre Marker

  // ---- Spread de itens sobrepostos (painel React) ----
  const [spreadPanel, setSpreadPanel] = useState(null) // null | { x, y, items: [{type, data, nome, cor, icone}] }

  // ---- AGENT_BUSCA — busca no mapa ----
  const [buscaAberta, setBuscaAberta]           = useState(false)

  // ---- Painel lateral do mapa ----
  const [mapPainel, setMapPainel]               = useState(false)

  // ---- AGENT_CAMPO — registro de potência ----
  const [registroPotencia, setRegistroPotencia] = useState(null) // null | { ctoId }

  // ---- Varinha de rede automática ----
  const [varinhaMode, setVarinhaMode] = useState(false)

  // ---- Simulação de instalação ----
  const [simMode,    setSimMode]    = useState(false)
  const [simLoading, setSimLoading] = useState(false)
  const [simResult,  setSimResult]  = useState(null)   // null | API response
  const [simConfirm, setSimConfirm] = useState(false)  // show confirm panel
  const [simCliente, setSimCliente] = useState('')
  const simMarkerRef = useRef(null)

  // ---- AGENT_CAMPO — modo campo mobile ----
  const { isCampo } = useModoCampo()

  // ---- Tema único claro ----
  const isDark = false

  // ---- Hooks do mapa ----
  const { map, mapLoaded } = useOLMap(containerRef, {
    center: [-46.633308, -23.55052], // OL: [lng, lat]
    zoom:   14,
  })

  const addModeRef = useRef(addMode)
  addModeRef.current = addMode

  const routeFinalizedRef = useRef(routeFinalized)
  routeFinalizedRef.current = routeFinalized

  const addRoutePointsRef = useRef(addRoutePoints)
  addRoutePointsRef.current = addRoutePoints

  const addRouteLinksRef = useRef(addRouteLinks)
  addRouteLinksRef.current = addRouteLinks

  const reposicionandoRef = useRef(reposicionandoEl)
  reposicionandoRef.current = reposicionandoEl

  const simModeRef = useRef(simMode)
  simModeRef.current = simMode

  const TIPO_ICONE = { cto: '📦', caixa: '🔌', rota: '〰', poste: '🏗', olt: '🖥' }
  const TIPO_COR   = { cto: '#0284c7', caixa: '#7c3aed', rota: '#059669', poste: '#d97706', olt: '#0891b2' }

  // ---- Callback de clique em elemento (usado por useOLLayers) ----
  const handleElementClick = useCallback(({ type, data }) => {
    if (addModeRef.current) return
    if (reposicionandoRef.current) return
    setSpreadPanel(null)
    setSelectedElement({ type, data })
  }, [])

  // ---- Layers do OpenLayers — callbacks de clique fluem para o BottomSheet ----
  useOLLayers(map, mapLoaded, { ctos, caixas, rotas, postes, olts }, layerToggles, {
    onClickCTO:   (cto)   => handleElementClick({ type: 'cto',   data: cto }),
    onClickCaixa: (caixa) => handleElementClick({ type: 'caixa', data: caixa }),
    onClickPoste: (poste) => handleElementClick({ type: 'poste', data: poste }),
    onClickOLT:   (olt)   => handleElementClick({ type: 'olt',   data: olt }),
    onClickRota:  (rota)  => handleElementClick({ type: 'rota',  data: rota }),
    onClusterClick: (items, pixel) => setSpreadPanel({ x: pixel.x, y: pixel.y, items }),
  })

  // ---- Eventos de mapa (click em área vazia, duplo-clique para rota) ----
  const onMapClick = useCallback(async (lngLat) => {
    // ── Simulation mode: capture click and run analysis ─────────────────
    if (simModeRef.current) {
      setSimLoading(true)
      setSimResult(null)
      setSimConfirm(false)
      setSimCliente('')
      try {
        const res  = await fetch('/api/simulation/install', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ lat: lngLat.lat, lng: lngLat.lng }),
        })
        const data = await res.json()
        setSimResult(data)
      } catch (e) {
        console.error('[Sim]', e.message)
      } finally {
        setSimLoading(false)
      }
      return
    }

    const mode  = addModeRef.current
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
          } else if (type === 'olt') {
            const olt_id = data.id ?? data.olt_id
            await upsertOLT({ olt_id, projeto_id: projetoId, lat: lngLat.lat, lng: lngLat.lng, nome: data.nome, modelo: data.modelo, ip: data.ip, status: data.status, portas_pon: data.capacidade })
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
      setSpreadPanel(null)
      setSelectedElement(null)
      return
    }
    if (mode === 'rota') {
      if (routeFinalizedRef.current) return
      setAddRoutePoints((prev) => [...prev, [lngLat.lng, lngLat.lat]])
    } else {
      setAddCoords(lngLat)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId])

  const onRouteDblClick = useCallback(() => {
    if (addModeRef.current === 'rota' && addRoutePointsRef.current.length >= 2) {
      setRouteFinalized(true)
    }
  }, [])

  useOLEvents(map, mapLoaded, { onMapClick, onRouteDblClick })

  // ---- GPS ----
  const {
    position:    gpsPosition,
    tracking,
    error:       gpsError,
    followMode,
    setFollowMode,
    startTracking,
    stopTracking,
  } = useOLGPS(map)

  // Centralizar na localização do usuário ao abrir o mapa (uma vez só)
  useEffect(() => {
    if (!mapLoaded || !map) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        olFlyTo([pos.coords.longitude, pos.coords.latitude], 12, 1500)
      },
      () => {}, // permissão negada — mantém posição padrão
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded])

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

  // ---- Edição de rota: marcadores arrastáveis ----
  // ---- Edit markers de rota (OpenLayers — Modify interaction) ----
  useEffect(() => {
    // Limpar camada anterior
    if (editMarkersRef.current?.layer) {
      try { map?.removeLayer(editMarkersRef.current.layer) } catch (_) {}
      try { map?.removeInteraction(editMarkersRef.current.modify) } catch (_) {}
    }
    editMarkersRef.current = {}

    const canEdit = userRoleRef.current === 'admin' || userRoleRef.current === 'superadmin'
    if (!editingRota || !map || !mapLoaded || !canEdit) return

    // Source com um ponto por vértice
    const editSource = new VectorSource()
    editingRota.coordinates.forEach((coord, i) => {
      const isEndpoint = i === 0 || i === editingRota.coordinates.length - 1
      const f = new Feature({ geometry: new Point(fromLonLat([coord[0], coord[1]])), isEndpoint, coordIndex: i })
      editSource.addFeature(f)
    })

    const editLayer = new VectorLayer({
      source: editSource,
      style: (f) => new Style({
        image: new OLCircle({
          radius:  f.get('isEndpoint') ? 8 : 6,
          fill:    new Fill({ color: f.get('isEndpoint') ? '#e2e8f0' : '#6366f1' }),
          stroke:  new Stroke({ color: '#ffffff', width: 2 }),
        }),
      }),
      zIndex: 100,
    })
    map.addLayer(editLayer)

    // Modify interaction — arrastar vértice
    const modify = new Modify({ source: editSource, pixelTolerance: 10 })
    modify.on('modifyend', () => {
      const features = editSource.getFeatures()
        .sort((a, b) => a.get('coordIndex') - b.get('coordIndex'))
      const newCoords = features.map((f) => {
        const [lng, lat] = toLonLat(f.getGeometry().getCoordinates())
        return [lng, lat]
      })
      setEditingRota(prev => prev ? { ...prev, coordinates: newCoords } : null)
    })
    map.addInteraction(modify)

    editMarkersRef.current = { layer: editLayer, modify }

    return () => {
      try { map.removeLayer(editLayer) }       catch (_) {}
      try { map.removeInteraction(modify) }    catch (_) {}
      editMarkersRef.current = {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRota?.rota_id, map, mapLoaded])

  // ---- Preview da rota em edição (OpenLayers) ----
  const editPreviewRef = useRef({ layer: null, source: null })
  useEffect(() => {
    if (!map || !mapLoaded) return
    // Limpar
    if (editPreviewRef.current.layer) {
      try { map.removeLayer(editPreviewRef.current.layer) } catch (_) {}
      editPreviewRef.current = { layer: null, source: null }
    }
    if (!editingRota || editingRota.coordinates.length < 2) return

    const src = new VectorSource()
    src.addFeature(new Feature({
      geometry: new LineString(editingRota.coordinates.map(([lng, lat]) => fromLonLat([lng, lat]))),
    }))
    const lyr = new VectorLayer({
      source: src,
      style: new Style({ stroke: new Stroke({ color: '#6366f1', width: 3, lineDash: [5, 3] }) }),
      zIndex: 99,
    })
    map.addLayer(lyr)
    editPreviewRef.current = { layer: lyr, source: src }

    return () => {
      try { map.removeLayer(lyr) } catch (_) {}
      editPreviewRef.current = { layer: null, source: null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRota, map, mapLoaded])

  // ---- Simulação: preview OpenLayers (linha + ponto do cliente) ----
  const simPreviewRef = useRef({ layer: null, source: null })
  useEffect(() => {
    if (!map || !mapLoaded) return

    const cleanup = () => {
      if (simPreviewRef.current.layer) {
        try { map.removeLayer(simPreviewRef.current.layer) } catch (_) {}
        simPreviewRef.current = { layer: null, source: null }
      }
    }
    cleanup()

    if (!simResult?.success || !simResult.client_lat || !simResult.cto_lat) return

    const clientCoord = fromLonLat([simResult.client_lng, simResult.client_lat])
    const ctoCoord    = fromLonLat([simResult.cto_lng,    simResult.cto_lat])

    const sigColor =
      simResult.signal_quality === 'EXCELENTE' ? '#22c55e' :
      simResult.signal_quality === 'BOM'        ? '#4ade80' :
      simResult.signal_quality === 'LIMITE'     ? '#D4622B' : '#ef4444'

    const src = new VectorSource()
    const lineF = new Feature({ geometry: new LineString([clientCoord, ctoCoord]) })
    lineF.setStyle(new Style({ stroke: new Stroke({ color: sigColor, width: 2.5, lineDash: [5, 3] }) }))

    const dotF = new Feature({ geometry: new Point(clientCoord) })
    dotF.setStyle(new Style({
      image: new OLCircle({
        radius: 10,
        fill:   new Fill({ color: '#D4622B' }),
        stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
      }),
    }))

    src.addFeatures([lineF, dotF])
    const lyr = new VectorLayer({ source: src, zIndex: 98 })
    map.addLayer(lyr)
    simPreviewRef.current = { layer: lyr, source: src }

    // Encaixa ambos no viewport
    olFitExtent([
      Math.min(simResult.client_lng, simResult.cto_lng),
      Math.min(simResult.client_lat, simResult.cto_lat),
      Math.max(simResult.client_lng, simResult.cto_lng),
      Math.max(simResult.client_lat, simResult.cto_lat),
    ], 120)

    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simResult, map, mapLoaded])

  async function salvarEditRota() {
    if (!editingRota || editRotaSaving) return
    if (editingRota.coordinates.length < 2) { setEditRotaErro('Mínimo 2 pontos'); return }
    setEditRotaSaving(true)
    setEditRotaErro(null)
    try {
      await upsertRota({ rota_id: editingRota.rota_id, projeto_id: projetoId, coordinates: editingRota.coordinates, nome: editingRota.nome, tipo: editingRota.tipo, obs: editingRota.obs })
      await reloadData()
      setEditingRota(null)
    } catch (e) {
      setEditRotaErro(e.message)
    } finally {
      setEditRotaSaving(false)
    }
  }

  // ---- Persistir toggles no localStorage ----
  useEffect(() => {
    try { localStorage.setItem('fiberops_layers', JSON.stringify(layerToggles)) } catch {}
  }, [layerToggles])

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
      const tabMap = { cto: 'ctos', caixa: 'caixas', poste: 'postes', rota: 'rotas' }
      const id     = data?.cto_id ?? data?.rota_id ?? data?.poste_id ?? data?.id ?? ''
      const tab    = tabMap[type] ?? 'ctos'
      router.push(`/admin/campo?tab=${tab}&id=${encodeURIComponent(id)}`)
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
    } else if (action === 'editar_pontos') {
      const feature = rotas?.features?.find(f => f.properties?.rota_id === data?.rota_id)
      if (feature?.geometry?.coordinates?.length >= 2) {
        setEditingRota({
          rota_id: feature.properties.rota_id,
          nome:    feature.properties.nome ?? null,
          tipo:    feature.properties.tipo ?? null,
          obs:     feature.properties.obs  ?? null,
          coordinates: feature.geometry.coordinates.map(c => [...c]),
        })
      }
      setSelectedElement(null)
    } else if (action === 'medir_potencia') {
      // AGENT_CAMPO — abre registro de potência para técnico
      const ctoId = data?.cto_id ?? data?.id
      if (ctoId) {
        setRegistroPotencia({ ctoId })
        setSelectedElement(null)
      }
    }
  }, [router, rotas])

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

  // ---- Fly-to por busca de cliente no sidebar ----
  useEffect(() => {
    function handleFlyTo(e) {
      const { lat, lng } = e.detail ?? {}
      if (lat == null || lng == null || !map) return
      olFlyTo([lng, lat], 17, 1200)
    }
    window.addEventListener('fiberops:fly-to', handleFlyTo)
    return () => window.removeEventListener('fiberops:fly-to', handleFlyTo)
  }, [map])

  // ---- Cursor crosshair durante add mode, reposicionamento ou simulação ----
  useEffect(() => {
    // OL renderiza num viewport interno; o containerRef é o wrapper
    const viewport = map?.getViewport?.() ?? containerRef.current
    if (!viewport) return
    viewport.style.cursor = (addMode || reposicionandoEl || simMode) ? 'crosshair' : ''
  }, [addMode, reposicionandoEl, simMode, map])

  // ---- Preview de rota em tempo real (OpenLayers) ----
  const drawPreviewRef = useRef({ layer: null, source: null })
  useEffect(() => {
    if (!map || !mapLoaded) return

    const cleanupDraw = () => {
      if (drawPreviewRef.current.layer) {
        try { map.removeLayer(drawPreviewRef.current.layer) } catch (_) {}
        drawPreviewRef.current = { layer: null, source: null }
      }
    }
    cleanupDraw()

    if (addMode !== 'rota' || addRoutePoints.length < 1) return

    const tipoRota   = addForm.tipoRota || 'RAMAL'
    const routeColor = tipoRota === 'BACKBONE' ? '#6366f1' : tipoRota === 'DROP' ? '#22c55e' : '#000000'
    const snappedIdx = new Set(addRouteLinksRef.current.map(l => l.pointIndex))

    const src      = new VectorSource()
    const features = []

    // Linha de preview
    if (addRoutePoints.length >= 2) {
      const lineF = new Feature({
        geometry: new LineString(addRoutePoints.map(([lng, lat]) => fromLonLat([lng, lat]))),
      })
      lineF.setStyle(new Style({
        stroke: new Stroke({ color: routeColor, width: 3, lineDash: [4, 2] }),
      }))
      features.push(lineF)
    }

    // Pontos de vértice
    addRoutePoints.forEach(([lng, lat], i) => {
      const isSnapped = snappedIdx.has(i)
      const dotF = new Feature({ geometry: new Point(fromLonLat([lng, lat])) })
      dotF.setStyle(new Style({
        image: new OLCircle({
          radius:  isSnapped ? 7 : 5,
          fill:    new Fill({ color: isSnapped ? '#86efac' : routeColor }),
          stroke:  new Stroke({ color: '#ffffff', width: 2 }),
        }),
      }))
      features.push(dotF)
    })

    src.addFeatures(features)
    const lyr = new VectorLayer({ source: src, zIndex: 97 })
    map.addLayer(lyr)
    drawPreviewRef.current = { layer: lyr, source: src }

    return cleanupDraw
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapLoaded, addMode, addRoutePoints, addForm.tipoRota])

  // ---- Funções de add mode ----
  function enterAddMode(type) {
    setAddMode(type)
    setAddCoords(null)
    setAddRoutePoints([])
    setAddRouteLinks([])
    setRouteFinalized(false)
    setAddForm({ tipo: type === 'caixa' ? 'CDO' : undefined, capacidade: 16, tipoRota: 'RAMAL' })
    setAddErro(null)
    setAddFabOpen(false)
    setSelectedElement(null)
  }

  function cancelarAddMode() {
    setAddMode(null)
    setAddCoords(null)
    setAddRoutePoints([])
    setAddRouteLinks([])
    setRouteFinalized(false)
    setAddForm({})
    setAddErro(null)
    setAddSaving(false)
  }

  function enterVarinhaMode() {
    setVarinhaMode(true)
    setAddMode(null)
    setSimMode(false)
    setSimResult(null)
    setSelectedElement(null)
    setReposicionandoEl(null)
    setMapPainel(false)
  }

  function cancelVarinhaMode() {
    setVarinhaMode(false)
  }

  function enterSimMode() {
    setSimMode(true)
    setSimResult(null)
    setSimConfirm(false)
    setSimCliente('')
    setAddMode(null)
    setVarinhaMode(false)
    setSelectedElement(null)
    setReposicionandoEl(null)
    setMapPainel(false)
  }

  function cancelSimMode() {
    setSimMode(false)
    setSimResult(null)
    setSimLoading(false)
    setSimConfirm(false)
    setSimCliente('')
  }

  async function salvarAddElement() {
    if (!addForm.id?.trim()) { setAddErro('ID obrigatório'); return }
    setAddSaving(true)
    setAddErro(null)

    const rotaSnapIds = addRouteLinks.map(l => `${l.type}:${l.id ?? l.nome}`)
    const rotaLinks   = rotaSnapIds.length > 0 ? rotaSnapIds.join(', ') : null
    const payloads = {
      cto:   { cto_id: addForm.id.trim(), projeto_id: projetoId, lat: addCoords?.lat, lng: addCoords?.lng, nome: addForm.nome || null, capacidade: addForm.capacidade || 16 },
      caixa: { ce_id: addForm.id.trim(), projeto_id: projetoId, lat: addCoords?.lat, lng: addCoords?.lng, nome: addForm.nome || null, tipo: addForm.tipo || 'CDO' },
      poste: { poste_id: addForm.id.trim(), projeto_id: projetoId, lat: addCoords?.lat, lng: addCoords?.lng, nome: addForm.nome || null, tipo: 'simples', status: 'ativo' },
      rota:  { rota_id: addForm.id.trim(), projeto_id: projetoId, nome: addForm.nome || null, tipo: addForm.tipoRota || 'RAMAL', coordinates: addRoutePoints, obs: rotaLinks || addForm.obs || null, snap_ids: rotaSnapIds },
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
      else if (addMode === 'rota') {
        await upsertRota(payloads.rota)
        // Sincronizar: registrar cabo nos itens snappados (CDO/CTO)
        if (addRouteLinks.length > 0) {
          const rotaId = addForm.id.trim()
          await Promise.allSettled(
            addRouteLinks.map((link) =>
              addCaboToItem({
                itemType:  link.type === 'cto' ? 'cto' : 'caixa',
                itemId:    link.id,
                projetoId,
                cabo: {
                  id:     `rota_${rotaId}_${link.id}`,
                  nome:   `Cabo Rota ${rotaId}`,
                  tipo:   'DROP',
                  fibras: 1,
                  obs:    `rota_id:${rotaId}`,
                },
              })
            )
          )
        }
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
    <div className="relative w-full h-full" style={{ background: 'var(--background)' }}>
      {/* Container do mapa */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" aria-label="Mapa FTTH" role="application" />

      {/* Widget de clima — canto superior esquerdo */}
      <WeatherWidget />

      {/* Status de conexão — só no desktop (mobile usa o header) */}
      <div
        role="status"
        aria-live="polite"
        className="hidden lg:flex absolute top-3 left-1/2 -translate-x-1/2 z-40 items-center gap-1.5 px-3 py-2 rounded-full shadow-lg pointer-events-none"
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

      {/* Busca movida para o painel lateral */}

      {/* Overlay para fechar o painel no mobile */}
      {mapPainel && (
        <div
          onClick={() => setMapPainel(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 41, background: 'transparent' }}
          className="lg:hidden"
        />
      )}

      {/* ── Painel lateral do mapa + pull-tab ──────────────────────────────── */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 42, pointerEvents: 'none' }}>
        {/* Painel deslizante */}
        <div
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: mapPainel ? 220 : 0,
            overflow: 'hidden',
            transition: 'width 0.22s ease',
            pointerEvents: mapPainel ? 'auto' : 'none',
          }}
        >
          <div style={{
            width: 220, height: '100%',
            background: '#9e8a6e',
            borderLeft: '1px solid #8e7254',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column',
            padding: '16px 12px',
            gap: 8,
            overflowY: 'auto',
          }}>
            {/* Título */}
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#271204', marginBottom: 4 }}>
              Controles
            </div>

            {/* Busca */}
            <button
              onClick={() => { setBuscaAberta(true); setMapPainel(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 10,
                background: '#c8b89e',
                border: '1px solid #8e7254',
                color: '#0f0701',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 15 }}>🔍</span>
              Buscar no mapa
            </button>

            {/* Divisor */}
            <div style={{ height: 1, background: '#8e7254', margin: '4px 0' }} />

            {/* Camadas */}
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#271204', marginBottom: 2 }}>
              Camadas
            </div>
            {[
              { key: 'ctos',   label: 'CTOs',    icon: '📡', color: '#10b981' },
              { key: 'caixas', label: 'CE/CDOs', icon: '🔷', color: '#6366f1' },
              { key: 'rotas',  label: 'Rotas',   icon: '〰️', color: '#D4622B' },
              { key: 'postes', label: 'Postes',  icon: '🪝', color: '#eab308' },
              { key: 'olts',   label: 'OLTs',    icon: '🖥️', color: '#0891b2' },
            ].map(({ key, label, icon, color }) => {
              const ativo = layerToggles[key] ?? true
              return (
                <button key={key}
                  onClick={() => handleLayerToggle(key, !ativo)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8,
                    background: ativo ? `${color}28` : '#c8b89e',
                    border: `1px solid ${ativo ? color + '66' : '#8e7254'}`,
                    color: '#0f0701',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  {label}
                  <span style={{ marginLeft: 'auto', fontSize: 10 }}>{ativo ? '●' : '○'}</span>
                </button>
              )
            })}

            {/* Divisor */}
            <div style={{ height: 1, background: '#8e7254', margin: '4px 0' }} />

            {/* Satélite */}
            <button
              onClick={handleSatelliteToggle}
              aria-pressed={layerToggles.satellite}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 10,
                background: layerToggles.satellite ? 'rgba(14,165,233,0.25)' : '#c8b89e',
                border: `1px solid ${layerToggles.satellite ? '#0ea5e9' : '#8e7254'}`,
                color: '#0f0701',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left',
              }}
            >
              <SatelliteIcon />
              Satélite
            </button>

            {/* Recarregar */}
            <button
              onClick={reloadData}
              disabled={loadingData}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 10,
                background: '#c8b89e',
                border: '1px solid #8e7254',
                color: '#0f0701',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left',
                opacity: loadingData ? 0.5 : 1,
              }}
            >
              <RefreshIcon spin={loadingData} />
              Recarregar
            </button>

            {/* Divisor */}
            <div style={{ height: 1, background: '#8e7254', margin: '4px 0' }} />

            {/* Simular Instalação */}
            <button
              onClick={simMode ? cancelSimMode : enterSimMode}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 10,
                background: simMode ? 'rgba(212,98,43,0.28)' : '#c8b89e',
                border: simMode ? '1.5px solid #D4622B' : '1px solid #8e7254',
                color: '#0f0701',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left',
                transition: 'all 0.18s',
              }}
            >
              <span style={{ fontSize: 15 }}>🔬</span>
              {simMode ? 'Cancelar Simulação' : 'Simular Instalação'}
              {simMode && (
                <span style={{
                  marginLeft: 'auto', fontSize: 9, fontWeight: 800,
                  background: 'rgba(212,98,43,0.2)', color: '#D4622B',
                  padding: '2px 5px', borderRadius: 4,
                }}>ATIVO</span>
              )}
            </button>

            {/* ── Adicionar elementos — visível apenas para admin e superadmin ── */}
            {(userRole === 'admin' || userRole === 'superadmin') && (
              <>
                <div style={{ height: 1, background: '#8e7254', margin: '4px 0' }} />
                {/* Permissão: somente admin e superadmin podem ver esta seção */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#271204', marginBottom: 2 }}>
                  Adicionar
                </div>
                {[
                  { type: 'cto',   label: 'CTO',    color: '#10b981', icon: '📡' },
                  { type: 'caixa', label: 'CE/CDO', color: '#6366f1', icon: '🔷' },
                  { type: 'poste', label: 'Poste',  color: '#d97706', icon: '🪝' },
                  { type: 'rota',  label: 'Rota',   color: '#D4622B', icon: '〰️' },
                ].map(({ type, label, color, icon }) => (
                  <button key={type}
                    onClick={() => { enterAddMode(type); setMapPainel(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 8,
                      background: `${color}28`,
                      border: `1px solid ${color}66`,
                      color: '#0f0701',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{icon}</span>
                    {label}
                  </button>
                ))}

                {/* Varinha de rede automática */}
                <div style={{ height: 1, background: '#8e7254', margin: '4px 0' }} />
                <button
                  onClick={enterVarinhaMode}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px', borderRadius: 10,
                    background: varinhaMode ? 'rgba(0,229,255,0.18)' : 'rgba(0,229,255,0.08)',
                    border: varinhaMode ? '1.5px solid #00e5ff' : '1px solid rgba(0,229,255,0.35)',
                    color: '#0f0701',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%', textAlign: 'left',
                    transition: 'all 0.18s',
                  }}
                >
                  <span style={{ fontSize: 15 }}>🪄</span>
                  Gerar Rede Automática
                  {varinhaMode && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 9, fontWeight: 800,
                      background: 'rgba(0,229,255,0.2)', color: '#00e5ff',
                      padding: '2px 5px', borderRadius: 4,
                    }}>ATIVO</span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Pull-tab (seta) — lado direito do painel */}
        <button
          onClick={() => setMapPainel(v => !v)}
          aria-label={mapPainel ? 'Fechar painel' : 'Abrir painel de controles'}
          style={{
            position: 'absolute',
            right: mapPainel ? 220 : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            transition: 'right 0.22s ease',
            pointerEvents: 'auto',
            background: '#9e8a6e',
            borderTop:    '1px solid #8e7254',
            borderBottom: '1px solid #8e7254',
            borderRight:  mapPainel ? '1px solid #8e7254' : 'none',
            borderLeft:   mapPainel ? 'none' : '1px solid #8e7254',
            borderRadius: mapPainel ? '0 8px 8px 0' : '8px 0 0 8px',
            width: 22,
            height: 64,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#3d1f04',
            boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
          }}
        >
          {mapPainel ? '▶' : '◀'}
        </button>
      </div>

      {/* Varinha de Criação Automática de Rede */}
      {varinhaMode && (userRole === 'admin' || userRole === 'superadmin') && (
        <VarinhaNetworkTool
          projetoId={projetoId}
          onSaved={({ ctos, routes, cdos }) => {
            cancelVarinhaMode()
            reloadData()
          }}
          onClose={cancelVarinhaMode}
        />
      )}

      {/* Erro GPS flutuante */}
      {gpsError && (
        <div role="alert" className="absolute z-40 pointer-events-none"
          style={{ bottom: 88, right: 16, background: 'rgba(127,29,29,0.95)',
            border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5',
            fontSize: 11, padding: '6px 12px', borderRadius: 10, maxWidth: 200, lineHeight: 1.4 }}>
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
          onSaved={() => reloadData()}
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

      {/* Spread panel overlay — seletor de itens sobrepostos */}
      {spreadPanel && (() => {
        const isDark = false
        return (
          <div
            style={{
              position: 'absolute',
              left: spreadPanel.x,
              top: spreadPanel.y,
              zIndex: 200,
              transform: 'translate(-50%, -110%)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              pointerEvents: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {spreadPanel.items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedElement({ type: item.type, data: item.data })
                    setSpreadPanel(null)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: `1.5px solid ${item.cor}66`,
                    background: 'rgba(162,138,108,0.97)',
                    color: item.cor,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.20)',
                    backdropFilter: 'blur(4px)',
                    textAlign: 'left',
                  }}
                >
                  <span>{item.icone}</span>
                  <span style={{ color: '#0f0701' }}>{item.nome}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setSpreadPanel(null)}
              style={{
                alignSelf: 'center', background: 'none', border: 'none',
                color: '#271204',
                cursor: 'pointer', fontSize: 11, padding: '2px 8px',
              }}
            >
              fechar
            </button>
          </div>
        )
      })()}

      {/* Bottom sheet de elemento selecionado */}
      {!addMode && !reposicionandoEl && (
        <BottomSheet
          element={selectedElement}
          onClose={handleCloseSheet}
          userRole={userRole}
          onAction={handleAction}
        />
      )}

      {/* AGENT_BUSCA — overlay de busca */}
      {buscaAberta && (
        <BuscaMapa
          projetoId={projetoId}
          onFlyTo={({ lat, lng }) => map?.flyTo({ center: [lng, lat], zoom: 17, duration: 1000 })}
          onClose={() => setBuscaAberta(false)}
        />
      )}

      {/* AGENT_CAMPO — registro de potência */}
      {registroPotencia && (
        <RegistroPotencia
          ctoId={registroPotencia.ctoId}
          projetoId={projetoId}
          onClose={() => setRegistroPotencia(null)}
        />
      )}

      {/* ── Widget GPS — canto inferior esquerdo ─────────────────────────────
           Minimizado: botão compacto com ícone + pulse dot.
           Expandido: card com Localizar / Seguir / Centralizar.           */}
      {!addMode && !buscaAberta && (
        <div style={{
          position: 'absolute',
          bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          left: 12,
          zIndex: 40,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column-reverse',
          alignItems: 'flex-start',
          gap: 6,
        }}>
          {/* Botão toggle (sempre visível) */}
          <button
            onClick={() => setGpsExpanded(v => !v)}
            title={gpsExpanded ? 'Minimizar GPS' : 'Abrir GPS'}
            style={{
              position: 'relative',
              width: 44, height: 44,
              borderRadius: 12,
              background: gpsExpanded ? 'rgba(37,99,235,0.18)' : 'rgba(162,138,108,0.96)',
              border: gpsExpanded ? '1.5px solid #3b82f6' : '1px solid #8e7254',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#0f0701',
              transition: 'all 0.18s',
            }}
          >
            <GPSIcon />
            {/* Pulse dot — GPS ativo */}
            {tracking && (
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 7, height: 7, borderRadius: '50%',
                background: '#3b82f6',
                animation: 'gps-pulse 1.5s ease-in-out infinite',
              }} />
            )}
          </button>

          {/* Painel expandido */}
          {gpsExpanded && (
            <div style={{
              background: 'rgba(162,138,108,0.97)',
              border: '1px solid #8e7254',
              borderRadius: 14,
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: isDark
                ? '0 2px 8px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.5)'
                : '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.10)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden', minWidth: 152,
            }}>
              {/* Cabeçalho */}
              <div style={{
                padding: '7px 12px 6px',
                display: 'flex', alignItems: 'center', gap: 6,
                borderBottom: '1px solid #8e7254',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: tracking ? '#3b82f6' : '#8e7254',
                  ...(tracking ? { animation: 'gps-pulse 1.5s ease-in-out infinite' } : {}),
                }} />
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#271204' }}>
                  GPS
                </span>
                {tracking && followMode && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.12)', borderRadius: 4, padding: '1px 5px' }}>
                    ATIVO
                  </span>
                )}
              </div>

              {/* Localizar */}
              <button
                onClick={() => {
                  if (!navigator.geolocation) return
                  navigator.geolocation.getCurrentPosition(
                    (pos) => map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16, duration: 1000 }),
                    (err) => console.warn('GPS:', err.message),
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                  )
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', border: 'none', background: 'none',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  color: '#0f0701', fontSize: 12, fontWeight: 600,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <GPSIcon />
                Localizar
              </button>

              <div style={{ height: 1, background: '#8e7254', margin: '0 10px' }} />

              {/* Seguir / Parar */}
              <button
                onClick={() => {
                  if (tracking && followMode) { stopTracking() }
                  else if (tracking) { setFollowMode(true) }
                  else { startTracking(); setFollowMode(true) }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', border: 'none',
                  background: tracking && followMode ? 'rgba(37,99,235,0.15)' : 'none',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  color: '#0f0701',
                  fontSize: 12, fontWeight: 600, transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = tracking && followMode ? (isDark ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.08)') : 'none'}
              >
                <FollowIcon />
                <span style={{ flex: 1 }}>{tracking && followMode ? 'Seguindo...' : 'Seguir'}</span>
              </button>

              {/* Centralizar — só quando há posição mas não está seguindo */}
              {gpsPosition && !followMode && (
                <>
                  <div style={{ height: 1, background: '#8e7254', margin: '0 10px' }} />
                  <button
                    onClick={() => map?.flyTo({ center: [gpsPosition.lng, gpsPosition.lat], zoom: 16, duration: 800 })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', border: 'none', background: 'none',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      color: '#0f0701', fontSize: 12, fontWeight: 600,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" strokeDasharray="2 4"/>
                      <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
                      <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
                    </svg>
                    Centralizar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Banner de instrução durante add mode */}
      {addMode && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold shadow-lg flex items-center gap-3"
          style={{
            backgroundColor: isDark ? 'rgba(8,13,28,0.95)' : 'rgba(255,255,255,0.97)',
            border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid #e2e8f0',
            color: isDark ? '#f1f5f9' : '#0f172a',
            maxWidth: '90vw',
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.12)',
          }}
        >
          {addMode === 'rota' && !routeFinalized
            ? <>
                <span>〰️</span>
                {addRouteLinks.length > 0 && (
                  <span style={{ color: '#22c55e', fontSize: 10 }}>🔗 {addRouteLinks[addRouteLinks.length - 1].nome ?? addRouteLinks[addRouteLinks.length - 1].id}</span>
                )}
                <span>{addRoutePoints.length === 0 ? 'Clique no mapa para iniciar' : `${addRoutePoints.length} pontos`}</span>
                {addRoutePoints.length >= 2 && (
                  <button
                    onClick={() => setRouteFinalized(true)}
                    style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Finalizar
                  </button>
                )}
              </>
            : addMode === 'rota' && routeFinalized
            ? <><span style={{ color: '#22c55e' }}>✓</span><span>{addRoutePoints.length} pontos — preencha os dados</span></>
            : addCoords
            ? <><span style={{ color: '#22c55e' }}>✓</span><span>Local selecionado — preencha os dados</span></>
            : <><span>📍</span><span>Clique no mapa para posicionar</span></>}
          <button onClick={cancelarAddMode} style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8', marginLeft: 4 }} className="hover:text-current transition-colors">✕</button>
        </div>
      )}

      {/* Painel de formulário add mode */}
      {addMode && (addCoords || (addMode === 'rota' && routeFinalized && addRoutePoints.length >= 2)) && (
        <div
          className="absolute bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl"
          style={{
            backgroundColor: isDark ? 'rgba(8,13,28,0.98)' : 'rgba(255,255,255,0.99)',
            borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
          }}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0' }} />
          </div>

          <div className="px-4 pb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: isDark ? '#e2e8f0' : '#0f172a', fontWeight: 700, fontSize: 16 }}>
                {{ cto: 'Nova CTO', caixa: 'Nova CE/CDO', poste: 'Novo Poste', rota: 'Nova Rota' }[addMode]}
              </h3>
              <button onClick={cancelarAddMode} style={{ color: isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8', fontSize: 20, lineHeight: 1 }} className="hover:text-current transition-colors">✕</button>
            </div>

            {/* Tipo chips para rota */}
            {addMode === 'rota' && (
              <div className="flex gap-2 mb-4">
                {[
                  { v: 'BACKBONE', cor: '#6366f1', desc: 'Principal' },
                  { v: 'RAMAL',    cor: '#475569', desc: 'Distribuição' },
                  { v: 'DROP',     cor: '#22c55e', desc: 'Última milha' },
                ].map(({ v, cor, desc }) => {
                  const ativo = (addForm.tipoRota ?? 'RAMAL') === v
                  return (
                    <button key={v} type="button"
                      onClick={() => setAddForm((p) => ({ ...p, tipoRota: v }))}
                      style={{
                        flex: 1,
                        backgroundColor: ativo ? `${cor}22` : (isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'),
                        border: `1px solid ${ativo ? cor + '66' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                        borderRadius: 10, padding: '8px 4px',
                        transition: 'all .15s',
                      }}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <span style={{ color: ativo ? cor : (isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8'), fontWeight: 700, fontSize: 12 }}>{v}</span>
                      <span style={{ color: ativo ? cor : (isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'), fontSize: 10 }}>{desc}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Tipo chips para caixa */}
            {addMode === 'caixa' && (
              <div className="flex gap-2 mb-4">
                {[
                  { v: 'CDO', cor: '#a855f7' },
                  { v: 'CE',  cor: '#3b82f6' },
                ].map(({ v, cor }) => {
                  const ativo = (addForm.tipo ?? 'CDO') === v
                  return (
                    <button key={v} type="button"
                      onClick={() => setAddForm((p) => ({ ...p, tipo: v }))}
                      style={{
                        flex: 1,
                        backgroundColor: ativo ? `${cor}22` : (isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'),
                        border: `1px solid ${ativo ? cor + '55' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                        borderRadius: 10, padding: '8px 4px',
                        color: ativo ? cor : (isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8'),
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
                <label style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 4 }}>ID *</label>
                <input
                  value={addForm.id ?? ''}
                  onChange={(e) => setAddForm((p) => ({ ...p, id: e.target.value }))}
                  placeholder={addMode === 'cto' ? 'ex: CTO-001' : addMode === 'caixa' ? 'ex: CDO-001' : addMode === 'poste' ? 'ex: PT-001' : 'ex: RT-001'}
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #e2e8f0', color: isDark ? '#e2e8f0' : '#0f172a', fontSize: 13, outline: 'none' }}
                  className="w-full rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome</label>
                <input
                  value={addForm.nome ?? ''}
                  onChange={(e) => setAddForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Opcional"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #e2e8f0', color: isDark ? '#e2e8f0' : '#0f172a', fontSize: 13, outline: 'none' }}
                  className="w-full rounded-lg px-3 py-2"
                />
              </div>

              {addMode === 'cto' && (
                <div className="col-span-2">
                  <label style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.35)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 4 }}>Capacidade</label>
                  <select
                    value={addForm.capacidade ?? 16}
                    onChange={(e) => setAddForm((p) => ({ ...p, capacidade: parseInt(e.target.value) }))}
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #e2e8f0', color: isDark ? '#e2e8f0' : '#0f172a', fontSize: 13, outline: 'none' }}
                    className="w-full rounded-lg px-3 py-2"
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
                  onClick={() => {
                    setAddRoutePoints((p) => p.slice(0, -1))
                    setAddRouteLinks((p) => p.filter(l => l.pointIndex < addRoutePoints.length - 1))
                    if (addRoutePoints.length <= 2) setRouteFinalized(false)
                  }}
                  disabled={addRoutePoints.length === 0}
                  style={{ border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0', color: isDark ? 'rgba(255,255,255,0.4)' : '#64748b' }}
                  className="flex-1 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-40"
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
      {/* ── Modo Simulação: banner + resultado ──────────────────────────── */}

      {/* Banner de instrução */}
      {simMode && !simResult && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold shadow-lg flex items-center gap-3 whitespace-nowrap"
          style={{
            backgroundColor: isDark ? 'rgba(8,13,28,0.95)' : 'rgba(255,255,255,0.97)',
            border: '1.5px solid rgba(212,98,43,0.6)',
            color: '#D4622B',
            boxShadow: '0 4px 20px rgba(212,98,43,0.2)',
          }}
        >
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#D4622B',
            display: 'inline-block', animation: 'gps-pulse 1.2s ease-in-out infinite',
          }} />
          {simLoading
            ? <><span style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>Analisando localização...</span></>
            : <><span style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>Clique no mapa para simular uma instalação</span></>}
          <button onClick={cancelSimMode} style={{ color: 'rgba(212,98,43,0.6)', marginLeft: 4 }}>✕</button>
        </div>
      )}

      {/* Resultado da simulação */}
      {simResult && (
        <SimResultCard
          result={simResult}
          isDark={isDark}
          onClose={cancelSimMode}
          onNewClick={() => { setSimResult(null); setSimConfirm(false); setSimCliente('') }}
          onConfirmOpen={() => { setSimConfirm(true); setSimCliente('') }}
          simConfirm={simConfirm}
          simCliente={simCliente}
          setSimCliente={setSimCliente}
          onConfirmInstall={async () => {
            if (!simResult?.success) return
            const { manualProvision } = await import('@/actions/provisioning')
            try {
              await manualProvision({
                serial:  `SIM-${Date.now()}`,
                cliente: simCliente.trim() || 'Cliente Simulado',
                ctoId:   simResult.cto_id,
              })
              setMovimentacaoEl({ cto_id: simResult.cto_id, nome: simResult.cto_nome })
              cancelSimMode()
            } catch (e) {
              console.error('[Sim confirm]', e.message)
            }
          }}
          onOpenModal={() => {
            if (simResult?.success) {
              setMovimentacaoEl({ cto_id: simResult.cto_id, nome: simResult.cto_nome, lat: simResult.cto_lat, lng: simResult.cto_lng })
              cancelSimMode()
            }
          }}
        />
      )}

      {/* Overlay de edição de rota */}
      {editingRota && (
        <div
          className="absolute bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl"
          style={{
            backgroundColor: isDark ? 'rgba(8,13,28,0.98)' : 'rgba(255,255,255,0.99)',
            borderTop: '3px solid #6366f1',
          }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0' }} />
          </div>
          <div className="px-4 pb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ color: isDark ? '#e2e8f0' : '#0f172a', fontWeight: 700, fontSize: 15 }}>
                ✏️ Editando rota — {editingRota.rota_id}
              </h3>
              <button onClick={() => setEditingRota(null)} style={{ color: isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8', fontSize: 20 }} className="hover:text-current transition-colors">✕</button>
            </div>
            <p style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.35)' : '#64748b', marginBottom: 14 }}>
              Arraste os pontos no mapa para editar o traçado ({editingRota.coordinates.length} pontos)
            </p>
            {editRotaErro && (
              <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }} className="rounded-lg px-3 py-2 text-xs text-red-400 mb-3">
                {editRotaErro}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setEditingRota(null)}
                style={{ border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0', color: isDark ? 'rgba(255,255,255,0.4)' : '#64748b' }}
                className="flex-1 py-2.5 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEditRota}
                disabled={editRotaSaving}
                style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 700 }}
                className="flex-1 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {editRotaSaving ? 'Salvando...' : '💾 Salvar rota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SimResultCard — resultado da simulação de instalação
// ---------------------------------------------------------------------------

function SimResultCard({
  result, isDark, onClose, onNewClick,
  onConfirmOpen, simConfirm, simCliente, setSimCliente,
  onConfirmInstall, onOpenModal,
}) {
  const SIG_COLOR = {
    EXCELENTE: '#22c55e',
    BOM:       '#4ade80',
    LIMITE:    '#D4622B',
    CRÍTICO:   '#ef4444',
  }

  const sigColor  = SIG_COLOR[result.signal_quality] ?? '#94a3b8'
  const bg        = isDark ? 'rgba(6,10,22,0.97)' : 'rgba(255,255,255,0.99)'
  const border    = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0'
  const textMain  = isDark ? '#f1f5f9' : '#0f172a'
  const textMuted = isDark ? '#94a3b8' : '#64748b'

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      zIndex: 50,
      borderRadius: '20px 20px 0 0',
      background: bg,
      borderTop: `3px solid ${result.success ? sigColor : '#ef4444'}`,
      boxShadow: isDark ? '0 -8px 40px rgba(0,0,0,0.7)' : '0 -8px 40px rgba(0,0,0,0.15)',
      maxHeight: '70vh',
      overflowY: 'auto',
    }}>
      {/* Handle */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0' }} />
      </div>

      <div style={{ padding: '0 16px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 16 }}>🔬</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: textMain }}>
                Simulação de Instalação
              </span>
            </div>
            <span style={{ fontSize: 11, color: textMuted }}>
              {result.success ? 'CTO selecionada automaticamente pelo sistema' : 'Todas as CTOs sem portas disponíveis'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: textMuted, fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}
          >✕</button>
        </div>

        {/* Main result card */}
        {result.success ? (
          <>
            {/* CTO info */}
            <div style={{
              borderRadius: 12,
              border: `1.5px solid ${sigColor}44`,
              background: `${sigColor}0d`,
              padding: '12px 14px',
              marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', background: sigColor,
                  display: 'inline-block', boxShadow: `0 0 8px ${sigColor}`,
                }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: textMain }}>{result.cto_nome}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '2px 8px',
                  borderRadius: 99, background: `${sigColor}22`, color: sigColor,
                }}>{result.signal_quality}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                {[
                  ['Distância',  result.distance_fmt],
                  ['RX estimado', `${result.estimated_rx} dBm`],
                  ['Porta',      result.port ? `Porta ${result.port}` : '—'],
                  ['Portas livres', result.livres],
                  ['OLT',        result.olt_nome ?? '—'],
                  ['PON',        result.pon ?? '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span style={{ fontSize: 10, color: textMuted, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: textMain, fontFamily: typeof v === 'number' || String(v).match(/^\d|dBm|—/) ? 'monospace' : 'inherit' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Diagnostics */}
            {result.diags?.length > 0 && (
              <div style={{
                background: 'rgba(212,98,43,0.08)', border: '1px solid rgba(212,98,43,0.3)',
                borderRadius: 8, padding: '8px 12px', marginBottom: 12,
              }}>
                {result.diags.map((d, i) => (
                  <p key={i} style={{ fontSize: 11, color: '#D4622B', margin: 0 }}>⚠ {d}</p>
                ))}
              </div>
            )}

            {/* Alternatives */}
            {result.alternatives?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: textMuted, marginBottom: 6 }}>
                  Alternativas
                </p>
                {result.alternatives.map(alt => (
                  <div key={alt.cto_id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}`,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: SIG_COLOR[alt.signal] ?? '#94a3b8',
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: textMain, flex: 1 }}>{alt.nome}</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: textMuted }}>{alt.distance_fmt}</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: SIG_COLOR[alt.signal] ?? textMuted }}>{alt.rx_estimate} dBm</span>
                    <span style={{ fontSize: 10, color: textMuted }}>{alt.livres} livre{alt.livres !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Confirm panel */}
            {simConfirm ? (
              <div style={{
                background: isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.04)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 10, padding: '12px 14px', marginBottom: 10,
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', marginBottom: 10 }}>
                  Confirmar Instalação em {result.cto_nome}
                </p>
                <p style={{ fontSize: 11, color: textMuted, marginBottom: 8 }}>
                  Nome do cliente (será vinculado à CTO e enviado para provisionamento):
                </p>
                <input
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                    color: textMain, fontSize: 13,
                    boxSizing: 'border-box', marginBottom: 10, outline: 'none',
                  }}
                  placeholder="Ex: João Silva"
                  value={simCliente}
                  onChange={e => setSimCliente(e.target.value)}
                  autoFocus
                />
                <p style={{ fontSize: 10, color: textMuted, marginBottom: 10 }}>
                  Abre o modal de cliente na CTO <strong>{result.cto_nome}</strong> para atribuição final.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setSimCliente(''); /* close confirm */ onNewClick() }}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 8,
                      border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
                      color: textMuted, background: 'none', cursor: 'pointer', fontSize: 13,
                    }}
                  >Voltar</button>
                  <button
                    onClick={onOpenModal}
                    style={{
                      flex: 2, padding: '9px 0', borderRadius: 8,
                      background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                      color: '#052e16', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 13,
                    }}
                  >Abrir CTO e Vincular Cliente</button>
                </div>
              </div>
            ) : (
              /* Action buttons */
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={onNewClick}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
                    color: textMuted, background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >Nova simulação</button>
                <button
                  onClick={onConfirmOpen}
                  style={{
                    flex: 2, padding: '10px 0', borderRadius: 10,
                    background: 'linear-gradient(135deg,#0284c7,#0369a1)',
                    color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 13,
                  }}
                >Confirmar Instalação →</button>
              </div>
            )}
          </>
        ) : (
          /* All CTOs full */
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>📦</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>
              {result.message ?? 'Nenhuma CTO disponível'}
            </p>
            {result.cto_nome && (
              <p style={{ fontSize: 12, color: textMuted }}>
                CTO mais próxima: <strong>{result.cto_nome}</strong> ({result.distance_fmt}) — sem portas livres
              </p>
            )}
            <button
              onClick={onNewClick}
              style={{
                marginTop: 14, padding: '10px 24px', borderRadius: 10,
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
                color: textMuted, background: 'none', cursor: 'pointer', fontSize: 13,
              }}
            >Tentar outro ponto</button>
          </div>
        )}
      </div>
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
