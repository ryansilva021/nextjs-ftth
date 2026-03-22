'use server'

/**
 * src/actions/topologia.js
 * Server Actions para traversal de topologia FTTH e cálculo de potência.
 */

import { connectDB } from '@/lib/db'
import { ALL_ROLES } from '@/lib/auth'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { OLT } from '@/models/OLT'
import { CaixaEmendaCDO } from '@/models/CaixaEmendaCDO'
import { CTO } from '@/models/CTO'
import { Rota } from '@/models/Rota'

// ─── Helpers geométricos ──────────────────────────────────────────────────────

function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return 0
  const R    = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const h    = Math.sin(dLat / 2) ** 2 +
               Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
               Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function rotaDistKm(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return 0
  let d = 0
  for (let i = 0; i < coords.length - 1; i++) {
    d += haversineKm(
      { lng: coords[i][0], lat: coords[i][1] },
      { lng: coords[i + 1][0], lat: coords[i + 1][1] }
    )
  }
  return Math.round(d * 1000) / 1000
}

/** Normaliza "1x8" ou "1X8" → "1:8" (compatível com SPLITTER_DB) */
function normSpl(s) {
  return (s || '').replace(/[xX]/, ':').trim()
}

// ─── ABNT NBR 14992 — cores de fibra ──────────────────────────────────────────
const ABNT_CORES = ['Azul','Laranja','Verde','Marrom','Cinza','Branco','Vermelho','Preto','Amarelo','Violeta','Rosa','Aqua']
const ABNT_HEX   = ['#2563eb','#f97316','#16a34a','#92400e','#64748b','#e2e8f0','#dc2626','#1e293b','#ca8a04','#7c3aed','#db2777','#0891b2']

/** Retorna cor ABNT para uma porta/fibra (1-based, cicla a cada 12) */
function abntFibra(porta) {
  if (!porta || porta < 1) return null
  const idx = (porta - 1) % 12
  return { n: porta, cor: ABNT_CORES[idx], hex: ABNT_HEX[idx] }
}

/**
 * Encontra rota que conecta dois itens da topologia.
 * 1ª tentativa: snap_ids[] contém entradas com ambos os IDs (match exato)
 * 2ª tentativa: obs menciona ambos os IDs (compatibilidade com rotas antigas)
 */
function findRota(rotas, id1, id2) {
  if (!id1 || !id2) return null
  const lo1 = id1.toLowerCase()
  const lo2 = id2.toLowerCase()
  // Tenta match por snap_ids (novo campo — mais confiável)
  const bySnap = rotas.find(r =>
    Array.isArray(r.snap_ids) && r.snap_ids.length >= 2 &&
    r.snap_ids.some(s => s.toLowerCase().includes(lo1)) &&
    r.snap_ids.some(s => s.toLowerCase().includes(lo2))
  )
  if (bySnap) return bySnap
  // Fallback: match por obs (rotas criadas antes do campo snap_ids)
  return rotas.find(r => {
    const obs = (r.obs || '').toLowerCase()
    return obs.includes(lo1) && obs.includes(lo2)
  }) ?? null
}

// ─── getTopologiaLista ────────────────────────────────────────────────────────

/**
 * Retorna lista de CTOs com informação de CDO e OLT vinculados.
 * Usado para popular o seletor de CTO no modo Automático.
 */
