'use client'

import { useEffect, useState } from 'react'

// WMO Weather Interpretation Codes → { day, night, desc }
const WMO = {
  0:  { day: '☀️',  night: '🌙',  desc: 'Céu limpo' },
  1:  { day: '🌤️', night: '🌤️', desc: 'Quase limpo' },
  2:  { day: '⛅',  night: '⛅',  desc: 'Parcialmente nublado' },
  3:  { day: '☁️',  night: '☁️',  desc: 'Nublado' },
  45: { day: '🌫️', night: '🌫️', desc: 'Neblina' },
  48: { day: '🌫️', night: '🌫️', desc: 'Neblina com gelo' },
  51: { day: '🌦️', night: '🌧️', desc: 'Garoa leve' },
  53: { day: '🌦️', night: '🌧️', desc: 'Garoa moderada' },
  55: { day: '🌧️', night: '🌧️', desc: 'Garoa forte' },
  61: { day: '🌧️', night: '🌧️', desc: 'Chuva leve' },
  63: { day: '🌧️', night: '🌧️', desc: 'Chuva moderada' },
  65: { day: '🌧️', night: '🌧️', desc: 'Chuva forte' },
  71: { day: '🌨️', night: '🌨️', desc: 'Neve leve' },
  73: { day: '🌨️', night: '🌨️', desc: 'Neve moderada' },
  75: { day: '❄️',  night: '❄️',  desc: 'Neve forte' },
  80: { day: '🌦️', night: '🌧️', desc: 'Pancadas leves' },
  81: { day: '⛈️',  night: '⛈️',  desc: 'Pancadas moderadas' },
  82: { day: '⛈️',  night: '⛈️',  desc: 'Pancadas fortes' },
  95: { day: '⛈️',  night: '⛈️',  desc: 'Tempestade' },
  96: { day: '⛈️',  night: '⛈️',  desc: 'Tempestade c/ granizo' },
  99: { day: '⛈️',  night: '⛈️',  desc: 'Tempestade forte' },
}

function wmo(code, isDay) {
  const entry = WMO[code] ?? { day: '🌡️', night: '🌡️', desc: '—' }
  return { icon: isDay ? entry.day : entry.night, desc: entry.desc }
}

export default function WeatherWidget() {
  const [state, setState] = useState('idle') // idle | loading | ok | error | denied
  const [weather, setWeather] = useState(null)
  const [city, setCity] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) { setState('error'); return }
    setState('loading')

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lon } = coords
        try {
          // Open-Meteo — sem chave de API
          const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m,is_day` +
            `&wind_speed_unit=kmh&timezone=auto`

          const res  = await fetch(url, { cache: 'no-store' })
          const data = await res.json()
          const cur  = data.current

          setWeather({
            temp:     Math.round(cur.temperature_2m),
            code:     cur.weathercode,
            wind:     Math.round(cur.windspeed_10m),
            humidity: cur.relativehumidity_2m,
            isDay:    cur.is_day === 1,
          })

          // Geocode reverso (Open-Meteo não retorna cidade — usa nominatim)
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt-BR`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          )
          const geoData = await geo.json()
          const addr = geoData?.address
          setCity(addr?.city || addr?.town || addr?.village || addr?.county || null)

          setState('ok')
        } catch {
          setState('error')
        }
      },
      (err) => {
        setState(err.code === 1 ? 'denied' : 'error')
      },
      { timeout: 8000, maximumAge: 60_000 }
    )
  }, [])

  // Não renderiza nada até ter dados (não ocupa espaço no idle)
  if (state === 'idle') return null

  const cardStyle = {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 40,
    background: 'rgba(15,7,1,0.78)',
    border: '1px solid rgba(212,98,43,0.30)',
    borderRadius: 12,
    backdropFilter: 'blur(12px)',
    padding: '8px 12px',
    minWidth: 130,
    boxShadow: '0 4px 18px rgba(0,0,0,0.45)',
    fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    color: '#f0e4d0',
    userSelect: 'none',
    pointerEvents: 'none',
  }

  if (state === 'loading') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18, opacity: 0.5 }}>🌡️</span>
          <span style={{ fontSize: 11, color: '#c8a878' }}>Carregando…</span>
        </div>
      </div>
    )
  }

  if (state === 'denied' || state === 'error') {
    return (
      <div style={{ ...cardStyle, opacity: 0.7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🌡️</span>
          <span style={{ fontSize: 10, color: '#c8a878' }}>
            {state === 'denied' ? 'Localização bloqueada' : 'Clima indisponível'}
          </span>
        </div>
      </div>
    )
  }

  const { icon, desc } = wmo(weather.code, weather.isDay)

  return (
    <div style={cardStyle}>
      {/* Linha principal: ícone + temperatura */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 26, lineHeight: 1 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: '#fff' }}>
            {weather.temp}°C
          </div>
          <div style={{ fontSize: 10, color: '#c8a878', marginTop: 1 }}>
            {desc}
          </div>
        </div>
      </div>

      {/* Linha secundária: vento + umidade */}
      <div style={{
        display: 'flex', gap: 10,
        fontSize: 10, color: '#a89070',
        borderTop: '1px solid rgba(212,98,43,0.15)',
        paddingTop: 4, marginTop: 2,
      }}>
        <span title="Velocidade do vento">💨 {weather.wind} km/h</span>
        <span title="Umidade relativa">💧 {weather.humidity}%</span>
      </div>

      {/* Cidade */}
      {city && (
        <div style={{
          fontSize: 9, color: '#7a6050', marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 160,
        }}>
          📍 {city}
        </div>
      )}
    </div>
  )
}
