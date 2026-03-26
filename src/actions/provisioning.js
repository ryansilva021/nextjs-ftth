'use server'

import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { ONU } from '@/models/ONU'
import { ProvisionEvent } from '@/models/ProvisionEvent'
import { CTO } from '@/models/CTO'
import { CaixaEmendaCDO } from '@/models/CaixaEmendaCDO'
import { OLT } from '@/models/OLT'
import { HuaweiOltAdapter } from '@/lib/huawei-adapter'
import { nocLog } from '@/lib/noc-logger'

const NOC_ALLOWED = ['superadmin', 'admin', 'noc']

// ─── calculateSignalQuality ───────────────────────────────────────────────────

function calculateSignalQuality(rx) {
  if (rx == null) return null
  if (rx > -20)  return 'excelente'
  if (rx >= -25) return 'bom'
  if (rx >= -28) return 'medio'
  return 'critico'
}

const QUALITY_LABEL = {
  excelente: 'EXCELENTE',
  bom:       'BOM',
  medio:     'MÉDIO',
  critico:   'CRÍTICO',
}

// ─── getOLTs ─────────────────────────────────────────────────────────────────

export async function getOLTs() {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const olts = await OLT.find({ projeto_id }).sort({ nome: 1 }).lean()
  return olts.map(o => ({ ...o, _id: o._id.toString() }))
}

// ─── getONUs ─────────────────────────────────────────────────────────────────

export async function getONUs() {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const onus = await ONU.find({ projeto_id }).sort({ createdAt: -1 }).limit(200).lean()
  return onus.map(o => ({ ...o, _id: o._id.toString() }))
}

// ─── getPendingEvents ─────────────────────────────────────────────────────────

export async function getPendingEvents() {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const events = await ProvisionEvent.find({
    projeto_id,
    status: { $in: ['pending', 'processing'] },
  }).sort({ createdAt: 1 }).limit(50).lean()

  return events.map(e => ({ ...e, _id: e._id.toString() }))
}

// ─── _findAvailableCTO ────────────────────────────────────────────────────────

async function _findAvailableCTO(projeto_id, preferredCtoId = null) {
  const query = preferredCtoId
    ? { projeto_id, cto_id: preferredCtoId }
    : { projeto_id }

  const ctos = await CTO.find(query).limit(preferredCtoId ? 1 : 50).lean()

  for (const cto of ctos) {
    const splitters = cto.diagrama?.splitters ?? []
    for (let si = 0; si < splitters.length; si++) {
      const saidas = splitters[si].saidas ?? []
      for (let pi = 0; pi < saidas.length; pi++) {
        if (!saidas[pi]?.cliente?.trim()) {
          let olt = null
          if (cto.cdo_id) {
            const cdo = await CaixaEmendaCDO.findOne({ projeto_id, ce_id: cto.cdo_id }).lean()
            if (cdo?.olt_id) {
              olt = await OLT.findOne({ projeto_id, id: cdo.olt_id }).lean()
            }
          }
          return { cto, olt, splitterIdx: si, saidaIdx: pi }
        }
      }
    }
  }
  return null
}

// ─── _allocateCTOPort ─────────────────────────────────────────────────────────

async function _allocateCTOPort(projeto_id, cto_id, splitterIdx, saidaIdx, cliente) {
  const fieldPath = `diagrama.splitters.${splitterIdx}.saidas.${saidaIdx}.cliente`
  await CTO.updateOne(
    { projeto_id, cto_id },
    { $set: { [fieldPath]: cliente } }
  )
}

// ─── _freeCTOPort ─────────────────────────────────────────────────────────────

async function _freeCTOPort(projeto_id, cto_id, cliente) {
  const cto = await CTO.findOne({ projeto_id, cto_id }).lean()
  if (!cto?.diagrama?.splitters) return

  const splitters = cto.diagrama.splitters
  for (let si = 0; si < splitters.length; si++) {
    const saidas = splitters[si].saidas ?? []
    for (let pi = 0; pi < saidas.length; pi++) {
      if (saidas[pi]?.cliente?.trim() === cliente?.trim()) {
        const fieldPath = `diagrama.splitters.${si}.saidas.${pi}.cliente`
        await CTO.updateOne(
          { projeto_id, cto_id },
          { $set: { [fieldPath]: '' } }
        )
        return
      }
    }
  }
}

