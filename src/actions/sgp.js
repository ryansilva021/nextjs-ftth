'use server'

/**
 * src/actions/sgp.js
 * Server Actions for SGP/TMSX integration management.
 * Handles configuration, status queries, and manual sync triggering.
 */

import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { SGPConfig } from '@/models/SGPConfig'
import { ONU } from '@/models/ONU'
import { ProvisionEvent } from '@/models/ProvisionEvent'
import { encrypt, decrypt } from '@/lib/aes-crypt'
import { authenticate, getClientes } from '@/lib/sgp-client'
import { nocLog } from '@/lib/noc-logger'

const NOC_ALLOWED = ['superadmin', 'admin', 'noc']

// ─── saveSGPConfig ────────────────────────────────────────────────────────────

/**
 * Saves or updates the SGP/TMSX connection configuration.
 * Password is encrypted before storage.
 *
 * @param {{ host: string, username: string, password: string }} data
 * @returns {Promise<{ saved: boolean }>}
 */
export async function saveSGPConfig(data) {
  const session = await requireActiveEmpresa(['superadmin', 'admin'])
  const { projeto_id } = session.user

  const { host, username, password } = data ?? {}

  if (!host || !username || !password) {
    throw new Error('host, username e password são obrigatórios')
  }

  const password_enc = encrypt(password)

  await connectDB()

  await SGPConfig.findOneAndUpdate(
    { projeto_id },
    {
      $set: {
        host:         host.trim(),
        username:     username.trim(),
        password_enc,
        is_active:    true,
      },
    },
    { upsert: true, new: true }
  )

  await nocLog(projeto_id, 'SGP', `Configuração SGP atualizada por ${session.user.username}`, 'info')

  return { saved: true }
}

// ─── getSGPStatus ─────────────────────────────────────────────────────────────

/**
 * Returns the current SGP integration status for the dashboard.
 *
 * @returns {Promise<{
 *   isConfigured: boolean,
 *   host: string|null,
 *   username: string|null,
 *   lastSync: string|null,
 *   lastSyncStats: { novos: number, cancelamentos: number, erros: number }|null,
 *   isSyncing: boolean,
 * }>}
 */
export async function getSGPStatus() {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const sgp = await SGPConfig.findOne({ projeto_id }).lean()

  if (!sgp) {
    return {
      isConfigured:  false,
      host:          null,
      username:      null,
      lastSync:      null,
      lastSyncStats: null,
      isSyncing:     false,
    }
  }

  const stats = sgp.last_sync_stats ?? null
  return {
    isConfigured:  !!(sgp.host && sgp.username && sgp.password_enc),
    host:          sgp.host      ?? null,
    username:      sgp.username  ?? null,
    lastSync:      sgp.last_sync ? sgp.last_sync.toISOString() : null,
    lastSyncStats: stats ? {
      novos:         stats.novos         ?? 0,
      cancelamentos: stats.cancelamentos ?? 0,
      sincronizados: stats.sincronizados ?? 0,
      erros:         stats.erros         ?? 0,
    } : null,
    isSyncing:     sgp.is_syncing ?? false,
  }
}

// ─── syncSGP ─────────────────────────────────────────────────────────────────

/**
 * Manually triggers a full SGP synchronization.
 * Compares subscriber list from SGP against the ONU collection and
 * creates ProvisionEvents for any delta (new installs or cancellations).
 *
 * @returns {Promise<{ novos: number, cancelamentos: number, erros: number }>}
 */