export async function getTopologiaLista(projetoId) {
  const session = await requireActiveEmpresa(ALL_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const tp = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const [olts, ctos, caixas] = await Promise.all([
    OLT.find({ projeto_id: tp }, 'id nome lat lng').lean(),
    CTO.find({ projeto_id: tp }, 'cto_id nome cdo_id lat lng').lean(),
    CaixaEmendaCDO.find({ projeto_id: tp }, 'id nome olt_id lat lng').lean(),
  ])

  const caixaMap = Object.fromEntries(caixas.map(c => [c.id, c]))
  const oltMap   = Object.fromEntries(olts.map(o => [o.id, o]))

  const ctosEnriquecidos = ctos.map(cto => {
    const cdo = cto.cdo_id ? caixaMap[cto.cdo_id] ?? null : null
    const olt = cdo?.olt_id ? oltMap[cdo.olt_id] ?? null : null
    return {
      cto_id:   cto.cto_id,
      nome:     cto.nome || cto.cto_id,
      cdo_id:   cto.cdo_id || null,
      cdo_nome: cdo?.nome || cto.cdo_id || null,
      olt_id:   olt?.id || null,
      olt_nome: olt?.nome || null,
      lat:      cto.lat,
      lng:      cto.lng,
    }
  })

  return {
    olts: olts.map(o => ({ id: o.id, nome: o.nome || o.id })),
    ctos: ctosEnriquecidos,
  }
}

// ─── getCaminhoPotencia ───────────────────────────────────────────────────────

/**
 * Percorre a topologia OLT → CDO → CTO e retorna todos os dados
 * necessários para o cálculo automático de potência óptica.
 *
 * @param {string} projetoId
 * @param {string} ctoId
 * @returns {Promise<{ olt, cdo, cto, trechos }>}
 */
export async function getCaminhoPotencia(projetoId, ctoId) {
  const session = await requireActiveEmpresa(ALL_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const tp = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  // ── 1. CTO ──────────────────────────────────────────────────────────────────
  const cto = await CTO.findOne({ projeto_id: tp, cto_id: ctoId }).lean()
  if (!cto) throw new Error(`CTO "${ctoId}" não encontrada`)

  // ── 2. CDO ──────────────────────────────────────────────────────────────────
  const cdo = cto.cdo_id
    ? await CaixaEmendaCDO.findOne({ projeto_id: tp, id: cto.cdo_id }).lean()
    : null

  // ── 3. OLT ──────────────────────────────────────────────────────────────────
  const olt = cdo?.olt_id
    ? await OLT.findOne({ projeto_id: tp, id: cdo.olt_id }).lean()
    : null

  // ── 4. Rotas (para calcular distância real) ─────────────────────────────────
  const rotas = await Rota.find({ projeto_id: tp }, 'rota_id obs snap_ids geojson comprimento_m').lean()

  const rotaOltCdo = olt && cdo ? findRota(rotas, olt.id, cdo.id) : null
  const rotaCdoCto = cdo ? findRota(rotas, cdo.id, ctoId) : null

  const distOltCdo = rotaOltCdo?.geojson?.coordinates?.length >= 2
    ? rotaDistKm(rotaOltCdo.geojson.coordinates)
    : haversineKm(olt, cdo)

  const distCdoCto = rotaCdoCto?.geojson?.coordinates?.length >= 2
    ? rotaDistKm(rotaCdoCto.geojson.coordinates)
    : haversineKm(cdo, cto)

  // ── 5. Splitters e fusões do CDO ─────────────────────────────────────────────
  const cdoDiag  = cdo?.diagrama ?? {}
  let splittersCdo = (cdoDiag.splitters || []).map(s => normSpl(s.tipo)).filter(Boolean)
  // Fallback: campo splitter_cdo da raiz
  if (splittersCdo.length === 0 && cdo?.splitter_cdo) {
    splittersCdo = [normSpl(cdo.splitter_cdo)]
  }
  const fusoesCdo = (cdoDiag.bandejas || []).reduce((acc, b) => acc + (b.fusoes?.length || 0), 0)

  // ── 6. Splitters e fusões do CTO ─────────────────────────────────────────────
  const ctoDiag  = cto?.diagrama ?? {}
  let splittersCto = (ctoDiag.splitters || []).map(s => normSpl(s.tipo)).filter(Boolean)
  // Fallback: campo splitter_cto da raiz
  if (splittersCto.length === 0 && cto?.splitter_cto) {
    splittersCto = [normSpl(cto.splitter_cto)]
  }
  const fusoesCto = (ctoDiag.bandejas || []).reduce((acc, b) =>
    acc + (b.fusoes?.filter(f => f.tipo && f.tipo !== 'livre').length || 0), 0)

  // ── 7. Trechos ──────────────────────────────────────────────────────────────
  const trechos = []

  if (olt && cdo) {
    trechos.push({
      de:           olt.id,
      para:         cdo.id,
      tipoDe:       'OLT',
      tipoPara:     'CDO',
      distKm:       distOltCdo,
      splitters:    splittersCdo,
      nFusoes:      fusoesCdo,
      nConectores:  2,
      fonteDistancia: rotaOltCdo ? 'rota' : 'estimativa',
      rotaId:       rotaOltCdo?.rota_id ?? null,
      // Detalhes de porta e fibra
      portaOLT:     cdo.porta_olt ?? null,
      fibraOLT:     abntFibra(cdo.porta_olt),
      conector:     'SC/APC',
    })
  }

  if (cdo) {
    trechos.push({
      de:           cdo.id,
      para:         cto.cto_id,
      tipoDe:       'CDO',
      tipoPara:     'CTO',
      distKm:       distCdoCto,
      splitters:    splittersCto,
      nFusoes:      fusoesCto,
      nConectores:  2,
      fonteDistancia: rotaCdoCto ? 'rota' : 'estimativa',
      rotaId:       rotaCdoCto?.rota_id ?? null,
      // Detalhes de porta e fibra
      portaCDO:     cto.porta_cdo ?? null,
      fibraCDO:     abntFibra(cto.porta_cdo),
      conector:     'SC/APC',
    })
  }

  // CTO sem topologia configurada
  if (trechos.length === 0) {
    trechos.push({
      de:           'OLT (não vinculada)',
      para:         cto.cto_id,
      tipoDe:       'OLT',
      tipoPara:     'CTO',
      distKm:       0,
      splitters:    splittersCto,
      nFusoes:      fusoesCto,
      nConectores:  2,
      fonteDistancia: 'estimativa',
      rotaId:       null,
      portaOLT:     null,
      fibraOLT:     null,
      conector:     'SC/APC',
    })
  }

  return {
    olt: olt
      ? { id: olt.id, nome: olt.nome || olt.id, lat: olt.lat, lng: olt.lng, modelo: olt.modelo || null, capacidade: olt.capacidade || null }
      : null,
    cdo: cdo
      ? { id: cdo.id, nome: cdo.nome || cdo.id, lat: cdo.lat, lng: cdo.lng, porta_olt: cdo.porta_olt ?? null, splitter: cdo.splitter_cdo || null }
      : null,
    cto: {
      id:         cto.cto_id,
      nome:       cto.nome || cto.cto_id,
      lat:        cto.lat,
      lng:        cto.lng,
      porta_cdo:  cto.porta_cdo ?? null,
      splitter:   cto.splitter_cto || null,
      capacidade: cto.capacidade || null,
    },
    trechos,
  }
}