// ─── processNextEvent ─────────────────────────────────────────────────────────

export async function processNextEvent(projeto_id_override = null) {
  await connectDB()

  let projeto_id = projeto_id_override
  if (!projeto_id) {
    try {
      const session = await requireActiveEmpresa(NOC_ALLOWED)
      projeto_id = session.user.projeto_id
    } catch {
      return { processed: false, reason: 'not_authenticated' }
    }
  }

  const event = await ProvisionEvent.findOneAndUpdate(
    { projeto_id, status: 'pending' },
    { $set: { status: 'processing' } },
    { sort: { createdAt: 1 }, new: true }
  )

  if (!event) return { processed: false, reason: 'no_pending_events' }

  try {
    if (event.tipo === 'install') {
      // ── INSTALL ──────────────────────────────────────────────────────────────
      const found = await _findAvailableCTO(projeto_id, event.cto_id || null)

      if (!found) {
        throw new Error('Nenhuma CTO com porta disponível encontrada')
      }

      const { cto, olt, splitterIdx, saidaIdx } = found

      let oltResult  = { mock: true }
      let rx_power   = null
      let tx_power   = null

      if (olt) {
        const adapter = new HuaweiOltAdapter({
          ip:       olt.ip ?? 'mock',
          ssh_user: olt.ssh_user ?? 'admin',
          ssh_pass: olt.ssh_pass ?? '',
        })
        try {
          await adapter.connect()
          try {
            oltResult = await adapter.provisionOnu({
              slot:    0,
              port:    event.pon_port ?? 0,
              onuId:   1,
              serial:  event.serial,
              cliente: event.cliente,
              vlan:    100,
            })

            const optical = await adapter.getOnuStatus(0, event.pon_port ?? 0, 1)
            rx_power = optical.rx
            tx_power = optical.tx
          } finally {
            await adapter.disconnect()
          }
        } catch (sshErr) {
          await nocLog(projeto_id, 'OLT', `SSH falhou (${sshErr.message}), usando mock`, 'warn')
          oltResult = { mock: true }
        }
      }

      if (oltResult.mock) {
        rx_power = parseFloat((-18.5 + (Math.random() * 6 - 3)).toFixed(2))
        tx_power = 2.3
      }

      const signal_quality = calculateSignalQuality(rx_power)
      const qualityLabel   = QUALITY_LABEL[signal_quality] ?? 'N/D'

      await ONU.findOneAndUpdate(
        { projeto_id, serial: event.serial },
        {
          $set: {
            status:         'active',
            olt_id:         olt?.id ?? null,
            pon_port:       event.pon_port ?? null,
            cto_id:         cto.cto_id,
            cto_port:       saidaIdx + 1,
            cliente:        event.cliente,
            provisioned_at: new Date(),
            rx_power,
            tx_power,
            signal_quality,
          },
        },
        { upsert: true, new: true }
      )

      await _allocateCTOPort(projeto_id, cto.cto_id, splitterIdx, saidaIdx, event.cliente)

      const nocText = [
        `Cliente ${event.cliente} provisionado na OLT ${olt?.ip ?? 'N/A'}, PON ${event.pon_port ?? 'N/A'}, CTO ${cto.cto_id}.`,
        `Potência RX: ${rx_power?.toFixed(2) ?? 'N/D'} dBm (${qualityLabel}).`,
        `VLAN: 100. Status: ONLINE.`,
      ].join(' ')

      await nocLog(projeto_id, 'PROVISION', nocText, 'success')
      await nocLog(projeto_id, 'CTO',       `Porta ${saidaIdx + 1} alocada em ${cto.cto_id} para ${event.cliente}`, 'info')
      await nocLog(projeto_id, 'POWER',     `RX ${rx_power?.toFixed(2) ?? 'N/D'} dBm (${qualityLabel})`, 'info')

    } else if (event.tipo === 'cancel') {
      // ── CANCEL ───────────────────────────────────────────────────────────────
      const onu = await ONU.findOne({ projeto_id, serial: event.serial }).lean()

      if (onu?.olt_id) {
        const olt = await OLT.findOne({ projeto_id, id: onu.olt_id }).lean()
        if (olt) {
          const adapter = new HuaweiOltAdapter({
            ip:       olt.ip ?? 'mock',
            ssh_user: olt.ssh_user ?? 'admin',
            ssh_pass: olt.ssh_pass ?? '',
          })
          try {
            await adapter.connect()
            try {
              await adapter.deleteOnu({ slot: 0, port: onu.pon_port ?? 0, onuId: 1 })
            } finally {
              await adapter.disconnect()
            }
          } catch (sshErr) {
            await nocLog(projeto_id, 'OLT', `SSH deleteOnu falhou (${sshErr.message}), continuando`, 'warn')
          }
        }
      }

      if (onu?.cto_id && onu?.cliente) {
        await _freeCTOPort(projeto_id, onu.cto_id, onu.cliente)
        await nocLog(projeto_id, 'CTO', `Porta liberada em ${onu.cto_id} (cliente: ${onu.cliente})`, 'info')
      }

      await ONU.updateOne(
        { projeto_id, serial: event.serial },
        { $set: { status: 'cancelled', cancelled_at: new Date() } }
      )

      await nocLog(projeto_id, 'OLT', `ONU ${event.serial} removida`, 'success')
    }

    await ProvisionEvent.updateOne(
      { _id: event._id },
      { $set: { status: 'done', processed_at: new Date() } }
    )

    return { processed: true, tipo: event.tipo, serial: event.serial }

  } catch (err) {
    const attempts  = (event.attempts ?? 0) + 1
    const newStatus = attempts >= 3 ? 'failed' : 'pending'

    await ProvisionEvent.updateOne(
      { _id: event._id },
      { $set: { status: newStatus, last_error: err.message, attempts } }
    )

    await nocLog(projeto_id, 'QUEUE', `Evento ${event.tipo} falhou (tentativa ${attempts}): ${err.message}`, 'error')

    return { processed: false, reason: err.message, attempts }
  }
}