export async function syncSGP() {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const sgp = await SGPConfig.findOne({ projeto_id })
  if (!sgp) throw new Error('SGP não configurado para este projeto')
  if (!sgp.is_active) throw new Error('Integração SGP está desativada')
  if (sgp.is_syncing) {
    return { novos: 0, cancelamentos: 0, erros: 0, message: 'Sincronização já em andamento' }
  }

  // Lock the sync
  await SGPConfig.updateOne({ projeto_id }, { $set: { is_syncing: true } })
  await nocLog(projeto_id, 'SGP', 'Sincronização iniciada', 'info')

  let novos         = 0
  let cancelamentos = 0
  let sincronizados = 0
  let erros         = 0

  try {
    const password = decrypt(sgp.password_enc)
    const token    = await authenticate(sgp.host, sgp.username, password)

    await nocLog(projeto_id, 'SGP', `Autenticado em ${sgp.host}`, 'info')

    const clientes = await getClientes(sgp.host, token)

    await nocLog(projeto_id, 'SYNC', `${clientes.length} clientes recebidos do SGP`, 'info')

    for (const cliente of clientes) {
      if (!cliente.serial) continue

      try {
        const serialNorm = cliente.serial.toUpperCase().trim()
        const onu        = await ONU.findOne({ projeto_id, serial: serialNorm }).lean()
        const cs         = cliente.contrato_status // 'ativo' | 'suspenso' | 'cancelado'

        if (!onu) {
          if (cs === 'ativo') {
            await ProvisionEvent.create({
              projeto_id,
              tipo:    'install',
              status:  'pending',
              cliente: cliente.nome,
              serial:  serialNorm,
            })
            novos++
          }
        } else if (cs === 'cancelado' && onu.status !== 'cancelled') {
          await ProvisionEvent.create({
            projeto_id,
            tipo:    'cancel',
            status:  'pending',
            cliente: cliente.nome,
            serial:  serialNorm,
            olt_id:  onu.olt_id ?? null,
            cto_id:  onu.cto_id ?? null,
          })
          await ONU.updateOne({ _id: onu._id }, { $set: { status: 'cancelled' } })
          cancelamentos++
        } else if (cs === 'suspenso' && onu.status === 'active') {
          await ONU.updateOne({ _id: onu._id }, { $set: { status: 'offline', last_status: 'suspenso_sgp' } })
          sincronizados++
        } else if (cs === 'ativo' && onu.status === 'offline') {
          await ONU.updateOne({ _id: onu._id }, { $set: { status: 'active', last_status: 'reativado_sgp' } })
          sincronizados++
        }
      } catch (itemErr) {
        console.error('[SGP] Error processing cliente:', cliente.id, itemErr.message)
        erros++
      }
    }

    await nocLog(
      projeto_id,
      'SYNC',
      `Sync concluído: ${novos} novos, ${cancelamentos} cancelamentos, ${sincronizados} atualizações, ${erros} erros`,
      erros > 0 ? 'warn' : 'success'
    )
  } catch (err) {
    console.error('[SGP] syncSGP error:', err.message)
    await nocLog(projeto_id, 'SGP', `Erro na sincronização: ${err.message}`, 'error')
    erros++
  } finally {
    await SGPConfig.updateOne(
      { projeto_id },
      {
        $set: {
          is_syncing:      false,
          last_sync:       new Date(),
          last_sync_stats: { novos, cancelamentos, sincronizados, erros },
        },
      }
    )
  }

  return { novos, cancelamentos, sincronizados, erros }
}

// ─── fetchFromSGP ─────────────────────────────────────────────────────────────

export async function fetchFromSGP() {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const sgp = await SGPConfig.findOne({ projeto_id })
  if (!sgp) throw new Error('SGP não configurado para este projeto')
  if (!sgp.is_active) throw new Error('Integração SGP está desativada')

  const password = decrypt(sgp.password_enc)
  const token    = await authenticate(sgp.host, sgp.username, password)
  const clientes = await getClientes(sgp.host, token)

  const novos         = []
  const cancelamentos = []

  for (const cliente of clientes) {
    if (!cliente.serial) continue
    const serialNorm = cliente.serial.toUpperCase().trim()
    const onu        = await ONU.findOne({ projeto_id, serial: serialNorm }).lean()
    const isAtivo    = cliente.status === 'ativo'

    if (!onu && isAtivo) {
      novos.push({ serial: serialNorm, nome: cliente.nome, id: cliente.id })
    } else if (onu && !isAtivo && onu.status !== 'cancelled') {
      cancelamentos.push({ serial: serialNorm, nome: cliente.nome, onu_id: onu._id.toString() })
    }
  }

  await nocLog(projeto_id, 'SGP', `Leitura SGP: ${novos.length} novos, ${cancelamentos.length} cancelamentos detectados`, 'info')

  return { novos, cancelamentos }
}

// ─── applyFromSGP ─────────────────────────────────────────────────────────────

export async function applyFromSGP({ installs = [], cancels = [] }) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  let criados = 0

  for (const item of installs) {
    if (!item.serial) continue
    const serialNorm = item.serial.toUpperCase().trim()
    await ProvisionEvent.create({
      projeto_id,
      tipo:    'install',
      status:  'pending',
      cliente: item.nome ?? serialNorm,
      serial:  serialNorm,
    })
    criados++
  }

  for (const item of cancels) {
    if (!item.serial) continue
    const serialNorm = item.serial.toUpperCase().trim()
    await ProvisionEvent.create({
      projeto_id,
      tipo:   'cancel',
      status: 'pending',
      serial: serialNorm,
    })
    criados++
  }

  await nocLog(projeto_id, 'SGP', `${criados} eventos criados a partir da leitura SGP`, 'info')

  return { criados }
}
