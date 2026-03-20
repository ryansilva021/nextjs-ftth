'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'

/**
 * Hook para rastreamento GPS com marcador no mapa.
 *
 * @param {maplibregl.Map | null} map
 * @returns {{
 *   position: { lng: number, lat: number, accuracy: number } | null,
 *   tracking: boolean,
 *   error: string | null,
 *   followMode: boolean,
 *   setFollowMode: (v: boolean) => void,
 *   startTracking: () => void,
 *   stopTracking: () => void,
 * }}
 */
export function useGPS(map) {
  const [position, setPosition]   = useState(null)
  const [tracking, setTracking]   = useState(false)
  const [error, setError]         = useState(null)
  const [followMode, setFollowMode] = useState(false)

  const watchIdRef  = useRef(null)
  const markerRef   = useRef(null)
  const followRef   = useRef(followMode)
  const firstFixRef = useRef(false) // true enquanto ainda não recebeu a 1ª posição

  // Sincronizar followRef com estado
  useEffect(() => {
    followRef.current = followMode
  }, [followMode])

  // Criar / destruir marcador conforme o mapa existir
  useEffect(() => {
    if (!map) return

    // Elemento do marcador: círculo azul com pulso
    const el = document.createElement('div')
    el.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #3b82f6;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 4px rgba(59,130,246,0.4);
      animation: gps-pulse 1.5s ease-in-out infinite;
    `

    // Injetar keyframe de animação uma única vez
    if (!document.getElementById('gps-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'gps-pulse-style'
      style.textContent = `
        @keyframes gps-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(59,130,246,0.5); }
          70%  { box-shadow: 0 0 0 10px rgba(59,130,246,0);   }
          100% { box-shadow: 0 0 0 0   rgba(59,130,246,0);    }
        }
      `
      document.head.appendChild(style)
    }

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
    markerRef.current = marker

    return () => {
      marker.remove()
      markerRef.current = null
    }
  }, [map])

  // Atualizar posição do marcador e modo follow
  useEffect(() => {
    if (!map || !position || !markerRef.current) return

    const lngLat = [position.lng, position.lat]

    markerRef.current.setLngLat(lngLat)

    // Adicionar ao mapa se ainda não estiver
    if (!markerRef.current._map) {
      markerRef.current.addTo(map)
    }

    if (firstFixRef.current) {
      // Primeira posição: voa até o usuário com zoom alto e offset leve para cima
      map.flyTo({ center: lngLat, zoom: 17, duration: 1200, offset: [0, -80] })
      firstFixRef.current = false
    } else if (followRef.current) {
      map.easeTo({ center: lngLat, duration: 800, offset: [0, -60] })
    }
  }, [map, position])

  // ---- startTracking ----
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada neste dispositivo.')
      return
    }

    setError(null)
    setTracking(true)
    firstFixRef.current = true

    function onSuccess(pos) {
      setPosition({
        lat:      pos.coords.latitude,
        lng:      pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      })
      setError(null)
    }

    function onError(err) {
      // Se timeout com alta precisão, tenta novamente com precisão menor
      if (err.code === err.TIMEOUT || err.code === 3) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          () => setError('Não foi possível obter a localização. Verifique se o GPS está ativo.'),
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
        )
      } else if (err.code === err.PERMISSION_DENIED || err.code === 1) {
        setError('Permissão de localização negada. Habilite nas configurações.')
        setTracking(false)
      } else {
        setError('Erro ao obter localização. Tente novamente.')
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      {
        enableHighAccuracy: true,
        maximumAge:         0,
        timeout:            15000,
      }
    )
  }, [])

  // ---- stopTracking ----
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTracking(false)
    setFollowMode(false)

    // Remover marcador do mapa
    if (markerRef.current?._map) {
      markerRef.current.remove()
    }
  }, [])

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return {
    position,
    tracking,
    error,
    followMode,
    setFollowMode,
    startTracking,
    stopTracking,
  }
}