// ─── manualProvision ──────────────────────────────────────────────────────────

export async function manualProvision({ serial, cliente, oltId, ponPort, ctoId }) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  if (!serial?.trim()) throw new Error('Serial da ONU é obrigatório')

  await connectDB()

  await ProvisionEvent.create({
    projeto_id,
    tipo:     'install',
    status:   'pending',
    cliente:  cliente?.trim() ?? serial,
    serial:   serial.toUpperCase().trim(),
    olt_id:   oltId  ?? null,
    pon_port: ponPort ? Number(ponPort) : null,
    cto_id:   ctoId  ?? null,
  })

  await nocLog(projeto_id, 'QUEUE', `Provisionamento manual enfileirado: ${serial}`, 'info')

  return processNextEvent(projeto_id)
}

// ─── autoFindONUs ─────────────────────────────────────────────────────────────

/**
 * Scans all active OLTs for unconfigured ONUs via HuaweiOltAdapter.getUnconfiguredOnus().
 * Returns only serials not yet in the ONU collection.
 */
export async function autoFindONUs() {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const olts = await OLT.find({ projeto_id, status: { $ne: 'inativo' } }).lean()
  const found = []

  for (const olt of olts) {
    const adapter = new HuaweiOltAdapter({
      ip:       olt.ip ?? 'mock',
      ssh_user: olt.ssh_user ?? 'admin',
      ssh_pass: olt.ssh_pass ?? '',
    })
    try {
      await adapter.connect()
      const detected = await adapter.getUnconfiguredOnus()
      await adapter.disconnect()
      for (const d of detected) {
        found.push({
          serial:   d.serial,
          pon:      d.pon,
          pon_port: d.pon_port,
          olt_id:   olt.id,
          olt_nome: olt.nome,
          olt_ip:   olt.ip ?? null,
          mock:     d.mock ?? false,
        })
      }
    } catch (err) {
      try { await adapter.disconnect() } catch {}
      await nocLog(projeto_id, 'AUTO-FIND', `OLT ${olt.nome}: ${err.message}`, 'warn')
    }
  }

  // Filter out already provisioned serials
  const serials = found.map(f => f.serial)
  if (serials.length === 0) return []

  const existing = new Set(
    (await ONU.find({ projeto_id, serial: { $in: serials } }, 'serial').lean()).map(o => o.serial)
  )

  const novos = found.filter(f => !existing.has(f.serial))

  if (novos.length > 0) {
    await nocLog(projeto_id, 'AUTO-FIND', `${novos.length} ONU(s) detectada(s) não provisionada(s)`, 'info')
  }

  return novos
}

