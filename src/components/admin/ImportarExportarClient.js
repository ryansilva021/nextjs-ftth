'use client'

import { useState, useRef } from 'react'
import { upsertCTO } from '@/actions/ctos'
import { upsertCaixa } from '@/actions/caixas'
import { upsertRota } from '@/actions/rotas'
import { upsertPoste } from '@/actions/postes'
import { upsertOLT } from '@/actions/olts'

// ─── Utilities ───────────────────────────────────────────────────────────────

function slugify(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '').slice(0, 40) || `item_${Date.now()}`
}

function escXML(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Export generators ───────────────────────────────────────────────────────

function genJSON(ctos, caixas, rotas, postes) {
  return JSON.stringify({ ctos, caixas, rotas, postes }, null, 2)
}

function genKML(ctos, caixas, rotas, postes) {
  const pm = (name, desc, geo) =>
    `  <Placemark>\n    <name>${escXML(name)}</name>\n    <description>${escXML(desc)}</description>\n    ${geo}\n  </Placemark>`

  const lines = [
    ...ctos.map(c =>
      pm(c.nome || c.cto_id, 'CTO',
        `<Point><coordinates>${c.lng},${c.lat},0</coordinates></Point>`)),
    ...caixas.map(c =>
      pm(c.nome || c.id, 'CDO',
        `<Point><coordinates>${c.lng},${c.lat},0</coordinates></Point>`)),
    ...(postes || []).map(p =>
      pm(p.nome || p.poste_id, 'Poste',
        `<Point><coordinates>${p.lng},${p.lat},0</coordinates></Point>`)),
    ...(rotas?.features || []).map(f => {
      const coords = f.geometry.coordinates.map(([lng, lat]) => `${lng},${lat},0`).join(' ')
      return pm(f.properties.nome || f.properties.rota_id, `Rota ${f.properties.tipo}`,
        `<LineString><coordinates>${coords}</coordinates></LineString>`)
    }),
  ]

  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n${lines.join('\n')}\n</Document>\n</kml>`
}

function genGeoJSON(ctos, caixas, rotas, postes) {
  const features = [
    ...ctos.map(c => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { tipo: 'CTO', id: c.cto_id, nome: c.nome, capacidade: c.capacidade },
    })),
    ...caixas.map(c => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { tipo: 'CDO', id: c.id, nome: c.nome },
    })),
    ...(postes || []).map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { tipo: 'Poste', id: p.poste_id, nome: p.nome },
    })),
    ...(rotas?.features || []),
  ]
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2)
}

// ─── Import parsers ───────────────────────────────────────────────────────────

function normUpper(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function detectTipoPonto(upper, temNome) {
  if (
    upper.includes('CDO') ||
    upper.includes('CEO') ||
    upper.includes('EMENDA') ||
    /\bCE\b/.test(upper)
  ) return 'cdo'
  if (upper.includes('OLT')) return 'olt'
  if (upper.includes('CTO')) return 'cto'
  if (upper.includes('POSTE') || !temNome) return 'poste'
  return 'cto'
}

function detectTipoRota(upper) {
  if (upper.includes('BACKBONE') || upper.includes('TRONCO')) return 'BACKBONE'
  if (upper.includes('DROP')) return 'DROP'
  return 'RAMAL'
}

function parseKMLText(text) {
  const doc   = new DOMParser().parseFromString(text, 'text/xml')
  const items = []

  doc.querySelectorAll('Placemark').forEach((pm, idx) => {
    const name  = pm.querySelector('name')?.textContent?.trim() || `Item ${idx + 1}`
    const desc  = pm.querySelector('description')?.textContent || ''
    const upper = normUpper(`${name} ${desc}`)
    const ptEl  = pm.querySelector('Point coordinates')
    const lsEl  = pm.querySelector('LineString coordinates')

    if (ptEl) {
      const parts = ptEl.textContent.trim().split(',')
      const lng = parseFloat(parts[0])
      const lat = parseFloat(parts[1])
      if (isNaN(lng) || isNaN(lat)) return
      const rawName = pm.querySelector('name')?.textContent?.trim() || ''
      items.push({
        tipo: detectTipoPonto(upper, rawName.length > 0),
        id:   slugify(name) || `item_${idx}`,
        nome: name, lat, lng, capacidade: 16,
      })
    } else if (lsEl) {
      const coords = lsEl.textContent.trim().split(/\s+/).map(c => {
        const [lng, lat] = c.split(',').map(Number)
        return [lng, lat]
      }).filter(([a, b]) => !isNaN(a) && !isNaN(b))
      if (coords.length < 2) return
      items.push({
        tipo:      'rota',
        id:        slugify(name) || `rota_${idx}`,
        nome:      name,
        coordinates: coords,
        tipoRota:  detectTipoRota(upper),
      })
    }
  })
  return items
}

function parseDXFText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim())
  const pairs = []
  for (let i = 0; i + 1 < lines.length; i += 2) {
    pairs.push([parseInt(lines[i]), lines[i + 1] ?? ''])
  }

  // Find ENTITIES section
  const startIdx = pairs.findIndex((p, i) =>
    p[0] === 0 && p[1] === 'SECTION' &&
    pairs[i + 1]?.[0] === 2 && pairs[i + 1]?.[1] === 'ENTITIES'
  )
  if (startIdx < 0) return []

  const raw  = []
  let   ent  = null

  for (let i = startIdx + 2; i < pairs.length; i++) {
    const [code, val] = pairs[i]
    if (code === 0) {
      if (ent) raw.push(ent)
      if (val === 'ENDSEC' || val === 'EOF') break
      ent = { t: val, layer: '', x1: NaN, y1: NaN, x2: NaN, y2: NaN }
    } else if (ent) {
      if (code === 8)  ent.layer = val
      else if (code === 10) ent.x1 = parseFloat(val)
      else if (code === 20) ent.y1 = parseFloat(val)
      else if (code === 11) ent.x2 = parseFloat(val)
      else if (code === 21) ent.y2 = parseFloat(val)
    }
  }
  if (ent) raw.push(ent)

  return raw.flatMap((e, idx) => {
    const upper = normUpper(e.layer)

    if (e.t === 'LINE' && !isNaN(e.x1) && !isNaN(e.y1) && !isNaN(e.x2) && !isNaN(e.y2)) {
      return [{
        tipo:        'rota',
        id:          `rota_dxf_${idx}`,
        nome:        e.layer || `Rota ${idx + 1}`,
        coordinates: [[e.x1, e.y1], [e.x2, e.y2]],
        tipoRota:    detectTipoRota(upper),
      }]
    }
    if (e.t === 'POINT' && !isNaN(e.x1) && !isNaN(e.y1)) {
      return [{
        tipo:       detectTipoPonto(upper, e.layer.length > 0),
        id:         `ponto_dxf_${idx}`,
        nome:       e.layer || `Ponto ${idx + 1}`,
        lat:        e.y1,
        lng:        e.x1,
        capacidade: 16,
      }]
    }
    return []
  })
}

function parseJSONImport(text) {
  const data  = JSON.parse(text)
  const items = []
  if (Array.isArray(data.ctos))
    data.ctos.forEach(c =>
      items.push({ tipo: 'cto', id: c.cto_id, nome: c.nome, lat: c.lat, lng: c.lng, capacidade: c.capacidade || 16 }))
  if (Array.isArray(data.caixas))
    data.caixas.forEach(c =>
      items.push({ tipo: 'cdo', id: c.id || c.ce_id, nome: c.nome, lat: c.lat, lng: c.lng }))
  if (Array.isArray(data.postes))
    data.postes.forEach(p =>
      items.push({ tipo: 'poste', id: p.poste_id, nome: p.nome, lat: p.lat, lng: p.lng }))
  if (data.rotas?.features)
    data.rotas.features.forEach(f =>
      items.push({
        tipo: 'rota',
        id:   f.properties.rota_id,
        nome: f.properties.nome,
        coordinates: f.geometry.coordinates,
        tipoRota: f.properties.tipo || 'RAMAL',
      }))
  return items
}

function parseGeoJSONImport(text) {
  const data     = JSON.parse(text)
  const features = data.features || [data]
  return features.flatMap((f, idx) => {
    const p  = f.properties || {}
    const gt = f.geometry?.type
    if (gt === 'Point') {
      const [lng, lat] = f.geometry.coordinates
      const tipoProp   = normUpper(p.tipo || p.nome || '')
      const tipo = detectTipoPonto(tipoProp, !!(p.nome || p.tipo))
      return [{ tipo, id: p.id || p.cto_id || `ponto_${idx}`, nome: p.nome || `Ponto ${idx + 1}`, lat, lng, capacidade: p.capacidade || 16 }]
    }
    if (gt === 'LineString') {
      return [{
        tipo:        'rota',
        id:          p.rota_id || p.id || `rota_${idx}`,
        nome:        p.nome || `Rota ${idx + 1}`,
        coordinates: f.geometry.coordinates,
        tipoRota:    p.tipo || 'RAMAL',
      }]
    }
    return []
  })
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_COR   = { cto: '#0284c7', cdo: '#7c3aed', poste: '#d97706', rota: '#059669', olt: '#0891b2' }
const TIPO_LABEL = { cto: 'CTO', cdo: 'CDO', poste: 'Poste', rota: 'Rota', olt: 'OLT' }
const TIPOS_PONTO = ['cto', 'cdo', 'poste', 'olt']
const TIPOS_ROTA  = ['RAMAL', 'BACKBONE', 'DROP']

const S = {
  card: {
    background:   'var(--card-bg)',
    border:       '1px solid var(--border-color)',
    borderRadius: 12,
    padding:      20,
  },
  label: {
    fontSize:      11,
    color:         'var(--text-secondary)',
    fontWeight:    600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom:  6,
  },
  tabBtn: (ativa) => ({
    padding:      '10px 24px',
    borderRadius: '8px 8px 0 0',
    border:       'none',
    cursor:       'pointer',
    fontWeight:   600,
    fontSize:     14,
    background:   ativa ? 'var(--card-bg-active)' : 'transparent',
    color:        ativa ? 'var(--foreground)' : 'var(--text-muted)',
    borderBottom: ativa ? '2px solid #0284c7' : '2px solid transparent',
    transition:   'all .15s',
  }),
  btn: (color) => ({
    padding:      '10px 18px',
    borderRadius: 8,
    border:       `1px solid ${color}44`,
    cursor:       'pointer',
    fontWeight:   600,
    fontSize:     13,
    background:   `${color}1a`,
    color,
  }),
}

// ─── Preview row (editável) ───────────────────────────────────────────────────

const cellStyle = { padding: '4px 6px', verticalAlign: 'middle' }
const inputStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: 5,
  color: 'var(--foreground)',
  fontSize: 12,
  padding: '3px 7px',
  width: '100%',
  outline: 'none',
}
const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
  width: 'auto',
}

function PreviewRow({ item, onChange }) {
  const cor = TIPO_COR[item.tipo] || '#6366f1'
  const isRota = item.tipo === 'rota'

  return (
    <tr style={{ borderTop: '1px solid var(--border-color)' }}>
      {/* Tipo */}
      <td style={cellStyle}>
        {isRota ? (
          <select
            value={item.tipoRota || 'RAMAL'}
            onChange={e => onChange({ tipoRota: e.target.value })}
            style={{ ...selectStyle, color: TIPO_COR.rota, background: `${TIPO_COR.rota}18` }}
          >
            {TIPOS_ROTA.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : (
          <select
            value={item.tipo}
            onChange={e => onChange({ tipo: e.target.value })}
            style={{ ...selectStyle, color: cor, background: `${cor}18` }}
          >
            {TIPOS_PONTO.map(t => (
              <option key={t} value={t}>{TIPO_LABEL[t]}</option>
            ))}
          </select>
        )}
      </td>
      {/* Nome */}
      <td style={cellStyle}>
        <input
          value={item.nome || ''}
          onChange={e => onChange({ nome: e.target.value })}
          style={inputStyle}
          placeholder="Nome…"
        />
      </td>
      {/* Coords */}
      <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {item.lat != null
          ? `${Number(item.lat).toFixed(5)}, ${Number(item.lng).toFixed(5)}`
          : `${item.coordinates?.length ?? 0} pts`}
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ImportarExportarClient({ ctos, caixas, rotas, postes, projetoId }) {
  const [aba,           setAba]          = useState('exportar')
  const [preview,       setPreview]       = useState(null)   // Item[]
  const [parseErro,     setParseErro]     = useState(null)
  const [importando,    setImportando]    = useState(false)
  const [resultado,     setResultado]     = useState(null)   // { ok, erros }
  const fileRef = useRef(null)

  // ── Export ──────────────────────────────────────────────────────────────────

  function exportar(formato) {
    const base = `fiberops_${projetoId}_${new Date().toISOString().slice(0, 10)}`
    if (formato === 'json')    downloadFile(genJSON(ctos, caixas, rotas, postes),    `${base}.json`,    'application/json')
    if (formato === 'kml')     downloadFile(genKML(ctos, caixas, rotas, postes),     `${base}.kml`,     'application/vnd.google-earth.kml+xml')
    if (formato === 'geojson') downloadFile(genGeoJSON(ctos, caixas, rotas, postes), `${base}.geojson`, 'application/geo+json')
  }

  // ── Import: read & parse ────────────────────────────────────────────────────

  async function handleFile(e) {
    setParseErro(null)
    setPreview(null)
    setResultado(null)
    const file = e.target.files?.[0]
    if (!file) return
    const ext  = file.name.split('.').pop().toLowerCase()
    const text = await file.text()

    try {
      let items = []
      if      (ext === 'kml')     items = parseKMLText(text)
      else if (ext === 'dxf')     items = parseDXFText(text)
      else if (ext === 'json')    items = parseJSONImport(text)
      else if (ext === 'geojson') items = parseGeoJSONImport(text)
      else if (ext === 'kmz')     { setParseErro('KMZ: extraia o arquivo KML do ZIP e importe-o diretamente.'); return }
      else                        { setParseErro(`Formato .${ext} não suportado. Use KML, GeoJSON, DXF ou JSON.`); return }

      if (items.length === 0) { setParseErro('Nenhum item reconhecido no arquivo.'); return }
      setPreview(items)
    } catch (err) {
      setParseErro(`Erro ao analisar o arquivo: ${err.message}`)
    }
    if (e.target) e.target.value = ''
  }

  function updateItem(idx, patch) {
    setPreview(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  // ── Import: confirm ─────────────────────────────────────────────────────────

  async function confirmar() {
    if (!preview?.length) return
    setImportando(true)
    const erros = []
    let ok = 0

    for (const item of preview) {
      try {
        if (item.tipo === 'cto') {
          await upsertCTO({
            cto_id: item.id, projeto_id: projetoId,
            lat: item.lat, lng: item.lng,
            nome: item.nome, capacidade: item.capacidade || 16,
          })
        } else if (item.tipo === 'cdo') {
          await upsertCaixa({
            ce_id: item.id, projeto_id: projetoId,
            lat: item.lat, lng: item.lng,
            nome: item.nome, tipo: 'CDO',
          })
        } else if (item.tipo === 'poste') {
          await upsertPoste({
            poste_id: item.id, projeto_id: projetoId,
            lat: item.lat, lng: item.lng,
            nome: item.nome, tipo: 'simples', status: 'ativo',
          })
        } else if (item.tipo === 'olt') {
          await upsertOLT({
            olt_id: item.id, projeto_id: projetoId,
            lat: item.lat, lng: item.lng,
            nome: item.nome, modelo: '', potencia_dbm: 5,
          })
        } else if (item.tipo === 'rota') {
          await upsertRota({
            rota_id: item.id, projeto_id: projetoId,
            coordinates: item.coordinates,
            nome: item.nome, tipo: item.tipoRota || 'RAMAL',
          })
        }
        ok++
      } catch (err) {
        erros.push(`${item.nome || item.id}: ${err.message}`)
      }
    }

    setResultado({ ok, erros })
    setPreview(null)
    setImportando(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100%' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border-color)' }}>
        {[['exportar', '⬇️ Exportar'], ['importar', '⬆️ Importar']].map(([t, label]) => (
          <button key={t} style={S.tabBtn(aba === t)} onClick={() => { setAba(t); setPreview(null); setParseErro(null); setResultado(null) }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── EXPORTAR ── */}
      {aba === 'exportar' && (
        <div style={S.card}>
          <div style={S.label}>Dados do Projeto</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
            {ctos.length} CTOs · {caixas.length} CDOs · {postes?.length ?? 0} Postes · {rotas?.features?.length ?? 0} Rotas
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {[
              { f: 'json',    label: 'JSON',    desc: 'Padrão do sistema',   color: '#6366f1' },
              { f: 'kml',     label: 'KML',     desc: 'Google Earth / QGIS', color: '#22c55e' },
              { f: 'geojson', label: 'GeoJSON', desc: 'Padrão GIS / Web',    color: '#f59e0b' },
            ].map(({ f, label, desc, color }) => (
              <button
                key={f}
                onClick={() => exportar(f)}
                style={{
                  ...S.btn(color),
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'flex-start',
                  padding:        '14px 20px',
                  gap:            4,
                  minWidth:       160,
                }}
              >
                <span style={{ fontSize: 15 }}>⬇️ {label}</span>
                <span style={{ fontSize: 11, opacity: 0.65, fontWeight: 400 }}>{desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── IMPORTAR ── */}
      {aba === 'importar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Resultado */}
          {resultado && (
            <div style={{ ...S.card, borderColor: resultado.erros.length === 0 ? '#22c55e55' : '#f97316aa' }}>
              <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                ✓ {resultado.ok} item(s) importado(s)
              </div>
              {resultado.erros.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: '#f87171', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    {resultado.erros.length} erro(s):
                  </div>
                  {resultado.erros.map((e, i) => (
                    <div key={i} style={{ color: '#fca5a5', fontSize: 12 }}>• {e}</div>
                  ))}
                </div>
              )}
              <button onClick={() => setResultado(null)} style={{ ...S.btn('var(--text-secondary)'), fontSize: 12, padding: '6px 14px' }}>
                Nova importação
              </button>
            </div>
          )}

          {!resultado && (
            <>
              {/* Drop zone */}
              <div
                style={{
                  ...S.card,
                  textAlign:   'center',
                  cursor:      'pointer',
                  borderStyle: 'dashed',
                  borderColor: 'var(--border-color-strong)',
                  padding:     32,
                }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file) handleFile({ target: { files: [file] } })
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
                <div style={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 6 }}>
                  Arraste o arquivo ou clique para selecionar
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  Suportado: KML · GeoJSON · DXF · JSON (exportação FiberOps)
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".kml,.kmz,.dxf,.json,.geojson"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />
              </div>

              {/* Dicas de conversão */}
              <div style={{ ...S.card, background: 'var(--card-bg)', padding: '12px 16px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Dicas de importação
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>• <b style={{ color: 'var(--text-muted)' }}>KML/Google Earth:</b> Placemarks com "CTO", "CDO" ou "POSTE" no nome → elementos; LineStrings → rotas</span>
                  <span>• <b style={{ color: 'var(--text-muted)' }}>DXF/AutoCAD:</b> Entidades LINE → rotas; POINT → elementos (tipo pelo nome da layer)</span>
                  <span>• <b style={{ color: 'var(--text-muted)' }}>KMZ:</b> Extraia o .kml de dentro do .kmz (é um ZIP) e importe-o</span>
                  <span>• <b style={{ color: 'var(--text-muted)' }}>Coordenadas DXF:</b> X = longitude, Y = latitude (WGS84)</span>
                </div>
              </div>

              {/* Erro de parse */}
              {parseErro && (
                <div style={{ ...S.card, borderColor: '#ef444455', color: '#fca5a5', fontSize: 13 }}>
                  ⚠️ {parseErro}
                </div>
              )}

              {/* Preview */}
              {preview && (
                <div style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                      {preview.length} item(s) encontrado(s) — revise antes de confirmar
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setPreview(null)}
                        style={{ ...S.btn('var(--text-secondary)'), padding: '6px 14px', fontSize: 12 }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={confirmar}
                        disabled={importando}
                        style={{ ...S.btn('#22c55e'), padding: '6px 18px', fontSize: 12, opacity: importando ? 0.6 : 1 }}
                      >
                        {importando ? 'Importando…' : '✓ Confirmar importação'}
                      </button>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>
                          <th style={{ textAlign: 'left', padding: '4px 6px' }}>Tipo</th>
                          <th style={{ textAlign: 'left', padding: '4px 6px' }}>Nome</th>
                          <th style={{ textAlign: 'left', padding: '4px 6px' }}>Coords / Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((item, i) => (
                          <PreviewRow key={i} item={item} onChange={patch => updateItem(i, patch)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  )
}
