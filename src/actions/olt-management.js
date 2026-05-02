/**
 * src/actions/olt-management.js
 * Server Actions for real-time OLT management: info, PON ports, ONU listing,
 * ONU detail, ONU reboot, and ONU deletion.
 *
 * All actions:
 *   - Require an authenticated session with NOC_ALLOWED roles.
 *   - Verify the tenant's empresa is active via requireActiveEmpresa.
 *   - Connect to MongoDB before any model access.
 *   - Open an SSH adapter session, run the operation, then always disconnect.
 *   - Write a NOC log entry for audit trail (never throws on log failure).
 */

'use server'

import { connectDB }           from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { getOltAdapter }       from '@/lib/olt-adapter-factory'
import { OLT }                 from '@/models/OLT'
import { nocLog }              from '@/lib/noc-logger'

/** Roles permitted to perform OLT management operations. */
const NOC_ALLOWED = ['superadmin', 'admin', 'noc']

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Loads an OLT document and constructs a ready-to-use HuaweiOltAdapter for it.
 * Throws if the OLT is not found within the project.
 *
 * @param {string} projeto_id  - Tenant project ID from the session.
 * @param {string} oltId       - The OLT's `id` field (not the MongoDB _id).
 * @returns {Promise<{ olt: Object, adapter: HuaweiOltAdapter }>}
 */
async function _getOltAndAdapter(projeto_id, oltId) {
  const olt = await OLT.findOne({ projeto_id, id: oltId }).lean()

  if (!olt) {
    throw new Error(`OLT não encontrada: ${oltId}`)
  }

  const adapter = getOltAdapter(olt)

  return { olt, adapter }
}

// ─── getOltInfoAction ─────────────────────────────────────────────────────────

/**
 * Returns hardware and software information for an OLT.
 *
 * @param {string} oltId
 * @returns {Promise<{ olt: { id: string, nome: string, ip: string|null, modelo: string|null, status: string }, info: Object }>}
 */
export async function getOltInfoAction(oltId) {
  const session    = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const { olt, adapter } = await _getOltAndAdapter(projeto_id, oltId)

  await adapter.connect()
  let info
  try {
    info = await adapter.getOltInfo()
  } finally {
    await adapter.disconnect()
  }

  await nocLog(projeto_id, 'OLT', `[OLT] Info carregada: ${olt.nome}`, 'info')

  return {
    olt: {
      id:     olt.id,
      nome:   olt.nome,
      ip:     olt.ip     ?? null,
      modelo: olt.modelo ?? null,
      status: olt.status ?? 'ativo',
    },
    info,
  }
}

// ─── getPonPortsAction ────────────────────────────────────────────────────────

/**
 * Returns the list of GPON PON ports for an OLT.
 *
 * @param {string} oltId
 * @returns {Promise<{ ports: Array<{ slot: number, port: number, pon: string, onus: number, capacidade: number, status: string }> }>}
 */
export async function getPonPortsAction(oltId) {
  const session    = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const { olt, adapter } = await _getOltAndAdapter(projeto_id, oltId)

  await adapter.connect()
  let ports
  try {
    ports = await adapter.getPonPorts()
  } finally {
    await adapter.disconnect()
  }

  await nocLog(projeto_id, 'OLT', `[OLT] Portas PON carregadas: ${olt.nome}`, 'info')

  return { ports }
}

// ─── getOnusAction ────────────────────────────────────────────────────────────

/**
 * Returns all ONUs provisioned on a specific GPON port.
 *
 * @param {string} oltId
 * @param {number} slot
 * @param {number} port
 * @returns {Promise<{ onus: Array<{ onuId: number, serial: string, cliente: string, status: string, rx: number|null, tx: number|null }> }>}
 */
export async function getOnusAction(oltId, slot, port) {
  const session    = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const { adapter } = await _getOltAndAdapter(projeto_id, oltId)

  await adapter.connect()
  let onus
  try {
    onus = await adapter.getOnus(slot, port)
  } finally {
    await adapter.disconnect()
  }

  return { onus }
}