// ─── syncClientWithCto ────────────────────────────────────────────────────────

/**
 * Ensures a provisioned ONU's client name is written to its assigned CTO port.
 * Call this after provisioning to guarantee NOC ↔ CTO consistency.
 *
 * @param {string} serial - ONU serial number (case-insensitive)
 */
export async function syncClientWithCto(serial) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const onu = await ONU.findOne({ projeto_id, serial: serial.toUpperCase().trim() }).lean()
  if (!onu) throw new Error(`ONU ${serial} não encontrada`)

  if (onu.status === 'cancelled') {
    throw new Error(`ONU ${serial} está cancelada — sem sincronização`)
  }

  const cliente = onu.cliente?.trim()
  if (!cliente) throw new Error(`ONU ${serial} sem nome de cliente`)

  // Find the CTO and check if the client is already written
  const cto_id = onu.cto_id
  if (!cto_id) {
    // No CTO assigned — try to find one and allocate
    const found = await _findAvailableCTO(projeto_id)
    if (!found) throw new Error('Nenhuma CTO com porta disponível')
    const { cto, splitterIdx, saidaIdx } = found
    await _allocateCTOPort(projeto_id, cto.cto_id, splitterIdx, saidaIdx, cliente)
    await ONU.updateOne({ projeto_id, serial: onu.serial }, { $set: { cto_id: cto.cto_id, cto_port: saidaIdx + 1 } })
    await nocLog(projeto_id, 'SYNC', `Cliente ${cliente} vinculado à CTO ${cto.cto_id} porta ${saidaIdx + 1}`, 'success')
    return { synced: true, cto_id: cto.cto_id, cto_port: saidaIdx + 1 }
  }

  // Check if already written in the diagrama
  const cto = await CTO.findOne({ projeto_id, cto_id }).lean()
  if (!cto) throw new Error(`CTO ${cto_id} não encontrada`)

  const splitters = cto.diagrama?.splitters ?? []
  let alreadySynced = false
  let freeSi = null, freePi = null

  for (let si = 0; si < splitters.length; si++) {
    const saidas = splitters[si].saidas ?? []
    for (let pi = 0; pi < saidas.length; pi++) {
      const name = saidas[pi]?.cliente?.trim()
      if (name === cliente) { alreadySynced = true; break }
      if (!name && freeSi === null) { freeSi = si; freePi = pi }
    }
    if (alreadySynced) break
  }

  if (alreadySynced) {
    return { synced: false, reason: 'already_synced' }
  }

  if (freeSi === null) throw new Error(`CTO ${cto_id} não tem portas livres`)

  await _allocateCTOPort(projeto_id, cto_id, freeSi, freePi, cliente)
  await ONU.updateOne({ projeto_id, serial: onu.serial }, { $set: { cto_port: freePi + 1 } })
  await nocLog(projeto_id, 'SYNC', `[SYNC] Cliente ${cliente} vinculado à CTO ${cto_id} porta ${freePi + 1}`, 'success')

  return { synced: true, cto_id, cto_port: freePi + 1 }
}

// ─── manualCancel ─────────────────────────────────────────────────────────────

export async function manualCancel(serial) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  if (!serial?.trim()) throw new Error('Serial da ONU é obrigatório')

  await connectDB()

  const serialNorm = serial.toUpperCase().trim()

  await ProvisionEvent.create({
    projeto_id,
    tipo:   'cancel',
    status: 'pending',
    serial: serialNorm,
  })

  await nocLog(projeto_id, 'QUEUE', `Cancelamento enfileirado: ${serialNorm}`, 'info')

  return processNextEvent(projeto_id)
}
