'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

/**
 * Inicializa e gerencia uma instância do MapLibre GL.
 *
 * @param {React.RefObject} containerRef - ref do elemento DOM que receberá o mapa
 * @param {Object} [options] - opções extras passadas ao construtor do Map
 * @param {number[]} [options.center] - [lng, lat] inicial (padrão: Brasil)
 * @param {number} [options.zoom] - zoom inicial (padrão: 13)
 * @returns {{ mapRef: React.MutableRefObject, mapLoaded: boolean, map: maplibregl.Map | null }}
 */
export function useMap(containerRef, options = {}) {
  const mapRef = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [map, setMap] = useState(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return // já inicializado

    const {
      center = [-46.633308, -23.55052],
      zoom = 13,
      ...rest
    } = options

    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        name: 'FiberOps Dark',
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#0b1220' },
          },
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            paint: {
              'raster-opacity': 1.0,
              'raster-brightness-min': 0.05,
              'raster-brightness-max': 0.9,
              'raster-saturation': -0.1,
            },
          },
        ],
      },
      center,
      zoom,
      attributionControl: false,
      ...rest,
    })

    instance.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    )

    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      'top-right'
    )

    instance.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-left'
    )

    instance.on('load', () => {
      setMapLoaded(true)
    })

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