// ─── getOnuDetailAction ───────────────────────────────────────────────────────

/**
 * Returns full detail for a single ONU, including optical power readings.
 *
 * @param {string} oltId
 * @param {number} slot
 * @param {number} port
 * @param {number} onuId
 * @returns {Promise<{ detail: Object }>}
 */
export async function getOnuDetailAction(oltId, slot, port, onuId) {
  const session    = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const { adapter } = await _getOltAndAdapter(projeto_id, oltId)

  await adapter.connect()
  let detail
  try {
    detail = await adapter.getOnuDetail(slot, port, onuId)
  } finally {
    await adapter.disconnect()
  }

  return { detail }
}

// ─── rebootOnuAction ──────────────────────────────────────────────────────────

/**
 * Sends a reboot command to a specific ONU.
 *
 * @param {string}      oltId
 * @param {number}      slot
 * @param {number}      port
 * @param {number}      onuId
 * @param {string|null} clienteNome  - Optional client name for the audit log.
 * @returns {Promise<{ success: boolean }>}
 */
export async function rebootOnuAction(oltId, slot, port, onuId, clienteNome) {
  const session    = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const { adapter } = await _getOltAndAdapter(projeto_id, oltId)

  await adapter.connect()
  let result
  try {
    result = await adapter.rebootOnu(slot, port, onuId)
  } finally {
    await adapter.disconnect()
  }

  await nocLog(
    projeto_id,
    'OLT',
    `[OLT] ONU reiniciada: slot=${slot} port=${port} id=${onuId} cliente=${clienteNome ?? '?'}`,
    'info'
  )

  return { success: result.success }
}

// ─── deleteOnuAction ──────────────────────────────────────────────────────────

/**
 * Removes an ONU from the OLT (deletes provisioning and service port).
 *
 * @param {string}      oltId
 * @param {number}      slot
 * @param {number}      port
 * @param {number}      onuId
 * @param {number|null} servicePortId  - Service-port ID to remove first; null to skip.
 * @param {string|null} clienteNome    - Optional client name for the audit log.
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteOnuAction(oltId, slot, port, onuId, servicePortId, clienteNome) {
  const session    = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const { adapter } = await _getOltAndAdapter(projeto_id, oltId)

  await adapter.connect()
  let result
  try {
    result = await adapter.deleteOnu({ slot, port, onuId, servicePortId })
  } finally {
    await adapter.disconnect()
  }

  await nocLog(
    projeto_id,
    'OLT',
    `[OLT] ONU removida: ${clienteNome ?? onuId}`,
    'info'
  )

  return { success: result.success }
}

// ─── testOltConnectionAction ──────────────────────────────────────────────────

/**
 * Tests the network/protocol connectivity for an OLT and persists the result.
 *
 * Works with all supported protocols (SSH, Telnet, REST API) by delegating
 * to the adapter returned by the factory.
 *
 * @param {string} oltId
 * @returns {Promise<{ ok: boolean, ms: number, message: string, olt_id: string }>}
 */
export async function testOltConnectionAction(oltId) {
  const session    = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const olt = await OLT.findOne({ projeto_id, id: oltId }).lean()
  if (!olt) throw new Error(`OLT não encontrada: ${oltId}`)

  const adapter = getOltAdapter(olt)
  const result  = await adapter.testConnection()

  // Persist link state regardless of outcome
  await OLT.updateOne(
    { projeto_id, id: oltId },
    {
      $set: {
        link_status:    result.ok ? 'online' : 'offline',
        link_tested_at: new Date(),
        link_error:     result.ok ? null : (result.message ?? 'Falha na conexão'),
      },
    }
  )

  await nocLog(
    projeto_id,
    'OLT',
    `[OLT] Teste de conexão: ${olt.nome} → ${result.ok ? 'OK' : 'FALHOU'} (${result.ms}ms)`,
    result.ok ? 'info' : 'warn'
  )

  return { ...result, olt_id: oltId }
}
