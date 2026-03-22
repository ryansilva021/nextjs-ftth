'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

// Mapa sempre no estilo claro (positron) independente do tema da UI
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

export function useMap(containerRef, options = {}) {
  const mapRef = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [map, setMap]             = useState(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return

    const {
      center = [-46.633308, -23.55052],
      zoom   = 13,
      // eslint-disable-next-line no-unused-vars
      darkMode,
      ...rest
    } = options

    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center,
      zoom,
      attributionControl: false,
      ...rest,
    })

    instance.on('error', (e) => {
      if (e?.error?.message?.includes('Failed to fetch') ||
          e?.error?.message?.includes('404') ||
          e?.error?.name === 'AbortError') return
      console.error('[MapLibre]', e?.error ?? e)
    })

    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')
    instance.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')

    instance.on('load', () => setMapLoaded(true))

    mapRef.current = instance
    setMap(instance)

    return () => {
      instance.remove()
      mapRef.current = null
      setMap(null)
      setMapLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  return { mapRef, mapLoaded, map }
}
