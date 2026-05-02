'use server'

import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { ONU } from '@/models/ONU'
import { ProvisionEvent } from '@/models/ProvisionEvent'
import { CTO } from '@/models/CTO'
import { CaixaEmendaCDO } from '@/models/CaixaEmendaCDO'
import { OLT } from '@/models/OLT'
import { HuaweiOltAdapter, analyzeFailure } from '@/lib/huawei-adapter'
import { nocLog } from '@/lib/noc-logger'
import { assignCtoAutomatically } from '@/actions/pon-cto-map'

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

      let oltResult = null
      let rx_power  = null
      let tx_power  = null

      if (olt) {
        const adapter = new HuaweiOltAdapter({
          ip:       olt.ip,
          ssh_user: olt.ssh_user ?? 'admin',
          ssh_pass: olt.ssh_pass ?? '',
          ssh_port: olt.ssh_port ?? 22,
          vendor:   olt.vendor   ?? 'huawei',
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
          // SSH/connection failed — do not fake data, mark event as failed
          await ProvisionEvent.updateOne(
            { _id: event._id },
            { $set: { status: 'failed', last_error: `SSH falhou: ${sshErr.message}`, processed_at: new Date() } }
          )
          await nocLog(projeto_id, 'NOC', `[Provision] SSH falhou para ${olt.nome}: ${sshErr.message}`, 'error')
          return { processed: false, reason: `SSH falhou: ${sshErr.message}` }
        }
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
        if (olt?.ip) {
          const adapter = new HuaweiOltAdapter({
            ip:       olt.ip,
            ssh_user: olt.ssh_user ?? 'admin',
            ssh_pass: olt.ssh_pass ?? '',
            ssh_port: olt.ssh_port ?? 22,
            vendor:   olt.vendor   ?? 'huawei',
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
        } else if (olt) {
          await nocLog(projeto_id, 'OLT', `OLT ${olt.nome ?? olt.id} sem IP — deleteOnu ignorado, prosseguindo cancelamento`, 'warn')
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
    if (!olt.ip) {
      await nocLog(projeto_id, 'NOC', `[AutoFind] OLT ${olt.nome} sem IP configurado — ignorada`, 'warn')
      continue
    }

    const adapter = new HuaweiOltAdapter({
      ip:       olt.ip,
      ssh_user: olt.ssh_user ?? 'admin',
      ssh_pass: olt.ssh_pass ?? '',
      ssh_port: olt.ssh_port ?? 22,
      vendor:   olt.vendor   ?? 'huawei',
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
          board:    d.board ?? null,
          slot:     d.slot  ?? null,
          olt_id:   olt.id,
          olt_nome: olt.nome,
          olt_ip:   olt.ip,
          mock:     false,
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

// ─── analyzeSignal ────────────────────────────────────────────────────────────

function analyzeSignal(rx, tx) {
  let rxQuality, rxClass, rxDiags = []

  if (rx == null) {
    rxQuality = 'N/D'; rxClass = 'unknown'
  } else if (rx > -20) {
    rxQuality = 'EXCELENTE'; rxClass = 'success'
  } else if (rx >= -25) {
    rxQuality = 'BOM'; rxClass = 'bom'
  } else if (rx >= -28) {
    rxQuality = 'LIMITE'; rxClass = 'limite'
    rxDiags.push('Cliente no limite operacional — verificar CTO / fusão')
  } else {
    rxQuality = 'CRÍTICO'; rxClass = 'critico'
    rxDiags.push('Sinal muito baixo (possível problema de fibra, fusão ou CTO)')
  }

  let txStatus, txClass, txDiags = []

  if (tx == null) {
    txStatus = 'N/D'; txClass = 'unknown'
  } else if (tx > 5) {
    txStatus = 'MUITO ALTO'; txClass = 'critico'
    txDiags.push('Potência muito alta (risco de saturação)')
  } else if (tx < 1) {
    txStatus = 'BAIXO'; txClass = 'limite'
    txDiags.push('Potência de retorno baixa')
  } else {
    txStatus = 'OK'; txClass = 'success'
  }

  const allDiags = [...rxDiags, ...txDiags]
  const statusGeral =
    (rxClass === 'critico' || txClass === 'critico') ? 'ALERTA' :
    (rxClass === 'limite'  || txClass === 'limite')  ? 'ATENÇÃO' : 'OK'

  return { rxQuality, rxClass, txStatus, txClass, statusGeral, diags: allDiags }
}

// ─── quickProvisionAutoFound ──────────────────────────────────────────────────

/**
 * One-click provision for an auto-found ONU.
 * Executes directly (no queue): provisions on OLT, reads optical power,
 * generates a technical signal report, and updates the DB.
 *
 * @param {{ serial: string, olt_id: string, olt_ip?: string, pon?: string, pon_port?: number, board?: string, slot?: number, cliente?: string, vlan?: number }} params
 */
export async function quickProvisionAutoFound({ serial, olt_id, olt_ip, pon, pon_port, board, slot, cliente, vlan = 100, ctoIdOverride }) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  if (!serial?.trim()) throw new Error('Serial da ONU é obrigatório')

  await connectDB()

  const serialNorm  = serial.toUpperCase().trim()
  const clienteNorm = cliente?.trim() || serialNorm

  // ── Duplicate guard ───────────────────────────────────────────────────────
  const existing = await ONU.findOne({
    projeto_id,
    serial: serialNorm,
    status: { $ne: 'cancelled' },
  }).lean()
  if (existing) throw new Error(`ONU ${serialNorm} já está provisionada`)

  await nocLog(projeto_id, 'AUTO-FIND', `ONU detectada: ${serialNorm} (PON ${pon ?? 'N/A'})`, 'info')
  await nocLog(projeto_id, 'PROVISION', `ONU autorizada: ${serialNorm}`, 'info')

  // ── Find OLT ─────────────────────────────────────────────────────────────
  const olt = olt_id ? await OLT.findOne({ projeto_id, id: olt_id }).lean() : null

  // ── Find CTO: override → PON mapping → fallback ──────────────────────────
  let assignResult   = null
  let assignStrategy = 'fallback'

  if (ctoIdOverride) {
    // Manual override from ProvisionModal dropdown
    const found = await _findAvailableCTO(projeto_id, ctoIdOverride)
    if (!found) throw new Error(`CTO ${ctoIdOverride} não encontrada ou sem portas livres`)
    assignResult   = { success: true, cto: found.cto, splitterIdx: found.splitterIdx, saidaIdx: found.saidaIdx, cto_id: ctoIdOverride }
    assignStrategy = 'manual_override'
    await nocLog(projeto_id, 'CTO', `CTO ${ctoIdOverride} selecionada manualmente pelo operador`, 'info')

  } else if (olt_id && pon) {
    await nocLog(projeto_id, 'CTO', `Identificação automática iniciada — PON ${pon}`, 'info')

    assignResult = await assignCtoAutomatically({ projeto_id, olt_id, pon, rx_power: null })

    if (assignResult.success) {
      assignStrategy = assignResult.reason
      await nocLog(projeto_id, 'CTO', `PON ${pon} → CTO ${assignResult.cto_id} selecionada (${assignResult.reason})`, 'info')
    } else {
      await nocLog(projeto_id, 'CTO', `PON ${pon}: ${assignResult.reason} — usando fallback`, 'warn')
    }
  }

  let cto, splitterIdx, saidaIdx

  if (assignResult?.success) {
    cto         = assignResult.cto
    splitterIdx = assignResult.splitterIdx
    saidaIdx    = assignResult.saidaIdx
  } else {
    // Fallback: first CTO with a free port
    const found = await _findAvailableCTO(projeto_id)
    if (!found) throw new Error('Nenhuma CTO com porta disponível encontrada')
    cto         = found.cto
    splitterIdx = found.splitterIdx
    saidaIdx    = found.saidaIdx
  }

  // ── Provision on OLT ─────────────────────────────────────────────────────
  let rx_power  = null
  let tx_power  = null
  let oltResult = null
  let onuIdUsed = 1

  if (!olt?.ip) {
    throw new Error(`OLT "${olt?.nome ?? olt_id ?? 'desconhecida'}" não tem IP configurado`)
  }

  const adapter = new HuaweiOltAdapter({
    ip:       olt.ip,
    ssh_user: olt?.ssh_user ?? 'admin',
    ssh_pass: olt?.ssh_pass ?? '',
    ssh_port: olt?.ssh_port ?? 22,
    vendor:   olt?.vendor   ?? 'huawei',
  })

  try {
    await adapter.connect()
    try {
      const slotNum = slot ?? 0
      const portNum = pon_port ?? 0

      oltResult = await adapter.provisionOnu({
        slot:    slotNum,
        port:    portNum,
        onuId:   onuIdUsed,
        serial:  serialNorm,
        cliente: clienteNorm,
        vlan,
      })
      await nocLog(projeto_id, 'OLT', `Configuração aplicada: interface gpon 0/${slotNum}, VLAN ${vlan}`, 'info')

      // Give ONU a moment to register, then read optical power
      await new Promise(r => setTimeout(r, 2000))
      const optical = await adapter.getOnuStatus(slotNum, portNum, onuIdUsed)
      rx_power = optical.rx
      tx_power = optical.tx
    } finally {
      await adapter.disconnect()
    }
  } catch (sshErr) {
    try { await adapter.disconnect() } catch {}
    throw new Error(`SSH falhou para OLT ${olt.nome ?? olt.ip}: ${sshErr.message}`)
  }

  // ── Signal analysis ──────────────────────────────────────────────────────
  const signal_quality = calculateSignalQuality(rx_power)
  const sig = analyzeSignal(rx_power, tx_power)

  const signal_status =
    sig.diags.length > 0 ? sig.diags[0] : 'Sinal dentro dos parâmetros normais'

  // ── Build technical report ───────────────────────────────────────────────
  const ctoAssignLine = assignResult?.success
    ? `CTO: ${cto.cto_id} (porta ${saidaIdx + 1}) — vinculação ${assignStrategy === 'first_available' ? 'automática (primeira disponível na PON)' : 'automática (mapeamento PON)'}`
    : `CTO: ${cto.cto_id} (porta ${saidaIdx + 1}) — vinculação por fallback (sem mapeamento PON)`

  const report = [
    'ONU provisionada com sucesso.',
    '',
    `OLT: ${olt?.ip ?? olt_ip ?? 'N/A'}`,
    `Placa: ${board ?? 'N/A'}`,
    `PON: ${pon ?? 'N/A'}`,
    ctoAssignLine,
    '',
    `Potência de chegada (RX): ${rx_power?.toFixed(2) ?? 'N/D'} dBm → ${sig.rxQuality}`,
    `Potência de retorno (TX): ${tx_power?.toFixed(2) ?? 'N/D'} dBm → ${sig.txStatus}`,
    '',
    `DB ONU: ${rx_power?.toFixed(2) ?? 'N/D'} dBm`,
    `DB OLT: ${tx_power?.toFixed(2) ?? 'N/D'} dBm`,
    '',
    `Status geral: ${sig.statusGeral}`,
    '',
    ...(sig.diags.length > 0
      ? ['Diagnóstico:', ...sig.diags.map(d => `- ${d}`)]
      : ['Diagnóstico: Sem alertas']),
  ].join('\n')

  // ── Persist to DB ────────────────────────────────────────────────────────
  await ONU.findOneAndUpdate(
    { projeto_id, serial: serialNorm },
    {
      $set: {
        status:         'active',
        olt_id:         olt_id ?? null,
        pon_port:       pon_port ?? null,
        pon:            pon ?? null,
        board:          board ?? null,
        cto_id:         cto.cto_id,
        cto_port:       saidaIdx + 1,
        cliente:        clienteNorm,
        provisioned_at: new Date(),
        rx_power,
        tx_power,
        signal_quality,
        signal_status,
      },
    },
    { upsert: true, new: true }
  )

  await _allocateCTOPort(projeto_id, cto.cto_id, splitterIdx, saidaIdx, clienteNorm)

  // ── NOC logs ─────────────────────────────────────────────────────────────
  await nocLog(projeto_id, 'PROVISION', `Cliente ${clienteNorm} provisionado com sucesso. CTO ${cto.cto_id} porta ${saidaIdx + 1}`, 'success')
  await nocLog(projeto_id, 'CTO',       `Porta ${saidaIdx + 1} alocada em ${cto.cto_id} para ${clienteNorm}`, 'info')
  await nocLog(projeto_id, 'POWER',     `RX ${rx_power?.toFixed(2) ?? 'N/D'} dBm (${sig.rxQuality})`, 'info')
  await nocLog(projeto_id, 'POWER',     `TX ${tx_power?.toFixed(2) ?? 'N/D'} dBm (${sig.txStatus})`, 'info')

  return {
    success:        true,
    serial:         serialNorm,
    cliente:        clienteNorm,
    olt_ip:         olt?.ip ?? olt_ip ?? null,
    board:          board ?? null,
    pon:            pon ?? null,
    cto_id:         cto.cto_id,
    cto_port:       saidaIdx + 1,
    assign_strategy: assignStrategy,
    rx_power,
    tx_power,
    signal_quality,
    rxQuality:      sig.rxQuality,
    rxClass:        sig.rxClass,
    txStatus:       sig.txStatus,
    txClass:        sig.txClass,
    statusGeral:    sig.statusGeral,
    diags:          sig.diags,
    report,
    mock:           false,
  }
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

// ─── testOnuConnection ────────────────────────────────────────────────────────

/**
 * Runs live diagnostics on a provisioned ONU.
 * Connects to the OLT via SSH, collects run-state and optical power,
 * then calls analyzeFailure() to produce a structured diagnostic report.
 *
 * Saves last_tested_at, last_status, last_diagnostic, rx_power, tx_power to DB.
 *
 * @param {{ serial: string }} params
 * @returns {{ status, problema, rx, tx, rx_raw, tx_raw, recomendacao, nivel, mock }}
 */
export async function testOnuConnection({ serial }) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  if (!serial?.trim()) throw new Error('Serial da ONU é obrigatório')

  await connectDB()

  const serialNorm = serial.toUpperCase().trim()

  const onu = await ONU.findOne({ projeto_id, serial: serialNorm }).lean()
  if (!onu) throw new Error(`ONU ${serialNorm} não encontrada`)

  await nocLog(projeto_id, 'TEST', `Iniciando teste ONU ${serialNorm}`, 'info')

  const olt = onu.olt_id
    ? await OLT.findOne({ projeto_id, id: onu.olt_id }).lean()
    : null

  // Parse PON string "0/1/0" → slot=1, port=0
  let slot = 0, port = 0
  if (onu.pon) {
    const parts = onu.pon.split('/')
    slot = parseInt(parts[1] ?? '0', 10)
    port = parseInt(parts[2] ?? '0', 10)
  }

  const onuId = onu.onu_id_olt ?? 1

  if (!olt?.ip) {
    return { ok: false, error: `OLT não tem IP configurado — não é possível testar a ONU ${serialNorm}` }
  }

  const adapter = new HuaweiOltAdapter({
    ip:       olt.ip,
    ssh_user: olt?.ssh_user ?? 'admin',
    ssh_pass: olt?.ssh_pass ?? '',
    ssh_port: olt?.ssh_port ?? 22,
    vendor:   olt?.vendor   ?? 'huawei',
  })

  let status          = 'unknown'
  let last_down_cause = null
  let rx              = null
  let tx              = null

  try {
    await adapter.connect()

    try {
      const [runStatus, optical] = await Promise.all([
        adapter.getOnuRunStatus(slot, port, onuId),
        adapter.getOpticalInfo(slot, port, onuId),
      ])

      status          = runStatus.status
      last_down_cause = runStatus.last_down_cause
      rx              = optical.rx
      tx              = optical.tx
    } finally {
      await adapter.disconnect()
    }

    await nocLog(
      projeto_id, 'OLT',
      `Dados coletados ONU ${serialNorm}: status=${status} RX=${rx?.toFixed(2) ?? 'N/D'} TX=${tx?.toFixed(2) ?? 'N/D'}`,
      'info'
    )
  } catch (sshErr) {
    try { await adapter.disconnect() } catch {}
    await nocLog(projeto_id, 'OLT', `SSH falhou para ONU ${serialNorm}: ${sshErr.message}`, 'error')
    return { ok: false, error: sshErr.message }
  }

  const diag = analyzeFailure({ status, rx, tx, last_down_cause })

  await nocLog(
    projeto_id, 'ANALYSIS',
    `${serialNorm}: ${diag.problema}`,
    diag.nivel === 'ok' ? 'success' : diag.nivel === 'atencao' ? 'warn' : 'error'
  )

  // Persist results — only real data from OLT
  await ONU.updateOne(
    { projeto_id, serial: serialNorm },
    {
      $set: {
        last_tested_at:  new Date(),
        last_status:     status,
        last_diagnostic: diag.problema,
        rx_power:        rx  ?? onu.rx_power,
        tx_power:        tx  ?? onu.tx_power,
        signal_quality:  calculateSignalQuality(rx ?? onu.rx_power),
        ...(status === 'offline' ? { status: 'offline' } : {}),
        ...(status === 'online'  ? { status: 'active'  } : {}),
      },
    }
  )

  return { ...diag, mock: false }
}

// ─── monitorOfflineOnus ───────────────────────────────────────────────────────

/**
 * Scans all offline ONUs for the current project and runs a quick diagnostic
 * on each one (using DB-cached data — no live OLT call to avoid overload).
 *
 * Returns an alert list suitable for the NOC auto-monitor banner.
 *
 * @returns {Array<{ serial, cliente, olt_id, pon, problema, nivel, last_tested_at }>}
 */
export async function monitorOfflineOnus() {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const offlineOnus = await ONU.find(
    { projeto_id, status: 'offline' },
    'serial cliente olt_id pon rx_power tx_power last_status last_diagnostic last_tested_at'
  ).limit(50).lean()

  return offlineOnus.map(onu => {
    const diag = analyzeFailure({
      status: onu.last_status ?? 'offline',
      rx:     onu.rx_power,
      tx:     onu.tx_power,
    })

    return {
      serial:         onu.serial,
      cliente:        onu.cliente ?? onu.serial,
      olt_id:         onu.olt_id,
      pon:            onu.pon,
      problema:       onu.last_diagnostic ?? diag.problema,
      nivel:          diag.nivel,
      rx:             diag.rx,
      recomendacao:   diag.recomendacao,
      last_tested_at: onu.last_tested_at?.toISOString() ?? null,
    }
  })
}
