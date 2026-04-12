'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { buscarClientes, searchGlobal } from '@/actions/search'

/**
 * AGENT_BUSCA — overlay de busca no mapa.
 * Técnico e admin podem buscar clientes e elementos.
 * Ao clicar num resultado → callback onFlyTo({ lat, lng }) + onSelect(item)
 */
export default function BuscaMapa({ projetoId, onFlyTo, onClose }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [tab, setTab]           = useState('clientes') // 'clientes' | 'rede'
  const inputRef  = useRef(null)
  const timerRef  = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const buscar = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      if (tab === 'clientes') {
        const r = await buscarClientes(q, projetoId)
        setResults(r ?? [])
      } else {
        const r = await searchGlobal(q, projetoId)
        const flat = [
          ...(r.ctos   ?? []).map(x => ({ ...x, _tipo: 'CTO',   _id: x.cto_id,   _lat: x.lat, _lng: x.lng })),
          ...(r.caixas ?? []).map(x => ({ ...x, _tipo: 'CDO',   _id: x.id,        _lat: x.lat, _lng: x.lng })),
          ...(r.rotas  ?? []).map(x => ({ ...x, _tipo: 'Rota',  _id: x.rota_id,   _lat: null,  _lng: null  })),
          ...(r.postes ?? []).map(x => ({ ...x, _tipo: 'Poste', _id: x.poste_id,  _lat: x.lat, _lng: x.lng })),
        ]
        setResults(flat)
      }
    } catch (_) {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [tab, projetoId])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(q), 350)
  }

  useEffect(() => {
    if (query.length >= 2) buscar(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  function handleSelect(item) {
    const lat = item._lat ?? item.lat ?? null
    const lng = item._lng ?? item.lng ?? null
    if (lat != null && lng != null) {
      onFlyTo?.({ lat, lng })
    }
    onClose?.()
  }

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 300, display: 'flex', flexDirection: 'column',
      background: 'rgba(221,208,192,0.98)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      {/* Cabeçalho */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#a07040', fontSize: 16, pointerEvents: 'none',
          }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Buscar cliente, CTO, CDO, rota..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#e8dccf',
              border: '1px solid #b8a080',
              borderRadius: 12, padding: '13px 16px 13px 40px',
              color: '#0f0701', fontSize: 15, outline: 'none',
            }}
            onKeyDown={e => e.key === 'Escape' && onClose?.()}
          />
          {loading && (
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#a07040', fontSize: 12 }}>
              ...
            </span>
          )}
        </div>
        <button onClick={onClose} style={{
          background: '#dfd0bc', border: '1px solid #b8a080',
          borderRadius: 10, padding: '12px 14px', color: '#0f0701',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          Fechar
        </button>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0' }}>
        {[
          { key: 'clientes', label: '👤 Clientes' },
          { key: 'rede',     label: '🗺️ Rede' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: tab === key ? 'rgba(255,128,0,0.25)' : '#dfd0bc',
            color: tab === key ? '#92400e' : '#271204',
            transition: 'all 0.15s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Resultados */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 32px' }}>
        {query.length < 2 && (
          <p style={{ color: '#271204', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            Digite ao menos 2 caracteres para buscar
          </p>
        )}

        {query.length >= 2 && !loading && results.length === 0 && (
          <p style={{ color: '#271204', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            Nenhum resultado encontrado
          </p>
        )}

        {results.map((item, i) => {
          const isCliente = tab === 'clientes'
          const nome = isCliente ? item.cliente : (item.nome || item._id || '—')
          const sub  = isCliente
            ? `CTO ${item.cto_id}${item.porta ? ` · Porta ${item.porta}` : ''}`
            : `${item._tipo} · ${item._id}`
          const hasCoords = (item._lat ?? item.lat) != null

          return (
            <button
              key={i}
              onClick={() => handleSelect(item)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex',
                alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 12, border: '1px solid #b8a080',
                background: '#e8dccf',
                cursor: hasCoords ? 'pointer' : 'default',
                marginBottom: 4, transition: 'background 0.1s',
                opacity: hasCoords ? 1 : 0.5,
              }}
              onMouseEnter={e => { if (hasCoords) e.currentTarget.style.background = 'rgba(255,128,0,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#e8dccf' }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: isCliente ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {isCliente ? '👤' : { CTO: '📦', CDO: '🔌', Rota: '〰️', Poste: '🏗️' }[item._tipo] ?? '📍'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f0701', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nome}
                </div>
                <div style={{ fontSize: 11, color: '#271204', marginTop: 2 }}>
                  {sub}
                  {!hasCoords && <span style={{ color: '#ef4444', marginLeft: 6 }}>sem coordenadas</span>}
                </div>
              </div>
              {hasCoords && (
                <span style={{ fontSize: 16, color: '#d97706', flexShrink: 0 }}>→</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
